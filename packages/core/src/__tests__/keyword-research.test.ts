import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { openDatabase, closeDatabase } from "../database.js";
import { keywordResearch, keywordSuggestions } from "../keyword-research.js";
import type { SearchDataProvider, KeywordData } from "../types.js";
import type Database from "better-sqlite3";

function createMockProvider(
  overrides: Partial<SearchDataProvider> = {}
): SearchDataProvider {
  return {
    getKeywordVolume: vi.fn().mockResolvedValue([]),
    getSerpResults: vi.fn().mockResolvedValue([]),
    getKeywordSuggestions: vi.fn().mockResolvedValue([]),
    getCompetitorKeywords: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe("keywordResearch", () => {
  let tmpDir: string;
  let db: Database.Database;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "seoagent-kwresearch-test-")
    );
    db = openDatabase(path.join(tmpDir, "seoagent.db"));
  });

  afterEach(() => {
    closeDatabase(db);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns keyword data from provider", async () => {
    const mockData: KeywordData[] = [
      {
        keyword: "seo tools",
        volume: 12000,
        difficulty: 72,
        cpc: 3.5,
        competition: 0.65,
      },
      {
        keyword: "seo software",
        volume: 8000,
        difficulty: 68,
        cpc: 4.2,
        competition: 0.7,
      },
    ];

    const provider = createMockProvider({
      getKeywordVolume: vi.fn().mockResolvedValue(mockData),
    });

    const result = await keywordResearch(
      db,
      provider,
      ["seo tools", "seo software"],
      "en-US"
    );

    expect(result).toHaveLength(2);
    expect(result[0].keyword).toBe("seo tools");
    expect(result[0].volume).toBe(12000);
    expect(provider.getKeywordVolume).toHaveBeenCalledWith(
      ["seo tools", "seo software"],
      "en-US"
    );
  });

  it("stores keyword data in the database", async () => {
    const mockData: KeywordData[] = [
      {
        keyword: "seo tools",
        volume: 12000,
        difficulty: 72,
        cpc: 3.5,
        competition: 0.65,
      },
    ];

    const provider = createMockProvider({
      getKeywordVolume: vi.fn().mockResolvedValue(mockData),
    });

    await keywordResearch(db, provider, ["seo tools"], "en-US");

    const row = db
      .prepare("SELECT * FROM keywords WHERE keyword = ? AND locale = ?")
      .get("seo tools", "en-US") as Record<string, unknown>;

    expect(row).toBeDefined();
    expect(row.volume).toBe(12000);
    expect(row.difficulty).toBe(72);
    expect(row.cpc).toBe(3.5);
  });

  it("updates existing keyword data on re-research", async () => {
    const provider = createMockProvider({
      getKeywordVolume: vi
        .fn()
        .mockResolvedValueOnce([
          { keyword: "seo tools", volume: 12000, difficulty: 72, cpc: 3.5, competition: 0.65 },
        ])
        .mockResolvedValueOnce([
          { keyword: "seo tools", volume: 13000, difficulty: 74, cpc: 3.8, competition: 0.68 },
        ]),
    });

    await keywordResearch(db, provider, ["seo tools"], "en-US");
    await keywordResearch(db, provider, ["seo tools"], "en-US");

    const row = db
      .prepare("SELECT * FROM keywords WHERE keyword = ? AND locale = ?")
      .get("seo tools", "en-US") as Record<string, unknown>;

    expect(row.volume).toBe(13000);
    expect(row.difficulty).toBe(74);
  });
});

describe("keywordSuggestions", () => {
  let tmpDir: string;
  let db: Database.Database;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "seoagent-kwsuggest-test-")
    );
    db = openDatabase(path.join(tmpDir, "seoagent.db"));
  });

  afterEach(() => {
    closeDatabase(db);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns keyword suggestions from provider", async () => {
    const provider = createMockProvider({
      getKeywordSuggestions: vi
        .fn()
        .mockResolvedValue(["seo tools free", "best seo tools", "seo tools 2026"]),
    });

    const result = await keywordSuggestions(
      db,
      provider,
      "seo tools",
      "en-US"
    );

    expect(result).toHaveLength(3);
    expect(result).toContain("best seo tools");
    expect(provider.getKeywordSuggestions).toHaveBeenCalledWith(
      "seo tools",
      "en-US"
    );
  });

  it("respects the limit parameter", async () => {
    const provider = createMockProvider({
      getKeywordSuggestions: vi
        .fn()
        .mockResolvedValue([
          "seo tools free",
          "best seo tools",
          "seo tools 2026",
          "seo tools for beginners",
          "seo tools comparison",
        ]),
    });

    const result = await keywordSuggestions(
      db,
      provider,
      "seo tools",
      "en-US",
      2
    );

    expect(result).toHaveLength(2);
  });

  it("stores suggestions in the keywords table", async () => {
    const provider = createMockProvider({
      getKeywordSuggestions: vi
        .fn()
        .mockResolvedValue(["seo tools free", "best seo tools"]),
    });

    await keywordSuggestions(db, provider, "seo tools", "en-US");

    const rows = db
      .prepare("SELECT keyword FROM keywords WHERE locale = ?")
      .all("en-US") as { keyword: string }[];

    const keywords = rows.map((r) => r.keyword);
    expect(keywords).toContain("seo tools free");
    expect(keywords).toContain("best seo tools");
  });
});
