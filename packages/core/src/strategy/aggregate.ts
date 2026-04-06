import type Database from "better-sqlite3";
import type { AggregatedData } from "./types.js";

interface ProjectInfo {
  domain: string;
  name: string;
  niche?: string;
  competitors?: string[];
  locale?: string;
}

export function aggregateProjectData(
  db: Database.Database,
  project: ProjectInfo
): AggregatedData {
  return {
    project: {
      domain: project.domain,
      name: project.name,
      niche: project.niche,
      competitors: project.competitors,
      locale: project.locale,
    },
    keywords: aggregateKeywords(db),
    pages: aggregatePages(db),
    backlinks: aggregateBacklinks(db),
    domainRating: aggregateDomainRating(db),
    gsc: aggregateGsc(db),
  };
}

function aggregateKeywords(db: Database.Database): AggregatedData["keywords"] {
  const total = (
    db.prepare("SELECT COUNT(*) as count FROM keywords").get() as { count: number }
  ).count;

  const tracked = (
    db.prepare("SELECT COUNT(*) as count FROM keywords WHERE tracked = 1").get() as {
      count: number;
    }
  ).count;

  const avgRow = db
    .prepare(
      "SELECT AVG(current_position) as avg_pos FROM keywords WHERE current_position IS NOT NULL"
    )
    .get() as { avg_pos: number | null };

  const top10 = (
    db
      .prepare(
        "SELECT COUNT(*) as count FROM keywords WHERE current_position IS NOT NULL AND current_position <= 10"
      )
      .get() as { count: number }
  ).count;

  return {
    total,
    tracked,
    avgPosition: avgRow.avg_pos,
    top10Count: top10,
  };
}

function aggregatePages(db: Database.Database): AggregatedData["pages"] {
  const total = (
    db.prepare("SELECT COUNT(*) as count FROM crawl_pages").get() as { count: number }
  ).count;

  if (total === 0) {
    return {
      total: 0,
      missingTitle: 0,
      missingDescription: 0,
      missingH1: 0,
      thinContent: 0,
      avgWordCount: 0,
      brokenLinks: 0,
    };
  }

  const missingTitle = (
    db
      .prepare(
        "SELECT COUNT(*) as count FROM crawl_pages WHERE title IS NULL OR title = ''"
      )
      .get() as { count: number }
  ).count;

  const missingDescription = (
    db
      .prepare(
        "SELECT COUNT(*) as count FROM crawl_pages WHERE meta_description IS NULL OR meta_description = ''"
      )
      .get() as { count: number }
  ).count;

  const missingH1 = (
    db
      .prepare(
        "SELECT COUNT(*) as count FROM crawl_pages WHERE h1 IS NULL OR h1 = ''"
      )
      .get() as { count: number }
  ).count;

  const thinContent = (
    db
      .prepare(
        "SELECT COUNT(*) as count FROM crawl_pages WHERE word_count IS NOT NULL AND word_count < 300"
      )
      .get() as { count: number }
  ).count;

  const avgWc = (
    db
      .prepare("SELECT AVG(word_count) as avg_wc FROM crawl_pages WHERE word_count IS NOT NULL")
      .get() as { avg_wc: number | null }
  ).avg_wc;

  const brokenLinks = (
    db
      .prepare(
        "SELECT COUNT(*) as count FROM crawl_pages WHERE status_code >= 400"
      )
      .get() as { count: number }
  ).count;

  return {
    total,
    missingTitle,
    missingDescription,
    missingH1,
    thinContent,
    avgWordCount: avgWc ?? 0,
    brokenLinks,
  };
}

function aggregateBacklinks(db: Database.Database): AggregatedData["backlinks"] {
  const total = (
    db.prepare("SELECT COUNT(*) as count FROM backlinks").get() as { count: number }
  ).count;

  if (total === 0) {
    return { total: 0, uniqueDomains: 0, dofollowRatio: 0 };
  }

  const uniqueDomains = (
    db
      .prepare("SELECT COUNT(DISTINCT source_domain) as count FROM backlinks")
      .get() as { count: number }
  ).count;

  const dofollow = (
    db
      .prepare("SELECT COUNT(*) as count FROM backlinks WHERE is_dofollow = 1")
      .get() as { count: number }
  ).count;

  return {
    total,
    uniqueDomains,
    dofollowRatio: dofollow / total,
  };
}

function aggregateDomainRating(
  db: Database.Database
): AggregatedData["domainRating"] {
  const rows = db
    .prepare(
      "SELECT domain_rating FROM dr_history ORDER BY checked_at DESC LIMIT 2"
    )
    .all() as { domain_rating: number }[];

  if (rows.length === 0) {
    return { current: null, previous: null, trend: "unknown" };
  }

  const current = rows[0].domain_rating;
  const previous = rows.length > 1 ? rows[1].domain_rating : null;

  let trend: "up" | "down" | "stable" | "unknown" = "unknown";
  if (previous !== null) {
    if (current > previous) trend = "up";
    else if (current < previous) trend = "down";
    else trend = "stable";
  }

  return { current, previous, trend };
}

function aggregateGsc(db: Database.Database): AggregatedData["gsc"] {
  const row = db
    .prepare(
      `SELECT
        COALESCE(SUM(clicks), 0) as total_clicks,
        COALESCE(SUM(impressions), 0) as total_impressions,
        AVG(ctr) as avg_ctr,
        AVG(position) as avg_position
      FROM gsc_data`
    )
    .get() as {
    total_clicks: number;
    total_impressions: number;
    avg_ctr: number | null;
    avg_position: number | null;
  };

  return {
    totalClicks: row.total_clicks,
    totalImpressions: row.total_impressions,
    avgCtr: row.avg_ctr ?? 0,
    avgPosition: row.avg_position ?? 0,
  };
}
