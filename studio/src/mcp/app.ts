import type { Request, Response } from "express";
import {
  createMcpExpressApp,
  type CreateMcpExpressAppOptions
} from "@modelcontextprotocol/sdk/server/express.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { DefaultDigitalEmployeeTokenAdapter } from "../adapters/digital-employee-token-adapter";
import { DefaultStudioConfigAdapter } from "../adapters/studio-config-adapter";
import { createStudioDatabasePool } from "../infra/mariadb-client";
import { DefaultStudioMcpLogic, type StudioMcpLogic } from "../logic/mcp";
import { getStudioDatabaseConfig } from "../utils/env";
import { registerStudioMcpTools } from "./tools";

/**
 * Factory used to create a fresh MCP server for each stateless HTTP request.
 */
export type StudioMcpServerFactory = () => McpServer;

/**
 * Creates the default Studio MCP logic graph.
 *
 * @returns The MCP business logic.
 */
export function createDefaultStudioMcpLogic(): StudioMcpLogic {
  const pool = createStudioDatabasePool(getStudioDatabaseConfig());
  const tokenAdapter = new DefaultDigitalEmployeeTokenAdapter(pool);
  const configAdapter = new DefaultStudioConfigAdapter(pool);

  return new DefaultStudioMcpLogic(tokenAdapter, configAdapter);
}

/**
 * Creates a Studio MCP server instance with all tools registered.
 *
 * @param logic Business logic invoked by tools.
 * @returns A configured MCP server.
 */
export function createStudioMcpServer(logic: StudioMcpLogic): McpServer {
  const server = new McpServer({
    name: "dip-studio-mcp-server",
    version: "0.1.0"
  });

  registerStudioMcpTools(server, logic);

  return server;
}

/**
 * Creates the Express app that hosts the MCP Streamable HTTP endpoint.
 *
 * @param createServer Factory used to build a fresh stateless MCP server.
 * @returns A configured Express app.
 */
export function createStudioMcpApp(
  createServer: StudioMcpServerFactory,
  options: CreateMcpExpressAppOptions = {}
) {
  const app = createMcpExpressApp(options);

  app.post("/mcp", async (request: Request, response: Response) => {
    const server = createServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(request, response, request.body);
      response.on("close", () => {
        void transport.close();
        void server.close();
      });
    } catch (error) {
      console.error("[studio-mcp] Failed to handle MCP request:", error);
      if (!response.headersSent) {
        response.status(500).json({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: "Internal server error"
          },
          id: null
        });
      }
    }
  });

  app.get("/mcp", (_request: Request, response: Response) => {
    response.status(405).json({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Method not allowed."
      },
      id: null
    });
  });

  app.delete("/mcp", (_request: Request, response: Response) => {
    response.status(405).json({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Method not allowed."
      },
      id: null
    });
  });

  return app;
}
