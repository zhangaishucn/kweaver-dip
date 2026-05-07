import type { DigitalEmployeeTokenAdapter } from "../adapters/digital-employee-token-adapter";

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
 * Default MCP business logic implementation.
 */
export class DefaultStudioMcpLogic implements StudioMcpLogic {
  /**
   * Creates the logic.
   *
   * @param tokenAdapter Adapter used to read token data.
   */
  public constructor(private readonly tokenAdapter: DigitalEmployeeTokenAdapter) {}

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
}
