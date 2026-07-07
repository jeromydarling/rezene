-- Saved looks from the 3D Fitting Room. A "look" is a base garment + fabric +
-- colour + a fit configuration (size/ease/length/sleeve), optionally linked to
-- a Style. Per-shop data, so this migration is embedded into every shop DB.
CREATE TABLE IF NOT EXISTS fitting_looks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  garment_id TEXT NOT NULL,
  fabric_id TEXT NOT NULL,
  color TEXT,
  fit_json TEXT NOT NULL DEFAULT '{}',
  style_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_fitting_looks_style ON fitting_looks(style_id);
