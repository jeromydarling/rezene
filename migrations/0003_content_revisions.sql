-- Migration number: 0003        2026-07-05
-- CMS revision history: every content save snapshots the previous state,
-- enabling one-click restore from the admin editors.

CREATE TABLE content_revisions (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('page','journal_post','collection','lookbook')),
  entity_id TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,       -- full row state before the change
  saved_by TEXT,                     -- user id (no FK: survives user deletion)
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_crev_entity ON content_revisions(entity_type, entity_id, created_at DESC);
