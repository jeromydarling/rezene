-- Migration number: 0016        2026-07-06
-- Support tickets: bug reports + feature requests from any shop, triaged in
-- Verto HQ. Platform-only (lives in the primary D1, like the shop registry and
-- HQ CRM) — every shop writes here, the operator works the queue.

CREATE TABLE feedback (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL DEFAULT 'bug' CHECK (kind IN ('bug','feature','question')),
  title TEXT NOT NULL,
  body TEXT,
  severity TEXT CHECK (severity IN ('low','medium','high')),   -- bugs only
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','in_progress','resolved','closed','wont_fix')),
  -- Who + where, captured automatically so the operator has context.
  shop_id TEXT,
  shop_slug TEXT,
  shop_name TEXT,
  reporter_email TEXT,
  reporter_name TEXT,
  page_path TEXT,
  user_agent TEXT,
  admin_note TEXT,                    -- HQ triage note
  resolved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_feedback_status ON feedback(status, created_at DESC);
