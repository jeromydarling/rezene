-- Migration number: 0029        2026-07-08
-- Back-in-stock waitlist. When a piece sells out, a shopper can leave their
-- email; the moment stock is replenished we email everyone waiting. Products
-- are per-shop, so this is embedded into every shop DB.

CREATE TABLE IF NOT EXISTS restock_subscriptions (
  id          TEXT PRIMARY KEY,
  product_id  TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id  TEXT REFERENCES product_variants(id) ON DELETE CASCADE, -- null = any size
  email       TEXT NOT NULL,
  notified_at TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_restock_subs_product ON restock_subscriptions(product_id, notified_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_restock_subs_unique
  ON restock_subscriptions(product_id, email) WHERE variant_id IS NULL;
