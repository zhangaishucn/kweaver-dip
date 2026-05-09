import {
  DefaultBknAdapter,
  type BknAdapter,
  type BknAdapterOptions,
  type CreateBknHttpClient
} from "../adapters/bkn-adapter";
import type { BknProxyResponse } from "../infra/bkn-http-client";
import type { BknQuery } from "../types/bkn";

/**
 * Application logic that proxies BKN knowledge network requests.
 */
export interface BknLogic {
  /**
   * Fetches the BKN knowledge network list.
   *
   * @param query Incoming query string values.
   * @param businessDomain Upstream `x-business-domain` value.
   * @returns The normalized upstream response.
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
   * @returns The normalized upstream response.
   */
  getKnowledgeNetwork(
    knId: string,
    query: BknQuery,
    businessDomain?: string,
    bearerToken?: string
  ): Promise<BknProxyResponse>;
}

/**
 * Runtime dependencies required by {@link DefaultBknLogic}.
 */
export interface BknLogicOptions extends BknAdapterOptions {
  /**
   * Optional adapter override used by tests.
   */
  adapter?: BknAdapter;
}

/**
 * Default BKN logic implementation backed by the BKN adapter.
 */
export class DefaultBknLogic implements BknLogic {
  private readonly adapter: BknAdapter;

  /**
   * Creates the BKN logic.
   *
   * @param options Optional dependency overrides for tests.
   */
  public constructor(options: BknLogicOptions = {}) {
    this.adapter = options.adapter ?? new DefaultBknAdapter(options);
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
    return this.adapter.listKnowledgeNetworks(query, businessDomain, bearerToken);
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
    return this.adapter.getKnowledgeNetwork(knId, query, businessDomain, bearerToken);
  }
}

export type { CreateBknHttpClient };
