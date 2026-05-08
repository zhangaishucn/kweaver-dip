import type { Pool, RowDataPacket } from "mysql2/promise";

/**
 * Studio platform connection configuration stored in RDS.
 */
export interface StudioConfig {
  /**
   * KWeaver service base URL.
   */
  kweaver_base_url: string;

  /**
   * OpenClaw gateway WebSocket address.
   */
  openclaw_address: string;

  /**
   * OpenClaw gateway token.
   */
  openclaw_token: string;
}

/**
 * Port used to read and write Studio platform configuration.
 */
export interface StudioConfigAdapter {
  /**
   * Reads the active Studio configuration row.
   *
   * @returns The stored configuration when present.
   */
  findStudioConfig(): Promise<StudioConfig | undefined>;

  /**
   * Writes or replaces the active Studio configuration row.
   *
   * @param config Studio connection configuration.
   */
  upsertStudioConfig(config: StudioConfig): Promise<void>;
}

interface StudioConfigRow extends RowDataPacket, StudioConfig {}

/**
 * MariaDB-backed Studio configuration adapter.
 */
export class DefaultStudioConfigAdapter implements StudioConfigAdapter {
  /**
   * Creates the adapter.
   *
   * @param pool MariaDB connection pool.
   */
  public constructor(private readonly pool: Pool) {}

  /**
   * Reads the active Studio configuration row.
   *
   * @returns The stored configuration when present.
   */
  public async findStudioConfig(): Promise<StudioConfig | undefined> {
    const [rows] = await this.pool.execute<StudioConfigRow[]>(
      [
        "SELECT kweaver_base_url, openclaw_address, openclaw_token",
        "FROM t_studio_config",
        "ORDER BY id ASC",
        "LIMIT 1"
      ].join(" ")
    );

    return rows[0];
  }

  /**
   * Writes or replaces the active Studio configuration row.
   *
   * @param config Studio connection configuration.
   */
  public async upsertStudioConfig(config: StudioConfig): Promise<void> {
    await this.pool.execute(
      [
        "INSERT INTO t_studio_config",
        "(id, kweaver_base_url, openclaw_address, openclaw_token)",
        "VALUES (1, :kweaverBaseUrl, :openClawAddress, :openClawToken)",
        "ON DUPLICATE KEY UPDATE",
        "kweaver_base_url = VALUES(kweaver_base_url),",
        "openclaw_address = VALUES(openclaw_address),",
        "openclaw_token = VALUES(openclaw_token)"
      ].join(" "),
      {
        kweaverBaseUrl: config.kweaver_base_url,
        openClawAddress: config.openclaw_address,
        openClawToken: config.openclaw_token
      }
    );
  }
}
