# Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up the TypeScript monorepo, config system, SQLite database layer, and project management — the foundation every other subsystem builds on.

**Architecture:** pnpm workspace monorepo with four packages (`core`, `cli`, `mcp`, `dashboard`). All business logic lives in `@seoagent/core`. Config stored in `~/.seoagent/config.json`, per-project data in `~/.seoagent/projects/<slug>/seoagent.db` (SQLite via better-sqlite3). Project management (add, list, use, delete) is the first core feature.

**Tech Stack:** TypeScript, pnpm workspaces, Vitest, better-sqlite3, zod (config validation)

---

## File Structure

```
seoagent/
├── package.json                          # Root workspace config
├── pnpm-workspace.yaml                   # Workspace definition
├── tsconfig.base.json                    # Shared TS config
├── .gitignore
├── packages/
│   ├── core/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vitest.config.ts
│   │   └── src/
│   │       ├── index.ts                  # Public API barrel export
│   │       ├── config.ts                 # Config read/write/validate
│   │       ├── paths.ts                  # Resolves ~/.seoagent paths
│   │       ├── database.ts              # SQLite connection + migrations
│   │       ├── schema.ts                # All table definitions (SQL)
│   │       ├── project.ts               # Project CRUD operations
│   │       └── types.ts                 # Shared TypeScript types
│   ├── cli/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       └── index.ts                 # Placeholder entry point
│   ├── mcp/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       └── index.ts                 # Placeholder entry point
│   └── dashboard/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           └── index.ts                 # Placeholder entry point
```

---

### Task 1: Initialize Monorepo

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.gitignore`

- [ ] **Step 1: Create root `package.json`**

```json
{
  "name": "seoagent",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "pnpm -r run build",
    "test": "pnpm -r run test",
    "lint": "pnpm -r run lint"
  },
  "devDependencies": {
    "typescript": "^5.8.0"
  },
  "engines": {
    "node": ">=20"
  }
}
```

- [ ] **Step 2: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - "packages/*"
```

- [ ] **Step 3: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "outDir": "dist",
    "rootDir": "src"
  }
}
```

- [ ] **Step 4: Create `.gitignore`**

```
node_modules/
dist/
*.tsbuildinfo
.DS_Store
coverage/
```

- [ ] **Step 5: Install dependencies**

Run: `pnpm install`
Expected: lockfile created, `node_modules` populated

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json .gitignore pnpm-lock.yaml
git commit -m "chore: initialize pnpm monorepo"
```

---

### Task 2: Scaffold Core Package

**Files:**
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/vitest.config.ts`
- Create: `packages/core/src/index.ts`
- Create: `packages/core/src/types.ts`

- [ ] **Step 1: Create `packages/core/package.json`**

```json
{
  "name": "@seoagent/core",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "better-sqlite3": "^11.0.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.0",
    "vitest": "^3.1.0"
  }
}
```

- [ ] **Step 2: Create `packages/core/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `packages/core/vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
  },
});
```

- [ ] **Step 4: Create `packages/core/src/types.ts`**

```typescript
export interface ProjectConfig {
  domain: string;
  name: string;
  description?: string;
  niche?: string;
  competitors?: string[];
  locale?: string;
}

export interface GlobalConfig {
  activeProject?: string;
  dataforseo?: {
    login: string;
    password: string;
  };
  llm?: {
    provider: "anthropic" | "openai" | "ollama";
    apiKey?: string;
    model?: string;
    baseUrl?: string;
  };
}

export interface KeywordData {
  keyword: string;
  volume: number;
  difficulty: number;
  cpc?: number;
  competition?: number;
}

export interface SerpResult {
  position: number;
  url: string;
  title: string;
  description: string;
  domain: string;
}

export interface SearchDataProvider {
  getKeywordVolume(
    keywords: string[],
    locale: string
  ): Promise<KeywordData[]>;
  getSerpResults(keyword: string, locale: string): Promise<SerpResult[]>;
  getKeywordSuggestions(seed: string, locale: string): Promise<string[]>;
  getCompetitorKeywords(
    domain: string,
    locale: string
  ): Promise<KeywordData[]>;
}
```

- [ ] **Step 5: Create `packages/core/src/index.ts`**

```typescript
export type {
  ProjectConfig,
  GlobalConfig,
  KeywordData,
  SerpResult,
  SearchDataProvider,
} from "./types.js";
```

- [ ] **Step 6: Install and verify build**

Run: `cd packages/core && pnpm install && pnpm build`
Expected: `dist/` created with `.js` and `.d.ts` files, no errors

- [ ] **Step 7: Commit**

```bash
git add packages/core/
git commit -m "chore: scaffold @seoagent/core package"
```

---

### Task 3: Scaffold CLI, MCP, and Dashboard Packages (Stubs)

**Files:**
- Create: `packages/cli/package.json`
- Create: `packages/cli/tsconfig.json`
- Create: `packages/cli/src/index.ts`
- Create: `packages/mcp/package.json`
- Create: `packages/mcp/tsconfig.json`
- Create: `packages/mcp/src/index.ts`
- Create: `packages/dashboard/package.json`
- Create: `packages/dashboard/tsconfig.json`
- Create: `packages/dashboard/src/index.ts`

- [ ] **Step 1: Create `packages/cli/package.json`**

```json
{
  "name": "seoagent",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "seoagent": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "test": "vitest run"
  },
  "dependencies": {
    "@seoagent/core": "workspace:*"
  }
}
```

- [ ] **Step 2: Create `packages/cli/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `packages/cli/src/index.ts`**

```typescript
#!/usr/bin/env node
console.log("seoagent CLI — not yet implemented");
```

- [ ] **Step 4: Create `packages/mcp/package.json`**

```json
{
  "name": "seoagent-mcp",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "seoagent-mcp": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "test": "vitest run"
  },
  "dependencies": {
    "@seoagent/core": "workspace:*"
  }
}
```

- [ ] **Step 5: Create `packages/mcp/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 6: Create `packages/mcp/src/index.ts`**

```typescript
#!/usr/bin/env node
console.log("seoagent-mcp server — not yet implemented");
```

- [ ] **Step 7: Create `packages/dashboard/package.json`**

```json
{
  "name": "@seoagent/dashboard",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "echo 'dashboard not yet implemented'",
    "build": "tsc"
  },
  "dependencies": {
    "@seoagent/core": "workspace:*"
  }
}
```

- [ ] **Step 8: Create `packages/dashboard/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 9: Create `packages/dashboard/src/index.ts`**

```typescript
console.log("dashboard — not yet implemented");
```

- [ ] **Step 10: Install all workspaces and verify**

Run: `pnpm install && pnpm build`
Expected: All four packages build successfully

- [ ] **Step 11: Commit**

```bash
git add packages/cli/ packages/mcp/ packages/dashboard/
git commit -m "chore: scaffold cli, mcp, and dashboard package stubs"
```

---

### Task 4: Implement Path Resolution

**Files:**
- Create: `packages/core/src/paths.ts`
- Create: `packages/core/src/__tests__/paths.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/__tests__/paths.test.ts`:

```typescript
import { describe, it, expect, afterEach, vi } from "vitest";
import { getConfigDir, getProjectDir, getConfigPath, getDbPath } from "../paths.js";

describe("paths", () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("returns default config dir under home", () => {
    const dir = getConfigDir();
    expect(dir).toMatch(/\.seoagent$/);
  });

  it("respects SEOAGENT_HOME env var", () => {
    process.env = { ...originalEnv, SEOAGENT_HOME: "/tmp/test-seoagent" };
    const dir = getConfigDir();
    expect(dir).toBe("/tmp/test-seoagent");
  });

  it("returns project dir under config dir", () => {
    process.env = { ...originalEnv, SEOAGENT_HOME: "/tmp/test-seoagent" };
    const dir = getProjectDir("my-site");
    expect(dir).toBe("/tmp/test-seoagent/projects/my-site");
  });

  it("returns config.json path", () => {
    process.env = { ...originalEnv, SEOAGENT_HOME: "/tmp/test-seoagent" };
    const p = getConfigPath();
    expect(p).toBe("/tmp/test-seoagent/config.json");
  });

  it("returns database path for a project", () => {
    process.env = { ...originalEnv, SEOAGENT_HOME: "/tmp/test-seoagent" };
    const p = getDbPath("my-site");
    expect(p).toBe("/tmp/test-seoagent/projects/my-site/seoagent.db");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm test -- src/__tests__/paths.test.ts`
Expected: FAIL — module `../paths.js` not found

- [ ] **Step 3: Write the implementation**

Create `packages/core/src/paths.ts`:

```typescript
import path from "node:path";
import os from "node:os";

export function getConfigDir(): string {
  return process.env.SEOAGENT_HOME ?? path.join(os.homedir(), ".seoagent");
}

export function getProjectDir(slug: string): string {
  return path.join(getConfigDir(), "projects", slug);
}

export function getConfigPath(): string {
  return path.join(getConfigDir(), "config.json");
}

export function getDbPath(slug: string): string {
  return path.join(getProjectDir(slug), "seoagent.db");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && pnpm test -- src/__tests__/paths.test.ts`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/paths.ts packages/core/src/__tests__/paths.test.ts
git commit -m "feat(core): add path resolution for config and project dirs"
```

---

### Task 5: Implement Config System

**Files:**
- Create: `packages/core/src/config.ts`
- Create: `packages/core/src/__tests__/config.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/__tests__/config.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { loadConfig, saveConfig, setConfigValue, getConfigValue } from "../config.js";

describe("config", () => {
  let tmpDir: string;
  const originalEnv = process.env;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "seoagent-test-"));
    process.env = { ...originalEnv, SEOAGENT_HOME: tmpDir };
  });

  afterEach(() => {
    process.env = originalEnv;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns empty config when no file exists", () => {
    const config = loadConfig();
    expect(config).toEqual({});
  });

  it("saves and loads config", () => {
    saveConfig({ activeProject: "my-site" });
    const config = loadConfig();
    expect(config.activeProject).toBe("my-site");
  });

  it("sets a nested config value with dot notation", () => {
    setConfigValue("dataforseo.login", "my-login");
    const config = loadConfig();
    expect(config.dataforseo?.login).toBe("my-login");
  });

  it("sets multiple nested values without overwriting siblings", () => {
    setConfigValue("dataforseo.login", "my-login");
    setConfigValue("dataforseo.password", "my-pass");
    const config = loadConfig();
    expect(config.dataforseo?.login).toBe("my-login");
    expect(config.dataforseo?.password).toBe("my-pass");
  });

  it("gets a nested config value with dot notation", () => {
    setConfigValue("llm.provider", "anthropic");
    const value = getConfigValue("llm.provider");
    expect(value).toBe("anthropic");
  });

  it("returns undefined for missing keys", () => {
    const value = getConfigValue("llm.apiKey");
    expect(value).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm test -- src/__tests__/config.test.ts`
Expected: FAIL — module `../config.js` not found

- [ ] **Step 3: Write the implementation**

Create `packages/core/src/config.ts`:

```typescript
import fs from "node:fs";
import path from "node:path";
import { getConfigPath, getConfigDir } from "./paths.js";
import type { GlobalConfig } from "./types.js";

export function loadConfig(): GlobalConfig {
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) {
    return {};
  }
  const raw = fs.readFileSync(configPath, "utf-8");
  return JSON.parse(raw) as GlobalConfig;
}

export function saveConfig(config: GlobalConfig): void {
  const configPath = getConfigPath();
  const dir = path.dirname(configPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
}

export function setConfigValue(key: string, value: string): void {
  const config = loadConfig() as Record<string, unknown>;
  const parts = key.split(".");

  let current = config;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (current[part] === undefined || typeof current[part] !== "object") {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }

  current[parts[parts.length - 1]] = value;
  saveConfig(config as GlobalConfig);
}

export function getConfigValue(key: string): unknown {
  const config = loadConfig() as Record<string, unknown>;
  const parts = key.split(".");

  let current: unknown = config;
  for (const part of parts) {
    if (current === undefined || current === null || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && pnpm test -- src/__tests__/config.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 5: Export from barrel**

Update `packages/core/src/index.ts` — add to the end:

```typescript
export { loadConfig, saveConfig, setConfigValue, getConfigValue } from "./config.js";
export { getConfigDir, getProjectDir, getConfigPath, getDbPath } from "./paths.js";
```

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/config.ts packages/core/src/__tests__/config.test.ts packages/core/src/index.ts
git commit -m "feat(core): add config system with dot-notation get/set"
```

---

### Task 6: Implement SQLite Database Layer

**Files:**
- Create: `packages/core/src/schema.ts`
- Create: `packages/core/src/database.ts`
- Create: `packages/core/src/__tests__/database.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/__tests__/database.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { openDatabase, closeDatabase } from "../database.js";

describe("database", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "seoagent-db-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates database file and runs migrations", () => {
    const dbPath = path.join(tmpDir, "seoagent.db");
    const db = openDatabase(dbPath);

    // Check that tables were created
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
      )
      .all() as { name: string }[];

    const tableNames = tables.map((t) => t.name);
    expect(tableNames).toContain("keywords");
    expect(tableNames).toContain("rank_history");
    expect(tableNames).toContain("crawl_pages");
    expect(tableNames).toContain("crawl_links");
    expect(tableNames).toContain("backlinks");
    expect(tableNames).toContain("dr_history");
    expect(tableNames).toContain("serp_cache");
    expect(tableNames).toContain("strategies");
    expect(tableNames).toContain("gsc_data");

    closeDatabase(db);
  });

  it("is idempotent — opening twice does not error", () => {
    const dbPath = path.join(tmpDir, "seoagent.db");
    const db1 = openDatabase(dbPath);
    closeDatabase(db1);

    const db2 = openDatabase(dbPath);
    const tables = db2
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
      .all() as { name: string }[];
    expect(tables.length).toBeGreaterThanOrEqual(9);
    closeDatabase(db2);
  });

  it("enables WAL mode for performance", () => {
    const dbPath = path.join(tmpDir, "seoagent.db");
    const db = openDatabase(dbPath);
    const result = db.prepare("PRAGMA journal_mode").get() as { journal_mode: string };
    expect(result.journal_mode).toBe("wal");
    closeDatabase(db);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm test -- src/__tests__/database.test.ts`
Expected: FAIL — module `../database.js` not found

- [ ] **Step 3: Write the schema**

Create `packages/core/src/schema.ts`:

```typescript
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS keywords (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'en-US',
  volume INTEGER,
  difficulty REAL,
  cpc REAL,
  current_position INTEGER,
  tracked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(keyword, locale)
);

CREATE TABLE IF NOT EXISTS rank_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword_id INTEGER NOT NULL REFERENCES keywords(id),
  position INTEGER,
  url TEXT,
  checked_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_rank_history_keyword ON rank_history(keyword_id, checked_at);

CREATE TABLE IF NOT EXISTS crawl_pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL UNIQUE,
  status_code INTEGER,
  title TEXT,
  meta_description TEXT,
  h1 TEXT,
  word_count INTEGER,
  load_time_ms INTEGER,
  issues TEXT,
  crawled_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS crawl_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_url TEXT NOT NULL,
  target_url TEXT NOT NULL,
  anchor_text TEXT,
  is_internal INTEGER NOT NULL DEFAULT 1,
  status_code INTEGER
);
CREATE INDEX IF NOT EXISTS idx_crawl_links_source ON crawl_links(source_url);
CREATE INDEX IF NOT EXISTS idx_crawl_links_target ON crawl_links(target_url);

CREATE TABLE IF NOT EXISTS backlinks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_domain TEXT NOT NULL,
  source_url TEXT NOT NULL,
  target_url TEXT NOT NULL,
  anchor_text TEXT,
  is_dofollow INTEGER NOT NULL DEFAULT 1,
  domain_rating REAL,
  first_seen TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_backlinks_domain ON backlinks(source_domain);

CREATE TABLE IF NOT EXISTS dr_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  domain_rating REAL NOT NULL,
  referring_domains INTEGER,
  checked_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS serp_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'en-US',
  results TEXT NOT NULL,
  fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(keyword, locale)
);

CREATE TABLE IF NOT EXISTS strategies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  strategy TEXT NOT NULL,
  generated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS gsc_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  query TEXT,
  page TEXT,
  clicks INTEGER NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  ctr REAL NOT NULL DEFAULT 0,
  position REAL NOT NULL DEFAULT 0,
  synced_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_gsc_data_date ON gsc_data(date);
CREATE INDEX IF NOT EXISTS idx_gsc_data_query ON gsc_data(query);
CREATE INDEX IF NOT EXISTS idx_gsc_data_page ON gsc_data(page);
`;
```

- [ ] **Step 4: Write the database module**

Create `packages/core/src/database.ts`:

```typescript
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { SCHEMA_SQL } from "./schema.js";

export function openDatabase(dbPath: string): Database.Database {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA_SQL);

  return db;
}

export function closeDatabase(db: Database.Database): void {
  db.close();
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/core && pnpm test -- src/__tests__/database.test.ts`
Expected: All 3 tests PASS

- [ ] **Step 6: Export from barrel**

Add to `packages/core/src/index.ts`:

```typescript
export { openDatabase, closeDatabase } from "./database.js";
```

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/schema.ts packages/core/src/database.ts packages/core/src/__tests__/database.test.ts packages/core/src/index.ts
git commit -m "feat(core): add SQLite database layer with schema migrations"
```

---

### Task 7: Implement Project Management

**Files:**
- Create: `packages/core/src/project.ts`
- Create: `packages/core/src/__tests__/project.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/__tests__/project.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { addProject, listProjects, getProject, removeProject, getActiveProject, setActiveProject } from "../project.js";

describe("project", () => {
  let tmpDir: string;
  const originalEnv = process.env;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "seoagent-proj-test-"));
    process.env = { ...originalEnv, SEOAGENT_HOME: tmpDir };
  });

  afterEach(() => {
    process.env = originalEnv;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("adds a project and creates its directory", () => {
    addProject("my-site", { domain: "my-site.com", name: "My Site" });

    const projectDir = path.join(tmpDir, "projects", "my-site");
    expect(fs.existsSync(projectDir)).toBe(true);

    const projectJson = JSON.parse(
      fs.readFileSync(path.join(projectDir, "project.json"), "utf-8")
    );
    expect(projectJson.domain).toBe("my-site.com");
    expect(projectJson.name).toBe("My Site");
  });

  it("lists all projects", () => {
    addProject("site-a", { domain: "a.com", name: "Site A" });
    addProject("site-b", { domain: "b.com", name: "Site B" });

    const projects = listProjects();
    expect(projects).toHaveLength(2);
    expect(projects.map((p) => p.slug).sort()).toEqual(["site-a", "site-b"]);
  });

  it("returns empty array when no projects exist", () => {
    const projects = listProjects();
    expect(projects).toEqual([]);
  });

  it("gets a single project by slug", () => {
    addProject("my-site", { domain: "my-site.com", name: "My Site", niche: "tech" });

    const project = getProject("my-site");
    expect(project).not.toBeNull();
    expect(project!.config.domain).toBe("my-site.com");
    expect(project!.config.niche).toBe("tech");
  });

  it("returns null for non-existent project", () => {
    const project = getProject("nope");
    expect(project).toBeNull();
  });

  it("removes a project", () => {
    addProject("my-site", { domain: "my-site.com", name: "My Site" });
    removeProject("my-site");

    const project = getProject("my-site");
    expect(project).toBeNull();

    const projectDir = path.join(tmpDir, "projects", "my-site");
    expect(fs.existsSync(projectDir)).toBe(false);
  });

  it("throws when adding a project that already exists", () => {
    addProject("my-site", { domain: "my-site.com", name: "My Site" });
    expect(() => {
      addProject("my-site", { domain: "other.com", name: "Other" });
    }).toThrow(/already exists/);
  });

  it("sets and gets the active project", () => {
    addProject("my-site", { domain: "my-site.com", name: "My Site" });
    setActiveProject("my-site");

    const active = getActiveProject();
    expect(active).toBe("my-site");
  });

  it("throws when setting active project that does not exist", () => {
    expect(() => setActiveProject("nope")).toThrow(/not found/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm test -- src/__tests__/project.test.ts`
Expected: FAIL — module `../project.js` not found

- [ ] **Step 3: Write the implementation**

Create `packages/core/src/project.ts`:

```typescript
import fs from "node:fs";
import path from "node:path";
import { getConfigDir, getProjectDir } from "./paths.js";
import { loadConfig, saveConfig } from "./config.js";
import type { ProjectConfig } from "./types.js";

export interface ProjectEntry {
  slug: string;
  config: ProjectConfig;
}

export function addProject(slug: string, config: ProjectConfig): void {
  const dir = getProjectDir(slug);

  if (fs.existsSync(dir)) {
    throw new Error(`Project "${slug}" already exists`);
  }

  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "project.json"),
    JSON.stringify(config, null, 2) + "\n"
  );
}

export function listProjects(): ProjectEntry[] {
  const projectsDir = path.join(getConfigDir(), "projects");
  if (!fs.existsSync(projectsDir)) {
    return [];
  }

  const entries = fs.readdirSync(projectsDir, { withFileTypes: true });
  const projects: ProjectEntry[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const configPath = path.join(projectsDir, entry.name, "project.json");
    if (!fs.existsSync(configPath)) continue;

    const raw = fs.readFileSync(configPath, "utf-8");
    projects.push({
      slug: entry.name,
      config: JSON.parse(raw) as ProjectConfig,
    });
  }

  return projects;
}

export function getProject(slug: string): ProjectEntry | null {
  const dir = getProjectDir(slug);
  const configPath = path.join(dir, "project.json");

  if (!fs.existsSync(configPath)) {
    return null;
  }

  const raw = fs.readFileSync(configPath, "utf-8");
  return {
    slug,
    config: JSON.parse(raw) as ProjectConfig,
  };
}

export function removeProject(slug: string): void {
  const dir = getProjectDir(slug);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }

  // Clear active project if it was this one
  const config = loadConfig();
  if (config.activeProject === slug) {
    config.activeProject = undefined;
    saveConfig(config);
  }
}

export function setActiveProject(slug: string): void {
  const project = getProject(slug);
  if (!project) {
    throw new Error(`Project "${slug}" not found`);
  }

  const config = loadConfig();
  config.activeProject = slug;
  saveConfig(config);
}

export function getActiveProject(): string | undefined {
  const config = loadConfig();
  return config.activeProject;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && pnpm test -- src/__tests__/project.test.ts`
Expected: All 9 tests PASS

- [ ] **Step 5: Export from barrel**

Add to `packages/core/src/index.ts`:

```typescript
export type { ProjectEntry } from "./project.js";
export {
  addProject,
  listProjects,
  getProject,
  removeProject,
  setActiveProject,
  getActiveProject,
} from "./project.js";
```

- [ ] **Step 6: Run all tests**

Run: `cd packages/core && pnpm test`
Expected: All tests pass (paths: 5, config: 6, database: 3, project: 9 = 23 total)

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/project.ts packages/core/src/__tests__/project.test.ts packages/core/src/index.ts
git commit -m "feat(core): add project management (add, list, get, remove, active)"
```

---

### Task 8: Verify Full Build and Final Commit

**Files:**
- Modify: `packages/core/src/index.ts` (ensure complete)

- [ ] **Step 1: Run full build from root**

Run: `pnpm build`
Expected: All packages compile without errors

- [ ] **Step 2: Run all tests from root**

Run: `pnpm test`
Expected: All 23 tests pass across the core package

- [ ] **Step 3: Verify the barrel export is complete**

Read `packages/core/src/index.ts` and confirm it exports everything:

```typescript
// Types
export type {
  ProjectConfig,
  GlobalConfig,
  KeywordData,
  SerpResult,
  SearchDataProvider,
} from "./types.js";

// Paths
export { getConfigDir, getProjectDir, getConfigPath, getDbPath } from "./paths.js";

// Config
export { loadConfig, saveConfig, setConfigValue, getConfigValue } from "./config.js";

// Database
export { openDatabase, closeDatabase } from "./database.js";

// Projects
export type { ProjectEntry } from "./project.js";
export {
  addProject,
  listProjects,
  getProject,
  removeProject,
  setActiveProject,
  getActiveProject,
} from "./project.js";
```

- [ ] **Step 4: Commit final state**

```bash
git add -A
git commit -m "chore: verify foundation build and exports"
```
