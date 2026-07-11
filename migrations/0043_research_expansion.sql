-- R&D expansion: research grows from "makers + notes" into a full research
-- studio — the questions a label actually asks before committing money:
--
--   research_brands          — competition dossiers: who else sells to my
--                              customer, at what prices, through which
--                              channels. Live-researched with citations;
--                              `watch` opts a brand into the scheduled
--                              refresh sweep (diffs land in the activity
--                              feed and daily digest).
--   research_brand_snapshots — the dossier history: every refresh keeps the
--                              previous text, so "what changed since last
--                              month" is a real answer, not a memory.
--   price_studies            — pricing research for one category/market:
--                              a comps table (real garments at real prices),
--                              a low/mid/high band, and a cited
--                              recommendation. The chosen target retail
--                              pushes straight into Costing & Margins.
--   price_study_comps        — the comparable rows (integer cents).
--   trend_boards             — trend & fabric scouting briefs per season and
--                              focus; adopted directions hand off to the
--                              Design Studio as a concept brief.
--   research_stockists       — market/channel research: boutiques, online
--                              retailers, showrooms and fairs that could
--                              carry the label, with a pitch pipeline.
--
-- Same philosophy as 0041: text stays text where research is fuzzy, money
-- is integer cents where it's real, citations are preserved everywhere.

CREATE TABLE IF NOT EXISTS research_brands (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  website TEXT,
  instagram TEXT,
  segment TEXT NOT NULL DEFAULT 'direct'
    CHECK (segment IN ('direct','aspirational','adjacent')),
  positioning TEXT,                -- one-line: who they are to their customer
  price_floor_cents INTEGER,       -- entry price observed
  price_ceiling_cents INTEGER,     -- top price observed
  currency TEXT NOT NULL DEFAULT 'USD',
  channels TEXT,                   -- JSON array: 'dtc','wholesale','marketplace','retail'
  dossier_md TEXT,                 -- latest researched dossier (markdown)
  citations TEXT,                  -- JSON array of source URLs
  note TEXT,
  watch INTEGER NOT NULL DEFAULT 0,
  last_researched_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_research_brands_watch ON research_brands(watch);

CREATE TABLE IF NOT EXISTS research_brand_snapshots (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES research_brands(id) ON DELETE CASCADE,
  dossier_md TEXT NOT NULL,
  citations TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_brand_snapshots_brand ON research_brand_snapshots(brand_id, created_at);

CREATE TABLE IF NOT EXISTS price_studies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,                   -- 'linen shirt', 'silk slip dress'
  market TEXT,                     -- 'US direct-to-consumer', 'EU wholesale'
  style_id TEXT REFERENCES styles(id) ON DELETE SET NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  band_low_cents INTEGER,          -- accessible edge of the band
  band_mid_cents INTEGER,          -- the defensible middle
  band_high_cents INTEGER,         -- premium edge
  recommendation_md TEXT,          -- cited research summary + recommendation
  citations TEXT,                  -- JSON array of source URLs
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','decided')),
  last_researched_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS price_study_comps (
  id TEXT PRIMARY KEY,
  study_id TEXT NOT NULL REFERENCES price_studies(id) ON DELETE CASCADE,
  brand TEXT NOT NULL,
  product TEXT,
  price_cents INTEGER,
  currency TEXT NOT NULL DEFAULT 'USD',
  url TEXT,
  fabric TEXT,
  origin TEXT,                     -- where it's made, when known
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_price_comps_study ON price_study_comps(study_id);

CREATE TABLE IF NOT EXISTS trend_boards (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  season TEXT,                     -- 'SS27'
  focus TEXT NOT NULL DEFAULT 'silhouettes'
    CHECK (focus IN ('silhouettes','fabrics','colors','details','market')),
  brief_md TEXT,                   -- researched brief (markdown)
  citations TEXT,                  -- JSON array of source URLs
  items TEXT,                      -- JSON array of {label, note} directions
  status TEXT NOT NULL DEFAULT 'exploring'
    CHECK (status IN ('exploring','adopted','passed')),
  concept_id TEXT REFERENCES ai_concepts(id) ON DELETE SET NULL,
  watch INTEGER NOT NULL DEFAULT 0,
  last_researched_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS research_stockists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'boutique'
    CHECK (kind IN ('boutique','department','online','showroom','fair','popup')),
  city TEXT,
  country TEXT,
  website TEXT,
  instagram TEXT,
  email TEXT,
  phone TEXT,
  brands_carried TEXT,             -- text: names seen on their racks/site
  price_point TEXT,                -- 'contemporary', 'advanced contemporary', 'luxury'
  fit_note TEXT,                   -- why this door fits the label
  dossier_md TEXT,                 -- researched profile (markdown)
  citations TEXT,                  -- JSON array of source URLs
  status TEXT NOT NULL DEFAULT 'researching'
    CHECK (status IN ('researching','shortlist','pitched','in_talks','stocked','passed')),
  last_researched_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_research_stockists_status ON research_stockists(status);
