-- Migration number: 0008        2026-07-06
-- Marketing suite: campaigns generate multi-channel content kits (AI),
-- assets carry a lightweight schedule, email sends go to captured leads
-- (with unsubscribe), all editable before anything leaves the building.

CREATE TABLE marketing_campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  objective TEXT NOT NULL DEFAULT 'launch'
    CHECK (objective IN ('launch','drop','sale','seasonal','evergreen','press')),
  subject TEXT,                        -- what this campaign is about, in the owner's words
  key_message TEXT,                    -- the one thing every asset must communicate
  audience TEXT,
  product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
  collection_id TEXT REFERENCES collections(id) ON DELETE SET NULL,
  starts_on TEXT,
  ends_on TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','done','archived')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE marketing_assets (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,               -- instagram | story | tiktok | pinterest | x | facebook | email | blog | press | ad_google | ad_meta
  kind TEXT NOT NULL,                  -- caption | script | email | article | press_release | ad_set
  title TEXT,                          -- e.g. email subject line
  content TEXT NOT NULL DEFAULT '',    -- markdown/plain text
  meta_json TEXT,                      -- hashtags, variants, char guidance
  scheduled_for TEXT,                  -- planned post date (lightweight calendar)
  posted_at TEXT,                      -- marked done by the merchant
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_massets_campaign ON marketing_assets(campaign_id);
CREATE INDEX idx_massets_schedule ON marketing_assets(scheduled_for);

-- Email campaign sends (audit of what went to how many subscribers)
CREATE TABLE marketing_sends (
  id TEXT PRIMARY KEY,
  campaign_id TEXT REFERENCES marketing_campaigns(id) ON DELETE SET NULL,
  asset_id TEXT,
  subject TEXT,
  audience TEXT,                       -- newsletter | waitlist | all
  recipient_count INTEGER NOT NULL DEFAULT 0,
  sent_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Subscribers can leave: unsubscribe link in every marketing email.
ALTER TABLE leads ADD COLUMN unsubscribed_at TEXT;
