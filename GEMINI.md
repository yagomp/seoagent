# SEOAgent — Gemini Agent Instructions

See `AGENTS.md` for full details. This file covers Gemini-specific setup.

## Overview

SEOAgent is a TypeScript monorepo (pnpm workspaces) with 4 packages:
- `@seoagent/core` — all logic (260 tests)
- `seoagent` — CLI (commander.js)
- `seoagent-mcp` — MCP server (24 tools)
- `@seoagent/dashboard` — Vite + React web UI

## Commands

```bash
pnpm install          # install
pnpm build            # build all
pnpm test             # test all
```

## Key Principle

Every feature is a function in `packages/core/src/` first. CLI, MCP, and dashboard are thin wrappers. If you're adding functionality, start in core.

## File Layout

- Business logic: `packages/core/src/*.ts` and subdirectories (`audit/`, `gsc/`, `strategy/`, `providers/`)
- Types: `packages/core/src/types.ts`
- Public API: `packages/core/src/index.ts` (barrel)
- Tests: `packages/core/src/__tests__/`
- CLI: `packages/cli/src/commands/`
- MCP: `packages/mcp/src/tools/`
- Dashboard API: `packages/dashboard/src/server/routes.ts`
- Dashboard UI: `packages/dashboard/src/app/pages/`

## Testing

Vitest with globals. Mock external APIs. Use temp dirs with `SEOAGENT_HOME` env var.

## Refer to AGENTS.md for

- Full function signatures
- MCP installation config
- CLI command reference
- Testing patterns
- How to add new features
