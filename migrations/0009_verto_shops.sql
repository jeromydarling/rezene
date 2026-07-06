-- Migration number: 0009        2026-07-06
-- Verto: the platform grows a shop registry. The root of the domain is
-- Verto's marketing/signup site; each shop lives at /<slug> (and later at
-- its own CNAME'd domain via custom_domain). Rezene is shop #1 — its data,
-- login, and CMS are untouched; only its public URL gains the /rezene
-- prefix (legacy paths 301-redirect).

CREATE TABLE shops (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,           -- verto.style/<slug>
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','active','suspended','closed')),
  owner_email TEXT,
  plan TEXT,                           -- starter | label | studio | house (requested at signup)
  custom_domain TEXT UNIQUE,           -- set when a customer CNAMEs their own domain
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO shops (id, slug, name, status, plan) VALUES
  ('shop_rezene', 'rezene', 'Rezene', 'active', 'house');
