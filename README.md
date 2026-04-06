# SEOAgent

[![Latest Release](https://img.shields.io/github/v/release/yagomp/seoagent?label=release&color=brightgreen)](https://github.com/yagomp/seoagent/releases)
[![GitHub Stars](https://img.shields.io/github/stars/yagomp/seoagent?style=flat&color=yellow)](https://github.com/yagomp/seoagent/stargazers)
[![npm downloads](https://img.shields.io/npm/dt/@seoagent/cli?label=downloads&color=blue)](https://www.npmjs.com/package/@seoagent/cli)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

Open-source, agent-first SEO toolkit — keyword research, rank tracking, site audits, competitor analysis, content gap analysis, domain reputation, and AI-powered strategy generation. Built for AI agents first, humans second.

## Table of Contents

- [Features](#features)
- [Interfaces](#interfaces)
- [Ask Your Agent](#ask-your-agent)
- [Quick Start](#quick-start)
  - [CLI](#cli)
  - [MCP Server](#mcp-server-for-ai-agents)
  - [Dashboard](#dashboard)
- [Data Sources](#data-sources)
- [Configuration](#configuration)
- [Updating](#updating)
- [Development](#development)
- [License](#license)

## Features

- **Keyword Research** — Search volumes, difficulty scores, keyword suggestions via DataForSEO
- **Rank Tracking** — Track keyword positions over time, movers reports
- **Site Audit** — Crawl up to 50k pages, detect SEO issues (broken links, missing meta, thin content, duplicate titles, orphan pages)
- **Competitor Analysis** — Keyword overlap, content gap identification
- **Domain Reputation** — DR score, backlink profile, referring domains, link opportunities
- **Google Search Console** — Clicks, impressions, CTR, top pages and queries
- **Strategy Engine** — AI-powered (Claude/GPT/Ollama) or rule-based SEO strategy generation

## Interfaces

| Interface | Description |
|-----------|-------------|
| **CLI** | `npm install -g @seoagent/cli` — full command-line toolkit |
| **MCP Server** | `npx seoagent-mcp` — 24 tools for AI agents (Claude, Cursor, etc.) |
| **Dashboard** | `seoagent dashboard` — local web UI at http://localhost:3847 |
| **Library** | `@seoagent/core` — import functions directly in your code |

## Ask Your Agent

Once SEOAgent is connected via MCP, just talk to your AI agent naturally. Here are prompts that work well:

### Site Audit

```
Do a full audit of mysite.com and tell me what SEO issues to fix first.
```
```
Crawl mysite.com and find all broken links, missing meta descriptions, and pages with thin content.
```
```
Which pages on my site have duplicate title tags?
```
```
Are there any redirect chains or orphan pages on mysite.com?
```

### Keyword Research & Rank Tracking

```
Research keywords for "fantasy football app" and show me volume and difficulty.
```
```
What keyword suggestions do you have for my niche around project management tools?
```
```
Start tracking these keywords for my project: "best fpl app", "fpl tips", "fantasy premier league"
```
```
Check current rankings for all tracked keywords and show me what moved this week.
```
```
Which keywords did I gain or lose positions on since last check?
```

### Competitor Analysis

```
Compare my site against competitor.com — where do they rank that I don't?
```
```
What are the content gaps between my site and competitor.com?
```
```
Show me which keywords competitor.com ranks for that I'm missing.
```

### Backlinks & Domain Reputation

```
What's the domain reputation score for mysite.com?
```
```
Show me the backlink profile for mysite.com — referring domains, top links.
```
```
Find link building opportunities for my site based on competitor backlinks.
```
```
Has my domain reputation changed over the last 30 days?
```

### Google Search Console

```
What are my top 10 pages by clicks in Search Console this month?
```
```
Which queries get the most impressions but have low CTR? Those are quick wins.
```
```
Show me GSC performance for the last 3 months — clicks, impressions, average position.
```

### Strategy

```
Generate an SEO strategy for mysite.com based on current audit results and keyword data.
```
```
My site is in the fantasy football niche. What should I focus on for the next 90 days?
```
```
Refresh my SEO strategy — we've fixed the audit issues and added new content since last time.
```
```
Give me a prioritized action plan: what will move the needle fastest?
```

### Combined / Deep Dives

```
Do a complete SEO health check on mysite.com: crawl it, check rankings, pull GSC data, and give me a strategy.
```
```
I just launched mysite.com. Walk me through setting up SEOAgent and getting my first audit and keyword plan.
```
```
My organic traffic dropped 20% last month. Help me diagnose why using audit data and rank history.
```

---

## Quick Start

### CLI

**One-liner install** (installs Node.js automatically if missing):

```bash
curl -fsSL https://raw.githubusercontent.com/yagomp/seoagent/main/scripts/install.sh | sh
```

Or, if you already have Node.js >= 20:

```bash
npm install -g @seoagent/cli

# Setup
seoagent project add mysite --domain example.com --niche "tech"
seoagent config set dataforseo.login YOUR_LOGIN
seoagent config set dataforseo.password YOUR_PASSWORD

# Use
seoagent keywords research "seo tips" "content marketing"
seoagent audit crawl --max-pages 500
seoagent audit report
seoagent competitor keywords competitor.com
seoagent content-gaps
seoagent domain reputation
seoagent strategy generate

# Output formats
seoagent keywords research "seo" --format json
seoagent audit report --format markdown
```

### MCP Server (for AI Agents)

Add to your Claude Desktop config or Claude Code settings:

```json
{
  "mcpServers": {
    "seoagent": {
      "command": "npx",
      "args": ["seoagent-mcp"],
      "env": {
        "SEOAGENT_PROJECT": "mysite"
      }
    }
  }
}
```

24 tools available: `seoagent_keyword_research`, `seoagent_audit_crawl`, `seoagent_content_gaps`, `seoagent_strategy_generate`, and more.

### Dashboard

```bash
seoagent dashboard
# Opens http://localhost:3847
```

7 views: Overview, Keywords, Rank Tracker, Audit, Competitors, Backlinks, Strategy.

## Data Sources

| Tier | Source | Cost |
|------|--------|------|
| Free | Google Search Console, PageSpeed Insights, local crawler | $0 |
| Paid | DataForSEO (default, swappable) | ~$0.001/query |
| Derived | Content gaps, rank deltas, audit scores, strategy | $0 |

## Configuration

```bash
# DataForSEO (keyword/SERP/backlink data)
seoagent config set dataforseo.login YOUR_LOGIN
seoagent config set dataforseo.password YOUR_PASSWORD

# LLM for strategy generation (optional)
seoagent config set llm.provider anthropic  # or openai, ollama
seoagent config set llm.apiKey sk-ant-...
seoagent config set llm.model claude-sonnet-4-6

# Google Search Console (optional)
seoagent gsc auth --client-id YOUR_ID --client-secret YOUR_SECRET
```

Config stored at `~/.seoagent/config.json`. Per-project data in `~/.seoagent/projects/<slug>/`.

## Updating

### CLI

```bash
npm install -g @seoagent/cli@latest
```

### MCP Server

`npx` fetches the latest version automatically. To force-refresh a cached version:

```bash
npx --yes seoagent-mcp@latest
```

Or clear the npx cache entirely:

```bash
npx clear-npx-cache
```

### Library (`@seoagent/core`)

```bash
npm install @seoagent/core@latest
```

After updating the CLI, verify the installed version:

```bash
seoagent --version
```

---

## Development

```bash
git clone https://github.com/yagomp/seoagent.git
cd seoagent
pnpm install
pnpm build
pnpm test  # 260 tests
```

### Architecture

```
packages/
  core/       @seoagent/core — all business logic (231 tests)
  cli/        seoagent CLI (16 tests)
  mcp/        seoagent-mcp server (13 tests)
  dashboard/  Local Vite + React web UI
```

**Key principle:** Every feature is a function in `core` first. CLI, MCP, and dashboard are thin wrappers.

## License

MIT
