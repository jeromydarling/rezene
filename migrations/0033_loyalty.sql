-- Migration number: 0033        2026-07-08
-- Loyalty + referral, built on store credit. Customers earn credit on paid
-- orders and for referring friends; they redeem credit into a one-time discount
-- code (so it works with the existing Stripe checkout, no balance-at-checkout
-- plumbing). Per-shop.

-- Every credit movement. Balance = SUM(delta_cents) for a customer.
CREATE TABLE IF NOT EXISTS customer_credit_ledger (
  id          TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  delta_cents INTEGER NOT NULL,      -- + earned/referral, − redeemed
  kind        TEXT NOT NULL CHECK (kind IN ('earned','referral','redeemed','manual')),
  reason      TEXT,
  order_id    TEXT REFERENCES orders(id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_customer ON customer_credit_ledger(customer_id);
-- One earn per order (guards against webhook retries).
CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_earn_once
  ON customer_credit_ledger(order_id) WHERE kind = 'earned';

-- One stable referral code per customer.
CREATE TABLE IF NOT EXISTS referral_codes (
  customer_id TEXT PRIMARY KEY REFERENCES customers(id) ON DELETE CASCADE,
  code        TEXT NOT NULL UNIQUE,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- A friend claiming someone's referral code; qualifies on their first paid order.
CREATE TABLE IF NOT EXISTS referrals (
  id                   TEXT PRIMARY KEY,
  referrer_customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  code                 TEXT NOT NULL,
  referred_email       TEXT,
  referred_customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  status               TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','qualified')),
  reward_cents         INTEGER NOT NULL DEFAULT 0,
  discount_code        TEXT,        -- the friend's first-order code
  created_at           TEXT NOT NULL DEFAULT (datetime('now')),
  qualified_at         TEXT
);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON referrals(referred_customer_id, status);
CREATE INDEX IF NOT EXISTS idx_referrals_email ON referrals(referred_email, status);
