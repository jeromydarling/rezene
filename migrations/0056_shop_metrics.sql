-- Platform-only: a daily per-shop commerce rollup so Verto HQ can read
-- fleet-wide revenue in ONE query. Orders/refunds/customers live in each
-- shop's isolated Durable Object; a nightly cron fans out, aggregates each
-- shop's day, and upserts a row here in the platform D1. Excluded from the
-- per-shop DO embed (scripts/embed-migrations.mjs).
CREATE TABLE IF NOT EXISTS shop_metrics_daily (
  shop_id TEXT NOT NULL,
  day TEXT NOT NULL,                      -- 'YYYY-MM-DD' (UTC)
  currency TEXT NOT NULL DEFAULT 'USD',   -- the shop's dominant order currency that day
  gmv_cents INTEGER NOT NULL DEFAULT 0,   -- sum of paid orders' total_cents
  orders INTEGER NOT NULL DEFAULT 0,      -- count of paid orders
  refunds_cents INTEGER NOT NULL DEFAULT 0,
  new_customers INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (shop_id, day)
);
CREATE INDEX idx_shop_metrics_day ON shop_metrics_daily(day);
CREATE INDEX idx_shop_metrics_shop ON shop_metrics_daily(shop_id);
