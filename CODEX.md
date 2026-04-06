# SEOAgent — Codex Agent Instructions

See `AGENTS.md` for full details. This file covers Codex-specific notes.

## Setup

```bash
pnpm install && pnpm build
```

## Running Tests

```bash
pnpm test                           # all packages
cd packages/core && pnpm test       # core only (231 tests)
cd packages/cli && pnpm test        # CLI tests (16 tests)
cd packages/mcp && pnpm test        # MCP tests (13 tests)
```

## Architecture

TypeScript pnpm monorepo. All logic in `packages/core/`. CLI (`packages/cli/`), MCP server (`packages/mcp/`), and dashboard (`packages/dashboard/`) are thin wrappers.

## Key Files

- `packages/core/src/index.ts` — barrel export, all public API
- `packages/core/src/types.ts` — shared types
- `packages/core/src/schema.ts` — SQLite schema (9 tables)
- `packages/core/src/__tests__/` — all core tests

## Adding Features

1. Types in `types.ts`
2. Test in `__tests__/`
3. Implementation in `core/src/`
4. Export in `index.ts`
5. CLI command in `cli/src/commands/`
6. MCP tool in `mcp/src/tools/`

## Refer to AGENTS.md for full function reference.
