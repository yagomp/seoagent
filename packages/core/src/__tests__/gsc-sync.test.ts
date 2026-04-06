import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { openDatabase, closeDatabase } from "../database.js";
import { syncGscRows, getGscHistory } from "../gsc/sync.js";
import type Database from "better-sqlite3";

describe("gsc sync", () => {
  let tmpDir: string;
  let db: Database.Database;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "seoagent-gsc-sync-"));
    const dbPath = path.join(tmpDir, "seoagent.db");
    db = openDatabase(dbPath);
  });

  afterEach(() => {
    closeDatabase(db);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("inserts performance rows into gsc_data table", () => {
    const rows = [
      { date: "2026-03-01", query: "seo tips", page: "https://example.com/blog", clicks: 50, impressions: 500, ctr: 0.1, position: 4.2 },
      { date: "2026-03-02", query: "seo tips", page: "https://example.com/blog", clicks: 60, impressions: 600, ctr: 0.1, position: 3.8 },
    ];

    syncGscRows(db, rows);

    const result = db
      .prepare("SELECT COUNT(*) as count FROM gsc_data")
      .get() as { count: number };
    expect(result.count).toBe(2);
  });

  it("upserts on same date+query+page combination", () => {
    const row = {
      date: "2026-03-01",
      query: "seo tips",
      page: "https://example.com/blog",
      clicks: 50,
      impressions: 500,
      ctr: 0.1,
      position: 4.2,
    };

    syncGscRows(db, [row]);
    syncGscRows(db, [{ ...row, clicks: 80 }]);

    const result = db
      .prepare("SELECT COUNT(*) as count FROM gsc_data")
      .get() as { count: number };
    expect(result.count).toBe(1);

    const updated = db
      .prepare("SELECT clicks FROM gsc_data WHERE date = ? AND query = ? AND page = ?")
      .get("2026-03-01", "seo tips", "https://example.com/blog") as { clicks: number };
    expect(updated.clicks).toBe(80);
  });

  it("handles rows with null query (page-level data)", () => {
    const rows = [
      { date: "2026-03-01", query: null, page: "https://example.com/", clicks: 100, impressions: 1000, ctr: 0.1, position: 5.0 },
    ];

    syncGscRows(db, rows);

    const result = db
      .prepare("SELECT * FROM gsc_data WHERE page = ?")
      .get("https://example.com/") as { clicks: number; query: string | null };
    expect(result.clicks).toBe(100);
    expect(result.query).toBeNull();
  });

  it("handles rows with null page (query-level data)", () => {
    const rows = [
      { date: "2026-03-01", query: "seo tips", page: null, clicks: 100, impressions: 1000, ctr: 0.1, position: 5.0 },
    ];

    syncGscRows(db, rows);

    const result = db
      .prepare("SELECT * FROM gsc_data WHERE query = ?")
      .get("seo tips") as { clicks: number; page: string | null };
    expect(result.clicks).toBe(100);
    expect(result.page).toBeNull();
  });

  it("retrieves historical data with getGscHistory", () => {
    const rows = [
      { date: "2026-03-01", query: "seo tips", page: "https://example.com/blog", clicks: 50, impressions: 500, ctr: 0.1, position: 4.2 },
      { date: "2026-03-02", query: "seo tools", page: "https://example.com/tools", clicks: 30, impressions: 300, ctr: 0.1, position: 6.0 },
      { date: "2026-03-03", query: "seo tips", page: "https://example.com/blog", clicks: 70, impressions: 700, ctr: 0.1, position: 3.5 },
    ];

    syncGscRows(db, rows);

    const history = getGscHistory(db, { query: "seo tips" });
    expect(history).toHaveLength(2);
    expect(history[0].date).toBe("2026-03-01");
    expect(history[1].date).toBe("2026-03-03");
  });

  it("filters history by date range", () => {
    const rows = [
      { date: "2026-03-01", query: "seo", page: null, clicks: 10, impressions: 100, ctr: 0.1, position: 5.0 },
      { date: "2026-03-15", query: "seo", page: null, clicks: 20, impressions: 200, ctr: 0.1, position: 4.0 },
      { date: "2026-03-28", query: "seo", page: null, clicks: 30, impressions: 300, ctr: 0.1, position: 3.0 },
    ];

    syncGscRows(db, rows);

    const history = getGscHistory(db, {
      startDate: "2026-03-10",
      endDate: "2026-03-20",
    });
    expect(history).toHaveLength(1);
    expect(history[0].date).toBe("2026-03-15");
  });
});
