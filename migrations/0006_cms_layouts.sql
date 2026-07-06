-- Migration number: 0006        2026-07-05
-- CMS upgrade: page layouts + hero fields, editable homepage hero.
--
-- Pages gain a layout ('standard' narrow prose, 'hero' full-bleed image
-- header, 'wide' broad editorial) plus hero image/eyebrow/subtitle fields.
-- The homepage hero moves from hardcoded JSX into a settings row so shops
-- can rewrite it without touching code. Seeded with the current live copy
-- so nothing changes visually until it's edited.

ALTER TABLE pages ADD COLUMN layout TEXT NOT NULL DEFAULT 'standard'
  CHECK (layout IN ('standard','hero','wide'));
ALTER TABLE pages ADD COLUMN hero_image_url TEXT;
ALTER TABLE pages ADD COLUMN hero_eyebrow TEXT;
ALTER TABLE pages ADD COLUMN subtitle TEXT;

INSERT OR IGNORE INTO settings (key, value, description) VALUES (
  'home_hero',
  '{"eyebrow":"Casablanca · Atlantic Riviera · SS27","heading":"Dressed for the last hour of light.","subheading":"High-waisted linen tailoring and draped resortwear, cut in the ateliers of Casablanca. Old-world proportions, modern ease, honest cloth.","primaryCtaLabel":"Shop the collection","primaryCtaHref":"/products","secondaryCtaLabel":"Our story","secondaryCtaHref":"/story","imageUrl":null}',
  'Homepage hero content (JSON) — edited under Admin → Content → Pages'
);
