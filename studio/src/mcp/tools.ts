import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";

import type { StudioMcpLogic } from "../logic/mcp";

/**
 * Minimal MCP server contract used by Studio tool registration.
 */
export type McpToolRegistrar = Pick<McpServer, "registerTool">;

/**
 * Registers all Studio MCP tools.
 *
 * @param server MCP server instance.
 * @param logic Business logic invoked by tool handlers.
 */
export function registerStudioMcpTools(
  server: McpToolRegistrar,
  logic: StudioMcpLogic
): void {
  server.registerTool(
    "get_kweaver_token",
    {
      title: "Get KWeaver Token",
      description: "获取指定数字员工的 KWeaver Token。",
      inputSchema: {
        agentId: z.string().min(1).describe("数字员工 ID，等同于 agentId")
      },
      outputSchema: {
        agentId: z.string(),
        kweaver_token: z.string()
      }
    },
    async ({ agentId }) => {
      try {
        const output = await logic.getKweaverToken({ agentId });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(output)
            }
          ],
          structuredContent: output
        };
      } catch (error: unknown) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: error instanceof Error ? error.message : String(error)
            }
          ]
        };
      }
    }
  );
}
