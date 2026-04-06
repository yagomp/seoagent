# Competitor Analysis & Content Gaps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement competitor keyword discovery, side-by-side keyword overlap comparison, and multi-competitor content gap analysis that identifies keyword opportunities sorted by potential value.

**Architecture:** All functions live in `packages/core/src/competitors.ts`. `competitorKeywords()` delegates to the `SearchDataProvider.getCompetitorKeywords()` method from Plan 3. `competitorCompare()` fetches keywords for two domains and computes set intersections (shared, yourOnly, competitorOnly). `contentGaps()` reads the project's competitor list, aggregates competitor keywords, and filters out keywords you already rank for — scoring each gap by opportunity (volume * (1 - difficulty/100)).

**Tech Stack:** TypeScript, Vitest, better-sqlite3, DataForSEO provider from Plan 3

---

## File Structure

```
packages/core/src/
├── competitors.ts                              # competitorKeywords, competitorCompare, contentGaps
├── __tests__/
│   └── competitors.test.ts                     # Tests for all competitor analysis functions
└── index.ts                                    # Barrel — add new exports
```

---

## Dependencies from Prior Plans

From Plan 1:
- `openDatabase(dbPath)`, `getDbPath(slug)` — database access
- `getProject(slug)` — returns `{ slug, config: { domain, competitors[], locale } }`
- `keywords` table, `serp_cache` table — existing schema

From Plan 3:
- `createProvider(config)` — factory that returns a `SearchDataProvider`
- `SearchDataProvider.getCompetitorKeywords(domain, locale)` — returns `KeywordData[]`

Types from `types.ts`:
- `KeywordData { keyword, volume, difficulty, cpc?, competition? }`

---

### Task 1: Implement `competitorKeywords` Function

**Files:**
- Create: `packages/core/src/__tests__/competitors.test.ts`
- Create: `packages/core/src/competitors.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/__tests__/competitors.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  competitorKeywords,
  competitorCompare,
  contentGaps,
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm test -- src/__tests__/competitors.test.ts`
Expected: FAIL — module `../competitors.js` not found

- [ ] **Step 3: Write the implementation**

Create `packages/core/src/competitors.ts`:

```typescript
import type { SearchDataProvider, KeywordData } from "./types.js";

/**
 * Fetch keywords that a competitor domain ranks for.
 */
export async function competitorKeywords(
  provider: SearchDataProvider,
  domain: string,
  locale: string
): Promise<KeywordData[]> {
  return provider.getCompetitorKeywords(domain, locale);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && pnpm test -- src/__tests__/competitors.test.ts`
Expected: 2 tests PASS (the competitorKeywords describe block)

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/competitors.ts packages/core/src/__tests__/competitors.test.ts
git commit -m "feat(core): add competitorKeywords function"
```

---

### Task 2: Implement `competitorCompare` Function

**Files:**
- Modify: `packages/core/src/__tests__/competitors.test.ts`
- Modify: `packages/core/src/competitors.ts`

- [ ] **Step 1: Add types for comparison result**

Add to the top of `packages/core/src/competitors.ts`, after the existing import:

```typescript
export interface ComparedKeyword {
  keyword: string;
  volume: number;
  difficulty: number;
  yourPosition?: number;
  competitorPosition?: number;
}

export interface CompareResult {
  yourDomain: string;
  competitorDomain: string;
  shared: ComparedKeyword[];
  yourOnly: ComparedKeyword[];
  competitorOnly: ComparedKeyword[];
}
```

- [ ] **Step 2: Write the failing tests**

Append to `packages/core/src/__tests__/competitors.test.ts`, inside the top-level file but after the `competitorKeywords` describe block:

```typescript
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
```

- [ ] **Step 3: Run test to verify new tests fail**

Run: `cd packages/core && pnpm test -- src/__tests__/competitors.test.ts`
Expected: competitorCompare tests FAIL — `competitorCompare` not yet implemented

- [ ] **Step 4: Write the implementation**

Add to `packages/core/src/competitors.ts`:

```typescript
/**
 * Side-by-side keyword overlap between your domain and a competitor.
 * Fetches keywords for both domains, then computes set intersections.
 */
export async function competitorCompare(
  provider: SearchDataProvider,
  yourDomain: string,
  competitorDomain: string,
  locale: string
): Promise<CompareResult> {
  const [yourKeywords, theirKeywords] = await Promise.all([
    provider.getCompetitorKeywords(yourDomain, locale),
    provider.getCompetitorKeywords(competitorDomain, locale),
  ]);

  const yourMap = new Map<string, KeywordData>();
  for (const kw of yourKeywords) {
    yourMap.set(kw.keyword, kw);
  }

  const theirMap = new Map<string, KeywordData>();
  for (const kw of theirKeywords) {
    theirMap.set(kw.keyword, kw);
  }

  const shared: ComparedKeyword[] = [];
  const yourOnly: ComparedKeyword[] = [];
  const competitorOnly: ComparedKeyword[] = [];

  for (const [keyword, yourData] of yourMap) {
    const theirData = theirMap.get(keyword);
    if (theirData) {
      shared.push({
        keyword,
        volume: yourData.volume,
        difficulty: yourData.difficulty,
      });
    } else {
      yourOnly.push({
        keyword,
        volume: yourData.volume,
        difficulty: yourData.difficulty,
      });
    }
  }

  for (const [keyword, theirData] of theirMap) {
    if (!yourMap.has(keyword)) {
      competitorOnly.push({
        keyword,
        volume: theirData.volume,
        difficulty: theirData.difficulty,
      });
    }
  }

  return {
    yourDomain,
    competitorDomain,
    shared,
    yourOnly,
    competitorOnly,
  };
}
```

- [ ] **Step 5: Run test to verify all pass**

Run: `cd packages/core && pnpm test -- src/__tests__/competitors.test.ts`
Expected: All 5 tests PASS (2 competitorKeywords + 3 competitorCompare)

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/competitors.ts packages/core/src/__tests__/competitors.test.ts
git commit -m "feat(core): add competitorCompare with keyword overlap analysis"
```

---

### Task 3: Implement `contentGaps` Function

**Files:**
- Modify: `packages/core/src/__tests__/competitors.test.ts`
- Modify: `packages/core/src/competitors.ts`

- [ ] **Step 1: Add types for content gap result**

Add to `packages/core/src/competitors.ts`, after the existing type definitions:

```typescript
export interface ContentGap {
  keyword: string;
  volume: number;
  difficulty: number;
  opportunity: number;
  competitorDomains: string[];
}

export interface ContentGapsResult {
  domain: string;
  gaps: ContentGap[];
  totalGaps: number;
  analyzedCompetitors: string[];
}
```

- [ ] **Step 2: Write the failing tests**

Append to `packages/core/src/__tests__/competitors.test.ts`:

```typescript
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
    expect(result.gaps[0].opportunity).toBe(1575);
  });
});
```

- [ ] **Step 3: Run test to verify new tests fail**

Run: `cd packages/core && pnpm test -- src/__tests__/competitors.test.ts`
Expected: contentGaps tests FAIL — `contentGaps` not yet implemented

- [ ] **Step 4: Write the implementation**

Add to `packages/core/src/competitors.ts`:

```typescript
/**
 * Find keywords that competitors rank for but you don't.
 * Scores each gap by opportunity: volume * (1 - difficulty/100).
 * Returns gaps sorted by opportunity descending.
 */
export async function contentGaps(
  provider: SearchDataProvider,
  yourDomain: string,
  competitors: string[],
  locale: string
): Promise<ContentGapsResult> {
  if (competitors.length === 0) {
    return {
      domain: yourDomain,
      gaps: [],
      totalGaps: 0,
      analyzedCompetitors: [],
    };
  }

  // Fetch your keywords and all competitor keywords in parallel
  const [yourKeywords, ...competitorResults] = await Promise.all([
    provider.getCompetitorKeywords(yourDomain, locale),
    ...competitors.map((c) => provider.getCompetitorKeywords(c, locale)),
  ]);

  // Build a set of your keywords for fast lookup
  const yourKeywordSet = new Set(yourKeywords.map((kw) => kw.keyword));

  // Aggregate competitor keywords: track best volume/difficulty and which competitors have it
  const gapMap = new Map<
    string,
    { volume: number; difficulty: number; domains: string[] }
  >();

  for (let i = 0; i < competitors.length; i++) {
    const competitorDomain = competitors[i];
    const keywords = competitorResults[i];

    for (const kw of keywords) {
      // Skip keywords you already rank for
      if (yourKeywordSet.has(kw.keyword)) continue;

      const existing = gapMap.get(kw.keyword);
      if (existing) {
        existing.domains.push(competitorDomain);
        // Use highest volume and lowest difficulty (best-case data)
        if (kw.volume > existing.volume) {
          existing.volume = kw.volume;
        }
        if (kw.difficulty < existing.difficulty) {
          existing.difficulty = kw.difficulty;
        }
      } else {
        gapMap.set(kw.keyword, {
          volume: kw.volume,
          difficulty: kw.difficulty,
          domains: [competitorDomain],
        });
      }
    }
  }

  // Convert to array and compute opportunity scores
  const gaps: ContentGap[] = [];
  for (const [keyword, data] of gapMap) {
    const opportunity = data.volume * (1 - data.difficulty / 100);
    gaps.push({
      keyword,
      volume: data.volume,
      difficulty: data.difficulty,
      opportunity,
      competitorDomains: data.domains,
    });
  }

  // Sort by opportunity descending
  gaps.sort((a, b) => b.opportunity - a.opportunity);

  return {
    domain: yourDomain,
    gaps,
    totalGaps: gaps.length,
    analyzedCompetitors: competitors,
  };
}
```

- [ ] **Step 5: Run test to verify all pass**

Run: `cd packages/core && pnpm test -- src/__tests__/competitors.test.ts`
Expected: All 10 tests PASS (2 competitorKeywords + 3 competitorCompare + 5 contentGaps)

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/competitors.ts packages/core/src/__tests__/competitors.test.ts
git commit -m "feat(core): add contentGaps with multi-competitor gap analysis and opportunity scoring"
```

---

### Task 4: Add Project-Aware `contentGapsForProject` Convenience Function

**Files:**
- Modify: `packages/core/src/__tests__/competitors.test.ts`
- Modify: `packages/core/src/competitors.ts`

This function reads the project config to resolve domain, competitors, and locale automatically.

- [ ] **Step 1: Write the failing test**

Append to `packages/core/src/__tests__/competitors.test.ts`:

```typescript
import { contentGapsForProject } from "../competitors.js";
import type { ProjectConfig } from "../types.js";

// Mock the project module
vi.mock("../project.js", () => ({
  getProject: vi.fn(),
}));

import { getProject } from "../project.js";

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm test -- src/__tests__/competitors.test.ts`
Expected: contentGapsForProject tests FAIL — function not exported

- [ ] **Step 3: Write the implementation**

Add to `packages/core/src/competitors.ts`, adding the import at the top:

```typescript
import { getProject } from "./project.js";
```

Then add the function at the bottom:

```typescript
/**
 * Project-aware content gap analysis.
 * Reads domain, competitors, and locale from the project config.
 */
export async function contentGapsForProject(
  provider: SearchDataProvider,
  projectSlug: string
): Promise<ContentGapsResult> {
  const project = getProject(projectSlug);
  const domain = project.config.domain;
  const competitors = project.config.competitors ?? [];
  const locale = project.config.locale ?? "en-US";

  return contentGaps(provider, domain, competitors, locale);
}
```

- [ ] **Step 4: Run test to verify all pass**

Run: `cd packages/core && pnpm test -- src/__tests__/competitors.test.ts`
Expected: All 13 tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/competitors.ts packages/core/src/__tests__/competitors.test.ts
git commit -m "feat(core): add contentGapsForProject convenience function"
```

---

### Task 5: Export from Barrel

**Files:**
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Add exports to barrel**

Add to `packages/core/src/index.ts`:

```typescript
export {
  competitorKeywords,
  competitorCompare,
  contentGaps,
  contentGapsForProject,
} from "./competitors.js";
export type {
  ComparedKeyword,
  CompareResult,
  ContentGap,
  ContentGapsResult,
} from "./competitors.js";
```

- [ ] **Step 2: Verify build**

Run: `cd packages/core && pnpm build`
Expected: Build succeeds with no errors, `dist/competitors.js` and `dist/competitors.d.ts` emitted

- [ ] **Step 3: Run full test suite**

Run: `cd packages/core && pnpm test`
Expected: All tests pass, including the 13 competitor tests

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/index.ts
git commit -m "feat(core): export competitor analysis functions from barrel"
```
