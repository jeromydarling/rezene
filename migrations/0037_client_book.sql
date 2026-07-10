-- Migration number: 0037        2026-07-10
-- The Client Book: a per-shop record of the PEOPLE a designer, stylist or
-- tailor works with — the unit the made-to-measure workflow was missing.
-- Until now a "client" was a free-text name inside fitting_looks.fit_json
-- and fitting_models.label; this gives them a real entity with measurement
-- HISTORY (bodies change — a tailor needs "measured last autumn" vs "measured
-- this week"), style notes, and a timeline of fittings and conversations.
-- Mirrors the proven HQ CRM triad (contact + interactions), but per shop:
-- this migration is EMBEDDED into every shop DO (not in the exclusion list).
-- Every statement leaves the database consistent on its own: the per-shop DO
-- migration runner executes statements one at a time with no transaction.

CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  -- Optional link to a storefront shopper account. A walk-in MTM client may
  -- never shop online, and a shopper may never be measured — so this is a
  -- reference, not a merge.
  customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  -- Plain-language style preferences: colours they love, fits they hate,
  -- brands whose sizes run true for them, occasions coming up.
  style_notes TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);

-- Dated measurement sets — an append-only history, never overwritten.
-- measurements_json holds the Pattern Studio's cm-keyed measurement map
-- (the same keys the FreeSewing drafts consume), so a set can be loaded
-- straight into a made-to-measure draft.
CREATE TABLE IF NOT EXISTS client_measurements (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  taken_at TEXT NOT NULL DEFAULT (datetime('now')),
  measurements_json TEXT NOT NULL DEFAULT '{}',
  note TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_client_measurements_client
  ON client_measurements(client_id, taken_at);

-- The client's timeline: notes, consults, fittings, deliveries, occasions.
CREATE TABLE IF NOT EXISTS client_events (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'note'
    CHECK (kind IN ('note', 'consult', 'fitting', 'delivery', 'occasion')),
  subject TEXT,
  body_md TEXT,
  event_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_client_events_client
  ON client_events(client_id, event_at);

-- Saved patterns and uploaded model photos become children of a client.
ALTER TABLE fitting_looks ADD COLUMN client_id TEXT REFERENCES clients(id) ON DELETE SET NULL;

ALTER TABLE fitting_models ADD COLUMN client_id TEXT REFERENCES clients(id) ON DELETE SET NULL;
