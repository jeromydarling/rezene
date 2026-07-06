-- Migration number: 0010        2026-07-05
-- Verto HQ CRM — platform-level customer relationships. Lives ONLY in the
-- primary D1 (excluded from the embedded per-shop schema, like 0009):
-- these are Verto's customers, not any shop's shoppers.

CREATE TABLE crm_contacts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  company TEXT,                          -- their label / brand name
  shop_id TEXT REFERENCES shops(id),     -- linked once they have a shop
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('signup','demo','lead','manual')),
  status TEXT NOT NULL DEFAULT 'lead'
    CHECK (status IN ('lead','trial','active','champion','churn_risk','churned')),
  -- Geo captured at the edge (request.cf) — powers the atlas + local time.
  country TEXT,
  city TEXT,
  latitude REAL,
  longitude REAL,
  timezone TEXT,
  tags TEXT NOT NULL DEFAULT '[]',       -- JSON array of strings
  notes_md TEXT,                         -- the human stuff: context, preferences, history
  last_touch_at TEXT,                    -- last interaction either direction
  next_followup_at TEXT,                 -- promise to get back to them
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_crm_contacts_status ON crm_contacts(status);
CREATE INDEX idx_crm_contacts_shop ON crm_contacts(shop_id);

-- The relationship timeline: auto events (signup, demo visit, provision)
-- and manual entries (notes, calls, emails) share one stream.
CREATE TABLE crm_interactions (
  id TEXT PRIMARY KEY,
  contact_id TEXT NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
  kind TEXT NOT NULL
    CHECK (kind IN ('signup','provision','demo_visit','email_out','note','call','meeting','support')),
  subject TEXT,
  body_md TEXT,
  metadata TEXT,                         -- JSON (shop slug, plan, ip country…)
  created_by TEXT,                       -- user id for manual entries; NULL = system
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_crm_interactions_contact ON crm_interactions(contact_id, created_at DESC);

-- Follow-ups: small promises with due dates. The daily sweep also creates
-- these ("new signup, no touch in 3 days") so nobody slips through.
CREATE TABLE crm_tasks (
  id TEXT PRIMARY KEY,
  contact_id TEXT NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  due_at TEXT,
  done_at TEXT,
  auto_key TEXT,                         -- dedup key for sweep-generated tasks
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_crm_tasks_open ON crm_tasks(done_at, due_at);
CREATE UNIQUE INDEX idx_crm_tasks_auto ON crm_tasks(contact_id, auto_key) WHERE auto_key IS NOT NULL;
