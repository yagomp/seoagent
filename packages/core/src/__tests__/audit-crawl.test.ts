import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { openDatabase, closeDatabase } from "../database.js";
import { auditCrawl } from "../audit/audit-crawl.js";
import type Database from "better-sqlite3";

// Mock the fetcher module to avoid real HTTP requests
vi.mock("../audit/fetcher.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../audit/fetcher.js")>();
  return {
    ...original,
    fetchPage: vi.fn(async (url: string) => {
      if (url.includes("robots.txt")) {
        return {
          statusCode: 200,
          body: "User-agent: *\nDisallow: /admin/\n",
          loadTimeMs: 10,
          redirectChain: [],
        };
      }
      if (url === "https://example.com/" || url === "https://example.com") {
        return {
          statusCode: 200,
          body: `<html><head><title>Home</title><meta name="description" content="Homepage"></head>
          <body><h1>Welcome</h1>
          <p>${"word ".repeat(250)}</p>
          <a href="/about">About</a>
          <a href="/missing">Missing</a>
          </body></html>`,
          loadTimeMs: 100,
          redirectChain: [],
        };
      }
      if (url === "https://example.com/about") {
        return {
          statusCode: 200,
          body: `<html><head><title>About</title><meta name="description" content="About us"></head>
          <body><h1>About</h1>
          <p>${"word ".repeat(300)}</p>
          <a href="/">Home</a>
          </body></html>`,
          loadTimeMs: 80,
          redirectChain: [],
        };
      }
      if (url === "https://example.com/missing") {
        return {
          statusCode: 404,
          body: "<html><head><title>Not Found</title></head><body>404</body></html>",
          loadTimeMs: 20,
          redirectChain: [],
        };
      }
      return {
        statusCode: 200,
        body: "<html><head></head><body>Default</body></html>",
        loadTimeMs: 10,
        redirectChain: [],
      };
    }),
  };
});

describe("auditCrawl", () => {
  let tmpDir: string;
  let db: Database.Database;
  let dbPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "seoagent-crawl-test-"));
    dbPath = path.join(tmpDir, "seoagent.db");
    db = openDatabase(dbPath);
  });

  afterEach(() => {
    closeDatabase(db);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("crawls domain and returns stats", async () => {
    const stats = await auditCrawl("example.com", db, { maxPages: 10 });

    expect(stats.pagesCrawled).toBeGreaterThanOrEqual(2);
    expect(stats.timeMs).toBeGreaterThan(0);
  });

  it("stores crawled pages in crawl_pages table", async () => {
    await auditCrawl("example.com", db, { maxPages: 10 });

    const rows = db.prepare("SELECT * FROM crawl_pages").all() as {
      url: string;
      status_code: number;
      title: string;
    }[];

    expect(rows.length).toBeGreaterThanOrEqual(2);
    const homeRow = rows.find((r) => r.url === "https://example.com/");
    expect(homeRow).toBeDefined();
    expect(homeRow!.title).toBe("Home");
    expect(homeRow!.status_code).toBe(200);
  });

  it("stores links in crawl_links table", async () => {
    await auditCrawl("example.com", db, { maxPages: 10 });

    const rows = db.prepare("SELECT * FROM crawl_links").all() as {
      source_url: string;
      target_url: string;
      is_internal: number;
    }[];

    expect(rows.length).toBeGreaterThan(0);
    const homeToAbout = rows.find(
      (r) =>
        r.source_url === "https://example.com/" &&
        r.target_url === "https://example.com/about"
    );
    expect(homeToAbout).toBeDefined();
    expect(homeToAbout!.is_internal).toBe(1);
  });

  it("stores issues as JSON in crawl_pages", async () => {
    await auditCrawl("example.com", db, { maxPages: 10 });

    const row = db
      .prepare("SELECT issues FROM crawl_pages WHERE url = ?")
      .get("https://example.com/missing") as { issues: string } | undefined;

    if (row) {
      const issues = JSON.parse(row.issues);
      expect(issues).toContainEqual(
        expect.objectContaining({ type: "broken_link" })
      );
    }
  });

  it("counts broken links in stats", async () => {
    const stats = await auditCrawl("example.com", db, { maxPages: 10 });
    expect(stats.brokenLinks).toBeGreaterThanOrEqual(1);
  });

  it("clears previous crawl data before new crawl", async () => {
    await auditCrawl("example.com", db, { maxPages: 10 });
    const count1 = (
      db.prepare("SELECT COUNT(*) as c FROM crawl_pages").get() as { c: number }
    ).c;

    // Crawl again
    await auditCrawl("example.com", db, { maxPages: 10 });
    const count2 = (
      db.prepare("SELECT COUNT(*) as c FROM crawl_pages").get() as { c: number }
    ).c;

    // Should not accumulate -- second crawl replaces first
    expect(count2).toBe(count1);
  });
});
