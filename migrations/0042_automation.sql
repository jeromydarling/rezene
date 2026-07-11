-- The automation suite's foundations.
--
--   activity_events      — the event spine: every meaningful write across the
--                          app emits one typed row (sample.approved,
--                          po.status.confirmed, commission.stage_changed…).
--                          The derived calendar, the automations library, and
--                          the "needs your attention" digest all read from or
--                          hang off this table.
--   automation_settings  — per-shop toggles for the built-in automation
--                          rules. No row = the rule's default (enabled);
--                          rules only ever CREATE things (tasks, drafts),
--                          never destroy.
--   tombstones           — undo for destructive actions: deletes stash the
--                          serialized row here so the toast can offer Undo;
--                          old tombstones are pruned opportunistically.

CREATE TABLE IF NOT EXISTS activity_events (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,              -- 'sample.approved', 'po.status.confirmed', ...
  entity_type TEXT NOT NULL,       -- 'sample', 'production_order', 'commission', ...
  entity_id TEXT NOT NULL,
  title TEXT NOT NULL,             -- human sentence for feeds
  payload TEXT,                    -- JSON context for rules
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_activity_events_kind ON activity_events(kind, created_at);
CREATE INDEX IF NOT EXISTS idx_activity_events_entity ON activity_events(entity_type, entity_id);

CREATE TABLE IF NOT EXISTS automation_settings (
  rule_key TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tombstones (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,       -- table name the row came from
  entity_id TEXT NOT NULL,
  label TEXT NOT NULL,             -- "Deleted note 'Pricing tiers'" for the undo toast
  row_json TEXT NOT NULL,          -- the full row, restored on undo
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tombstones_created ON tombstones(created_at);
