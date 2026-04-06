import { describe, it, expect } from "vitest";
import { generateRuleBasedStrategy } from "../strategy/rules.js";
import type { AggregatedData, Strategy } from "../strategy/types.js";

function makeData(overrides: Partial<AggregatedData> = {}): AggregatedData {
  return {
    project: { domain: "example.com", name: "Example", niche: "tech" },
    keywords: { total: 0, tracked: 0, avgPosition: null, top10Count: 0 },
    pages: {
      total: 0,
      missingTitle: 0,
      missingDescription: 0,
      missingH1: 0,
      thinContent: 0,
      avgWordCount: 0,
      brokenLinks: 0,
    },
    backlinks: { total: 0, uniqueDomains: 0, dofollowRatio: 0 },
    domainRating: { current: null, previous: null, trend: "unknown" },
    gsc: { totalClicks: 0, totalImpressions: 0, avgCtr: 0, avgPosition: 0 },
    ...overrides,
  };
}

describe("generateRuleBasedStrategy", () => {
  it("returns a valid Strategy object for empty data", () => {
    const data = makeData();
    const result = generateRuleBasedStrategy(data);

    expect(result.generatedAt).toBeTruthy();
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);
    expect(Array.isArray(result.quickWins)).toBe(true);
    expect(Array.isArray(result.contentPlan)).toBe(true);
    expect(Array.isArray(result.technicalFixes)).toBe(true);
    expect(Array.isArray(result.linkBuilding)).toBe(true);
    expect(result.drPlan).toBeDefined();
    expect(Array.isArray(result.competitorInsights)).toBe(true);
  });

  it("adds quick win for missing meta descriptions > 10%", () => {
    const data = makeData({
      pages: {
        total: 100,
        missingTitle: 0,
        missingDescription: 15,
        missingH1: 0,
        thinContent: 0,
        avgWordCount: 800,
        brokenLinks: 0,
      },
    });
    const result = generateRuleBasedStrategy(data);

    const metaFix = result.quickWins.find((w) =>
      w.action.toLowerCase().includes("meta description")
    );
    expect(metaFix).toBeDefined();
    expect(metaFix!.impact).toBe("high");
    expect(metaFix!.effort).toBe("low");
  });

  it("adds quick win for missing titles", () => {
    const data = makeData({
      pages: {
        total: 50,
        missingTitle: 8,
        missingDescription: 0,
        missingH1: 0,
        thinContent: 0,
        avgWordCount: 800,
        brokenLinks: 0,
      },
    });
    const result = generateRuleBasedStrategy(data);

    const titleFix = result.quickWins.find((w) =>
      w.action.toLowerCase().includes("title")
    );
    expect(titleFix).toBeDefined();
  });

  it("adds technical fix for broken links", () => {
    const data = makeData({
      pages: {
        total: 100,
        missingTitle: 0,
        missingDescription: 0,
        missingH1: 0,
        thinContent: 0,
        avgWordCount: 800,
        brokenLinks: 12,
      },
    });
    const result = generateRuleBasedStrategy(data);

    const brokenFix = result.technicalFixes.find((f) =>
      f.issueType === "broken_pages"
    );
    expect(brokenFix).toBeDefined();
    expect(brokenFix!.impact).toBe("high");
  });

  it("suggests link building when DR < 20", () => {
    const data = makeData({
      domainRating: { current: 12, previous: 10, trend: "up" },
    });
    const result = generateRuleBasedStrategy(data);

    expect(result.linkBuilding.length).toBeGreaterThan(0);
    expect(result.drPlan.currentDR).toBe(12);
    expect(result.drPlan.targetDR).toBeGreaterThan(12);
  });

  it("adds content plan for thin content", () => {
    const data = makeData({
      pages: {
        total: 80,
        missingTitle: 0,
        missingDescription: 0,
        missingH1: 0,
        thinContent: 20,
        avgWordCount: 350,
        brokenLinks: 0,
      },
    });
    const result = generateRuleBasedStrategy(data);

    const thinFix = result.contentPlan.find((c) =>
      c.action.toLowerCase().includes("thin")
    );
    expect(thinFix).toBeDefined();
  });

  it("adds quick win for low CTR when impressions exist", () => {
    const data = makeData({
      gsc: { totalClicks: 100, totalImpressions: 10000, avgCtr: 0.01, avgPosition: 12 },
    });
    const result = generateRuleBasedStrategy(data);

    const ctrFix = result.quickWins.find((w) =>
      w.action.toLowerCase().includes("ctr")
    );
    expect(ctrFix).toBeDefined();
  });

  it("calculates overall score based on data health", () => {
    // Good data = higher score
    const goodData = makeData({
      pages: {
        total: 100,
        missingTitle: 0,
        missingDescription: 2,
        missingH1: 1,
        thinContent: 3,
        avgWordCount: 1200,
        brokenLinks: 0,
      },
      keywords: { total: 200, tracked: 50, avgPosition: 8.5, top10Count: 30 },
      backlinks: { total: 500, uniqueDomains: 120, dofollowRatio: 0.8 },
      domainRating: { current: 45, previous: 42, trend: "up" },
      gsc: { totalClicks: 10000, totalImpressions: 200000, avgCtr: 0.05, avgPosition: 12 },
    });

    // Bad data = lower score
    const badData = makeData({
      pages: {
        total: 50,
        missingTitle: 20,
        missingDescription: 30,
        missingH1: 15,
        thinContent: 25,
        avgWordCount: 200,
        brokenLinks: 10,
      },
      domainRating: { current: 5, previous: 5, trend: "stable" },
    });

    const goodScore = generateRuleBasedStrategy(goodData).overallScore;
    const badScore = generateRuleBasedStrategy(badData).overallScore;

    expect(goodScore).toBeGreaterThan(badScore);
  });

  it("suggests crawling when no pages exist", () => {
    const data = makeData();
    const result = generateRuleBasedStrategy(data);

    const crawlSuggestion = result.quickWins.find((w) =>
      w.action.toLowerCase().includes("crawl") || w.action.toLowerCase().includes("audit")
    );
    expect(crawlSuggestion).toBeDefined();
  });
});
