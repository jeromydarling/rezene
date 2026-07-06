-- Migration number: 0012        2026-07-06
-- Give the demo Tangier tech pack an annotated flat sketch so the live
-- demo shows off point-callout annotation out of the box.
--
-- Runs against the primary D1 (Rezene) via the deploy migrate step and
-- against every shop Durable Object via the embedded schema migrations.
-- The INSERT ... SELECT ... WHERE EXISTS guard makes it a clean no-op in
-- shops that don't carry the demo Tangier tech pack (real customer shops),
-- so it never trips the tech_pack_id foreign key.

INSERT OR IGNORE INTO tech_pack_sections (id, tech_pack_id, kind, title, content_json, sort_order)
SELECT
  'tps_tangier_flat',
  'tp_tangier_v1',
  'flat_sketch',
  'Flat Sketch / Reference',
  '{"imageUrl":"/media/placeholder/tangier-navy-1.jpg","caption":"Tangier Trouser — front, high-waisted double pleat","annotations":[{"n":1,"x":50,"y":18,"text":"Waistband: 4cm finished, curtained, with hook-and-bar closure"},{"n":2,"x":38,"y":30,"text":"Double forward pleat, pressed toward center front"},{"n":3,"x":66,"y":40,"text":"Slant side pocket, bartack at mouth (both ends)"},{"n":4,"x":50,"y":72,"text":"Clean-finished inseam, French seam"},{"n":5,"x":52,"y":93,"text":"Blind-hem, 4cm, weighted for drape"}]}',
  2
WHERE EXISTS (SELECT 1 FROM tech_packs WHERE id = 'tp_tangier_v1');
