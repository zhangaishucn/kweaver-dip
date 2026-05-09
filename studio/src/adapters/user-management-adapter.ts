import {
  DefaultIsfHttpClient,
  type IsfHttpClient,
  type IsfHttpClientOptions,
  type IsfProxyResponse,
  type IsfQuery
} from "../infra/isf-http-client";
import { getEnv } from "../utils/env";

/**
 * Adapter for ISF `/user-management` APIs used by Studio.
 */
export interface UserManagementAdapter {
  /**
   * Lists application accounts.
   *
   * @param query Incoming query parameters.
   * @param bearerToken Optional user bearer token.
   */
  listApps(query: IsfQuery, bearerToken?: string): Promise<IsfProxyResponse>;

  /**
   * Creates one application account.
   *
   * @param body Request body.
   * @param bearerToken Optional user bearer token.
   */
  createApp(body: unknown, bearerToken?: string): Promise<IsfProxyResponse>;

  /**
   * Creates an application account token.
   *
   * @param body Request body.
   * @param bearerToken Optional user bearer token.
   */
  createAppToken(body: unknown, bearerToken?: string): Promise<IsfProxyResponse>;
}

/**
 * Factory used to create a fresh ISF HTTP client for each request.
 */
export type CreateIsfHttpClient = (options: IsfHttpClientOptions) => IsfHttpClient;

/**
 * Runtime dependencies required by {@link DefaultUserManagementAdapter}.
 */
export interface UserManagementAdapterOptions {
  /**
   * Optional env reader used to resolve current ISF client configuration.
   */
  getEnv?: typeof getEnv;

  /**
   * Optional ISF client factory.
   */
  createClient?: CreateIsfHttpClient;
}

/**
 * Default adapter implementation for `/user-management`.
 */
export class DefaultUserManagementAdapter implements UserManagementAdapter {
  private readonly getEnvValue: typeof getEnv;
  private readonly createClientValue: CreateIsfHttpClient;

  /**
   * Creates the user-management adapter.
   *
   * @param options Optional dependency overrides for tests.
   */
  public constructor(options: UserManagementAdapterOptions = {}) {
    this.getEnvValue = options.getEnv ?? getEnv;
    this.createClientValue = options.createClient ?? ((clientOptions) =>
      new DefaultIsfHttpClient(clientOptions));
  }

  /**
   * Lists application accounts.
   *
   * @param query Incoming query parameters.
   * @param bearerToken Optional user bearer token.
   * @returns The normalized upstream response.
   */
  public async listApps(
    query: IsfQuery,
    bearerToken?: string
  ): Promise<IsfProxyResponse> {
    return this.createClient().forwardRequest("/api/user-management/v1/apps", {
      method: "GET",
      query,
      bearerToken
    });
  }

  /**
   * Creates one application account.
   *
   * @param body Request body.
   * @param bearerToken Optional user bearer token.
   * @returns The normalized upstream response.
   */
  public async createApp(
    body: unknown,
    bearerToken?: string
  ): Promise<IsfProxyResponse> {
    return this.createClient().forwardRequest("/api/user-management/v1/apps", {
      method: "POST",
      body,
      bearerToken
    });
  }

  /**
   * Creates an application account token.
   *
   * @param body Request body.
   * @param bearerToken Optional user bearer token.
   * @returns The normalized upstream response.
   */
  public async createAppToken(
    body: unknown,
    bearerToken?: string
  ): Promise<IsfProxyResponse> {
    return this.createClient().forwardRequest(
      "/api/user-management/v1/console/app-tokens",
      {
        method: "POST",
        body,
        bearerToken
      }
    );
  }

  /**
   * Builds a fresh ISF HTTP client from the current environment snapshot.
   *
   * @returns A newly created ISF HTTP client instance.
   */
  private createClient(): IsfHttpClient {
    const env = this.getEnvValue();

    return this.createClientValue({
      baseUrl: env.kweaverBaseUrl,
      timeoutMs: env.openClawGatewayTimeoutMs
    });
  }
}
