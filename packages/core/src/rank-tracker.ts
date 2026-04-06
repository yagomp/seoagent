import type Database from "better-sqlite3";
import type { SearchDataProvider, SerpResult } from "./types.js";
import { getCachedSerp, setCachedSerp, isCacheFresh } from "./serp-cache.js";

export interface RankCheckResult {
  keyword: string;
  position: number | null;
  url: string | null;
}

export interface PositionHistoryEntry {
  position: number | null;
  url: string | null;
  checkedAt: string;
}

export interface RankMover {
  keyword: string;
  previousPosition: number | null;
  currentPosition: number | null;
  change: number;
}

export interface RankReport {
  up: RankMover[];
  down: RankMover[];
  new: RankMover[];
  lost: RankMover[];
}

export function rankTrackAdd(
  db: Database.Database,
  keywords: string[],
  locale: string
): void {
  const upsert = db.prepare(`
    INSERT INTO keywords (keyword, locale, tracked)
    VALUES (?, ?, 1)
    ON CONFLICT(keyword, locale) DO UPDATE SET
      tracked = 1,
      updated_at = datetime('now')
  `);

  const insertMany = db.transaction((items: string[]) => {
    for (const keyword of items) {
      upsert.run(keyword, locale);
    }
  });

  insertMany(keywords);
}

export async function rankTrackCheck(
  db: Database.Database,
  provider: SearchDataProvider,
  domain: string,
  locale: string
): Promise<RankCheckResult[]> {
  const tracked = db
    .prepare(
      "SELECT id, keyword FROM keywords WHERE tracked = 1 AND locale = ?"
    )
    .all(locale) as { id: number; keyword: string }[];

  const results: RankCheckResult[] = [];

  const insertHistory = db.prepare(`
    INSERT INTO rank_history (keyword_id, position, url)
    VALUES (?, ?, ?)
  `);

  const updatePosition = db.prepare(`
    UPDATE keywords SET current_position = ?, updated_at = datetime('now')
    WHERE id = ?
  `);

  for (const { id, keyword } of tracked) {
    const serp = await getSerpWithCache(db, provider, keyword, locale);

    // Find domain in SERP results
    const match = serp.find((r) =>
      r.domain === domain || r.domain.endsWith(`.${domain}`)
    );

    const position = match?.position ?? null;
    const url = match?.url ?? null;

    insertHistory.run(id, position, url);
    updatePosition.run(position, id);

    results.push({ keyword, position, url });
  }

  return results;
}

export function rankTrackHistory(
  db: Database.Database,
  keyword: string,
  locale: string
): PositionHistoryEntry[] {
  const keywordRow = db
    .prepare("SELECT id FROM keywords WHERE keyword = ? AND locale = ?")
    .get(keyword, locale) as { id: number } | undefined;

  if (!keywordRow) return [];

  const rows = db
    .prepare(
      `SELECT position, url, checked_at
       FROM rank_history
       WHERE keyword_id = ?
       ORDER BY checked_at ASC`
    )
    .all(keywordRow.id) as {
    position: number | null;
    url: string | null;
    checked_at: string;
  }[];

  return rows.map((r) => ({
    position: r.position,
    url: r.url,
    checkedAt: r.checked_at,
  }));
}

export function rankTrackReport(
  db: Database.Database,
  locale: string
): RankReport {
  // Get all tracked keywords with at least one history entry
  const tracked = db
    .prepare(
      `SELECT k.id, k.keyword
       FROM keywords k
       WHERE k.tracked = 1 AND k.locale = ?`
    )
    .all(locale) as { id: number; keyword: string }[];

  const report: RankReport = {
    up: [],
    down: [],
    new: [],
    lost: [],
  };

  for (const { id, keyword } of tracked) {
    // Get the two most recent history entries
    const entries = db
      .prepare(
        `SELECT position, url, checked_at
         FROM rank_history
         WHERE keyword_id = ?
         ORDER BY checked_at DESC
         LIMIT 2`
      )
      .all(id) as {
      position: number | null;
      url: string | null;
      checked_at: string;
    }[];

    if (entries.length < 2) continue;

    const current = entries[0].position;
    const previous = entries[1].position;

    if (previous === null && current !== null) {
      // New entry -- was not ranking, now ranking
      report.new.push({
        keyword,
        previousPosition: null,
        currentPosition: current,
        change: 0,
      });
    } else if (previous !== null && current === null) {
      // Lost -- was ranking, now not
      report.lost.push({
        keyword,
        previousPosition: previous,
        currentPosition: null,
        change: 0,
      });
    } else if (previous !== null && current !== null) {
      const change = previous - current; // positive = improved

      if (change > 0) {
        report.up.push({
          keyword,
          previousPosition: previous,
          currentPosition: current,
          change,
        });
      } else if (change < 0) {
        report.down.push({
          keyword,
          previousPosition: previous,
          currentPosition: current,
          change,
        });
      }
      // If change === 0, no movement -- skip
    }
  }

  // Sort: biggest movers first
  report.up.sort((a, b) => b.change - a.change);
  report.down.sort((a, b) => a.change - b.change);

  return report;
}

async function getSerpWithCache(
  db: Database.Database,
  provider: SearchDataProvider,
  keyword: string,
  locale: string
): Promise<SerpResult[]> {
  const cached = getCachedSerp(db, keyword, locale);

  if (cached && isCacheFresh(cached.fetchedAt, 24)) {
    return cached.results;
  }

  const results = await provider.getSerpResults(keyword, locale);
  setCachedSerp(db, keyword, locale, results);
  return results;
}
