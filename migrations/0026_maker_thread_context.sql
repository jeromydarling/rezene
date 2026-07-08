-- Migration number: 0026        2026-07-08
-- Maker Messages: allow multiple threads per supplier, each scoped to an
-- optional context (a sample, purchase order, or tech pack). A NULL context is
-- the general relationship thread. Rebuilds supplier_threads to drop the
-- one-thread-per-supplier UNIQUE constraint and add the context columns.

ALTER TABLE supplier_threads RENAME TO supplier_threads_old;

CREATE TABLE supplier_threads (
  id              TEXT PRIMARY KEY,
  supplier_id     TEXT NOT NULL,
  token           TEXT NOT NULL UNIQUE,
  context_type    TEXT,                         -- null | sample | po | tech_pack
  context_id      TEXT,
  context_label   TEXT,                         -- e.g. "Sample MA-001"
  subject         TEXT,
  last_message_at TEXT,
  unread          INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO supplier_threads (id, supplier_id, token, subject, last_message_at, unread, created_at)
  SELECT id, supplier_id, token, subject, last_message_at, unread, created_at FROM supplier_threads_old;

DROP TABLE supplier_threads_old;

CREATE INDEX IF NOT EXISTS idx_supplier_threads_ctx
  ON supplier_threads(supplier_id, context_type, context_id);
