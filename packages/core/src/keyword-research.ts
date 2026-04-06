import type Database from "better-sqlite3";
import type { SearchDataProvider, KeywordData } from "./types.js";

export async function keywordResearch(
  db: Database.Database,
  provider: SearchDataProvider,
  keywords: string[],
  locale: string
): Promise<KeywordData[]> {
  const results = await provider.getKeywordVolume(keywords, locale);

  const upsert = db.prepare(`
    INSERT INTO keywords (keyword, locale, volume, difficulty, cpc)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(keyword, locale) DO UPDATE SET
      volume = excluded.volume,
      difficulty = excluded.difficulty,
      cpc = excluded.cpc,
      updated_at = datetime('now')
  `);

  const upsertMany = db.transaction((items: KeywordData[]) => {
    for (const item of items) {
      upsert.run(
        item.keyword,
        locale,
        item.volume,
        item.difficulty,
        item.cpc ?? 0
      );
    }
  });

  upsertMany(results);

  return results;
}

export async function keywordSuggestions(
  db: Database.Database,
  provider: SearchDataProvider,
  seed: string,
  locale: string,
  limit?: number
): Promise<string[]> {
  let suggestions = await provider.getKeywordSuggestions(seed, locale);

  if (limit !== undefined) {
    suggestions = suggestions.slice(0, limit);
  }

  // Store suggestions in the keywords table (volume unknown at this point)
  const upsert = db.prepare(`
    INSERT INTO keywords (keyword, locale)
    VALUES (?, ?)
    ON CONFLICT(keyword, locale) DO NOTHING
  `);

  const insertMany = db.transaction((items: string[]) => {
    for (const keyword of items) {
      upsert.run(keyword, locale);
    }
  });

  insertMany(suggestions);

  return suggestions;
}
