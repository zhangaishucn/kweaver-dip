import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { describe, expect, it, vi } from "vitest";

import type { StudioMcpLogic } from "../logic/mcp";
import { registerStudioMcpTools, type McpToolRegistrar } from "./tools";

/**
 * Creates a Studio MCP logic test double.
 *
 * @returns A mocked logic object.
 */
function createLogicDouble(): StudioMcpLogic {
  return {
    getKweaverToken: vi.fn()
  };
}

describe("registerStudioMcpTools", () => {
  it("registers get_kweaver_token and returns structured content", async () => {
    const logic = createLogicDouble();
    vi.mocked(logic.getKweaverToken).mockResolvedValue({
      agentId: "agent-1",
      kweaver_token: "token-1"
    });
    let handler: ((args: { agentId: string }) => Promise<CallToolResult>) | undefined;
    const registrar: McpToolRegistrar = {
      registerTool: vi.fn((_name, _config, registeredHandler) => {
        handler = registeredHandler;
      })
    };

    registerStudioMcpTools(registrar, logic);

    expect(registrar.registerTool).toHaveBeenCalledWith(
      "get_kweaver_token",
      expect.objectContaining({
        title: "Get KWeaver Token"
      }),
      expect.any(Function)
    );
    await expect(handler?.({ agentId: "agent-1" })).resolves.toEqual({
      content: [
        {
          type: "text",
          text: "{\"agentId\":\"agent-1\",\"kweaver_token\":\"token-1\"}"
        }
      ],
      structuredContent: {
        agentId: "agent-1",
        kweaver_token: "token-1"
      }
    });
  });

  it("returns MCP tool errors without throwing", async () => {
    const logic = createLogicDouble();
    vi.mocked(logic.getKweaverToken).mockRejectedValue(new Error("missing"));
    let handler: ((args: { agentId: string }) => Promise<CallToolResult>) | undefined;
    const registrar: McpToolRegistrar = {
      registerTool: vi.fn((_name, _config, registeredHandler) => {
        handler = registeredHandler;
      })
    };

    registerStudioMcpTools(registrar, logic);

    await expect(handler?.({ agentId: "agent-1" })).resolves.toEqual({
      isError: true,
      content: [
        {
          type: "text",
          text: "missing"
        }
      ]
    });
  });
});
