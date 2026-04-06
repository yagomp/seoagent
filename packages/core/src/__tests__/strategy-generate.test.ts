import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { openDatabase, closeDatabase } from "../database.js";
import { strategyGenerate } from "../strategy/generate.js";
import type { Strategy } from "../strategy/types.js";

// Mock config and LLM modules
vi.mock("../config.js", () => ({
  getConfigValue: vi.fn(),
}));

vi.mock("../strategy/llm-client.js", () => ({
  getLlmConfig: vi.fn(),
  callLlm: vi.fn(),
}));

describe("strategyGenerate", () => {
  let tmpDir: string;
  let dbPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "seoagent-gen-test-"));
    dbPath = path.join(tmpDir, "seoagent.db");
    vi.clearAllMocks();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("uses rule-based fallback when no LLM configured", async () => {
    const { getLlmConfig } = await import("../strategy/llm-client.js");
    (getLlmConfig as ReturnType<typeof vi.fn>).mockReturnValue(null);

    const db = openDatabase(dbPath);
    const project = { domain: "example.com", name: "Example" };
    const result = await strategyGenerate(db, project);

    expect(result.generatedAt).toBeTruthy();
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);

    // Verify it was stored in DB
    const rows = db
      .prepare("SELECT * FROM strategies ORDER BY id DESC LIMIT 1")
      .all() as { id: number; strategy: string; generated_at: string }[];
    expect(rows).toHaveLength(1);

    const stored = JSON.parse(rows[0].strategy) as Strategy;
    expect(stored.overallScore).toBe(result.overallScore);

    closeDatabase(db);
  });

  it("uses LLM when configured and stores result", async () => {
    const { getLlmConfig, callLlm } = await import("../strategy/llm-client.js");
    (getLlmConfig as ReturnType<typeof vi.fn>).mockReturnValue({
      provider: "anthropic",
      apiKey: "sk-ant-xxx",
      model: "claude-sonnet-4-6",
    });

    const llmStrategy: Strategy = {
      generatedAt: "2026-04-04T12:00:00Z",
      overallScore: 65,
      quickWins: [
        {
          action: "Fix meta descriptions",
          reason: "Many pages missing them",
          impact: "high",
          effort: "low",
        },
      ],
      contentPlan: [],
      technicalFixes: [],
      linkBuilding: [],
      drPlan: { currentDR: 12, targetDR: 30, actions: ["Build links"] },
      competitorInsights: ["Competitor has 3x your backlinks"],
    };

    (callLlm as ReturnType<typeof vi.fn>).mockResolvedValue(
      JSON.stringify(llmStrategy)
    );

    const db = openDatabase(dbPath);
    const project = { domain: "fplai.app", name: "FPLai", niche: "sports" };
    const result = await strategyGenerate(db, project);

    expect(result.overallScore).toBe(65);
    expect(result.quickWins).toHaveLength(1);
    expect(callLlm).toHaveBeenCalledOnce();

    // Verify stored
    const rows = db
      .prepare("SELECT strategy FROM strategies ORDER BY id DESC LIMIT 1")
      .all() as { strategy: string }[];
    const stored = JSON.parse(rows[0].strategy) as Strategy;
    expect(stored.overallScore).toBe(65);

    closeDatabase(db);
  });

  it("falls back to rules when LLM call fails", async () => {
    const { getLlmConfig, callLlm } = await import("../strategy/llm-client.js");
    (getLlmConfig as ReturnType<typeof vi.fn>).mockReturnValue({
      provider: "anthropic",
      apiKey: "sk-ant-xxx",
    });
    (callLlm as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("API rate limit")
    );

    const db = openDatabase(dbPath);
    const project = { domain: "example.com", name: "Example" };
    const result = await strategyGenerate(db, project);

    // Should still get a valid strategy (from fallback)
    expect(result.generatedAt).toBeTruthy();
    expect(result.overallScore).toBeGreaterThanOrEqual(0);

    closeDatabase(db);
  });
});
