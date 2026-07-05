-- Migration number: 0007        2026-07-06
-- CMS power pack: block sections, scheduled publishing, SEO fields,
-- media alt text, translation cache, editable navigation, brand voice,
-- draft preview token, and the homepage recast as a block-composed page.

-- Pages: block sections + scheduling + SEO
ALTER TABLE pages ADD COLUMN sections_json TEXT;   -- NULL = plain markdown page
ALTER TABLE pages ADD COLUMN publish_at TEXT;      -- auto-publish when due (hourly cron)
ALTER TABLE pages ADD COLUMN meta_title TEXT;
ALTER TABLE pages ADD COLUMN meta_description TEXT;

-- Journal: scheduling + SEO
ALTER TABLE journal_posts ADD COLUMN publish_at TEXT;
ALTER TABLE journal_posts ADD COLUMN meta_title TEXT;
ALTER TABLE journal_posts ADD COLUMN meta_description TEXT;

-- Media library: alt text (accessibility + SEO)
ALTER TABLE files ADD COLUMN alt_text TEXT;

-- On-demand translation cache (Workers AI). source_hash invalidates
-- translations automatically when the source content changes.
CREATE TABLE content_translations (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,       -- 'page' | 'journal_post'
  entity_id TEXT NOT NULL,
  lang TEXT NOT NULL,              -- ISO 639-1
  source_hash TEXT NOT NULL,
  payload_json TEXT NOT NULL,      -- translated fields
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX idx_ctrans_key ON content_translations(entity_type, entity_id, lang);

-- Settings seeds (INSERT OR IGNORE: never clobber an existing value)
INSERT OR IGNORE INTO settings (key, value, description) VALUES
  ('preview_token', lower(hex(randomblob(16))), 'Secret token for draft preview links'),
  ('brand_voice', '', 'How the brand sounds — consumed by every AI writing feature'),
  ('supported_languages', '["en","fr"]', 'Storefront languages, first entry is the default'),
  ('nav_menus',
   '{"header":[{"label":"Shop","href":"/products"},{"label":"Collections","href":"/collections"},{"label":"Lookbook","href":"/lookbook"},{"label":"Story","href":"/story"},{"label":"Atelier","href":"/atelier"},{"label":"Journal","href":"/journal"}],"footer":[{"label":"Size Guide","href":"/size-guide"},{"label":"Shipping & Returns","href":"/shipping-returns"},{"label":"Stockists","href":"/stockists"},{"label":"Contact","href":"/contact"},{"label":"Privacy","href":"/privacy"},{"label":"Terms","href":"/terms"}]}',
   'Header/footer navigation (JSON) — edited under Admin → Content → Pages');

-- The homepage becomes a page composed of blocks (mirrors the previous
-- hardcoded homepage exactly). The home_hero block renders the existing
-- settings-backed hero, so hero editing stays where it already lives.
INSERT OR IGNORE INTO pages (id, slug, title, body_md, layout, is_published, sections_json) VALUES (
  'pg_home', 'home', 'Homepage', '', 'standard', 1,
  '[{"type":"home_hero"},{"type":"product_grid","eyebrow":"The Edit","heading":"First pieces","source":"featured","limit":4,"ctaLabel":"View all","ctaHref":"/products"},{"type":"collection_strip"},{"type":"image_text","eyebrow":"Provenance","heading":"Made in Casablanca, on purpose.","body":"We produce in small ateliers where tailoring is a living trade — pilot runs of 150 to 200 pieces, measured twice, pressed properly. Slower, and the point.","ctaLabel":"Inside the atelier","ctaHref":"/atelier","imageAlt":"The atelier, Casablanca","imageSide":"left"},{"type":"newsletter","heading":"The first drop is by invitation.","body":"Waitlist members get first access to pre-orders and the launch pricing.","kind":"waitlist"}]'
);
