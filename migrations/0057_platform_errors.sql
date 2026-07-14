-- Platform-only: an at-a-glance error/incident log for Verto HQ. The worker's
-- onError hook writes here best-effort on every 500, deduped by a signature
-- (method + normalized path + message class) so a recurring fault collapses to
-- one row with a count and last-seen, instead of a flood. Sentry still gets the
-- full stack trace; this is the "what's breaking, for whom, how often" glance
-- that lives where HQ already works. Excluded from the per-shop DO embed.
CREATE TABLE IF NOT EXISTS platform_errors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  signature TEXT NOT NULL UNIQUE,   -- dedup key: method + path template + message head
  shop_id TEXT,                     -- the tenant in context when it fired (best effort)
  method TEXT,
  path TEXT,                        -- normalized (ids → :id) so instances group
  status INTEGER NOT NULL DEFAULT 500,
  message TEXT,
  count INTEGER NOT NULL DEFAULT 1,
  first_seen TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT                  -- set when an operator marks it handled
);
CREATE INDEX idx_platform_errors_last ON platform_errors(last_seen);
CREATE INDEX idx_platform_errors_open ON platform_errors(resolved_at, last_seen);
