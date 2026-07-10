-- Migration number: 0040        2026-07-10
-- Deposits & booking, the money-and-diary half of the stylist/tailor lane.
--
-- commission_payments: deposits and milestone payments requested against a
-- commission ("50% on approval, 50% at final fitting"). Amounts are integer
-- cents (house rule). v1 records payments the way small studios actually
-- take them — bank transfer, cash, a card reader at the fitting — with a
-- manual "mark paid"; online payment from the portal arrives with a later
-- Stripe wave (webhooks need per-shop routing, out of scope here).
--
-- booking_requests: the public "book a consult" page. A request can be
-- confirmed into a real client (created or matched) + a consult on their
-- timeline, or declined.
--
-- Embedded into every shop DO; every statement stands alone (the DO runner
-- executes one statement at a time, no transaction).

CREATE TABLE IF NOT EXISTS commission_payments (
  id TEXT PRIMARY KEY,
  commission_id TEXT NOT NULL REFERENCES commissions(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'paid', 'void')),
  paid_at TEXT,
  note TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_commission_payments_commission
  ON commission_payments(commission_id, created_at);

CREATE TABLE IF NOT EXISTS booking_requests (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  note TEXT,
  preferred_at TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'confirmed', 'declined')),
  client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_booking_requests_status
  ON booking_requests(status, created_at);
