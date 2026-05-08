import { DefaultStudioConfigAdapter } from "../adapters/studio-config-adapter";
import { createStudioDatabasePool } from "../infra/mariadb-client";
import {
  getStudioDatabaseConfig,
  setStudioRuntimeConfig
} from "../utils/env";

/**
 * Loads Studio connection configuration from RDS into the process cache.
 *
 * @returns `true` when a database row was loaded.
 */
export async function loadStudioRuntimeConfigFromDatabase(): Promise<boolean> {
  const pool = createStudioDatabasePool(getStudioDatabaseConfig());
  const adapter = new DefaultStudioConfigAdapter(pool);
  const config = await adapter.findStudioConfig();

  if (config === undefined) {
    return false;
  }

  setStudioRuntimeConfig({
    kweaverBaseUrl: config.kweaver_base_url,
    openClawGatewayUrl: config.openclaw_address,
    openClawGatewayToken: config.openclaw_token
  });

  return true;
}
