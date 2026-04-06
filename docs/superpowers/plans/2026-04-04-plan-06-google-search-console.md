# Google Search Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate Google Search Console via OAuth2 so SEOAgent can pull real clicks, impressions, CTR, and position data for verified properties.

**Architecture:** OAuth2 flow stores refresh token in global config (`gsc.clientId`, `gsc.clientSecret`, `gsc.refreshToken`). Three public functions (`gscPerformance`, `gscPages`, `gscQueries`) wrap the `searchconsole.searchanalytics.query` API. All results are synced into the existing `gsc_data` SQLite table for historical tracking. Users bring their own Google Cloud project credentials (BYOK model).

**Tech Stack:** googleapis (google.searchconsole, google.auth.OAuth2), better-sqlite3 (via Plan 1 database layer), vitest

---

## File Structure

```
packages/core/src/
├── gsc/
│   ├── auth.ts             # OAuth2 helpers: generate URL, exchange code, create client
│   ├── client.ts           # Low-level GSC API wrapper
│   ├── performance.ts      # gscPerformance function
│   ├── pages.ts            # gscPages function
│   ├── queries.ts          # gscQueries function
│   ├── sync.ts             # Sync GSC results into SQLite gsc_data table
│   └── types.ts            # GSC-specific TypeScript types
├── __tests__/
│   ├── gsc-auth.test.ts
│   ├── gsc-client.test.ts
│   ├── gsc-performance.test.ts
│   ├── gsc-pages.test.ts
│   ├── gsc-queries.test.ts
│   └── gsc-sync.test.ts
└── index.ts                # Updated barrel export
```

---

### Task 1: Add googleapis Dependency and GSC Types

**Files:**
- Modify: `packages/core/package.json`
- Create: `packages/core/src/gsc/types.ts`

- [ ] **Step 1: Add googleapis to core package**

Add `googleapis` to `packages/core/package.json` dependencies:

```bash
cd packages/core && pnpm add googleapis
```

Expected: `googleapis` added to `dependencies` in `package.json`, lockfile updated.

- [ ] **Step 2: Create GSC types**

Create `packages/core/src/gsc/types.ts`:

```typescript
export interface GscCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

export interface GscPerformanceOptions {
  days?: number;
  startDate?: string;
  endDate?: string;
  query?: string;
  page?: string;
}

export interface GscPagesOptions {
  days?: number;
  sort?: "clicks" | "impressions" | "ctr" | "position";
  limit?: number;
}

export interface GscQueriesOptions {
  days?: number;
  page?: string;
  limit?: number;
}

export interface GscRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscPerformanceResult {
  startDate: string;
  endDate: string;
  totals: {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  };
  rows: {
    date: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }[];
}

export interface GscPageResult {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscQueryResult {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}
```

- [ ] **Step 3: Verify build**

Run: `cd packages/core && pnpm build`
Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/core/package.json pnpm-lock.yaml packages/core/src/gsc/types.ts
git commit -m "feat(core): add googleapis dependency and GSC types"
```

---

### Task 2: Implement GSC OAuth Helpers

**Files:**
- Create: `packages/core/src/__tests__/gsc-auth.test.ts`
- Create: `packages/core/src/gsc/auth.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/__tests__/gsc-auth.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

describe("gsc auth", () => {
  let tmpDir: string;
  const originalEnv = process.env;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "seoagent-gsc-auth-"));
    process.env = { ...originalEnv, SEOAGENT_HOME: tmpDir };
  });

  afterEach(() => {
    process.env = originalEnv;
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("generates an auth URL with correct scopes", async () => {
    const { generateAuthUrl } = await import("../gsc/auth.js");

    const url = generateAuthUrl("test-client-id", "test-client-secret");
    expect(url).toContain("accounts.google.com");
    expect(url).toContain("test-client-id");
    expect(url).toContain("webmasters.readonly");
  });

  it("creates an OAuth2 client with redirect URI", async () => {
    const { createOAuth2Client } = await import("../gsc/auth.js");

    const client = createOAuth2Client("test-id", "test-secret");
    expect(client).toBeDefined();
  });

  it("stores credentials in config after exchange", async () => {
    const { setConfigValue, getConfigValue } = await import("../config.js");
    const { saveGscCredentials, loadGscCredentials } = await import("../gsc/auth.js");

    setConfigValue("gsc.clientId", "my-client-id");
    setConfigValue("gsc.clientSecret", "my-client-secret");

    saveGscCredentials("my-refresh-token");

    expect(getConfigValue("gsc.refreshToken")).toBe("my-refresh-token");

    const creds = loadGscCredentials();
    expect(creds).not.toBeNull();
    expect(creds!.clientId).toBe("my-client-id");
    expect(creds!.clientSecret).toBe("my-client-secret");
    expect(creds!.refreshToken).toBe("my-refresh-token");
  });

  it("returns null when credentials are incomplete", async () => {
    const { loadGscCredentials } = await import("../gsc/auth.js");

    const creds = loadGscCredentials();
    expect(creds).toBeNull();
  });

  it("creates an authenticated client from stored credentials", async () => {
    const { setConfigValue } = await import("../config.js");
    const { saveGscCredentials, createAuthenticatedClient } = await import("../gsc/auth.js");

    setConfigValue("gsc.clientId", "my-client-id");
    setConfigValue("gsc.clientSecret", "my-client-secret");
    saveGscCredentials("my-refresh-token");

    const client = createAuthenticatedClient();
    expect(client).not.toBeNull();
  });

  it("returns null from createAuthenticatedClient when no credentials", async () => {
    const { createAuthenticatedClient } = await import("../gsc/auth.js");

    const client = createAuthenticatedClient();
    expect(client).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm test -- src/__tests__/gsc-auth.test.ts`
Expected: FAIL — module `../gsc/auth.js` not found

- [ ] **Step 3: Write the implementation**

Create `packages/core/src/gsc/auth.ts`:

```typescript
import { google } from "googleapis";
import { getConfigValue, setConfigValue } from "../config.js";
import type { GscCredentials } from "./types.js";

const REDIRECT_URI = "urn:ietf:wg:oauth:2.0:oob";
const SCOPES = ["https://www.googleapis.com/auth/webmasters.readonly"];

export function createOAuth2Client(
  clientId: string,
  clientSecret: string
): InstanceType<typeof google.auth.OAuth2> {
  return new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);
}

export function generateAuthUrl(
  clientId: string,
  clientSecret: string
): string {
  const oauth2Client = createOAuth2Client(clientId, clientSecret);
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
  });
}

export async function exchangeCode(
  clientId: string,
  clientSecret: string,
  code: string
): Promise<string> {
  const oauth2Client = createOAuth2Client(clientId, clientSecret);
  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.refresh_token) {
    throw new Error(
      "No refresh token received. Re-authorize with prompt=consent."
    );
  }

  return tokens.refresh_token;
}

export function saveGscCredentials(refreshToken: string): void {
  setConfigValue("gsc.refreshToken", refreshToken);
}

export function loadGscCredentials(): GscCredentials | null {
  const clientId = getConfigValue("gsc.clientId") as string | undefined;
  const clientSecret = getConfigValue("gsc.clientSecret") as string | undefined;
  const refreshToken = getConfigValue("gsc.refreshToken") as string | undefined;

  if (!clientId || !clientSecret || !refreshToken) {
    return null;
  }

  return { clientId, clientSecret, refreshToken };
}

export function createAuthenticatedClient(): InstanceType<
  typeof google.auth.OAuth2
> | null {
  const creds = loadGscCredentials();
  if (!creds) {
    return null;
  }

  const oauth2Client = createOAuth2Client(creds.clientId, creds.clientSecret);
  oauth2Client.setCredentials({ refresh_token: creds.refreshToken });

  return oauth2Client;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && pnpm test -- src/__tests__/gsc-auth.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/gsc/auth.ts packages/core/src/__tests__/gsc-auth.test.ts
git commit -m "feat(core): add GSC OAuth2 auth helpers"
```

---

### Task 3: Implement GSC API Client

**Files:**
- Create: `packages/core/src/__tests__/gsc-client.test.ts`
- Create: `packages/core/src/gsc/client.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/__tests__/gsc-client.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { buildQueryParams, formatDateForGsc } from "../gsc/client.js";

describe("gsc client", () => {
  it("formats date as YYYY-MM-DD", () => {
    const date = new Date("2026-03-15T12:00:00Z");
    expect(formatDateForGsc(date)).toBe("2026-03-15");
  });

  it("builds query params with default 28-day range", () => {
    const params = buildQueryParams("https://example.com", {
      dimensions: ["date"],
    });

    expect(params.siteUrl).toBe("https://example.com");
    expect(params.requestBody.startDate).toBeDefined();
    expect(params.requestBody.endDate).toBeDefined();
    expect(params.requestBody.dimensions).toEqual(["date"]);
    expect(params.requestBody.rowLimit).toBe(1000);
  });

  it("builds query params with custom days", () => {
    const params = buildQueryParams("https://example.com", {
      dimensions: ["query"],
      days: 7,
      rowLimit: 50,
    });

    const start = new Date(params.requestBody.startDate);
    const end = new Date(params.requestBody.endDate);
    const diffDays = Math.round(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    );

    expect(diffDays).toBe(7);
    expect(params.requestBody.rowLimit).toBe(50);
  });

  it("builds query params with explicit date range", () => {
    const params = buildQueryParams("https://example.com", {
      dimensions: ["page"],
      startDate: "2026-01-01",
      endDate: "2026-01-31",
    });

    expect(params.requestBody.startDate).toBe("2026-01-01");
    expect(params.requestBody.endDate).toBe("2026-01-31");
  });

  it("adds dimension filter groups for query filter", () => {
    const params = buildQueryParams("https://example.com", {
      dimensions: ["date"],
      queryFilter: "seo tips",
    });

    expect(params.requestBody.dimensionFilterGroups).toBeDefined();
    expect(params.requestBody.dimensionFilterGroups![0].filters![0]).toEqual({
      dimension: "query",
      operator: "contains",
      expression: "seo tips",
    });
  });

  it("adds dimension filter groups for page filter", () => {
    const params = buildQueryParams("https://example.com", {
      dimensions: ["date"],
      pageFilter: "https://example.com/blog",
    });

    expect(params.requestBody.dimensionFilterGroups![0].filters![0]).toEqual({
      dimension: "page",
      operator: "contains",
      expression: "https://example.com/blog",
    });
  });

  it("combines query and page filters", () => {
    const params = buildQueryParams("https://example.com", {
      dimensions: ["date"],
      queryFilter: "seo",
      pageFilter: "/blog",
    });

    const filters =
      params.requestBody.dimensionFilterGroups![0].filters!;
    expect(filters).toHaveLength(2);
    expect(filters[0].dimension).toBe("query");
    expect(filters[1].dimension).toBe("page");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm test -- src/__tests__/gsc-client.test.ts`
Expected: FAIL — module `../gsc/client.js` not found

- [ ] **Step 3: Write the implementation**

Create `packages/core/src/gsc/client.ts`:

```typescript
import { google, type searchconsole_v1 } from "googleapis";
import type { OAuth2Client } from "google-auth-library";

export function formatDateForGsc(date: Date): string {
  return date.toISOString().split("T")[0];
}

export interface QueryParamsInput {
  dimensions: string[];
  days?: number;
  startDate?: string;
  endDate?: string;
  rowLimit?: number;
  queryFilter?: string;
  pageFilter?: string;
}

export interface QueryParams {
  siteUrl: string;
  requestBody: {
    startDate: string;
    endDate: string;
    dimensions: string[];
    rowLimit: number;
    dimensionFilterGroups?: {
      filters: {
        dimension: string;
        operator: string;
        expression: string;
      }[];
    }[];
  };
}

export function buildQueryParams(
  siteUrl: string,
  input: QueryParamsInput
): QueryParams {
  let startDate: string;
  let endDate: string;

  if (input.startDate && input.endDate) {
    startDate = input.startDate;
    endDate = input.endDate;
  } else {
    const days = input.days ?? 28;
    const end = new Date();
    end.setDate(end.getDate() - 3); // GSC data has ~3 day lag
    const start = new Date(end);
    start.setDate(start.getDate() - days);

    startDate = formatDateForGsc(start);
    endDate = formatDateForGsc(end);
  }

  const filters: { dimension: string; operator: string; expression: string }[] =
    [];

  if (input.queryFilter) {
    filters.push({
      dimension: "query",
      operator: "contains",
      expression: input.queryFilter,
    });
  }

  if (input.pageFilter) {
    filters.push({
      dimension: "page",
      operator: "contains",
      expression: input.pageFilter,
    });
  }

  const requestBody: QueryParams["requestBody"] = {
    startDate,
    endDate,
    dimensions: input.dimensions,
    rowLimit: input.rowLimit ?? 1000,
  };

  if (filters.length > 0) {
    requestBody.dimensionFilterGroups = [{ filters }];
  }

  return { siteUrl, requestBody };
}

export async function executeGscQuery(
  auth: OAuth2Client,
  params: QueryParams
): Promise<searchconsole_v1.Schema$ApiDataRow[]> {
  const searchconsole = google.searchconsole({ version: "v1", auth });

  const response = await searchconsole.searchanalytics.query({
    siteUrl: params.siteUrl,
    requestBody: params.requestBody,
  });

  return response.data.rows ?? [];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && pnpm test -- src/__tests__/gsc-client.test.ts`
Expected: All 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/gsc/client.ts packages/core/src/__tests__/gsc-client.test.ts
git commit -m "feat(core): add GSC API client with query builder"
```

---

### Task 4: Implement gscPerformance

**Files:**
- Create: `packages/core/src/__tests__/gsc-performance.test.ts`
- Create: `packages/core/src/gsc/performance.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/__tests__/gsc-performance.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../gsc/client.js", () => ({
  buildQueryParams: vi.fn().mockReturnValue({
    siteUrl: "https://example.com",
    requestBody: {
      startDate: "2026-03-01",
      endDate: "2026-03-28",
      dimensions: ["date"],
      rowLimit: 1000,
    },
  }),
  executeGscQuery: vi.fn().mockResolvedValue([
    { keys: ["2026-03-01"], clicks: 100, impressions: 1000, ctr: 0.1, position: 5.2 },
    { keys: ["2026-03-02"], clicks: 120, impressions: 1100, ctr: 0.109, position: 4.8 },
  ]),
  formatDateForGsc: vi.fn().mockImplementation((d: Date) => d.toISOString().split("T")[0]),
}));

vi.mock("../gsc/auth.js", () => ({
  createAuthenticatedClient: vi.fn().mockReturnValue({}),
  loadGscCredentials: vi.fn().mockReturnValue({
    clientId: "id",
    clientSecret: "secret",
    refreshToken: "token",
  }),
}));

vi.mock("../project.js", () => ({
  getProject: vi.fn().mockReturnValue({
    slug: "my-site",
    config: { domain: "example.com", name: "My Site" },
  }),
}));

describe("gscPerformance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns aggregated performance data with date rows", async () => {
    const { gscPerformance } = await import("../gsc/performance.js");

    const result = await gscPerformance("my-site");

    expect(result.startDate).toBe("2026-03-01");
    expect(result.endDate).toBe("2026-03-28");
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].date).toBe("2026-03-01");
    expect(result.rows[0].clicks).toBe(100);
    expect(result.totals.clicks).toBe(220);
    expect(result.totals.impressions).toBe(2100);
  });

  it("passes query filter to buildQueryParams", async () => {
    const { gscPerformance } = await import("../gsc/performance.js");
    const { buildQueryParams } = await import("../gsc/client.js");

    await gscPerformance("my-site", { query: "seo tips" });

    expect(buildQueryParams).toHaveBeenCalledWith(
      expect.stringContaining("example.com"),
      expect.objectContaining({ queryFilter: "seo tips" })
    );
  });

  it("passes page filter to buildQueryParams", async () => {
    const { gscPerformance } = await import("../gsc/performance.js");
    const { buildQueryParams } = await import("../gsc/client.js");

    await gscPerformance("my-site", { page: "/blog" });

    expect(buildQueryParams).toHaveBeenCalledWith(
      expect.stringContaining("example.com"),
      expect.objectContaining({ pageFilter: "/blog" })
    );
  });

  it("throws when no GSC credentials configured", async () => {
    const authModule = await import("../gsc/auth.js");
    vi.mocked(authModule.createAuthenticatedClient).mockReturnValueOnce(null);

    const { gscPerformance } = await import("../gsc/performance.js");

    await expect(gscPerformance("my-site")).rejects.toThrow(
      /GSC not authenticated/
    );
  });

  it("throws when project not found", async () => {
    const projectModule = await import("../project.js");
    vi.mocked(projectModule.getProject).mockReturnValueOnce(null);

    const { gscPerformance } = await import("../gsc/performance.js");

    await expect(gscPerformance("nonexistent")).rejects.toThrow(
      /Project.*not found/
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm test -- src/__tests__/gsc-performance.test.ts`
Expected: FAIL — module `../gsc/performance.js` not found

- [ ] **Step 3: Write the implementation**

Create `packages/core/src/gsc/performance.ts`:

```typescript
import { createAuthenticatedClient } from "./auth.js";
import { buildQueryParams, executeGscQuery } from "./client.js";
import { getProject } from "../project.js";
import type { GscPerformanceOptions, GscPerformanceResult } from "./types.js";

export async function gscPerformance(
  projectSlug: string,
  options: GscPerformanceOptions = {}
): Promise<GscPerformanceResult> {
  const project = getProject(projectSlug);
  if (!project) {
    throw new Error(`Project "${projectSlug}" not found.`);
  }

  const auth = createAuthenticatedClient();
  if (!auth) {
    throw new Error(
      "GSC not authenticated. Run `seoagent gsc auth` to connect your Google account."
    );
  }

  const siteUrl = `sc-domain:${project.config.domain}`;

  const params = buildQueryParams(siteUrl, {
    dimensions: ["date"],
    days: options.days,
    startDate: options.startDate,
    endDate: options.endDate,
    queryFilter: options.query,
    pageFilter: options.page,
  });

  const rows = await executeGscQuery(auth, params);

  const mappedRows = rows.map((row) => ({
    date: row.keys![0],
    clicks: row.clicks ?? 0,
    impressions: row.impressions ?? 0,
    ctr: row.ctr ?? 0,
    position: row.position ?? 0,
  }));

  const totals = mappedRows.reduce(
    (acc, row) => ({
      clicks: acc.clicks + row.clicks,
      impressions: acc.impressions + row.impressions,
      ctr: 0, // computed below
      position: 0, // computed below
    }),
    { clicks: 0, impressions: 0, ctr: 0, position: 0 }
  );

  totals.ctr =
    totals.impressions > 0 ? totals.clicks / totals.impressions : 0;

  const positionSum = mappedRows.reduce((sum, r) => sum + r.position, 0);
  totals.position = mappedRows.length > 0 ? positionSum / mappedRows.length : 0;

  return {
    startDate: params.requestBody.startDate,
    endDate: params.requestBody.endDate,
    totals,
    rows: mappedRows,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && pnpm test -- src/__tests__/gsc-performance.test.ts`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/gsc/performance.ts packages/core/src/__tests__/gsc-performance.test.ts
git commit -m "feat(core): add gscPerformance function"
```

---

### Task 5: Implement gscPages

**Files:**
- Create: `packages/core/src/__tests__/gsc-pages.test.ts`
- Create: `packages/core/src/gsc/pages.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/__tests__/gsc-pages.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../gsc/client.js", () => ({
  buildQueryParams: vi.fn().mockReturnValue({
    siteUrl: "https://example.com",
    requestBody: {
      startDate: "2026-03-01",
      endDate: "2026-03-28",
      dimensions: ["page"],
      rowLimit: 10,
    },
  }),
  executeGscQuery: vi.fn().mockResolvedValue([
    { keys: ["https://example.com/blog/seo"], clicks: 500, impressions: 5000, ctr: 0.1, position: 3.2 },
    { keys: ["https://example.com/"], clicks: 300, impressions: 8000, ctr: 0.0375, position: 8.1 },
    { keys: ["https://example.com/pricing"], clicks: 200, impressions: 2000, ctr: 0.1, position: 2.5 },
  ]),
  formatDateForGsc: vi.fn(),
}));

vi.mock("../gsc/auth.js", () => ({
  createAuthenticatedClient: vi.fn().mockReturnValue({}),
  loadGscCredentials: vi.fn().mockReturnValue({
    clientId: "id",
    clientSecret: "secret",
    refreshToken: "token",
  }),
}));

vi.mock("../project.js", () => ({
  getProject: vi.fn().mockReturnValue({
    slug: "my-site",
    config: { domain: "example.com", name: "My Site" },
  }),
}));

describe("gscPages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns pages sorted by clicks (default)", async () => {
    const { gscPages } = await import("../gsc/pages.js");

    const result = await gscPages("my-site");

    expect(result).toHaveLength(3);
    expect(result[0].page).toBe("https://example.com/blog/seo");
    expect(result[0].clicks).toBe(500);
  });

  it("passes limit to rowLimit in query params", async () => {
    const { gscPages } = await import("../gsc/pages.js");
    const { buildQueryParams } = await import("../gsc/client.js");

    await gscPages("my-site", { limit: 5 });

    expect(buildQueryParams).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ rowLimit: 5 })
    );
  });

  it("passes days option through", async () => {
    const { gscPages } = await import("../gsc/pages.js");
    const { buildQueryParams } = await import("../gsc/client.js");

    await gscPages("my-site", { days: 7 });

    expect(buildQueryParams).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ days: 7 })
    );
  });

  it("throws when not authenticated", async () => {
    const authModule = await import("../gsc/auth.js");
    vi.mocked(authModule.createAuthenticatedClient).mockReturnValueOnce(null);

    const { gscPages } = await import("../gsc/pages.js");

    await expect(gscPages("my-site")).rejects.toThrow(/GSC not authenticated/);
  });

  it("throws when project not found", async () => {
    const projectModule = await import("../project.js");
    vi.mocked(projectModule.getProject).mockReturnValueOnce(null);

    const { gscPages } = await import("../gsc/pages.js");

    await expect(gscPages("nonexistent")).rejects.toThrow(/Project.*not found/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm test -- src/__tests__/gsc-pages.test.ts`
Expected: FAIL — module `../gsc/pages.js` not found

- [ ] **Step 3: Write the implementation**

Create `packages/core/src/gsc/pages.ts`:

```typescript
import { createAuthenticatedClient } from "./auth.js";
import { buildQueryParams, executeGscQuery } from "./client.js";
import { getProject } from "../project.js";
import type { GscPagesOptions, GscPageResult } from "./types.js";

export async function gscPages(
  projectSlug: string,
  options: GscPagesOptions = {}
): Promise<GscPageResult[]> {
  const project = getProject(projectSlug);
  if (!project) {
    throw new Error(`Project "${projectSlug}" not found.`);
  }

  const auth = createAuthenticatedClient();
  if (!auth) {
    throw new Error(
      "GSC not authenticated. Run `seoagent gsc auth` to connect your Google account."
    );
  }

  const siteUrl = `sc-domain:${project.config.domain}`;
  const sort = options.sort ?? "clicks";
  const limit = options.limit ?? 20;

  const params = buildQueryParams(siteUrl, {
    dimensions: ["page"],
    days: options.days,
    rowLimit: limit,
  });

  const rows = await executeGscQuery(auth, params);

  const results: GscPageResult[] = rows.map((row) => ({
    page: row.keys![0],
    clicks: row.clicks ?? 0,
    impressions: row.impressions ?? 0,
    ctr: row.ctr ?? 0,
    position: row.position ?? 0,
  }));

  results.sort((a, b) => {
    if (sort === "position") {
      return a.position - b.position; // lower is better
    }
    return b[sort] - a[sort]; // higher is better for clicks, impressions, ctr
  });

  return results;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && pnpm test -- src/__tests__/gsc-pages.test.ts`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/gsc/pages.ts packages/core/src/__tests__/gsc-pages.test.ts
git commit -m "feat(core): add gscPages function"
```

---

### Task 6: Implement gscQueries

**Files:**
- Create: `packages/core/src/__tests__/gsc-queries.test.ts`
- Create: `packages/core/src/gsc/queries.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/__tests__/gsc-queries.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../gsc/client.js", () => ({
  buildQueryParams: vi.fn().mockReturnValue({
    siteUrl: "https://example.com",
    requestBody: {
      startDate: "2026-03-01",
      endDate: "2026-03-28",
      dimensions: ["query"],
      rowLimit: 20,
    },
  }),
  executeGscQuery: vi.fn().mockResolvedValue([
    { keys: ["best seo tools"], clicks: 300, impressions: 4000, ctr: 0.075, position: 4.1 },
    { keys: ["seo tips 2026"], clicks: 250, impressions: 3000, ctr: 0.083, position: 5.5 },
    { keys: ["how to rank higher"], clicks: 150, impressions: 6000, ctr: 0.025, position: 12.3 },
  ]),
  formatDateForGsc: vi.fn(),
}));

vi.mock("../gsc/auth.js", () => ({
  createAuthenticatedClient: vi.fn().mockReturnValue({}),
  loadGscCredentials: vi.fn().mockReturnValue({
    clientId: "id",
    clientSecret: "secret",
    refreshToken: "token",
  }),
}));

vi.mock("../project.js", () => ({
  getProject: vi.fn().mockReturnValue({
    slug: "my-site",
    config: { domain: "example.com", name: "My Site" },
  }),
}));

describe("gscQueries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns queries sorted by clicks", async () => {
    const { gscQueries } = await import("../gsc/queries.js");

    const result = await gscQueries("my-site");

    expect(result).toHaveLength(3);
    expect(result[0].query).toBe("best seo tools");
    expect(result[0].clicks).toBe(300);
    expect(result[2].query).toBe("how to rank higher");
  });

  it("passes page filter through", async () => {
    const { gscQueries } = await import("../gsc/queries.js");
    const { buildQueryParams } = await import("../gsc/client.js");

    await gscQueries("my-site", { page: "/blog" });

    expect(buildQueryParams).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ pageFilter: "/blog" })
    );
  });

  it("passes limit to rowLimit", async () => {
    const { gscQueries } = await import("../gsc/queries.js");
    const { buildQueryParams } = await import("../gsc/client.js");

    await gscQueries("my-site", { limit: 50 });

    expect(buildQueryParams).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ rowLimit: 50 })
    );
  });

  it("passes days option through", async () => {
    const { gscQueries } = await import("../gsc/queries.js");
    const { buildQueryParams } = await import("../gsc/client.js");

    await gscQueries("my-site", { days: 14 });

    expect(buildQueryParams).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ days: 14 })
    );
  });

  it("throws when not authenticated", async () => {
    const authModule = await import("../gsc/auth.js");
    vi.mocked(authModule.createAuthenticatedClient).mockReturnValueOnce(null);

    const { gscQueries } = await import("../gsc/queries.js");

    await expect(gscQueries("my-site")).rejects.toThrow(/GSC not authenticated/);
  });

  it("throws when project not found", async () => {
    const projectModule = await import("../project.js");
    vi.mocked(projectModule.getProject).mockReturnValueOnce(null);

    const { gscQueries } = await import("../gsc/queries.js");

    await expect(gscQueries("nonexistent")).rejects.toThrow(/Project.*not found/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm test -- src/__tests__/gsc-queries.test.ts`
Expected: FAIL — module `../gsc/queries.js` not found

- [ ] **Step 3: Write the implementation**

Create `packages/core/src/gsc/queries.ts`:

```typescript
import { createAuthenticatedClient } from "./auth.js";
import { buildQueryParams, executeGscQuery } from "./client.js";
import { getProject } from "../project.js";
import type { GscQueriesOptions, GscQueryResult } from "./types.js";

export async function gscQueries(
  projectSlug: string,
  options: GscQueriesOptions = {}
): Promise<GscQueryResult[]> {
  const project = getProject(projectSlug);
  if (!project) {
    throw new Error(`Project "${projectSlug}" not found.`);
  }

  const auth = createAuthenticatedClient();
  if (!auth) {
    throw new Error(
      "GSC not authenticated. Run `seoagent gsc auth` to connect your Google account."
    );
  }

  const siteUrl = `sc-domain:${project.config.domain}`;
  const limit = options.limit ?? 20;

  const params = buildQueryParams(siteUrl, {
    dimensions: ["query"],
    days: options.days,
    rowLimit: limit,
    pageFilter: options.page,
  });

  const rows = await executeGscQuery(auth, params);

  const results: GscQueryResult[] = rows.map((row) => ({
    query: row.keys![0],
    clicks: row.clicks ?? 0,
    impressions: row.impressions ?? 0,
    ctr: row.ctr ?? 0,
    position: row.position ?? 0,
  }));

  results.sort((a, b) => b.clicks - a.clicks);

  return results;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && pnpm test -- src/__tests__/gsc-queries.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/gsc/queries.ts packages/core/src/__tests__/gsc-queries.test.ts
git commit -m "feat(core): add gscQueries function"
```

---

### Task 7: Implement GSC Data Sync to SQLite

**Files:**
- Create: `packages/core/src/__tests__/gsc-sync.test.ts`
- Create: `packages/core/src/gsc/sync.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/__tests__/gsc-sync.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { openDatabase, closeDatabase } from "../database.js";
import { syncGscRows, getGscHistory } from "../gsc/sync.js";
import type Database from "better-sqlite3";

describe("gsc sync", () => {
  let tmpDir: string;
  let db: Database.Database;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "seoagent-gsc-sync-"));
    const dbPath = path.join(tmpDir, "seoagent.db");
    db = openDatabase(dbPath);
  });

  afterEach(() => {
    closeDatabase(db);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("inserts performance rows into gsc_data table", () => {
    const rows = [
      { date: "2026-03-01", query: "seo tips", page: "https://example.com/blog", clicks: 50, impressions: 500, ctr: 0.1, position: 4.2 },
      { date: "2026-03-02", query: "seo tips", page: "https://example.com/blog", clicks: 60, impressions: 600, ctr: 0.1, position: 3.8 },
    ];

    syncGscRows(db, rows);

    const result = db
      .prepare("SELECT COUNT(*) as count FROM gsc_data")
      .get() as { count: number };
    expect(result.count).toBe(2);
  });

  it("upserts on same date+query+page combination", () => {
    const row = {
      date: "2026-03-01",
      query: "seo tips",
      page: "https://example.com/blog",
      clicks: 50,
      impressions: 500,
      ctr: 0.1,
      position: 4.2,
    };

    syncGscRows(db, [row]);
    syncGscRows(db, [{ ...row, clicks: 80 }]);

    const result = db
      .prepare("SELECT COUNT(*) as count FROM gsc_data")
      .get() as { count: number };
    expect(result.count).toBe(1);

    const updated = db
      .prepare("SELECT clicks FROM gsc_data WHERE date = ? AND query = ? AND page = ?")
      .get("2026-03-01", "seo tips", "https://example.com/blog") as { clicks: number };
    expect(updated.clicks).toBe(80);
  });

  it("handles rows with null query (page-level data)", () => {
    const rows = [
      { date: "2026-03-01", query: null, page: "https://example.com/", clicks: 100, impressions: 1000, ctr: 0.1, position: 5.0 },
    ];

    syncGscRows(db, rows);

    const result = db
      .prepare("SELECT * FROM gsc_data WHERE page = ?")
      .get("https://example.com/") as { clicks: number; query: string | null };
    expect(result.clicks).toBe(100);
    expect(result.query).toBeNull();
  });

  it("handles rows with null page (query-level data)", () => {
    const rows = [
      { date: "2026-03-01", query: "seo tips", page: null, clicks: 100, impressions: 1000, ctr: 0.1, position: 5.0 },
    ];

    syncGscRows(db, rows);

    const result = db
      .prepare("SELECT * FROM gsc_data WHERE query = ?")
      .get("seo tips") as { clicks: number; page: string | null };
    expect(result.clicks).toBe(100);
    expect(result.page).toBeNull();
  });

  it("retrieves historical data with getGscHistory", () => {
    const rows = [
      { date: "2026-03-01", query: "seo tips", page: "https://example.com/blog", clicks: 50, impressions: 500, ctr: 0.1, position: 4.2 },
      { date: "2026-03-02", query: "seo tools", page: "https://example.com/tools", clicks: 30, impressions: 300, ctr: 0.1, position: 6.0 },
      { date: "2026-03-03", query: "seo tips", page: "https://example.com/blog", clicks: 70, impressions: 700, ctr: 0.1, position: 3.5 },
    ];

    syncGscRows(db, rows);

    const history = getGscHistory(db, { query: "seo tips" });
    expect(history).toHaveLength(2);
    expect(history[0].date).toBe("2026-03-01");
    expect(history[1].date).toBe("2026-03-03");
  });

  it("filters history by date range", () => {
    const rows = [
      { date: "2026-03-01", query: "seo", page: null, clicks: 10, impressions: 100, ctr: 0.1, position: 5.0 },
      { date: "2026-03-15", query: "seo", page: null, clicks: 20, impressions: 200, ctr: 0.1, position: 4.0 },
      { date: "2026-03-28", query: "seo", page: null, clicks: 30, impressions: 300, ctr: 0.1, position: 3.0 },
    ];

    syncGscRows(db, rows);

    const history = getGscHistory(db, {
      startDate: "2026-03-10",
      endDate: "2026-03-20",
    });
    expect(history).toHaveLength(1);
    expect(history[0].date).toBe("2026-03-15");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm test -- src/__tests__/gsc-sync.test.ts`
Expected: FAIL — module `../gsc/sync.js` not found

- [ ] **Step 3: Add unique constraint for upsert support**

The `gsc_data` table from Plan 1 does not have a unique constraint needed for upserts. Add an idempotent migration in `sync.ts` that creates a unique index if it does not exist:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_gsc_data_unique ON gsc_data(date, COALESCE(query, ''), COALESCE(page, ''));
```

This is applied at the start of `syncGscRows` to keep it self-contained.

- [ ] **Step 4: Write the implementation**

Create `packages/core/src/gsc/sync.ts`:

```typescript
import type Database from "better-sqlite3";

export interface GscSyncRow {
  date: string;
  query: string | null;
  page: string | null;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscHistoryFilter {
  query?: string;
  page?: string;
  startDate?: string;
  endDate?: string;
}

function ensureUniqueIndex(db: Database.Database): void {
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_gsc_data_unique
    ON gsc_data(date, COALESCE(query, ''), COALESCE(page, ''));
  `);
}

export function syncGscRows(
  db: Database.Database,
  rows: GscSyncRow[]
): void {
  ensureUniqueIndex(db);

  const upsert = db.prepare(`
    INSERT INTO gsc_data (date, query, page, clicks, impressions, ctr, position, synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT (date, COALESCE(query, ''), COALESCE(page, ''))
    DO UPDATE SET
      clicks = excluded.clicks,
      impressions = excluded.impressions,
      ctr = excluded.ctr,
      position = excluded.position,
      synced_at = datetime('now')
  `);

  const insertMany = db.transaction((items: GscSyncRow[]) => {
    for (const row of items) {
      upsert.run(
        row.date,
        row.query,
        row.page,
        row.clicks,
        row.impressions,
        row.ctr,
        row.position
      );
    }
  });

  insertMany(rows);
}

export function getGscHistory(
  db: Database.Database,
  filter: GscHistoryFilter = {}
): GscSyncRow[] {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filter.query !== undefined) {
    conditions.push("query = ?");
    params.push(filter.query);
  }

  if (filter.page !== undefined) {
    conditions.push("page = ?");
    params.push(filter.page);
  }

  if (filter.startDate !== undefined) {
    conditions.push("date >= ?");
    params.push(filter.startDate);
  }

  if (filter.endDate !== undefined) {
    conditions.push("date <= ?");
    params.push(filter.endDate);
  }

  const where =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const rows = db
    .prepare(
      `SELECT date, query, page, clicks, impressions, ctr, position
       FROM gsc_data ${where}
       ORDER BY date ASC`
    )
    .all(...params) as GscSyncRow[];

  return rows;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/core && pnpm test -- src/__tests__/gsc-sync.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/gsc/sync.ts packages/core/src/__tests__/gsc-sync.test.ts
git commit -m "feat(core): add GSC data sync to SQLite with upsert support"
```

---

### Task 8: Export from Barrel and Final Verification

**Files:**
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Update barrel exports**

Add the following exports to `packages/core/src/index.ts`:

```typescript
// GSC
export {
  generateAuthUrl,
  exchangeCode,
  saveGscCredentials,
  loadGscCredentials,
  createAuthenticatedClient,
} from "./gsc/auth.js";
export { gscPerformance } from "./gsc/performance.js";
export { gscPages } from "./gsc/pages.js";
export { gscQueries } from "./gsc/queries.js";
export { syncGscRows, getGscHistory } from "./gsc/sync.js";
export type {
  GscCredentials,
  GscPerformanceOptions,
  GscPerformanceResult,
  GscPagesOptions,
  GscPageResult,
  GscQueriesOptions,
  GscQueryResult,
} from "./gsc/types.js";
export type { GscSyncRow, GscHistoryFilter } from "./gsc/sync.js";
```

- [ ] **Step 2: Verify build**

Run: `cd packages/core && pnpm build`
Expected: Build succeeds, all types and functions exported in `dist/`.

- [ ] **Step 3: Run all GSC tests together**

Run: `cd packages/core && pnpm test -- src/__tests__/gsc`
Expected: All GSC tests pass (6 + 7 + 5 + 5 + 6 + 6 = 35 tests total).

- [ ] **Step 4: Run full test suite to check no regressions**

Run: `cd packages/core && pnpm test`
Expected: All existing tests (paths, config, database, project) and all new GSC tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/index.ts
git commit -m "feat(core): export GSC functions from barrel"
```
