-- Migration number: 0011        2026-07-06
-- CRM phase 2 (platform-only, excluded from per-shop schema):
--  - inbound email + milestone events join the timeline
--  - shop-activity health snapshot on contacts (last login/order/publish)

-- SQLite can't alter a CHECK constraint: rebuild crm_interactions with the
-- expanded kind list.
CREATE TABLE crm_interactions_v2 (
  id TEXT PRIMARY KEY,
  contact_id TEXT NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
  kind TEXT NOT NULL
    CHECK (kind IN ('signup','provision','demo_visit','email_out','email_in','milestone','note','call','meeting','support')),
  subject TEXT,
  body_md TEXT,
  metadata TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO crm_interactions_v2 SELECT * FROM crm_interactions;
DROP TABLE crm_interactions;
ALTER TABLE crm_interactions_v2 RENAME TO crm_interactions;
CREATE INDEX idx_crm_interactions_contact ON crm_interactions(contact_id, created_at DESC);

-- Health: computed from the customer's SHOP activity, not from our outreach.
ALTER TABLE crm_contacts ADD COLUMN last_shop_login_at TEXT;
ALTER TABLE crm_contacts ADD COLUMN last_shop_order_at TEXT;
ALTER TABLE crm_contacts ADD COLUMN last_shop_publish_at TEXT;
ALTER TABLE crm_contacts ADD COLUMN shop_orders_total INTEGER;
ALTER TABLE crm_contacts ADD COLUMN shop_orders_30d INTEGER;
ALTER TABLE crm_contacts ADD COLUMN health TEXT
  CHECK (health IN ('healthy','cooling','at_risk','unknown') OR health IS NULL);
ALTER TABLE crm_contacts ADD COLUMN health_checked_at TEXT;
