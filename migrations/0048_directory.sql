-- The Verto Directory — PLATFORM-ONLY (excluded from the per-shop embed).
-- Private-first: every shop controls its own listing from Settings (default:
-- not listed), rows live here at the platform so the directory can be
-- assembled across shops, and the public page stays gated until the network
-- has the density to be worth showing off (DIRECTORY_PUBLIC flag).
--
-- maker_waitlist is the maker-tools front door: makers (the factories,
-- ateliers and fabric houses our shops work with) raise a hand here — from
-- the public /makers page or a shop's invitation — and become the seed list
-- for the maker workspace when it opens.

CREATE TABLE IF NOT EXISTS directory_listings (
  shop_id TEXT PRIMARY KEY,
  opted_in INTEGER NOT NULL DEFAULT 0,
  craft TEXT NOT NULL DEFAULT 'label'
    CHECK (craft IN ('label','tailor','seamstress','stylist','boutique')),
  specialties TEXT,                  -- 'bridal, linen tailoring, made-to-measure'
  city TEXT,
  country TEXT,
  blurb TEXT,                        -- one warm paragraph, the shop's own words
  cert_count INTEGER NOT NULL DEFAULT 0,   -- snapshot of Verto School certificates
  cert_best TEXT,                    -- 'course' | 'school' | 'studio' (best held)
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS maker_waitlist (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  craft TEXT,                        -- 'cut & sew', 'knitwear', 'fabric mill', …
  city TEXT,
  country TEXT,
  website TEXT,
  note TEXT,
  invited_by_shop TEXT,              -- slug of the shop that sent them, if any
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (email)
);
