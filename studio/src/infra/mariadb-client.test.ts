import mysql from "mysql2/promise";
import { describe, expect, it, vi } from "vitest";

import { createStudioDatabasePool } from "./mariadb-client";

vi.mock("mysql2/promise", () => ({
  default: {
    createPool: vi.fn()
  }
}));

describe("createStudioDatabasePool", () => {
  it("creates a named-placeholder MariaDB pool", () => {
    const pool = { execute: vi.fn() };
    vi.mocked(mysql.createPool).mockReturnValue(pool as never);

    expect(createStudioDatabasePool({
      host: "db.example.com",
      port: 3307,
      user: "studio",
      password: "secret",
      database: "kweaver",
      connectionLimit: 3
    })).toBe(pool);
    expect(mysql.createPool).toHaveBeenCalledWith({
      host: "db.example.com",
      port: 3307,
      user: "studio",
      password: "secret",
      database: "kweaver",
      connectionLimit: 3,
      namedPlaceholders: true
    });
  });
});
