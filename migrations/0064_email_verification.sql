-- Owner email verification for shops. A confirm-your-address link goes out in
-- the provisioning welcome email; clicking it proves the owner controls the
-- address (instant onboarding is unchanged — this records ownership, it does
-- not gate provisioning). Platform-only: lives on the shops registry in D1,
-- excluded from the per-shop DO embed and the integration harness.

ALTER TABLE shops ADD COLUMN email_verified_at TEXT;

CREATE TABLE IF NOT EXISTS shop_email_verifications (
  id          TEXT PRIMARY KEY,
  shop_id     TEXT NOT NULL,
  email       TEXT NOT NULL,
  token_hash  TEXT NOT NULL UNIQUE,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  verified_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_shop_email_verif_shop ON shop_email_verifications(shop_id);
