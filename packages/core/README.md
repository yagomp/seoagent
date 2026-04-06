# @seoagent/core

Core library for [SEOAgent](https://github.com/yagomp/seoagent) — the open-source, agent-first SEO toolkit.

All business logic lives here. The CLI, MCP server, and dashboard are thin wrappers over this package.

## Install

```bash
npm install @seoagent/core
```

Requires Node.js >= 20.

## What's inside

| Module | Description |
|--------|-------------|
| `auditCrawl` | Crawl a site up to 50k pages via sitemap + BFS |
| `auditPage` | Audit a single URL for SEO issues |
| `auditReport` | Aggregate crawl results into a scored report |
| `keywordResearch` | Search volumes, difficulty, CPC via DataForSEO |
| `keywordSuggestions` | Related keyword suggestions from a seed |
| `rankTrackAdd` | Add keywords to rank tracking |
| `rankTrackCheck` | Fetch current SERP positions |
| `rankTrackReport` | Movers, gainers, losers since last check |
| `competitorKeywords` | Keywords a competitor ranks for |
| `contentGaps` | Keywords competitors rank for that you don't |
| `domainReputation` | DR score, backlinks, referring domains |
| `backlinkProfile` | Full backlink profile for a domain |
| `backlinkOpportunities` | Link building targets from competitor backlinks |
| `strategyGenerate` | AI-powered or rule-based SEO strategy |
| `strategyRefresh` | Re-run strategy with latest data |
| `gscSync` | Sync Google Search Console data |
| `gscPerformance` | Clicks, impressions, CTR, position |
| `gscQueries` | Top queries from GSC |
| `gscPages` | Top pages from GSC |
| `openDatabase` | Open per-project SQLite database |
| `loadConfig` / `saveConfig` | Read/write `~/.seoagent/config.json` |

## Usage

```typescript
import { openDatabase, auditCrawl, auditReport, strategyGenerate } from '@seoagent/core'

const db = openDatabase('~/.seoagent/projects/mysite/seoagent.db')

// Crawl the site
await auditCrawl('mysite.com', db, { maxPages: 1000 })

// Get a report
const report = auditReport(db)
console.log(report.score, report.issues)

// Generate strategy
const strategy = await strategyGenerate(db, { provider: 'anthropic', apiKey: '...' })
console.log(strategy.actions)
```

## Data sources

- **Free**: Google Search Console, local crawler
- **Paid**: DataForSEO (~$0.001/query) for keyword volumes, SERP data, backlinks
- **Derived**: content gaps, rank deltas, audit scores, strategy

## Updating

```bash
npm install @seoagent/core@latest
```

## Links

- [GitHub](https://github.com/yagomp/seoagent)
- [CLI (`@seoagent/cli`)](https://www.npmjs.com/package/@seoagent/cli)
- [MCP Server (`seoagent-mcp`)](https://www.npmjs.com/package/seoagent-mcp)
- [Full documentation](https://github.com/yagomp/seoagent#readme)

## License

MIT
