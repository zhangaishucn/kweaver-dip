import {
  DefaultBknHttpClient,
  type BknHttpClient,
  type BknHttpClientOptions,
  type BknProxyResponse
} from "../infra/bkn-http-client";
import type { BknQuery } from "../types/bkn";
import { getEnv } from "../utils/env";

/**
 * Adapter for BKN Backend knowledge network APIs used by Studio.
 */
export interface BknAdapter {
  /**
   * Fetches the BKN knowledge network list.
   *
   * @param query Incoming query string values.
   * @param businessDomain Upstream `x-business-domain` value.
   */
  listKnowledgeNetworks(
    query: BknQuery,
    businessDomain?: string,
    bearerToken?: string
  ): Promise<BknProxyResponse>;

  /**
   * Fetches one BKN knowledge network detail.
   *
   * @param knId Knowledge network id.
   * @param query Incoming query string values.
   * @param businessDomain Upstream `x-business-domain` value.
   */
  getKnowledgeNetwork(
    knId: string,
    query: BknQuery,
    businessDomain?: string,
    bearerToken?: string
  ): Promise<BknProxyResponse>;
}

/**
 * Factory used to create a fresh BKN HTTP client for each request.
 */
export type CreateBknHttpClient = (options: BknHttpClientOptions) => BknHttpClient;

/**
 * Runtime dependencies required by {@link DefaultBknAdapter}.
 */
export interface BknAdapterOptions {
  /**
   * Optional env reader used to resolve current BKN client configuration.
   */
  getEnv?: typeof getEnv;

  /**
   * Optional BKN client factory.
   */
  createClient?: CreateBknHttpClient;
}

/**
 * Default adapter implementation for BKN Backend knowledge networks.
 */
export class DefaultBknAdapter implements BknAdapter {
  private readonly getEnvValue: typeof getEnv;
  private readonly createClientValue: CreateBknHttpClient;

  /**
   * Creates the BKN adapter.
   *
   * @param options Optional dependency overrides for tests.
   */
  public constructor(options: BknAdapterOptions = {}) {
    this.getEnvValue = options.getEnv ?? getEnv;
    this.createClientValue = options.createClient ?? ((clientOptions) =>
      new DefaultBknHttpClient(clientOptions));
  }

  /**
   * Fetches the BKN knowledge network list.
   *
   * @param query Incoming query string values.
   * @param businessDomain Upstream `x-business-domain` value.
   * @returns The normalized upstream response.
   */
  public async listKnowledgeNetworks(
    query: BknQuery,
    businessDomain?: string,
    bearerToken?: string
  ): Promise<BknProxyResponse> {
    return this.createClient().forwardRequest("/api/bkn-backend/v1/knowledge-networks", {
      method: "GET",
      query,
      businessDomain,
      bearerToken
    });
  }

  /**
   * Fetches one BKN knowledge network detail.
   *
   * @param knId Knowledge network id.
   * @param query Incoming query string values.
   * @param businessDomain Upstream `x-business-domain` value.
   * @returns The normalized upstream response.
   */
  public async getKnowledgeNetwork(
    knId: string,
    query: BknQuery,
    businessDomain?: string,
    bearerToken?: string
  ): Promise<BknProxyResponse> {
    return this.createClient().forwardRequest(
      `/api/bkn-backend/v1/knowledge-networks/${encodeURIComponent(knId)}`,
      {
        method: "GET",
        query,
        businessDomain,
        bearerToken
      }
    );
  }

  /**
   * Builds a fresh BKN HTTP client from the current environment snapshot.
   *
   * @returns A newly created BKN HTTP client instance.
   */
  private createClient(): BknHttpClient {
    const env = this.getEnvValue();

    return this.createClientValue({
      baseUrl: env.kweaverBaseUrl,
      timeoutMs: env.openClawGatewayTimeoutMs
    });
  }
}
