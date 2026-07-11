-- Timeless Library cache — PLATFORM-ONLY (excluded from the per-shop DO
-- embed). The library builds itself as it is used: the first shop to search
-- "1924 cloche" pays the source-API round trips; every later search, from
-- any shop, reads this cache. Rows are denormalized JSON snapshots keyed by
-- the exact query, refreshed when stale (TTL enforced in code, not schema).

CREATE TABLE IF NOT EXISTS library_cache_searches (
  key TEXT PRIMARY KEY,              -- 'v1|<room>|<source>|<query or listing key>'
  results TEXT NOT NULL,             -- JSON array of LibraryItem
  cached_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS library_cache_issues (
  ia_id TEXT PRIMARY KEY,            -- Internet Archive identifier of a scanned issue/book
  title TEXT,
  date_text TEXT,
  leaf_count INTEGER,                -- pages in the scan; the reader's bounds
  cached_at TEXT NOT NULL DEFAULT (datetime('now'))
);
