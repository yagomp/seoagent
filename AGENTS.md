# SEOAgent — Agent Instructions

This file provides instructions for AI coding agents (Claude Code, Codex, Gemini, Cursor, etc.) working on the SEOAgent codebase.

## Quick Start

```bash
pnpm install && pnpm build && pnpm test
```

## Where Things Live

| What | Where |
|------|-------|
| All business logic | `packages/core/src/` |
| Public API | `packages/core/src/index.ts` (barrel export) |
| Types | `packages/core/src/types.ts` |
| Database schema | `packages/core/src/schema.ts` |
| Tests | `packages/core/src/__tests__/*.test.ts` |
| CLI commands | `packages/cli/src/commands/` |
| MCP tool handlers | `packages/mcp/src/tools/` |
| Dashboard API | `packages/dashboard/src/server/routes.ts` |
| Dashboard pages | `packages/dashboard/src/app/pages/` |

## Adding a New Feature

1. Add types to `packages/core/src/types.ts` (if needed)
2. Write failing test in `packages/core/src/__tests__/`
3. Implement in `packages/core/src/` (new file or existing module)
4. Export from `packages/core/src/index.ts`
5. Add CLI command in `packages/cli/src/commands/`
6. Add MCP tool in `packages/mcp/src/tools/`
7. Add dashboard endpoint + page if applicable

## Testing Patterns

- Mock HTTP calls with `vitest.mock("undici")` or `vitest.mock("googleapis")`
- Mock DataForSEO with `vitest.mock("../dataforseo.js")`
- Use `SEOAGENT_HOME` env var pointing to temp dir for isolated tests
- Database tests: create temp dir, `openDatabase()`, cleanup in `afterEach`

```typescript
let tmpDir: string;
beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "seoagent-test-"));
  process.env.SEOAGENT_HOME = tmpDir;
});
afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});
```

## MCP Server

24 tools prefixed `seoagent_`. Install config:

```json
{
  "mcpServers": {
    "seoagent": {
      "command": "node",
      "args": ["<absolute-path>/packages/mcp/dist/index.js"],
      "env": { "SEOAGENT_PROJECT": "<project-slug>" }
    }
  }
}
```

## CLI

```bash
seoagent project add mysite --domain example.com --niche tech
seoagent project use mysite
seoagent config set dataforseo.login <login>
seoagent config set dataforseo.password <password>
seoagent keywords research "seo tips" --format json
seoagent audit crawl --max-pages 100
seoagent strategy generate
```

Global `--format` flag: `table` (default), `json`, `markdown`.

## Core Function Groups

### Project Management
`addProject`, `listProjects`, `getProject`, `removeProject`, `setActiveProject`, `getActiveProject`

### Config
`loadConfig`, `saveConfig`, `setConfigValue`, `getConfigValue`

### Database
`openDatabase(dbPath)`, `closeDatabase(db)` — creates all 9 tables via schema.ts

### Site Audit
`auditCrawl(domain, db, options?)`, `auditReport(db)`, `auditPage(url, db)`

### Keywords & Rank Tracking
`keywordResearch(db, provider, keywords, locale)`, `keywordSuggestions(db, provider, seed, locale, limit?)`
`rankTrackAdd(db, keywords, locale)`, `rankTrackCheck(db, provider, domain, locale)`, `rankTrackHistory(db, keyword, locale)`, `rankTrackReport(db, locale)`

### Competitors
`competitorKeywords(provider, domain, locale)`, `competitorCompare(provider, yourDomain, competitor, locale)`, `contentGaps(db, provider, yourDomain, competitors)`, `contentGapsForProject(provider, slug)`

### Domain Reputation
`domainReputation(domain, db, credentials)`, `domainReputationHistory(db, options?)`, `backlinkProfile(domain, db, credentials)`, `backlinkOpportunities(domain, competitors, credentials)`

### Google Search Console
`generateAuthUrl(clientId, secret)`, `gscPerformance(slug, options?)`, `gscPages(slug, options?)`, `gscQueries(slug, options?)`

### Strategy Engine
`strategyGenerate(db, project)`, `strategyRefresh(db, project)`, `generateRuleBasedStrategy(data)` (fallback without LLM)

### Provider
`createProvider(login, password)` — creates DataForSEO provider implementing `SearchDataProvider` interface
