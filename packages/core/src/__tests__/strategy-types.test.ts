import { describe, it, expect } from "vitest";
import type {
  Strategy,
  ActionItem,
  ContentItem,
  AuditFix,
  LinkTactic,
  StrategyDiff,
  AggregatedData,
  LlmConfig,
} from "../strategy/types.js";

describe("strategy types", () => {
  it("ActionItem satisfies the interface", () => {
    const item: ActionItem = {
      action: "Add meta descriptions to 15 pages",
      reason: "Missing meta descriptions reduce CTR in SERPs",
      impact: "high",
      effort: "low",
      filePath: "/src/pages/about.tsx",
    };
    expect(item.impact).toBe("high");
    expect(item.effort).toBe("low");
    expect(item.filePath).toBe("/src/pages/about.tsx");
  });

  it("ContentItem satisfies the interface", () => {
    const item: ContentItem = {
      action: "Create comparison page: FPLai vs Fantasy Football Hub",
      reason: "High-volume keyword with no existing page",
      impact: "high",
      effort: "medium",
      targetKeyword: "fpl ai vs fantasy football hub",
      estimatedVolume: 1200,
      currentPage: null,
    };
    expect(item.targetKeyword).toBe("fpl ai vs fantasy football hub");
  });

  it("AuditFix satisfies the interface", () => {
    const fix: AuditFix = {
      action: "Fix broken internal link on /blog/old-post",
      reason: "Returns 404, wasting crawl budget",
      impact: "medium",
      effort: "low",
      url: "https://fplai.app/blog/old-post",
      issueType: "broken_link",
    };
    expect(fix.issueType).toBe("broken_link");
  });

  it("LinkTactic satisfies the interface", () => {
    const tactic: LinkTactic = {
      action: "Guest post on fantasy football blogs",
      reason: "Niche-relevant sites with DR 40+ linking to competitors",
      impact: "high",
      effort: "high",
      targetDomains: ["fantasyfootballscout.co.uk"],
      anchorStrategy: "brand + topic mix",
    };
    expect(tactic.targetDomains).toHaveLength(1);
  });

  it("Strategy satisfies the interface", () => {
    const strategy: Strategy = {
      generatedAt: "2026-04-04T12:00:00Z",
      overallScore: 42,
      quickWins: [],
      contentPlan: [],
      technicalFixes: [],
      linkBuilding: [],
      drPlan: { currentDR: 12, targetDR: 30, actions: ["Build niche backlinks"] },
      competitorInsights: ["Competitor X ranks for 500 keywords you miss"],
    };
    expect(strategy.overallScore).toBe(42);
    expect(strategy.drPlan.targetDR).toBe(30);
  });

  it("StrategyDiff satisfies the interface", () => {
    const diff: StrategyDiff = {
      previousScore: 42,
      currentScore: 55,
      improvements: ["Fixed 15 missing meta descriptions", "DR improved from 12 to 15"],
      regressions: ["Lost position for keyword 'fpl tips'"],
      newQuickWins: 3,
      resolvedQuickWins: 5,
    };
    expect(diff.currentScore - diff.previousScore).toBe(13);
  });

  it("AggregatedData satisfies the interface", () => {
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
    expect(data.project.domain).toBe("fplai.app");
  });

  it("LlmConfig satisfies the interface", () => {
    const config: LlmConfig = {
      provider: "anthropic",
      apiKey: "sk-ant-xxx",
      model: "claude-sonnet-4-6",
    };
    expect(config.provider).toBe("anthropic");
  });
});
