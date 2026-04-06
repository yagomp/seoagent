# MCP Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose all 24 SEOAgent tools as MCP tools via a stdio server so AI agents (Claude Code, Cursor, Codex, etc.) can call them natively.

**Architecture:** The `packages/mcp/` package creates an `McpServer` from `@modelcontextprotocol/sdk` and registers 24 tools grouped by domain (keywords, rank tracking, audit, competitor, content, domain, strategy, GSC, utility). Each tool handler resolves the active project (from `SEOAGENT_PROJECT` env var or an explicit `project` parameter), calls the corresponding `@seoagent/core` function, and returns structured JSON. Transport is stdio (standard for CLI-spawned MCP servers).

**Tech Stack:** `@modelcontextprotocol/sdk`, `zod`, `@seoagent/core`, Vitest

---

## File Structure

```
packages/mcp/
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── src/
    ├── index.ts                    # Entry point: create server, register tools, connect stdio
    ├── server.ts                   # createServer() — McpServer factory with all tool registrations
    ├── project-resolver.ts         # resolveProject() — env var or tool param → project slug
    ├── tools/
    │   ├── keywords.ts             # seoagent_keyword_research, seoagent_keyword_suggestions
    │   ├── rank-tracking.ts        # seoagent_rank_track_add/check/history/report
    │   ├── audit.ts                # seoagent_audit_crawl/report/page
    │   ├── competitor.ts           # seoagent_competitor_keywords/compare
    │   ├── content.ts              # seoagent_content_gaps
    │   ├── domain.ts               # seoagent_domain_reputation/history, seoagent_backlink_profile/opportunities
    │   ├── strategy.ts             # seoagent_strategy_generate/refresh
    │   ├── gsc.ts                  # seoagent_gsc_performance/pages/queries
    │   └── utility.ts              # seoagent_config_set, seoagent_projects_list, seoagent_project_add
    └── __tests__/
        ├── project-resolver.test.ts
        ├── server.test.ts          # All 24 tools registered
        └── handlers.test.ts        # Handler logic with mocked core
```

---

### Task 1: Update MCP Package Dependencies

**Files:**
- Edit: `packages/mcp/package.json`

- [ ] **Step 1: Update `packages/mcp/package.json` with real dependencies**

```json
{
  "name": "seoagent-mcp",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "seoagent-mcp": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.0",
    "@seoagent/core": "workspace:*",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "vitest": "^3.1.0"
  }
}
```

- [ ] **Step 2: Create `packages/mcp/vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
  },
});
```

- [ ] **Step 3: Install dependencies**

Run: `cd packages/mcp && pnpm install`
Expected: `node_modules` populated, no errors

- [ ] **Step 4: Commit**

```bash
git add packages/mcp/package.json packages/mcp/vitest.config.ts pnpm-lock.yaml
git commit -m "chore(mcp): add MCP SDK and zod dependencies"
```

---

### Task 2: Project Resolution Helper

**Files:**
- Create: `packages/mcp/src/__tests__/project-resolver.test.ts`
- Create: `packages/mcp/src/project-resolver.ts`

- [ ] **Step 1: Write test for project resolver**

Create `packages/mcp/src/__tests__/project-resolver.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resolveProject } from "../project-resolver.js";

describe("resolveProject", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns project from explicit parameter", () => {
    process.env.SEOAGENT_PROJECT = "env-project";
    const result = resolveProject("param-project");
    expect(result).toBe("param-project");
  });

  it("falls back to SEOAGENT_PROJECT env var", () => {
    process.env.SEOAGENT_PROJECT = "env-project";
    const result = resolveProject(undefined);
    expect(result).toBe("env-project");
  });

  it("returns undefined when neither is set", () => {
    delete process.env.SEOAGENT_PROJECT;
    const result = resolveProject(undefined);
    expect(result).toBeUndefined();
  });

  it("trims whitespace from parameter", () => {
    const result = resolveProject("  my-project  ");
    expect(result).toBe("my-project");
  });

  it("ignores empty string parameter, falls back to env", () => {
    process.env.SEOAGENT_PROJECT = "env-project";
    const result = resolveProject("");
    expect(result).toBe("env-project");
  });
});
```

- [ ] **Step 2: Run test (expect fail)**

Run: `cd packages/mcp && pnpm test`
Expected: Tests fail — module not found

- [ ] **Step 3: Implement project resolver**

Create `packages/mcp/src/project-resolver.ts`:

```typescript
/**
 * Resolve the active project slug.
 * Priority: explicit tool parameter > SEOAGENT_PROJECT env var > undefined
 */
export function resolveProject(paramProject?: string): string | undefined {
  const trimmed = paramProject?.trim();
  if (trimmed && trimmed.length > 0) {
    return trimmed;
  }

  const envProject = process.env.SEOAGENT_PROJECT?.trim();
  if (envProject && envProject.length > 0) {
    return envProject;
  }

  return undefined;
}
```

- [ ] **Step 4: Run test (expect pass)**

Run: `cd packages/mcp && pnpm test`
Expected: All 5 tests pass

- [ ] **Step 5: Commit**

```bash
git add packages/mcp/src/project-resolver.ts packages/mcp/src/__tests__/project-resolver.test.ts
git commit -m "feat(mcp): add project resolution helper"
```

---

### Task 3: MCP Server Setup and Utility Tools

**Files:**
- Create: `packages/mcp/src/tools/utility.ts`
- Create: `packages/mcp/src/server.ts`
- Create: `packages/mcp/src/index.ts`

- [ ] **Step 1: Create utility tool registrations**

Create `packages/mcp/src/tools/utility.ts`:

```typescript
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { resolveProject } from "../project-resolver.js";

export function registerUtilityTools(server: McpServer): void {
  server.tool(
    "seoagent_config_set",
    "Set an SEOAgent configuration value (e.g., API keys, preferences)",
    {
      key: z.string().describe("Config key in dot notation (e.g., dataforseo.login)"),
      value: z.string().describe("Config value to set"),
    },
    async ({ key, value }) => {
      const { setConfig } = await import("@seoagent/core");
      await setConfig(key, value);
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ ok: true, key, value }) }],
      };
    }
  );

  server.tool(
    "seoagent_projects_list",
    "List all tracked SEOAgent projects/domains",
    {},
    async () => {
      const { listProjects } = await import("@seoagent/core");
      const projects = await listProjects();
      return {
        content: [{ type: "text" as const, text: JSON.stringify(projects) }],
      };
    }
  );

  server.tool(
    "seoagent_project_add",
    "Add a new domain/project to track",
    {
      slug: z.string().describe("URL-friendly project identifier (e.g., my-blog)"),
      domain: z.string().describe("Domain to track (e.g., example.com)"),
      name: z.string().optional().describe("Human-readable project name"),
      niche: z.string().optional().describe("Project niche (e.g., sports/fantasy-football)"),
      locale: z.string().optional().describe("Default locale (e.g., en-US)"),
      competitors: z.array(z.string()).optional().describe("Competitor domains"),
    },
    async ({ slug, domain, name, niche, locale, competitors }) => {
      const { addProject } = await import("@seoagent/core");
      const project = await addProject({
        slug,
        domain,
        name: name ?? slug,
        niche,
        locale: locale ?? "en-US",
        competitors,
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(project) }],
      };
    }
  );
}
```

- [ ] **Step 2: Create server factory**

Create `packages/mcp/src/server.ts`:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerUtilityTools } from "./tools/utility.js";
import { registerKeywordTools } from "./tools/keywords.js";
import { registerRankTrackingTools } from "./tools/rank-tracking.js";
import { registerAuditTools } from "./tools/audit.js";
import { registerCompetitorTools } from "./tools/competitor.js";
import { registerContentTools } from "./tools/content.js";
import { registerDomainTools } from "./tools/domain.js";
import { registerStrategyTools } from "./tools/strategy.js";
import { registerGscTools } from "./tools/gsc.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "seoagent",
    version: "0.1.0",
  });

  registerUtilityTools(server);
  registerKeywordTools(server);
  registerRankTrackingTools(server);
  registerAuditTools(server);
  registerCompetitorTools(server);
  registerContentTools(server);
  registerDomainTools(server);
  registerStrategyTools(server);
  registerGscTools(server);

  return server;
}
```

- [ ] **Step 3: Create entry point**

Create `packages/mcp/src/index.ts`:

```typescript
#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("seoagent-mcp server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
```

- [ ] **Step 4: Commit**

```bash
git add packages/mcp/src/index.ts packages/mcp/src/server.ts packages/mcp/src/tools/utility.ts
git commit -m "feat(mcp): add server setup and utility tool registrations"
```

---

### Task 4: Keyword Tool Registrations

**Files:**
- Create: `packages/mcp/src/tools/keywords.ts`

- [ ] **Step 1: Create keyword tool registrations**

Create `packages/mcp/src/tools/keywords.ts`:

```typescript
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { resolveProject } from "../project-resolver.js";

export function registerKeywordTools(server: McpServer): void {
  server.tool(
    "seoagent_keyword_research",
    "Research keywords: get search volumes, difficulty scores, and related keywords for seed terms",
    {
      keywords: z.array(z.string()).describe("Seed keywords to research"),
      locale: z.string().optional().describe("Search locale (e.g., en-US, en-GB). Defaults to project locale."),
      project: z.string().optional().describe("Project slug (defaults to SEOAGENT_PROJECT env var)"),
    },
    async ({ keywords, locale, project }) => {
      const slug = resolveProject(project);
      const { keywordResearch } = await import("@seoagent/core");
      const result = await keywordResearch({ keywords, locale, project: slug });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    }
  );

  server.tool(
    "seoagent_keyword_suggestions",
    "Expand a seed keyword into keyword ideas: questions, long-tail variations, and related terms",
    {
      seed: z.string().describe("Seed keyword to expand"),
      locale: z.string().optional().describe("Search locale (e.g., en-US, en-GB)"),
      limit: z.number().optional().describe("Max number of suggestions to return"),
      project: z.string().optional().describe("Project slug (defaults to SEOAGENT_PROJECT env var)"),
    },
    async ({ seed, locale, limit, project }) => {
      const slug = resolveProject(project);
      const { keywordSuggestions } = await import("@seoagent/core");
      const result = await keywordSuggestions({ seed, locale, limit, project: slug });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    }
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/mcp/src/tools/keywords.ts
git commit -m "feat(mcp): add keyword research tool registrations"
```

---

### Task 5: Rank Tracking Tool Registrations

**Files:**
- Create: `packages/mcp/src/tools/rank-tracking.ts`

- [ ] **Step 1: Create rank tracking tool registrations**

Create `packages/mcp/src/tools/rank-tracking.ts`:

```typescript
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { resolveProject } from "../project-resolver.js";

export function registerRankTrackingTools(server: McpServer): void {
  server.tool(
    "seoagent_rank_track_add",
    "Add keywords to track for a domain. Positions will be checked periodically.",
    {
      keywords: z.array(z.string()).describe("Keywords to start tracking"),
      project: z.string().optional().describe("Project slug (defaults to SEOAGENT_PROJECT env var)"),
    },
    async ({ keywords, project }) => {
      const slug = resolveProject(project);
      const { rankTrackAdd } = await import("@seoagent/core");
      const result = await rankTrackAdd({ keywords, project: slug });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    }
  );

  server.tool(
    "seoagent_rank_track_check",
    "Run a rank check now: fetch current SERP positions for all tracked keywords",
    {
      project: z.string().optional().describe("Project slug (defaults to SEOAGENT_PROJECT env var)"),
    },
    async ({ project }) => {
      const slug = resolveProject(project);
      const { rankTrackCheck } = await import("@seoagent/core");
      const result = await rankTrackCheck({ project: slug });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    }
  );

  server.tool(
    "seoagent_rank_track_history",
    "Get position history for tracked keywords over time",
    {
      keyword: z.string().optional().describe("Filter to a specific keyword"),
      days: z.number().optional().describe("Number of days of history (default: 30)"),
      project: z.string().optional().describe("Project slug (defaults to SEOAGENT_PROJECT env var)"),
    },
    async ({ keyword, days, project }) => {
      const slug = resolveProject(project);
      const { rankTrackHistory } = await import("@seoagent/core");
      const result = await rankTrackHistory({ keyword, days, project: slug });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    }
  );

  server.tool(
    "seoagent_rank_track_report",
    "Summary report of rank movers: keywords that went up, down, entered, or left the SERPs since last check",
    {
      project: z.string().optional().describe("Project slug (defaults to SEOAGENT_PROJECT env var)"),
    },
    async ({ project }) => {
      const slug = resolveProject(project);
      const { rankTrackReport } = await import("@seoagent/core");
      const result = await rankTrackReport({ project: slug });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    }
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/mcp/src/tools/rank-tracking.ts
git commit -m "feat(mcp): add rank tracking tool registrations"
```

---

### Task 6: Audit Tool Registrations

**Files:**
- Create: `packages/mcp/src/tools/audit.ts`

- [ ] **Step 1: Create audit tool registrations**

Create `packages/mcp/src/tools/audit.ts`:

```typescript
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { resolveProject } from "../project-resolver.js";

export function registerAuditTools(server: McpServer): void {
  server.tool(
    "seoagent_audit_crawl",
    "Crawl a site up to N pages, storing results in the project database for analysis",
    {
      maxPages: z.number().optional().describe("Maximum pages to crawl (default: 100)"),
      startUrl: z.string().optional().describe("URL to start crawling from (defaults to project domain)"),
      project: z.string().optional().describe("Project slug (defaults to SEOAGENT_PROJECT env var)"),
    },
    async ({ maxPages, startUrl, project }) => {
      const slug = resolveProject(project);
      const { auditCrawl } = await import("@seoagent/core");
      const result = await auditCrawl({ maxPages, startUrl, project: slug });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    }
  );

  server.tool(
    "seoagent_audit_report",
    "Generate an audit report: broken links, missing titles/descriptions, thin content, duplicate titles, missing alt text, slow pages, redirect chains, orphan pages",
    {
      project: z.string().optional().describe("Project slug (defaults to SEOAGENT_PROJECT env var)"),
    },
    async ({ project }) => {
      const slug = resolveProject(project);
      const { auditReport } = await import("@seoagent/core");
      const result = await auditReport({ project: slug });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    }
  );

  server.tool(
    "seoagent_audit_page",
    "Detailed SEO audit of a single URL: meta tags, headings, content quality, performance, structured data",
    {
      url: z.string().describe("URL to audit"),
      project: z.string().optional().describe("Project slug (defaults to SEOAGENT_PROJECT env var)"),
    },
    async ({ url, project }) => {
      const slug = resolveProject(project);
      const { auditPage } = await import("@seoagent/core");
      const result = await auditPage({ url, project: slug });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    }
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/mcp/src/tools/audit.ts
git commit -m "feat(mcp): add site audit tool registrations"
```

---

### Task 7: Competitor Tool Registrations

**Files:**
- Create: `packages/mcp/src/tools/competitor.ts`

- [ ] **Step 1: Create competitor tool registrations**

Create `packages/mcp/src/tools/competitor.ts`:

```typescript
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { resolveProject } from "../project-resolver.js";

export function registerCompetitorTools(server: McpServer): void {
  server.tool(
    "seoagent_competitor_keywords",
    "Get keywords that a competitor domain ranks for, with volumes and positions",
    {
      domain: z.string().describe("Competitor domain to analyze (e.g., competitor.com)"),
      locale: z.string().optional().describe("Search locale (e.g., en-US)"),
      limit: z.number().optional().describe("Max keywords to return"),
      project: z.string().optional().describe("Project slug (defaults to SEOAGENT_PROJECT env var)"),
    },
    async ({ domain, locale, limit, project }) => {
      const slug = resolveProject(project);
      const { competitorKeywords } = await import("@seoagent/core");
      const result = await competitorKeywords({ domain, locale, limit, project: slug });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    }
  );

  server.tool(
    "seoagent_competitor_compare",
    "Side-by-side keyword overlap comparison between your domain and a competitor",
    {
      competitor: z.string().describe("Competitor domain to compare against"),
      project: z.string().optional().describe("Project slug (defaults to SEOAGENT_PROJECT env var)"),
    },
    async ({ competitor, project }) => {
      const slug = resolveProject(project);
      const { competitorCompare } = await import("@seoagent/core");
      const result = await competitorCompare({ competitor, project: slug });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    }
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/mcp/src/tools/competitor.ts
git commit -m "feat(mcp): add competitor analysis tool registrations"
```

---

### Task 8: Content Gap Tool Registration

**Files:**
- Create: `packages/mcp/src/tools/content.ts`

- [ ] **Step 1: Create content gap tool registration**

Create `packages/mcp/src/tools/content.ts`:

```typescript
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { resolveProject } from "../project-resolver.js";

export function registerContentTools(server: McpServer): void {
  server.tool(
    "seoagent_content_gaps",
    "Find keywords that competitors rank for but you do not, sorted by opportunity score",
    {
      competitors: z.array(z.string()).optional().describe("Competitor domains (defaults to project competitors)"),
      limit: z.number().optional().describe("Max gaps to return"),
      project: z.string().optional().describe("Project slug (defaults to SEOAGENT_PROJECT env var)"),
    },
    async ({ competitors, limit, project }) => {
      const slug = resolveProject(project);
      const { contentGaps } = await import("@seoagent/core");
      const result = await contentGaps({ competitors, limit, project: slug });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    }
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/mcp/src/tools/content.ts
git commit -m "feat(mcp): add content gaps tool registration"
```

---

### Task 9: Domain Reputation Tool Registrations

**Files:**
- Create: `packages/mcp/src/tools/domain.ts`

- [ ] **Step 1: Create domain reputation tool registrations**

Create `packages/mcp/src/tools/domain.ts`:

```typescript
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { resolveProject } from "../project-resolver.js";

export function registerDomainTools(server: McpServer): void {
  server.tool(
    "seoagent_domain_reputation",
    "Get domain reputation: DR score, referring domains count, and backlink profile summary",
    {
      domain: z.string().optional().describe("Domain to check (defaults to project domain)"),
      project: z.string().optional().describe("Project slug (defaults to SEOAGENT_PROJECT env var)"),
    },
    async ({ domain, project }) => {
      const slug = resolveProject(project);
      const { domainReputation } = await import("@seoagent/core");
      const result = await domainReputation({ domain, project: slug });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    }
  );

  server.tool(
    "seoagent_domain_reputation_history",
    "Track domain reputation (DR) changes over time",
    {
      days: z.number().optional().describe("Number of days of history (default: 90)"),
      project: z.string().optional().describe("Project slug (defaults to SEOAGENT_PROJECT env var)"),
    },
    async ({ days, project }) => {
      const slug = resolveProject(project);
      const { domainReputationHistory } = await import("@seoagent/core");
      const result = await domainReputationHistory({ days, project: slug });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    }
  );

  server.tool(
    "seoagent_backlink_profile",
    "Get backlink profile: top referring domains, anchor text distribution, dofollow/nofollow ratio",
    {
      domain: z.string().optional().describe("Domain to analyze (defaults to project domain)"),
      limit: z.number().optional().describe("Max referring domains to return"),
      project: z.string().optional().describe("Project slug (defaults to SEOAGENT_PROJECT env var)"),
    },
    async ({ domain, limit, project }) => {
      const slug = resolveProject(project);
      const { backlinkProfile } = await import("@seoagent/core");
      const result = await backlinkProfile({ domain, limit, project: slug });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    }
  );

  server.tool(
    "seoagent_backlink_opportunities",
    "Find sites that link to competitors but not to you — backlink acquisition opportunities",
    {
      competitors: z.array(z.string()).optional().describe("Competitor domains (defaults to project competitors)"),
      limit: z.number().optional().describe("Max opportunities to return"),
      project: z.string().optional().describe("Project slug (defaults to SEOAGENT_PROJECT env var)"),
    },
    async ({ competitors, limit, project }) => {
      const slug = resolveProject(project);
      const { backlinkOpportunities } = await import("@seoagent/core");
      const result = await backlinkOpportunities({ competitors, limit, project: slug });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    }
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/mcp/src/tools/domain.ts
git commit -m "feat(mcp): add domain reputation tool registrations"
```

---

### Task 10: Strategy Tool Registrations

**Files:**
- Create: `packages/mcp/src/tools/strategy.ts`

- [ ] **Step 1: Create strategy tool registrations**

Create `packages/mcp/src/tools/strategy.ts`:

```typescript
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { resolveProject } from "../project-resolver.js";

export function registerStrategyTools(server: McpServer): void {
  server.tool(
    "seoagent_strategy_generate",
    "Generate a full prioritized SEO strategy tailored to the domain niche, based on all available data (audit, keywords, competitors, backlinks)",
    {
      project: z.string().optional().describe("Project slug (defaults to SEOAGENT_PROJECT env var)"),
    },
    async ({ project }) => {
      const slug = resolveProject(project);
      const { strategyGenerate } = await import("@seoagent/core");
      const result = await strategyGenerate({ project: slug });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    }
  );

  server.tool(
    "seoagent_strategy_refresh",
    "Re-run strategy generation after changes have been made, highlighting improvements and remaining actions",
    {
      project: z.string().optional().describe("Project slug (defaults to SEOAGENT_PROJECT env var)"),
    },
    async ({ project }) => {
      const slug = resolveProject(project);
      const { strategyRefresh } = await import("@seoagent/core");
      const result = await strategyRefresh({ project: slug });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    }
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/mcp/src/tools/strategy.ts
git commit -m "feat(mcp): add strategy tool registrations"
```

---

### Task 11: GSC Tool Registrations

**Files:**
- Create: `packages/mcp/src/tools/gsc.ts`

- [ ] **Step 1: Create GSC tool registrations**

Create `packages/mcp/src/tools/gsc.ts`:

```typescript
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { resolveProject } from "../project-resolver.js";

export function registerGscTools(server: McpServer): void {
  server.tool(
    "seoagent_gsc_performance",
    "Get Google Search Console performance data: clicks, impressions, CTR, and average position over a date range",
    {
      days: z.number().optional().describe("Number of days to look back (default: 28)"),
      startDate: z.string().optional().describe("Start date (YYYY-MM-DD), overrides days"),
      endDate: z.string().optional().describe("End date (YYYY-MM-DD)"),
      project: z.string().optional().describe("Project slug (defaults to SEOAGENT_PROJECT env var)"),
    },
    async ({ days, startDate, endDate, project }) => {
      const slug = resolveProject(project);
      const { gscPerformance } = await import("@seoagent/core");
      const result = await gscPerformance({ days, startDate, endDate, project: slug });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    }
  );

  server.tool(
    "seoagent_gsc_pages",
    "Get top performing pages from Google Search Console, sorted by clicks or impressions",
    {
      days: z.number().optional().describe("Number of days to look back (default: 28)"),
      sort: z.enum(["clicks", "impressions", "ctr", "position"]).optional().describe("Sort metric (default: clicks)"),
      limit: z.number().optional().describe("Max pages to return"),
      project: z.string().optional().describe("Project slug (defaults to SEOAGENT_PROJECT env var)"),
    },
    async ({ days, sort, limit, project }) => {
      const slug = resolveProject(project);
      const { gscPages } = await import("@seoagent/core");
      const result = await gscPages({ days, sort, limit, project: slug });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    }
  );

  server.tool(
    "seoagent_gsc_queries",
    "Get top search queries driving traffic from Google Search Console",
    {
      days: z.number().optional().describe("Number of days to look back (default: 28)"),
      sort: z.enum(["clicks", "impressions", "ctr", "position"]).optional().describe("Sort metric (default: clicks)"),
      limit: z.number().optional().describe("Max queries to return"),
      project: z.string().optional().describe("Project slug (defaults to SEOAGENT_PROJECT env var)"),
    },
    async ({ days, sort, limit, project }) => {
      const slug = resolveProject(project);
      const { gscQueries } = await import("@seoagent/core");
      const result = await gscQueries({ days, sort, limit, project: slug });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    }
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/mcp/src/tools/gsc.ts
git commit -m "feat(mcp): add Google Search Console tool registrations"
```

---

### Task 12: Integration Test — All 24 Tools Registered

**Files:**
- Create: `packages/mcp/src/__tests__/server.test.ts`

- [ ] **Step 1: Write integration test verifying all 24 tools are registered**

Create `packages/mcp/src/__tests__/server.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../server.js";

const EXPECTED_TOOLS = [
  // Keyword Research
  "seoagent_keyword_research",
  "seoagent_keyword_suggestions",
  // Rank Tracking
  "seoagent_rank_track_add",
  "seoagent_rank_track_check",
  "seoagent_rank_track_history",
  "seoagent_rank_track_report",
  // Site Audit
  "seoagent_audit_crawl",
  "seoagent_audit_report",
  "seoagent_audit_page",
  // Competitor Analysis
  "seoagent_competitor_keywords",
  "seoagent_competitor_compare",
  // Content Gap
  "seoagent_content_gaps",
  // Domain Reputation
  "seoagent_domain_reputation",
  "seoagent_domain_reputation_history",
  "seoagent_backlink_profile",
  "seoagent_backlink_opportunities",
  // Strategy Engine
  "seoagent_strategy_generate",
  "seoagent_strategy_refresh",
  // Google Search Console
  "seoagent_gsc_performance",
  "seoagent_gsc_pages",
  "seoagent_gsc_queries",
  // Utility
  "seoagent_config_set",
  "seoagent_projects_list",
  "seoagent_project_add",
] as const;

describe("MCP Server", () => {
  it("registers all 24 tools", async () => {
    const server = createServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    const client = new Client({ name: "test-client", version: "0.1.0" });

    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    const { tools } = await client.listTools();
    const toolNames = tools.map((t) => t.name).sort();

    expect(tools).toHaveLength(24);

    for (const expected of EXPECTED_TOOLS) {
      expect(toolNames).toContain(expected);
    }
  });

  it("each tool has a description", async () => {
    const server = createServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    const client = new Client({ name: "test-client", version: "0.1.0" });

    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    const { tools } = await client.listTools();

    for (const tool of tools) {
      expect(tool.description, `${tool.name} should have a description`).toBeTruthy();
      expect(tool.description!.length).toBeGreaterThan(10);
    }
  });

  it("each tool has an input schema", async () => {
    const server = createServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    const client = new Client({ name: "test-client", version: "0.1.0" });

    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    const { tools } = await client.listTools();

    for (const tool of tools) {
      expect(tool.inputSchema, `${tool.name} should have an inputSchema`).toBeDefined();
      expect(tool.inputSchema.type).toBe("object");
    }
  });
});
```

- [ ] **Step 2: Run test (expect pass)**

Run: `cd packages/mcp && pnpm test`
Expected: All tests pass — 24 tools registered, each with description and input schema

- [ ] **Step 3: Commit**

```bash
git add packages/mcp/src/__tests__/server.test.ts
git commit -m "test(mcp): add integration test verifying all 24 tools registered"
```

---

### Task 13: Handler Tests with Mocked Core

**Files:**
- Create: `packages/mcp/src/__tests__/handlers.test.ts`

- [ ] **Step 1: Write handler tests for a representative subset of tools**

Create `packages/mcp/src/__tests__/handlers.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../server.js";

// Mock @seoagent/core
vi.mock("@seoagent/core", () => ({
  listProjects: vi.fn().mockResolvedValue([
    { slug: "my-blog", domain: "myblog.com", name: "My Blog" },
    { slug: "fplai", domain: "fplai.app", name: "FPLai" },
  ]),
  addProject: vi.fn().mockResolvedValue({
    slug: "new-site",
    domain: "newsite.com",
    name: "New Site",
  }),
  setConfig: vi.fn().mockResolvedValue(undefined),
  keywordResearch: vi.fn().mockResolvedValue({
    keywords: [
      { keyword: "fpl tips", volume: 12000, difficulty: 45 },
    ],
  }),
  auditCrawl: vi.fn().mockResolvedValue({
    pagesCrawled: 50,
    issuesFound: 12,
  }),
}));

async function createTestClient() {
  const server = createServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.1.0" });

  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);

  return client;
}

function parseToolResult(result: { content: Array<{ type: string; text?: string }> }): unknown {
  const textContent = result.content.find((c) => c.type === "text");
  return textContent?.text ? JSON.parse(textContent.text) : null;
}

describe("Tool Handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("seoagent_projects_list returns project list", async () => {
    const client = await createTestClient();
    const result = await client.callTool({ name: "seoagent_projects_list", arguments: {} });
    const data = parseToolResult(result as any);

    expect(data).toEqual([
      { slug: "my-blog", domain: "myblog.com", name: "My Blog" },
      { slug: "fplai", domain: "fplai.app", name: "FPLai" },
    ]);
  });

  it("seoagent_project_add creates a project", async () => {
    const client = await createTestClient();
    const result = await client.callTool({
      name: "seoagent_project_add",
      arguments: { slug: "new-site", domain: "newsite.com" },
    });
    const data = parseToolResult(result as any);

    expect(data).toEqual({
      slug: "new-site",
      domain: "newsite.com",
      name: "New Site",
    });
  });

  it("seoagent_config_set returns ok", async () => {
    const client = await createTestClient();
    const result = await client.callTool({
      name: "seoagent_config_set",
      arguments: { key: "dataforseo.login", value: "my-login" },
    });
    const data = parseToolResult(result as any);

    expect(data).toEqual({ ok: true, key: "dataforseo.login", value: "my-login" });
  });

  it("seoagent_keyword_research returns keyword data", async () => {
    const client = await createTestClient();
    const result = await client.callTool({
      name: "seoagent_keyword_research",
      arguments: { keywords: ["fpl tips"] },
    });
    const data = parseToolResult(result as any) as any;

    expect(data.keywords).toHaveLength(1);
    expect(data.keywords[0].keyword).toBe("fpl tips");
    expect(data.keywords[0].volume).toBe(12000);
  });

  it("seoagent_audit_crawl returns crawl summary", async () => {
    const client = await createTestClient();
    const result = await client.callTool({
      name: "seoagent_audit_crawl",
      arguments: { maxPages: 50 },
    });
    const data = parseToolResult(result as any) as any;

    expect(data.pagesCrawled).toBe(50);
    expect(data.issuesFound).toBe(12);
  });
});
```

- [ ] **Step 2: Run tests (expect pass)**

Run: `cd packages/mcp && pnpm test`
Expected: All handler tests pass with mocked core functions

- [ ] **Step 3: Commit**

```bash
git add packages/mcp/src/__tests__/handlers.test.ts
git commit -m "test(mcp): add handler tests with mocked core functions"
```

---

### Task 14: Build Verification

- [ ] **Step 1: Verify TypeScript compilation**

Run: `cd packages/mcp && pnpm build`
Expected: `dist/` created with all `.js` and `.d.ts` files, no compilation errors

- [ ] **Step 2: Run full test suite**

Run: `cd packages/mcp && pnpm test`
Expected: All tests pass (project-resolver, server integration, handlers)

- [ ] **Step 3: Final commit**

```bash
git add -A packages/mcp/
git commit -m "feat(mcp): complete MCP server with all 24 SEO tools"
```
