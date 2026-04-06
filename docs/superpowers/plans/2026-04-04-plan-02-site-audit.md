# Site Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local site crawler and SEO audit engine that crawls a domain, detects SEO issues, and stores results in SQLite for reporting.

**Architecture:** Three core functions (`auditCrawl`, `auditReport`, `auditPage`) backed by a BFS crawler with concurrency control. The crawler uses `undici` for HTTP requests and `cheerio` for HTML parsing. Results are stored in the existing `crawl_pages` and `crawl_links` tables. Issue detection runs per-page and cross-page (duplicate titles, orphan pages). A simple robots.txt parser ensures polite crawling.

**Tech Stack:** undici (HTTP), cheerio (HTML parsing), better-sqlite3 (storage), vitest (testing)

---

## File Structure

```
packages/core/
├── package.json                                    # Add undici + cheerio deps
└── src/
    ├── index.ts                                    # Add audit exports
    ├── types.ts                                    # Add audit types
    ├── audit/
    │   ├── fetcher.ts                              # Single-page fetch + parse
    │   ├── robots.ts                               # robots.txt parser
    │   ├── crawler.ts                              # BFS crawl orchestrator
    │   ├── issues.ts                               # Issue detection logic
    │   ├── audit-crawl.ts                          # auditCrawl function
    │   ├── audit-report.ts                         # auditReport function
    │   └── audit-page.ts                           # auditPage function
    └── __tests__/
        ├── fetcher.test.ts
        ├── robots.test.ts
        ├── crawler.test.ts
        ├── issues.test.ts
        ├── audit-crawl.test.ts
        ├── audit-report.test.ts
        └── audit-page.test.ts
```

---

### Task 1: Add Dependencies and Audit Types

**Files:**
- Modify: `packages/core/package.json`
- Modify: `packages/core/src/types.ts`

- [ ] **Step 1: Add undici and cheerio to core package**

Add to `dependencies` in `packages/core/package.json`:

```json
"undici": "^7.0.0",
"cheerio": "^1.0.0"
```

Add to `devDependencies`:

```json
"@types/cheerio": "^0.22.0"
```

Run: `cd packages/core && pnpm install`
Expected: Dependencies installed successfully

- [ ] **Step 2: Add audit types to `types.ts`**

Append to `packages/core/src/types.ts`:

```typescript
// --- Site Audit Types ---

export interface PageData {
  url: string;
  statusCode: number;
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  wordCount: number;
  loadTimeMs: number;
  internalLinks: LinkData[];
  externalLinks: LinkData[];
  imagesWithoutAlt: number;
  issues: PageIssue[];
  redirectChain?: string[];
}

export interface LinkData {
  href: string;
  anchor: string;
}

export type PageIssueType =
  | "missing_title"
  | "missing_meta_description"
  | "missing_h1"
  | "thin_content"
  | "broken_link"
  | "images_without_alt"
  | "redirect_chain"
  | "duplicate_title"
  | "orphan_page";

export interface PageIssue {
  type: PageIssueType;
  message: string;
  severity: "error" | "warning" | "info";
}

export interface CrawlOptions {
  maxPages?: number;
  concurrency?: number;
  userAgent?: string;
}

export interface CrawlStats {
  pagesCrawled: number;
  issuesFound: number;
  timeMs: number;
  brokenLinks: number;
}

export interface AuditReport {
  totalPages: number;
  issuesByType: Record<string, number>;
  pages: AuditReportPage[];
  brokenLinks: AuditBrokenLink[];
  duplicateTitles: AuditDuplicate[];
  orphanPages: string[];
}

export interface AuditReportPage {
  url: string;
  statusCode: number;
  title: string | null;
  metaDescription: string | null;
  wordCount: number;
  issues: PageIssue[];
}

export interface AuditBrokenLink {
  sourceUrl: string;
  targetUrl: string;
  statusCode: number;
}

export interface AuditDuplicate {
  title: string;
  urls: string[];
}

export interface RobotsRules {
  allowed: string[];
  disallowed: string[];
  sitemaps: string[];
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/core/package.json packages/core/src/types.ts pnpm-lock.yaml
git commit -m "feat(core): add audit types and undici/cheerio dependencies"
```

---

### Task 2: Page Fetcher

**Files:**
- Create: `packages/core/src/audit/fetcher.ts`
- Create: `packages/core/src/__tests__/fetcher.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/__tests__/fetcher.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parsePage, extractLinks, resolveUrl } from "../audit/fetcher.js";

const SAMPLE_HTML = `
<!DOCTYPE html>
<html>
<head>
  <title>Test Page Title</title>
  <meta name="description" content="A test meta description">
</head>
<body>
  <h1>Main Heading</h1>
  <p>This is a paragraph with enough words to not be thin content. We need at least a hundred words
  so let us keep writing more text here. The quick brown fox jumps over the lazy dog. Lorem ipsum
  dolor sit amet consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore
  magna aliqua. Ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip
  ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum
  dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident sunt in culpa
  qui officia deserunt mollit anim id est laborum.</p>
  <a href="/about">About Us</a>
  <a href="https://external.com/page">External</a>
  <a href="/contact">Contact</a>
  <img src="logo.png" alt="Logo">
  <img src="photo.jpg">
  <img src="banner.png">
</body>
</html>
`;

const EMPTY_HTML = `
<!DOCTYPE html>
<html>
<head></head>
<body><p>Short.</p></body>
</html>
`;

describe("parsePage", () => {
  it("extracts title from HTML", () => {
    const result = parsePage(SAMPLE_HTML, "https://example.com/");
    expect(result.title).toBe("Test Page Title");
  });

  it("extracts meta description", () => {
    const result = parsePage(SAMPLE_HTML, "https://example.com/");
    expect(result.metaDescription).toBe("A test meta description");
  });

  it("extracts h1", () => {
    const result = parsePage(SAMPLE_HTML, "https://example.com/");
    expect(result.h1).toBe("Main Heading");
  });

  it("counts words in body text", () => {
    const result = parsePage(SAMPLE_HTML, "https://example.com/");
    expect(result.wordCount).toBeGreaterThan(50);
  });

  it("counts images without alt", () => {
    const result = parsePage(SAMPLE_HTML, "https://example.com/");
    expect(result.imagesWithoutAlt).toBe(2);
  });

  it("returns null for missing title", () => {
    const result = parsePage(EMPTY_HTML, "https://example.com/");
    expect(result.title).toBeNull();
  });

  it("returns null for missing meta description", () => {
    const result = parsePage(EMPTY_HTML, "https://example.com/");
    expect(result.metaDescription).toBeNull();
  });

  it("returns null for missing h1", () => {
    const result = parsePage(EMPTY_HTML, "https://example.com/");
    expect(result.h1).toBeNull();
  });
});

describe("extractLinks", () => {
  it("separates internal and external links", () => {
    const { internal, external } = extractLinks(
      SAMPLE_HTML,
      "https://example.com/"
    );
    expect(internal).toHaveLength(2);
    expect(external).toHaveLength(1);
  });

  it("resolves relative URLs to absolute", () => {
    const { internal } = extractLinks(SAMPLE_HTML, "https://example.com/");
    expect(internal[0].href).toBe("https://example.com/about");
    expect(internal[1].href).toBe("https://example.com/contact");
  });

  it("extracts anchor text", () => {
    const { internal } = extractLinks(SAMPLE_HTML, "https://example.com/");
    expect(internal[0].anchor).toBe("About Us");
  });

  it("identifies external links by domain", () => {
    const { external } = extractLinks(SAMPLE_HTML, "https://example.com/");
    expect(external[0].href).toBe("https://external.com/page");
  });
});

describe("resolveUrl", () => {
  it("resolves relative path", () => {
    expect(resolveUrl("/about", "https://example.com/page")).toBe(
      "https://example.com/about"
    );
  });

  it("returns absolute URL as-is", () => {
    expect(resolveUrl("https://other.com/x", "https://example.com/")).toBe(
      "https://other.com/x"
    );
  });

  it("strips fragment from URL", () => {
    expect(resolveUrl("/about#section", "https://example.com/")).toBe(
      "https://example.com/about"
    );
  });

  it("strips trailing slash for consistency", () => {
    expect(resolveUrl("/about/", "https://example.com/")).toBe(
      "https://example.com/about"
    );
  });

  it("keeps root path as single slash", () => {
    expect(resolveUrl("/", "https://example.com/page")).toBe(
      "https://example.com/"
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm test -- src/__tests__/fetcher.test.ts`
Expected: FAIL -- module `../audit/fetcher.js` not found

- [ ] **Step 3: Write implementation**

Create `packages/core/src/audit/fetcher.ts`:

```typescript
import * as cheerio from "cheerio";
import { request } from "undici";
import type { LinkData } from "../types.js";

export interface ParsedPage {
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  wordCount: number;
  imagesWithoutAlt: number;
  internalLinks: LinkData[];
  externalLinks: LinkData[];
}

export interface FetchResult {
  statusCode: number;
  body: string;
  loadTimeMs: number;
  redirectChain: string[];
}

export function resolveUrl(href: string, baseUrl: string): string {
  try {
    const resolved = new URL(href, baseUrl);
    resolved.hash = "";
    // Strip trailing slash unless it's the root path
    if (resolved.pathname !== "/" && resolved.pathname.endsWith("/")) {
      resolved.pathname = resolved.pathname.slice(0, -1);
    }
    return resolved.toString();
  } catch {
    return href;
  }
}

export function parsePage(
  html: string,
  pageUrl: string
): ParsedPage {
  const $ = cheerio.load(html);

  const title = $("title").first().text().trim() || null;
  const metaDescription =
    $('meta[name="description"]').attr("content")?.trim() || null;
  const h1 = $("h1").first().text().trim() || null;

  // Word count: extract body text, split on whitespace
  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  const wordCount = bodyText ? bodyText.split(/\s+/).length : 0;

  // Images without alt
  const images = $("img");
  let imagesWithoutAlt = 0;
  images.each((_, el) => {
    const alt = $(el).attr("alt");
    if (alt === undefined || alt === null) {
      imagesWithoutAlt++;
    }
  });

  const { internal, external } = extractLinks(html, pageUrl);

  return {
    title,
    metaDescription,
    h1,
    wordCount,
    imagesWithoutAlt,
    internalLinks: internal,
    externalLinks: external,
  };
}

export function extractLinks(
  html: string,
  pageUrl: string
): { internal: LinkData[]; external: LinkData[] } {
  const $ = cheerio.load(html);
  const base = new URL(pageUrl);
  const internal: LinkData[] = [];
  const external: LinkData[] = [];

  $("a[href]").each((_, el) => {
    const rawHref = $(el).attr("href");
    if (!rawHref) return;

    // Skip mailto, tel, javascript links
    if (/^(mailto:|tel:|javascript:)/i.test(rawHref)) return;

    const resolved = resolveUrl(rawHref, pageUrl);
    const anchor = $(el).text().trim();

    try {
      const linkUrl = new URL(resolved);
      if (linkUrl.hostname === base.hostname) {
        internal.push({ href: resolved, anchor });
      } else {
        external.push({ href: resolved, anchor });
      }
    } catch {
      // Skip invalid URLs
    }
  });

  return { internal, external };
}

export async function fetchPage(
  url: string,
  userAgent: string
): Promise<FetchResult> {
  const redirectChain: string[] = [];
  let currentUrl = url;
  let statusCode = 0;
  let body = "";
  const start = Date.now();

  // Follow redirects manually to track the chain (max 10 hops)
  for (let i = 0; i < 10; i++) {
    const response = await request(currentUrl, {
      method: "GET",
      headers: { "user-agent": userAgent },
      maxRedirections: 0,
      headersTimeout: 10000,
      bodyTimeout: 10000,
    });

    statusCode = response.statusCode;
    const location = response.headers.location;

    if (statusCode >= 300 && statusCode < 400 && location) {
      redirectChain.push(currentUrl);
      currentUrl = resolveUrl(
        Array.isArray(location) ? location[0] : location,
        currentUrl
      );
      // Consume the body to free the socket
      await response.body.text();
      continue;
    }

    body = await response.body.text();
    break;
  }

  const loadTimeMs = Date.now() - start;

  return { statusCode, body, loadTimeMs, redirectChain };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && pnpm test -- src/__tests__/fetcher.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/audit/fetcher.ts packages/core/src/__tests__/fetcher.test.ts
git commit -m "feat(core): add page fetcher with HTML parsing and link extraction"
```

---

### Task 3: Robots.txt Parser

**Files:**
- Create: `packages/core/src/audit/robots.ts`
- Create: `packages/core/src/__tests__/robots.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/__tests__/robots.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseRobotsTxt, isAllowed } from "../audit/robots.js";

const SAMPLE_ROBOTS = `
User-agent: *
Disallow: /admin/
Disallow: /private
Allow: /admin/public

User-agent: Googlebot
Disallow: /no-google/

Sitemap: https://example.com/sitemap.xml
Sitemap: https://example.com/sitemap2.xml
`;

const EMPTY_ROBOTS = ``;

const BLOCK_ALL = `
User-agent: *
Disallow: /
`;

describe("parseRobotsTxt", () => {
  it("parses disallow rules for wildcard user-agent", () => {
    const rules = parseRobotsTxt(SAMPLE_ROBOTS);
    expect(rules.disallowed).toContain("/admin/");
    expect(rules.disallowed).toContain("/private");
  });

  it("parses allow rules for wildcard user-agent", () => {
    const rules = parseRobotsTxt(SAMPLE_ROBOTS);
    expect(rules.allowed).toContain("/admin/public");
  });

  it("extracts sitemaps", () => {
    const rules = parseRobotsTxt(SAMPLE_ROBOTS);
    expect(rules.sitemaps).toEqual([
      "https://example.com/sitemap.xml",
      "https://example.com/sitemap2.xml",
    ]);
  });

  it("returns empty arrays for empty robots.txt", () => {
    const rules = parseRobotsTxt(EMPTY_ROBOTS);
    expect(rules.disallowed).toEqual([]);
    expect(rules.allowed).toEqual([]);
    expect(rules.sitemaps).toEqual([]);
  });
});

describe("isAllowed", () => {
  it("allows URLs not matching any disallow rule", () => {
    const rules = parseRobotsTxt(SAMPLE_ROBOTS);
    expect(isAllowed("/about", rules)).toBe(true);
  });

  it("disallows URLs matching a disallow prefix", () => {
    const rules = parseRobotsTxt(SAMPLE_ROBOTS);
    expect(isAllowed("/admin/settings", rules)).toBe(false);
  });

  it("allows URLs matching an allow rule even if disallowed", () => {
    const rules = parseRobotsTxt(SAMPLE_ROBOTS);
    expect(isAllowed("/admin/public", rules)).toBe(true);
  });

  it("disallows everything when Disallow: /", () => {
    const rules = parseRobotsTxt(BLOCK_ALL);
    expect(isAllowed("/anything", rules)).toBe(false);
  });

  it("allows root path when not explicitly disallowed", () => {
    const rules = parseRobotsTxt(SAMPLE_ROBOTS);
    expect(isAllowed("/", rules)).toBe(true);
  });

  it("disallows exact path match", () => {
    const rules = parseRobotsTxt(SAMPLE_ROBOTS);
    expect(isAllowed("/private", rules)).toBe(false);
    expect(isAllowed("/private/page", rules)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm test -- src/__tests__/robots.test.ts`
Expected: FAIL -- module `../audit/robots.js` not found

- [ ] **Step 3: Write implementation**

Create `packages/core/src/audit/robots.ts`:

```typescript
import type { RobotsRules } from "../types.js";

export function parseRobotsTxt(content: string): RobotsRules {
  const lines = content.split("\n").map((l) => l.trim());
  const allowed: string[] = [];
  const disallowed: string[] = [];
  const sitemaps: string[] = [];

  let inWildcardBlock = false;

  for (const line of lines) {
    // Skip comments and empty lines
    if (line.startsWith("#") || line === "") continue;

    const lower = line.toLowerCase();

    // Detect user-agent blocks
    if (lower.startsWith("user-agent:")) {
      const agent = line.slice("user-agent:".length).trim();
      inWildcardBlock = agent === "*";
      continue;
    }

    // Sitemaps are global (not tied to user-agent)
    if (lower.startsWith("sitemap:")) {
      const url = line.slice("sitemap:".length).trim();
      if (url) sitemaps.push(url);
      continue;
    }

    // Only process rules from the wildcard block
    if (!inWildcardBlock) continue;

    if (lower.startsWith("disallow:")) {
      const path = line.slice("disallow:".length).trim();
      if (path) disallowed.push(path);
    } else if (lower.startsWith("allow:")) {
      const path = line.slice("allow:".length).trim();
      if (path) allowed.push(path);
    }
  }

  return { allowed, disallowed, sitemaps };
}

export function isAllowed(urlPath: string, rules: RobotsRules): boolean {
  // Allow rules take precedence over disallow when path matches both
  // Check most specific match (longer path wins)
  let matchedAllow = "";
  let matchedDisallow = "";

  for (const pattern of rules.allowed) {
    if (urlPath.startsWith(pattern) && pattern.length > matchedAllow.length) {
      matchedAllow = pattern;
    }
  }

  for (const pattern of rules.disallowed) {
    if (urlPath.startsWith(pattern) && pattern.length > matchedDisallow.length) {
      matchedDisallow = pattern;
    }
  }

  // No match at all -- allowed
  if (!matchedDisallow) return true;

  // Allow rule is more specific (longer) -- allowed
  if (matchedAllow && matchedAllow.length >= matchedDisallow.length) return true;

  // Disallowed
  return false;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && pnpm test -- src/__tests__/robots.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/audit/robots.ts packages/core/src/__tests__/robots.test.ts
git commit -m "feat(core): add robots.txt parser with allow/disallow support"
```

---

### Task 4: Crawl Orchestrator

**Files:**
- Create: `packages/core/src/audit/crawler.ts`
- Create: `packages/core/src/__tests__/crawler.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/__tests__/crawler.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { CrawlQueue } from "../audit/crawler.js";
import type { FetchResult } from "../audit/fetcher.js";
import type { RobotsRules } from "../types.js";

describe("CrawlQueue", () => {
  it("crawls seed URL and discovers links", async () => {
    const pages: string[] = [];

    const mockFetch = vi.fn(async (url: string): Promise<FetchResult> => {
      pages.push(url);
      if (url === "https://example.com/") {
        return {
          statusCode: 200,
          body: `<html><head><title>Home</title></head><body>
            <a href="/about">About</a>
            <a href="/contact">Contact</a>
          </body></html>`,
          loadTimeMs: 50,
          redirectChain: [],
        };
      }
      return {
        statusCode: 200,
        body: `<html><head><title>Page</title></head><body><p>Content here.</p></body></html>`,
        loadTimeMs: 30,
        redirectChain: [],
      };
    });

    const queue = new CrawlQueue({
      domain: "example.com",
      seedUrl: "https://example.com/",
      maxPages: 10,
      concurrency: 2,
      fetchFn: mockFetch,
      robotsRules: { allowed: [], disallowed: [], sitemaps: [] },
    });

    const results = await queue.run();

    expect(results.length).toBe(3);
    expect(pages).toContain("https://example.com/");
    expect(pages).toContain("https://example.com/about");
    expect(pages).toContain("https://example.com/contact");
  });

  it("respects maxPages limit", async () => {
    const mockFetch = vi.fn(async (url: string): Promise<FetchResult> => {
      // Every page links to 3 more pages
      const num = parseInt(url.split("/page")[1] || "0", 10);
      return {
        statusCode: 200,
        body: `<html><head><title>Page ${num}</title></head><body>
          <a href="/page${num * 3 + 1}">Link 1</a>
          <a href="/page${num * 3 + 2}">Link 2</a>
          <a href="/page${num * 3 + 3}">Link 3</a>
        </body></html>`,
        loadTimeMs: 10,
        redirectChain: [],
      };
    });

    const queue = new CrawlQueue({
      domain: "example.com",
      seedUrl: "https://example.com/page0",
      maxPages: 5,
      concurrency: 2,
      fetchFn: mockFetch,
      robotsRules: { allowed: [], disallowed: [], sitemaps: [] },
    });

    const results = await queue.run();
    expect(results.length).toBe(5);
  });

  it("respects robots.txt disallow rules", async () => {
    const fetched: string[] = [];
    const mockFetch = vi.fn(async (url: string): Promise<FetchResult> => {
      fetched.push(url);
      return {
        statusCode: 200,
        body: `<html><head><title>Home</title></head><body>
          <a href="/public">Public</a>
          <a href="/admin/secret">Admin</a>
        </body></html>`,
        loadTimeMs: 10,
        redirectChain: [],
      };
    });

    const rules: RobotsRules = {
      allowed: [],
      disallowed: ["/admin/"],
      sitemaps: [],
    };

    const queue = new CrawlQueue({
      domain: "example.com",
      seedUrl: "https://example.com/",
      maxPages: 10,
      concurrency: 1,
      fetchFn: mockFetch,
      robotsRules: rules,
    });

    await queue.run();

    expect(fetched).toContain("https://example.com/");
    expect(fetched).toContain("https://example.com/public");
    expect(fetched).not.toContain("https://example.com/admin/secret");
  });

  it("skips external links", async () => {
    const fetched: string[] = [];
    const mockFetch = vi.fn(async (url: string): Promise<FetchResult> => {
      fetched.push(url);
      return {
        statusCode: 200,
        body: `<html><head><title>Home</title></head><body>
          <a href="/local">Local</a>
          <a href="https://other.com/page">External</a>
        </body></html>`,
        loadTimeMs: 10,
        redirectChain: [],
      };
    });

    const queue = new CrawlQueue({
      domain: "example.com",
      seedUrl: "https://example.com/",
      maxPages: 10,
      concurrency: 1,
      fetchFn: mockFetch,
      robotsRules: { allowed: [], disallowed: [], sitemaps: [] },
    });

    await queue.run();

    expect(fetched).not.toContain("https://other.com/page");
  });

  it("does not revisit already-crawled URLs", async () => {
    let fetchCount = 0;
    const mockFetch = vi.fn(async (): Promise<FetchResult> => {
      fetchCount++;
      return {
        statusCode: 200,
        body: `<html><head><title>Page</title></head><body>
          <a href="/">Home</a>
          <a href="/about">About</a>
        </body></html>`,
        loadTimeMs: 10,
        redirectChain: [],
      };
    });

    const queue = new CrawlQueue({
      domain: "example.com",
      seedUrl: "https://example.com/",
      maxPages: 10,
      concurrency: 1,
      fetchFn: mockFetch,
      robotsRules: { allowed: [], disallowed: [], sitemaps: [] },
    });

    await queue.run();

    // Home + About = 2, not infinite loop
    expect(fetchCount).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm test -- src/__tests__/crawler.test.ts`
Expected: FAIL -- module `../audit/crawler.js` not found

- [ ] **Step 3: Write implementation**

Create `packages/core/src/audit/crawler.ts`:

```typescript
import { parsePage, extractLinks, resolveUrl } from "./fetcher.js";
import { isAllowed } from "./robots.js";
import type { FetchResult } from "./fetcher.js";
import type { PageData, RobotsRules, LinkData } from "../types.js";

export interface CrawlQueueOptions {
  domain: string;
  seedUrl: string;
  maxPages: number;
  concurrency: number;
  fetchFn: (url: string) => Promise<FetchResult>;
  robotsRules: RobotsRules;
}

export interface CrawlResult {
  page: PageData;
  internalLinks: LinkData[];
  externalLinks: LinkData[];
}

export class CrawlQueue {
  private readonly options: CrawlQueueOptions;
  private readonly visited = new Set<string>();
  private readonly queue: string[] = [];
  private readonly results: CrawlResult[] = [];
  private activeCount = 0;

  constructor(options: CrawlQueueOptions) {
    this.options = options;
  }

  async run(): Promise<CrawlResult[]> {
    this.queue.push(this.options.seedUrl);
    this.visited.add(this.options.seedUrl);

    await this.processQueue();

    return this.results;
  }

  private async processQueue(): Promise<void> {
    // Keep processing until queue is empty and no active fetches
    while (this.queue.length > 0 || this.activeCount > 0) {
      // Launch up to concurrency limit
      const promises: Promise<void>[] = [];

      while (
        this.queue.length > 0 &&
        this.activeCount < this.options.concurrency &&
        this.results.length + this.activeCount < this.options.maxPages
      ) {
        const url = this.queue.shift()!;
        this.activeCount++;
        promises.push(this.processUrl(url));
      }

      if (promises.length > 0) {
        await Promise.all(promises);
      } else if (this.activeCount > 0) {
        // Wait a tick for active fetches to complete
        await new Promise((resolve) => setTimeout(resolve, 1));
      } else {
        break;
      }
    }
  }

  private async processUrl(url: string): Promise<void> {
    try {
      const fetchResult = await this.options.fetchFn(url);

      const parsed = parsePage(fetchResult.body, url);
      const { internal, external } = extractLinks(fetchResult.body, url);

      const page: PageData = {
        url,
        statusCode: fetchResult.statusCode,
        title: parsed.title,
        metaDescription: parsed.metaDescription,
        h1: parsed.h1,
        wordCount: parsed.wordCount,
        loadTimeMs: fetchResult.loadTimeMs,
        internalLinks: internal,
        externalLinks: external,
        imagesWithoutAlt: parsed.imagesWithoutAlt,
        issues: [],
        redirectChain:
          fetchResult.redirectChain.length > 0
            ? fetchResult.redirectChain
            : undefined,
      };

      this.results.push({
        page,
        internalLinks: internal,
        externalLinks: external,
      });

      // Enqueue discovered internal links
      for (const link of internal) {
        if (this.visited.has(link.href)) continue;
        if (this.results.length + this.activeCount + this.queue.length >= this.options.maxPages) break;

        try {
          const linkUrl = new URL(link.href);
          if (linkUrl.hostname !== this.options.domain) continue;
          if (!isAllowed(linkUrl.pathname, this.options.robotsRules)) continue;

          this.visited.add(link.href);
          this.queue.push(link.href);
        } catch {
          // Skip invalid URLs
        }
      }
    } catch {
      // Network errors -- record as a failed page
      const page: PageData = {
        url,
        statusCode: 0,
        title: null,
        metaDescription: null,
        h1: null,
        wordCount: 0,
        loadTimeMs: 0,
        internalLinks: [],
        externalLinks: [],
        imagesWithoutAlt: 0,
        issues: [
          {
            type: "broken_link",
            message: `Failed to fetch ${url}`,
            severity: "error",
          },
        ],
      };
      this.results.push({
        page,
        internalLinks: [],
        externalLinks: [],
      });
    } finally {
      this.activeCount--;
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && pnpm test -- src/__tests__/crawler.test.ts`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/audit/crawler.ts packages/core/src/__tests__/crawler.test.ts
git commit -m "feat(core): add BFS crawl orchestrator with concurrency and robots.txt"
```

---

### Task 5: Issue Detector

**Files:**
- Create: `packages/core/src/audit/issues.ts`
- Create: `packages/core/src/__tests__/issues.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/__tests__/issues.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  detectPageIssues,
  detectDuplicateTitles,
  detectOrphanPages,
} from "../audit/issues.js";
import type { PageData } from "../types.js";

function makePage(overrides: Partial<PageData> = {}): PageData {
  return {
    url: "https://example.com/page",
    statusCode: 200,
    title: "Page Title",
    metaDescription: "A meta description for the page.",
    h1: "Main Heading",
    wordCount: 500,
    loadTimeMs: 200,
    internalLinks: [],
    externalLinks: [],
    imagesWithoutAlt: 0,
    issues: [],
    ...overrides,
  };
}

describe("detectPageIssues", () => {
  it("returns no issues for a healthy page", () => {
    const page = makePage();
    const issues = detectPageIssues(page);
    expect(issues).toEqual([]);
  });

  it("detects missing title", () => {
    const page = makePage({ title: null });
    const issues = detectPageIssues(page);
    expect(issues).toContainEqual(
      expect.objectContaining({ type: "missing_title", severity: "error" })
    );
  });

  it("detects missing meta description", () => {
    const page = makePage({ metaDescription: null });
    const issues = detectPageIssues(page);
    expect(issues).toContainEqual(
      expect.objectContaining({
        type: "missing_meta_description",
        severity: "warning",
      })
    );
  });

  it("detects missing h1", () => {
    const page = makePage({ h1: null });
    const issues = detectPageIssues(page);
    expect(issues).toContainEqual(
      expect.objectContaining({ type: "missing_h1", severity: "warning" })
    );
  });

  it("detects thin content (fewer than 200 words)", () => {
    const page = makePage({ wordCount: 50 });
    const issues = detectPageIssues(page);
    expect(issues).toContainEqual(
      expect.objectContaining({ type: "thin_content", severity: "warning" })
    );
  });

  it("does not flag thin content at 200 words", () => {
    const page = makePage({ wordCount: 200 });
    const issues = detectPageIssues(page);
    expect(issues.find((i) => i.type === "thin_content")).toBeUndefined();
  });

  it("detects images without alt text", () => {
    const page = makePage({ imagesWithoutAlt: 3 });
    const issues = detectPageIssues(page);
    expect(issues).toContainEqual(
      expect.objectContaining({
        type: "images_without_alt",
        severity: "warning",
      })
    );
  });

  it("detects broken page (4xx status)", () => {
    const page = makePage({ statusCode: 404 });
    const issues = detectPageIssues(page);
    expect(issues).toContainEqual(
      expect.objectContaining({ type: "broken_link", severity: "error" })
    );
  });

  it("detects broken page (5xx status)", () => {
    const page = makePage({ statusCode: 500 });
    const issues = detectPageIssues(page);
    expect(issues).toContainEqual(
      expect.objectContaining({ type: "broken_link", severity: "error" })
    );
  });

  it("detects redirect chain (more than 1 redirect)", () => {
    const page = makePage({
      redirectChain: [
        "https://example.com/old",
        "https://example.com/older",
      ],
    });
    const issues = detectPageIssues(page);
    expect(issues).toContainEqual(
      expect.objectContaining({
        type: "redirect_chain",
        severity: "warning",
      })
    );
  });

  it("does not flag a single redirect as a chain", () => {
    const page = makePage({
      redirectChain: ["https://example.com/old"],
    });
    const issues = detectPageIssues(page);
    expect(issues.find((i) => i.type === "redirect_chain")).toBeUndefined();
  });
});

describe("detectDuplicateTitles", () => {
  it("returns empty when all titles are unique", () => {
    const pages = [
      makePage({ url: "https://example.com/a", title: "Title A" }),
      makePage({ url: "https://example.com/b", title: "Title B" }),
    ];
    const dupes = detectDuplicateTitles(pages);
    expect(dupes).toEqual([]);
  });

  it("detects pages with the same title", () => {
    const pages = [
      makePage({ url: "https://example.com/a", title: "Same Title" }),
      makePage({ url: "https://example.com/b", title: "Same Title" }),
      makePage({ url: "https://example.com/c", title: "Unique" }),
    ];
    const dupes = detectDuplicateTitles(pages);
    expect(dupes).toHaveLength(1);
    expect(dupes[0].title).toBe("Same Title");
    expect(dupes[0].urls).toContain("https://example.com/a");
    expect(dupes[0].urls).toContain("https://example.com/b");
  });

  it("ignores pages with null titles", () => {
    const pages = [
      makePage({ url: "https://example.com/a", title: null }),
      makePage({ url: "https://example.com/b", title: null }),
    ];
    const dupes = detectDuplicateTitles(pages);
    expect(dupes).toEqual([]);
  });
});

describe("detectOrphanPages", () => {
  it("identifies pages with no incoming internal links", () => {
    // Page A links to B, but nobody links to A
    const pages = [
      makePage({
        url: "https://example.com/a",
        internalLinks: [{ href: "https://example.com/b", anchor: "B" }],
      }),
      makePage({
        url: "https://example.com/b",
        internalLinks: [],
      }),
    ];
    // A is the seed URL, B has an incoming link from A.
    // If A is the seed, it should not be considered an orphan.
    const orphans = detectOrphanPages(pages, "https://example.com/a");
    expect(orphans).toEqual([]);
  });

  it("detects orphan page that receives no links and is not seed", () => {
    const pages = [
      makePage({
        url: "https://example.com/",
        internalLinks: [{ href: "https://example.com/about", anchor: "About" }],
      }),
      makePage({
        url: "https://example.com/about",
        internalLinks: [],
      }),
      makePage({
        url: "https://example.com/orphan",
        internalLinks: [],
      }),
    ];
    const orphans = detectOrphanPages(pages, "https://example.com/");
    expect(orphans).toContain("https://example.com/orphan");
    expect(orphans).not.toContain("https://example.com/about");
    expect(orphans).not.toContain("https://example.com/");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm test -- src/__tests__/issues.test.ts`
Expected: FAIL -- module `../audit/issues.js` not found

- [ ] **Step 3: Write implementation**

Create `packages/core/src/audit/issues.ts`:

```typescript
import type { PageData, PageIssue, AuditDuplicate } from "../types.js";

const THIN_CONTENT_THRESHOLD = 200;

export function detectPageIssues(page: PageData): PageIssue[] {
  const issues: PageIssue[] = [];

  if (!page.title) {
    issues.push({
      type: "missing_title",
      message: "Page is missing a <title> tag",
      severity: "error",
    });
  }

  if (!page.metaDescription) {
    issues.push({
      type: "missing_meta_description",
      message: "Page is missing a meta description",
      severity: "warning",
    });
  }

  if (!page.h1) {
    issues.push({
      type: "missing_h1",
      message: "Page is missing an <h1> tag",
      severity: "warning",
    });
  }

  if (page.wordCount < THIN_CONTENT_THRESHOLD) {
    issues.push({
      type: "thin_content",
      message: `Page has only ${page.wordCount} words (minimum ${THIN_CONTENT_THRESHOLD})`,
      severity: "warning",
    });
  }

  if (page.statusCode >= 400) {
    issues.push({
      type: "broken_link",
      message: `Page returned HTTP ${page.statusCode}`,
      severity: "error",
    });
  }

  if (page.imagesWithoutAlt > 0) {
    issues.push({
      type: "images_without_alt",
      message: `${page.imagesWithoutAlt} image(s) missing alt text`,
      severity: "warning",
    });
  }

  if (page.redirectChain && page.redirectChain.length > 1) {
    issues.push({
      type: "redirect_chain",
      message: `Redirect chain with ${page.redirectChain.length} hops`,
      severity: "warning",
    });
  }

  return issues;
}

export function detectDuplicateTitles(pages: PageData[]): AuditDuplicate[] {
  const titleMap = new Map<string, string[]>();

  for (const page of pages) {
    if (!page.title) continue;
    const existing = titleMap.get(page.title) ?? [];
    existing.push(page.url);
    titleMap.set(page.title, existing);
  }

  const duplicates: AuditDuplicate[] = [];
  for (const [title, urls] of titleMap) {
    if (urls.length > 1) {
      duplicates.push({ title, urls });
    }
  }

  return duplicates;
}

export function detectOrphanPages(
  pages: PageData[],
  seedUrl: string
): string[] {
  // Build set of all URLs that receive at least one internal link
  const linkedUrls = new Set<string>();
  for (const page of pages) {
    for (const link of page.internalLinks) {
      linkedUrls.add(link.href);
    }
  }

  // A page is an orphan if it has no incoming links and is not the seed URL
  const orphans: string[] = [];
  for (const page of pages) {
    if (page.url === seedUrl) continue;
    if (!linkedUrls.has(page.url)) {
      orphans.push(page.url);
    }
  }

  return orphans;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && pnpm test -- src/__tests__/issues.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/audit/issues.ts packages/core/src/__tests__/issues.test.ts
git commit -m "feat(core): add SEO issue detection (per-page, duplicates, orphans)"
```

---

### Task 6: `auditCrawl` -- Full Crawl with DB Storage

**Files:**
- Create: `packages/core/src/audit/audit-crawl.ts`
- Create: `packages/core/src/__tests__/audit-crawl.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/__tests__/audit-crawl.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { openDatabase, closeDatabase } from "../database.js";
import { auditCrawl } from "../audit/audit-crawl.js";
import type Database from "better-sqlite3";

// Mock the fetcher module to avoid real HTTP requests
vi.mock("../audit/fetcher.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../audit/fetcher.js")>();
  return {
    ...original,
    fetchPage: vi.fn(async (url: string) => {
      if (url.includes("robots.txt")) {
        return {
          statusCode: 200,
          body: "User-agent: *\nDisallow: /admin/\n",
          loadTimeMs: 10,
          redirectChain: [],
        };
      }
      if (url === "https://example.com/" || url === "https://example.com") {
        return {
          statusCode: 200,
          body: `<html><head><title>Home</title><meta name="description" content="Homepage"></head>
          <body><h1>Welcome</h1>
          <p>${"word ".repeat(250)}</p>
          <a href="/about">About</a>
          <a href="/missing">Missing</a>
          </body></html>`,
          loadTimeMs: 100,
          redirectChain: [],
        };
      }
      if (url === "https://example.com/about") {
        return {
          statusCode: 200,
          body: `<html><head><title>About</title><meta name="description" content="About us"></head>
          <body><h1>About</h1>
          <p>${"word ".repeat(300)}</p>
          <a href="/">Home</a>
          </body></html>`,
          loadTimeMs: 80,
          redirectChain: [],
        };
      }
      if (url === "https://example.com/missing") {
        return {
          statusCode: 404,
          body: "<html><head><title>Not Found</title></head><body>404</body></html>",
          loadTimeMs: 20,
          redirectChain: [],
        };
      }
      return {
        statusCode: 200,
        body: "<html><head></head><body>Default</body></html>",
        loadTimeMs: 10,
        redirectChain: [],
      };
    }),
  };
});

describe("auditCrawl", () => {
  let tmpDir: string;
  let db: Database.Database;
  let dbPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "seoagent-crawl-test-"));
    dbPath = path.join(tmpDir, "seoagent.db");
    db = openDatabase(dbPath);
  });

  afterEach(() => {
    closeDatabase(db);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("crawls domain and returns stats", async () => {
    const stats = await auditCrawl("example.com", db, { maxPages: 10 });

    expect(stats.pagesCrawled).toBeGreaterThanOrEqual(2);
    expect(stats.timeMs).toBeGreaterThan(0);
  });

  it("stores crawled pages in crawl_pages table", async () => {
    await auditCrawl("example.com", db, { maxPages: 10 });

    const rows = db.prepare("SELECT * FROM crawl_pages").all() as {
      url: string;
      status_code: number;
      title: string;
    }[];

    expect(rows.length).toBeGreaterThanOrEqual(2);
    const homeRow = rows.find((r) => r.url === "https://example.com/");
    expect(homeRow).toBeDefined();
    expect(homeRow!.title).toBe("Home");
    expect(homeRow!.status_code).toBe(200);
  });

  it("stores links in crawl_links table", async () => {
    await auditCrawl("example.com", db, { maxPages: 10 });

    const rows = db.prepare("SELECT * FROM crawl_links").all() as {
      source_url: string;
      target_url: string;
      is_internal: number;
    }[];

    expect(rows.length).toBeGreaterThan(0);
    const homeToAbout = rows.find(
      (r) =>
        r.source_url === "https://example.com/" &&
        r.target_url === "https://example.com/about"
    );
    expect(homeToAbout).toBeDefined();
    expect(homeToAbout!.is_internal).toBe(1);
  });

  it("stores issues as JSON in crawl_pages", async () => {
    await auditCrawl("example.com", db, { maxPages: 10 });

    const row = db
      .prepare("SELECT issues FROM crawl_pages WHERE url = ?")
      .get("https://example.com/missing") as { issues: string } | undefined;

    if (row) {
      const issues = JSON.parse(row.issues);
      expect(issues).toContainEqual(
        expect.objectContaining({ type: "broken_link" })
      );
    }
  });

  it("counts broken links in stats", async () => {
    const stats = await auditCrawl("example.com", db, { maxPages: 10 });
    expect(stats.brokenLinks).toBeGreaterThanOrEqual(1);
  });

  it("clears previous crawl data before new crawl", async () => {
    await auditCrawl("example.com", db, { maxPages: 10 });
    const count1 = (
      db.prepare("SELECT COUNT(*) as c FROM crawl_pages").get() as { c: number }
    ).c;

    // Crawl again
    await auditCrawl("example.com", db, { maxPages: 10 });
    const count2 = (
      db.prepare("SELECT COUNT(*) as c FROM crawl_pages").get() as { c: number }
    ).c;

    // Should not accumulate -- second crawl replaces first
    expect(count2).toBe(count1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm test -- src/__tests__/audit-crawl.test.ts`
Expected: FAIL -- module `../audit/audit-crawl.js` not found

- [ ] **Step 3: Write implementation**

Create `packages/core/src/audit/audit-crawl.ts`:

```typescript
import type Database from "better-sqlite3";
import { fetchPage } from "./fetcher.js";
import { parseRobotsTxt } from "./robots.js";
import { CrawlQueue } from "./crawler.js";
import { detectPageIssues, detectDuplicateTitles, detectOrphanPages } from "./issues.js";
import type { CrawlOptions, CrawlStats } from "../types.js";

const DEFAULT_MAX_PAGES = 500;
const DEFAULT_CONCURRENCY = 5;
const DEFAULT_USER_AGENT = "SEOAgent/1.0";

export async function auditCrawl(
  domain: string,
  db: Database.Database,
  options: CrawlOptions = {}
): Promise<CrawlStats> {
  const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;
  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;
  const userAgent = options.userAgent ?? DEFAULT_USER_AGENT;

  const startTime = Date.now();

  // Clear previous crawl data
  db.prepare("DELETE FROM crawl_links").run();
  db.prepare("DELETE FROM crawl_pages").run();

  // Fetch robots.txt
  let robotsContent = "";
  try {
    const robotsResult = await fetchPage(
      `https://${domain}/robots.txt`,
      userAgent
    );
    if (robotsResult.statusCode === 200) {
      robotsContent = robotsResult.body;
    }
  } catch {
    // robots.txt not available -- crawl everything
  }
  const robotsRules = parseRobotsTxt(robotsContent);

  // Build seed URL
  const seedUrl = `https://${domain}/`;

  // Run crawler
  const queue = new CrawlQueue({
    domain,
    seedUrl,
    maxPages,
    concurrency,
    fetchFn: (url: string) => fetchPage(url, userAgent),
    robotsRules,
  });

  const crawlResults = await queue.run();

  // Detect per-page issues
  const allPages = crawlResults.map((r) => r.page);
  for (const page of allPages) {
    page.issues = detectPageIssues(page);
  }

  // Detect cross-page issues: duplicate titles
  const duplicateTitles = detectDuplicateTitles(allPages);
  for (const dupe of duplicateTitles) {
    for (const page of allPages) {
      if (dupe.urls.includes(page.url)) {
        page.issues.push({
          type: "duplicate_title",
          message: `Title "${dupe.title}" is shared with ${dupe.urls.length - 1} other page(s)`,
          severity: "warning",
        });
      }
    }
  }

  // Detect orphan pages
  const orphanUrls = detectOrphanPages(allPages, seedUrl);
  for (const page of allPages) {
    if (orphanUrls.includes(page.url)) {
      page.issues.push({
        type: "orphan_page",
        message: "Page has no incoming internal links",
        severity: "info",
      });
    }
  }

  // Store results in database
  const insertPage = db.prepare(`
    INSERT OR REPLACE INTO crawl_pages (url, status_code, title, meta_description, h1, word_count, load_time_ms, issues, crawled_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);

  const insertLink = db.prepare(`
    INSERT INTO crawl_links (source_url, target_url, anchor_text, is_internal, status_code)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertTransaction = db.transaction(() => {
    for (const result of crawlResults) {
      const { page } = result;

      insertPage.run(
        page.url,
        page.statusCode,
        page.title,
        page.metaDescription,
        page.h1,
        page.wordCount,
        page.loadTimeMs,
        JSON.stringify(page.issues)
      );

      for (const link of result.internalLinks) {
        insertLink.run(page.url, link.href, link.anchor, 1, null);
      }

      for (const link of result.externalLinks) {
        insertLink.run(page.url, link.href, link.anchor, 0, null);
      }
    }
  });

  insertTransaction();

  // Compute stats
  let issuesFound = 0;
  let brokenLinks = 0;
  for (const page of allPages) {
    issuesFound += page.issues.length;
    if (page.statusCode >= 400) {
      brokenLinks++;
    }
  }

  return {
    pagesCrawled: allPages.length,
    issuesFound,
    brokenLinks,
    timeMs: Date.now() - startTime,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && pnpm test -- src/__tests__/audit-crawl.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/audit/audit-crawl.ts packages/core/src/__tests__/audit-crawl.test.ts
git commit -m "feat(core): add auditCrawl function with DB storage"
```

---

### Task 7: `auditReport` -- Aggregate Issues from DB

**Files:**
- Create: `packages/core/src/audit/audit-report.ts`
- Create: `packages/core/src/__tests__/audit-report.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/__tests__/audit-report.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { openDatabase, closeDatabase } from "../database.js";
import { auditReport } from "../audit/audit-report.js";
import type Database from "better-sqlite3";

describe("auditReport", () => {
  let tmpDir: string;
  let db: Database.Database;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "seoagent-report-test-"));
    const dbPath = path.join(tmpDir, "seoagent.db");
    db = openDatabase(dbPath);

    // Seed crawl data
    const insertPage = db.prepare(`
      INSERT INTO crawl_pages (url, status_code, title, meta_description, h1, word_count, load_time_ms, issues)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertLink = db.prepare(`
      INSERT INTO crawl_links (source_url, target_url, anchor_text, is_internal, status_code)
      VALUES (?, ?, ?, ?, ?)
    `);

    insertPage.run(
      "https://example.com/",
      200,
      "Home",
      "Welcome to example",
      "Welcome",
      500,
      100,
      JSON.stringify([])
    );

    insertPage.run(
      "https://example.com/about",
      200,
      "Home",
      null,
      "About",
      300,
      80,
      JSON.stringify([
        { type: "missing_meta_description", message: "Missing meta", severity: "warning" },
        { type: "duplicate_title", message: "Duplicate title", severity: "warning" },
      ])
    );

    insertPage.run(
      "https://example.com/missing",
      404,
      "Not Found",
      null,
      null,
      10,
      20,
      JSON.stringify([
        { type: "broken_link", message: "HTTP 404", severity: "error" },
      ])
    );

    insertLink.run("https://example.com/", "https://example.com/about", "About", 1, null);
    insertLink.run("https://example.com/", "https://example.com/missing", "Missing", 1, null);
    insertLink.run("https://example.com/about", "https://example.com/", "Home", 1, null);
  });

  afterEach(() => {
    closeDatabase(db);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns total page count", () => {
    const report = auditReport(db);
    expect(report.totalPages).toBe(3);
  });

  it("aggregates issues by type", () => {
    const report = auditReport(db);
    expect(report.issuesByType["broken_link"]).toBe(1);
    expect(report.issuesByType["missing_meta_description"]).toBe(1);
    expect(report.issuesByType["duplicate_title"]).toBe(1);
  });

  it("returns all pages with their issues", () => {
    const report = auditReport(db);
    expect(report.pages).toHaveLength(3);
    const aboutPage = report.pages.find((p) => p.url === "https://example.com/about");
    expect(aboutPage).toBeDefined();
    expect(aboutPage!.issues).toHaveLength(2);
  });

  it("identifies broken links with source and target", () => {
    const report = auditReport(db);
    expect(report.brokenLinks).toContainEqual({
      sourceUrl: "https://example.com/",
      targetUrl: "https://example.com/missing",
      statusCode: 404,
    });
  });

  it("identifies duplicate titles", () => {
    const report = auditReport(db);
    expect(report.duplicateTitles).toHaveLength(1);
    expect(report.duplicateTitles[0].title).toBe("Home");
    expect(report.duplicateTitles[0].urls).toContain("https://example.com/");
    expect(report.duplicateTitles[0].urls).toContain("https://example.com/about");
  });

  it("returns empty report when no crawl data exists", () => {
    db.prepare("DELETE FROM crawl_pages").run();
    db.prepare("DELETE FROM crawl_links").run();

    const report = auditReport(db);
    expect(report.totalPages).toBe(0);
    expect(report.pages).toEqual([]);
    expect(report.brokenLinks).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm test -- src/__tests__/audit-report.test.ts`
Expected: FAIL -- module `../audit/audit-report.js` not found

- [ ] **Step 3: Write implementation**

Create `packages/core/src/audit/audit-report.ts`:

```typescript
import type Database from "better-sqlite3";
import type {
  AuditReport,
  AuditReportPage,
  AuditBrokenLink,
  AuditDuplicate,
  PageIssue,
} from "../types.js";

interface CrawlPageRow {
  url: string;
  status_code: number;
  title: string | null;
  meta_description: string | null;
  word_count: number;
  issues: string;
}

interface CrawlLinkRow {
  source_url: string;
  target_url: string;
  is_internal: number;
}

export function auditReport(db: Database.Database): AuditReport {
  const pageRows = db
    .prepare("SELECT url, status_code, title, meta_description, word_count, issues FROM crawl_pages")
    .all() as CrawlPageRow[];

  if (pageRows.length === 0) {
    return {
      totalPages: 0,
      issuesByType: {},
      pages: [],
      brokenLinks: [],
      duplicateTitles: [],
      orphanPages: [],
    };
  }

  // Build pages list and aggregate issues
  const issuesByType: Record<string, number> = {};
  const pages: AuditReportPage[] = [];

  for (const row of pageRows) {
    let issues: PageIssue[] = [];
    try {
      issues = JSON.parse(row.issues || "[]");
    } catch {
      issues = [];
    }

    for (const issue of issues) {
      issuesByType[issue.type] = (issuesByType[issue.type] ?? 0) + 1;
    }

    pages.push({
      url: row.url,
      statusCode: row.status_code,
      title: row.title,
      metaDescription: row.meta_description,
      wordCount: row.word_count,
      issues,
    });
  }

  // Find broken links: internal links pointing to pages with 4xx/5xx
  const brokenPageUrls = new Map<string, number>();
  for (const row of pageRows) {
    if (row.status_code >= 400) {
      brokenPageUrls.set(row.url, row.status_code);
    }
  }

  const linkRows = db
    .prepare("SELECT source_url, target_url, is_internal FROM crawl_links WHERE is_internal = 1")
    .all() as CrawlLinkRow[];

  const brokenLinks: AuditBrokenLink[] = [];
  for (const link of linkRows) {
    const brokenStatus = brokenPageUrls.get(link.target_url);
    if (brokenStatus !== undefined) {
      brokenLinks.push({
        sourceUrl: link.source_url,
        targetUrl: link.target_url,
        statusCode: brokenStatus,
      });
    }
  }

  // Find duplicate titles
  const titleMap = new Map<string, string[]>();
  for (const row of pageRows) {
    if (!row.title) continue;
    const urls = titleMap.get(row.title) ?? [];
    urls.push(row.url);
    titleMap.set(row.title, urls);
  }

  const duplicateTitles: AuditDuplicate[] = [];
  for (const [title, urls] of titleMap) {
    if (urls.length > 1) {
      duplicateTitles.push({ title, urls });
    }
  }

  // Find orphan pages: pages with no incoming internal links (except first page)
  const allInternalTargets = new Set<string>();
  for (const link of linkRows) {
    allInternalTargets.add(link.target_url);
  }

  // First page in the table is assumed to be the seed
  const seedUrl = pageRows[0]?.url;
  const orphanPages: string[] = [];
  for (const row of pageRows) {
    if (row.url === seedUrl) continue;
    if (!allInternalTargets.has(row.url)) {
      orphanPages.push(row.url);
    }
  }

  return {
    totalPages: pageRows.length,
    issuesByType,
    pages,
    brokenLinks,
    duplicateTitles,
    orphanPages,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && pnpm test -- src/__tests__/audit-report.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/audit/audit-report.ts packages/core/src/__tests__/audit-report.test.ts
git commit -m "feat(core): add auditReport function to aggregate crawl issues"
```

---

### Task 8: `auditPage` -- Single URL Audit

**Files:**
- Create: `packages/core/src/audit/audit-page.ts`
- Create: `packages/core/src/__tests__/audit-page.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/__tests__/audit-page.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { auditPage } from "../audit/audit-page.js";

vi.mock("../audit/fetcher.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../audit/fetcher.js")>();
  return {
    ...original,
    fetchPage: vi.fn(async (url: string) => {
      if (url === "https://example.com/good") {
        return {
          statusCode: 200,
          body: `<html>
            <head>
              <title>Good Page</title>
              <meta name="description" content="A well-optimized page">
            </head>
            <body>
              <h1>Good Page Heading</h1>
              <p>${"word ".repeat(300)}</p>
              <a href="/other">Other page</a>
              <a href="https://ext.com">External</a>
              <img src="photo.jpg" alt="Photo">
            </body>
          </html>`,
          loadTimeMs: 150,
          redirectChain: [],
        };
      }
      if (url === "https://example.com/bad") {
        return {
          statusCode: 200,
          body: `<html>
            <head></head>
            <body>
              <p>Short.</p>
              <img src="no-alt.jpg">
            </body>
          </html>`,
          loadTimeMs: 300,
          redirectChain: ["https://example.com/old-bad"],
        };
      }
      if (url === "https://example.com/broken") {
        return {
          statusCode: 500,
          body: "Internal Server Error",
          loadTimeMs: 50,
          redirectChain: [],
        };
      }
      return {
        statusCode: 200,
        body: "<html><head><title>Default</title></head><body>OK</body></html>",
        loadTimeMs: 10,
        redirectChain: [],
      };
    }),
  };
});

describe("auditPage", () => {
  it("returns full page data for a healthy page", async () => {
    const result = await auditPage("https://example.com/good");

    expect(result.url).toBe("https://example.com/good");
    expect(result.statusCode).toBe(200);
    expect(result.title).toBe("Good Page");
    expect(result.metaDescription).toBe("A well-optimized page");
    expect(result.h1).toBe("Good Page Heading");
    expect(result.wordCount).toBeGreaterThan(200);
    expect(result.loadTimeMs).toBe(150);
    expect(result.issues).toEqual([]);
  });

  it("detects multiple issues on a bad page", async () => {
    const result = await auditPage("https://example.com/bad");

    const issueTypes = result.issues.map((i) => i.type);
    expect(issueTypes).toContain("missing_title");
    expect(issueTypes).toContain("missing_meta_description");
    expect(issueTypes).toContain("missing_h1");
    expect(issueTypes).toContain("thin_content");
    expect(issueTypes).toContain("images_without_alt");
  });

  it("returns internal and external link counts", async () => {
    const result = await auditPage("https://example.com/good");
    expect(result.internalLinks.length).toBe(1);
    expect(result.externalLinks.length).toBe(1);
  });

  it("detects broken page status", async () => {
    const result = await auditPage("https://example.com/broken");
    const issueTypes = result.issues.map((i) => i.type);
    expect(issueTypes).toContain("broken_link");
  });

  it("reports images without alt", async () => {
    const result = await auditPage("https://example.com/bad");
    expect(result.imagesWithoutAlt).toBe(1);
  });

  it("includes redirect chain when present", async () => {
    const result = await auditPage("https://example.com/bad");
    expect(result.redirectChain).toEqual(["https://example.com/old-bad"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm test -- src/__tests__/audit-page.test.ts`
Expected: FAIL -- module `../audit/audit-page.js` not found

- [ ] **Step 3: Write implementation**

Create `packages/core/src/audit/audit-page.ts`:

```typescript
import { fetchPage, parsePage } from "./fetcher.js";
import { detectPageIssues } from "./issues.js";
import type { PageData } from "../types.js";

const DEFAULT_USER_AGENT = "SEOAgent/1.0";

export async function auditPage(
  url: string,
  userAgent: string = DEFAULT_USER_AGENT
): Promise<PageData> {
  const fetchResult = await fetchPage(url, userAgent);

  const parsed = parsePage(fetchResult.body, url);

  const page: PageData = {
    url,
    statusCode: fetchResult.statusCode,
    title: parsed.title,
    metaDescription: parsed.metaDescription,
    h1: parsed.h1,
    wordCount: parsed.wordCount,
    loadTimeMs: fetchResult.loadTimeMs,
    internalLinks: parsed.internalLinks,
    externalLinks: parsed.externalLinks,
    imagesWithoutAlt: parsed.imagesWithoutAlt,
    issues: [],
    redirectChain:
      fetchResult.redirectChain.length > 0
        ? fetchResult.redirectChain
        : undefined,
  };

  page.issues = detectPageIssues(page);

  return page;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && pnpm test -- src/__tests__/audit-page.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/audit/audit-page.ts packages/core/src/__tests__/audit-page.test.ts
git commit -m "feat(core): add auditPage function for single-URL SEO analysis"
```

---

### Task 9: Export from Barrel and Final Verification

**Files:**
- Modify: `packages/core/src/index.ts`
- Modify: `packages/core/src/types.ts` (already done in Task 1)

- [ ] **Step 1: Update barrel exports**

Add to `packages/core/src/index.ts`:

```typescript
// Audit
export { auditCrawl } from "./audit/audit-crawl.js";
export { auditReport } from "./audit/audit-report.js";
export { auditPage } from "./audit/audit-page.js";
export { parseRobotsTxt, isAllowed } from "./audit/robots.js";
export { parsePage, extractLinks, resolveUrl, fetchPage } from "./audit/fetcher.js";
export type { ParsedPage, FetchResult } from "./audit/fetcher.js";
export type { CrawlQueueOptions, CrawlResult } from "./audit/crawler.js";
```

- [ ] **Step 2: Run full test suite**

Run: `cd packages/core && pnpm test`
Expected: All tests pass (foundation: 23, audit: fetcher + robots + crawler + issues + audit-crawl + audit-report + audit-page)

- [ ] **Step 3: Run full build**

Run: `pnpm build`
Expected: All packages compile without errors

- [ ] **Step 4: Verify exports**

Run: `cd packages/core && node -e "import('./dist/index.js').then(m => console.log(Object.keys(m).sort().join(', ')))"`
Expected: Output includes `auditCrawl`, `auditPage`, `auditReport`, `extractLinks`, `fetchPage`, `isAllowed`, `parsePage`, `parseRobotsTxt`, `resolveUrl`

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/index.ts
git commit -m "feat(core): export audit functions from barrel"
```
