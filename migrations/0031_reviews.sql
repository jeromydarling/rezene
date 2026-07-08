-- Migration number: 0031        2026-07-08
-- Product reviews. Only verified buyers can leave one (checked at write time),
-- so reviews are trustworthy by construction. Published by default; the shop
-- can hide any review. Per-shop, embedded into every shop DB.

CREATE TABLE IF NOT EXISTS product_reviews (
  id          TEXT PRIMARY KEY,
  product_id  TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  order_id    TEXT REFERENCES orders(id) ON DELETE SET NULL,
  rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title       TEXT,
  body        TEXT,
  author_name TEXT,
  status      TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published','hidden')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON product_reviews(product_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_one_per_order_product
  ON product_reviews(order_id, product_id);
