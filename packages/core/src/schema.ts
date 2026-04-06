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
