import mysql, { type Pool } from "mysql2/promise";

/**
 * MariaDB connection settings for Studio persistence.
 */
export interface StudioDatabaseConfig {
  /**
   * MariaDB host name or IP address.
   */
  host: string;

  /**
   * MariaDB TCP port.
   */
  port: number;

  /**
   * MariaDB username.
   */
  user: string;

  /**
   * Optional MariaDB password.
   */
  password?: string;

  /**
   * Database name.
   */
  database: string;

  /**
   * Maximum connection count in the pool.
   */
  connectionLimit: number;
}

/**
 * Creates a MariaDB connection pool for Studio persistence.
 *
 * @param config MariaDB connection settings.
 * @returns A configured MySQL2 pool.
 */
export function createStudioDatabasePool(config: StudioDatabaseConfig): Pool {
  return mysql.createPool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    connectionLimit: config.connectionLimit,
    namedPlaceholders: true
  });
}
