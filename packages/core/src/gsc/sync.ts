import type Database from "better-sqlite3";

export interface GscSyncRow {
  date: string;
  query: string | null;
  page: string | null;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscHistoryFilter {
  query?: string;
  page?: string;
  startDate?: string;
  endDate?: string;
}

function ensureUniqueIndex(db: Database.Database): void {
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_gsc_data_unique
    ON gsc_data(date, COALESCE(query, ''), COALESCE(page, ''));
  `);
}

export function syncGscRows(
  db: Database.Database,
  rows: GscSyncRow[]
): void {
  ensureUniqueIndex(db);

  const upsert = db.prepare(`
    INSERT INTO gsc_data (date, query, page, clicks, impressions, ctr, position, synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT (date, COALESCE(query, ''), COALESCE(page, ''))
    DO UPDATE SET
      clicks = excluded.clicks,
      impressions = excluded.impressions,
      ctr = excluded.ctr,
      position = excluded.position,
      synced_at = datetime('now')
  `);

  const insertMany = db.transaction((items: GscSyncRow[]) => {
    for (const row of items) {
      upsert.run(
        row.date,
        row.query,
        row.page,
        row.clicks,
        row.impressions,
        row.ctr,
        row.position
      );
    }
  });

  insertMany(rows);
}

export function getGscHistory(
  db: Database.Database,
  filter: GscHistoryFilter = {}
): GscSyncRow[] {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filter.query !== undefined) {
    conditions.push("query = ?");
    params.push(filter.query);
  }

  if (filter.page !== undefined) {
    conditions.push("page = ?");
    params.push(filter.page);
  }

  if (filter.startDate !== undefined) {
    conditions.push("date >= ?");
    params.push(filter.startDate);
  }

  if (filter.endDate !== undefined) {
    conditions.push("date <= ?");
    params.push(filter.endDate);
  }

  const where =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const rows = db
    .prepare(
      `SELECT date, query, page, clicks, impressions, ctr, position
       FROM gsc_data ${where}
       ORDER BY date ASC`
    )
    .all(...params) as GscSyncRow[];

  return rows;
}
