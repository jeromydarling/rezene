-- Platform owner role. HQ (the Verto/CROS platform CRM + shop registry) is
-- gated on this explicit role rather than on whoever the bootstrap ADMIN_EMAIL
-- secret happens to be (see isSuperAdmin in src/worker/services/auth.ts). Only
-- the platform DB has HQ, so this role is platform-only; it is excluded from
-- the per-shop embedded migration set.
INSERT OR IGNORE INTO roles (id, name, description) VALUES
  ('superadmin', 'Platform Owner', 'CROS platform owner — full access to Verto HQ (platform CRM, shop registry, and the knowledge-base overlay).');
