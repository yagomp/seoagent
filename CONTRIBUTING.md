# Contributing to SEOAgent

Thanks for your interest in contributing. SEOAgent is built for AI agents and developers who take SEO seriously — contributions that improve correctness, coverage, and composability are most welcome.

## Getting Started

```bash
git clone https://github.com/yagomp/seoagent.git
cd seoagent
pnpm install
pnpm build
pnpm test          # 260 tests must pass before opening a PR
```

## Project Structure

```
packages/
  core/       All business logic — start here for new features
  cli/        CLI commands — thin wrappers over core
  mcp/        MCP tools — thin wrappers over core
  dashboard/  Vite + React local UI — read-only display
```

**Key rule:** every feature is a function in `core` first. CLI, MCP, and dashboard are wrappers. If you can't call it from a script, it doesn't exist yet.

## How to Contribute

### Reporting Bugs

Open an issue with:
- SEOAgent version (`seoagent --version`)
- Node.js version (`node --version`)
- Command you ran and full output
- What you expected vs. what happened

### Suggesting Features

Open an issue describing the use case. Explain what an AI agent or developer would do with the feature, and what data source would back it.

### Submitting a Pull Request

1. Fork the repo and create a branch: `git checkout -b feat/your-feature`
2. Write tests first (TDD) — tests live in `packages/core/src/__tests__/`
3. Implement in `core`, then wire up CLI/MCP if needed
4. Run `pnpm test` — all tests must pass
5. Run `pnpm build` — no TypeScript errors
6. Open a PR with a clear description of what changed and why

### Adding a New Data Provider

Implement `SearchDataProvider` from `packages/core/src/types.ts`:

```typescript
interface SearchDataProvider {
  getKeywordVolume(keywords: string[], locale: string): Promise<KeywordData[]>
  getSerpResults(keyword: string, locale: string): Promise<SerpResult[]>
  getKeywordSuggestions(seed: string, locale: string): Promise<string[]>
  getCompetitorKeywords(domain: string, locale: string): Promise<KeywordData[]>
}
```

Add it to `packages/core/src/provider-factory.ts` and document the required config keys.

### Adding a New MCP Tool

1. Add the core function in `packages/core/src/`
2. Export it from `packages/core/src/index.ts`
3. Add the tool handler in the relevant file under `packages/mcp/src/tools/`
4. Register it in `packages/mcp/src/server.ts`
5. Add a test in `packages/mcp/src/__tests__/`

## Code Style

- TypeScript strict mode
- No `any` — use proper types or `unknown`
- No commented-out code
- Errors should include actionable context (agents read them)
- Prefer explicit over clever

## Commit Messages

Use conventional commits:

```
feat: add pagespeed integration to audit-page
fix: handle sitemap index redirect chains
docs: update MCP tool list in README
test: add coverage for empty SERP results
```

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
