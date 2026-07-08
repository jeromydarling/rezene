-- Migration number: 0028        2026-07-08
-- Returns / RMA. A customer starts a return against a paid order (from their
-- account); the shop approves or declines, and an approval restocks the pieces
-- and refunds via Stripe. Orders/inventory are per-shop, so this is embedded
-- into every shop DB.

CREATE TABLE IF NOT EXISTS returns (
  id                  TEXT PRIMARY KEY,
  order_id            TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  customer_id         TEXT REFERENCES customers(id) ON DELETE SET NULL,
  status              TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested','approved','received','refunded','rejected','cancelled')),
  reason              TEXT,               -- headline reason (size, quality, changed_mind, faulty, other)
  customer_note       TEXT,
  admin_note          TEXT,
  refund_amount_cents INTEGER,
  currency            TEXT,
  stripe_refund_id    TEXT,
  restocked           INTEGER NOT NULL DEFAULT 0,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_returns_order ON returns(order_id);
CREATE INDEX IF NOT EXISTS idx_returns_status ON returns(status);

CREATE TABLE IF NOT EXISTS return_items (
  id               TEXT PRIMARY KEY,
  return_id        TEXT NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
  order_item_id    TEXT REFERENCES order_items(id) ON DELETE SET NULL,
  variant_id       TEXT REFERENCES product_variants(id) ON DELETE SET NULL,
  description      TEXT NOT NULL,
  quantity         INTEGER NOT NULL,
  unit_price_cents INTEGER,
  currency         TEXT
);
CREATE INDEX IF NOT EXISTS idx_return_items_return ON return_items(return_id);
