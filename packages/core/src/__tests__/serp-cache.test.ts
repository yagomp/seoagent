import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { openDatabase, closeDatabase } from "../database.js";
import {
  getCachedSerp,
  setCachedSerp,
  isCacheFresh,
} from "../serp-cache.js";
import type { SerpResult } from "../types.js";
import type Database from "better-sqlite3";

describe("serp-cache", () => {
  let tmpDir: string;
  let db: Database.Database;

  const sampleResults: SerpResult[] = [
    {
      position: 1,
      url: "https://example.com",
      title: "Example",
      description: "An example page",
      domain: "example.com",
    },
    {
      position: 2,
      url: "https://other.com",
      title: "Other",
      description: "Another page",
      domain: "other.com",
    },
  ];

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "seoagent-cache-test-"));
    db = openDatabase(path.join(tmpDir, "seoagent.db"));
  });

  afterEach(() => {
    closeDatabase(db);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns null when no cache entry exists", () => {
    const result = getCachedSerp(db, "nonexistent", "en-US");
    expect(result).toBeNull();
  });

  it("stores and retrieves cached SERP results", () => {
    setCachedSerp(db, "seo tools", "en-US", sampleResults);
    const cached = getCachedSerp(db, "seo tools", "en-US");

    expect(cached).not.toBeNull();
    expect(cached!.results).toHaveLength(2);
    expect(cached!.results[0].url).toBe("https://example.com");
  });

  it("distinguishes cache by locale", () => {
    setCachedSerp(db, "seo tools", "en-US", sampleResults);
    const cached = getCachedSerp(db, "seo tools", "en-GB");
    expect(cached).toBeNull();
  });

  it("overwrites stale cache on re-insert", () => {
    setCachedSerp(db, "seo tools", "en-US", sampleResults);
    const updated: SerpResult[] = [
      {
        position: 1,
        url: "https://new.com",
        title: "New",
        description: "New page",
        domain: "new.com",
      },
    ];
    setCachedSerp(db, "seo tools", "en-US", updated);

    const cached = getCachedSerp(db, "seo tools", "en-US");
    expect(cached!.results).toHaveLength(1);
    expect(cached!.results[0].url).toBe("https://new.com");
  });

  it("isCacheFresh returns true for recent entries", () => {
    const now = new Date().toISOString();
    expect(isCacheFresh(now, 24)).toBe(true);
  });

  it("isCacheFresh returns false for old entries", () => {
    const old = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    expect(isCacheFresh(old, 24)).toBe(false);
  });
});
