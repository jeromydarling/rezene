-- Lookbooks: a shop's print-ready seasonal magazine, composed from its own
-- products + brand identity. Per-shop data (lives in each shop's DO). The
-- ordered spreads + copy live in spec_json; the render model is resolved at
-- read time from the products table so a lookbook always reflects current
-- product data (price, story, imagery). Phase A produces a preview PDF; a
-- later phase hands the same composition to a print-on-demand fulfiller.
-- Named print_lookbooks to avoid clashing with the storefront `lookbooks`
-- table (shoppable on-site galleries, migration 0001) — different feature.
CREATE TABLE IF NOT EXISTS print_lookbooks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT,
  intro TEXT,                       -- editorial opener (letter / season note)
  template TEXT NOT NULL DEFAULT 'lookbook',
  spec_json TEXT NOT NULL DEFAULT '{}',  -- { spreads: [{ productId, layout, caption }] }
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_print_lookbooks_created ON print_lookbooks(created_at);
