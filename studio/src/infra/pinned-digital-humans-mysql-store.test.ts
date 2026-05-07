import { describe, expect, it } from "vitest";

import { readPinnedIdsFromColumn, normalizeIdStrings } from "./pinned-digital-humans-mysql-store";

describe("readPinnedIdsFromColumn", () => {
  it("parses JSON text and arrays from mysql2", () => {
    expect(readPinnedIdsFromColumn('["a","b"]')).toEqual(["a", "b"]);
    expect(readPinnedIdsFromColumn(["a", "b"])).toEqual(["a", "b"]);
    expect(readPinnedIdsFromColumn(null)).toEqual([]);
  });

  it("parses UTF-8 buffer payloads", () => {
    expect(readPinnedIdsFromColumn(Buffer.from('["x"]', "utf8"))).toEqual(["x"]);
  });
});

describe("normalizeIdStrings", () => {
  it("trims non-empty strings", () => {
    expect(normalizeIdStrings([" x ", "", 1])).toEqual(["x", "1"]);
  });
});
