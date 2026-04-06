import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { openDatabase, closeDatabase } from "../database.js";
import {
  rankTrackAdd,
  rankTrackCheck,
  rankTrackHistory,
  rankTrackReport,
} from "../rank-tracker.js";
import type { SearchDataProvider, SerpResult } from "../types.js";
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

describe("rankTrackAdd", () => {
  let tmpDir: string;
  let db: Database.Database;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "seoagent-ranktrack-test-")
    );
    db = openDatabase(path.join(tmpDir, "seoagent.db"));
  });

  afterEach(() => {
    closeDatabase(db);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("inserts keywords with tracked=1", () => {
    rankTrackAdd(db, ["seo tools", "best seo software"], "en-US");

    const rows = db
      .prepare(
        "SELECT keyword, tracked FROM keywords WHERE tracked = 1 AND locale = ?"
      )
      .all("en-US") as { keyword: string; tracked: number }[];

    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.keyword).sort()).toEqual([
      "best seo software",
      "seo tools",
    ]);
  });

  it("marks existing untracked keyword as tracked", () => {
    // Insert untracked keyword first
    db.prepare(
      "INSERT INTO keywords (keyword, locale, tracked) VALUES (?, ?, 0)"
    ).run("seo tools", "en-US");

    rankTrackAdd(db, ["seo tools"], "en-US");

    const row = db
      .prepare("SELECT tracked FROM keywords WHERE keyword = ? AND locale = ?")
      .get("seo tools", "en-US") as { tracked: number };

    expect(row.tracked).toBe(1);
  });

  it("does not duplicate when adding already-tracked keyword", () => {
    rankTrackAdd(db, ["seo tools"], "en-US");
    rankTrackAdd(db, ["seo tools"], "en-US");

    const rows = db
      .prepare("SELECT * FROM keywords WHERE keyword = ? AND locale = ?")
      .all("seo tools", "en-US");

    expect(rows).toHaveLength(1);
  });
});

describe("rankTrackCheck", () => {
  let tmpDir: string;
  let db: Database.Database;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "seoagent-rankcheck-test-")
    );
    db = openDatabase(path.join(tmpDir, "seoagent.db"));
  });

  afterEach(() => {
    closeDatabase(db);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("fetches SERP and records position for tracked keywords", async () => {
    rankTrackAdd(db, ["seo tools"], "en-US");

    const serpResults: SerpResult[] = [
      {
        position: 1,
        url: "https://competitor.com",
        title: "Competitor",
        description: "Competitor page",
        domain: "competitor.com",
      },
      {
        position: 3,
        url: "https://mysite.com/seo",
        title: "My SEO Page",
        description: "My page",
        domain: "mysite.com",
      },
    ];

    const provider = createMockProvider({
      getSerpResults: vi.fn().mockResolvedValue(serpResults),
    });

    const results = await rankTrackCheck(
      db,
      provider,
      "mysite.com",
      "en-US"
    );

    expect(results).toHaveLength(1);
    expect(results[0].keyword).toBe("seo tools");
    expect(results[0].position).toBe(3);
    expect(results[0].url).toBe("https://mysite.com/seo");
  });

  it("records null position when domain not in SERP", async () => {
    rankTrackAdd(db, ["seo tools"], "en-US");

    const serpResults: SerpResult[] = [
      {
        position: 1,
        url: "https://other.com",
        title: "Other",
        description: "Other page",
        domain: "other.com",
      },
    ];

    const provider = createMockProvider({
      getSerpResults: vi.fn().mockResolvedValue(serpResults),
    });

    const results = await rankTrackCheck(
      db,
      provider,
      "mysite.com",
      "en-US"
    );

    expect(results).toHaveLength(1);
    expect(results[0].keyword).toBe("seo tools");
    expect(results[0].position).toBeNull();
  });

  it("stores results in rank_history table", async () => {
    rankTrackAdd(db, ["seo tools"], "en-US");

    const provider = createMockProvider({
      getSerpResults: vi.fn().mockResolvedValue([
        {
          position: 5,
          url: "https://mysite.com/page",
          title: "My Page",
          description: "Desc",
          domain: "mysite.com",
        },
      ]),
    });

    await rankTrackCheck(db, provider, "mysite.com", "en-US");

    const history = db
      .prepare(
        `SELECT rh.position, rh.url FROM rank_history rh
         JOIN keywords k ON rh.keyword_id = k.id
         WHERE k.keyword = ?`
      )
      .all("seo tools") as { position: number; url: string }[];

    expect(history).toHaveLength(1);
    expect(history[0].position).toBe(5);
    expect(history[0].url).toBe("https://mysite.com/page");
  });

  it("updates current_position in keywords table", async () => {
    rankTrackAdd(db, ["seo tools"], "en-US");

    const provider = createMockProvider({
      getSerpResults: vi.fn().mockResolvedValue([
        {
          position: 7,
          url: "https://mysite.com/page",
          title: "My Page",
          description: "Desc",
          domain: "mysite.com",
        },
      ]),
    });

    await rankTrackCheck(db, provider, "mysite.com", "en-US");

    const row = db
      .prepare("SELECT current_position FROM keywords WHERE keyword = ?")
      .get("seo tools") as { current_position: number };

    expect(row.current_position).toBe(7);
  });

  it("caches SERP results", async () => {
    rankTrackAdd(db, ["seo tools"], "en-US");

    const provider = createMockProvider({
      getSerpResults: vi.fn().mockResolvedValue([
        {
          position: 3,
          url: "https://mysite.com",
          title: "My Site",
          description: "Desc",
          domain: "mysite.com",
        },
      ]),
    });

    await rankTrackCheck(db, provider, "mysite.com", "en-US");

    const cached = db
      .prepare(
        "SELECT results FROM serp_cache WHERE keyword = ? AND locale = ?"
      )
      .get("seo tools", "en-US") as { results: string } | undefined;

    expect(cached).toBeDefined();
    const parsed = JSON.parse(cached!.results);
    expect(parsed).toHaveLength(1);
  });
});

describe("rankTrackHistory", () => {
  let tmpDir: string;
  let db: Database.Database;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "seoagent-rankhistory-test-")
    );
    db = openDatabase(path.join(tmpDir, "seoagent.db"));
  });

  afterEach(() => {
    closeDatabase(db);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns position history for a keyword", async () => {
    rankTrackAdd(db, ["seo tools"], "en-US");

    const provider = createMockProvider({
      getSerpResults: vi
        .fn()
        .mockResolvedValueOnce([
          {
            position: 10,
            url: "https://mysite.com",
            title: "T",
            description: "D",
            domain: "mysite.com",
          },
        ])
        .mockResolvedValueOnce([
          {
            position: 7,
            url: "https://mysite.com",
            title: "T",
            description: "D",
            domain: "mysite.com",
          },
        ]),
    });

    await rankTrackCheck(db, provider, "mysite.com", "en-US");
    // Clear cache so second check hits provider again
    db.prepare("DELETE FROM serp_cache").run();
    await rankTrackCheck(db, provider, "mysite.com", "en-US");

    const history = rankTrackHistory(db, "seo tools", "en-US");

    expect(history).toHaveLength(2);
    expect(history[0].position).toBe(10);
    expect(history[1].position).toBe(7);
    expect(history[0].checkedAt).toBeDefined();
  });

  it("returns empty array for untracked keyword", () => {
    const history = rankTrackHistory(db, "nonexistent", "en-US");
    expect(history).toEqual([]);
  });
});

describe("rankTrackReport", () => {
  let tmpDir: string;
  let db: Database.Database;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "seoagent-rankreport-test-")
    );
    db = openDatabase(path.join(tmpDir, "seoagent.db"));
  });

  afterEach(() => {
    closeDatabase(db);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("reports movers (up, down, new, lost)", async () => {
    rankTrackAdd(
      db,
      ["going-up", "going-down", "staying", "new-entry", "lost-entry"],
      "en-US"
    );

    // First check: all keywords get initial positions
    const provider = createMockProvider({
      getSerpResults: vi.fn().mockImplementation(async (keyword: string) => {
        const positions: Record<string, number | null> = {
          "going-up": 10,
          "going-down": 3,
          staying: 5,
          "new-entry": null,
          "lost-entry": 8,
        };
        const pos = positions[keyword];
        if (pos === null || pos === undefined) return [];
        return [
          {
            position: pos,
            url: "https://mysite.com",
            title: "T",
            description: "D",
            domain: "mysite.com",
          },
        ];
      }),
    });

    await rankTrackCheck(db, provider, "mysite.com", "en-US");

    // Clear cache for second check
    db.prepare("DELETE FROM serp_cache").run();

    // Second check: positions changed
    const provider2 = createMockProvider({
      getSerpResults: vi.fn().mockImplementation(async (keyword: string) => {
        const positions: Record<string, number | null> = {
          "going-up": 5,
          "going-down": 8,
          staying: 5,
          "new-entry": 12,
          "lost-entry": null,
        };
        const pos = positions[keyword];
        if (pos === null || pos === undefined) return [];
        return [
          {
            position: pos,
            url: "https://mysite.com",
            title: "T",
            description: "D",
            domain: "mysite.com",
          },
        ];
      }),
    });

    await rankTrackCheck(db, provider2, "mysite.com", "en-US");

    const report = rankTrackReport(db, "en-US");

    expect(report.up.length).toBeGreaterThanOrEqual(1);
    const goingUp = report.up.find((m) => m.keyword === "going-up");
    expect(goingUp).toBeDefined();
    expect(goingUp!.previousPosition).toBe(10);
    expect(goingUp!.currentPosition).toBe(5);
    expect(goingUp!.change).toBe(5); // improved by 5

    const goingDown = report.down.find((m) => m.keyword === "going-down");
    expect(goingDown).toBeDefined();
    expect(goingDown!.change).toBe(-5); // dropped by 5

    const newEntry = report.new.find((m) => m.keyword === "new-entry");
    expect(newEntry).toBeDefined();
    expect(newEntry!.currentPosition).toBe(12);

    const lostEntry = report.lost.find((m) => m.keyword === "lost-entry");
    expect(lostEntry).toBeDefined();
    expect(lostEntry!.previousPosition).toBe(8);
  });

  it("returns empty report when no history exists", () => {
    const report = rankTrackReport(db, "en-US");
    expect(report.up).toEqual([]);
    expect(report.down).toEqual([]);
    expect(report.new).toEqual([]);
    expect(report.lost).toEqual([]);
  });
});
