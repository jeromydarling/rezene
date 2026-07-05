-- Migration number: 0005        2026-07-05
-- Multi-provider shipping layer.
--
-- Shops connect whichever carrier stack they already use (DHL Express,
-- Shippo, EasyPost, ShipEngine, Sendcloud, Easyship) or run on the built-in
-- manual rate table. Provider API keys live in provider rows (admin-only
-- reads return presence booleans, never values). Per-order parcels are
-- `order_shipments` — distinct from `shipment_batches`, which tracks
-- factory→warehouse freight.

-- ============================================================
-- Provider connections (one row per provider)
-- ============================================================
CREATE TABLE shipping_provider_configs (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL UNIQUE CHECK (provider IN
    ('manual','dhl_express','shippo','easypost','shipengine','sendcloud','easyship')),
  is_enabled INTEGER NOT NULL DEFAULT 0,
  use_at_checkout INTEGER NOT NULL DEFAULT 0,  -- quote live rates to buyers
  credentials_json TEXT NOT NULL DEFAULT '{}', -- API keys; never returned to clients
  config_json TEXT NOT NULL DEFAULT '{}',      -- provider options (sandbox flag, etc.)
  webhook_token TEXT,                          -- secret path segment for inbound tracking webhooks
  last_verified_at TEXT,
  last_verify_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- Manual rate table (always-available fallback / zero-API option)
-- ============================================================
CREATE TABLE shipping_zones (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  countries_json TEXT NOT NULL DEFAULT '[]',   -- ISO-2 list; [] = rest of world
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE shipping_rates (
  id TEXT PRIMARY KEY,
  zone_id TEXT NOT NULL REFERENCES shipping_zones(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                          -- 'Standard', 'Express'
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  free_over_cents INTEGER,                     -- free when order subtotal ≥ this
  min_transit_days INTEGER,
  max_transit_days INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_shiprates_zone ON shipping_rates(zone_id);

-- ============================================================
-- Per-order parcels + tracking history
-- ============================================================
CREATE TABLE order_shipments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  carrier TEXT,
  service TEXT,
  external_id TEXT,                            -- provider's shipment/transaction id
  tracking_number TEXT,
  tracking_url TEXT,
  label_url TEXT,                              -- external URL or internal /api/admin/shipping/... path
  label_r2_key TEXT,                           -- set when the label PDF is stored in R2
  cost_cents INTEGER,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN
    ('created','label_purchased','in_transit','out_for_delivery','delivered','exception','returned','cancelled')),
  raw_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_oship_order ON order_shipments(order_id);
CREATE INDEX idx_oship_tracking ON order_shipments(tracking_number);

CREATE TABLE shipment_events (
  id TEXT PRIMARY KEY,
  shipment_id TEXT NOT NULL REFERENCES order_shipments(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  status TEXT,
  description TEXT,
  location TEXT,
  occurred_at TEXT,
  raw_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_shipevents_shipment ON shipment_events(shipment_id);

-- Chosen rate label from checkout, snapshotted for the order list.
ALTER TABLE orders ADD COLUMN shipping_method TEXT;

-- ============================================================
-- Seed: manual provider on by default with a starter rate table,
-- so checkout can always quote something. All values are editable
-- under Admin → Shipping.
-- ============================================================
INSERT INTO shipping_provider_configs (id, provider, is_enabled, use_at_checkout) VALUES
  ('spc_manual', 'manual', 1, 1);

INSERT INTO shipping_zones (id, name, countries_json, sort_order) VALUES
  ('zone_domestic', 'Domestic (Morocco)', '["MA"]', 0),
  ('zone_eu', 'Europe', '["FR","DE","ES","IT","NL","BE","PT","IE","AT","DK","SE"]', 1),
  ('zone_uk', 'United Kingdom', '["GB"]', 2),
  ('zone_na', 'North America', '["US","CA"]', 3),
  ('zone_row', 'Rest of world', '[]', 9);

INSERT INTO shipping_rates (id, zone_id, name, amount_cents, currency, free_over_cents, min_transit_days, max_transit_days, sort_order) VALUES
  ('rate_ma_std', 'zone_domestic', 'Courier', 500, 'USD', 15000, 1, 3, 0),
  ('rate_eu_std', 'zone_eu', 'Standard', 1500, 'USD', 25000, 4, 8, 0),
  ('rate_eu_exp', 'zone_eu', 'Express', 3000, 'USD', NULL, 2, 4, 1),
  ('rate_uk_std', 'zone_uk', 'Standard', 1500, 'USD', 25000, 4, 8, 0),
  ('rate_na_std', 'zone_na', 'Standard', 2500, 'USD', 30000, 6, 10, 0),
  ('rate_na_exp', 'zone_na', 'Express', 4500, 'USD', NULL, 3, 5, 1),
  ('rate_row_std', 'zone_row', 'International', 3500, 'USD', NULL, 7, 14, 0);
