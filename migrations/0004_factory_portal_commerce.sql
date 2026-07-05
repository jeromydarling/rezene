-- Migration number: 0004        2026-07-05
-- Factory share portal, pre-order campaigns, shoppable lookbooks,
-- per-item pre-order flags, and wholesale line sheets.

-- ---------- Factory share portal ----------
-- Tokenized, read-only tech pack links for factories: always render the
-- CURRENT version (killing spec-version drift), accept comments and a
-- spec approval without an account. Tokens are stored hashed.
CREATE TABLE tech_pack_shares (
  id TEXT PRIMARY KEY,
  tech_pack_id TEXT NOT NULL REFERENCES tech_packs(id) ON DELETE CASCADE,
  supplier_id TEXT REFERENCES suppliers(id) ON DELETE SET NULL,
  label TEXT,                      -- 'Atelier Coupe Cousu — proto round'
  token_hash TEXT NOT NULL UNIQUE,
  language TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en','fr')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  approved_at TEXT,
  approved_by_name TEXT,
  approval_note TEXT,
  last_viewed_at TEXT,
  view_count INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_tpshares_pack ON tech_pack_shares(tech_pack_id);

-- Factory comments arrive through a share; internal comments keep working.
ALTER TABLE tech_pack_comments ADD COLUMN share_id TEXT;
ALTER TABLE tech_pack_comments ADD COLUMN author_kind TEXT NOT NULL DEFAULT 'internal';

-- ---------- Pre-order campaigns ----------
-- The campaign layer over the existing pre-order flag: a goal (typically the
-- factory MOQ), an optional hard cap (oversell guardrail), and a cutoff date.
CREATE TABLE preorder_campaigns (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL UNIQUE REFERENCES products(id) ON DELETE CASCADE,
  goal_units INTEGER NOT NULL,
  max_units INTEGER,               -- NULL = uncapped
  cutoff_date TEXT,                -- checkout closes after this date
  supplier_id TEXT REFERENCES suppliers(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'live'
    CHECK (status IN ('draft','live','funded','ended','cancelled')),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Per-item pre-order flag so mixed carts settle inventory correctly.
ALTER TABLE order_items ADD COLUMN is_pre_order INTEGER NOT NULL DEFAULT 0;

-- ---------- Shoppable lookbooks ----------
ALTER TABLE lookbook_images ADD COLUMN product_id TEXT REFERENCES products(id) ON DELETE SET NULL;

-- ---------- Wholesale line sheets ----------
CREATE TABLE line_sheets (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  season TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',
  note TEXT,                       -- terms, lead times, shown on the sheet
  token_hash TEXT UNIQUE,          -- share link token (hashed); NULL = not shared
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE line_sheet_items (
  id TEXT PRIMARY KEY,
  line_sheet_id TEXT NOT NULL REFERENCES line_sheets(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  wholesale_price_cents INTEGER NOT NULL,
  min_qty INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (line_sheet_id, product_id)
);
