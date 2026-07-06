-- Migration number: 0014        2026-07-06
-- Team logins + self-service password recovery (per-shop).
--
-- Roles (admin / ops / viewer) and the users/user_roles tables already exist
-- from 0001. This adds the one missing piece: short-lived, single-use tokens
-- that back both "forgot my password" and "you've been invited, set a
-- password". A hash is stored, never the token itself.

CREATE TABLE password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,                     -- sha256(token)
  purpose TEXT NOT NULL DEFAULT 'reset'
    CHECK (purpose IN ('reset','invite')),
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_prt_user ON password_reset_tokens(user_id);
CREATE INDEX idx_prt_hash ON password_reset_tokens(token_hash);
