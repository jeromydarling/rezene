-- AI Look Studio renders — photoreal "garment on a model" images generated in
-- the Fitting Room. Each row points at a public file in R2 (served at /media)
-- plus the prompt/model/setting used, so the gallery persists per shop.
CREATE TABLE IF NOT EXISTS fitting_renders (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL,
  garment_id TEXT,
  model_id TEXT,
  setting_id TEXT,
  prompt TEXT,
  style_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_fitting_renders_created ON fitting_renders(created_at);
