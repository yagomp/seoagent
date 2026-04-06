# SEOAgent — Design Spec

**Date:** 2026-04-04
**Status:** Approved
**License:** MIT (open source)

## Overview

SEOAgent is an open-source, agent-first SEO toolkit — keyword research, rank tracking, site audits, competitor analysis, content gap analysis, domain reputation, and strategy generation.

The primary interface is programmatic: an MCP server and CLI that AI agents (Claude Code, Codex, Cursor, etc.) can use to analyze, diagnose, and fix SEO issues autonomously. A lightweight local web dashboard provides human-readable visualization.

## Architecture

TypeScript monorepo with four packages:

```
seoagent/
├── packages/
│   ├── core/           # @seoagent/core — all logic lives here
│   ├── cli/            # seoagent CLI (npm)
│   ├── mcp/            # seoagent-mcp server (npm)
│   └── dashboard/      # Local Vite + React web UI
├── docs/
├── examples/
├── LICENSE
└── README.md
```

**Key principle:** Every feature is a function in `core` first. CLI, MCP, and dashboard are thin wrappers. If you can't call it from a script, it doesn't exist yet.

## Data Sources

Three tiers, unified behind a provider abstraction:

### Tier 1: Free / Own Sites
- **Google Search Console API** — real impressions, clicks, CTR, positions for verified properties
- **Google PageSpeed Insights API** — Core Web Vitals, performance scores (free, 25k queries/day)
- **Local crawler** — HTML fetching via `undici`, parsing via `cheerio`, link extraction, meta tag analysis

### Tier 2: Third-Party APIs
- **DataForSEO** as default provider (~$0.001/SERP query) — keyword volumes, SERP snapshots, keyword suggestions, competitor rankings
- Provider interface so users can swap in SerpAPI, ValueSERP, or others

### Tier 3: Derived / Computed
- Content gap analysis — diff keyword sets between your domain and competitors
- Rank tracking deltas — historical position changes from SQLite data
- Audit scores — computed from crawl data

### Provider Abstraction

```typescript
interface SearchDataProvider {
  getKeywordVolume(keywords: string[], locale: string): Promise<KeywordData[]>
  getSerpResults(keyword: string, locale: string): Promise<SerpResult[]>
  getKeywordSuggestions(seed: string, locale: string): Promise<string[]>
  getCompetitorKeywords(domain: string, locale: string): Promise<KeywordData[]>
}
```

Users configure which provider to use. DataForSEO ships as default.

## MCP Tools (24 total)

### Keyword Research
| Tool | Description |
|------|-------------|
| `seoagent_keyword_research` | Seed keywords + locale → volumes, difficulty, related keywords |
| `seoagent_keyword_suggestions` | Expand seed into keyword ideas (questions, long-tail, related) |

### Rank Tracking
| Tool | Description |
|------|-------------|
| `seoagent_rank_track_add` | Add keywords to track for a domain |
| `seoagent_rank_track_check` | Run a rank check now (fetch current SERP positions) |
| `seoagent_rank_track_history` | Position history for tracked keywords over time |
| `seoagent_rank_track_report` | Summary of movers (up/down/new/lost) since last check |

### Site Audit
| Tool | Description |
|------|-------------|
| `seoagent_audit_crawl` | Crawl a site up to N pages, store results in SQLite |
| `seoagent_audit_report` | Findings: broken links, missing titles/descriptions, thin content, duplicate titles, missing alt text, slow pages, redirect chains, orphan pages |
| `seoagent_audit_page` | Detailed audit of a single URL |

### Competitor Analysis
| Tool | Description |
|------|-------------|
| `seoagent_competitor_keywords` | Keywords a competitor domain ranks for |
| `seoagent_competitor_compare` | Side-by-side keyword overlap between your domain and a competitor |

### Content Gap
| Tool | Description |
|------|-------------|
| `seoagent_content_gaps` | Keywords competitors rank for that you don't, sorted by opportunity |

### Domain Reputation
| Tool | Description |
|------|-------------|
| `seoagent_domain_reputation` | DR score, referring domains count, backlink profile summary |
| `seoagent_domain_reputation_history` | Track DR changes over time |
| `seoagent_backlink_profile` | Top referring domains, anchor text distribution, dofollow/nofollow ratio |
| `seoagent_backlink_opportunities` | Sites that link to competitors but not to you |

### Strategy Engine
| Tool | Description |
|------|-------------|
| `seoagent_strategy_generate` | Full prioritized SEO strategy tailored to domain niche |
| `seoagent_strategy_refresh` | Re-run strategy after changes, highlight improvements |

### Google Search Console
| Tool | Description |
|------|-------------|
| `seoagent_gsc_performance` | Clicks, impressions, CTR, position (date range, filters) |
| `seoagent_gsc_pages` | Top performing pages |
| `seoagent_gsc_queries` | Top queries driving traffic |

### Utility
| Tool | Description |
|------|-------------|
| `seoagent_config_set` | Set API keys and preferences |
| `seoagent_projects_list` | List tracked projects/domains |
| `seoagent_project_add` | Add a domain to track |

## CLI Interface

```bash
# Project management
seoagent project add fplai --domain fplai.app --niche "sports/fantasy-football"
seoagent project list
seoagent project use fplai

# Keyword research
seoagent keywords research "fpl tips" --locale en-GB
seoagent keywords suggest "fantasy premier league" --limit 50
seoagent keywords track add "best fpl app" "fpl ai assistant"
seoagent keywords track check
seoagent keywords track report

# Site audit
seoagent audit crawl --max-pages 5000
seoagent audit report
seoagent audit page https://fplai.app/pricing

# Competitor analysis
seoagent competitor keywords fantasyfootballhub.co.uk
seoagent competitor compare fantasyfootballhub.co.uk
seoagent content-gaps

# Domain reputation
seoagent domain reputation
seoagent domain backlinks
seoagent domain opportunities

# Strategy
seoagent strategy generate
seoagent strategy refresh

# Google Search Console
seoagent gsc auth
seoagent gsc performance --days 28
seoagent gsc pages --sort clicks

# Config
seoagent config set dataforseo.login xxx
seoagent config set dataforseo.password xxx

# Dashboard
seoagent dashboard    # opens http://localhost:3847
```

**Output formats:** `--format table` (default), `--format json` (for piping/agents), `--format markdown`.

## Data Storage

SQLite, one database per project:

```
~/.seoagent/
├── config.json
└── projects/
    ├── fplai-app/
    │   ├── project.json
    │   └── seoagent.db
    └── my-blog/
        ├── project.json
        └── seoagent.db
```

### Core Tables

| Table | Purpose |
|-------|---------|
| `keywords` | Tracked keywords with latest volume, difficulty, current position |
| `rank_history` | Position snapshots over time (keyword_id, date, position) |
| `crawl_pages` | Crawled URLs with status, title, description, word count, issues |
| `crawl_links` | Internal/external links found during crawl |
| `backlinks` | Referring domains, anchor text, first/last seen |
| `dr_history` | Domain rating snapshots over time |
| `serp_cache` | Cached SERP results with TTL |
| `strategies` | Generated strategy snapshots with timestamps |
| `gsc_data` | Synced Search Console performance data |

### Project Metadata (`project.json`)

```json
{
  "domain": "fplai.app",
  "name": "FPLai",
  "description": "AI-powered Fantasy Premier League assistant",
  "niche": "sports/fantasy-football",
  "competitors": ["fplbot.app", "fantasyfootballhub.co.uk"],
  "locale": "en-GB"
}
```

## Strategy Engine

### How It Works
1. Aggregates data from all SQLite tables into a structured context object
2. Passes context + niche info to an LLM (user's own API key)
3. LLM generates strategy following a strict output schema
4. Result stored in `strategies` table with timestamp

### LLM Configuration
```bash
seoagent config set llm.provider anthropic     # or openai, ollama
seoagent config set llm.apiKey sk-ant-...
seoagent config set llm.model claude-sonnet-4-6
```

### Strategy Output Schema

```typescript
interface Strategy {
  generatedAt: string
  overallScore: number              // 0-100 SEO health
  quickWins: ActionItem[]           // high impact, low effort
  contentPlan: ContentItem[]        // pages to create/improve
  technicalFixes: AuditFix[]       // from audit, prioritized
  linkBuilding: LinkTactic[]        // niche-relevant tactics
  drPlan: { currentDR: number, targetDR: number, actions: string[] }
  competitorInsights: string[]
}

interface ActionItem {
  action: string
  reason: string
  impact: 'high' | 'medium' | 'low'
  effort: 'high' | 'medium' | 'low'
  filePath?: string                 // if detectable in local codebase
}
```

### Fallback Without LLM
Without an LLM key configured, `seoagent strategy generate` falls back to a rule-based engine — template-driven recommendations based on audit scores, missing keywords, and DR benchmarks. Less tailored but still actionable.

## MCP Server Integration

### Installation
```json
{
  "mcpServers": {
    "seoagent": {
      "command": "npx",
      "args": ["seoagent-mcp"],
      "env": {
        "SEOAGENT_PROJECT": "fplai"
      }
    }
  }
}
```

### Agent Workflow Example
1. Agent calls `seoagent_audit_crawl` → gets list of issues
2. Agent calls `seoagent_content_gaps` → finds missing keyword opportunities
3. Agent calls `seoagent_strategy_generate` → gets prioritized action plan
4. Agent reads the strategy, then fixes things: updates meta tags, creates content briefs, fixes broken links, adds structured data
5. Agent calls `seoagent_strategy_refresh` → confirms improvements

### Agent-Friendly Design Principles
- All tool responses are structured JSON (not human prose)
- Error messages include actionable context
- Tools are composable — agents can chain them without human intervention
- Strategy output includes file paths when it detects a local codebase

## Dashboard

Local web UI launched via `seoagent dashboard` (http://localhost:3847).

**Stack:** Vite + React, thin Express layer serving API from SQLite.

**Views:**
- **Overview** — DR score, tracked keywords count, last audit score, rank trend sparkline
- **Keywords** — table with volume, position, change, difficulty (filterable/sortable)
- **Rank Tracker** — position charts over time per keyword
- **Audit** — issue list grouped by severity, expandable per-page details
- **Competitors** — keyword overlap view, content gap table
- **Backlinks** — referring domains, anchor cloud, DR history chart
- **Strategy** — latest generated strategy with checklist-style progress tracking

**Constraint:** Dashboard is read-only + strategy display. All actions happen through CLI or MCP.

## Distribution

### npm Packages
| Package | Description | Install |
|---------|-------------|---------|
| `seoagent` | CLI tool + dashboard | `npm install -g seoagent` |
| `seoagent-mcp` | MCP server | `npx seoagent-mcp` |

`@seoagent/core` is internal (not published separately).

### Future Optional Paid Tier (not in v1)
- Hosted DataForSEO proxy so users don't need their own API key
- Hosted scheduled rank tracking service
- v1 is fully self-hosted, BYOK (bring your own keys)

## Scale Target
- Site audits up to 50,000 pages
- Keyword tracking: thousands of keywords per project
- SQLite handles this comfortably for local use

## Tech Stack Summary
- **Runtime:** Node.js
- **Language:** TypeScript
- **Database:** SQLite (better-sqlite3)
- **Crawler:** undici + cheerio
- **CLI:** commander.js
- **MCP:** @modelcontextprotocol/sdk
- **Dashboard:** Vite + React
- **LLM:** Anthropic/OpenAI/Ollama (user's key)
- **Data provider:** DataForSEO (default, swappable)
