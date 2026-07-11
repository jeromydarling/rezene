-- R&D: the shop's research workspace — where knowledge lives BEFORE it is
-- structured enough to be a supplier record or a tech pack. Two record
-- kinds, shaped by real Perplexity research exports:
--   research_makers  — candidate makers/providers (a bespoke-fulfillment
--                      directory row: contact + MOQ + lead time + tech-pack
--                      readiness), with a lightweight pipeline status and a
--                      link to the suppliers row once promoted.
--   research_notes   — free-form findings: pasted research, strategy notes,
--                      and in-app Perplexity answers (kind 'search') with
--                      their citations preserved.
-- MOQ / lead time / price stay TEXT on purpose: real research says things
-- like "1–50 (managed)" and "2–4 wks sample", and flattening that to a
-- number would lie. Promotion parses what it can.

CREATE TABLE IF NOT EXISTS research_notes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body_md TEXT NOT NULL DEFAULT '',
  topic TEXT,
  tags TEXT,
  source_url TEXT,
  kind TEXT NOT NULL DEFAULT 'note' CHECK (kind IN ('note','search','import')),
  citations TEXT,
  pinned INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_research_notes_topic ON research_notes(topic);

CREATE TABLE IF NOT EXISTS research_makers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  market TEXT,
  location TEXT,
  website TEXT,
  email TEXT,
  phone TEXT,
  speciality TEXT,
  tech_pack TEXT,
  min_order TEXT,
  lead_time TEXT,
  price_unit TEXT,
  about TEXT,
  best_use TEXT,
  status TEXT NOT NULL DEFAULT 'researching'
    CHECK (status IN ('researching','contacted','sampling','approved','passed')),
  note TEXT,
  topic TEXT,
  supplier_id TEXT REFERENCES suppliers(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_research_makers_status ON research_makers(status);
