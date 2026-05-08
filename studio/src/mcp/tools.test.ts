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
    getKweaverToken: vi.fn(),
    getBknScope: vi.fn(),
    getKweaverBaseUrl: vi.fn()
  };
}

describe("registerStudioMcpTools", () => {
  it("registers get_kweaver_base_url and returns structured content", async () => {
    const logic = createLogicDouble();
    vi.mocked(logic.getKweaverBaseUrl).mockResolvedValue({
      kweaver_base_url: "https://kweaver.example.com"
    });
    let handler: (() => Promise<CallToolResult>) | undefined;
    const registrar: McpToolRegistrar = {
      registerTool: vi.fn((name, _config, registeredHandler) => {
        if (name === "get_kweaver_base_url") {
          handler = registeredHandler as () => Promise<CallToolResult>;
        }
      })
    };

    registerStudioMcpTools(registrar, logic);

    expect(registrar.registerTool).toHaveBeenCalledWith(
      "get_kweaver_base_url",
      expect.objectContaining({
        title: "Get KWeaver Base URL"
      }),
      expect.any(Function)
    );
    await expect(handler?.()).resolves.toEqual({
      content: [
        {
          type: "text",
          text: "{\"kweaver_base_url\":\"https://kweaver.example.com\"}"
        }
      ],
      structuredContent: {
        kweaver_base_url: "https://kweaver.example.com"
      }
    });
  });

  it("registers get_kweaver_token and returns structured content", async () => {
    const logic = createLogicDouble();
    vi.mocked(logic.getKweaverToken).mockResolvedValue({
      agentId: "agent-1",
      kweaver_token: "token-1"
    });
    let handler: ((args: { agentId: string }) => Promise<CallToolResult>) | undefined;
    const registrar: McpToolRegistrar = {
      registerTool: vi.fn((name, _config, registeredHandler) => {
        if (name === "get_kweaver_token") {
          handler = registeredHandler;
        }
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
      registerTool: vi.fn((name, _config, registeredHandler) => {
        if (name === "get_kweaver_token") {
          handler = registeredHandler;
        }
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

  it("registers get_bkn_scope and returns structured content", async () => {
    const logic = createLogicDouble();
    vi.mocked(logic.getBknScope).mockResolvedValue({
      agentId: "agent-1",
      bkn_scope: "kn-1,kn-2"
    });
    let handler: ((args: { agentId: string }) => Promise<CallToolResult>) | undefined;
    const registrar: McpToolRegistrar = {
      registerTool: vi.fn((name, _config, registeredHandler) => {
        if (name === "get_bkn_scope") {
          handler = registeredHandler;
        }
      })
    };

    registerStudioMcpTools(registrar, logic);

    expect(registrar.registerTool).toHaveBeenCalledWith(
      "get_bkn_scope",
      expect.objectContaining({
        title: "Get BKN Scope"
      }),
      expect.any(Function)
    );
    await expect(handler?.({ agentId: "agent-1" })).resolves.toEqual({
      content: [
        {
          type: "text",
          text: "{\"agentId\":\"agent-1\",\"bkn_scope\":\"kn-1,kn-2\"}"
        }
      ],
      structuredContent: {
        agentId: "agent-1",
        bkn_scope: "kn-1,kn-2"
      }
    });
  });
});
