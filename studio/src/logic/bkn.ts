import {
  DefaultBknAdapter,
  type BknAdapter,
  type BknAdapterOptions,
  type CreateBknHttpClient
} from "../adapters/bkn-adapter";
import type { BknProxyResponse } from "../infra/bkn-http-client";
import type {
  BknKnowledgeNetworksListQuery,
  BknQuery
} from "../types/bkn";

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
    const listQuery = removeStatisticsQuery(query);
    const response = await this.adapter.listKnowledgeNetworks(listQuery, businessDomain, bearerToken);

    if (!shouldIncludeStatistics(query) || response.status !== 200) {
      return response;
    }

    return enrichKnowledgeNetworkListWithStatistics(
      response,
      async (knId) => this.adapter.getKnowledgeNetwork(
        knId,
        { include_statistics: "true" },
        businessDomain,
        bearerToken
      )
    );
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

interface BknListResponseBody {
  entries?: unknown;
  items?: unknown;
  [key: string]: unknown;
}

interface BknListEntry {
  id?: unknown;
  statistics?: unknown;
  [key: string]: unknown;
}

interface BknDetailResponseBody {
  statistics?: unknown;
}

/**
 * Checks whether the Studio list endpoint should add per-network statistics.
 *
 * @param query Incoming list query.
 * @returns `true` when `include_statistics=true`.
 */
function shouldIncludeStatistics(query: BknQuery): boolean {
  return "include_statistics" in query && query.include_statistics === "true";
}

/**
 * Removes Studio-only list query parameters before forwarding to BKN Backend list API.
 *
 * @param query Incoming list query.
 * @returns Query compatible with the upstream BKN list API.
 */
function removeStatisticsQuery(query: BknQuery): BknKnowledgeNetworksListQuery {
  const { include_statistics: _includeStatistics, ...listQuery } =
    query as BknKnowledgeNetworksListQuery;

  return listQuery;
}

/**
 * Enriches list response entries with detail statistics.
 *
 * @param response Original upstream list response.
 * @param fetchDetail Fetches one knowledge network detail with statistics enabled.
 * @returns List response with `statistics` merged into each matched entry.
 */
async function enrichKnowledgeNetworkListWithStatistics(
  response: BknProxyResponse,
  fetchDetail: (knId: string) => Promise<BknProxyResponse>
): Promise<BknProxyResponse> {
  const body = parseListResponseBody(response.body);

  if (body === undefined) {
    return response;
  }

  const rawEntries = Array.isArray(body.entries)
    ? body.entries
    : Array.isArray(body.items)
      ? body.items
      : undefined;

  if (rawEntries === undefined) {
    return response;
  }

  const entries = rawEntries
    .filter((entry): entry is BknListEntry => typeof entry === "object" && entry !== null);
  const statisticsById = await fetchStatisticsById(entries, fetchDetail);
  const nextEntries = rawEntries.map((entry) => {
    if (typeof entry !== "object" || entry === null) {
      return entry;
    }

    const network = entry as BknListEntry;
    const id = typeof network.id === "string" ? network.id : undefined;
    const statistics = id === undefined ? undefined : statisticsById.get(id);

    return statistics === undefined ? entry : { ...network, statistics };
  });

  return {
    ...response,
    headers: new Headers(response.headers),
    body: JSON.stringify({
      ...body,
      ...(Array.isArray(body.entries) ? { entries: nextEntries } : { items: nextEntries })
    })
  };
}

/**
 * Fetches statistics for all list entries with valid ids.
 *
 * @param entries Parsed knowledge network list entries.
 * @param fetchDetail Fetches one knowledge network detail with statistics enabled.
 * @returns A map from knowledge network id to statistics.
 */
async function fetchStatisticsById(
  entries: BknListEntry[],
  fetchDetail: (knId: string) => Promise<BknProxyResponse>
): Promise<Map<string, unknown>> {
  const pairs = await Promise.all(
    entries.map(async (entry): Promise<[string, unknown] | undefined> => {
      if (typeof entry.id !== "string" || entry.id.trim().length === 0) {
        return undefined;
      }

      const detail = await fetchDetail(entry.id);
      const statistics = parseDetailStatistics(detail);

      return statistics === undefined ? undefined : [entry.id, statistics];
    })
  );

  return new Map(pairs.filter((pair): pair is [string, unknown] => pair !== undefined));
}

/**
 * Parses a BKN list response body.
 *
 * @param body Raw JSON response body.
 * @returns Parsed body, or `undefined` when the body is not an object.
 */
function parseListResponseBody(body: string): BknListResponseBody | undefined {
  try {
    const parsed = JSON.parse(body) as unknown;
    return typeof parsed === "object" && parsed !== null
      ? parsed as BknListResponseBody
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Extracts statistics from a successful detail response.
 *
 * @param response Detail response from BKN Backend.
 * @returns The statistics object when present.
 */
function parseDetailStatistics(response: BknProxyResponse): unknown {
  if (response.status !== 200) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(response.body) as BknDetailResponseBody;
    return typeof parsed.statistics === "object" && parsed.statistics !== null
      ? parsed.statistics
      : undefined;
  } catch {
    return undefined;
  }
}
