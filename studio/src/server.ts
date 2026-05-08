import { connectOpenClawGatewayIfInitialized } from "./logic/openclaw-gateway-bootstrap";
import { loadStudioRuntimeConfigFromDatabase } from "./logic/studio-runtime-config";
import { getEnv } from "./utils/env";
import type { Express } from "express";

/**
 * Starts the HTTP server.
 *
 * @param app Express application to serve.
 * @param port The TCP port to bind.
 * @returns The created Node.js HTTP server.
 */
export function startServer(app: Express, port: number) {
  return app.listen(port, () => {
    console.log(`DIP Studio backend listening on port ${port}`);
  });
}

/**
 * Bootstraps the gateway connection when Studio is already initialized, then
 * starts the HTTP server.
 *
 * @returns The created Node.js HTTP server.
 */
export async function bootstrapServer() {
  await loadStudioRuntimeConfigFromDatabase();
  const [{ createApp }, env] = await Promise.all([
    import("./app.js"),
    Promise.resolve(getEnv())
  ]);
  const app = createApp();

  await connectOpenClawGatewayIfInitialized();

  return startServer(app, env.port);
}

void bootstrapServer();
