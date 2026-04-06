import { describe, it, expect } from "vitest";
import { strategySchema, parseStrategyResponse } from "../strategy/validate.js";
import { buildStrategyPrompt } from "../strategy/prompt.js";
import type { AggregatedData } from "../strategy/types.js";

describe("strategySchema", () => {
  const validStrategy = {
    generatedAt: "2026-04-04T12:00:00Z",
    overallScore: 42,
    quickWins: [
      {
        action: "Fix missing meta descriptions",
        reason: "15 pages have no meta description",
        impact: "high",
        effort: "low",
      },
    ],
    contentPlan: [
      {
        action: "Create FPL tips page",
        reason: "High volume keyword",
        impact: "high",
        effort: "medium",
        targetKeyword: "fpl tips",
        estimatedVolume: 5000,
        currentPage: null,
      },
    ],
    technicalFixes: [
      {
        action: "Fix broken link on /blog/old",
        reason: "Returns 404",
        impact: "medium",
        effort: "low",
        url: "https://fplai.app/blog/old",
        issueType: "broken_link",
      },
    ],
    linkBuilding: [
      {
        action: "Guest post on football blogs",
        reason: "Niche relevance",
        impact: "high",
        effort: "high",
      },
    ],
    drPlan: {
      currentDR: 12,
      targetDR: 30,
      actions: ["Build niche backlinks", "HARO outreach"],
    },
    competitorInsights: ["Competitor X ranks for 500 keywords you miss"],
  };

  it("validates a correct strategy object", () => {
    const result = strategySchema.safeParse(validStrategy);
    expect(result.success).toBe(true);
  });

  it("rejects missing overallScore", () => {
    const { overallScore, ...invalid } = validStrategy;
    const result = strategySchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects overallScore out of range", () => {
    const result = strategySchema.safeParse({ ...validStrategy, overallScore: 150 });
    expect(result.success).toBe(false);
  });

  it("rejects invalid impact value", () => {
    const invalid = {
      ...validStrategy,
      quickWins: [{ action: "x", reason: "y", impact: "critical", effort: "low" }],
    };
    const result = strategySchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("allows empty arrays", () => {
    const minimal = {
      ...validStrategy,
      quickWins: [],
      contentPlan: [],
      technicalFixes: [],
      linkBuilding: [],
      competitorInsights: [],
    };
    const result = strategySchema.safeParse(minimal);
    expect(result.success).toBe(true);
  });
});

describe("parseStrategyResponse", () => {
  it("parses valid JSON string into Strategy", () => {
    const json = JSON.stringify({
      generatedAt: "2026-04-04T12:00:00Z",
      overallScore: 50,
      quickWins: [],
      contentPlan: [],
      technicalFixes: [],
      linkBuilding: [],
      drPlan: { currentDR: 10, targetDR: 25, actions: [] },
      competitorInsights: [],
    });

    const result = parseStrategyResponse(json);
    expect(result.overallScore).toBe(50);
  });

  it("extracts JSON from markdown code fence", () => {
    const wrapped = '```json\n{"generatedAt":"2026-04-04T12:00:00Z","overallScore":50,"quickWins":[],"contentPlan":[],"technicalFixes":[],"linkBuilding":[],"drPlan":{"currentDR":10,"targetDR":25,"actions":[]},"competitorInsights":[]}\n```';

    const result = parseStrategyResponse(wrapped);
    expect(result.overallScore).toBe(50);
  });

  it("throws on invalid JSON", () => {
    expect(() => parseStrategyResponse("not json")).toThrow();
  });

  it("throws on valid JSON that fails schema", () => {
    expect(() => parseStrategyResponse('{"foo":"bar"}')).toThrow();
  });
});

describe("buildStrategyPrompt", () => {
  it("returns system and user prompts", () => {
    const data: AggregatedData = {
      project: { domain: "fplai.app", name: "FPLai", niche: "sports/fantasy-football" },
      keywords: { total: 50, tracked: 20, avgPosition: 15.3, top10Count: 5 },
      pages: {
        total: 120,
        missingTitle: 3,
        missingDescription: 15,
        missingH1: 2,
        thinContent: 8,
        avgWordCount: 650,
        brokenLinks: 4,
      },
      backlinks: { total: 200, uniqueDomains: 45, dofollowRatio: 0.72 },
      domainRating: { current: 12, previous: 10, trend: "up" },
      gsc: { totalClicks: 5000, totalImpressions: 80000, avgCtr: 0.0625, avgPosition: 18.5 },
    };

    const { systemPrompt, userPrompt } = buildStrategyPrompt(data);

    expect(systemPrompt).toContain("SEO strategist");
    expect(userPrompt).toContain("fplai.app");
    expect(userPrompt).toContain("sports/fantasy-football");
    expect(userPrompt).toContain("120");
    expect(userPrompt).toContain("JSON");
  });
});
