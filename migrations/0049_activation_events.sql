-- Migration number: 0049        2026-07-12
-- Activation analytics (platform-only).
--
-- The single biggest gap in the premortem: we could not answer "where do new
-- shops drop off?" This is a lightweight, first-party activation funnel. Each
-- shop's lifecycle MILESTONE is recorded once, at the platform, so Verto HQ can
-- read the whole funnel in one query without fanning out across every shop's
-- Durable Object.
--
-- Milestones are low-volume (one row per shop per step, ever) — not pageviews.
-- The UNIQUE(shop_id, event) key makes recording idempotent: the derive-and-log
-- helper can call INSERT OR IGNORE on every dashboard load and only the first
-- crossing of each milestone sticks, with the timestamp of first observation.
--
-- Platform-only: excluded from the per-shop DO embed (see
-- scripts/embed-migrations.mjs), like the shop registry and HQ CRM.

CREATE TABLE IF NOT EXISTS activation_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id     TEXT NOT NULL,
  event       TEXT NOT NULL,          -- 'signup' | 'brand' | 'product' | 'payments' | 'fulfillment' | 'publish' | 'open' | 'first_order' | 'shared'
  meta        TEXT,                   -- optional JSON
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (shop_id, event)
);

CREATE INDEX IF NOT EXISTS idx_activation_events_event ON activation_events(event);
CREATE INDEX IF NOT EXISTS idx_activation_events_shop ON activation_events(shop_id);
