import type { DigitalEmployeeTokenAdapter } from "../adapters/digital-employee-token-adapter";
import type { StudioConfigAdapter } from "../adapters/studio-config-adapter";

/**
 * Request payload for the `get_kweaver_token` MCP tool.
 */
export interface GetKweaverTokenRequest {
  /**
   * Digital employee id, equal to the OpenClaw agent id.
   */
  agentId: string;
}

/**
 * Response payload for the `get_kweaver_token` MCP tool.
 */
export interface GetKweaverTokenResult {
  [key: string]: unknown;

  /**
   * Digital employee id, equal to the OpenClaw agent id.
   */
  agentId: string;

  /**
   * KWeaver token associated with the digital employee.
   */
  kweaver_token: string;
}

/**
 * Request payload for the `get_bkn_scope` MCP tool.
 */
export interface GetBknScopeRequest {
  /**
   * Digital employee id, equal to the OpenClaw agent id.
   */
  agentId: string;
}

/**
 * Response payload for the `get_bkn_scope` MCP tool.
 */
export interface GetBknScopeResult {
  [key: string]: unknown;

  /**
   * Digital employee id, equal to the OpenClaw agent id.
   */
  agentId: string;

  /**
   * Comma-separated BKN id list associated with the digital employee.
   */
  bkn_scope: string;
}

/**
 * Response payload for the `get_kweaver_base_url` MCP tool.
 */
export interface GetKweaverBaseUrlResult {
  [key: string]: unknown;

  /**
   * KWeaver service base URL configured for DIP Studio.
   */
  kweaver_base_url: string;
}

/**
 * Application logic exposed through the Studio MCP server.
 */
export interface StudioMcpLogic {
  /**
   * Gets the KWeaver token for one digital employee.
   *
   * @param request Tool request payload.
   * @returns The token result.
   */
  getKweaverToken(request: GetKweaverTokenRequest): Promise<GetKweaverTokenResult>;

  /**
   * Gets the BKN scope for one digital employee.
   *
   * @param request Tool request payload.
   * @returns The BKN scope result.
   */
  getBknScope(request: GetBknScopeRequest): Promise<GetBknScopeResult>;

  /**
   * Gets the KWeaver service base URL configured for DIP Studio.
   *
   * @returns The configured KWeaver service base URL.
   */
  getKweaverBaseUrl(): Promise<GetKweaverBaseUrlResult>;
}

/**
 * Error raised when a digital employee token is not present.
 */
export class KweaverTokenNotFoundError extends Error {
  /**
   * Creates the error.
   *
   * @param agentId Digital employee id used in the lookup.
   */
  public constructor(agentId: string) {
    super(`KWeaver token not found for digital employee: ${agentId}`);
    this.name = "KweaverTokenNotFoundError";
  }
}

/**
 * Error raised when Studio platform configuration is not present.
 */
export class StudioConfigNotFoundError extends Error {
  /**
   * Creates the error.
   */
  public constructor() {
    super("Studio config not found");
    this.name = "StudioConfigNotFoundError";
  }
}

/**
 * Default MCP business logic implementation.
 */
export class DefaultStudioMcpLogic implements StudioMcpLogic {
  /**
   * Creates the logic.
   *
   * @param tokenAdapter Adapter used to read token data.
   * @param configAdapter Adapter used to read Studio platform configuration.
   */
  public constructor(
    private readonly tokenAdapter: DigitalEmployeeTokenAdapter,
    private readonly configAdapter: StudioConfigAdapter
  ) {}

  /**
   * Gets the KWeaver token for one digital employee.
   *
   * @param request Tool request payload.
   * @returns The token result.
   * @throws {Error} Thrown when `agentId` is empty.
   * @throws {KweaverTokenNotFoundError} Thrown when no token is stored.
   */
  public async getKweaverToken(
    request: GetKweaverTokenRequest
  ): Promise<GetKweaverTokenResult> {
    const agentId = request.agentId.trim();

    if (agentId.length === 0) {
      throw new Error("agentId is required");
    }

    const token = await this.tokenAdapter.findKweaverToken(agentId);

    if (token === undefined || token.trim().length === 0) {
      throw new KweaverTokenNotFoundError(agentId);
    }

    return {
      agentId,
      kweaver_token: token
    };
  }

  /**
   * Gets the BKN scope for one digital employee.
   *
   * @param request Tool request payload.
   * @returns The BKN scope result.
   * @throws {Error} Thrown when `agentId` is empty.
   */
  public async getBknScope(
    request: GetBknScopeRequest
  ): Promise<GetBknScopeResult> {
    const agentId = request.agentId.trim();

    if (agentId.length === 0) {
      throw new Error("agentId is required");
    }

    const bknScope = await this.tokenAdapter.findBknScope(agentId);

    return {
      agentId,
      bkn_scope: bknScope?.trim() ?? ""
    };
  }

  /**
   * Gets the KWeaver service base URL configured for DIP Studio.
   *
   * @returns The configured KWeaver service base URL.
   * @throws {StudioConfigNotFoundError} Thrown when no Studio config is stored.
   */
  public async getKweaverBaseUrl(): Promise<GetKweaverBaseUrlResult> {
    const config = await this.configAdapter.findStudioConfig();
    const baseUrl = config?.kweaver_base_url.trim();

    if (baseUrl === undefined || baseUrl.length === 0) {
      throw new StudioConfigNotFoundError();
    }

    return {
      kweaver_base_url: baseUrl
    };
  }
}
