-- AI Look Studio, phase 2: a per-shop library of base MODEL photos (to try
-- real garment photos onto), plus richer provenance on renders.

-- Base models a shop can dress: either generated from a preset or uploaded.
CREATE TABLE IF NOT EXISTS fitting_models (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL,
  label TEXT NOT NULL,
  preset_id TEXT,          -- FITTING_MODELS preset it was generated from (if any)
  source TEXT NOT NULL DEFAULT 'generated',  -- 'generated' | 'uploaded'
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- How a render was produced, so the gallery can label it and try-on renders can
-- point back at the garment photo + base model used.
ALTER TABLE fitting_renders ADD COLUMN kind TEXT NOT NULL DEFAULT 'generate';  -- 'generate' | 'tryon'
ALTER TABLE fitting_renders ADD COLUMN garment_file_id TEXT;
ALTER TABLE fitting_renders ADD COLUMN model_file_id TEXT;
ALTER TABLE fitting_renders ADD COLUMN provider TEXT;
