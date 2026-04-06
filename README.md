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
- [Quick Start](#quick-start)
  - [CLI](#cli)
  - [MCP Server](#mcp-server-for-ai-agents)
  - [Dashboard](#dashboard)
- [Data Sources](#data-sources)
- [Configuration](#configuration)
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
