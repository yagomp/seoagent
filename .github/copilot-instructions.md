# SEOAgent — Copilot Instructions

SEOAgent is an open-source, agent-first SEO toolkit (TypeScript pnpm monorepo).

## Architecture

- `packages/core/` — ALL business logic. Every feature starts here.
- `packages/cli/` — commander.js CLI wrapper
- `packages/mcp/` — MCP server (24 tools) wrapper
- `packages/dashboard/` — Vite + React web UI

## When writing code

- New features go in `packages/core/src/` first
- Export from `packages/core/src/index.ts`
- Write tests in `packages/core/src/__tests__/`
- Use Vitest with globals, mock HTTP calls
- SQLite via better-sqlite3, schema in `schema.ts`
- Types in `packages/core/src/types.ts`

## Key patterns

```typescript
// Database access
const db = openDatabase(getDbPath(slug));
// ... use db
closeDatabase(db);

// Test isolation
process.env.SEOAGENT_HOME = tmpDir; // temp dir per test

// DataForSEO
const provider = createProvider(login, password);
const data = await provider.getKeywordVolume(keywords, locale);
```

## Commands

```bash
pnpm build    # build all
pnpm test     # test all (260 tests)
```

See `AGENTS.md` for full function reference.
