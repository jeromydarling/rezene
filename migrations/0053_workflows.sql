-- Custom workflows — the no-code "when this happens, do that" builder. A shop
-- composes their own rules on top of the same event spine the built-in
-- automations use: pick a trigger (a real shop event), add optional conditions
-- (filters on the event's details), and one or more actions. Create-only, like
-- the built-ins — a workflow never edits or deletes anything, so the worst it
-- can do is file a task you delete. Per-shop.

CREATE TABLE IF NOT EXISTS workflows (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  trigger_event TEXT NOT NULL,                 -- event kind, e.g. 'commission.stage_changed'
  conditions_json TEXT NOT NULL DEFAULT '[]',  -- [{ field, op, value }]
  actions_json TEXT NOT NULL DEFAULT '[]',     -- [{ type, params }]
  enabled INTEGER NOT NULL DEFAULT 1,
  run_count INTEGER NOT NULL DEFAULT 0,
  last_run_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_workflows_trigger ON workflows(trigger_event, enabled);

-- A short audit trail so a shop can see their workflow actually firing.
CREATE TABLE IF NOT EXISTS workflow_runs (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  event_kind TEXT,
  status TEXT NOT NULL DEFAULT 'ok' CHECK (status IN ('ok', 'skipped', 'error')),
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_wf ON workflow_runs(workflow_id, created_at DESC);
