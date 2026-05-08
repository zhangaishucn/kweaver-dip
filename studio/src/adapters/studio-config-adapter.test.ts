import type { Pool } from "mysql2/promise";
import { describe, expect, it, vi } from "vitest";

import { DefaultStudioConfigAdapter } from "./studio-config-adapter";

/**
 * Creates a minimal MySQL pool test double.
 *
 * @returns A mocked pool.
 */
function createPoolDouble(): Pool {
  return {
    execute: vi.fn()
  } as unknown as Pool;
}

describe("DefaultStudioConfigAdapter", () => {
  it("reads the first Studio config row", async () => {
    const pool = createPoolDouble();
    vi.mocked(pool.execute).mockResolvedValue([
      [
        {
          kweaver_base_url: "https://kweaver.example.com",
          openclaw_address: "ws://127.0.0.1:19001",
          openclaw_token: "token-1"
        }
      ],
      []
    ] as never);
    const adapter = new DefaultStudioConfigAdapter(pool);

    await expect(adapter.findStudioConfig()).resolves.toEqual({
      kweaver_base_url: "https://kweaver.example.com",
      openclaw_address: "ws://127.0.0.1:19001",
      openclaw_token: "token-1"
    });
    expect(pool.execute).toHaveBeenCalledWith(
      [
        "SELECT kweaver_base_url, openclaw_address, openclaw_token",
        "FROM t_studio_config",
        "ORDER BY id ASC",
        "LIMIT 1"
      ].join(" ")
    );
  });

  it("returns undefined when no Studio config row exists", async () => {
    const pool = createPoolDouble();
    vi.mocked(pool.execute).mockResolvedValue([[], []] as never);
    const adapter = new DefaultStudioConfigAdapter(pool);

    await expect(adapter.findStudioConfig()).resolves.toBeUndefined();
  });

  it("upserts the active Studio config row", async () => {
    const pool = createPoolDouble();
    vi.mocked(pool.execute).mockResolvedValue([[], []] as never);
    const adapter = new DefaultStudioConfigAdapter(pool);

    await adapter.upsertStudioConfig({
      kweaver_base_url: "https://kweaver.example.com",
      openclaw_address: "ws://127.0.0.1:19001",
      openclaw_token: "token-1"
    });

    expect(pool.execute).toHaveBeenCalledWith(
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
        kweaverBaseUrl: "https://kweaver.example.com",
        openClawAddress: "ws://127.0.0.1:19001",
        openClawToken: "token-1"
      }
    );
  });
});
