import type { Express } from "express";

import { loadStudioRuntimeConfigFromDatabase } from "./logic/studio-runtime-config";
import { getMcpEnv } from "./utils/env";

/**
 * Starts the Studio MCP Server.
 *
 * @param app Express application to serve.
 * @param port TCP port to bind.
 * @param host Host address to bind.
 * @returns The created Node.js HTTP server.
 */
export function startMcpServer(app: Express, port: number, host: string) {
  return app.listen(port, host, () => {
    console.log(`DIP Studio MCP Server listening on ${host}:${port}`);
  });
}

/**
 * Bootstraps the Studio MCP server.
 *
 * @returns The created Node.js HTTP server.
 */
export async function bootstrapMcpServer() {
  await loadStudioRuntimeConfigFromDatabase();
  const env = getMcpEnv();
  const {
    createDefaultStudioMcpLogic,
    createStudioMcpApp,
    createStudioMcpServer
  } = await import("./mcp/app.js");
  const logic = createDefaultStudioMcpLogic();
  const app = createStudioMcpApp(() => createStudioMcpServer(logic), {
    host: env.host
  });

  return startMcpServer(app, env.port, env.host);
}

void bootstrapMcpServer();
