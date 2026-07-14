-- Migration number: 0060        2026-07-14
-- Verto HQ marketing suite — platform-level email marketing to Verto's own
-- audience (shops, demo leads, makers waitlist). Platform-only: these are
-- Verto's contacts and sends, never a shop's shoppers. Excluded from the
-- per-shop embedded schema (see scripts/embed-migrations.mjs).

-- Never-email list. One row per address; suppression is checked at queue time
-- AND at send time, so an unsubscribe between the two always wins.
CREATE TABLE hq_marketing_suppression (
  email TEXT PRIMARY KEY,                -- lowercased
  reason TEXT NOT NULL DEFAULT 'unsubscribed'
    CHECK (reason IN ('unsubscribed','bounced','complained','manual')),
  source TEXT,                           -- broadcast/sequence id, or 'manual'
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One-off campaigns: pick a segment, draft (AI-assisted), review, send.
CREATE TABLE hq_marketing_broadcasts (
  id TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  preheader TEXT,                        -- inbox preview line
  body_md TEXT NOT NULL,                 -- markdown master → branded HTML + plain text
  segment TEXT NOT NULL,                 -- segment key (see hq-marketing.ts SEGMENTS)
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','queued','sending','sent','cancelled')),
  recipient_count INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  queued_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- The send queue and the permanent ledger in one table: a row is queued,
-- then becomes the audit record of what actually went out (or why not).
-- Drained at a controlled rate by cron — Email Sending quotas are enforced
-- here, not at the API layer, so a big broadcast just takes longer.
CREATE TABLE hq_marketing_sends (
  id TEXT PRIMARY KEY,
  broadcast_id TEXT REFERENCES hq_marketing_broadcasts(id) ON DELETE CASCADE,
  sequence_key TEXT,                     -- Phase B automation id (NULL for broadcasts)
  email TEXT NOT NULL,
  contact_id TEXT,                       -- crm_contacts id when known
  subject TEXT NOT NULL,
  body_md TEXT NOT NULL,                 -- resolved, personalised markdown
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','sent','failed','suppressed','cancelled')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  due_at TEXT NOT NULL DEFAULT (datetime('now')),
  sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_hq_marketing_sends_due ON hq_marketing_sends(status, due_at);
CREATE INDEX idx_hq_marketing_sends_broadcast ON hq_marketing_sends(broadcast_id);
-- An address gets a given broadcast at most once, ever.
CREATE UNIQUE INDEX idx_hq_marketing_sends_once
  ON hq_marketing_sends(broadcast_id, email) WHERE broadcast_id IS NOT NULL;

-- Phase B: where each contact sits in each lifecycle sequence, so automations
-- are idempotent — re-running the sweep never double-sends a step.
CREATE TABLE hq_marketing_sequence_state (
  sequence_key TEXT NOT NULL,
  contact_id TEXT NOT NULL,
  step INTEGER NOT NULL DEFAULT 0,       -- last step SENT (0 = none yet)
  last_sent_at TEXT,
  completed_at TEXT,                     -- set when the sequence finished or was exited
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (sequence_key, contact_id)
);
