-- Developer API — the machine-auth surface behind the native Zapier app (and
-- any other tool). Per-shop, like every tenant table.
--
-- api_keys: a shop mints personal access tokens (PATs). Only the SHA-256 hash
-- of the secret is stored (same shape as the sessions table); the plaintext is
-- shown once at creation. A non-secret `prefix` lets the admin list keys
-- without holding the secret. Keys are revocable and optionally time-boxed.
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL DEFAULT '',
  prefix TEXT NOT NULL,                            -- e.g. 'vrto_maison_a1b2c3d4' (non-secret)
  token_hash TEXT NOT NULL,                        -- sha256Hex(secret)
  roles TEXT NOT NULL DEFAULT 'integration',       -- comma-separated
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT,
  revoked_at TEXT,
  last_used_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(revoked_at, created_at DESC);

-- webhook_subscriptions: external subscribers (Zapier REST Hooks, Make, your
-- own endpoint) register a target URL per event kind. When that event fires on
-- the spine, we POST the event to each target. The signing secret lets the
-- subscriber verify authenticity (HMAC-SHA256, Standard-Webhooks style).
CREATE TABLE IF NOT EXISTS webhook_subscriptions (
  id TEXT PRIMARY KEY,
  event TEXT NOT NULL,                             -- event kind, e.g. 'commission.stage_changed'
  target_url TEXT NOT NULL,
  secret TEXT NOT NULL,                            -- HMAC signing secret (shared with the subscriber once)
  source TEXT NOT NULL DEFAULT 'api',              -- 'zapier' | 'make' | 'api'
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_webhook_subs_event ON webhook_subscriptions(event);
