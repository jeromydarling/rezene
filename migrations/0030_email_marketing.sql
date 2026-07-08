-- Migration number: 0030        2026-07-08
-- Customer email marketing: a shop can email its own customers (not just
-- newsletter leads). A single suppression list keeps unsubscribes honored
-- across both audiences. Per-shop, so embedded into every shop DB.

CREATE TABLE IF NOT EXISTS email_suppressions (
  email      TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
