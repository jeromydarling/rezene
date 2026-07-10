-- Migration number: 0038        2026-07-10
-- Commissions: the work a tailor or stylist does FOR a client, as a staged
-- pipeline — consult → design approved → fabric sourced → cutting →
-- fittings → delivery. An alteration is the same record with a shorter
-- staff of stages (enforced in the app; the CHECK holds the superset).
-- A commission links the client (owner, required) to the artefacts that
-- describe the garment: a saved pattern (fitting_looks) and/or a style
-- (whose tech pack is the factory spec). Fittings are recorded as client
-- timeline events carrying a commission_id, so the client's page tells the
-- whole story in one stream; photos attach via the files table with
-- entity_type 'commission'. Embedded into every shop DO. Every statement
-- leaves the database consistent on its own (the DO runner executes
-- statements one at a time with no transaction).

CREATE TABLE IF NOT EXISTS commissions (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'commission' CHECK (kind IN ('commission', 'alteration')),
  stage TEXT NOT NULL DEFAULT 'consult'
    CHECK (stage IN ('consult', 'design', 'fabric', 'cutting', 'fitting', 'delivery', 'done', 'cancelled')),
  look_id TEXT REFERENCES fitting_looks(id) ON DELETE SET NULL,
  style_id TEXT REFERENCES styles(id) ON DELETE SET NULL,
  brief_md TEXT,
  due_at TEXT,
  -- Quoted price in integer cents (house rule: money is integer cents).
  price_cents INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_commissions_client ON commissions(client_id, updated_at);

CREATE INDEX IF NOT EXISTS idx_commissions_stage ON commissions(stage);

-- Fittings and stage changes land on the client timeline, tagged with the
-- commission they belong to.
ALTER TABLE client_events ADD COLUMN commission_id TEXT REFERENCES commissions(id) ON DELETE SET NULL;
