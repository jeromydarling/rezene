-- Migration number: 0035        2026-07-08
-- Multi-location inventory. The existing single-row-per-variant inventory_items
-- becomes the DEFAULT location's stock (what the storefront fulfils from), and
-- extra locations (a shopfront, a second studio) track their own stock in
-- location_stock. Transfers move units between locations and are logged. Keeping
-- inventory_items as-is means checkout and restock logic are untouched. Per-shop.

CREATE TABLE IF NOT EXISTS locations (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  kind       TEXT NOT NULL DEFAULT 'studio' CHECK (kind IN ('studio','warehouse','shopfront')),
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Every shop starts with one default location; its stock lives in inventory_items.
INSERT OR IGNORE INTO locations (id, name, kind, is_default) VALUES ('loc_main', 'Main', 'studio', 1);

-- Stock held at NON-default locations (the default's stock stays in inventory_items).
CREATE TABLE IF NOT EXISTS location_stock (
  id          TEXT PRIMARY KEY,
  variant_id  TEXT NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  location_id TEXT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  on_hand     INTEGER NOT NULL DEFAULT 0,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (variant_id, location_id)
);
CREATE INDEX IF NOT EXISTS idx_location_stock_variant ON location_stock(variant_id);

CREATE TABLE IF NOT EXISTS stock_transfers (
  id               TEXT PRIMARY KEY,
  variant_id       TEXT NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  from_location_id TEXT NOT NULL,
  to_location_id   TEXT NOT NULL,
  quantity         INTEGER NOT NULL,
  note             TEXT,
  created_by       TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
