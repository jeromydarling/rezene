-- Migration number: 0027        2026-07-08
-- Storefront customer accounts: passwordless (magic-link) sign-in, saved
-- addresses, and a wishlist. Guest checkout stays the default; an account is
-- an optional, inviting extra that unlocks order history, tracking, reorder,
-- and saved details. Customers and orders already live per-shop, so this is
-- embedded into every shop DB.

-- One-time login links, emailed to the customer. Stored hashed; single use.
CREATE TABLE IF NOT EXISTS customer_login_tokens (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL,
  token_hash  TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  consumed_at TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_customer_login_tokens_email ON customer_login_tokens(email);

-- Opaque session tokens (hashed), same shape as the admin `sessions` table.
CREATE TABLE IF NOT EXISTS customer_sessions (
  id          TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_customer_sessions_customer ON customer_sessions(customer_id);

-- Saved shipping/contact addresses.
CREATE TABLE IF NOT EXISTS customer_addresses (
  id          TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  name        TEXT,
  line1       TEXT,
  line2       TEXT,
  city        TEXT,
  region      TEXT,
  postal_code TEXT,
  country     TEXT,
  phone       TEXT,
  is_default  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_customer_addresses_customer ON customer_addresses(customer_id);

-- Wishlist / saved pieces.
CREATE TABLE IF NOT EXISTS wishlist_items (
  id          TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  product_id  TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(customer_id, product_id)
);
