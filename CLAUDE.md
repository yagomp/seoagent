# SEOAgent

Open-source, agent-first SEO toolkit — keyword research, rank tracking, site audits, competitor analysis, content gap analysis, domain reputation, and AI-powered strategy generation.

## Architecture

TypeScript pnpm monorepo with 4 packages:

- `packages/core/` (`@seoagent/core`) — all business logic. Every feature is a function here first.
- `packages/cli/` (`seoagent`) — commander.js CLI, thin wrapper over core
- `packages/mcp/` (`seoagent-mcp`) — MCP server with 24 tools, thin wrapper over core
- `packages/dashboard/` — Vite + React + Tailwind local web UI (read-only)

## Tech Stack

- TypeScript, Node.js >= 20, pnpm workspaces
- SQLite via better-sqlite3 (one DB per project at `~/.seoagent/projects/<slug>/seoagent.db`)
- Vitest for testing (260 tests across 38 files)
- DataForSEO for keyword/SERP/backlink data
- Google Search Console API (googleapis)
- LLM strategy: Anthropic SDK, OpenAI SDK, Ollama (fetch)
- Crawler: undici + cheerio
- Dashboard: Vite, React, React Router, Tailwind CSS v4, Recharts

## Key Commands

```bash
pnpm install          # install all deps
pnpm build            # build all packages
pnpm test             # run all tests
pnpm -r run test      # run tests across all packages

# Core only
cd packages/core && pnpm test
cd packages/core && pnpm build
```

## Code Conventions

- All business logic in `packages/core/src/`. CLI/MCP/Dashboard are thin wrappers.
- Barrel export from `packages/core/src/index.ts` — add new exports there.
- Tests in `packages/core/src/__tests__/` using Vitest with globals.
- TDD workflow: test first, implement, verify.
- SQLite schema in `packages/core/src/schema.ts` — tables created via `openDatabase()`.
- Config at `~/.seoagent/config.json`, projects at `~/.seoagent/projects/<slug>/`.
- `SEOAGENT_HOME` env var overrides `~/.seoagent` (used in tests with temp dirs).

## Data Sources

1. **Free**: Google Search Console API, PageSpeed Insights, local crawler
2. **Paid**: DataForSEO (~$0.001/query) — keyword volumes, SERP, backlinks
3. **Derived**: content gaps, rank deltas, audit scores, strategy (LLM or rule-based)

## Database Tables

`keywords`, `rank_history`, `crawl_pages`, `crawl_links`, `backlinks`, `dr_history`, `serp_cache`, `strategies`, `gsc_data`
