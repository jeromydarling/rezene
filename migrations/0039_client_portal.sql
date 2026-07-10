-- Migration number: 0039        2026-07-10
-- Client portal: a client with a portal link can see their commissions,
-- their fit renders and photos, and their latest measurements, and approve
-- a design — without an account or password. Same passwordless shape as
-- customer accounts and admin sessions (house rule: tokens stored hashed).
-- Embedded into every shop DO. Every statement leaves the database
-- consistent on its own (the DO runner executes one statement at a time).

CREATE TABLE IF NOT EXISTS client_portal_tokens (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS client_portal_sessions (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- A client's sign-off on the design, straight from the portal.
ALTER TABLE commissions ADD COLUMN client_approved_at TEXT;
