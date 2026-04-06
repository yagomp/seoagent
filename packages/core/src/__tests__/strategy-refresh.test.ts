import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { openDatabase, closeDatabase } from "../database.js";
import { strategyRefresh } from "../strategy/refresh.js";
import { storeStrategy } from "../strategy/generate.js";
import type { Strategy } from "../strategy/types.js";

// Mock config and LLM
vi.mock("../config.js", () => ({
  getConfigValue: vi.fn(),
}));

vi.mock("../strategy/llm-client.js", () => ({
  getLlmConfig: vi.fn().mockReturnValue(null),
  callLlm: vi.fn(),
}));

describe("strategyRefresh", () => {
  let tmpDir: string;
  let dbPath: string;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "seoagent-refresh-test-"));
    dbPath = path.join(tmpDir, "seoagent.db");
    vi.clearAllMocks();

    // Re-apply mock return value after clearAllMocks
    const { getLlmConfig } = await import("../strategy/llm-client.js");
    (getLlmConfig as ReturnType<typeof vi.fn>).mockReturnValue(null);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("generates a strategy and returns diff with no previous strategy", async () => {
    const db = openDatabase(dbPath);
    const project = { domain: "example.com", name: "Example" };
    const result = await strategyRefresh(db, project);

    expect(result.strategy).toBeDefined();
    expect(result.strategy.generatedAt).toBeTruthy();
    expect(result.diff.previousScore).toBe(0);
    expect(result.diff.currentScore).toBe(result.strategy.overallScore);
    expect(result.diff.improvements).toEqual([]);
    expect(result.diff.regressions).toEqual([]);

    closeDatabase(db);
  });

  it("diffs against previous strategy", async () => {
    const db = openDatabase(dbPath);

    // Store a previous strategy
    const previous: Strategy = {
      generatedAt: "2026-03-01T12:00:00Z",
      overallScore: 30,
      quickWins: [
        { action: "Fix meta descriptions", reason: "Missing", impact: "high", effort: "low" },
        { action: "Add H1 tags", reason: "Missing", impact: "medium", effort: "low" },
        { action: "Fix broken links", reason: "404s", impact: "high", effort: "low" },
      ],
      contentPlan: [],
      technicalFixes: [
        { action: "Fix 404s", reason: "Broken", impact: "high", effort: "low", url: "https://ex.com", issueType: "broken_pages" },
      ],
      linkBuilding: [],
      drPlan: { currentDR: 8, targetDR: 20, actions: [] },
      competitorInsights: [],
    };
    storeStrategy(db, previous);

    // Add some page data so the new strategy differs
    db.prepare(
      "INSERT INTO crawl_pages (url, status_code, title, meta_description, h1, word_count) VALUES (?, ?, ?, ?, ?, ?)"
    ).run("https://ex.com/", 200, "Home", "Welcome", "Home", 800);

    const project = { domain: "example.com", name: "Example" };
    const result = await strategyRefresh(db, project);

    expect(result.diff.previousScore).toBe(30);
    expect(result.diff.currentScore).toBe(result.strategy.overallScore);

    // The diff should have numeric fields
    expect(typeof result.diff.newQuickWins).toBe("number");
    expect(typeof result.diff.resolvedQuickWins).toBe("number");

    // Two strategies should now exist in DB
    const count = (
      db.prepare("SELECT COUNT(*) as count FROM strategies").get() as { count: number }
    ).count;
    expect(count).toBe(2);

    closeDatabase(db);
  });

  it("detects score improvement", async () => {
    const db = openDatabase(dbPath);

    // Store a low-score previous strategy
    const previous: Strategy = {
      generatedAt: "2026-03-01T12:00:00Z",
      overallScore: 20,
      quickWins: [
        { action: "Fix meta descriptions on 50 pages", reason: "x", impact: "high", effort: "low" },
        { action: "Add page titles to 20 pages", reason: "x", impact: "high", effort: "low" },
      ],
      contentPlan: [],
      technicalFixes: [],
      linkBuilding: [],
      drPlan: { currentDR: 5, targetDR: 20, actions: [] },
      competitorInsights: [],
    };
    storeStrategy(db, previous);

    // Add good data to the DB so the new strategy has a better score
    for (let i = 0; i < 20; i++) {
      db.prepare(
        "INSERT INTO crawl_pages (url, status_code, title, meta_description, h1, word_count) VALUES (?, ?, ?, ?, ?, ?)"
      ).run(`https://ex.com/page-${i}`, 200, `Page ${i}`, `Desc ${i}`, `H1 ${i}`, 1200);
    }
    db.prepare(
      "INSERT INTO dr_history (domain_rating, referring_domains) VALUES (?, ?)"
    ).run(25, 50);

    const project = { domain: "example.com", name: "Example" };
    const result = await strategyRefresh(db, project);

    expect(result.diff.currentScore).toBeGreaterThan(result.diff.previousScore);
    expect(result.diff.improvements.length).toBeGreaterThan(0);

    closeDatabase(db);
  });
});
