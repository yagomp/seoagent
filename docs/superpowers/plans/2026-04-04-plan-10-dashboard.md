# Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local read-only web dashboard at http://localhost:3847 that visualizes all SEO data from SQLite.

**Architecture:** Express backend serves a JSON API reading from SQLite via `@seoagent/core`, plus a Vite+React SPA with Tailwind CSS for styling and Recharts for charts. The Express server serves both the API and the built SPA static files.

**Tech Stack:** Express, Vite, React, React Router, Tailwind CSS v4, Recharts, @seoagent/core

---

## File Structure

```
packages/dashboard/
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── index.html
├── tailwind.css
├── src/
│   ├── server/
│   │   ├── index.ts              # Express server entry (API + static)
│   │   └── routes.ts             # All API route handlers
│   ├── app/
│   │   ├── main.tsx              # React entry point
│   │   ├── App.tsx               # Root component with React Router
│   │   ├── Layout.tsx            # Sidebar + header shell
│   │   ├── pages/
│   │   │   ├── Overview.tsx
│   │   │   ├── Keywords.tsx
│   │   │   ├── RankTracker.tsx
│   │   │   ├── Audit.tsx
│   │   │   ├── Competitors.tsx
│   │   │   ├── Backlinks.tsx
│   │   │   └── Strategy.tsx
│   │   └── components/
│   │       ├── DataTable.tsx      # Reusable sortable/filterable table
│   │       └── StatCard.tsx       # Metric card with label + value
│   └── __tests__/
│       └── routes.test.ts         # API route tests
```

---

### Task 1: Package Setup & Express API Server

**Files:**
- Modify: `packages/dashboard/package.json`
- Create: `packages/dashboard/tsconfig.node.json`
- Create: `packages/dashboard/src/server/index.ts`
- Create: `packages/dashboard/src/server/routes.ts`
- Create: `packages/dashboard/src/__tests__/routes.test.ts`

- [ ] **Step 1: Update `packages/dashboard/package.json`**

```json
{
  "name": "@seoagent/dashboard",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build && tsc -p tsconfig.node.json",
    "preview": "vite preview",
    "start": "node dist/server/index.js",
    "test": "vitest run"
  },
  "dependencies": {
    "@seoagent/core": "workspace:*",
    "express": "^5.1.0"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.5.0",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "react-router-dom": "^7.6.0",
    "recharts": "^2.15.0",
    "tailwindcss": "^4.1.0",
    "typescript": "^5.8.0",
    "vite": "^6.3.0",
    "vitest": "^3.1.0"
  }
}
```

- [ ] **Step 2: Create `packages/dashboard/tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "declaration": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/server"]
}
```

- [ ] **Step 3: Write the failing API route test**

Create `packages/dashboard/src/__tests__/routes.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { openDatabase, closeDatabase, addProject } from "@seoagent/core";
import { createApp } from "../server/routes.js";

describe("API routes", () => {
  let tmpDir: string;
  const originalEnv = process.env;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "seoagent-dash-test-"));
    process.env = { ...originalEnv, SEOAGENT_HOME: tmpDir };
    addProject("test-site", { domain: "test.com", name: "Test Site" });
    const db = openDatabase(path.join(tmpDir, "projects", "test-site", "seoagent.db"));
    // Seed some data
    db.prepare("INSERT INTO keywords (keyword, locale, volume, difficulty, current_position, tracked) VALUES (?, ?, ?, ?, ?, ?)").run("test keyword", "en-US", 1000, 45, 5, 1);
    db.prepare("INSERT INTO dr_history (domain_rating, referring_domains) VALUES (?, ?)").run(35, 120);
    db.prepare("INSERT INTO crawl_pages (url, status_code, title, meta_description, h1, word_count, issues) VALUES (?, ?, ?, ?, ?, ?, ?)").run("https://test.com", 200, "Test", "Description", "Heading", 500, "[]");
    closeDatabase(db);
  });

  afterEach(() => {
    process.env = originalEnv;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("GET /api/overview returns aggregate stats", async () => {
    const app = createApp("test-site");
    const res = await app.request("/api/overview");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.trackedKeywords).toBe(1);
    expect(data.domainRating).toBe(35);
    expect(data.crawledPages).toBe(1);
  });

  it("GET /api/keywords returns keyword list", async () => {
    const app = createApp("test-site");
    const res = await app.request("/api/keywords");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].keyword).toBe("test keyword");
    expect(data[0].volume).toBe(1000);
  });

  it("GET /api/dr-history returns DR snapshots", async () => {
    const app = createApp("test-site");
    const res = await app.request("/api/dr-history");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].domainRating).toBe(35);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd packages/dashboard && pnpm test`
Expected: FAIL — module `../server/routes.js` not found

- [ ] **Step 5: Write the API routes**

Create `packages/dashboard/src/server/routes.ts`:

```typescript
import express, { type Express } from "express";
import { openDatabase, closeDatabase, getDbPath } from "@seoagent/core";

export function createApp(projectSlug: string): Express {
  const app = express();
  const dbPath = getDbPath(projectSlug);

  function withDb<T>(fn: (db: import("better-sqlite3").Database) => T): T {
    const db = openDatabase(dbPath);
    try {
      return fn(db);
    } finally {
      closeDatabase(db);
    }
  }

  app.get("/api/overview", (_req, res) => {
    const data = withDb((db) => {
      const keywords = db.prepare("SELECT COUNT(*) as count FROM keywords WHERE tracked = 1").get() as { count: number };
      const dr = db.prepare("SELECT domain_rating FROM dr_history ORDER BY checked_at DESC LIMIT 1").get() as { domain_rating: number } | undefined;
      const pages = db.prepare("SELECT COUNT(*) as count FROM crawl_pages").get() as { count: number };
      const issues = db.prepare("SELECT COUNT(*) as count FROM crawl_pages WHERE issues != '[]' AND issues IS NOT NULL").get() as { count: number };
      return {
        trackedKeywords: keywords.count,
        domainRating: dr?.domain_rating ?? null,
        crawledPages: pages.count,
        pagesWithIssues: issues.count,
      };
    });
    res.json(data);
  });

  app.get("/api/keywords", (req, res) => {
    const sort = (req.query.sort as string) || "volume";
    const order = (req.query.order as string) || "DESC";
    const validSorts = ["keyword", "volume", "difficulty", "current_position"];
    const sortCol = validSorts.includes(sort) ? sort : "volume";
    const sortOrder = order.toUpperCase() === "ASC" ? "ASC" : "DESC";

    const data = withDb((db) => {
      return db.prepare(`SELECT keyword, locale, volume, difficulty, cpc, current_position as position, tracked FROM keywords ORDER BY ${sortCol} ${sortOrder}`).all();
    });
    res.json(data);
  });

  app.get("/api/rank-history", (req, res) => {
    const keyword = req.query.keyword as string;
    if (!keyword) {
      res.status(400).json({ error: "keyword query param required" });
      return;
    }
    const data = withDb((db) => {
      return db.prepare(`
        SELECT rh.position, rh.url, rh.checked_at as checkedAt
        FROM rank_history rh
        JOIN keywords k ON k.id = rh.keyword_id
        WHERE k.keyword = ?
        ORDER BY rh.checked_at ASC
      `).all(keyword);
    });
    res.json(data);
  });

  app.get("/api/audit", (_req, res) => {
    const data = withDb((db) => {
      const pages = db.prepare("SELECT url, status_code, title, meta_description, h1, word_count, issues, crawled_at FROM crawl_pages ORDER BY crawled_at DESC").all() as {
        url: string; status_code: number; title: string; meta_description: string;
        h1: string; word_count: number; issues: string; crawled_at: string;
      }[];
      const issuesByType: Record<string, number> = {};
      for (const page of pages) {
        const issues = JSON.parse(page.issues || "[]") as string[];
        for (const issue of issues) {
          issuesByType[issue] = (issuesByType[issue] || 0) + 1;
        }
      }
      return { pages, issuesByType, totalPages: pages.length };
    });
    res.json(data);
  });

  app.get("/api/audit/page", (req, res) => {
    const url = req.query.url as string;
    if (!url) {
      res.status(400).json({ error: "url query param required" });
      return;
    }
    const data = withDb((db) => {
      const page = db.prepare("SELECT * FROM crawl_pages WHERE url = ?").get(url);
      const inlinks = db.prepare("SELECT source_url, anchor_text FROM crawl_links WHERE target_url = ?").all(url);
      const outlinks = db.prepare("SELECT target_url, anchor_text, is_internal, status_code FROM crawl_links WHERE source_url = ?").all(url);
      return { page, inlinks, outlinks };
    });
    res.json(data);
  });

  app.get("/api/competitors", (_req, res) => {
    // Returns cached content gap / competitor data if available
    const data = withDb((db) => {
      const keywords = db.prepare("SELECT keyword, volume, difficulty, current_position FROM keywords ORDER BY volume DESC LIMIT 100").all();
      return { keywords };
    });
    res.json(data);
  });

  app.get("/api/backlinks", (_req, res) => {
    const data = withDb((db) => {
      const backlinks = db.prepare("SELECT source_domain, source_url, target_url, anchor_text, is_dofollow, domain_rating FROM backlinks ORDER BY domain_rating DESC LIMIT 100").all();
      const totalCount = db.prepare("SELECT COUNT(*) as count FROM backlinks").get() as { count: number };
      return { backlinks, total: totalCount.count };
    });
    res.json(data);
  });

  app.get("/api/dr-history", (_req, res) => {
    const data = withDb((db) => {
      return db.prepare("SELECT domain_rating as domainRating, referring_domains as referringDomains, checked_at as checkedAt FROM dr_history ORDER BY checked_at ASC").all();
    });
    res.json(data);
  });

  app.get("/api/strategy", (_req, res) => {
    const data = withDb((db) => {
      const row = db.prepare("SELECT strategy, generated_at FROM strategies ORDER BY generated_at DESC LIMIT 1").get() as { strategy: string; generated_at: string } | undefined;
      if (!row) return null;
      return { strategy: JSON.parse(row.strategy), generatedAt: row.generated_at };
    });
    res.json(data);
  });

  app.get("/api/gsc", (_req, res) => {
    const data = withDb((db) => {
      return db.prepare("SELECT date, query, page, clicks, impressions, ctr, position FROM gsc_data ORDER BY date DESC, clicks DESC LIMIT 200").all();
    });
    res.json(data);
  });

  return app;
}
```

- [ ] **Step 6: Write the server entry point**

Create `packages/dashboard/src/server/index.ts`:

```typescript
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { createApp } from "./routes.js";
import { getActiveProject } from "@seoagent/core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const projectSlug = process.env.SEOAGENT_PROJECT || getActiveProject();
if (!projectSlug) {
  console.error("No active project. Run: seoagent project use <slug>");
  process.exit(1);
}

const app = createApp(projectSlug);
const PORT = 3847;

// Serve static SPA files
const staticDir = path.join(__dirname, "..", "client");
app.use(express.static(staticDir));
app.get("*", (_req, res) => {
  res.sendFile(path.join(staticDir, "index.html"));
});

app.listen(PORT, () => {
  console.log(`SEOAgent dashboard: http://localhost:${PORT}`);
});
```

- [ ] **Step 7: Install dependencies and run tests**

Run: `cd packages/dashboard && pnpm install && pnpm test`
Expected: API route tests pass

- [ ] **Step 8: Commit**

```bash
git add packages/dashboard/
git commit -m "feat(dashboard): add Express API server with all endpoints"
```

---

### Task 2: Vite + React + Tailwind Setup

**Files:**
- Create: `packages/dashboard/vite.config.ts`
- Create: `packages/dashboard/index.html`
- Create: `packages/dashboard/tailwind.css`
- Modify: `packages/dashboard/tsconfig.json`
- Create: `packages/dashboard/src/app/main.tsx`
- Create: `packages/dashboard/src/app/App.tsx`

- [ ] **Step 1: Create `packages/dashboard/vite.config.ts`**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  root: ".",
  build: {
    outDir: "dist/client",
  },
  server: {
    proxy: {
      "/api": "http://localhost:3847",
    },
  },
});
```

- [ ] **Step 2: Create `packages/dashboard/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>SEOAgent Dashboard</title>
    <link rel="stylesheet" href="/tailwind.css" />
  </head>
  <body class="bg-gray-950 text-gray-100">
    <div id="root"></div>
    <script type="module" src="/src/app/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Create `packages/dashboard/tailwind.css`**

```css
@import "tailwindcss";
```

- [ ] **Step 4: Update `packages/dashboard/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "declaration": false,
    "noEmit": true
  },
  "include": ["src/app"]
}
```

- [ ] **Step 5: Create `packages/dashboard/src/app/main.tsx`**

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

- [ ] **Step 6: Create `packages/dashboard/src/app/App.tsx`**

```tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./Layout.js";
import { Overview } from "./pages/Overview.js";
import { Keywords } from "./pages/Keywords.js";
import { RankTracker } from "./pages/RankTracker.js";
import { Audit } from "./pages/Audit.js";
import { Competitors } from "./pages/Competitors.js";
import { Backlinks } from "./pages/Backlinks.js";
import { Strategy } from "./pages/Strategy.js";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/overview" replace />} />
          <Route path="/overview" element={<Overview />} />
          <Route path="/keywords" element={<Keywords />} />
          <Route path="/rank-tracker" element={<RankTracker />} />
          <Route path="/audit" element={<Audit />} />
          <Route path="/competitors" element={<Competitors />} />
          <Route path="/backlinks" element={<Backlinks />} />
          <Route path="/strategy" element={<Strategy />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 7: Commit**

```bash
git add packages/dashboard/
git commit -m "feat(dashboard): add Vite + React + Tailwind setup with routing"
```

---

### Task 3: Layout and Shared Components

**Files:**
- Create: `packages/dashboard/src/app/Layout.tsx`
- Create: `packages/dashboard/src/app/components/StatCard.tsx`
- Create: `packages/dashboard/src/app/components/DataTable.tsx`

- [ ] **Step 1: Create Layout**

```tsx
import { NavLink, Outlet } from "react-router-dom";

const navItems = [
  { to: "/overview", label: "Overview" },
  { to: "/keywords", label: "Keywords" },
  { to: "/rank-tracker", label: "Rank Tracker" },
  { to: "/audit", label: "Audit" },
  { to: "/competitors", label: "Competitors" },
  { to: "/backlinks", label: "Backlinks" },
  { to: "/strategy", label: "Strategy" },
];

export function Layout() {
  return (
    <div className="flex h-screen">
      <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <h1 className="text-lg font-bold text-white">SEOAgent</h1>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `block px-3 py-2 rounded text-sm ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "text-gray-400 hover:text-white hover:bg-gray-800"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Create StatCard component**

```tsx
interface StatCardProps {
  label: string;
  value: string | number | null;
  change?: string;
}

export function StatCard({ label, value, change }: StatCardProps) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <p className="text-sm text-gray-400">{label}</p>
      <p className="text-2xl font-bold text-white mt-1">
        {value ?? "—"}
      </p>
      {change && (
        <p className={`text-sm mt-1 ${change.startsWith("+") ? "text-green-400" : change.startsWith("-") ? "text-red-400" : "text-gray-400"}`}>
          {change}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create DataTable component**

```tsx
import { useState, useMemo } from "react";

interface Column<T> {
  key: keyof T;
  label: string;
  sortable?: boolean;
  render?: (value: T[keyof T], row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  defaultSort?: keyof T;
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  defaultSort,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<keyof T | undefined>(defaultSort);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filter, setFilter] = useState("");

  const sorted = useMemo(() => {
    let result = [...data];
    if (filter) {
      const lower = filter.toLowerCase();
      result = result.filter((row) =>
        Object.values(row).some((v) =>
          String(v).toLowerCase().includes(lower)
        )
      );
    }
    if (sortKey) {
      result.sort((a, b) => {
        const av = a[sortKey];
        const bv = b[sortKey];
        if (av === bv) return 0;
        const cmp = av !== null && av !== undefined && bv !== null && bv !== undefined && av > bv ? 1 : -1;
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return result;
  }, [data, sortKey, sortDir, filter]);

  function handleSort(key: keyof T) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  return (
    <div>
      <input
        type="text"
        placeholder="Filter..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="mb-4 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-white placeholder-gray-500 w-64"
      />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  className={`px-3 py-2 text-left text-gray-400 font-medium ${col.sortable ? "cursor-pointer hover:text-white" : ""}`}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  {col.label}
                  {sortKey === col.key && (sortDir === "asc" ? " ↑" : " ↓")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                {columns.map((col) => (
                  <td key={String(col.key)} className="px-3 py-2 text-gray-300">
                    {col.render ? col.render(row[col.key], row) : String(row[col.key] ?? "—")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/dashboard/src/app/
git commit -m "feat(dashboard): add layout, StatCard, and DataTable components"
```

---

### Task 4: Overview Page

**Files:**
- Create: `packages/dashboard/src/app/pages/Overview.tsx`

- [ ] **Step 1: Write the Overview page**

```tsx
import { useEffect, useState } from "react";
import { StatCard } from "../components/StatCard.js";

interface OverviewData {
  trackedKeywords: number;
  domainRating: number | null;
  crawledPages: number;
  pagesWithIssues: number;
}

export function Overview() {
  const [data, setData] = useState<OverviewData | null>(null);

  useEffect(() => {
    fetch("/api/overview")
      .then((r) => r.json())
      .then(setData);
  }, []);

  if (!data) return <p className="text-gray-400">Loading...</p>;

  return (
    <div>
      <h2 className="text-xl font-bold mb-6">Overview</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Domain Rating" value={data.domainRating} />
        <StatCard label="Tracked Keywords" value={data.trackedKeywords} />
        <StatCard label="Crawled Pages" value={data.crawledPages} />
        <StatCard label="Pages with Issues" value={data.pagesWithIssues} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/dashboard/src/app/pages/Overview.tsx
git commit -m "feat(dashboard): add Overview page"
```

---

### Task 5: Keywords Page

**Files:**
- Create: `packages/dashboard/src/app/pages/Keywords.tsx`

- [ ] **Step 1: Write the Keywords page**

```tsx
import { useEffect, useState } from "react";
import { DataTable } from "../components/DataTable.js";

interface Keyword {
  keyword: string;
  volume: number;
  difficulty: number;
  position: number | null;
  tracked: number;
}

export function Keywords() {
  const [data, setData] = useState<Keyword[]>([]);

  useEffect(() => {
    fetch("/api/keywords").then((r) => r.json()).then(setData);
  }, []);

  return (
    <div>
      <h2 className="text-xl font-bold mb-6">Keywords</h2>
      <DataTable
        columns={[
          { key: "keyword", label: "Keyword", sortable: true },
          { key: "volume", label: "Volume", sortable: true },
          { key: "difficulty", label: "Difficulty", sortable: true,
            render: (v) => {
              const d = v as number;
              const color = d > 70 ? "text-red-400" : d > 40 ? "text-yellow-400" : "text-green-400";
              return <span className={color}>{d}</span>;
            }
          },
          { key: "position", label: "Position", sortable: true },
          { key: "tracked", label: "Tracked", sortable: false,
            render: (v) => (v as number) === 1 ? "Yes" : "No"
          },
        ]}
        data={data}
        defaultSort="volume"
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/dashboard/src/app/pages/Keywords.tsx
git commit -m "feat(dashboard): add Keywords page with sortable table"
```

---

### Task 6: Rank Tracker Page

**Files:**
- Create: `packages/dashboard/src/app/pages/RankTracker.tsx`

- [ ] **Step 1: Write the Rank Tracker page**

```tsx
import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface TrackedKeyword {
  keyword: string;
  position: number | null;
}

interface RankEntry {
  position: number;
  checkedAt: string;
}

export function RankTracker() {
  const [keywords, setKeywords] = useState<TrackedKeyword[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [history, setHistory] = useState<RankEntry[]>([]);

  useEffect(() => {
    fetch("/api/keywords?sort=keyword&order=ASC")
      .then((r) => r.json())
      .then((data: TrackedKeyword[]) => {
        const tracked = data.filter((k: { tracked?: number }) => k.tracked === 1);
        setKeywords(tracked);
        if (tracked.length > 0) setSelected(tracked[0].keyword);
      });
  }, []);

  useEffect(() => {
    if (!selected) return;
    fetch(`/api/rank-history?keyword=${encodeURIComponent(selected)}`)
      .then((r) => r.json())
      .then(setHistory);
  }, [selected]);

  return (
    <div>
      <h2 className="text-xl font-bold mb-6">Rank Tracker</h2>
      <div className="flex gap-4 mb-6 flex-wrap">
        {keywords.map((k) => (
          <button
            key={k.keyword}
            onClick={() => setSelected(k.keyword)}
            className={`px-3 py-1 rounded text-sm ${
              selected === k.keyword
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            {k.keyword} {k.position !== null && `(#${k.position})`}
          </button>
        ))}
      </div>
      {history.length > 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4" style={{ height: 400 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="checkedAt" stroke="#9CA3AF" tick={{ fontSize: 12 }} />
              <YAxis reversed stroke="#9CA3AF" tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ backgroundColor: "#1F2937", border: "1px solid #374151" }} />
              <Line type="monotone" dataKey="position" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-gray-400">No rank history data yet. Run rank tracking first.</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/dashboard/src/app/pages/RankTracker.tsx
git commit -m "feat(dashboard): add Rank Tracker page with position chart"
```

---

### Task 7: Audit Page

**Files:**
- Create: `packages/dashboard/src/app/pages/Audit.tsx`

- [ ] **Step 1: Write the Audit page**

```tsx
import { useEffect, useState } from "react";

interface AuditData {
  pages: {
    url: string;
    status_code: number;
    title: string;
    word_count: number;
    issues: string;
  }[];
  issuesByType: Record<string, number>;
  totalPages: number;
}

export function Audit() {
  const [data, setData] = useState<AuditData | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/audit").then((r) => r.json()).then(setData);
  }, []);

  if (!data) return <p className="text-gray-400">Loading...</p>;
  if (data.totalPages === 0) return <p className="text-gray-400">No crawl data. Run an audit first.</p>;

  const issueEntries = Object.entries(data.issuesByType).sort((a, b) => b[1] - a[1]);

  return (
    <div>
      <h2 className="text-xl font-bold mb-6">Site Audit</h2>
      <p className="text-gray-400 mb-4">{data.totalPages} pages crawled</p>

      {issueEntries.length > 0 && (
        <div className="mb-6 space-y-2">
          <h3 className="text-lg font-semibold">Issues by Type</h3>
          {issueEntries.map(([type, count]) => (
            <div key={type} className="flex items-center gap-3">
              <div className="w-48 text-sm text-gray-300">{type}</div>
              <div className="flex-1 bg-gray-800 rounded-full h-4">
                <div
                  className="bg-red-500 h-4 rounded-full"
                  style={{ width: `${Math.min(100, (count / data.totalPages) * 100)}%` }}
                />
              </div>
              <span className="text-sm text-gray-400 w-8">{count}</span>
            </div>
          ))}
        </div>
      )}

      <h3 className="text-lg font-semibold mb-2">Pages</h3>
      <div className="space-y-1">
        {data.pages.map((page) => {
          const issues = JSON.parse(page.issues || "[]") as string[];
          return (
            <div key={page.url} className="bg-gray-900 border border-gray-800 rounded">
              <button
                className="w-full text-left px-4 py-2 flex items-center justify-between hover:bg-gray-800/50"
                onClick={() => setExpanded(expanded === page.url ? null : page.url)}
              >
                <span className="text-sm text-gray-300 truncate">{page.url}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${page.status_code === 200 ? "bg-green-900 text-green-300" : "bg-red-900 text-red-300"}`}>
                  {page.status_code}
                </span>
              </button>
              {expanded === page.url && (
                <div className="px-4 py-2 border-t border-gray-800 text-sm space-y-1">
                  <p><span className="text-gray-500">Title:</span> {page.title || "—"}</p>
                  <p><span className="text-gray-500">Words:</span> {page.word_count}</p>
                  {issues.length > 0 && (
                    <div>
                      <span className="text-gray-500">Issues:</span>
                      <ul className="list-disc list-inside text-red-400 mt-1">
                        {issues.map((issue, i) => <li key={i}>{issue}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/dashboard/src/app/pages/Audit.tsx
git commit -m "feat(dashboard): add Audit page with issue breakdown"
```

---

### Task 8: Competitors Page

**Files:**
- Create: `packages/dashboard/src/app/pages/Competitors.tsx`

- [ ] **Step 1: Write the Competitors page**

```tsx
import { useEffect, useState } from "react";
import { DataTable } from "../components/DataTable.js";

interface CompData {
  keywords: {
    keyword: string;
    volume: number;
    difficulty: number;
    current_position: number | null;
  }[];
}

export function Competitors() {
  const [data, setData] = useState<CompData | null>(null);

  useEffect(() => {
    fetch("/api/competitors").then((r) => r.json()).then(setData);
  }, []);

  if (!data) return <p className="text-gray-400">Loading...</p>;

  return (
    <div>
      <h2 className="text-xl font-bold mb-6">Competitors</h2>
      <p className="text-gray-400 mb-4">Keyword landscape — run competitor analysis via CLI/MCP to populate this data.</p>
      <DataTable
        columns={[
          { key: "keyword", label: "Keyword", sortable: true },
          { key: "volume", label: "Volume", sortable: true },
          { key: "difficulty", label: "Difficulty", sortable: true },
          { key: "current_position", label: "Your Position", sortable: true },
        ]}
        data={data.keywords}
        defaultSort="volume"
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/dashboard/src/app/pages/Competitors.tsx
git commit -m "feat(dashboard): add Competitors page"
```

---

### Task 9: Backlinks Page

**Files:**
- Create: `packages/dashboard/src/app/pages/Backlinks.tsx`

- [ ] **Step 1: Write the Backlinks page**

```tsx
import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { DataTable } from "../components/DataTable.js";

interface BacklinkData {
  backlinks: {
    source_domain: string;
    source_url: string;
    anchor_text: string;
    is_dofollow: number;
    domain_rating: number;
  }[];
  total: number;
}

interface DREntry {
  domainRating: number;
  referringDomains: number;
  checkedAt: string;
}

export function Backlinks() {
  const [data, setData] = useState<BacklinkData | null>(null);
  const [drHistory, setDrHistory] = useState<DREntry[]>([]);

  useEffect(() => {
    fetch("/api/backlinks").then((r) => r.json()).then(setData);
    fetch("/api/dr-history").then((r) => r.json()).then(setDrHistory);
  }, []);

  if (!data) return <p className="text-gray-400">Loading...</p>;

  return (
    <div>
      <h2 className="text-xl font-bold mb-6">Backlinks</h2>
      <p className="text-gray-400 mb-4">{data.total} total backlinks</p>

      {drHistory.length > 1 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-6" style={{ height: 300 }}>
          <h3 className="text-sm font-semibold text-gray-400 mb-2">Domain Rating History</h3>
          <ResponsiveContainer width="100%" height="85%">
            <LineChart data={drHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="checkedAt" stroke="#9CA3AF" tick={{ fontSize: 12 }} />
              <YAxis stroke="#9CA3AF" tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ backgroundColor: "#1F2937", border: "1px solid #374151" }} />
              <Line type="monotone" dataKey="domainRating" stroke="#10B981" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <h3 className="text-lg font-semibold mb-2">Referring Domains</h3>
      <DataTable
        columns={[
          { key: "source_domain", label: "Domain", sortable: true },
          { key: "anchor_text", label: "Anchor", sortable: true },
          { key: "domain_rating", label: "DR", sortable: true },
          { key: "is_dofollow", label: "Type", sortable: true,
            render: (v) => (v as number) === 1 ? <span className="text-green-400">dofollow</span> : <span className="text-gray-500">nofollow</span>
          },
        ]}
        data={data.backlinks}
        defaultSort="domain_rating"
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/dashboard/src/app/pages/Backlinks.tsx
git commit -m "feat(dashboard): add Backlinks page with DR chart"
```

---

### Task 10: Strategy Page

**Files:**
- Create: `packages/dashboard/src/app/pages/Strategy.tsx`

- [ ] **Step 1: Write the Strategy page**

```tsx
import { useEffect, useState } from "react";

interface ActionItem {
  action: string;
  reason: string;
  impact: string;
  effort: string;
}

interface StrategyData {
  strategy: {
    overallScore: number;
    quickWins: ActionItem[];
    contentPlan: { title: string; reason: string }[];
    technicalFixes: { issue: string; fix: string; severity: string }[];
    linkBuilding: { tactic: string; reason: string }[];
    drPlan: { currentDR: number; targetDR: number; actions: string[] };
    competitorInsights: string[];
  };
  generatedAt: string;
}

export function Strategy() {
  const [data, setData] = useState<StrategyData | null | undefined>(undefined);

  useEffect(() => {
    fetch("/api/strategy").then((r) => r.json()).then((d) => setData(d));
  }, []);

  if (data === undefined) return <p className="text-gray-400">Loading...</p>;
  if (data === null) return <p className="text-gray-400">No strategy generated yet. Run `seoagent strategy generate` first.</p>;

  const s = data.strategy;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Strategy</h2>
        <span className="text-sm text-gray-400">Generated: {new Date(data.generatedAt).toLocaleDateString()}</span>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <p className="text-sm text-gray-400">Overall SEO Health</p>
        <p className="text-4xl font-bold mt-1">{s.overallScore}<span className="text-lg text-gray-500">/100</span></p>
      </div>

      {s.quickWins?.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold mb-2">Quick Wins</h3>
          <div className="space-y-2">
            {s.quickWins.map((item, i) => (
              <div key={i} className="bg-gray-900 border border-gray-800 rounded p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs px-2 py-0.5 rounded ${item.impact === "high" ? "bg-green-900 text-green-300" : item.impact === "medium" ? "bg-yellow-900 text-yellow-300" : "bg-gray-700 text-gray-300"}`}>
                    {item.impact} impact
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded ${item.effort === "low" ? "bg-green-900 text-green-300" : item.effort === "medium" ? "bg-yellow-900 text-yellow-300" : "bg-red-900 text-red-300"}`}>
                    {item.effort} effort
                  </span>
                </div>
                <p className="text-sm text-white">{item.action}</p>
                <p className="text-sm text-gray-400 mt-1">{item.reason}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {s.technicalFixes?.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold mb-2">Technical Fixes</h3>
          <div className="space-y-1">
            {s.technicalFixes.map((fix, i) => (
              <div key={i} className="bg-gray-900 border border-gray-800 rounded p-3">
                <p className="text-sm text-white">{fix.issue}</p>
                <p className="text-sm text-gray-400">{fix.fix}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {s.competitorInsights?.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold mb-2">Competitor Insights</h3>
          <ul className="list-disc list-inside text-sm text-gray-300 space-y-1">
            {s.competitorInsights.map((insight, i) => <li key={i}>{insight}</li>)}
          </ul>
        </section>
      )}

      {s.drPlan && (
        <section>
          <h3 className="text-lg font-semibold mb-2">DR Growth Plan</h3>
          <p className="text-sm text-gray-400 mb-2">
            Current: {s.drPlan.currentDR} → Target: {s.drPlan.targetDR}
          </p>
          <ul className="list-disc list-inside text-sm text-gray-300 space-y-1">
            {s.drPlan.actions.map((action, i) => <li key={i}>{action}</li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/dashboard/src/app/pages/Strategy.tsx
git commit -m "feat(dashboard): add Strategy page with checklist display"
```

---

### Task 11: Vitest Config & Final Verification

**Files:**
- Create: `packages/dashboard/vitest.config.ts`

- [ ] **Step 1: Create vitest config**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
  },
});
```

- [ ] **Step 2: Install all dependencies**

Run: `cd /Users/yago/Documents/seoagent && pnpm install`

- [ ] **Step 3: Run dashboard tests**

Run: `cd packages/dashboard && pnpm test`
Expected: API route tests pass

- [ ] **Step 4: Build dashboard frontend**

Run: `cd packages/dashboard && pnpm build`
Expected: Vite builds to `dist/client/`, tsc builds server to `dist/server/`

- [ ] **Step 5: Commit**

```bash
git add packages/dashboard/
git commit -m "chore(dashboard): finalize dashboard with all pages and API"
```
