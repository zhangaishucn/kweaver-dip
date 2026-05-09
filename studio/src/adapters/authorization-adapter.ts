import {
  DefaultIsfHttpClient,
  type IsfHttpClient,
  type IsfHttpClientOptions,
  type IsfProxyResponse,
  type IsfQuery
} from "../infra/isf-http-client";
import { getEnv } from "../utils/env";
import type { CreateIsfHttpClient } from "./user-management-adapter";

/**
 * Adapter for ISF `/authorization` APIs used by Studio.
 */
export interface AuthorizationAdapter {
  /**
   * Lists policies for one accessor.
   *
   * @param query Incoming query parameters.
   * @param bearerToken Optional user bearer token.
   */
  listAccessorPolicies(
    query: IsfQuery,
    bearerToken?: string
  ): Promise<IsfProxyResponse>;

  /**
   * Creates authorization policies.
   *
   * @param body Request body.
   * @param bearerToken Optional user bearer token.
   */
  createPolicies(body: unknown, bearerToken?: string): Promise<IsfProxyResponse>;
}

/**
 * Runtime dependencies required by {@link DefaultAuthorizationAdapter}.
 */
export interface AuthorizationAdapterOptions {
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
 * Default adapter implementation for `/authorization`.
 */
export class DefaultAuthorizationAdapter implements AuthorizationAdapter {
  private readonly getEnvValue: typeof getEnv;
  private readonly createClientValue: CreateIsfHttpClient;

  /**
   * Creates the authorization adapter.
   *
   * @param options Optional dependency overrides for tests.
   */
  public constructor(options: AuthorizationAdapterOptions = {}) {
    this.getEnvValue = options.getEnv ?? getEnv;
    this.createClientValue = options.createClient ?? ((clientOptions) =>
      new DefaultIsfHttpClient(clientOptions));
  }

  /**
   * Lists policies for one accessor.
   *
   * @param query Incoming query parameters.
   * @param bearerToken Optional user bearer token.
   * @returns The normalized upstream response.
   */
  public async listAccessorPolicies(
    query: IsfQuery,
    bearerToken?: string
  ): Promise<IsfProxyResponse> {
    return this.createClient().forwardRequest(
      "/api/authorization/v1/accessor-policy",
      {
        method: "GET",
        query,
        bearerToken
      }
    );
  }

  /**
   * Creates authorization policies.
   *
   * @param body Request body.
   * @param bearerToken Optional user bearer token.
   * @returns The normalized upstream response.
   */
  public async createPolicies(
    body: unknown,
    bearerToken?: string
  ): Promise<IsfProxyResponse> {
    return this.createClient().forwardRequest("/api/authorization/v1/policy", {
      method: "POST",
      body,
      bearerToken
    });
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
