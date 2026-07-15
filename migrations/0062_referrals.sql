-- Migration number: 0062        2026-07-14
-- Referral program (HQ marketing Phase C): shops refer designers; when the
-- referred shop signs up, BOTH sides earn a free month, tracked here until
-- the founder applies them to billing. Platform-only, like 0060/0061.

ALTER TABLE shops ADD COLUMN referred_by_slug TEXT;

CREATE TABLE referral_credits (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id),   -- who earned the credit
  side TEXT NOT NULL CHECK (side IN ('referrer','referee')),
  other_shop_id TEXT REFERENCES shops(id),      -- the shop on the other side
  months INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','applied','void')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  applied_at TEXT
);
CREATE INDEX idx_referral_credits_shop ON referral_credits(shop_id, status);
