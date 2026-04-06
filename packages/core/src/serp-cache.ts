import type Database from "better-sqlite3";
import type { SerpResult } from "./types.js";

export interface CachedSerp {
  results: SerpResult[];
  fetchedAt: string;
}

export function getCachedSerp(
  db: Database.Database,
  keyword: string,
  locale: string
): CachedSerp | null {
  const row = db
    .prepare(
      "SELECT results, fetched_at FROM serp_cache WHERE keyword = ? AND locale = ?"
    )
    .get(keyword, locale) as
    | { results: string; fetched_at: string }
    | undefined;

  if (!row) return null;

  return {
    results: JSON.parse(row.results) as SerpResult[],
    fetchedAt: row.fetched_at,
  };
}

export function setCachedSerp(
  db: Database.Database,
  keyword: string,
  locale: string,
  results: SerpResult[]
): void {
  db.prepare(
    `INSERT INTO serp_cache (keyword, locale, results, fetched_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(keyword, locale) DO UPDATE SET
       results = excluded.results,
       fetched_at = excluded.fetched_at`
  ).run(keyword, locale, JSON.stringify(results));
}

export function isCacheFresh(
  fetchedAt: string,
  maxAgeHours: number
): boolean {
  const fetchedTime = new Date(fetchedAt).getTime();
  const cutoff = Date.now() - maxAgeHours * 60 * 60 * 1000;
  return fetchedTime > cutoff;
}
