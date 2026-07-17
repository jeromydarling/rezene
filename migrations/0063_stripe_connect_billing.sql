-- Migration number: 0063        2026-07-14
-- Stripe Connect + SaaS billing, on the platform shop registry. Each shop gets
-- an Express connected account (customer payments route to it via destination
-- charges, minus Verto's application fee), and a Stripe Billing subscription
-- for its Verto plan. Platform-only, like 0062.

ALTER TABLE shops ADD COLUMN stripe_account_id TEXT;
ALTER TABLE shops ADD COLUMN stripe_charges_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE shops ADD COLUMN stripe_details_submitted INTEGER NOT NULL DEFAULT 0;
ALTER TABLE shops ADD COLUMN stripe_customer_id TEXT;
ALTER TABLE shops ADD COLUMN stripe_subscription_id TEXT;
ALTER TABLE shops ADD COLUMN billing_status TEXT;
