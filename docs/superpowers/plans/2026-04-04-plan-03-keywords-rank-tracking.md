# Keyword Research & Rank Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement keyword research, keyword suggestions, and rank tracking powered by a DataForSEO adapter behind the `SearchDataProvider` interface, with SERP caching and position history stored in SQLite.

**Architecture:** The `SearchDataProvider` interface (defined in Plan 1 `types.ts`) is implemented by `DataForSeoProvider` in a new `providers/` directory. A SERP cache layer sits between consumers and the provider — checking `serp_cache` before making API calls. Keyword research and rank tracking functions are standalone modules that accept a database handle and provider instance, keeping them testable and decoupled.

**Tech Stack:** undici (HTTP), better-sqlite3 (storage), vitest (testing), DataForSEO REST API v3

---

## File Structure

```
packages/core/src/
├── providers/
│   └── dataforseo.ts            # DataForSeoProvider implements SearchDataProvider
├── serp-cache.ts                # SERP cache read/write with TTL
├── keyword-research.ts          # keywordResearch(), keywordSuggestions()
├── rank-tracker.ts              # rankTrackAdd/Check/History/Report
├── __tests__/
│   ├── dataforseo.test.ts       # Provider unit tests (mocked HTTP)
│   ├── serp-cache.test.ts       # Cache layer tests
│   ├── keyword-research.test.ts # Keyword research tests
│   └── rank-tracker.test.ts     # Rank tracking tests
└── index.ts                     # Updated barrel exports
```

---

### Task 1: DataForSEO Provider

**Files:**
- Create: `packages/core/src/providers/dataforseo.ts`
- Create: `packages/core/src/__tests__/dataforseo.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/__tests__/dataforseo.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DataForSeoProvider } from "../providers/dataforseo.js";

// Mock undici at module level
vi.mock("undici", () => ({
  request: vi.fn(),
}));

import { request } from "undici";

const mockRequest = vi.mocked(request);

function mockResponse(body: unknown) {
  return {
    statusCode: 200,
    body: {
      json: () => Promise.resolve(body),
    },
  };
}

describe("DataForSeoProvider", () => {
  let provider: DataForSeoProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new DataForSeoProvider("test-login", "test-password");
  });

  it("sends correct auth header", async () => {
    mockRequest.mockResolvedValueOnce(
      mockResponse({
        tasks: [{ result: [{ items: [] }] }],
      }) as never
    );

    await provider.getKeywordVolume(["test"], "en-US");

    expect(mockRequest).toHaveBeenCalledTimes(1);
    const callArgs = mockRequest.mock.calls[0];
    expect(callArgs[0]).toBe(
      "https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live"
    );
    const options = callArgs[1] as Record<string, unknown>;
    const headers = options.headers as Record<string, string>;
    const expected = Buffer.from("test-login:test-password").toString("base64");
    expect(headers["Authorization"]).toBe(`Basic ${expected}`);
  });

  it("getKeywordVolume returns parsed keyword data", async () => {
    mockRequest.mockResolvedValueOnce(
      mockResponse({
        tasks: [
          {
            result: [
              {
                items: [
                  {
                    keyword: "seo tools",
                    search_volume: 12000,
                    keyword_info: {
                      search_volume: 12000,
                    },
                    competition: 0.65,
                    cpc: 3.5,
                    keyword_properties: {
                      keyword_difficulty: 72,
                    },
                  },
                ],
              },
            ],
          },
        ],
      }) as never
    );

    const results = await provider.getKeywordVolume(["seo tools"], "en-US");

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      keyword: "seo tools",
      volume: 12000,
      difficulty: 72,
      cpc: 3.5,
      competition: 0.65,
    });
  });

  it("getSerpResults returns parsed SERP data", async () => {
    mockRequest.mockResolvedValueOnce(
      mockResponse({
        tasks: [
          {
            result: [
              {
                items: [
                  {
                    type: "organic",
                    rank_absolute: 1,
                    url: "https://example.com/page",
                    title: "Example Page",
                    description: "A description",
                    domain: "example.com",
                  },
                  {
                    type: "paid",
                    rank_absolute: 0,
                    url: "https://ad.com",
                    title: "Ad",
                    description: "Ad desc",
                    domain: "ad.com",
                  },
                  {
                    type: "organic",
                    rank_absolute: 2,
                    url: "https://other.com",
                    title: "Other",
                    description: "Other desc",
                    domain: "other.com",
                  },
                ],
              },
            ],
          },
        ],
      }) as never
    );

    const results = await provider.getSerpResults("seo tools", "en-US");

    // Should only include organic results
    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({
      position: 1,
      url: "https://example.com/page",
      title: "Example Page",
      description: "A description",
      domain: "example.com",
    });
  });

  it("getKeywordSuggestions returns keyword strings", async () => {
    mockRequest.mockResolvedValueOnce(
      mockResponse({
        tasks: [
          {
            result: [
              {
                items: [
                  { keyword: "seo tools free" },
                  { keyword: "best seo tools" },
                  { keyword: "seo tools for beginners" },
                ],
              },
            ],
          },
        ],
      }) as never
    );

    const results = await provider.getKeywordSuggestions("seo tools", "en-US");

    expect(results).toEqual([
      "seo tools free",
      "best seo tools",
      "seo tools for beginners",
    ]);
  });

  it("throws on API error response", async () => {
    mockRequest.mockResolvedValueOnce(
      mockResponse({
        tasks: [
          {
            status_code: 40000,
            status_message: "Invalid API credentials",
            result: null,
          },
        ],
      }) as never
    );

    await expect(
      provider.getKeywordVolume(["test"], "en-US")
    ).rejects.toThrow(/Invalid API credentials/);
  });

  it("throws on HTTP error", async () => {
    mockRequest.mockResolvedValueOnce({
      statusCode: 401,
      body: {
        json: () => Promise.resolve({ status_message: "Unauthorized" }),
      },
    } as never);

    await expect(
      provider.getKeywordVolume(["test"], "en-US")
    ).rejects.toThrow(/401/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm test -- src/__tests__/dataforseo.test.ts`
Expected: FAIL — module `../providers/dataforseo.js` not found

- [ ] **Step 3: Write the implementation**

Create `packages/core/src/providers/dataforseo.ts`:

```typescript
import { request } from "undici";
import type { SearchDataProvider, KeywordData, SerpResult } from "../types.js";

const BASE_URL = "https://api.dataforseo.com/v3";

export class DataForSeoProvider implements SearchDataProvider {
  private authHeader: string;

  constructor(login: string, password: string) {
    this.authHeader = `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`;
  }

  async getKeywordVolume(
    keywords: string[],
    locale: string
  ): Promise<KeywordData[]> {
    const [language, country] = parseLocale(locale);
    const body = [
      {
        keywords,
        language_code: language,
        location_code: countryToLocationCode(country),
      },
    ];

    const data = await this.post(
      "/keywords_data/google_ads/search_volume/live",
      body
    );

    const items = extractItems(data);
    return items.map((item: Record<string, unknown>) => ({
      keyword: item.keyword as string,
      volume: (item.search_volume as number) ?? 0,
      difficulty:
        ((item.keyword_properties as Record<string, unknown>)
          ?.keyword_difficulty as number) ?? 0,
      cpc: (item.cpc as number) ?? 0,
      competition: (item.competition as number) ?? 0,
    }));
  }

  async getSerpResults(
    keyword: string,
    locale: string
  ): Promise<SerpResult[]> {
    const [language, country] = parseLocale(locale);
    const body = [
      {
        keyword,
        language_code: language,
        location_code: countryToLocationCode(country),
      },
    ];

    const data = await this.post(
      "/serp/google/organic/live/regular",
      body
    );

    const items = extractItems(data);
    return items
      .filter((item: Record<string, unknown>) => item.type === "organic")
      .map((item: Record<string, unknown>) => ({
        position: item.rank_absolute as number,
        url: item.url as string,
        title: (item.title as string) ?? "",
        description: (item.description as string) ?? "",
        domain: item.domain as string,
      }));
  }

  async getKeywordSuggestions(
    seed: string,
    locale: string
  ): Promise<string[]> {
    const [language, country] = parseLocale(locale);
    const body = [
      {
        keywords: [seed],
        language_code: language,
        location_code: countryToLocationCode(country),
      },
    ];

    const data = await this.post(
      "/keywords_data/google_ads/keywords_for_keywords/live",
      body
    );

    const items = extractItems(data);
    return items.map((item: Record<string, unknown>) => item.keyword as string);
  }

  async getCompetitorKeywords(
    domain: string,
    locale: string
  ): Promise<KeywordData[]> {
    const [language, country] = parseLocale(locale);
    const body = [
      {
        target1: domain,
        language_code: language,
        location_code: countryToLocationCode(country),
        limit: 100,
      },
    ];

    const data = await this.post(
      "/dataforseo_labs/google/domain_intersection/live",
      body
    );

    const items = extractItems(data);
    return items.map((item: Record<string, unknown>) => ({
      keyword: item.keyword as string,
      volume: (item.search_volume as number) ?? 0,
      difficulty: (item.keyword_difficulty as number) ?? 0,
      cpc: (item.cpc as number) ?? 0,
      competition: (item.competition as number) ?? 0,
    }));
  }

  private async post(
    endpoint: string,
    body: unknown
  ): Promise<unknown> {
    const response = await request(`${BASE_URL}${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: this.authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (response.statusCode !== 200) {
      throw new Error(
        `DataForSEO API error: HTTP ${response.statusCode}`
      );
    }

    const data = (await response.body.json()) as Record<string, unknown>;
    return data;
  }
}

function extractItems(data: unknown): Record<string, unknown>[] {
  const root = data as Record<string, unknown>;
  const tasks = root.tasks as Record<string, unknown>[];

  if (!tasks || tasks.length === 0) {
    return [];
  }

  const task = tasks[0];

  if (task.status_code && task.status_code !== 20000) {
    throw new Error(
      `DataForSEO task error: ${task.status_message as string}`
    );
  }

  const results = task.result as Record<string, unknown>[];
  if (!results || results.length === 0) {
    return [];
  }

  const items = results[0].items as Record<string, unknown>[];
  return items ?? [];
}

function parseLocale(locale: string): [string, string] {
  const parts = locale.split("-");
  return [parts[0], parts[1] ?? "US"];
}

const LOCATION_CODES: Record<string, number> = {
  US: 2840,
  GB: 2826,
  CA: 2124,
  AU: 2036,
  DE: 2276,
  FR: 2250,
  ES: 2724,
  IT: 2380,
  BR: 2076,
  IN: 2356,
  JP: 2392,
  MX: 2484,
  NL: 2528,
  SE: 2752,
  NO: 2578,
  DK: 2208,
  FI: 2246,
  PT: 2620,
  PL: 2616,
  IE: 2372,
};

function countryToLocationCode(country: string): number {
  return LOCATION_CODES[country.toUpperCase()] ?? 2840;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && pnpm test -- src/__tests__/dataforseo.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/providers/dataforseo.ts packages/core/src/__tests__/dataforseo.test.ts
git commit -m "feat(core): add DataForSEO provider implementing SearchDataProvider"
```

---

### Task 2: SERP Cache Layer

**Files:**
- Create: `packages/core/src/serp-cache.ts`
- Create: `packages/core/src/__tests__/serp-cache.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/__tests__/serp-cache.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { openDatabase, closeDatabase } from "../database.js";
import {
  getCachedSerp,
  setCachedSerp,
  isCacheFresh,
} from "../serp-cache.js";
import type { SerpResult } from "../types.js";
import type Database from "better-sqlite3";

describe("serp-cache", () => {
  let tmpDir: string;
  let db: Database.Database;

  const sampleResults: SerpResult[] = [
    {
      position: 1,
      url: "https://example.com",
      title: "Example",
      description: "An example page",
      domain: "example.com",
    },
    {
      position: 2,
      url: "https://other.com",
      title: "Other",
      description: "Another page",
      domain: "other.com",
    },
  ];

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "seoagent-cache-test-"));
    db = openDatabase(path.join(tmpDir, "seoagent.db"));
  });

  afterEach(() => {
    closeDatabase(db);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns null when no cache entry exists", () => {
    const result = getCachedSerp(db, "nonexistent", "en-US");
    expect(result).toBeNull();
  });

  it("stores and retrieves cached SERP results", () => {
    setCachedSerp(db, "seo tools", "en-US", sampleResults);
    const cached = getCachedSerp(db, "seo tools", "en-US");

    expect(cached).not.toBeNull();
    expect(cached!.results).toHaveLength(2);
    expect(cached!.results[0].url).toBe("https://example.com");
  });

  it("distinguishes cache by locale", () => {
    setCachedSerp(db, "seo tools", "en-US", sampleResults);
    const cached = getCachedSerp(db, "seo tools", "en-GB");
    expect(cached).toBeNull();
  });

  it("overwrites stale cache on re-insert", () => {
    setCachedSerp(db, "seo tools", "en-US", sampleResults);
    const updated: SerpResult[] = [
      {
        position: 1,
        url: "https://new.com",
        title: "New",
        description: "New page",
        domain: "new.com",
      },
    ];
    setCachedSerp(db, "seo tools", "en-US", updated);

    const cached = getCachedSerp(db, "seo tools", "en-US");
    expect(cached!.results).toHaveLength(1);
    expect(cached!.results[0].url).toBe("https://new.com");
  });

  it("isCacheFresh returns true for recent entries", () => {
    const now = new Date().toISOString();
    expect(isCacheFresh(now, 24)).toBe(true);
  });

  it("isCacheFresh returns false for old entries", () => {
    const old = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    expect(isCacheFresh(old, 24)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm test -- src/__tests__/serp-cache.test.ts`
Expected: FAIL — module `../serp-cache.js` not found

- [ ] **Step 3: Write the implementation**

Create `packages/core/src/serp-cache.ts`:

```typescript
import type Database from "better-sqlite3";
import type { SerpResult } from "./types.js";

export interface CachedSerp {
  results: SerpResult[];
  fetchedAt: string;
}

export function getCachedSerp(
  db: Database.Database,
  keyword: string,
  locale: string
): CachedSerp | null {
  const row = db
    .prepare(
      "SELECT results, fetched_at FROM serp_cache WHERE keyword = ? AND locale = ?"
    )
    .get(keyword, locale) as
    | { results: string; fetched_at: string }
    | undefined;

  if (!row) return null;

  return {
    results: JSON.parse(row.results) as SerpResult[],
    fetchedAt: row.fetched_at,
  };
}

export function setCachedSerp(
  db: Database.Database,
  keyword: string,
  locale: string,
  results: SerpResult[]
): void {
  db.prepare(
    `INSERT INTO serp_cache (keyword, locale, results, fetched_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(keyword, locale) DO UPDATE SET
       results = excluded.results,
       fetched_at = excluded.fetched_at`
  ).run(keyword, locale, JSON.stringify(results));
}

export function isCacheFresh(
  fetchedAt: string,
  maxAgeHours: number
): boolean {
  const fetchedTime = new Date(fetchedAt).getTime();
  const cutoff = Date.now() - maxAgeHours * 60 * 60 * 1000;
  return fetchedTime > cutoff;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && pnpm test -- src/__tests__/serp-cache.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/serp-cache.ts packages/core/src/__tests__/serp-cache.test.ts
git commit -m "feat(core): add SERP cache layer with TTL"
```

---

### Task 3: Keyword Research Function

**Files:**
- Create: `packages/core/src/keyword-research.ts`
- Create: `packages/core/src/__tests__/keyword-research.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/__tests__/keyword-research.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm test -- src/__tests__/keyword-research.test.ts`
Expected: FAIL — module `../keyword-research.js` not found

- [ ] **Step 3: Write the implementation**

Create `packages/core/src/keyword-research.ts`:

```typescript
import type Database from "better-sqlite3";
import type { SearchDataProvider, KeywordData } from "./types.js";

export async function keywordResearch(
  db: Database.Database,
  provider: SearchDataProvider,
  keywords: string[],
  locale: string
): Promise<KeywordData[]> {
  const results = await provider.getKeywordVolume(keywords, locale);

  const upsert = db.prepare(`
    INSERT INTO keywords (keyword, locale, volume, difficulty, cpc)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(keyword, locale) DO UPDATE SET
      volume = excluded.volume,
      difficulty = excluded.difficulty,
      cpc = excluded.cpc,
      updated_at = datetime('now')
  `);

  const upsertMany = db.transaction((items: KeywordData[]) => {
    for (const item of items) {
      upsert.run(
        item.keyword,
        locale,
        item.volume,
        item.difficulty,
        item.cpc ?? 0
      );
    }
  });

  upsertMany(results);

  return results;
}

export async function keywordSuggestions(
  db: Database.Database,
  provider: SearchDataProvider,
  seed: string,
  locale: string,
  limit?: number
): Promise<string[]> {
  let suggestions = await provider.getKeywordSuggestions(seed, locale);

  if (limit !== undefined) {
    suggestions = suggestions.slice(0, limit);
  }

  // Store suggestions in the keywords table (volume unknown at this point)
  const upsert = db.prepare(`
    INSERT INTO keywords (keyword, locale)
    VALUES (?, ?)
    ON CONFLICT(keyword, locale) DO NOTHING
  `);

  const insertMany = db.transaction((items: string[]) => {
    for (const keyword of items) {
      upsert.run(keyword, locale);
    }
  });

  insertMany(suggestions);

  return suggestions;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && pnpm test -- src/__tests__/keyword-research.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/keyword-research.ts packages/core/src/__tests__/keyword-research.test.ts
git commit -m "feat(core): add keywordResearch and keywordSuggestions functions"
```

---

### Task 4: Rank Tracker — Add Keywords

**Files:**
- Create: `packages/core/src/rank-tracker.ts`
- Create: `packages/core/src/__tests__/rank-tracker.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/__tests__/rank-tracker.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm test -- src/__tests__/rank-tracker.test.ts`
Expected: FAIL — module `../rank-tracker.js` not found

- [ ] **Step 3: Write the implementation**

Create `packages/core/src/rank-tracker.ts`:

```typescript
import type Database from "better-sqlite3";
import type { SearchDataProvider, SerpResult } from "./types.js";
import { getCachedSerp, setCachedSerp, isCacheFresh } from "./serp-cache.js";

export interface RankCheckResult {
  keyword: string;
  position: number | null;
  url: string | null;
}

export interface PositionHistoryEntry {
  position: number | null;
  url: string | null;
  checkedAt: string;
}

export interface RankMover {
  keyword: string;
  previousPosition: number | null;
  currentPosition: number | null;
  change: number;
}

export interface RankReport {
  up: RankMover[];
  down: RankMover[];
  new: RankMover[];
  lost: RankMover[];
}

export function rankTrackAdd(
  db: Database.Database,
  keywords: string[],
  locale: string
): void {
  const upsert = db.prepare(`
    INSERT INTO keywords (keyword, locale, tracked)
    VALUES (?, ?, 1)
    ON CONFLICT(keyword, locale) DO UPDATE SET
      tracked = 1,
      updated_at = datetime('now')
  `);

  const insertMany = db.transaction((items: string[]) => {
    for (const keyword of items) {
      upsert.run(keyword, locale);
    }
  });

  insertMany(keywords);
}

export async function rankTrackCheck(
  db: Database.Database,
  provider: SearchDataProvider,
  domain: string,
  locale: string
): Promise<RankCheckResult[]> {
  const tracked = db
    .prepare(
      "SELECT id, keyword FROM keywords WHERE tracked = 1 AND locale = ?"
    )
    .all(locale) as { id: number; keyword: string }[];

  const results: RankCheckResult[] = [];

  const insertHistory = db.prepare(`
    INSERT INTO rank_history (keyword_id, position, url)
    VALUES (?, ?, ?)
  `);

  const updatePosition = db.prepare(`
    UPDATE keywords SET current_position = ?, updated_at = datetime('now')
    WHERE id = ?
  `);

  for (const { id, keyword } of tracked) {
    const serp = await getSerpWithCache(db, provider, keyword, locale);

    // Find domain in SERP results
    const match = serp.find((r) =>
      r.domain === domain || r.domain.endsWith(`.${domain}`)
    );

    const position = match?.position ?? null;
    const url = match?.url ?? null;

    insertHistory.run(id, position, url);
    updatePosition.run(position, id);

    results.push({ keyword, position, url });
  }

  return results;
}

export function rankTrackHistory(
  db: Database.Database,
  keyword: string,
  locale: string
): PositionHistoryEntry[] {
  const keywordRow = db
    .prepare("SELECT id FROM keywords WHERE keyword = ? AND locale = ?")
    .get(keyword, locale) as { id: number } | undefined;

  if (!keywordRow) return [];

  const rows = db
    .prepare(
      `SELECT position, url, checked_at
       FROM rank_history
       WHERE keyword_id = ?
       ORDER BY checked_at ASC`
    )
    .all(keywordRow.id) as {
    position: number | null;
    url: string | null;
    checked_at: string;
  }[];

  return rows.map((r) => ({
    position: r.position,
    url: r.url,
    checkedAt: r.checked_at,
  }));
}

export function rankTrackReport(
  db: Database.Database,
  locale: string
): RankReport {
  // Get all tracked keywords with at least one history entry
  const tracked = db
    .prepare(
      `SELECT k.id, k.keyword
       FROM keywords k
       WHERE k.tracked = 1 AND k.locale = ?`
    )
    .all(locale) as { id: number; keyword: string }[];

  const report: RankReport = {
    up: [],
    down: [],
    new: [],
    lost: [],
  };

  for (const { id, keyword } of tracked) {
    // Get the two most recent history entries
    const entries = db
      .prepare(
        `SELECT position, url, checked_at
         FROM rank_history
         WHERE keyword_id = ?
         ORDER BY checked_at DESC
         LIMIT 2`
      )
      .all(id) as {
      position: number | null;
      url: string | null;
      checked_at: string;
    }[];

    if (entries.length < 2) continue;

    const current = entries[0].position;
    const previous = entries[1].position;

    if (previous === null && current !== null) {
      // New entry — was not ranking, now ranking
      report.new.push({
        keyword,
        previousPosition: null,
        currentPosition: current,
        change: 0,
      });
    } else if (previous !== null && current === null) {
      // Lost — was ranking, now not
      report.lost.push({
        keyword,
        previousPosition: previous,
        currentPosition: null,
        change: 0,
      });
    } else if (previous !== null && current !== null) {
      const change = previous - current; // positive = improved

      if (change > 0) {
        report.up.push({
          keyword,
          previousPosition: previous,
          currentPosition: current,
          change,
        });
      } else if (change < 0) {
        report.down.push({
          keyword,
          previousPosition: previous,
          currentPosition: current,
          change,
        });
      }
      // If change === 0, no movement — skip
    }
  }

  // Sort: biggest movers first
  report.up.sort((a, b) => b.change - a.change);
  report.down.sort((a, b) => a.change - b.change);

  return report;
}

async function getSerpWithCache(
  db: Database.Database,
  provider: SearchDataProvider,
  keyword: string,
  locale: string
): Promise<SerpResult[]> {
  const cached = getCachedSerp(db, keyword, locale);

  if (cached && isCacheFresh(cached.fetchedAt, 24)) {
    return cached.results;
  }

  const results = await provider.getSerpResults(keyword, locale);
  setCachedSerp(db, keyword, locale, results);
  return results;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && pnpm test -- src/__tests__/rank-tracker.test.ts`
Expected: All 12 tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/rank-tracker.ts packages/core/src/__tests__/rank-tracker.test.ts
git commit -m "feat(core): add rank tracking (add, check, history, report)"
```

---

### Task 5: Export from Barrel and Run Full Suite

**Files:**
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Update barrel exports**

Add the following to `packages/core/src/index.ts`:

```typescript
// Providers
export { DataForSeoProvider } from "./providers/dataforseo.js";

// SERP Cache
export { getCachedSerp, setCachedSerp, isCacheFresh } from "./serp-cache.js";
export type { CachedSerp } from "./serp-cache.js";

// Keyword Research
export { keywordResearch, keywordSuggestions } from "./keyword-research.js";

// Rank Tracking
export {
  rankTrackAdd,
  rankTrackCheck,
  rankTrackHistory,
  rankTrackReport,
} from "./rank-tracker.js";
export type {
  RankCheckResult,
  PositionHistoryEntry,
  RankMover,
  RankReport,
} from "./rank-tracker.js";
```

- [ ] **Step 2: Run all tests from core package**

Run: `cd packages/core && pnpm test`
Expected: All tests pass — dataforseo (6), serp-cache (6), keyword-research (6), rank-tracker (12) = 30 new tests + 23 existing = 53 total

- [ ] **Step 3: Run full build from root**

Run: `pnpm build`
Expected: All packages compile without errors

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/index.ts
git commit -m "feat(core): export keyword research and rank tracking from barrel"
```

---

### Task 6: Verify Integration — Provider Factory Helper

**Files:**
- Create: `packages/core/src/provider-factory.ts`
- Create: `packages/core/src/__tests__/provider-factory.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/__tests__/provider-factory.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createProvider } from "../provider-factory.js";
import { DataForSeoProvider } from "../providers/dataforseo.js";

describe("createProvider", () => {
  let tmpDir: string;
  const originalEnv = process.env;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "seoagent-factory-test-")
    );
    process.env = { ...originalEnv, SEOAGENT_HOME: tmpDir };
  });

  afterEach(() => {
    process.env = originalEnv;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("throws when no dataforseo credentials configured", () => {
    // Config dir exists but no config.json
    fs.mkdirSync(tmpDir, { recursive: true });
    expect(() => createProvider()).toThrow(/dataforseo.login/);
  });

  it("returns DataForSeoProvider when credentials are set", () => {
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, "config.json"),
      JSON.stringify({
        dataforseo: {
          login: "my-login",
          password: "my-pass",
        },
      })
    );

    const provider = createProvider();
    expect(provider).toBeInstanceOf(DataForSeoProvider);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm test -- src/__tests__/provider-factory.test.ts`
Expected: FAIL — module `../provider-factory.js` not found

- [ ] **Step 3: Write the implementation**

Create `packages/core/src/provider-factory.ts`:

```typescript
import { getConfigValue } from "./config.js";
import { DataForSeoProvider } from "./providers/dataforseo.js";
import type { SearchDataProvider } from "./types.js";

export function createProvider(): SearchDataProvider {
  const login = getConfigValue("dataforseo.login") as string | undefined;
  const password = getConfigValue("dataforseo.password") as
    | string
    | undefined;

  if (!login || !password) {
    throw new Error(
      "DataForSEO credentials not configured. Run: seoagent config set dataforseo.login <login> && seoagent config set dataforseo.password <password>"
    );
  }

  return new DataForSeoProvider(login, password);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && pnpm test -- src/__tests__/provider-factory.test.ts`
Expected: All 2 tests PASS

- [ ] **Step 5: Export from barrel**

Add to `packages/core/src/index.ts`:

```typescript
// Provider Factory
export { createProvider } from "./provider-factory.js";
```

- [ ] **Step 6: Run all tests and build**

Run: `cd packages/core && pnpm test && cd ../.. && pnpm build`
Expected: All 55 tests pass, build succeeds

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/provider-factory.ts packages/core/src/__tests__/provider-factory.test.ts packages/core/src/index.ts
git commit -m "feat(core): add provider factory for SearchDataProvider instantiation"
```
