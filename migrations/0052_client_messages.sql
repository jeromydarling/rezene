-- Client-message outbox — the editable draft surface for client-facing
-- automations (welcome notes, "your fitting's ready", deposit thank-yous). A
-- message is drafted (AI, in the brand voice), the shop edits it, then approves
-- to send: email via the branded shell, or "portal" to publish it on the
-- client's portal page. Nothing reaches a client until it's sent. Per-shop.

CREATE TABLE IF NOT EXISTS client_messages (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  commission_id TEXT REFERENCES commissions(id) ON DELETE SET NULL,
  trigger TEXT,                                   -- automation key, or 'manual'
  channel TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email','portal')),
  subject TEXT,
  body_md TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','dismissed')),
  provider TEXT,                                  -- which AI wrote it
  sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_client_messages_status ON client_messages(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_messages_client ON client_messages(client_id, created_at DESC);
