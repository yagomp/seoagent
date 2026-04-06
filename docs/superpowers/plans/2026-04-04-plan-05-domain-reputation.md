# Domain Reputation & Backlinks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement domain reputation scoring, backlink profile analysis, DR history tracking, and backlink opportunity discovery using DataForSEO backlink endpoints.

**Architecture:** All functions live in `packages/core/src/backlinks.ts` with a low-level DataForSEO HTTP helper in `packages/core/src/dataforseo.ts` (shared across plans). Each `domainReputation()` call persists a snapshot to the `dr_history` SQLite table. Backlink data is stored in the `backlinks` table. All functions accept a `db` handle from `openDatabase()` and return structured objects.

**Tech Stack:** TypeScript, Vitest, better-sqlite3, undici (HTTP), DataForSEO REST API

---

## File Structure

```
packages/core/src/
├── dataforseo.ts                              # Shared DataForSEO HTTP client (may already exist from Plan 3)
├── backlinks.ts                               # domainReputation, backlinkProfile, backlinkOpportunities, domainReputationHistory
├── __tests__/
│   ├── dataforseo.test.ts                     # Tests for HTTP client (may already exist from Plan 3)
│   └── backlinks.test.ts                      # Tests for all backlink functions
└── index.ts                                   # Barrel — add new exports
```

---

### Task 1: DataForSEO HTTP Client

> Skip this task if `packages/core/src/dataforseo.ts` already exists from Plan 3. If it exists, read it and verify it exports `dataforseoRequest`. If so, proceed to Task 2.

**Files:**
- Create: `packages/core/src/dataforseo.ts`
- Create: `packages/core/src/__tests__/dataforseo.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/__tests__/dataforseo.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { dataforseoRequest } from "../dataforseo.js";

// Mock undici globally
vi.mock("undici", () => ({
  request: vi.fn(),
}));

import { request } from "undici";

describe("dataforseoRequest", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      SEOAGENT_HOME: "/tmp/seoagent-test-dfs",
    };
    vi.resetAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("sends POST with basic auth and returns parsed body", async () => {
    const mockResponse = {
      statusCode: 200,
      body: {
        json: vi.fn().mockResolvedValue({
          status_code: 20000,
          tasks: [{ result: [{ items: [] }] }],
        }),
      },
    };
    vi.mocked(request).mockResolvedValue(mockResponse as never);

    const result = await dataforseoRequest(
      "/backlinks/summary/live",
      [{ target: "example.com" }],
      { login: "testlogin", password: "testpass" }
    );

    expect(request).toHaveBeenCalledWith(
      "https://api.dataforseo.com/v3/backlinks/summary/live",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: expect.stringContaining("Basic"),
          "Content-Type": "application/json",
        }),
      })
    );

    expect(result.tasks).toBeDefined();
    expect(result.tasks[0].result[0].items).toEqual([]);
  });

  it("throws on non-200 status code", async () => {
    const mockResponse = {
      statusCode: 401,
      body: {
        json: vi.fn().mockResolvedValue({ status_message: "Unauthorized" }),
      },
    };
    vi.mocked(request).mockResolvedValue(mockResponse as never);

    await expect(
      dataforseoRequest(
        "/backlinks/summary/live",
        [{ target: "example.com" }],
        { login: "testlogin", password: "testpass" }
      )
    ).rejects.toThrow(/DataForSEO API error/);
  });

  it("throws on API-level error status", async () => {
    const mockResponse = {
      statusCode: 200,
      body: {
        json: vi.fn().mockResolvedValue({
          status_code: 40000,
          status_message: "Bad request",
        }),
      },
    };
    vi.mocked(request).mockResolvedValue(mockResponse as never);

    await expect(
      dataforseoRequest(
        "/backlinks/summary/live",
        [{ target: "example.com" }],
        { login: "testlogin", password: "testpass" }
      )
    ).rejects.toThrow(/Bad request/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm test -- src/__tests__/dataforseo.test.ts`
Expected: FAIL — module `../dataforseo.js` not found

- [ ] **Step 3: Write the implementation**

Create `packages/core/src/dataforseo.ts`:

```typescript
import { request } from "undici";

const BASE_URL = "https://api.dataforseo.com/v3";

export interface DataForSEOCredentials {
  login: string;
  password: string;
}

export interface DataForSEOResponse {
  status_code: number;
  status_message: string;
  tasks: DataForSEOTask[];
}

export interface DataForSEOTask {
  id: string;
  status_code: number;
  status_message: string;
  result: Record<string, unknown>[];
}

export async function dataforseoRequest(
  endpoint: string,
  body: Record<string, unknown>[],
  credentials: DataForSEOCredentials
): Promise<DataForSEOResponse> {
  const auth = Buffer.from(
    `${credentials.login}:${credentials.password}`
  ).toString("base64");

  const response = await request(`${BASE_URL}${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (response.statusCode !== 200) {
    const errorBody = await response.body.json().catch(() => ({}));
    throw new Error(
      `DataForSEO API error (HTTP ${response.statusCode}): ${
        (errorBody as Record<string, unknown>).status_message ?? "Unknown error"
      }`
    );
  }

  const data = (await response.body.json()) as DataForSEOResponse;

  if (data.status_code !== 20000) {
    throw new Error(
      `DataForSEO API error (${data.status_code}): ${data.status_message}`
    );
  }

  return data;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && pnpm test -- src/__tests__/dataforseo.test.ts`
Expected: All 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/dataforseo.ts packages/core/src/__tests__/dataforseo.test.ts
git commit -m "feat(core): add DataForSEO HTTP client helper"
```

---

### Task 2: domainReputation Function + DR History Storage

**Files:**
- Create: `packages/core/src/backlinks.ts`
- Create: `packages/core/src/__tests__/backlinks.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/__tests__/backlinks.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import Database from "better-sqlite3";
import { openDatabase, closeDatabase } from "../database.js";

// Mock dataforseo module
vi.mock("../dataforseo.js", () => ({
  dataforseoRequest: vi.fn(),
}));

import { dataforseoRequest } from "../dataforseo.js";
import { domainReputation } from "../backlinks.js";

describe("domainReputation", () => {
  let tmpDir: string;
  let db: Database.Database;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "seoagent-bl-test-"));
    db = openDatabase(path.join(tmpDir, "seoagent.db"));
    vi.resetAllMocks();
  });

  afterEach(() => {
    closeDatabase(db);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns domain reputation data from DataForSEO", async () => {
    vi.mocked(dataforseoRequest).mockResolvedValue({
      status_code: 20000,
      status_message: "Ok.",
      tasks: [
        {
          id: "task-1",
          status_code: 20000,
          status_message: "Ok.",
          result: [
            {
              target: "example.com",
              rank: 450,
              backlinks: 12500,
              referring_domains: 340,
              referring_domains_nofollow: 45,
              broken_backlinks: 12,
              referring_ips: 280,
              referring_subnets: 250,
            },
          ],
        },
      ],
    });

    const result = await domainReputation("example.com", db, {
      login: "test",
      password: "test",
    });

    expect(result.domain).toBe("example.com");
    expect(result.domainRating).toBe(450);
    expect(result.totalBacklinks).toBe(12500);
    expect(result.referringDomains).toBe(340);
    expect(result.referringDomainsNofollow).toBe(45);
    expect(result.brokenBacklinks).toBe(12);
    expect(result.referringIps).toBe(280);
    expect(result.referringSubnets).toBe(250);
  });

  it("calls DataForSEO /backlinks/summary/live endpoint", async () => {
    vi.mocked(dataforseoRequest).mockResolvedValue({
      status_code: 20000,
      status_message: "Ok.",
      tasks: [
        {
          id: "task-1",
          status_code: 20000,
          status_message: "Ok.",
          result: [
            {
              target: "example.com",
              rank: 450,
              backlinks: 12500,
              referring_domains: 340,
              referring_domains_nofollow: 0,
              broken_backlinks: 0,
              referring_ips: 0,
              referring_subnets: 0,
            },
          ],
        },
      ],
    });

    await domainReputation("example.com", db, {
      login: "test",
      password: "test",
    });

    expect(dataforseoRequest).toHaveBeenCalledWith(
      "/backlinks/summary/live",
      [{ target: "example.com", internal_list_limit: 0 }],
      { login: "test", password: "test" }
    );
  });

  it("inserts a record into dr_history table", async () => {
    vi.mocked(dataforseoRequest).mockResolvedValue({
      status_code: 20000,
      status_message: "Ok.",
      tasks: [
        {
          id: "task-1",
          status_code: 20000,
          status_message: "Ok.",
          result: [
            {
              target: "example.com",
              rank: 450,
              backlinks: 12500,
              referring_domains: 340,
              referring_domains_nofollow: 0,
              broken_backlinks: 0,
              referring_ips: 0,
              referring_subnets: 0,
            },
          ],
        },
      ],
    });

    await domainReputation("example.com", db, {
      login: "test",
      password: "test",
    });

    const rows = db
      .prepare("SELECT * FROM dr_history")
      .all() as { domain_rating: number; referring_domains: number }[];

    expect(rows).toHaveLength(1);
    expect(rows[0].domain_rating).toBe(450);
    expect(rows[0].referring_domains).toBe(340);
  });

  it("throws when DataForSEO returns no results", async () => {
    vi.mocked(dataforseoRequest).mockResolvedValue({
      status_code: 20000,
      status_message: "Ok.",
      tasks: [
        {
          id: "task-1",
          status_code: 20000,
          status_message: "Ok.",
          result: [],
        },
      ],
    });

    await expect(
      domainReputation("example.com", db, {
        login: "test",
        password: "test",
      })
    ).rejects.toThrow(/No results/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm test -- src/__tests__/backlinks.test.ts`
Expected: FAIL — module `../backlinks.js` not found

- [ ] **Step 3: Write the implementation**

Create `packages/core/src/backlinks.ts`:

```typescript
import type Database from "better-sqlite3";
import {
  dataforseoRequest,
  type DataForSEOCredentials,
} from "./dataforseo.js";

// --- Types ---

export interface DomainReputationResult {
  domain: string;
  domainRating: number;
  totalBacklinks: number;
  referringDomains: number;
  referringDomainsNofollow: number;
  brokenBacklinks: number;
  referringIps: number;
  referringSubnets: number;
}

export interface DRHistoryEntry {
  domainRating: number;
  referringDomains: number;
  checkedAt: string;
}

export interface BacklinkProfileResult {
  referringDomains: number;
  totalBacklinks: number;
  dofollowRatio: number;
  topDomains: { domain: string; rating: number; links: number }[];
  anchorDistribution: { anchor: string; count: number }[];
}

export interface BacklinkOpportunity {
  domain: string;
  domainRating: number;
  linksToCompetitors: number;
}

// --- domainReputation ---

export async function domainReputation(
  domain: string,
  db: Database.Database,
  credentials: DataForSEOCredentials
): Promise<DomainReputationResult> {
  const response = await dataforseoRequest(
    "/backlinks/summary/live",
    [{ target: domain, internal_list_limit: 0 }],
    credentials
  );

  const task = response.tasks[0];
  if (!task.result || task.result.length === 0) {
    throw new Error(`No results returned for domain: ${domain}`);
  }

  const data = task.result[0] as Record<string, unknown>;

  const result: DomainReputationResult = {
    domain,
    domainRating: (data.rank as number) ?? 0,
    totalBacklinks: (data.backlinks as number) ?? 0,
    referringDomains: (data.referring_domains as number) ?? 0,
    referringDomainsNofollow: (data.referring_domains_nofollow as number) ?? 0,
    brokenBacklinks: (data.broken_backlinks as number) ?? 0,
    referringIps: (data.referring_ips as number) ?? 0,
    referringSubnets: (data.referring_subnets as number) ?? 0,
  };

  // Persist to dr_history
  db.prepare(
    "INSERT INTO dr_history (domain_rating, referring_domains) VALUES (?, ?)"
  ).run(result.domainRating, result.referringDomains);

  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && pnpm test -- src/__tests__/backlinks.test.ts`
Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/backlinks.ts packages/core/src/__tests__/backlinks.test.ts
git commit -m "feat(core): add domainReputation with DR history persistence"
```

---

### Task 3: domainReputationHistory Function

**Files:**
- Modify: `packages/core/src/backlinks.ts`
- Modify: `packages/core/src/__tests__/backlinks.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `packages/core/src/__tests__/backlinks.test.ts`:

```typescript
import { domainReputationHistory } from "../backlinks.js";

describe("domainReputationHistory", () => {
  let tmpDir: string;
  let db: Database.Database;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "seoagent-drh-test-"));
    db = openDatabase(path.join(tmpDir, "seoagent.db"));
  });

  afterEach(() => {
    closeDatabase(db);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns empty array when no history exists", () => {
    const history = domainReputationHistory(db);
    expect(history).toEqual([]);
  });

  it("returns DR history entries in chronological order", () => {
    db.prepare(
      "INSERT INTO dr_history (domain_rating, referring_domains, checked_at) VALUES (?, ?, ?)"
    ).run(30, 100, "2026-01-01 00:00:00");
    db.prepare(
      "INSERT INTO dr_history (domain_rating, referring_domains, checked_at) VALUES (?, ?, ?)"
    ).run(35, 120, "2026-02-01 00:00:00");
    db.prepare(
      "INSERT INTO dr_history (domain_rating, referring_domains, checked_at) VALUES (?, ?, ?)"
    ).run(38, 150, "2026-03-01 00:00:00");

    const history = domainReputationHistory(db);

    expect(history).toHaveLength(3);
    expect(history[0].domainRating).toBe(30);
    expect(history[0].checkedAt).toBe("2026-01-01 00:00:00");
    expect(history[2].domainRating).toBe(38);
    expect(history[2].referringDomains).toBe(150);
  });

  it("respects optional limit parameter", () => {
    for (let i = 0; i < 10; i++) {
      db.prepare(
        "INSERT INTO dr_history (domain_rating, referring_domains, checked_at) VALUES (?, ?, ?)"
      ).run(30 + i, 100 + i * 10, `2026-0${Math.min(i + 1, 9)}-01 00:00:00`);
    }

    const history = domainReputationHistory(db, { limit: 5 });
    expect(history).toHaveLength(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm test -- src/__tests__/backlinks.test.ts`
Expected: FAIL — `domainReputationHistory` is not exported

- [ ] **Step 3: Add the implementation**

Append to `packages/core/src/backlinks.ts`:

```typescript
// --- domainReputationHistory ---

export interface DRHistoryOptions {
  limit?: number;
}

export function domainReputationHistory(
  db: Database.Database,
  options: DRHistoryOptions = {}
): DRHistoryEntry[] {
  const { limit } = options;

  let sql = "SELECT domain_rating, referring_domains, checked_at FROM dr_history ORDER BY checked_at ASC";
  const params: unknown[] = [];

  if (limit !== undefined) {
    sql += " LIMIT ?";
    params.push(limit);
  }

  const rows = db.prepare(sql).all(...params) as {
    domain_rating: number;
    referring_domains: number;
    checked_at: string;
  }[];

  return rows.map((row) => ({
    domainRating: row.domain_rating,
    referringDomains: row.referring_domains,
    checkedAt: row.checked_at,
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && pnpm test -- src/__tests__/backlinks.test.ts`
Expected: All 7 tests PASS (4 from Task 2 + 3 new)

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/backlinks.ts packages/core/src/__tests__/backlinks.test.ts
git commit -m "feat(core): add domainReputationHistory to query DR snapshots"
```

---

### Task 4: backlinkProfile Function

**Files:**
- Modify: `packages/core/src/backlinks.ts`
- Modify: `packages/core/src/__tests__/backlinks.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `packages/core/src/__tests__/backlinks.test.ts`:

```typescript
import { backlinkProfile } from "../backlinks.js";

describe("backlinkProfile", () => {
  let tmpDir: string;
  let db: Database.Database;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "seoagent-bp-test-"));
    db = openDatabase(path.join(tmpDir, "seoagent.db"));
    vi.resetAllMocks();
  });

  afterEach(() => {
    closeDatabase(db);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns structured backlink profile from DataForSEO", async () => {
    // Mock /backlinks/summary/live for totals
    vi.mocked(dataforseoRequest).mockImplementation(async (endpoint) => {
      if (endpoint === "/backlinks/summary/live") {
        return {
          status_code: 20000,
          status_message: "Ok.",
          tasks: [
            {
              id: "t1",
              status_code: 20000,
              status_message: "Ok.",
              result: [
                {
                  backlinks: 5000,
                  referring_domains: 200,
                  referring_domains_nofollow: 30,
                },
              ],
            },
          ],
        };
      }
      if (endpoint === "/backlinks/referring_domains/live") {
        return {
          status_code: 20000,
          status_message: "Ok.",
          tasks: [
            {
              id: "t2",
              status_code: 20000,
              status_message: "Ok.",
              result: [
                {
                  items: [
                    { domain: "blog.example.com", rank: 85, backlinks: 42 },
                    { domain: "news.site.org", rank: 72, backlinks: 18 },
                  ],
                },
              ],
            },
          ],
        };
      }
      if (endpoint === "/backlinks/backlinks/live") {
        return {
          status_code: 20000,
          status_message: "Ok.",
          tasks: [
            {
              id: "t3",
              status_code: 20000,
              status_message: "Ok.",
              result: [
                {
                  items: [
                    {
                      url_from: "https://blog.example.com/post-1",
                      domain_from: "blog.example.com",
                      anchor: "best tool",
                      is_lost: false,
                      dofollow: true,
                      domain_from_rank: 85,
                    },
                    {
                      url_from: "https://blog.example.com/post-2",
                      domain_from: "blog.example.com",
                      anchor: "best tool",
                      is_lost: false,
                      dofollow: true,
                      domain_from_rank: 85,
                    },
                    {
                      url_from: "https://news.site.org/article",
                      domain_from: "news.site.org",
                      anchor: "example.com",
                      is_lost: false,
                      dofollow: false,
                      domain_from_rank: 72,
                    },
                  ],
                },
              ],
            },
          ],
        };
      }
      throw new Error(`Unexpected endpoint: ${endpoint}`);
    });

    const result = await backlinkProfile("example.com", db, {
      login: "test",
      password: "test",
    });

    expect(result.referringDomains).toBe(200);
    expect(result.totalBacklinks).toBe(5000);
    // dofollowRatio = (200 - 30) / 200 = 0.85
    expect(result.dofollowRatio).toBeCloseTo(0.85);
    expect(result.topDomains).toHaveLength(2);
    expect(result.topDomains[0].domain).toBe("blog.example.com");
    expect(result.topDomains[0].rating).toBe(85);
    expect(result.topDomains[0].links).toBe(42);
    expect(result.anchorDistribution).toHaveLength(2);
    // "best tool" appears twice
    expect(
      result.anchorDistribution.find((a) => a.anchor === "best tool")?.count
    ).toBe(2);
  });

  it("stores backlinks in the backlinks table", async () => {
    vi.mocked(dataforseoRequest).mockImplementation(async (endpoint) => {
      if (endpoint === "/backlinks/summary/live") {
        return {
          status_code: 20000,
          status_message: "Ok.",
          tasks: [
            {
              id: "t1",
              status_code: 20000,
              status_message: "Ok.",
              result: [
                {
                  backlinks: 1,
                  referring_domains: 1,
                  referring_domains_nofollow: 0,
                },
              ],
            },
          ],
        };
      }
      if (endpoint === "/backlinks/referring_domains/live") {
        return {
          status_code: 20000,
          status_message: "Ok.",
          tasks: [
            {
              id: "t2",
              status_code: 20000,
              status_message: "Ok.",
              result: [{ items: [] }],
            },
          ],
        };
      }
      if (endpoint === "/backlinks/backlinks/live") {
        return {
          status_code: 20000,
          status_message: "Ok.",
          tasks: [
            {
              id: "t3",
              status_code: 20000,
              status_message: "Ok.",
              result: [
                {
                  items: [
                    {
                      url_from: "https://blog.example.com/post",
                      domain_from: "blog.example.com",
                      anchor: "click here",
                      is_lost: false,
                      dofollow: true,
                      domain_from_rank: 60,
                    },
                  ],
                },
              ],
            },
          ],
        };
      }
      throw new Error(`Unexpected endpoint: ${endpoint}`);
    });

    await backlinkProfile("example.com", db, {
      login: "test",
      password: "test",
    });

    const rows = db.prepare("SELECT * FROM backlinks").all() as {
      source_domain: string;
      source_url: string;
      anchor_text: string;
      is_dofollow: number;
      domain_rating: number;
    }[];

    expect(rows).toHaveLength(1);
    expect(rows[0].source_domain).toBe("blog.example.com");
    expect(rows[0].source_url).toBe("https://blog.example.com/post");
    expect(rows[0].anchor_text).toBe("click here");
    expect(rows[0].is_dofollow).toBe(1);
    expect(rows[0].domain_rating).toBe(60);
  });

  it("handles zero referring domains without division error", async () => {
    vi.mocked(dataforseoRequest).mockImplementation(async (endpoint) => {
      if (endpoint === "/backlinks/summary/live") {
        return {
          status_code: 20000,
          status_message: "Ok.",
          tasks: [
            {
              id: "t1",
              status_code: 20000,
              status_message: "Ok.",
              result: [
                {
                  backlinks: 0,
                  referring_domains: 0,
                  referring_domains_nofollow: 0,
                },
              ],
            },
          ],
        };
      }
      if (endpoint === "/backlinks/referring_domains/live") {
        return {
          status_code: 20000,
          status_message: "Ok.",
          tasks: [
            {
              id: "t2",
              status_code: 20000,
              status_message: "Ok.",
              result: [{ items: [] }],
            },
          ],
        };
      }
      if (endpoint === "/backlinks/backlinks/live") {
        return {
          status_code: 20000,
          status_message: "Ok.",
          tasks: [
            {
              id: "t3",
              status_code: 20000,
              status_message: "Ok.",
              result: [{ items: [] }],
            },
          ],
        };
      }
      throw new Error(`Unexpected endpoint: ${endpoint}`);
    });

    const result = await backlinkProfile("example.com", db, {
      login: "test",
      password: "test",
    });

    expect(result.dofollowRatio).toBe(0);
    expect(result.topDomains).toEqual([]);
    expect(result.anchorDistribution).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm test -- src/__tests__/backlinks.test.ts`
Expected: FAIL — `backlinkProfile` is not exported

- [ ] **Step 3: Add the implementation**

Append to `packages/core/src/backlinks.ts`:

```typescript
// --- backlinkProfile ---

export async function backlinkProfile(
  domain: string,
  db: Database.Database,
  credentials: DataForSEOCredentials
): Promise<BacklinkProfileResult> {
  // 1. Get summary for totals
  const summaryResponse = await dataforseoRequest(
    "/backlinks/summary/live",
    [{ target: domain, internal_list_limit: 0 }],
    credentials
  );
  const summaryData = summaryResponse.tasks[0].result[0] as Record<
    string,
    unknown
  >;

  const referringDomains = (summaryData.referring_domains as number) ?? 0;
  const referringDomainsNofollow =
    (summaryData.referring_domains_nofollow as number) ?? 0;
  const totalBacklinks = (summaryData.backlinks as number) ?? 0;

  const dofollowRatio =
    referringDomains > 0
      ? (referringDomains - referringDomainsNofollow) / referringDomains
      : 0;

  // 2. Get top referring domains
  const refDomainsResponse = await dataforseoRequest(
    "/backlinks/referring_domains/live",
    [{ target: domain, limit: 1000, order_by: ["rank,desc"] }],
    credentials
  );
  const refDomainsData = refDomainsResponse.tasks[0].result[0] as Record<
    string,
    unknown
  >;
  const refDomainItems = ((refDomainsData.items as unknown[]) ?? []) as {
    domain: string;
    rank: number;
    backlinks: number;
  }[];

  const topDomains = refDomainItems.map((item) => ({
    domain: item.domain,
    rating: item.rank ?? 0,
    links: item.backlinks ?? 0,
  }));

  // 3. Get backlinks for anchor distribution + storage
  const backlinksResponse = await dataforseoRequest(
    "/backlinks/backlinks/live",
    [{ target: domain, limit: 1000, order_by: ["rank,desc"] }],
    credentials
  );
  const backlinksData = backlinksResponse.tasks[0].result[0] as Record<
    string,
    unknown
  >;
  const backlinkItems = ((backlinksData.items as unknown[]) ?? []) as {
    url_from: string;
    domain_from: string;
    anchor: string;
    is_lost: boolean;
    dofollow: boolean;
    domain_from_rank: number;
  }[];

  // Build anchor distribution
  const anchorCounts = new Map<string, number>();
  for (const item of backlinkItems) {
    const anchor = item.anchor || "";
    if (anchor) {
      anchorCounts.set(anchor, (anchorCounts.get(anchor) ?? 0) + 1);
    }
  }
  const anchorDistribution = Array.from(anchorCounts.entries())
    .map(([anchor, count]) => ({ anchor, count }))
    .sort((a, b) => b.count - a.count);

  // Store backlinks in database
  const insertStmt = db.prepare(
    `INSERT OR REPLACE INTO backlinks (source_domain, source_url, target_url, anchor_text, is_dofollow, domain_rating, last_seen)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
  );
  const insertMany = db.transaction((items: typeof backlinkItems) => {
    for (const item of items) {
      insertStmt.run(
        item.domain_from,
        item.url_from,
        domain,
        item.anchor || null,
        item.dofollow ? 1 : 0,
        item.domain_from_rank ?? null
      );
    }
  });
  insertMany(backlinkItems);

  return {
    referringDomains,
    totalBacklinks,
    dofollowRatio,
    topDomains,
    anchorDistribution,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && pnpm test -- src/__tests__/backlinks.test.ts`
Expected: All 10 tests PASS (7 from Tasks 2-3 + 3 new)

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/backlinks.ts packages/core/src/__tests__/backlinks.test.ts
git commit -m "feat(core): add backlinkProfile with anchor distribution and DB storage"
```

---

### Task 5: backlinkOpportunities Function

**Files:**
- Modify: `packages/core/src/backlinks.ts`
- Modify: `packages/core/src/__tests__/backlinks.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `packages/core/src/__tests__/backlinks.test.ts`:

```typescript
import { backlinkOpportunities } from "../backlinks.js";

describe("backlinkOpportunities", () => {
  let tmpDir: string;
  let db: Database.Database;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "seoagent-bo-test-"));
    db = openDatabase(path.join(tmpDir, "seoagent.db"));
    vi.resetAllMocks();
  });

  afterEach(() => {
    closeDatabase(db);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns domains linking to competitors but not target", async () => {
    vi.mocked(dataforseoRequest).mockResolvedValue({
      status_code: 20000,
      status_message: "Ok.",
      tasks: [
        {
          id: "t1",
          status_code: 20000,
          status_message: "Ok.",
          result: [
            {
              items: [
                {
                  domain: "linker-a.com",
                  rank: 65,
                  is_intersect: [true, true, false],
                },
                {
                  domain: "linker-b.com",
                  rank: 48,
                  is_intersect: [true, false, false],
                },
                {
                  domain: "linker-c.com",
                  rank: 72,
                  is_intersect: [false, true, false],
                },
              ],
            },
          ],
        },
      ],
    });

    const result = await backlinkOpportunities(
      "mysite.com",
      ["competitor1.com", "competitor2.com"],
      { login: "test", password: "test" }
    );

    expect(result).toHaveLength(3);
    expect(result[0].domain).toBe("linker-c.com");
    expect(result[0].domainRating).toBe(72);
    // Sorted by domainRating descending
    expect(result[1].domainRating).toBe(65);
    expect(result[2].domainRating).toBe(48);
  });

  it("calls DataForSEO /backlinks/domain_intersection/live", async () => {
    vi.mocked(dataforseoRequest).mockResolvedValue({
      status_code: 20000,
      status_message: "Ok.",
      tasks: [
        {
          id: "t1",
          status_code: 20000,
          status_message: "Ok.",
          result: [{ items: [] }],
        },
      ],
    });

    await backlinkOpportunities(
      "mysite.com",
      ["competitor1.com", "competitor2.com"],
      { login: "test", password: "test" }
    );

    expect(dataforseoRequest).toHaveBeenCalledWith(
      "/backlinks/domain_intersection/live",
      [
        {
          targets: {
            1: "competitor1.com",
            2: "competitor2.com",
          },
          exclude_targets: ["mysite.com"],
          limit: 1000,
          order_by: ["rank,desc"],
        },
      ],
      { login: "test", password: "test" }
    );
  });

  it("returns empty array when no opportunities found", async () => {
    vi.mocked(dataforseoRequest).mockResolvedValue({
      status_code: 20000,
      status_message: "Ok.",
      tasks: [
        {
          id: "t1",
          status_code: 20000,
          status_message: "Ok.",
          result: [{ items: [] }],
        },
      ],
    });

    const result = await backlinkOpportunities(
      "mysite.com",
      ["competitor1.com"],
      { login: "test", password: "test" }
    );

    expect(result).toEqual([]);
  });

  it("throws when no competitors provided", async () => {
    await expect(
      backlinkOpportunities("mysite.com", [], {
        login: "test",
        password: "test",
      })
    ).rejects.toThrow(/at least one competitor/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm test -- src/__tests__/backlinks.test.ts`
Expected: FAIL — `backlinkOpportunities` is not exported

- [ ] **Step 3: Add the implementation**

Append to `packages/core/src/backlinks.ts`:

```typescript
// --- backlinkOpportunities ---

export async function backlinkOpportunities(
  domain: string,
  competitors: string[],
  credentials: DataForSEOCredentials
): Promise<BacklinkOpportunity[]> {
  if (competitors.length === 0) {
    throw new Error("Must provide at least one competitor domain");
  }

  // Build targets object: { "1": "competitor1.com", "2": "competitor2.com", ... }
  const targets: Record<string, string> = {};
  competitors.forEach((competitor, index) => {
    targets[String(index + 1)] = competitor;
  });

  const response = await dataforseoRequest(
    "/backlinks/domain_intersection/live",
    [
      {
        targets,
        exclude_targets: [domain],
        limit: 1000,
        order_by: ["rank,desc"],
      },
    ],
    credentials
  );

  const task = response.tasks[0];
  const data = task.result[0] as Record<string, unknown>;
  const items = ((data.items as unknown[]) ?? []) as {
    domain: string;
    rank: number;
    is_intersect: boolean[];
  }[];

  const opportunities: BacklinkOpportunity[] = items.map((item) => {
    const linksToCompetitors = item.is_intersect
      ? item.is_intersect.filter(Boolean).length
      : 1;

    return {
      domain: item.domain,
      domainRating: item.rank ?? 0,
      linksToCompetitors,
    };
  });

  // Sort by domain rating descending
  opportunities.sort((a, b) => b.domainRating - a.domainRating);

  return opportunities;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && pnpm test -- src/__tests__/backlinks.test.ts`
Expected: All 14 tests PASS (10 from Tasks 2-4 + 4 new)

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/backlinks.ts packages/core/src/__tests__/backlinks.test.ts
git commit -m "feat(core): add backlinkOpportunities via domain intersection"
```

---

### Task 6: Export from Barrel

**Files:**
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Add exports to barrel**

Append to `packages/core/src/index.ts`:

```typescript
export {
  domainReputation,
  domainReputationHistory,
  backlinkProfile,
  backlinkOpportunities,
} from "./backlinks.js";

export type {
  DomainReputationResult,
  DRHistoryEntry,
  DRHistoryOptions,
  BacklinkProfileResult,
  BacklinkOpportunity,
} from "./backlinks.js";

export { dataforseoRequest } from "./dataforseo.js";
export type { DataForSEOCredentials, DataForSEOResponse, DataForSEOTask } from "./dataforseo.js";
```

- [ ] **Step 2: Verify build**

Run: `cd packages/core && pnpm build`
Expected: Build succeeds with no errors

- [ ] **Step 3: Run all tests**

Run: `cd packages/core && pnpm test`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/index.ts
git commit -m "feat(core): export backlinks and dataforseo modules from barrel"
```
