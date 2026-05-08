import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v3";

import type { StudioMcpLogic } from "../logic/mcp";

/**
 * Minimal MCP server contract used by Studio tool registration.
 */
export type McpToolRegistrar = Pick<McpServer, "registerTool">;

type StudioToolHandler = (args: any) => Promise<CallToolResult>;
type StudioToolRegistrar = (
  name: string,
  config: {
    title: string;
    description: string;
    inputSchema: Record<string, unknown>;
    outputSchema: Record<string, unknown>;
  },
  handler: StudioToolHandler
) => void;

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
  const registerTool = server.registerTool.bind(server) as unknown as StudioToolRegistrar;

  registerTool(
    "get_kweaver_base_url",
    {
      title: "Get KWeaver Base URL",
      description: "获取 DIP Studio 配置的 KWeaver 服务连接地址。",
      inputSchema: {},
      outputSchema: {
        kweaver_base_url: z.string()
      }
    },
    async () => {
      try {
        const output = await logic.getKweaverBaseUrl();

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

  registerTool(
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
    async ({ agentId }: { agentId: string }) => {
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

  registerTool(
    "get_bkn_scope",
    {
      title: "Get BKN Scope",
      description: "获取指定数字员工的业务知识网络范围。",
      inputSchema: {
        agentId: z.string().min(1).describe("数字员工 ID，等同于 agentId")
      },
      outputSchema: {
        agentId: z.string(),
        bkn_scope: z.string()
      }
    },
    async ({ agentId }: { agentId: string }) => {
      try {
        const output = await logic.getBknScope({ agentId });

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
