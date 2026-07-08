-- Migration number: 0032        2026-07-08
-- Wholesale / B2B buyer portal. Line sheets were view + inquiry only; this turns
-- them into a real ordering channel: a buyer applies, the shop approves and sets
-- their terms, the buyer signs in (passwordless) and places orders at their own
-- pricing, and the shop manages those orders with net terms. Per-shop.

CREATE TABLE IF NOT EXISTS wholesale_accounts (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  company       TEXT,
  contact_name  TEXT,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  discount_pct  REAL NOT NULL DEFAULT 0,     -- extra off the line-sheet wholesale price
  terms_days    INTEGER NOT NULL DEFAULT 0,  -- net payment terms (0 = due on receipt)
  note          TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  approved_at   TEXT
);

CREATE TABLE IF NOT EXISTS wholesale_login_tokens (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL,
  token_hash  TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  consumed_at TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS wholesale_sessions (
  id         TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES wholesale_accounts(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS wholesale_orders (
  id            TEXT PRIMARY KEY,
  account_id    TEXT NOT NULL REFERENCES wholesale_accounts(id) ON DELETE CASCADE,
  line_sheet_id TEXT REFERENCES line_sheets(id) ON DELETE SET NULL,
  order_number  TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted','confirmed','invoiced','paid','cancelled')),
  currency      TEXT NOT NULL DEFAULT 'USD',
  total_cents   INTEGER NOT NULL DEFAULT 0,
  note          TEXT,
  due_date      TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_wholesale_orders_account ON wholesale_orders(account_id);

CREATE TABLE IF NOT EXISTS wholesale_order_items (
  id               TEXT PRIMARY KEY,
  order_id         TEXT NOT NULL REFERENCES wholesale_orders(id) ON DELETE CASCADE,
  product_id       TEXT REFERENCES products(id) ON DELETE SET NULL,
  description      TEXT NOT NULL,
  quantity         INTEGER NOT NULL,
  unit_price_cents INTEGER NOT NULL,
  currency         TEXT NOT NULL DEFAULT 'USD'
);
