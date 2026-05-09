import { HttpError } from "../errors/http-error";
import {
  applyInsecureTlsSetting,
  isHttpsUrlString
} from "./insecure-tls";

/**
 * Query values accepted by ISF proxy calls.
 */
export type IsfQuery = Record<string, string | string[] | number | boolean | undefined>;

/**
 * HTTP methods currently needed by ISF proxy adapters.
 */
export type IsfHttpMethod = "GET" | "POST";

/**
 * Static configuration for the ISF HTTP client.
 */
export interface IsfHttpClientOptions {
  /**
   * KWeaver / ISF service base URL.
   */
  baseUrl: string;

  /**
   * Request timeout in milliseconds.
   */
  timeoutMs: number;
}

/**
 * Per-request ISF forwarding options.
 */
export interface IsfForwardRequestOptions {
  /**
   * HTTP method.
   */
  method: IsfHttpMethod;

  /**
   * Optional query string values.
   */
  query?: IsfQuery;

  /**
   * Optional JSON request body.
   */
  body?: unknown;

  /**
   * Optional bearer token from the incoming Studio request.
   */
  bearerToken?: string;
}

/**
 * Fetch implementation used for dependency injection in tests.
 */
export type IsfFetch = typeof fetch;

/**
 * Lightweight upstream response container used by route handlers.
 */
export interface IsfProxyResponse {
  /**
   * Upstream HTTP status code.
   */
  status: number;

  /**
   * Upstream response headers.
   */
  headers: Headers;

  /**
   * Raw upstream response body.
   */
  body: string;
}

/**
 * Defines the generic ISF forwarding capability used by adapters.
 */
export interface IsfHttpClient {
  /**
   * Forwards one request to ISF.
   *
   * @param path Upstream API path.
   * @param options Request forwarding options.
   * @returns The normalized upstream response.
   */
  forwardRequest(
    path: string,
    options: IsfForwardRequestOptions
  ): Promise<IsfProxyResponse>;
}

/**
 * Default HTTP client used to call ISF APIs through KWeaver base URL.
 */
export class DefaultIsfHttpClient implements IsfHttpClient {
  /**
   * Creates the ISF client.
   *
   * @param options Static upstream configuration.
   * @param fetchImpl Optional fetch implementation for tests.
   */
  public constructor(
    private readonly options: IsfHttpClientOptions,
    private readonly fetchImpl: IsfFetch = fetch
  ) {}

  /**
   * Forwards one request to ISF.
   *
   * @param path Upstream API path.
   * @param options Request forwarding options.
   * @returns The normalized upstream response.
   */
  public async forwardRequest(
    path: string,
    options: IsfForwardRequestOptions
  ): Promise<IsfProxyResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.options.timeoutMs
    ).unref();

    const url = buildIsfUrl(this.options.baseUrl, path, options.query);
    const restoreTlsVerification = isHttpsUrlString(url)
      ? applyInsecureTlsSetting()
      : () => undefined;

    try {
      const response = await this.fetchImpl(url, {
        method: options.method,
        headers: createIsfHeaders(options.bearerToken, options.body),
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal
      }).catch((error: unknown) => {
        throw normalizeIsfError(error);
      });

      return {
        status: response.status,
        headers: new Headers(response.headers),
        body: await response.text()
      };
    } finally {
      restoreTlsVerification();
      clearTimeout(timeout);
    }
  }
}

/**
 * Builds an ISF URL from the configured KWeaver base URL and request components.
 *
 * @param baseUrl Configured KWeaver base URL.
 * @param path Upstream request path.
 * @param query Optional query string values.
 * @returns The normalized request URL.
 */
export function buildIsfUrl(
  baseUrl: string,
  path: string,
  query?: IsfQuery
): string {
  const url = new URL(baseUrl);

  url.pathname = path;
  url.search = "";
  url.hash = "";

  if (query !== undefined) {
    for (const [key, value] of Object.entries(query)) {
      appendIsfQueryValue(url, key, value);
    }
  }

  return url.toString();
}

/**
 * Appends one query entry to the outbound URL when it has a usable value.
 *
 * @param url URL being built.
 * @param key Query parameter name.
 * @param value Query parameter value.
 */
function appendIsfQueryValue(
  url: URL,
  key: string,
  value: IsfQuery[string]
): void {
  if (value === undefined) {
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      if (item.trim().length > 0) {
        url.searchParams.append(key, item);
      }
    }
    return;
  }

  const normalized = String(value).trim();
  if (normalized.length > 0) {
    url.searchParams.set(key, normalized);
  }
}

/**
 * Creates headers used for ISF upstream requests.
 *
 * @param bearerToken Optional bearer token.
 * @param body Optional request body.
 * @returns The request headers.
 */
export function createIsfHeaders(
  bearerToken?: string,
  body?: unknown
): Headers {
  const headers = new Headers({
    accept: "application/json"
  });

  if (body !== undefined) {
    headers.set("content-type", "application/json;charset=UTF-8");
  }

  if (bearerToken !== undefined && bearerToken.trim().length > 0) {
    headers.set("authorization", `Bearer ${bearerToken.trim()}`);
  }

  return headers;
}

/**
 * Normalizes transport failures from outbound ISF requests.
 *
 * @param error Unknown thrown value.
 * @returns The typed HTTP error.
 */
export function normalizeIsfError(error: unknown): HttpError {
  if (error instanceof HttpError) {
    return error;
  }

  if (error instanceof DOMException && error.name === "AbortError") {
    return new HttpError(504, "ISF request timed out");
  }

  const description =
    error instanceof Error ? error.message : "Unknown upstream error";

  return new HttpError(502, `Failed to communicate with ISF: ${description}`);
}
