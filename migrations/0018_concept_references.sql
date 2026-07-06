-- Migration number: 0018        2026-07-06
-- Reference images for the Design Studio. A design can carry up to four
-- reference images (a fabric swatch, a house model, a silhouette, a mood
-- shot); FLUX.2 conditions generation on them for true look-consistency.
-- Images are stored as normal files; this just links them to the concept.

CREATE TABLE concept_references (
  id TEXT PRIMARY KEY,
  concept_id TEXT NOT NULL REFERENCES ai_concepts(id) ON DELETE CASCADE,
  file_id TEXT REFERENCES files(id) ON DELETE CASCADE,
  label TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_concept_refs ON concept_references(concept_id);
