-- Migration number: 0061        2026-07-14
-- HQ marketing Phase B: lifecycle sequence switches. The sequences themselves
-- are code (services/hq-marketing-sequences.ts); this table only remembers
-- which ones the founder has switched on. Platform-only, like 0060.
CREATE TABLE hq_marketing_sequences (
  key TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
