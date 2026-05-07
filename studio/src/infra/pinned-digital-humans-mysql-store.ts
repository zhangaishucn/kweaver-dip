import { Buffer } from "node:buffer";

import { createPool, type Pool, type RowDataPacket } from "mysql2/promise";

import type { PinnedDigitalHumansStore } from "../logic/pinned-digital-humans";
import type { PinnedDigitalHumanIdsStored } from "../types/pinned-digital-humans";

/**
 * Column storing the ordered pinned digital human id list (JSON array).
 */
export const PINNED_DIGITAL_HUMAN_IDS_COLUMN = "pinned_digital_human_ids";

export const STUDIO_USER_PREFERENCE_TABLE = "t_studio_user_preference";

/**
 * MySQL connection options for {@link DefaultPinnedDigitalHumansMysqlStore}.
 */
export interface PinnedDigitalHumansMysqlStoreOptions {
  /**
   * Database host name.
   */
  host: string;

  /**
   * Database port number.
   */
  port: number;

  /**
   * Database user name.
   */
  user: string;

  /**
   * Database user password.
   */
  password: string;

  /**
   * Database schema name.
   */
  database: string;
}

/**
 * Database row shape for `t_studio_user_preference`.
 */
interface StudioPreferenceRow extends RowDataPacket {
  [PINNED_DIGITAL_HUMAN_IDS_COLUMN]: unknown;
}

/**
 * MySQL-backed {@link PinnedDigitalHumansStore}.
 */
export class DefaultPinnedDigitalHumansMysqlStore implements PinnedDigitalHumansStore {
  /**
   * Shared connection pool.
   */
  private readonly pool: Pool;

  /**
   * Creates the store with one MySQL connection pool.
   *
   * @param options Static database connection options.
   */
  public constructor(options: PinnedDigitalHumansMysqlStoreOptions) {
    this.pool = createPool({
      host: options.host,
      port: options.port,
      user: options.user,
      password: options.password,
      database: options.database,
      waitForConnections: true,
      connectionLimit: 10,
      maxIdle: 10,
      idleTimeout: 60_000,
      queueLimit: 0
    });
  }

  /**
   * Reads one user's pinned list from {@link PINNED_DIGITAL_HUMAN_IDS_COLUMN}.
   *
   * @param userId Authenticated user identifier.
   * @returns The stored sidebar state.
   */
  public async getByUserId(userId: string): Promise<PinnedDigitalHumanIdsStored> {
    const [rows] = await this.pool.query<StudioPreferenceRow[]>(
      [
        `SELECT ${PINNED_DIGITAL_HUMAN_IDS_COLUMN}`,
        `FROM ${STUDIO_USER_PREFERENCE_TABLE} WHERE user_id = ?`
      ].join(" "),
      [userId]
    );
    const row = rows[0];
    if (row === undefined) {
      return { pinned_digital_human_ids: [] };
    }

    return {
      pinned_digital_human_ids: readPinnedIdsFromColumn(row[PINNED_DIGITAL_HUMAN_IDS_COLUMN])
    };
  }

  /**
   * Persists the pinned list in {@link PINNED_DIGITAL_HUMAN_IDS_COLUMN}.
   *
   * @param userId Authenticated user identifier.
   * @param state Normalized sidebar state.
   */
  public async upsert(userId: string, state: PinnedDigitalHumanIdsStored): Promise<void> {
    const payload = JSON.stringify(state.pinned_digital_human_ids);
    await this.pool.query(
      [
        `INSERT INTO ${STUDIO_USER_PREFERENCE_TABLE} (user_id, ${PINNED_DIGITAL_HUMAN_IDS_COLUMN})`,
        "VALUES (?, ?)",
        `ON DUPLICATE KEY UPDATE ${PINNED_DIGITAL_HUMAN_IDS_COLUMN} = VALUES(${PINNED_DIGITAL_HUMAN_IDS_COLUMN})`
      ].join(" "),
      [userId, payload]
    );
  }
}

/**
 * Reads pinned ids from the column value (JSON type or text).
 *
 * @param raw Raw column value from mysql2.
 * @returns Normalized id list.
 */
export function readPinnedIdsFromColumn(raw: unknown): string[] {
  if (raw === undefined || raw === null) {
    return [];
  }

  if (Buffer.isBuffer(raw)) {
    return readPinnedIdsFromColumn(raw.toString("utf8"));
  }

  if (Array.isArray(raw)) {
    return normalizeIdStrings(raw);
  }

  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return normalizeIdStrings(parsed);
      }
    } catch {
      return [];
    }

    return [];
  }

  if (typeof raw === "object" && raw !== null && "length" in (raw as object)) {
    try {
      const asArray = Array.from(raw as ArrayLike<unknown>);
      return normalizeIdStrings(asArray);
    } catch {
      return [];
    }
  }

  return [];
}

/**
 * Normalizes string identifiers from a heterogeneous array.
 *
 * @param items Raw list items.
 * @returns Non-empty trimmed strings.
 */
export function normalizeIdStrings(items: readonly unknown[]): string[] {
  const normalized: string[] = [];

  for (const item of items) {
    const digitalHumanId = String(item).trim();

    if (digitalHumanId.length > 0) {
      normalized.push(digitalHumanId);
    }
  }

  return normalized;
}
