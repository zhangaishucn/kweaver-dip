import { createStudioMcpApp, createStudioMcpServer } from "./mcp/app";
import { createDefaultStudioMcpLogic } from "./mcp/app";
import { getMcpEnv } from "./utils/env";

const env = getMcpEnv();
const logic = createDefaultStudioMcpLogic();
const app = createStudioMcpApp(() => createStudioMcpServer(logic), {
  host: env.host
});

/**
 * Starts the Studio MCP Server.
 *
 * @param port TCP port to bind.
 * @param host Host address to bind.
 * @returns The created Node.js HTTP server.
 */
export function startMcpServer(port: number, host: string) {
  return app.listen(port, host, () => {
    console.log(`DIP Studio MCP Server listening on ${host}:${port}`);
  });
}

startMcpServer(env.port, env.host);
