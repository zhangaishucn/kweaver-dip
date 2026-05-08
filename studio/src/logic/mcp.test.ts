import { describe, expect, it, vi } from "vitest";

import type { DigitalEmployeeTokenAdapter } from "../adapters/digital-employee-token-adapter";
import type { StudioConfigAdapter } from "../adapters/studio-config-adapter";
import {
  DefaultStudioMcpLogic,
  KweaverTokenNotFoundError,
  StudioConfigNotFoundError
} from "./mcp";

/**
 * Creates a token adapter test double.
 *
 * @returns A mocked token adapter.
 */
function createTokenAdapterDouble(): DigitalEmployeeTokenAdapter {
  return {
    findKweaverToken: vi.fn(),
    findBknScope: vi.fn(),
    upsertDigitalEmployee: vi.fn(),
    upsertKweaverToken: vi.fn(),
    upsertBknScope: vi.fn(),
    deleteKweaverToken: vi.fn(),
    markDigitalEmployeeDeleted: vi.fn()
  };
}

/**
 * Creates a Studio config adapter test double.
 *
 * @returns A mocked Studio config adapter.
 */
function createConfigAdapterDouble(): StudioConfigAdapter {
  return {
    findStudioConfig: vi.fn(),
    upsertStudioConfig: vi.fn()
  };
}

/**
 * Creates default MCP logic with test doubles.
 *
 * @param tokenAdapter Optional token adapter override.
 * @param configAdapter Optional Studio config adapter override.
 * @returns The logic under test.
 */
function createLogic(
  tokenAdapter: DigitalEmployeeTokenAdapter = createTokenAdapterDouble(),
  configAdapter: StudioConfigAdapter = createConfigAdapterDouble()
): DefaultStudioMcpLogic {
  return new DefaultStudioMcpLogic(tokenAdapter, configAdapter);
}

describe("DefaultStudioMcpLogic", () => {
  it("returns the token for an existing digital employee", async () => {
    const adapter = createTokenAdapterDouble();
    vi.mocked(adapter.findKweaverToken).mockResolvedValue("token-1");
    const logic = createLogic(adapter);

    await expect(logic.getKweaverToken({ agentId: " agent-1 " })).resolves.toEqual({
      agentId: "agent-1",
      kweaver_token: "token-1"
    });
    expect(adapter.findKweaverToken).toHaveBeenCalledWith("agent-1");
  });

  it("rejects an empty agent id", async () => {
    const logic = createLogic();

    await expect(logic.getKweaverToken({ agentId: " " })).rejects.toThrow(
      "agentId is required"
    );
  });

  it("rejects a missing token", async () => {
    const adapter = createTokenAdapterDouble();
    vi.mocked(adapter.findKweaverToken).mockResolvedValue(undefined);
    const logic = createLogic(adapter);

    await expect(logic.getKweaverToken({ agentId: "agent-1" })).rejects.toBeInstanceOf(
      KweaverTokenNotFoundError
    );
  });

  it("rejects a blank token", async () => {
    const adapter = createTokenAdapterDouble();
    vi.mocked(adapter.findKweaverToken).mockResolvedValue(" ");
    const logic = createLogic(adapter);

    await expect(logic.getKweaverToken({ agentId: "agent-1" })).rejects.toThrow(
      "KWeaver token not found for digital employee: agent-1"
    );
  });

  it("returns the BKN scope for an existing digital employee", async () => {
    const adapter = createTokenAdapterDouble();
    vi.mocked(adapter.findBknScope).mockResolvedValue("kn-1,kn-2");
    const logic = createLogic(adapter);

    await expect(logic.getBknScope({ agentId: " agent-1 " })).resolves.toEqual({
      agentId: "agent-1",
      bkn_scope: "kn-1,kn-2"
    });
    expect(adapter.findBknScope).toHaveBeenCalledWith("agent-1");
  });

  it("returns an empty BKN scope when not configured", async () => {
    const adapter = createTokenAdapterDouble();
    vi.mocked(adapter.findBknScope).mockResolvedValue(undefined);
    const logic = createLogic(adapter);

    await expect(logic.getBknScope({ agentId: "agent-1" })).resolves.toEqual({
      agentId: "agent-1",
      bkn_scope: ""
    });
  });

  it("returns the configured KWeaver base URL", async () => {
    const configAdapter = createConfigAdapterDouble();
    vi.mocked(configAdapter.findStudioConfig).mockResolvedValue({
      kweaver_base_url: " https://kweaver.example.com ",
      openclaw_address: "ws://127.0.0.1:19001",
      openclaw_token: "token-1"
    });
    const logic = createLogic(createTokenAdapterDouble(), configAdapter);

    await expect(logic.getKweaverBaseUrl()).resolves.toEqual({
      kweaver_base_url: "https://kweaver.example.com"
    });
  });

  it("rejects a missing KWeaver base URL", async () => {
    const configAdapter = createConfigAdapterDouble();
    vi.mocked(configAdapter.findStudioConfig).mockResolvedValue(undefined);
    const logic = createLogic(createTokenAdapterDouble(), configAdapter);

    await expect(logic.getKweaverBaseUrl()).rejects.toBeInstanceOf(
      StudioConfigNotFoundError
    );
  });
});
