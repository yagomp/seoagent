# Strategy Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Strategy Engine that aggregates all project data, generates a prioritized SEO strategy via LLM (or rule-based fallback), and stores/diffs strategies over time.

**Architecture:** `aggregateProjectData` reads all SQLite tables into a structured context object. An LLM client abstraction supports Anthropic, OpenAI, and Ollama via a unified `callLlm` function. The strategy prompt sends aggregated data to the LLM, validates the response with zod, and stores it as JSON in the `strategies` table. When no LLM key is configured, a rule-based engine analyzes the data directly and produces template-driven recommendations. `strategyRefresh` generates a new strategy and diffs it against the previous one.

**Tech Stack:** TypeScript, better-sqlite3, zod, @anthropic-ai/sdk, openai, node fetch (for Ollama)

---

## File Structure

```
packages/core/src/
├── strategy/
│   ├── types.ts                    # Strategy, ActionItem, ContentItem, etc.
│   ├── aggregate.ts                # aggregateProjectData — reads all tables
│   ├── llm-client.ts               # callLlm — Anthropic/OpenAI/Ollama abstraction
│   ├── prompt.ts                   # buildStrategyPrompt — system + user prompt
│   ├── validate.ts                 # zod schema + parseStrategyResponse
│   ├── rules.ts                    # rule-based fallback engine
│   ├── generate.ts                 # strategyGenerate orchestrator
│   ├── refresh.ts                  # strategyRefresh — generate + diff
│   └── index.ts                    # barrel export for strategy/
├── __tests__/
│   ├── strategy-types.test.ts
│   ├── strategy-aggregate.test.ts
│   ├── strategy-llm-client.test.ts
│   ├── strategy-validate.test.ts
│   ├── strategy-rules.test.ts
│   ├── strategy-generate.test.ts
│   └── strategy-refresh.test.ts
└── index.ts                        # updated barrel — re-exports strategy/
```

---

### Task 1: Strategy Types

**Files:**
- Create: `packages/core/src/strategy/types.ts`
- Create: `packages/core/src/__tests__/strategy-types.test.ts`

- [ ] **Step 1: Write the test**

Create `packages/core/src/__tests__/strategy-types.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm test -- src/__tests__/strategy-types.test.ts`
Expected: FAIL — module `../strategy/types.js` not found

- [ ] **Step 3: Write the implementation**

Create `packages/core/src/strategy/types.ts`:

```typescript
export interface ActionItem {
  action: string;
  reason: string;
  impact: "high" | "medium" | "low";
  effort: "high" | "medium" | "low";
  filePath?: string;
}

export interface ContentItem extends ActionItem {
  targetKeyword: string;
  estimatedVolume?: number;
  currentPage: string | null;
}

export interface AuditFix extends ActionItem {
  url: string;
  issueType: string;
}

export interface LinkTactic extends ActionItem {
  targetDomains?: string[];
  anchorStrategy?: string;
}

export interface Strategy {
  generatedAt: string;
  overallScore: number;
  quickWins: ActionItem[];
  contentPlan: ContentItem[];
  technicalFixes: AuditFix[];
  linkBuilding: LinkTactic[];
  drPlan: {
    currentDR: number;
    targetDR: number;
    actions: string[];
  };
  competitorInsights: string[];
}

export interface StrategyDiff {
  previousScore: number;
  currentScore: number;
  improvements: string[];
  regressions: string[];
  newQuickWins: number;
  resolvedQuickWins: number;
}

export interface StrategyRefreshResult {
  strategy: Strategy;
  diff: StrategyDiff;
}

export interface AggregatedData {
  project: {
    domain: string;
    name: string;
    niche?: string;
    competitors?: string[];
    locale?: string;
  };
  keywords: {
    total: number;
    tracked: number;
    avgPosition: number | null;
    top10Count: number;
  };
  pages: {
    total: number;
    missingTitle: number;
    missingDescription: number;
    missingH1: number;
    thinContent: number;
    avgWordCount: number;
    brokenLinks: number;
  };
  backlinks: {
    total: number;
    uniqueDomains: number;
    dofollowRatio: number;
  };
  domainRating: {
    current: number | null;
    previous: number | null;
    trend: "up" | "down" | "stable" | "unknown";
  };
  gsc: {
    totalClicks: number;
    totalImpressions: number;
    avgCtr: number;
    avgPosition: number;
  };
}

export interface LlmConfig {
  provider: "anthropic" | "openai" | "ollama";
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && pnpm test -- src/__tests__/strategy-types.test.ts`
Expected: All 8 tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/strategy/types.ts packages/core/src/__tests__/strategy-types.test.ts
git commit -m "feat(core): add strategy engine type definitions"
```

---

### Task 2: Data Aggregation Function

**Files:**
- Create: `packages/core/src/strategy/aggregate.ts`
- Create: `packages/core/src/__tests__/strategy-aggregate.test.ts`

- [ ] **Step 1: Write the test**

Create `packages/core/src/__tests__/strategy-aggregate.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { openDatabase, closeDatabase } from "../database.js";
import { aggregateProjectData } from "../strategy/aggregate.js";
import type { AggregatedData } from "../strategy/types.js";

describe("aggregateProjectData", () => {
  let tmpDir: string;
  let dbPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "seoagent-agg-test-"));
    dbPath = path.join(tmpDir, "seoagent.db");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns zeroed data for empty database", () => {
    const db = openDatabase(dbPath);
    const project = { domain: "example.com", name: "Example" };
    const result = aggregateProjectData(db, project);

    expect(result.project.domain).toBe("example.com");
    expect(result.keywords.total).toBe(0);
    expect(result.keywords.tracked).toBe(0);
    expect(result.keywords.avgPosition).toBeNull();
    expect(result.keywords.top10Count).toBe(0);
    expect(result.pages.total).toBe(0);
    expect(result.pages.missingTitle).toBe(0);
    expect(result.pages.missingDescription).toBe(0);
    expect(result.pages.missingH1).toBe(0);
    expect(result.pages.thinContent).toBe(0);
    expect(result.pages.avgWordCount).toBe(0);
    expect(result.pages.brokenLinks).toBe(0);
    expect(result.backlinks.total).toBe(0);
    expect(result.backlinks.uniqueDomains).toBe(0);
    expect(result.backlinks.dofollowRatio).toBe(0);
    expect(result.domainRating.current).toBeNull();
    expect(result.domainRating.trend).toBe("unknown");
    expect(result.gsc.totalClicks).toBe(0);
    expect(result.gsc.totalImpressions).toBe(0);

    closeDatabase(db);
  });

  it("aggregates keyword data correctly", () => {
    const db = openDatabase(dbPath);

    db.prepare(
      "INSERT INTO keywords (keyword, locale, volume, difficulty, current_position, tracked) VALUES (?, ?, ?, ?, ?, ?)"
    ).run("fpl tips", "en-GB", 5000, 45, 8, 1);
    db.prepare(
      "INSERT INTO keywords (keyword, locale, volume, difficulty, current_position, tracked) VALUES (?, ?, ?, ?, ?, ?)"
    ).run("fantasy football", "en-GB", 20000, 80, 25, 1);
    db.prepare(
      "INSERT INTO keywords (keyword, locale, volume, difficulty, current_position, tracked) VALUES (?, ?, ?, ?, ?, ?)"
    ).run("fpl ai", "en-GB", 1000, 20, 3, 0);

    const project = { domain: "fplai.app", name: "FPLai" };
    const result = aggregateProjectData(db, project);

    expect(result.keywords.total).toBe(3);
    expect(result.keywords.tracked).toBe(2);
    expect(result.keywords.avgPosition).toBeCloseTo(12);
    expect(result.keywords.top10Count).toBe(2);

    closeDatabase(db);
  });

  it("aggregates crawl page data correctly", () => {
    const db = openDatabase(dbPath);

    db.prepare(
      "INSERT INTO crawl_pages (url, status_code, title, meta_description, h1, word_count) VALUES (?, ?, ?, ?, ?, ?)"
    ).run("https://ex.com/", 200, "Home", "Welcome", "Home", 800);
    db.prepare(
      "INSERT INTO crawl_pages (url, status_code, title, meta_description, h1, word_count) VALUES (?, ?, ?, ?, ?, ?)"
    ).run("https://ex.com/about", 200, null, null, null, 50);
    db.prepare(
      "INSERT INTO crawl_pages (url, status_code, title, meta_description, h1, word_count) VALUES (?, ?, ?, ?, ?, ?)"
    ).run("https://ex.com/broken", 404, "Not Found", "Not Found", "404", 10);

    const project = { domain: "ex.com", name: "Example" };
    const result = aggregateProjectData(db, project);

    expect(result.pages.total).toBe(3);
    expect(result.pages.missingTitle).toBe(1);
    expect(result.pages.missingDescription).toBe(1);
    expect(result.pages.missingH1).toBe(1);
    expect(result.pages.thinContent).toBe(2); // word_count < 300
    expect(result.pages.avgWordCount).toBeCloseTo(286.67, 0);
    expect(result.pages.brokenLinks).toBe(1); // status 404

    closeDatabase(db);
  });

  it("aggregates backlink data correctly", () => {
    const db = openDatabase(dbPath);

    db.prepare(
      "INSERT INTO backlinks (source_domain, source_url, target_url, anchor_text, is_dofollow) VALUES (?, ?, ?, ?, ?)"
    ).run("blog.com", "https://blog.com/post", "https://ex.com/", "example", 1);
    db.prepare(
      "INSERT INTO backlinks (source_domain, source_url, target_url, anchor_text, is_dofollow) VALUES (?, ?, ?, ?, ?)"
    ).run("blog.com", "https://blog.com/other", "https://ex.com/about", "about", 0);
    db.prepare(
      "INSERT INTO backlinks (source_domain, source_url, target_url, anchor_text, is_dofollow) VALUES (?, ?, ?, ?, ?)"
    ).run("news.org", "https://news.org/article", "https://ex.com/", "ex", 1);

    const project = { domain: "ex.com", name: "Example" };
    const result = aggregateProjectData(db, project);

    expect(result.backlinks.total).toBe(3);
    expect(result.backlinks.uniqueDomains).toBe(2);
    expect(result.backlinks.dofollowRatio).toBeCloseTo(0.6667, 2);

    closeDatabase(db);
  });

  it("aggregates domain rating with trend", () => {
    const db = openDatabase(dbPath);

    db.prepare(
      "INSERT INTO dr_history (domain_rating, referring_domains, checked_at) VALUES (?, ?, ?)"
    ).run(10, 30, "2026-03-01T00:00:00Z");
    db.prepare(
      "INSERT INTO dr_history (domain_rating, referring_domains, checked_at) VALUES (?, ?, ?)"
    ).run(15, 45, "2026-04-01T00:00:00Z");

    const project = { domain: "ex.com", name: "Example" };
    const result = aggregateProjectData(db, project);

    expect(result.domainRating.current).toBe(15);
    expect(result.domainRating.previous).toBe(10);
    expect(result.domainRating.trend).toBe("up");

    closeDatabase(db);
  });

  it("aggregates GSC data correctly", () => {
    const db = openDatabase(dbPath);

    db.prepare(
      "INSERT INTO gsc_data (date, query, page, clicks, impressions, ctr, position) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run("2026-04-01", "fpl tips", "https://fplai.app/tips", 100, 2000, 0.05, 8.5);
    db.prepare(
      "INSERT INTO gsc_data (date, query, page, clicks, impressions, ctr, position) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run("2026-04-02", "fpl ai", "https://fplai.app/", 200, 3000, 0.0667, 5.2);

    const project = { domain: "fplai.app", name: "FPLai" };
    const result = aggregateProjectData(db, project);

    expect(result.gsc.totalClicks).toBe(300);
    expect(result.gsc.totalImpressions).toBe(5000);
    expect(result.gsc.avgCtr).toBeCloseTo(0.06, 2);
    expect(result.gsc.avgPosition).toBeCloseTo(6.85, 1);

    closeDatabase(db);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm test -- src/__tests__/strategy-aggregate.test.ts`
Expected: FAIL — module `../strategy/aggregate.js` not found

- [ ] **Step 3: Write the implementation**

Create `packages/core/src/strategy/aggregate.ts`:

```typescript
import type Database from "better-sqlite3";
import type { AggregatedData } from "./types.js";

interface ProjectInfo {
  domain: string;
  name: string;
  niche?: string;
  competitors?: string[];
  locale?: string;
}

export function aggregateProjectData(
  db: Database.Database,
  project: ProjectInfo
): AggregatedData {
  return {
    project: {
      domain: project.domain,
      name: project.name,
      niche: project.niche,
      competitors: project.competitors,
      locale: project.locale,
    },
    keywords: aggregateKeywords(db),
    pages: aggregatePages(db),
    backlinks: aggregateBacklinks(db),
    domainRating: aggregateDomainRating(db),
    gsc: aggregateGsc(db),
  };
}

function aggregateKeywords(db: Database.Database): AggregatedData["keywords"] {
  const total = (
    db.prepare("SELECT COUNT(*) as count FROM keywords").get() as { count: number }
  ).count;

  const tracked = (
    db.prepare("SELECT COUNT(*) as count FROM keywords WHERE tracked = 1").get() as {
      count: number;
    }
  ).count;

  const avgRow = db
    .prepare(
      "SELECT AVG(current_position) as avg_pos FROM keywords WHERE current_position IS NOT NULL"
    )
    .get() as { avg_pos: number | null };

  const top10 = (
    db
      .prepare(
        "SELECT COUNT(*) as count FROM keywords WHERE current_position IS NOT NULL AND current_position <= 10"
      )
      .get() as { count: number }
  ).count;

  return {
    total,
    tracked,
    avgPosition: avgRow.avg_pos,
    top10Count: top10,
  };
}

function aggregatePages(db: Database.Database): AggregatedData["pages"] {
  const total = (
    db.prepare("SELECT COUNT(*) as count FROM crawl_pages").get() as { count: number }
  ).count;

  if (total === 0) {
    return {
      total: 0,
      missingTitle: 0,
      missingDescription: 0,
      missingH1: 0,
      thinContent: 0,
      avgWordCount: 0,
      brokenLinks: 0,
    };
  }

  const missingTitle = (
    db
      .prepare(
        "SELECT COUNT(*) as count FROM crawl_pages WHERE title IS NULL OR title = ''"
      )
      .get() as { count: number }
  ).count;

  const missingDescription = (
    db
      .prepare(
        "SELECT COUNT(*) as count FROM crawl_pages WHERE meta_description IS NULL OR meta_description = ''"
      )
      .get() as { count: number }
  ).count;

  const missingH1 = (
    db
      .prepare(
        "SELECT COUNT(*) as count FROM crawl_pages WHERE h1 IS NULL OR h1 = ''"
      )
      .get() as { count: number }
  ).count;

  const thinContent = (
    db
      .prepare(
        "SELECT COUNT(*) as count FROM crawl_pages WHERE word_count IS NOT NULL AND word_count < 300"
      )
      .get() as { count: number }
  ).count;

  const avgWc = (
    db
      .prepare("SELECT AVG(word_count) as avg_wc FROM crawl_pages WHERE word_count IS NOT NULL")
      .get() as { avg_wc: number | null }
  ).avg_wc;

  const brokenLinks = (
    db
      .prepare(
        "SELECT COUNT(*) as count FROM crawl_pages WHERE status_code >= 400"
      )
      .get() as { count: number }
  ).count;

  return {
    total,
    missingTitle,
    missingDescription,
    missingH1,
    thinContent,
    avgWordCount: avgWc ?? 0,
    brokenLinks,
  };
}

function aggregateBacklinks(db: Database.Database): AggregatedData["backlinks"] {
  const total = (
    db.prepare("SELECT COUNT(*) as count FROM backlinks").get() as { count: number }
  ).count;

  if (total === 0) {
    return { total: 0, uniqueDomains: 0, dofollowRatio: 0 };
  }

  const uniqueDomains = (
    db
      .prepare("SELECT COUNT(DISTINCT source_domain) as count FROM backlinks")
      .get() as { count: number }
  ).count;

  const dofollow = (
    db
      .prepare("SELECT COUNT(*) as count FROM backlinks WHERE is_dofollow = 1")
      .get() as { count: number }
  ).count;

  return {
    total,
    uniqueDomains,
    dofollowRatio: dofollow / total,
  };
}

function aggregateDomainRating(
  db: Database.Database
): AggregatedData["domainRating"] {
  const rows = db
    .prepare(
      "SELECT domain_rating FROM dr_history ORDER BY checked_at DESC LIMIT 2"
    )
    .all() as { domain_rating: number }[];

  if (rows.length === 0) {
    return { current: null, previous: null, trend: "unknown" };
  }

  const current = rows[0].domain_rating;
  const previous = rows.length > 1 ? rows[1].domain_rating : null;

  let trend: "up" | "down" | "stable" | "unknown" = "unknown";
  if (previous !== null) {
    if (current > previous) trend = "up";
    else if (current < previous) trend = "down";
    else trend = "stable";
  }

  return { current, previous, trend };
}

function aggregateGsc(db: Database.Database): AggregatedData["gsc"] {
  const row = db
    .prepare(
      `SELECT
        COALESCE(SUM(clicks), 0) as total_clicks,
        COALESCE(SUM(impressions), 0) as total_impressions,
        AVG(ctr) as avg_ctr,
        AVG(position) as avg_position
      FROM gsc_data`
    )
    .get() as {
    total_clicks: number;
    total_impressions: number;
    avg_ctr: number | null;
    avg_position: number | null;
  };

  return {
    totalClicks: row.total_clicks,
    totalImpressions: row.total_impressions,
    avgCtr: row.avg_ctr ?? 0,
    avgPosition: row.avg_position ?? 0,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && pnpm test -- src/__tests__/strategy-aggregate.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/strategy/aggregate.ts packages/core/src/__tests__/strategy-aggregate.test.ts
git commit -m "feat(core): add data aggregation for strategy engine"
```

---

### Task 3: LLM Client Abstraction

**Files:**
- Create: `packages/core/src/strategy/llm-client.ts`
- Create: `packages/core/src/__tests__/strategy-llm-client.test.ts`

- [ ] **Step 1: Write the test**

Create `packages/core/src/__tests__/strategy-llm-client.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { callLlm, getLlmConfig } from "../strategy/llm-client.js";
import type { LlmConfig } from "../strategy/types.js";

// Mock the config module
vi.mock("../config.js", () => ({
  getConfigValue: vi.fn(),
}));

// Mock the external SDKs at the module level
vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = {
      create: vi.fn().mockResolvedValue({
        content: [{ type: "text", text: '{"generatedAt":"2026-04-04T12:00:00Z"}' }],
      }),
    };
    constructor() {}
  },
}));

vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: '{"generatedAt":"2026-04-04T12:00:00Z"}' } }],
        }),
      },
    };
    constructor() {}
  },
}));

describe("llm-client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getLlmConfig", () => {
    it("returns null when no provider configured", async () => {
      const { getConfigValue } = await import("../config.js");
      (getConfigValue as ReturnType<typeof vi.fn>).mockReturnValue(undefined);

      const config = getLlmConfig();
      expect(config).toBeNull();
    });

    it("returns config when provider is set", async () => {
      const { getConfigValue } = await import("../config.js");
      (getConfigValue as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
        const values: Record<string, string> = {
          "llm.provider": "anthropic",
          "llm.apiKey": "sk-ant-xxx",
          "llm.model": "claude-sonnet-4-6",
        };
        return values[key];
      });

      const config = getLlmConfig();
      expect(config).toEqual({
        provider: "anthropic",
        apiKey: "sk-ant-xxx",
        model: "claude-sonnet-4-6",
        baseUrl: undefined,
      });
    });
  });

  describe("callLlm", () => {
    it("calls Anthropic SDK and returns text", async () => {
      const config: LlmConfig = {
        provider: "anthropic",
        apiKey: "sk-ant-xxx",
        model: "claude-sonnet-4-6",
      };

      const result = await callLlm(config, "system prompt", "user prompt");
      expect(result).toBe('{"generatedAt":"2026-04-04T12:00:00Z"}');
    });

    it("calls OpenAI SDK and returns text", async () => {
      const config: LlmConfig = {
        provider: "openai",
        apiKey: "sk-xxx",
        model: "gpt-4o",
      };

      const result = await callLlm(config, "system prompt", "user prompt");
      expect(result).toBe('{"generatedAt":"2026-04-04T12:00:00Z"}');
    });

    it("calls Ollama via fetch and returns text", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          message: { content: '{"generatedAt":"2026-04-04T12:00:00Z"}' },
        }),
      };
      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      const config: LlmConfig = {
        provider: "ollama",
        model: "llama3",
      };

      const result = await callLlm(config, "system prompt", "user prompt");
      expect(result).toBe('{"generatedAt":"2026-04-04T12:00:00Z"}');
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:11434/api/chat",
        expect.objectContaining({
          method: "POST",
        })
      );
    });

    it("throws on unsupported provider", async () => {
      const config = {
        provider: "unknown" as LlmConfig["provider"],
        apiKey: "xxx",
      };

      await expect(callLlm(config, "sys", "usr")).rejects.toThrow(
        "Unsupported LLM provider: unknown"
      );
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm test -- src/__tests__/strategy-llm-client.test.ts`
Expected: FAIL — module `../strategy/llm-client.js` not found

- [ ] **Step 3: Install LLM SDK dependencies**

Run: `cd packages/core && pnpm add @anthropic-ai/sdk openai`
Expected: Packages added to `dependencies` in `packages/core/package.json`

- [ ] **Step 4: Write the implementation**

Create `packages/core/src/strategy/llm-client.ts`:

```typescript
import { getConfigValue } from "../config.js";
import type { LlmConfig } from "./types.js";

export function getLlmConfig(): LlmConfig | null {
  const provider = getConfigValue("llm.provider") as string | undefined;
  if (!provider) return null;

  return {
    provider: provider as LlmConfig["provider"],
    apiKey: getConfigValue("llm.apiKey") as string | undefined,
    model: getConfigValue("llm.model") as string | undefined,
    baseUrl: getConfigValue("llm.baseUrl") as string | undefined,
  };
}

export async function callLlm(
  config: LlmConfig,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  switch (config.provider) {
    case "anthropic":
      return callAnthropic(config, systemPrompt, userPrompt);
    case "openai":
      return callOpenAI(config, systemPrompt, userPrompt);
    case "ollama":
      return callOllama(config, systemPrompt, userPrompt);
    default:
      throw new Error(`Unsupported LLM provider: ${config.provider}`);
  }
}

async function callAnthropic(
  config: LlmConfig,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: config.apiKey });

  const response = await client.messages.create({
    model: config.model ?? "claude-sonnet-4-6",
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Anthropic");
  }
  return textBlock.text;
}

async function callOpenAI(
  config: LlmConfig,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({
    apiKey: config.apiKey,
    ...(config.baseUrl ? { baseURL: config.baseUrl } : {}),
  });

  const response = await client.chat.completions.create({
    model: config.model ?? "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_tokens: 4096,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No text response from OpenAI");
  }
  return content;
}

async function callOllama(
  config: LlmConfig,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const baseUrl = config.baseUrl ?? "http://localhost:11434";
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.model ?? "llama3",
      stream: false,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama request failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as { message: { content: string } };
  return data.message.content;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/core && pnpm test -- src/__tests__/strategy-llm-client.test.ts`
Expected: All 5 tests PASS

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/strategy/llm-client.ts packages/core/src/__tests__/strategy-llm-client.test.ts packages/core/package.json
git commit -m "feat(core): add LLM client abstraction for Anthropic/OpenAI/Ollama"
```

---

### Task 4: LLM Strategy Generation with Zod Validation

**Files:**
- Create: `packages/core/src/strategy/prompt.ts`
- Create: `packages/core/src/strategy/validate.ts`
- Create: `packages/core/src/__tests__/strategy-validate.test.ts`

- [ ] **Step 1: Write the test**

Create `packages/core/src/__tests__/strategy-validate.test.ts`:

```typescript
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
    expect(userPrompt).toContain("overallScore");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm test -- src/__tests__/strategy-validate.test.ts`
Expected: FAIL — modules not found

- [ ] **Step 3: Write the prompt builder**

Create `packages/core/src/strategy/prompt.ts`:

```typescript
import type { AggregatedData } from "./types.js";

export function buildStrategyPrompt(data: AggregatedData): {
  systemPrompt: string;
  userPrompt: string;
} {
  const systemPrompt = `You are an expert SEO strategist. You analyze website data and produce actionable, prioritized SEO strategies.

You MUST respond with ONLY a valid JSON object matching this exact schema — no markdown, no explanation, no wrapping:

{
  "generatedAt": "<ISO 8601 timestamp>",
  "overallScore": <0-100 integer>,
  "quickWins": [{ "action": "<string>", "reason": "<string>", "impact": "high"|"medium"|"low", "effort": "high"|"medium"|"low", "filePath?": "<string>" }],
  "contentPlan": [{ "action": "<string>", "reason": "<string>", "impact": "high"|"medium"|"low", "effort": "high"|"medium"|"low", "targetKeyword": "<string>", "estimatedVolume?": <number>, "currentPage": "<string>"|null }],
  "technicalFixes": [{ "action": "<string>", "reason": "<string>", "impact": "high"|"medium"|"low", "effort": "high"|"medium"|"low", "url": "<string>", "issueType": "<string>" }],
  "linkBuilding": [{ "action": "<string>", "reason": "<string>", "impact": "high"|"medium"|"low", "effort": "high"|"medium"|"low", "targetDomains?": ["<string>"], "anchorStrategy?": "<string>" }],
  "drPlan": { "currentDR": <number>, "targetDR": <number>, "actions": ["<string>"] },
  "competitorInsights": ["<string>"]
}

Rules:
- overallScore: 0 = terrible SEO health, 100 = excellent
- quickWins: high impact + low effort items, aim for 3-7 items
- contentPlan: pages to create or improve, aim for 3-5 items
- technicalFixes: prioritized by impact, from crawl data
- linkBuilding: niche-relevant tactics, 2-4 items
- drPlan: realistic 6-month target based on current DR
- competitorInsights: 2-5 key findings`;

  const userPrompt = `Analyze this SEO data and generate a strategy:

## Project
- Domain: ${data.project.domain}
- Name: ${data.project.name}
${data.project.niche ? `- Niche: ${data.project.niche}` : ""}
${data.project.competitors?.length ? `- Competitors: ${data.project.competitors.join(", ")}` : ""}
${data.project.locale ? `- Locale: ${data.project.locale}` : ""}

## Keywords
- Total keywords: ${data.keywords.total}
- Tracked keywords: ${data.keywords.tracked}
- Average position: ${data.keywords.avgPosition ?? "N/A"}
- Keywords in top 10: ${data.keywords.top10Count}

## Pages (Crawl Data)
- Total pages: ${data.pages.total}
- Missing title: ${data.pages.missingTitle}
- Missing meta description: ${data.pages.missingDescription}
- Missing H1: ${data.pages.missingH1}
- Thin content (< 300 words): ${data.pages.thinContent}
- Average word count: ${Math.round(data.pages.avgWordCount)}
- Broken pages (4xx/5xx): ${data.pages.brokenLinks}

## Backlinks
- Total backlinks: ${data.backlinks.total}
- Unique referring domains: ${data.backlinks.uniqueDomains}
- Dofollow ratio: ${(data.backlinks.dofollowRatio * 100).toFixed(1)}%

## Domain Rating
- Current DR: ${data.domainRating.current ?? "N/A"}
- Previous DR: ${data.domainRating.previous ?? "N/A"}
- Trend: ${data.domainRating.trend}

## Google Search Console (last 28 days)
- Total clicks: ${data.gsc.totalClicks}
- Total impressions: ${data.gsc.totalImpressions}
- Average CTR: ${(data.gsc.avgCtr * 100).toFixed(2)}%
- Average position: ${data.gsc.avgPosition.toFixed(1)}

Respond with the JSON strategy object only.`;

  return { systemPrompt, userPrompt };
}
```

- [ ] **Step 4: Write the validator**

Create `packages/core/src/strategy/validate.ts`:

```typescript
import { z } from "zod";
import type { Strategy } from "./types.js";

const impactEnum = z.enum(["high", "medium", "low"]);
const effortEnum = z.enum(["high", "medium", "low"]);

const actionItemSchema = z.object({
  action: z.string(),
  reason: z.string(),
  impact: impactEnum,
  effort: effortEnum,
  filePath: z.string().optional(),
});

const contentItemSchema = actionItemSchema.extend({
  targetKeyword: z.string(),
  estimatedVolume: z.number().optional(),
  currentPage: z.string().nullable(),
});

const auditFixSchema = actionItemSchema.extend({
  url: z.string(),
  issueType: z.string(),
});

const linkTacticSchema = actionItemSchema.extend({
  targetDomains: z.array(z.string()).optional(),
  anchorStrategy: z.string().optional(),
});

export const strategySchema = z.object({
  generatedAt: z.string(),
  overallScore: z.number().int().min(0).max(100),
  quickWins: z.array(actionItemSchema),
  contentPlan: z.array(contentItemSchema),
  technicalFixes: z.array(auditFixSchema),
  linkBuilding: z.array(linkTacticSchema),
  drPlan: z.object({
    currentDR: z.number(),
    targetDR: z.number(),
    actions: z.array(z.string()),
  }),
  competitorInsights: z.array(z.string()),
});

export function parseStrategyResponse(raw: string): Strategy {
  // Strip markdown code fences if present
  let jsonStr = raw.trim();
  const fenceMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) {
    jsonStr = fenceMatch[1].trim();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error(`Failed to parse LLM response as JSON: ${jsonStr.slice(0, 200)}`);
  }

  const result = strategySchema.safeParse(parsed);
  if (!result.success) {
    const errors = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Strategy response failed validation: ${errors}`);
  }

  return result.data as Strategy;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/core && pnpm test -- src/__tests__/strategy-validate.test.ts`
Expected: All 9 tests PASS

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/strategy/prompt.ts packages/core/src/strategy/validate.ts packages/core/src/__tests__/strategy-validate.test.ts
git commit -m "feat(core): add strategy prompt builder and zod-validated response parser"
```

---

### Task 5: Rule-Based Fallback Engine

**Files:**
- Create: `packages/core/src/strategy/rules.ts`
- Create: `packages/core/src/__tests__/strategy-rules.test.ts`

- [ ] **Step 1: Write the test**

Create `packages/core/src/__tests__/strategy-rules.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm test -- src/__tests__/strategy-rules.test.ts`
Expected: FAIL — module `../strategy/rules.js` not found

- [ ] **Step 3: Write the implementation**

Create `packages/core/src/strategy/rules.ts`:

```typescript
import type { Strategy, ActionItem, ContentItem, AuditFix, LinkTactic, AggregatedData } from "./types.js";

export function generateRuleBasedStrategy(data: AggregatedData): Strategy {
  const quickWins: ActionItem[] = [];
  const contentPlan: ContentItem[] = [];
  const technicalFixes: AuditFix[] = [];
  const linkBuilding: LinkTactic[] = [];
  const competitorInsights: string[] = [];

  // === Quick Wins ===

  // No data at all — suggest running an audit
  if (data.pages.total === 0) {
    quickWins.push({
      action: "Run a site crawl/audit to collect baseline data",
      reason: "No crawl data exists yet — all recommendations depend on it",
      impact: "high",
      effort: "low",
    });
  }

  // Missing meta descriptions > 10%
  if (data.pages.total > 0 && data.pages.missingDescription / data.pages.total > 0.1) {
    quickWins.push({
      action: `Fix missing meta descriptions on ${data.pages.missingDescription} pages`,
      reason: `${((data.pages.missingDescription / data.pages.total) * 100).toFixed(0)}% of pages lack meta descriptions, reducing CTR in search results`,
      impact: "high",
      effort: "low",
    });
  }

  // Missing titles
  if (data.pages.total > 0 && data.pages.missingTitle > 0) {
    quickWins.push({
      action: `Add page titles to ${data.pages.missingTitle} pages`,
      reason: "Missing titles severely hurt search visibility and click-through rates",
      impact: "high",
      effort: "low",
    });
  }

  // Missing H1s
  if (data.pages.total > 0 && data.pages.missingH1 > 0) {
    quickWins.push({
      action: `Add H1 headings to ${data.pages.missingH1} pages`,
      reason: "H1 tags help search engines understand page topic and content hierarchy",
      impact: "medium",
      effort: "low",
    });
  }

  // Low CTR
  if (data.gsc.totalImpressions > 0 && data.gsc.avgCtr < 0.03) {
    quickWins.push({
      action: "Improve title tags and meta descriptions to boost CTR",
      reason: `Average CTR is ${(data.gsc.avgCtr * 100).toFixed(2)}% which is below the 3% benchmark — better titles/descriptions can double click rates`,
      impact: "high",
      effort: "medium",
    });
  }

  // No tracked keywords
  if (data.keywords.tracked === 0 && data.keywords.total === 0) {
    quickWins.push({
      action: "Research and track target keywords for your niche",
      reason: "No keywords are being tracked — keyword data drives content and ranking strategy",
      impact: "high",
      effort: "medium",
    });
  }

  // === Technical Fixes ===

  if (data.pages.brokenLinks > 0) {
    technicalFixes.push({
      action: `Fix ${data.pages.brokenLinks} broken pages returning 4xx/5xx errors`,
      reason: "Broken pages waste crawl budget and create poor user experience",
      impact: "high",
      effort: "low",
      url: data.project.domain,
      issueType: "broken_pages",
    });
  }

  if (data.pages.total > 0 && data.pages.thinContent > 0) {
    technicalFixes.push({
      action: `Expand ${data.pages.thinContent} thin content pages (< 300 words)`,
      reason: "Thin pages are less likely to rank and may be flagged as low quality",
      impact: "medium",
      effort: "medium",
      url: data.project.domain,
      issueType: "thin_content",
    });
  }

  // === Content Plan ===

  if (data.pages.total > 0 && data.pages.thinContent / data.pages.total > 0.15) {
    contentPlan.push({
      action: `Expand thin content pages — ${data.pages.thinContent} pages have fewer than 300 words`,
      reason: `${((data.pages.thinContent / data.pages.total) * 100).toFixed(0)}% of pages are thin content, avg word count is ${Math.round(data.pages.avgWordCount)}`,
      impact: "high",
      effort: "medium",
      targetKeyword: "",
      currentPage: null,
    });
  }

  if (data.keywords.total > 0 && data.keywords.top10Count < data.keywords.total * 0.2) {
    contentPlan.push({
      action: "Create dedicated landing pages for keywords outside top 10",
      reason: `Only ${data.keywords.top10Count} of ${data.keywords.total} keywords rank in the top 10 — targeted content can improve rankings`,
      impact: "high",
      effort: "high",
      targetKeyword: "",
      currentPage: null,
    });
  }

  // === Link Building ===

  const currentDR = data.domainRating.current ?? 0;

  if (currentDR < 20) {
    linkBuilding.push({
      action: "Start foundational link building — directories, profiles, and niche communities",
      reason: `DR of ${currentDR} is very low — foundational links establish baseline authority`,
      impact: "high",
      effort: "medium",
    });
    linkBuilding.push({
      action: "Create linkable assets (tools, research, infographics) to attract natural links",
      reason: "Low-DR sites need standout content to earn editorial links",
      impact: "high",
      effort: "high",
    });
  } else if (currentDR < 40) {
    linkBuilding.push({
      action: "Pursue guest posting and digital PR in niche publications",
      reason: `DR of ${currentDR} is moderate — targeted outreach can accelerate growth`,
      impact: "high",
      effort: "high",
    });
  }

  if (data.backlinks.total === 0) {
    linkBuilding.push({
      action: "Analyze competitor backlinks and replicate their best links",
      reason: "No backlinks detected — competitor backlink analysis reveals quick link opportunities",
      impact: "high",
      effort: "medium",
    });
  }

  // === DR Plan ===

  let targetDR: number;
  if (currentDR < 10) targetDR = 20;
  else if (currentDR < 20) targetDR = 35;
  else if (currentDR < 40) targetDR = 55;
  else targetDR = Math.min(currentDR + 15, 100);

  const drActions: string[] = [];
  if (currentDR < 30) drActions.push("Build niche-relevant backlinks consistently");
  if (currentDR < 50) drActions.push("Create linkable assets (tools, research, data)");
  drActions.push("Monitor referring domain growth monthly");
  if (data.backlinks.dofollowRatio < 0.6 && data.backlinks.total > 0) {
    drActions.push("Improve dofollow ratio through quality link building");
  }

  // === Competitor Insights ===

  if (data.project.competitors?.length) {
    competitorInsights.push(
      `Competitors tracked: ${data.project.competitors.join(", ")} — run competitor keyword analysis to find content gaps`
    );
  } else {
    competitorInsights.push(
      "No competitors configured — add competitors to enable gap analysis and benchmarking"
    );
  }

  // === Overall Score ===

  const overallScore = calculateOverallScore(data);

  return {
    generatedAt: new Date().toISOString(),
    overallScore,
    quickWins,
    contentPlan,
    technicalFixes,
    linkBuilding,
    drPlan: {
      currentDR,
      targetDR,
      actions: drActions,
    },
    competitorInsights,
  };
}

function calculateOverallScore(data: AggregatedData): number {
  let score = 50; // start at midpoint

  // Page health (up to +/- 20 points)
  if (data.pages.total > 0) {
    const missingMetaRatio = data.pages.missingDescription / data.pages.total;
    const missingTitleRatio = data.pages.missingTitle / data.pages.total;
    const thinRatio = data.pages.thinContent / data.pages.total;
    const brokenRatio = data.pages.brokenLinks / data.pages.total;

    score -= Math.round(missingMetaRatio * 10);
    score -= Math.round(missingTitleRatio * 10);
    score -= Math.round(thinRatio * 10);
    score -= Math.round(brokenRatio * 10);

    if (data.pages.avgWordCount > 800) score += 5;
    if (missingMetaRatio === 0 && missingTitleRatio === 0) score += 5;
  } else {
    score -= 15; // no data is bad
  }

  // Domain Rating (up to +/- 15 points)
  const dr = data.domainRating.current ?? 0;
  if (dr >= 40) score += 15;
  else if (dr >= 20) score += 8;
  else if (dr >= 10) score += 3;
  else score -= 5;

  // Keywords (up to +/- 10 points)
  if (data.keywords.total > 0) {
    const top10Ratio = data.keywords.top10Count / data.keywords.total;
    score += Math.round(top10Ratio * 10);
  }

  // GSC (up to +/- 5 points)
  if (data.gsc.totalImpressions > 0) {
    if (data.gsc.avgCtr >= 0.05) score += 5;
    else if (data.gsc.avgCtr >= 0.03) score += 2;
  }

  // Backlinks (up to +/- 5 points)
  if (data.backlinks.uniqueDomains >= 50) score += 5;
  else if (data.backlinks.uniqueDomains >= 20) score += 2;

  return Math.max(0, Math.min(100, score));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && pnpm test -- src/__tests__/strategy-rules.test.ts`
Expected: All 9 tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/strategy/rules.ts packages/core/src/__tests__/strategy-rules.test.ts
git commit -m "feat(core): add rule-based fallback strategy engine"
```

---

### Task 6: strategyGenerate Function

**Files:**
- Create: `packages/core/src/strategy/generate.ts`
- Create: `packages/core/src/__tests__/strategy-generate.test.ts`

- [ ] **Step 1: Write the test**

Create `packages/core/src/__tests__/strategy-generate.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm test -- src/__tests__/strategy-generate.test.ts`
Expected: FAIL — module `../strategy/generate.js` not found

- [ ] **Step 3: Write the implementation**

Create `packages/core/src/strategy/generate.ts`:

```typescript
import type Database from "better-sqlite3";
import type { Strategy } from "./types.js";
import { aggregateProjectData } from "./aggregate.js";
import { getLlmConfig, callLlm } from "./llm-client.js";
import { buildStrategyPrompt } from "./prompt.js";
import { parseStrategyResponse } from "./validate.js";
import { generateRuleBasedStrategy } from "./rules.js";

interface ProjectInfo {
  domain: string;
  name: string;
  niche?: string;
  competitors?: string[];
  locale?: string;
}

export async function strategyGenerate(
  db: Database.Database,
  project: ProjectInfo
): Promise<Strategy> {
  const data = aggregateProjectData(db, project);
  let strategy: Strategy;

  const llmConfig = getLlmConfig();

  if (llmConfig) {
    try {
      const { systemPrompt, userPrompt } = buildStrategyPrompt(data);
      const raw = await callLlm(llmConfig, systemPrompt, userPrompt);
      strategy = parseStrategyResponse(raw);
    } catch (error) {
      // Fall back to rule-based if LLM fails
      console.warn(
        `LLM strategy generation failed, using rule-based fallback: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      strategy = generateRuleBasedStrategy(data);
    }
  } else {
    strategy = generateRuleBasedStrategy(data);
  }

  // Store in database
  storeStrategy(db, strategy);

  return strategy;
}

export function storeStrategy(db: Database.Database, strategy: Strategy): void {
  db.prepare(
    "INSERT INTO strategies (strategy, generated_at) VALUES (?, ?)"
  ).run(JSON.stringify(strategy), strategy.generatedAt);
}

export function getLatestStrategy(db: Database.Database): Strategy | null {
  const row = db
    .prepare("SELECT strategy FROM strategies ORDER BY id DESC LIMIT 1")
    .get() as { strategy: string } | undefined;

  if (!row) return null;
  return JSON.parse(row.strategy) as Strategy;
}

export function getAllStrategies(db: Database.Database): Strategy[] {
  const rows = db
    .prepare("SELECT strategy FROM strategies ORDER BY id DESC")
    .all() as { strategy: string }[];

  return rows.map((r) => JSON.parse(r.strategy) as Strategy);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && pnpm test -- src/__tests__/strategy-generate.test.ts`
Expected: All 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/strategy/generate.ts packages/core/src/__tests__/strategy-generate.test.ts
git commit -m "feat(core): add strategyGenerate with LLM and rule-based fallback"
```

---

### Task 7: strategyRefresh Function

**Files:**
- Create: `packages/core/src/strategy/refresh.ts`
- Create: `packages/core/src/__tests__/strategy-refresh.test.ts`

- [ ] **Step 1: Write the test**

Create `packages/core/src/__tests__/strategy-refresh.test.ts`:

```typescript
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

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "seoagent-refresh-test-"));
    dbPath = path.join(tmpDir, "seoagent.db");
    vi.clearAllMocks();

    // Re-apply mock return value after clearAllMocks
    const { getLlmConfig } = require("../strategy/llm-client.js");
    getLlmConfig.mockReturnValue(null);
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm test -- src/__tests__/strategy-refresh.test.ts`
Expected: FAIL — module `../strategy/refresh.js` not found

- [ ] **Step 3: Write the implementation**

Create `packages/core/src/strategy/refresh.ts`:

```typescript
import type Database from "better-sqlite3";
import type { Strategy, StrategyDiff, StrategyRefreshResult } from "./types.js";
import { strategyGenerate, getLatestStrategy } from "./generate.js";

interface ProjectInfo {
  domain: string;
  name: string;
  niche?: string;
  competitors?: string[];
  locale?: string;
}

export async function strategyRefresh(
  db: Database.Database,
  project: ProjectInfo
): Promise<StrategyRefreshResult> {
  const previous = getLatestStrategy(db);
  const strategy = await strategyGenerate(db, project);
  const diff = diffStrategies(previous, strategy);

  return { strategy, diff };
}

function diffStrategies(
  previous: Strategy | null,
  current: Strategy
): StrategyDiff {
  if (!previous) {
    return {
      previousScore: 0,
      currentScore: current.overallScore,
      improvements: [],
      regressions: [],
      newQuickWins: current.quickWins.length,
      resolvedQuickWins: 0,
    };
  }

  const improvements: string[] = [];
  const regressions: string[] = [];

  // Score change
  const scoreDelta = current.overallScore - previous.overallScore;
  if (scoreDelta > 0) {
    improvements.push(
      `Overall SEO score improved from ${previous.overallScore} to ${current.overallScore} (+${scoreDelta})`
    );
  } else if (scoreDelta < 0) {
    regressions.push(
      `Overall SEO score dropped from ${previous.overallScore} to ${current.overallScore} (${scoreDelta})`
    );
  }

  // DR change
  if (current.drPlan.currentDR > previous.drPlan.currentDR) {
    improvements.push(
      `Domain Rating improved from ${previous.drPlan.currentDR} to ${current.drPlan.currentDR}`
    );
  } else if (current.drPlan.currentDR < previous.drPlan.currentDR) {
    regressions.push(
      `Domain Rating dropped from ${previous.drPlan.currentDR} to ${current.drPlan.currentDR}`
    );
  }

  // Quick wins resolved: actions in previous but not in current
  const previousActions = new Set(previous.quickWins.map((w) => w.action));
  const currentActions = new Set(current.quickWins.map((w) => w.action));

  const resolvedActions = [...previousActions].filter((a) => !currentActions.has(a));
  const newActions = [...currentActions].filter((a) => !previousActions.has(a));

  if (resolvedActions.length > 0) {
    improvements.push(
      `Resolved ${resolvedActions.length} quick win(s) from previous strategy`
    );
  }

  if (newActions.length > 0 && previous.quickWins.length > 0) {
    // Only flag as regression if there were already items and new ones appeared
    // This might just mean new issues were discovered, not necessarily regression
  }

  // Technical fixes resolved
  const prevFixCount = previous.technicalFixes.length;
  const currFixCount = current.technicalFixes.length;
  if (currFixCount < prevFixCount) {
    improvements.push(
      `Technical issues reduced from ${prevFixCount} to ${currFixCount}`
    );
  } else if (currFixCount > prevFixCount) {
    regressions.push(
      `Technical issues increased from ${prevFixCount} to ${currFixCount}`
    );
  }

  return {
    previousScore: previous.overallScore,
    currentScore: current.overallScore,
    improvements,
    regressions,
    newQuickWins: newActions.length,
    resolvedQuickWins: resolvedActions.length,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && pnpm test -- src/__tests__/strategy-refresh.test.ts`
Expected: All 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/strategy/refresh.ts packages/core/src/__tests__/strategy-refresh.test.ts
git commit -m "feat(core): add strategyRefresh with diff against previous strategy"
```

---

### Task 8: Barrel Exports

**Files:**
- Create: `packages/core/src/strategy/index.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Create strategy barrel**

Create `packages/core/src/strategy/index.ts`:

```typescript
export type {
  Strategy,
  ActionItem,
  ContentItem,
  AuditFix,
  LinkTactic,
  StrategyDiff,
  StrategyRefreshResult,
  AggregatedData,
  LlmConfig,
} from "./types.js";

export { aggregateProjectData } from "./aggregate.js";
export { getLlmConfig, callLlm } from "./llm-client.js";
export { buildStrategyPrompt } from "./prompt.js";
export { strategySchema, parseStrategyResponse } from "./validate.js";
export { generateRuleBasedStrategy } from "./rules.js";
export { strategyGenerate, storeStrategy, getLatestStrategy, getAllStrategies } from "./generate.js";
export { strategyRefresh } from "./refresh.js";
```

- [ ] **Step 2: Update core barrel**

Add to the end of `packages/core/src/index.ts`:

```typescript
// Strategy Engine
export {
  type Strategy,
  type ActionItem,
  type ContentItem,
  type AuditFix,
  type LinkTactic,
  type StrategyDiff,
  type StrategyRefreshResult,
  type AggregatedData,
  type LlmConfig,
  aggregateProjectData,
  getLlmConfig,
  callLlm,
  buildStrategyPrompt,
  strategySchema,
  parseStrategyResponse,
  generateRuleBasedStrategy,
  strategyGenerate,
  storeStrategy,
  getLatestStrategy,
  getAllStrategies,
  strategyRefresh,
} from "./strategy/index.js";
```

- [ ] **Step 3: Verify build**

Run: `cd packages/core && pnpm build`
Expected: No TypeScript errors, `dist/` updated

- [ ] **Step 4: Run all strategy tests**

Run: `cd packages/core && pnpm test -- src/__tests__/strategy`
Expected: All strategy tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/strategy/index.ts packages/core/src/index.ts
git commit -m "feat(core): export strategy engine from barrel"
```
