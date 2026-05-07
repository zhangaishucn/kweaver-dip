import { describe, expect, it, vi } from "vitest";

import type { DigitalEmployeeTokenAdapter } from "../adapters/digital-employee-token-adapter";
import {
  DefaultStudioMcpLogic,
  KweaverTokenNotFoundError
} from "./mcp";

/**
 * Creates a token adapter test double.
 *
 * @returns A mocked token adapter.
 */
function createTokenAdapterDouble(): DigitalEmployeeTokenAdapter {
  return {
    findKweaverToken: vi.fn(),
    upsertKweaverToken: vi.fn(),
    deleteKweaverToken: vi.fn(),
    markDigitalEmployeeDeleted: vi.fn()
  };
}

describe("DefaultStudioMcpLogic", () => {
  it("returns the token for an existing digital employee", async () => {
    const adapter = createTokenAdapterDouble();
    vi.mocked(adapter.findKweaverToken).mockResolvedValue("token-1");
    const logic = new DefaultStudioMcpLogic(adapter);

    await expect(logic.getKweaverToken({ agentId: " agent-1 " })).resolves.toEqual({
      agentId: "agent-1",
      kweaver_token: "token-1"
    });
    expect(adapter.findKweaverToken).toHaveBeenCalledWith("agent-1");
  });

  it("rejects an empty agent id", async () => {
    const logic = new DefaultStudioMcpLogic(createTokenAdapterDouble());

    await expect(logic.getKweaverToken({ agentId: " " })).rejects.toThrow(
      "agentId is required"
    );
  });

  it("rejects a missing token", async () => {
    const adapter = createTokenAdapterDouble();
    vi.mocked(adapter.findKweaverToken).mockResolvedValue(undefined);
    const logic = new DefaultStudioMcpLogic(adapter);

    await expect(logic.getKweaverToken({ agentId: "agent-1" })).rejects.toBeInstanceOf(
      KweaverTokenNotFoundError
    );
  });

  it("rejects a blank token", async () => {
    const adapter = createTokenAdapterDouble();
    vi.mocked(adapter.findKweaverToken).mockResolvedValue(" ");
    const logic = new DefaultStudioMcpLogic(adapter);

    await expect(logic.getKweaverToken({ agentId: "agent-1" })).rejects.toThrow(
      "KWeaver token not found for digital employee: agent-1"
    );
  });
});
