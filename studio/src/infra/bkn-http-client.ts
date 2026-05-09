import { HttpError } from "../errors/http-error";
import type { BknQuery } from "../types/bkn";
import {
  applyInsecureTlsSetting,
  isHttpsUrlString
} from "./insecure-tls";

/**
 * Default upstream `x-business-domain` when the inbound request omits the header.
 */
export const DEFAULT_BKN_BUSINESS_DOMAIN = "bd_public";

/**
 * Static configuration for the BKN backend proxy client.
 */
export interface BknHttpClientOptions {
  /**
   * Base URL of the upstream BKN backend.
   */
  baseUrl: string;

  /**
   * Request timeout in milliseconds.
   */
  timeoutMs: number;
}

/**
 * Fetch implementation used for dependency injection in tests.
 */
export type BknFetch = typeof fetch;

/**
 * Lightweight upstream response container used by route handlers.
 */
export interface BknProxyResponse {
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
 * HTTP methods currently needed by the BKN proxy.
 */
export type BknHttpMethod = "GET";

/**
 * Per-request BKN forwarding options.
 */
export interface BknForwardRequestOptions {
  /**
   * HTTP method.
   */
  method: BknHttpMethod;

  /**
   * Optional query string values.
   */
  query?: BknQuery;

  /**
   * Optional upstream `x-business-domain` value.
   */
  businessDomain?: string;

  /**
   * Optional bearer token from the incoming Studio request.
   */
  bearerToken?: string;
}

/**
 * Defines the generic BKN forwarding capability used by adapters.
 */
export interface BknHttpClient {
  /**
   * Forwards one request to the BKN backend.
   *
   * @param path Upstream API path.
   * @param options Request forwarding options.
   */
  forwardRequest(
    path: string,
    options: BknForwardRequestOptions
  ): Promise<BknProxyResponse>;
}

/**
 * Default HTTP client used to forward requests to the BKN backend.
 */
export class DefaultBknHttpClient implements BknHttpClient {
  /**
   * Creates the BKN client.
   *
   * @param options Static upstream configuration.
   * @param fetchImpl Optional fetch implementation for tests.
   */
  public constructor(
    private readonly options: BknHttpClientOptions,
    private readonly fetchImpl: BknFetch = fetch
  ) {}

  /**
   * Executes one outbound request against the configured BKN backend.
   *
   * @param path Upstream path.
   * @param options Request forwarding options.
   * @returns The normalized upstream response.
   */
  public async forwardRequest(
    path: string,
    options: BknForwardRequestOptions
  ): Promise<BknProxyResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.options.timeoutMs
    ).unref();

    const url = buildBknUrl(this.options.baseUrl, path, options.query);
    const headers = createBknHeaders(options.bearerToken, options.businessDomain);

    const restoreTlsVerification = isHttpsUrlString(url)
      ? applyInsecureTlsSetting()
      : () => undefined;

    try {
      const response = await this.fetchImpl(url, {
        method: options.method,
        headers,
        signal: controller.signal
      }).catch((error: unknown) => {
        throw normalizeBknError(error);
      });

      const body = await response.text();

      return {
        status: response.status,
        headers: new Headers(response.headers),
        body
      };
    } finally {
      restoreTlsVerification();
      clearTimeout(timeout);
    }
  }
}

/**
 * Builds a BKN backend URL from the base URL and request components.
 *
 * @param baseUrl Configured BKN backend base URL.
 * @param path Upstream request path.
 * @param query Optional query string values.
 * @returns The normalized request URL.
 */
export function buildBknUrl(baseUrl: string, path: string, query?: BknQuery): string {
  const url = new URL(baseUrl);

  url.pathname = path;
  url.search = "";
  url.hash = "";

  if (query !== undefined) {
    for (const [key, value] of Object.entries(query)) {
      if (typeof value === "string" && value.trim().length > 0) {
        url.searchParams.set(key, value);
      }
    }
  }

  return url.toString();
}

/**
 * Resolves the upstream `x-business-domain` from an inbound header value.
 *
 * @param headerValue Raw `x-business-domain` from the client request.
 * @returns Trimmed non-empty value, or {@link DEFAULT_BKN_BUSINESS_DOMAIN}.
 */
export function resolveBknBusinessDomain(
  headerValue: string | string[] | undefined
): string {
  if (Array.isArray(headerValue)) {
    const first = headerValue[0];
    const trimmed = typeof first === "string" ? first.trim() : "";
    return trimmed.length > 0 ? trimmed : DEFAULT_BKN_BUSINESS_DOMAIN;
  }

  if (typeof headerValue === "string") {
    const trimmed = headerValue.trim();
    return trimmed.length > 0 ? trimmed : DEFAULT_BKN_BUSINESS_DOMAIN;
  }

  return DEFAULT_BKN_BUSINESS_DOMAIN;
}

/**
 * Creates headers used for BKN upstream requests.
 *
 * @param token Optional outbound bearer token.
 * @param businessDomain Upstream `x-business-domain`; empty or omitted uses {@link DEFAULT_BKN_BUSINESS_DOMAIN}.
 * @returns The request headers.
 */
export function createBknHeaders(
  token?: string,
  businessDomain?: string
): Headers {
  const domain =
    businessDomain !== undefined && businessDomain.trim().length > 0
      ? businessDomain.trim()
      : DEFAULT_BKN_BUSINESS_DOMAIN;

  const headers = new Headers({
    accept: "application/json",
    "x-business-domain": domain
  });

  if (token !== undefined && token.trim().length > 0) {
    headers.set("authorization", `Bearer ${token}`);
  }

  return headers;
}

/**
 * Normalizes transport failures from outbound BKN requests.
 *
 * @param error Unknown thrown value.
 * @returns The typed HTTP error.
 */
export function normalizeBknError(error: unknown): HttpError {
  if (error instanceof HttpError) {
    return error;
  }

  if (error instanceof DOMException && error.name === "AbortError") {
    return new HttpError(504, "BKN backend request timed out");
  }

  if (isSelfSignedCertificateError(error)) {
    return new HttpError(
      502,
      "Failed to communicate with BKN backend: self-signed certificate; if the root CA is installed locally, try running Node.js with --use-system-ca"
    );
  }

  const description =
    error instanceof Error ? error.message : "Unknown upstream error";

  return new HttpError(502, `Failed to communicate with BKN backend: ${description}`);
}

/**
 * Detects Node.js TLS certificate validation failures caused by self-signed chains.
 *
 * @param error Unknown thrown value.
 * @returns Whether the error represents a self-signed certificate failure.
 */
export function isSelfSignedCertificateError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  const code =
    typeof Reflect.get(error, "code") === "string"
      ? String(Reflect.get(error, "code")).toUpperCase()
      : "";

  return (
    code === "DEPTH_ZERO_SELF_SIGNED_CERT" ||
    code === "SELF_SIGNED_CERT_IN_CHAIN" ||
    message.includes("self-signed certificate")
  );
}
