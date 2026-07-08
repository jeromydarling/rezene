-- Migration number: 0036        2026-07-08
-- Drop the stale CHECK allowlist on files.entity_type. The 0001 list predates
-- most of the app: every feature since that stores files (fitting renders and
-- models, brand assets, emblems, AI imports) violates it, and the failure only
-- surfaces at INSERT time deep inside a feature. Validation belongs in the app
-- (admin-files ENTITY_TYPES), where it can evolve with the product.
--
-- SQLite can't alter a CHECK, so the table is rebuilt. DROP TABLE on a parent
-- fires child FK actions (ai_generations / external_tool_exports /
-- simulation_files SET NULL, concept_references CASCADE), so those links are
-- snapshotted first and restored after the swap. Every statement leaves the
-- database consistent on its own: the per-shop DO migration runner executes
-- statements one at a time with no wrapping transaction.

CREATE TABLE files_new (
  id TEXT PRIMARY KEY,
  r2_key TEXT NOT NULL UNIQUE,
  filename TEXT NOT NULL,
  content_type TEXT,
  size_bytes INTEGER,
  entity_type TEXT,
  entity_id TEXT,
  is_public INTEGER NOT NULL DEFAULT 0,
  uploaded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  alt_text TEXT
);

INSERT INTO files_new (id, r2_key, filename, content_type, size_bytes, entity_type, entity_id, is_public, uploaded_by, created_at, alt_text)
  SELECT id, r2_key, filename, content_type, size_bytes, entity_type, entity_id, is_public, uploaded_by, created_at, alt_text
    FROM files;

-- Snapshot the child links that DROP TABLE's implicit DELETE would destroy.
CREATE TABLE _mig36_aigen AS
  SELECT id, file_id FROM ai_generations WHERE file_id IS NOT NULL;

CREATE TABLE _mig36_exports AS
  SELECT id, file_id FROM external_tool_exports WHERE file_id IS NOT NULL;

CREATE TABLE _mig36_simfiles AS
  SELECT id, file_id FROM simulation_files WHERE file_id IS NOT NULL;

CREATE TABLE _mig36_conceptrefs AS
  SELECT id, concept_id, file_id, label, created_at FROM concept_references;

DROP TABLE files;

ALTER TABLE files_new RENAME TO files;

CREATE INDEX idx_files_entity ON files(entity_type, entity_id);

-- Restore the links the FK actions cleared.
UPDATE ai_generations
   SET file_id = (SELECT s.file_id FROM _mig36_aigen s WHERE s.id = ai_generations.id)
 WHERE file_id IS NULL AND id IN (SELECT id FROM _mig36_aigen);

UPDATE external_tool_exports
   SET file_id = (SELECT s.file_id FROM _mig36_exports s WHERE s.id = external_tool_exports.id)
 WHERE file_id IS NULL AND id IN (SELECT id FROM _mig36_exports);

UPDATE simulation_files
   SET file_id = (SELECT s.file_id FROM _mig36_simfiles s WHERE s.id = simulation_files.id)
 WHERE file_id IS NULL AND id IN (SELECT id FROM _mig36_simfiles);

INSERT INTO concept_references (id, concept_id, file_id, label, created_at)
  SELECT id, concept_id, file_id, label, created_at FROM _mig36_conceptrefs
   WHERE id NOT IN (SELECT id FROM concept_references);

DROP TABLE _mig36_aigen;
DROP TABLE _mig36_exports;
DROP TABLE _mig36_simfiles;
DROP TABLE _mig36_conceptrefs;
