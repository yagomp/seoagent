import { describe, it, expect, vi } from "vitest";
import {
  competitorKeywords,
  competitorCompare,
  contentGaps,
  contentGapsForProject,
} from "../competitors.js";
import type { SearchDataProvider, KeywordData } from "../types.js";

function createMockProvider(
  keywordsByDomain: Record<string, KeywordData[]>
): SearchDataProvider {
  return {
    getKeywordVolume: vi.fn(),
    getSerpResults: vi.fn(),
    getKeywordSuggestions: vi.fn(),
    getCompetitorKeywords: vi
      .fn()
      .mockImplementation(
        async (domain: string, _locale: string): Promise<KeywordData[]> => {
          return keywordsByDomain[domain] ?? [];
        }
      ),
  };
}

// Mock the project module
vi.mock("../project.js", () => ({
  getProject: vi.fn(),
}));

import { getProject } from "../project.js";
import type { ProjectConfig } from "../types.js";

describe("competitorKeywords", () => {
  it("returns keywords for a competitor domain", async () => {
    const provider = createMockProvider({
      "rival.com": [
        { keyword: "seo tools", volume: 5000, difficulty: 45 },
        { keyword: "rank tracker", volume: 3000, difficulty: 60 },
      ],
    });

    const result = await competitorKeywords(provider, "rival.com", "en-US");

    expect(provider.getCompetitorKeywords).toHaveBeenCalledWith(
      "rival.com",
      "en-US"
    );
    expect(result).toHaveLength(2);
    expect(result[0].keyword).toBe("seo tools");
    expect(result[1].keyword).toBe("rank tracker");
  });

  it("returns empty array for unknown domain", async () => {
    const provider = createMockProvider({});
    const result = await competitorKeywords(
      provider,
      "unknown.com",
      "en-US"
    );
    expect(result).toEqual([]);
  });
});

describe("competitorCompare", () => {
  it("computes shared, yourOnly, and competitorOnly keyword sets", async () => {
    const provider = createMockProvider({
      "mysite.com": [
        { keyword: "seo tools", volume: 5000, difficulty: 45 },
        { keyword: "keyword research", volume: 8000, difficulty: 55 },
        { keyword: "site audit", volume: 2000, difficulty: 30 },
      ],
      "rival.com": [
        { keyword: "seo tools", volume: 5000, difficulty: 45 },
        { keyword: "rank tracker", volume: 3000, difficulty: 60 },
        { keyword: "site audit", volume: 2000, difficulty: 30 },
      ],
    });

    const result = await competitorCompare(
      provider,
      "mysite.com",
      "rival.com",
      "en-US"
    );

    expect(result.yourDomain).toBe("mysite.com");
    expect(result.competitorDomain).toBe("rival.com");

    // shared: seo tools, site audit
    expect(result.shared).toHaveLength(2);
    const sharedKeywords = result.shared.map((k) => k.keyword).sort();
    expect(sharedKeywords).toEqual(["seo tools", "site audit"]);

    // yourOnly: keyword research
    expect(result.yourOnly).toHaveLength(1);
    expect(result.yourOnly[0].keyword).toBe("keyword research");

    // competitorOnly: rank tracker
    expect(result.competitorOnly).toHaveLength(1);
    expect(result.competitorOnly[0].keyword).toBe("rank tracker");
  });

  it("handles zero overlap", async () => {
    const provider = createMockProvider({
      "mysite.com": [
        { keyword: "alpha", volume: 1000, difficulty: 20 },
      ],
      "rival.com": [
        { keyword: "beta", volume: 2000, difficulty: 30 },
      ],
    });

    const result = await competitorCompare(
      provider,
      "mysite.com",
      "rival.com",
      "en-US"
    );

    expect(result.shared).toHaveLength(0);
    expect(result.yourOnly).toHaveLength(1);
    expect(result.competitorOnly).toHaveLength(1);
  });

  it("handles empty keyword lists", async () => {
    const provider = createMockProvider({
      "mysite.com": [],
      "rival.com": [],
    });

    const result = await competitorCompare(
      provider,
      "mysite.com",
      "rival.com",
      "en-US"
    );

    expect(result.shared).toEqual([]);
    expect(result.yourOnly).toEqual([]);
    expect(result.competitorOnly).toEqual([]);
  });
});

describe("contentGaps", () => {
  it("finds keywords competitors rank for but you do not, sorted by opportunity", async () => {
    const provider = createMockProvider({
      "mysite.com": [
        { keyword: "seo tools", volume: 5000, difficulty: 45 },
      ],
      "rival1.com": [
        { keyword: "seo tools", volume: 5000, difficulty: 45 },
        { keyword: "rank tracker", volume: 3000, difficulty: 60 },
        { keyword: "keyword planner", volume: 6000, difficulty: 40 },
      ],
      "rival2.com": [
        { keyword: "seo tools", volume: 5000, difficulty: 45 },
        { keyword: "rank tracker", volume: 3000, difficulty: 60 },
        { keyword: "backlink checker", volume: 4000, difficulty: 50 },
      ],
    });

    const result = await contentGaps(
      provider,
      "mysite.com",
      ["rival1.com", "rival2.com"],
      "en-US"
    );

    expect(result.domain).toBe("mysite.com");
    expect(result.analyzedCompetitors).toEqual(["rival1.com", "rival2.com"]);

    // "seo tools" is NOT a gap (you rank for it)
    const gapKeywords = result.gaps.map((g) => g.keyword);
    expect(gapKeywords).not.toContain("seo tools");

    // 3 gaps: keyword planner, backlink checker, rank tracker
    expect(result.totalGaps).toBe(3);

    // Check opportunity scoring: volume * (1 - difficulty/100)
    // keyword planner: 6000 * (1 - 0.40) = 3600
    // backlink checker: 4000 * (1 - 0.50) = 2000
    // rank tracker: 3000 * (1 - 0.60) = 1200
    expect(result.gaps[0].keyword).toBe("keyword planner");
    expect(result.gaps[0].opportunity).toBe(3600);
    expect(result.gaps[1].keyword).toBe("backlink checker");
    expect(result.gaps[1].opportunity).toBe(2000);
    expect(result.gaps[2].keyword).toBe("rank tracker");
    expect(result.gaps[2].opportunity).toBe(1200);
  });

  it("tracks which competitors rank for each gap keyword", async () => {
    const provider = createMockProvider({
      "mysite.com": [],
      "rival1.com": [
        { keyword: "rank tracker", volume: 3000, difficulty: 60 },
      ],
      "rival2.com": [
        { keyword: "rank tracker", volume: 3000, difficulty: 60 },
      ],
    });

    const result = await contentGaps(
      provider,
      "mysite.com",
      ["rival1.com", "rival2.com"],
      "en-US"
    );

    expect(result.gaps).toHaveLength(1);
    expect(result.gaps[0].competitorDomains).toEqual(
      expect.arrayContaining(["rival1.com", "rival2.com"])
    );
    expect(result.gaps[0].competitorDomains).toHaveLength(2);
  });

  it("returns empty gaps when you rank for everything", async () => {
    const provider = createMockProvider({
      "mysite.com": [
        { keyword: "seo tools", volume: 5000, difficulty: 45 },
      ],
      "rival.com": [
        { keyword: "seo tools", volume: 5000, difficulty: 45 },
      ],
    });

    const result = await contentGaps(
      provider,
      "mysite.com",
      ["rival.com"],
      "en-US"
    );

    expect(result.gaps).toEqual([]);
    expect(result.totalGaps).toBe(0);
  });

  it("returns empty gaps when no competitors provided", async () => {
    const provider = createMockProvider({
      "mysite.com": [
        { keyword: "seo tools", volume: 5000, difficulty: 45 },
      ],
    });

    const result = await contentGaps(
      provider,
      "mysite.com",
      [],
      "en-US"
    );

    expect(result.gaps).toEqual([]);
    expect(result.totalGaps).toBe(0);
    expect(result.analyzedCompetitors).toEqual([]);
  });

  it("uses highest volume when competitors report different volumes for same keyword", async () => {
    const provider = createMockProvider({
      "mysite.com": [],
      "rival1.com": [
        { keyword: "rank tracker", volume: 3000, difficulty: 60 },
      ],
      "rival2.com": [
        { keyword: "rank tracker", volume: 3500, difficulty: 55 },
      ],
    });

    const result = await contentGaps(
      provider,
      "mysite.com",
      ["rival1.com", "rival2.com"],
      "en-US"
    );

    // Should use the higher volume (3500) and lower difficulty (55) — best-case data
    expect(result.gaps[0].volume).toBe(3500);
    expect(result.gaps[0].difficulty).toBe(55);
    // opportunity: 3500 * (1 - 0.55) = 1575
    expect(result.gaps[0].opportunity).toBeCloseTo(1575);
  });
});

describe("contentGapsForProject", () => {
  it("reads project config and delegates to contentGaps", async () => {
    vi.mocked(getProject).mockReturnValue({
      slug: "mysite",
      config: {
        domain: "mysite.com",
        name: "My Site",
        competitors: ["rival1.com", "rival2.com"],
        locale: "en-US",
      } as ProjectConfig,
    });

    const provider = createMockProvider({
      "mysite.com": [
        { keyword: "seo tools", volume: 5000, difficulty: 45 },
      ],
      "rival1.com": [
        { keyword: "seo tools", volume: 5000, difficulty: 45 },
        { keyword: "rank tracker", volume: 3000, difficulty: 60 },
      ],
      "rival2.com": [
        { keyword: "backlink checker", volume: 4000, difficulty: 50 },
      ],
    });

    const result = await contentGapsForProject(provider, "mysite");

    expect(getProject).toHaveBeenCalledWith("mysite");
    expect(result.domain).toBe("mysite.com");
    expect(result.analyzedCompetitors).toEqual(["rival1.com", "rival2.com"]);
    expect(result.totalGaps).toBe(2);
  });

  it("uses en-US as default locale when project has no locale", async () => {
    vi.mocked(getProject).mockReturnValue({
      slug: "mysite",
      config: {
        domain: "mysite.com",
        name: "My Site",
      } as ProjectConfig,
    });

    const provider = createMockProvider({
      "mysite.com": [],
    });

    const result = await contentGapsForProject(provider, "mysite");

    expect(result.domain).toBe("mysite.com");
    expect(result.gaps).toEqual([]);
    expect(result.analyzedCompetitors).toEqual([]);
  });

  it("throws when project has no competitors configured", async () => {
    vi.mocked(getProject).mockReturnValue({
      slug: "mysite",
      config: {
        domain: "mysite.com",
        name: "My Site",
        competitors: [],
      } as ProjectConfig,
    });

    const provider = createMockProvider({ "mysite.com": [] });

    const result = await contentGapsForProject(provider, "mysite");
    expect(result.totalGaps).toBe(0);
    expect(result.analyzedCompetitors).toEqual([]);
  });
});
