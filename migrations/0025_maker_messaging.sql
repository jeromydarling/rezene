-- Migration number: 0025        2026-07-08
-- Maker Messages — a logged, email-driven conversation between a shop and each
-- supplier/maker. Applied to both the platform D1 and every per-shop DO (the
-- routing map is used from the platform DB; the threads/messages live per-shop).

-- Platform routing map: reply-address token → which shop + supplier a maker's
-- emailed reply belongs to. Queried from env.DB by the inbound email() handler.
CREATE TABLE IF NOT EXISTS thread_addresses (
  token       TEXT PRIMARY KEY,
  shop_id     TEXT NOT NULL,
  supplier_id TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Per-shop: one conversation thread per supplier (the maker relationship).
CREATE TABLE IF NOT EXISTS supplier_threads (
  id              TEXT PRIMARY KEY,
  supplier_id     TEXT NOT NULL UNIQUE,
  token           TEXT NOT NULL UNIQUE,
  subject         TEXT,
  last_message_at TEXT,
  unread          INTEGER NOT NULL DEFAULT 0,   -- messages from the maker not yet read
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS supplier_messages (
  id          TEXT PRIMARY KEY,
  thread_id   TEXT NOT NULL,
  supplier_id TEXT NOT NULL,
  author_kind TEXT NOT NULL CHECK (author_kind IN ('shop','supplier')),
  author_name TEXT,
  body        TEXT NOT NULL,
  via         TEXT NOT NULL DEFAULT 'app' CHECK (via IN ('app','email','portal')),
  context     TEXT,                              -- optional tag, e.g. "Sample MA-001"
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_supplier_messages_thread ON supplier_messages(thread_id, created_at);
