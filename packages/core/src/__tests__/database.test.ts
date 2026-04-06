import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { openDatabase, closeDatabase } from "../database.js";

describe("database", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "seoagent-db-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates database file and runs migrations", () => {
    const dbPath = path.join(tmpDir, "seoagent.db");
    const db = openDatabase(dbPath);

    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
      )
      .all() as { name: string }[];

    const tableNames = tables.map((t) => t.name);
    expect(tableNames).toContain("keywords");
    expect(tableNames).toContain("rank_history");
    expect(tableNames).toContain("crawl_pages");
    expect(tableNames).toContain("crawl_links");
    expect(tableNames).toContain("backlinks");
    expect(tableNames).toContain("dr_history");
    expect(tableNames).toContain("serp_cache");
    expect(tableNames).toContain("strategies");
    expect(tableNames).toContain("gsc_data");

    closeDatabase(db);
  });

  it("is idempotent — opening twice does not error", () => {
    const dbPath = path.join(tmpDir, "seoagent.db");
    const db1 = openDatabase(dbPath);
    closeDatabase(db1);

    const db2 = openDatabase(dbPath);
    const tables = db2
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
      .all() as { name: string }[];
    expect(tables.length).toBeGreaterThanOrEqual(9);
    closeDatabase(db2);
  });

  it("enables WAL mode for performance", () => {
    const dbPath = path.join(tmpDir, "seoagent.db");
    const db = openDatabase(dbPath);
    const result = db.prepare("PRAGMA journal_mode").get() as { journal_mode: string };
    expect(result.journal_mode).toBe("wal");
    closeDatabase(db);
  });
});
