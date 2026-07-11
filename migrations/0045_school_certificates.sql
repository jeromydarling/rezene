-- Verto School certificates — PLATFORM-ONLY (excluded from the per-shop DO
-- embed, like the shop registry). Certificates live at the platform level
-- because the badge is a public, cross-shop claim: anyone must be able to
-- resolve verto.style/certified/<id> without knowing which shop earned it.
--
-- The id doubles as the credential: a 24-hex random token that exists only
-- if the certificate was actually issued. The public page shows holder,
-- scope, curriculum version, issue date and revocation state; the earning
-- shop's per-shop tables (0044) hold the full transcript behind it.

CREATE TABLE IF NOT EXISTS school_certificates (
  id TEXT PRIMARY KEY,              -- 'crt_' + 24 hex chars, unguessable
  shop_id TEXT NOT NULL,
  shop_slug TEXT NOT NULL,
  user_email TEXT NOT NULL,
  user_name TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('course','school','studio')),
  ref TEXT NOT NULL,                -- course slug, school key, or 'studio'
  title TEXT NOT NULL,              -- display title at issue time
  curriculum_version TEXT NOT NULL,
  issued_at TEXT NOT NULL DEFAULT (datetime('now')),
  revoked INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_school_certs_holder
  ON school_certificates(shop_id, user_email);
