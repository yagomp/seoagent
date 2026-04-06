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
