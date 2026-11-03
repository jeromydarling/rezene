-- Migration number: 0065        2026-11-03
-- Wholesale 2.0: closes the four gaps in the B2B channel.
--  1. Payment collection: wholesale orders carry Stripe checkout/PI ids and a
--     paid_at stamp, so invoices can be paid online (Connect-aware).
--  2. Real per-buyer pricing: quantity-break tiers on line-sheet items (JSON)
--     plus absolute per-buyer price overrides (a custom price list).
--  3. Fulfilment: a confirmed wholesale order materialises a linked order in
--     the retail pipeline (fulfillment_order_id) so shipping labels, tracking
--     and shipped/delivered emails all work; buyers supply a ship-to address.
-- Per-shop (applies to shop DOs and platform D1 alike).

ALTER TABLE wholesale_orders ADD COLUMN stripe_checkout_session_id TEXT;
ALTER TABLE wholesale_orders ADD COLUMN stripe_payment_intent_id TEXT;
ALTER TABLE wholesale_orders ADD COLUMN paid_at TEXT;
ALTER TABLE wholesale_orders ADD COLUMN fulfillment_order_id TEXT;
ALTER TABLE wholesale_orders ADD COLUMN shipping_address_json TEXT;
ALTER TABLE wholesale_orders ADD COLUMN shipping_country TEXT;

-- Quantity-break pricing per line-sheet item: JSON array of
-- {"minQty": 12, "priceCents": 4000}, ascending by minQty. NULL = no tiers.
ALTER TABLE line_sheet_items ADD COLUMN price_tiers TEXT;

-- A buyer's custom price list: an absolute unit price per product that
-- replaces the line-sheet price, tiers, and trade discount for that buyer.
CREATE TABLE IF NOT EXISTS wholesale_price_overrides (
  id               TEXT PRIMARY KEY,
  account_id       TEXT NOT NULL REFERENCES wholesale_accounts(id) ON DELETE CASCADE,
  product_id       TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  unit_price_cents INTEGER NOT NULL,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (account_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_wholesale_overrides_account ON wholesale_price_overrides(account_id);
