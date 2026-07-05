-- Migration number: 0002        2026-07-05
-- Maison Atlantique — seed / demo data.
--
-- Supplier leads are RESEARCH/DEMO data (is_verified = 0) and must be
-- verified before commercial use. Duty rules are editable estimates,
-- never legal advice. No user accounts or secrets are seeded here —
-- the admin user is bootstrapped at runtime from ADMIN_EMAIL /
-- ADMIN_INITIAL_PASSWORD (see README "Admin seed login").

-- ---------- Settings ----------
INSERT INTO settings (key, value, description) VALUES
  ('brand_name', 'Maison Atlantique', 'Public display name. Placeholder until brand name is finalized.'),
  ('brand_slug', 'maison-atlantique', 'Internal slug.'),
  ('brand_tagline', 'Tailored resortwear, cut in Casablanca.', 'Public tagline.'),
  ('default_currency', 'USD', 'Default storefront currency.'),
  ('production_home', 'Casablanca, Morocco', 'Primary production hub.');

-- ---------- Roles ----------
INSERT INTO roles (id, name, description) VALUES
  ('admin', 'Administrator', 'Full access to all modules and settings.'),
  ('ops', 'Operations', 'Production, suppliers, samples, tech packs, inventory.'),
  ('viewer', 'Viewer', 'Read-only access to admin modules.');

-- ---------- Collections ----------
INSERT INTO collections (id, slug, name, season, description, editorial_copy, sort_order, is_published) VALUES
  ('col_ss27', 'atlantic-riviera-ss27', 'Atlantic Riviera', 'SS27',
   'The debut collection. Linen tailoring and resort ease for long Atlantic afternoons.',
   'Cut for the hours between noon and dusk — high-waisted linen, draped viscose, and knits the colour of the corniche at low tide. Every piece is tailored in Casablanca by ateliers that still measure twice.',
   1, 1),
  ('col_aw27', 'casablanca-court-aw27', 'Casablanca Court', 'AW27',
   'Brushed wool and deeper tones for the cooler season. Boules-court tailoring, evening navy.',
   'When the light shortens, the cloth deepens. Brushed Portuguese wool, bark browns, and coffee blacks — trousers built for the court and the café after.',
   2, 1);

-- ---------- Suppliers (research/demo leads — verify before use) ----------
INSERT INTO suppliers (id, name, kind, city, country, email, whatsapp, languages, capabilities, moq_units, lead_time_days, is_verified, notes) VALUES
  ('sup_coupe_cousu', 'Atelier Coupe Cousu', 'factory', 'Casablanca', 'MA',
   'contact@example-coupecousu.ma', '+212-6-00-00-00-01',
   '["fr","ar","en"]', '["tailoring","small_batch","designer_collections","trousers","dresses"]',
   150, 45, 0,
   'DEMO LEAD — research only, unverified. Casablanca atelier; small-to-medium runs; strong candidate for pilot trousers and dresses.'),
  ('sup_sinti', 'Sinti', 'factory', 'Casablanca', 'MA',
   'hello@example-sinti.ma', '+212-6-00-00-00-02',
   '["fr","en"]', '["custom","on_demand","prototyping","limited_drops"]',
   20, 21, 0,
   'DEMO LEAD — research only, unverified. Custom/on-demand; good fit for prototypes and small custom runs.'),
  ('sup_hitex', 'HITEX Morocco', 'factory', 'Casablanca', 'MA',
   'sales@example-hitex.ma', NULL,
   '["fr","en"]', '["bulk_production","knits","wovens","export"]',
   500, 75, 0,
   'DEMO LEAD — research only, unverified. Higher MOQ (~500/reference); scale-phase candidate after product-market fit.');

INSERT INTO factories (id, supplier_id, specialty, min_order_units, max_monthly_capacity_units, sample_lead_time_days, bulk_lead_time_days) VALUES
  ('fac_coupe_cousu', 'sup_coupe_cousu', 'Tailored trousers and designer small-batch runs', 150, 2000, 14, 45),
  ('fac_sinti', 'sup_sinti', 'Prototypes, made-to-order, limited drops', 20, 400, 10, 21),
  ('fac_hitex', 'sup_hitex', 'Volume knits and wovens for export', 500, 20000, 21, 75);

INSERT INTO supplier_contacts (id, supplier_id, name, role, email, preferred_language, notes) VALUES
  ('sc_cc_1', 'sup_coupe_cousu', 'Production Manager (TBD)', 'production', 'contact@example-coupecousu.ma', 'fr', 'Placeholder contact — replace after first outreach.'),
  ('sc_si_1', 'sup_sinti', 'Studio Lead (TBD)', 'studio', 'hello@example-sinti.ma', 'fr', 'Placeholder contact.'),
  ('sc_hx_1', 'sup_hitex', 'Sales (TBD)', 'sales', 'sales@example-hitex.ma', 'en', 'Placeholder contact.');

-- ---------- Fabrics ----------
INSERT INTO fabrics (id, name, supplier_id, composition, weight_gsm, origin_country, price_per_meter_cents, currency, lead_time_days, moq_meters, notes) VALUES
  ('fab_spanish_linen', 'Spanish Linen — Sun Weight', NULL, '100% linen', 230, 'ES', 1450, 'EUR', 30, 300,
   'Premium summer tailoring linen. Non-Morocco origin: fails US yarn-forward; EU preferential status depends on cumulation rules.'),
  ('fab_turkish_viscose', 'Turkish Viscose Drape', NULL, '100% viscose', 160, 'TR', 780, 'EUR', 25, 400,
   'Fluid drape for maxi dresses and womens resortwear.'),
  ('fab_moroccan_jersey', 'Moroccan Cotton Jersey', NULL, '100% cotton', 200, 'MA', 620, 'EUR', 20, 250,
   'Local jersey — strongest origin story and best FTA posture.');

-- ---------- Trims ----------
INSERT INTO trims (id, name, spec, price_per_unit_cents, currency, notes) VALUES
  ('trm_corozo_btn', 'Corozo button 20L', 'Natural corozo, matte, 20 ligne', 35, 'EUR', 'Main trouser closure.'),
  ('trm_hook_bar', 'Trouser hook & bar', 'Brass, antiqued', 22, 'EUR', NULL),
  ('trm_main_label', 'Woven main label', 'Cream ground, navy yarn', 18, 'EUR', 'Artwork pending final brand name.');

-- ---------- Styles ----------
INSERT INTO styles (id, style_code, name, category, gender, season, collection_id, status, description, fit_notes, fabric_summary, target_cost_cents, target_retail_cents) VALUES
  ('sty_tangier_trouser', 'MA-M-TRS-001', 'Tangier Trouser', 'trouser', 'mens', 'SS27', 'col_ss27', 'sampling',
   'High-waisted, wide-leg linen trouser. The hero piece — mid-century Casablanca proportions.',
   'Sits at natural waist. Double pleat, generous thigh, gentle taper. Order true waist size.',
   'Spanish sun-weight linen, 230gsm', 5200, 19500),
  ('sty_anfa_trouser', 'MA-M-TRS-002', 'Anfa Trouser', 'trouser', 'mens', 'AW27', 'col_aw27', 'tech_pack',
   'Brushed wool trouser for the cooler season. Same high waist, deeper drape.',
   'High rise, fuller leg than Tangier. Half-lined to knee.',
   'Portuguese brushed wool flannel', 6800, 23500),
  ('sty_corniche_polo', 'MA-M-KNT-003', 'Corniche Polo', 'polo', 'mens', 'SS27', 'col_ss27', 'sampling',
   'Resort knit polo with open collar and fine gauge.',
   'Relaxed through body, sits at hip. Skin-out wear intended.',
   'Fine-gauge cotton knit', 3400, 12500),
  ('sty_medina_overshirt', 'MA-M-SHT-004', 'Medina Overshirt', 'overshirt', 'mens', 'SS27', 'col_ss27', 'design',
   'Linen overshirt / chore hybrid with patch pockets.',
   'Boxy, true to size. Layers over the Corniche Polo.',
   'Spanish linen, garment-washed', 4100, 16500),
  ('sty_saadia_dress', 'MA-W-DRS-005', 'Saadia Maxi Dress', 'dress', 'womens', 'SS27', 'col_ss27', 'sampling',
   'Draped maxi dress in fluid viscose. Clean sensuality, no hardware.',
   'Bias drape, adjustable straps. Between sizes, size down.',
   'Turkish viscose drape, 160gsm', 3900, 14500),
  ('sty_leila_halter', 'MA-W-TOP-006', 'Leila Halter Top', 'top', 'womens', 'SS27', 'col_ss27', 'tech_pack',
   'Halter top with covered button back and shaped hem.',
   'Fitted through bust, skims waist.',
   'Turkish viscose / cotton voile', 2100, 8500),
  ('sty_oualidia_set', 'MA-W-SET-007', 'Oualidia Skirt Set', 'set', 'womens', 'SS27', 'col_ss27', 'design',
   'Two-piece skirt set: wrap column skirt and matching cropped shell.',
   'Skirt sits high on waist. Sold as a set.',
   'Turkish viscose drape', 4600, 16500),
  ('sty_essaouira_crochet', 'MA-W-KNT-008', 'Essaouira Coverup', 'coverup', 'womens', 'SS27', 'col_ss27', 'concept',
   'Open crochet coverup, handworked panels.',
   'One relaxed silhouette; generous through body.',
   'Crochet cotton, Moroccan yarn where available', 4400, 15000);

-- ---------- Colorways ----------
INSERT INTO colorways (id, style_id, name, color_code, is_primary, sort_order) VALUES
  ('cw_tangier_sand', 'sty_tangier_trouser', 'Sand', '#E3D4B4', 1, 1),
  ('cw_tangier_navy', 'sty_tangier_trouser', 'Deep Navy', '#1F2A44', 0, 2),
  ('cw_anfa_bark', 'sty_anfa_trouser', 'Bark', '#5B4636', 1, 1),
  ('cw_corniche_cream', 'sty_corniche_polo', 'Cream', '#F5EEDD', 1, 1),
  ('cw_corniche_olive', 'sty_corniche_polo', 'Olive', '#74744E', 0, 2),
  ('cw_medina_chalk', 'sty_medina_overshirt', 'Chalk', '#FAF7F0', 1, 1),
  ('cw_saadia_terracotta', 'sty_saadia_dress', 'Terracotta', '#C06E52', 1, 1),
  ('cw_saadia_ivory', 'sty_saadia_dress', 'Warm Ivory', '#F8F3E7', 0, 2),
  ('cw_leila_indigo', 'sty_leila_halter', 'Faded Indigo', '#5C6B8A', 1, 1),
  ('cw_oualidia_rose', 'sty_oualidia_set', 'Dusty Rose', '#C4998F', 1, 1),
  ('cw_essaouira_cream', 'sty_essaouira_crochet', 'Cream', '#F5EEDD', 1, 1);

-- ---------- SKUs (hero styles get full runs; others seeded per size) ----------
INSERT INTO skus (id, sku_code, style_id, colorway_id, size) VALUES
  ('sku_tng_snd_30', 'MA-M-TRS-001-SND-30', 'sty_tangier_trouser', 'cw_tangier_sand', '30'),
  ('sku_tng_snd_32', 'MA-M-TRS-001-SND-32', 'sty_tangier_trouser', 'cw_tangier_sand', '32'),
  ('sku_tng_snd_34', 'MA-M-TRS-001-SND-34', 'sty_tangier_trouser', 'cw_tangier_sand', '34'),
  ('sku_tng_nvy_30', 'MA-M-TRS-001-NVY-30', 'sty_tangier_trouser', 'cw_tangier_navy', '30'),
  ('sku_tng_nvy_32', 'MA-M-TRS-001-NVY-32', 'sty_tangier_trouser', 'cw_tangier_navy', '32'),
  ('sku_tng_nvy_34', 'MA-M-TRS-001-NVY-34', 'sty_tangier_trouser', 'cw_tangier_navy', '34'),
  ('sku_anf_brk_32', 'MA-M-TRS-002-BRK-32', 'sty_anfa_trouser', 'cw_anfa_bark', '32'),
  ('sku_cor_crm_m',  'MA-M-KNT-003-CRM-M', 'sty_corniche_polo', 'cw_corniche_cream', 'M'),
  ('sku_med_chk_m',  'MA-M-SHT-004-CHK-M', 'sty_medina_overshirt', 'cw_medina_chalk', 'M'),
  ('sku_saa_ter_s',  'MA-W-DRS-005-TER-S', 'sty_saadia_dress', 'cw_saadia_terracotta', 'S'),
  ('sku_saa_ter_m',  'MA-W-DRS-005-TER-M', 'sty_saadia_dress', 'cw_saadia_terracotta', 'M'),
  ('sku_lei_ind_s',  'MA-W-TOP-006-IND-S', 'sty_leila_halter', 'cw_leila_indigo', 'S'),
  ('sku_oua_ros_s',  'MA-W-SET-007-ROS-S', 'sty_oualidia_set', 'cw_oualidia_rose', 'S'),
  ('sku_ess_crm_os', 'MA-W-KNT-008-CRM-OS', 'sty_essaouira_crochet', 'cw_essaouira_cream', 'OS');

-- ---------- Size spec + measurement points + grading (Tangier Trouser demo) ----------
INSERT INTO size_specs (id, style_id, name, base_size, size_run, unit, notes) VALUES
  ('spec_tangier_v1', 'sty_tangier_trouser', 'SS27 base spec v1', '32', '["28","30","32","34","36"]', 'cm',
   'Measured flat. Waistband relaxed.');

INSERT INTO measurement_points (id, size_spec_id, code, name, how_to_measure, base_value, tolerance, sort_order) VALUES
  ('mp_tng_wb',  'spec_tangier_v1', 'WB',  'Waistband circumference', 'Fasten closure, measure along top edge, relaxed.', 82.0, 1.0, 1),
  ('mp_tng_frise','spec_tangier_v1','FR',  'Front rise', 'Crotch seam to top of waistband along front.', 33.0, 0.5, 2),
  ('mp_tng_thigh','spec_tangier_v1','TH',  'Thigh width', '2.5cm below crotch, straight across.', 36.5, 0.5, 3),
  ('mp_tng_ins', 'spec_tangier_v1', 'INS', 'Inseam', 'Crotch seam to hem along inner leg.', 76.0, 1.0, 4),
  ('mp_tng_hem', 'spec_tangier_v1', 'LO',  'Leg opening', 'Straight across hem.', 24.0, 0.5, 5);

INSERT INTO grading_rules (id, size_spec_id, measurement_point_id, step_value, notes) VALUES
  ('gr_tng_wb', 'spec_tangier_v1', 'mp_tng_wb', 5.0, 'Per full waist size.'),
  ('gr_tng_th', 'spec_tangier_v1', 'mp_tng_thigh', 1.2, NULL),
  ('gr_tng_lo', 'spec_tangier_v1', 'mp_tng_hem', 0.6, NULL);

-- ---------- BOM + care (Tangier Trouser demo) ----------
INSERT INTO bom_items (id, style_id, component, material_type, fabric_id, trim_id, quantity, unit, placement, sort_order) VALUES
  ('bom_tng_shell', 'sty_tangier_trouser', 'Shell fabric', 'fabric', 'fab_spanish_linen', NULL, 1.6, 'm', 'Body', 1),
  ('bom_tng_btn',   'sty_tangier_trouser', 'Waistband button', 'trim', NULL, 'trm_corozo_btn', 1, 'pcs', 'Waistband', 2),
  ('bom_tng_hook',  'sty_tangier_trouser', 'Hook & bar', 'trim', NULL, 'trm_hook_bar', 1, 'pcs', 'Waistband', 3),
  ('bom_tng_label', 'sty_tangier_trouser', 'Main label', 'label', NULL, 'trm_main_label', 1, 'pcs', 'Inner waistband CB', 4);

INSERT INTO care_instructions (id, style_id, wash, bleach, dry, iron, dry_clean, extra_note) VALUES
  ('care_tangier', 'sty_tangier_trouser', 'Machine wash cold, gentle', 'Do not bleach', 'Line dry', 'Warm iron, steam', 'Dry clean recommended for pressed finish', 'Linen softens with wear; creasing is part of the cloth.');

-- ---------- Products ----------
INSERT INTO products (id, slug, style_id, collection_id, name, subtitle, description, editorial_story, gender, category, fabric_composition, care_summary, origin_statement, fit_notes, shipping_note, base_price_cents, availability, is_published, sort_order) VALUES
  ('prod_tangier_trouser', 'tangier-trouser', 'sty_tangier_trouser', 'col_ss27',
   'Tangier Trouser', 'High-waisted linen trouser',
   'Our hero trouser: high-waisted, double-pleated, wide through the leg with a gentle taper. Cut from sun-weight Spanish linen and tailored in Casablanca.',
   'The Tangier is built on proportions borrowed from 1960s Casablanca — trousers made for men who walked the corniche in the evening and never hurried. The rise is honest, the pleats are deep, and the linen is heavy enough to drape rather than crumple.',
   'mens', 'trouser', '100% Spanish linen, 230gsm', 'Machine wash cold or dry clean. Line dry.',
   'Cut and tailored in Casablanca, Morocco.',
   'Sits at the natural waist. Order your true waist size.',
   'Ships from Morocco. EU orders: no import duty expected. US orders: duties included at checkout estimate.',
   19500, 'pre_order', 1, 1),
  ('prod_anfa_trouser', 'anfa-trouser', 'sty_anfa_trouser', 'col_aw27',
   'Anfa Trouser', 'Brushed wool trouser',
   'The cooler-season sibling of the Tangier: brushed Portuguese wool with the same high waist and a deeper drape. Half-lined to the knee.',
   'Named for the hill where Casablanca keeps its quiet money, the Anfa is a winter trouser that refuses heaviness — flannel with movement, tailored for the boules court and the café after.',
   'mens', 'trouser', '100% brushed Portuguese wool', 'Dry clean only.',
   'Cut and tailored in Casablanca, Morocco.',
   'High rise, fuller leg. Order your true waist size.',
   'Ships from Morocco. Duties estimated at checkout.',
   23500, 'draft', 1, 2),
  ('prod_corniche_polo', 'corniche-polo', 'sty_corniche_polo', 'col_ss27',
   'Corniche Polo', 'Resort knit polo',
   'A fine-gauge knit polo with an open collar that lies flat, worn skin-out. The knit is soft enough for noon, structured enough for dinner.',
   'Every Atlantic city has its evening walk. The Corniche is the shirt for it — a knit that holds its collar without asking for a jacket.',
   'mens', 'polo', 'Fine-gauge cotton knit', 'Hand wash cold, dry flat.',
   'Knitted and finished in Morocco.',
   'Relaxed through the body. True to size.',
   'Ships from Morocco. Duties estimated at checkout.',
   12500, 'available', 1, 3),
  ('prod_medina_overshirt', 'medina-overshirt', 'sty_medina_overshirt', 'col_ss27',
   'Medina Overshirt', 'Garment-washed linen overshirt',
   'A linen overshirt with patch pockets, cut boxy and washed soft. The third piece for evenings when the ocean turns the air.',
   'Part chore coat, part shirt — the Medina layers over a knit the way the old city layers over the new: easily, and with better pockets.',
   'mens', 'overshirt', '100% Spanish linen, garment-washed', 'Machine wash cold. Line dry.',
   'Cut and sewn in Casablanca, Morocco.',
   'Boxy fit, true to size.',
   'Ships from Morocco. Duties estimated at checkout.',
   16500, 'available', 1, 4),
  ('prod_saadia_dress', 'saadia-maxi-dress', 'sty_saadia_dress', 'col_ss27',
   'Saadia Maxi Dress', 'Draped viscose maxi',
   'A bias-draped maxi in fluid Turkish viscose with adjustable straps and no hardware. It moves the way resort evenings should.',
   'The Saadia is the dress you wear when the plan is dinner and the reality is dancing. Viscose cut on the bias, straps you can trust, a hem that catches the last light.',
   'womens', 'dress', '100% Turkish viscose, 160gsm', 'Hand wash cold or dry clean.',
   'Cut and sewn in Casablanca, Morocco.',
   'Bias drape. Between sizes, size down.',
   'Ships from Morocco. Duties estimated at checkout.',
   14500, 'pre_order', 1, 5),
  ('prod_leila_halter', 'leila-halter-top', 'sty_leila_halter', 'col_ss27',
   'Leila Halter Top', 'Covered-button halter',
   'A halter top with a covered-button back and a shaped hem that skims the waistband of everything we make.',
   'Clean sensuality is a discipline: one line at the neck, one at the waist, nothing extra. The Leila keeps the discipline.',
   'womens', 'top', 'Viscose–cotton voile', 'Hand wash cold, dry flat.',
   'Cut and sewn in Casablanca, Morocco.',
   'Fitted through the bust. True to size.',
   'Ships from Morocco. Duties estimated at checkout.',
   8500, 'available', 1, 6),
  ('prod_oualidia_set', 'oualidia-skirt-set', 'sty_oualidia_set', 'col_ss27',
   'Oualidia Skirt Set', 'Two-piece column skirt set',
   'A wrap column skirt and matching cropped shell, sold as a set. One decision, two pieces, whole evening.',
   'Named for the lagoon town where the Atlantic slows down. The Oualidia set is what you pack when the itinerary says "one nice dinner" and means four.',
   'womens', 'set', '100% Turkish viscose', 'Hand wash cold or dry clean.',
   'Cut and sewn in Casablanca, Morocco.',
   'Skirt sits high on the waist. True to size.',
   'Ships from Morocco. Duties estimated at checkout.',
   16500, 'available', 1, 7),
  ('prod_essaouira_crochet', 'essaouira-coverup', 'sty_essaouira_crochet', 'col_ss27',
   'Essaouira Coverup', 'Handworked crochet coverup',
   'An open crochet coverup with handworked panels — beach to lunch without apology.',
   'Essaouira is wind, gulls, and blue doors. This coverup is the town in garment form: open-work, unhurried, better with salt in it.',
   'womens', 'coverup', 'Crochet cotton', 'Hand wash cold, dry flat, reshape.',
   'Handworked in Morocco.',
   'One relaxed size philosophy; generous through the body.',
   'Ships from Morocco. Duties estimated at checkout.',
   15000, 'pre_order', 1, 8);

-- ---------- Product images (placeholder art direction slots) ----------
INSERT INTO product_images (id, product_id, url, alt_text, colorway_name, sort_order) VALUES
  ('pi_tng_1', 'prod_tangier_trouser', '/media/placeholder/tangier-sand-1.jpg', 'Tangier Trouser in Sand, front', 'Sand', 1),
  ('pi_tng_2', 'prod_tangier_trouser', '/media/placeholder/tangier-navy-1.jpg', 'Tangier Trouser in Deep Navy, front', 'Deep Navy', 2),
  ('pi_anf_1', 'prod_anfa_trouser', '/media/placeholder/anfa-bark-1.jpg', 'Anfa Trouser in Bark', 'Bark', 1),
  ('pi_cor_1', 'prod_corniche_polo', '/media/placeholder/corniche-cream-1.jpg', 'Corniche Polo in Cream', 'Cream', 1),
  ('pi_med_1', 'prod_medina_overshirt', '/media/placeholder/medina-chalk-1.jpg', 'Medina Overshirt in Chalk', 'Chalk', 1),
  ('pi_saa_1', 'prod_saadia_dress', '/media/placeholder/saadia-terracotta-1.jpg', 'Saadia Maxi Dress in Terracotta', 'Terracotta', 1),
  ('pi_lei_1', 'prod_leila_halter', '/media/placeholder/leila-indigo-1.jpg', 'Leila Halter in Faded Indigo', 'Faded Indigo', 1),
  ('pi_oua_1', 'prod_oualidia_set', '/media/placeholder/oualidia-rose-1.jpg', 'Oualidia Skirt Set in Dusty Rose', 'Dusty Rose', 1),
  ('pi_ess_1', 'prod_essaouira_crochet', '/media/placeholder/essaouira-cream-1.jpg', 'Essaouira Coverup in Cream', 'Cream', 1);

-- ---------- Variants ----------
INSERT INTO product_variants (id, product_id, sku_id, colorway_name, size) VALUES
  ('var_tng_snd_30', 'prod_tangier_trouser', 'sku_tng_snd_30', 'Sand', '30'),
  ('var_tng_snd_32', 'prod_tangier_trouser', 'sku_tng_snd_32', 'Sand', '32'),
  ('var_tng_snd_34', 'prod_tangier_trouser', 'sku_tng_snd_34', 'Sand', '34'),
  ('var_tng_nvy_30', 'prod_tangier_trouser', 'sku_tng_nvy_30', 'Deep Navy', '30'),
  ('var_tng_nvy_32', 'prod_tangier_trouser', 'sku_tng_nvy_32', 'Deep Navy', '32'),
  ('var_tng_nvy_34', 'prod_tangier_trouser', 'sku_tng_nvy_34', 'Deep Navy', '34'),
  ('var_anf_brk_32', 'prod_anfa_trouser', 'sku_anf_brk_32', 'Bark', '32'),
  ('var_cor_crm_s', 'prod_corniche_polo', NULL, 'Cream', 'S'),
  ('var_cor_crm_m', 'prod_corniche_polo', 'sku_cor_crm_m', 'Cream', 'M'),
  ('var_cor_crm_l', 'prod_corniche_polo', NULL, 'Cream', 'L'),
  ('var_med_chk_m', 'prod_medina_overshirt', 'sku_med_chk_m', 'Chalk', 'M'),
  ('var_med_chk_l', 'prod_medina_overshirt', NULL, 'Chalk', 'L'),
  ('var_saa_ter_s', 'prod_saadia_dress', 'sku_saa_ter_s', 'Terracotta', 'S'),
  ('var_saa_ter_m', 'prod_saadia_dress', 'sku_saa_ter_m', 'Terracotta', 'M'),
  ('var_lei_ind_s', 'prod_leila_halter', 'sku_lei_ind_s', 'Faded Indigo', 'S'),
  ('var_lei_ind_m', 'prod_leila_halter', NULL, 'Faded Indigo', 'M'),
  ('var_oua_ros_s', 'prod_oualidia_set', 'sku_oua_ros_s', 'Dusty Rose', 'S'),
  ('var_oua_ros_m', 'prod_oualidia_set', NULL, 'Dusty Rose', 'M'),
  ('var_ess_crm_os', 'prod_essaouira_crochet', 'sku_ess_crm_os', 'Cream', 'OS');

-- ---------- Inventory ----------
INSERT INTO inventory_items (id, variant_id, on_hand, reserved, incoming, low_stock_threshold) VALUES
  ('inv_tng_snd_30', 'var_tng_snd_30', 0, 0, 40, 5),
  ('inv_tng_snd_32', 'var_tng_snd_32', 0, 0, 60, 5),
  ('inv_tng_snd_34', 'var_tng_snd_34', 0, 0, 40, 5),
  ('inv_tng_nvy_30', 'var_tng_nvy_30', 0, 0, 30, 5),
  ('inv_tng_nvy_32', 'var_tng_nvy_32', 0, 0, 40, 5),
  ('inv_tng_nvy_34', 'var_tng_nvy_34', 0, 0, 30, 5),
  ('inv_anf_brk_32', 'var_anf_brk_32', 0, 0, 0, 5),
  ('inv_cor_crm_s', 'var_cor_crm_s', 18, 0, 0, 5),
  ('inv_cor_crm_m', 'var_cor_crm_m', 25, 2, 0, 5),
  ('inv_cor_crm_l', 'var_cor_crm_l', 3, 0, 0, 5),
  ('inv_med_chk_m', 'var_med_chk_m', 12, 0, 0, 5),
  ('inv_med_chk_l', 'var_med_chk_l', 9, 0, 0, 5),
  ('inv_saa_ter_s', 'var_saa_ter_s', 0, 0, 50, 5),
  ('inv_saa_ter_m', 'var_saa_ter_m', 0, 0, 50, 5),
  ('inv_lei_ind_s', 'var_lei_ind_s', 20, 1, 0, 5),
  ('inv_lei_ind_m', 'var_lei_ind_m', 16, 0, 0, 5),
  ('inv_oua_ros_s', 'var_oua_ros_s', 14, 0, 0, 5),
  ('inv_oua_ros_m', 'var_oua_ros_m', 11, 0, 0, 5),
  ('inv_ess_crm_os', 'var_ess_crm_os', 0, 0, 35, 5);

-- ---------- Production stages (from business plan calendar) ----------
INSERT INTO production_stages (id, name, sort_order, description) VALUES
  ('stage_brand_identity', 'Brand identity & design brief', 1, 'Finalize identity, collection brief.'),
  ('stage_ai_concepts', 'AI concept generation', 2, 'Mood boards, AI concepting.'),
  ('stage_3d_simulation', '3D simulation', 3, 'CLO 3D experiments and fit previews.'),
  ('stage_tech_packs', 'Tech packs', 4, 'Complete factory-ready tech packs.'),
  ('stage_factory_briefings', 'Factory briefings', 5, 'Briefings with Casablanca ateliers.'),
  ('stage_fabric_sourcing', 'Fabric sourcing', 6, 'Confirm mills, order sample yardage.'),
  ('stage_sampling', 'Sampling', 7, 'Proto and fit samples.'),
  ('stage_sample_review', 'Sample review & revisions', 8, 'Fit reviews, revision rounds.'),
  ('stage_bulk_production', 'Bulk production', 9, 'Pilot run production.'),
  ('stage_qc', 'Quality control', 10, 'Inline and final QC.'),
  ('stage_shipping', 'Shipping', 11, 'Freight and customs.'),
  ('stage_launch', 'Launch', 12, 'DTC launch and press.');

-- ---------- Season calendar (Month 1 = Aug 2026 ... launch Mar 2027) ----------
INSERT INTO production_calendar_events (id, title, kind, stage_id, starts_on, ends_on, notes) VALUES
  ('cal_identity', 'Brand identity & collection brief', 'window', 'stage_brand_identity', '2026-08-01', '2026-08-31', 'Month 1.'),
  ('cal_concepts', 'AI concepts & mood boards', 'window', 'stage_ai_concepts', '2026-08-10', '2026-09-05', 'Overlaps identity work.'),
  ('cal_techpacks', 'Tech packs & initial costing', 'window', 'stage_tech_packs', '2026-09-01', '2026-09-30', 'Month 2. Supplier outreach in parallel.'),
  ('cal_briefings', 'Casablanca factory briefings', 'milestone', 'stage_factory_briefings', '2026-09-22', NULL, 'On-site if possible.'),
  ('cal_sourcing', 'Fabric sourcing', 'window', 'stage_fabric_sourcing', '2026-10-01', '2026-10-31', 'Month 3.'),
  ('cal_sampling', 'Sampling', 'window', 'stage_sampling', '2026-10-15', '2026-11-20', 'Months 3-4.'),
  ('cal_review', 'Sample review & revisions', 'window', 'stage_sample_review', '2026-11-01', '2026-11-30', 'Month 4.'),
  ('cal_bulk', 'Bulk production (pilot run)', 'window', 'stage_bulk_production', '2026-12-01', '2027-01-31', 'Months 5-6.'),
  ('cal_qc', 'QC & shipping', 'window', 'stage_qc', '2027-02-01', '2027-02-21', 'Month 7.'),
  ('cal_launch_prep', 'Launch prep', 'window', 'stage_launch', '2027-02-10', '2027-02-28', 'Content, PR, pre-order emails.'),
  ('cal_launch', 'SS27 Launch', 'deadline', 'stage_launch', '2027-03-01', NULL, 'Month 8. DTC launch.');

-- ---------- Production tasks ----------
INSERT INTO production_tasks (id, title, stage_id, status, owner, style_id, supplier_id, due_date, risk_flag, notes) VALUES
  ('task_brief_cc', 'Send collection brief to Atelier Coupe Cousu', 'stage_factory_briefings', 'todo', 'Founder', NULL, 'sup_coupe_cousu', '2026-09-20', 0, 'Include Tangier + Saadia tech packs, French summary.'),
  ('task_linen_swatch', 'Order Spanish linen swatch book', 'stage_fabric_sourcing', 'in_progress', 'Founder', 'sty_tangier_trouser', NULL, '2026-08-15', 0, NULL),
  ('task_tangier_proto', 'Tangier Trouser proto sample', 'stage_sampling', 'todo', 'Founder', 'sty_tangier_trouser', 'sup_sinti', '2026-10-30', 0, 'Sinti for speed; production candidate is Coupe Cousu.'),
  ('task_saadia_tp', 'Finish Saadia tech pack grading table', 'stage_tech_packs', 'in_progress', 'Founder', 'sty_saadia_dress', NULL, '2026-09-15', 1, 'Grading rules unconfirmed — risk to sampling start.'),
  ('task_duty_review', 'Verify US yarn-forward posture with customs broker', 'stage_shipping', 'todo', 'Founder', NULL, NULL, '2026-11-15', 1, 'Spanish linen likely fails yarn-forward; model fallback MFN.');

-- ---------- Demo production order ----------
INSERT INTO production_orders (id, po_number, supplier_id, status, currency, total_cost_cents, issue_date, ex_factory_date, incoterms, notes) VALUES
  ('po_pilot_1', 'PO-2027-001', 'sup_coupe_cousu', 'draft', 'EUR', 1560000, NULL, '2027-01-20', 'EXW Casablanca',
   'Pilot run draft — quantities per MOQ discussion (150/style min).');

INSERT INTO production_order_items (id, production_order_id, style_id, description, quantity, unit_cost_cents, currency) VALUES
  ('poi_pilot_tng', 'po_pilot_1', 'sty_tangier_trouser', 'Tangier Trouser — Sand/Navy, sizes 28-36', 240, 4200, 'EUR'),
  ('poi_pilot_saa', 'po_pilot_1', 'sty_saadia_dress', 'Saadia Maxi — Terracotta/Ivory, XS-L', 150, 3300, 'EUR');

-- ---------- Samples ----------
INSERT INTO samples (id, style_id, supplier_id, round, kind, status, requested_at, notes) VALUES
  ('smp_tangier_p1', 'sty_tangier_trouser', 'sup_sinti', 1, 'proto', 'in_review', '2026-10-15', 'First proto received; waistband sits 1cm low.'),
  ('smp_saadia_p1', 'sty_saadia_dress', 'sup_sinti', 1, 'proto', 'requested', '2026-10-20', NULL);

INSERT INTO sample_reviews (id, sample_id, reviewer, fit_rating, make_rating, fabric_rating, decision, comments) VALUES
  ('smr_tangier_p1', 'smp_tangier_p1', 'Founder', 3, 4, 5, 'revise',
   'Raise waistband 1cm; deepen front pleat 0.5cm. Linen hand feel approved.');

-- ---------- Duty rules (ESTIMATES — not legal advice) ----------
INSERT INTO duty_rules (id, name, destination_region, origin_country, hs_category, qualifies_condition, duty_rate_min, duty_rate_max, is_preferential, is_active) VALUES
  ('duty_eu_pref', 'EU preferential — Morocco origin qualifying apparel', 'EU', 'MA', '61/62',
   'Product must satisfy EU-Morocco preferential rules of origin. Editable assumption — verify per style.', 0.0, 0.0, 1, 1),
  ('duty_us_fta', 'US-Morocco FTA — yarn-forward qualifying', 'US', 'MA', '61/62',
   'Yarn-forward: yarn and fabric must be Morocco/US origin. Spanish/Turkish fabric generally does NOT qualify.', 0.0, 0.0, 1, 1),
  ('duty_us_mfn', 'US fallback MFN — non-qualifying apparel', 'US', 'MA', '61/62',
   'Applies when FTA rules of origin are not met. Range varies by HS category.', 0.165, 0.32, 0, 1),
  ('duty_uk_tbd', 'UK — placeholder pending validation', 'UK', 'MA', NULL,
   'UK-Morocco association agreement terms to be validated with a broker.', 0.0, 0.12, 0, 1),
  ('duty_ca_tbd', 'Canada — placeholder pending validation', 'CA', 'MA', NULL,
   'MFN vs GPT eligibility to be validated with a broker.', 0.0, 0.18, 0, 1);

-- ---------- Margin targets ----------
INSERT INTO margin_targets (id, channel, category, target_gross_margin_pct, floor_gross_margin_pct, notes) VALUES
  ('mt_dtc_default', 'dtc', NULL, 68.0, 58.0, 'Brand default for DTC.'),
  ('mt_ws_default', 'wholesale', NULL, 45.0, 38.0, 'Phase 2 wholesale default.');

-- ---------- Cost sheet demo (Tangier Trouser, pilot) ----------
INSERT INTO cost_sheets (id, style_id, name, currency, fabric_cost_cents, trim_cost_cents, cut_sew_make_cents, sample_allocation_cents, packaging_cents, freight_cents, insurance_cents, duty_cents, payment_processing_cents, returns_reserve_cents, target_retail_cents, actual_retail_cents, notes) VALUES
  ('cs_tangier_pilot', 'sty_tangier_trouser', 'SS27 pilot run costing', 'USD',
   2600, 180, 2100, 400, 150, 450, 60, 0, 600, 390, 19500, 19500,
   'EU scenario assumes 0% preferential duty; US scenario overrides duty via landed cost scenarios.');

INSERT INTO landed_cost_scenarios (id, cost_sheet_id, name, destination_region, duty_rule_id, duty_rate_used, freight_cents, insurance_cents, landed_cost_cents, retail_price_cents, gross_margin_pct, notes) VALUES
  ('lcs_tangier_eu', 'cs_tangier_pilot', 'EU DTC (preferential 0%)', 'EU', 'duty_eu_pref', 0.0, 450, 60, 6940, 19500, 64.4,
   'Estimate only — not customs/legal advice.'),
  ('lcs_tangier_us', 'cs_tangier_pilot', 'US DTC (fallback MFN 16.5%)', 'US', 'duty_us_mfn', 0.165, 700, 80, 8010, 19500, 58.9,
   'Spanish linen assumed non-qualifying under yarn-forward. Estimate only — not customs/legal advice.');

-- ---------- Tech packs ----------
INSERT INTO tech_packs (id, style_id, code, name, version, status, season, source, summary) VALUES
  ('tp_tangier_v1', 'sty_tangier_trouser', 'TP-MA-M-TRS-001-v1', 'Tangier Trouser — Tech Pack', 1, 'in_review', 'SS27', 'style',
   'High-waisted double-pleat linen trouser. Base size 32, run 28-36.'),
  ('tp_saadia_v1', 'sty_saadia_dress', 'TP-MA-W-DRS-005-v1', 'Saadia Maxi Dress — Tech Pack', 1, 'draft', 'SS27', 'style',
   'Bias-draped viscose maxi. Base size S, run XS-L. Grading table pending.');

INSERT INTO tech_pack_sections (id, tech_pack_id, kind, title, content_json, sort_order) VALUES
  ('tps_tng_cover', 'tp_tangier_v1', 'cover', 'Cover',
   '{"style_code":"MA-M-TRS-001","style_name":"Tangier Trouser","season":"SS27","brand":"Maison Atlantique","factory":"TBD — Atelier Coupe Cousu (candidate)","date":"2026-09-01"}', 1),
  ('tps_tng_overview', 'tp_tangier_v1', 'style_overview', 'Style Overview',
   '{"description":"High-waisted, double-pleated, wide-leg linen trouser with gentle taper.","fit":"Natural waist, generous thigh","fabric":"Spanish linen 230gsm","colorways":["Sand","Deep Navy"]}', 2),
  ('tps_tng_bom', 'tp_tangier_v1', 'bom', 'Bill of Materials',
   '{"note":"See bom_items for structured rows.","rows":[{"component":"Shell fabric","material":"Spanish linen 230gsm","qty":"1.6 m"},{"component":"Waistband button","material":"Corozo 20L","qty":"1"},{"component":"Hook & bar","material":"Brass","qty":"1"},{"component":"Main label","material":"Woven, cream/navy","qty":"1"}]}', 3),
  ('tps_tng_construction', 'tp_tangier_v1', 'construction', 'Construction Notes',
   '{"rows":[{"area":"Waistband","note":"Curtain waistband, 5cm finished depth. Interlined."},{"area":"Pleats","note":"Double forward pleats, 3.5cm and 2cm depth."},{"area":"Hem","note":"5cm blind hem, no cuff on Sand; 4cm cuff on Navy."}]}', 4),
  ('tps_tng_qc', 'tp_tangier_v1', 'qc_checklist', 'QC Checklist',
   '{"items":["Waistband circumference within ±1cm of spec","Pleat depth symmetrical L/R","Hook & bar aligned, secure","No skipped stitches on visible topstitch","Care + main labels present and level","Press: crease line straight, no shine"]}', 5),
  ('tps_saa_cover', 'tp_saadia_v1', 'cover', 'Cover',
   '{"style_code":"MA-W-DRS-005","style_name":"Saadia Maxi Dress","season":"SS27","brand":"Maison Atlantique","factory":"TBD","date":"2026-09-05"}', 1),
  ('tps_saa_overview', 'tp_saadia_v1', 'style_overview', 'Style Overview',
   '{"description":"Bias-draped maxi dress, adjustable straps, no hardware.","fit":"Bias drape; size down between sizes","fabric":"Turkish viscose 160gsm","colorways":["Terracotta","Warm Ivory"]}', 2);

INSERT INTO construction_notes (id, tech_pack_id, area, note, note_fr, sort_order) VALUES
  ('cn_tng_wb', 'tp_tangier_v1', 'Waistband', 'Curtain waistband, 5cm finished depth, interlined.', 'Ceinture montée type "curtain", profondeur finie 5 cm, entoilée.', 1),
  ('cn_tng_pleat', 'tp_tangier_v1', 'Pleats', 'Double forward pleats: 3.5cm main, 2cm secondary.', 'Double pli vers l''avant : pli principal 3,5 cm, pli secondaire 2 cm.', 2),
  ('cn_tng_hem', 'tp_tangier_v1', 'Hem', '5cm blind hem; 4cm cuff on Navy colorway only.', 'Ourlet invisible 5 cm ; revers 4 cm uniquement pour le coloris marine.', 3);

INSERT INTO stitch_details (id, tech_pack_id, operation, stitch_class, spi, thread, note, sort_order) VALUES
  ('st_tng_side', 'tp_tangier_v1', 'Side seam', '301 lockstitch', '10-11', 'Tex 40 poly-core', 'Pressed open.', 1),
  ('st_tng_hem', 'tp_tangier_v1', 'Hem', '103 blindstitch', '5-6', 'Tex 30', 'No visible stitch on face.', 2);

INSERT INTO labels_packaging (id, tech_pack_id, item, placement, material, note, sort_order) VALUES
  ('lp_tng_main', 'tp_tangier_v1', 'Main label', 'Inner waistband, centered CB', 'Woven, cream ground / navy yarn', 'Artwork pending final brand name.', 1),
  ('lp_tng_care', 'tp_tangier_v1', 'Care label', 'Inside left side seam, 10cm above hem of pocket bag', 'Printed satin', 'EN + FR content required.', 2),
  ('lp_tng_bag', 'tp_tangier_v1', 'Garment bag', 'Folded, tissue-wrapped', 'Recycled kraft + tissue', 'No poly where avoidable.', 3);

-- ---------- AI prompt presets ----------
INSERT INTO ai_prompts (id, name, category, target_tool, prompt_text, is_preset, notes) VALUES
  ('aip_mens_trouser', 'Men''s Casatlantic-style trouser', 'concept', 'midjourney',
   'editorial menswear photograph, high-waisted wide-leg linen trouser in sand, 1960s Casablanca corniche at golden hour, mid-century riviera styling, relaxed tailoring, warm film grain, no logos --ar 4:5', 1, NULL),
  ('aip_mens_knit', 'Men''s resort knit', 'concept', 'midjourney',
   'fine-gauge knit polo, open flat collar, cream, worn at a boules court in Casablanca, evening light, elegant unhurried atmosphere, editorial fashion photo, warm neutrals --ar 4:5', 1, NULL),
  ('aip_womens_maxi', 'Women''s JLUX-style maxi dress', 'concept', 'midjourney',
   'draped viscose maxi dress in terracotta, bias cut, clean sensual silhouette, Atlantic resort terrace, golden hour, editorial photography, accessible luxury, no logos --ar 4:5', 1, NULL),
  ('aip_womens_set', 'Women''s halter / resort set', 'concept', 'midjourney',
   'matching skirt set in dusty rose viscose, halter neckline, resort evening styling, Moroccan coastal architecture background, warm editorial light --ar 4:5', 1, NULL),
  ('aip_atelier_campaign', 'Moroccan atelier editorial campaign', 'concept', 'midjourney',
   'documentary editorial photograph inside a Casablanca tailoring atelier, cutting table, linen bolts, hands chalking a pattern, warm natural window light, dignified craft --ar 3:2', 1, NULL),
  ('aip_fabric_texture', 'Fabric texture exploration', 'concept', 'firefly',
   'macro texture study of heavy sun-washed linen weave in warm ivory, tactile, raking light, high detail', 1, NULL);

-- ---------- AI concepts ----------
INSERT INTO ai_concepts (id, title, brief, prompt_id, style_id, status, rating, tags) VALUES
  ('aic_tangier_hero', 'Tangier hero campaign frame', 'Hero image direction for the launch PDP and homepage.', 'aip_mens_trouser', 'sty_tangier_trouser', 'shortlisted', 4, '["campaign","ss27","menswear"]'),
  ('aic_saadia_terrace', 'Saadia terrace series', 'Terrace-at-dusk series for the Saadia launch story.', 'aip_womens_maxi', 'sty_saadia_dress', 'exploring', 3, '["campaign","ss27","womenswear"]');

-- ---------- 3D simulation placeholder project ----------
INSERT INTO clo3d_projects (id, name, style_id, status, tool, measurements_json, notes) VALUES
  ('c3d_tangier', 'Tangier Trouser — CLO fit study', 'sty_tangier_trouser', 'pattern_needed', 'clo3d',
   '{"base_size":"32","waistband_cm":82,"inseam_cm":76}',
   'Placeholder project. Pattern to be drafted before simulation; fit priorities: rise stance and pleat roll.');

-- ---------- Journal ----------
INSERT INTO journal_posts (id, slug, title, excerpt, body_md, author, published_at, is_published) VALUES
  ('jp_why_casablanca', 'why-casablanca', 'Why Casablanca',
   'The case for making clothes in the city that taught the Atlantic to dress.',
   'There are easier places to make trousers. That was never the question.\n\nCasablanca has ateliers where tailoring is a living trade, not a heritage act — cutting tables that have been in use longer than most brands have existed. We produce here because the clothes are better for it, and because a brand about a place should put its money in that place.\n\nOur pilot runs are small — 150 to 200 pieces per style — made by workshops that measure twice and press properly. It is slower. It is the point.',
   'Maison Atlantique', '2026-08-15', 1),
  ('jp_linen_notes', 'notes-on-linen', 'Notes on Linen',
   'Why our hero trouser is cut from 230gsm Spanish linen, and what the creases mean.',
   'Lightweight linen photographs well and wears badly. We cut the Tangier from a 230gsm Spanish cloth — heavy enough to drape, honest enough to crease.\n\nThe crease is not a flaw. It is a record of the day.',
   'Maison Atlantique', '2026-09-01', 1);

-- ---------- Lookbook ----------
INSERT INTO lookbooks (id, slug, title, season, intro_copy, collection_id, is_published) VALUES
  ('lb_ss27', 'atlantic-riviera-ss27', 'Atlantic Riviera — SS27', 'SS27',
   'Shot between the corniche and the court. Linen, viscose, and the last hour of light.',
   'col_ss27', 1);

INSERT INTO lookbook_images (id, lookbook_id, image_url, caption, sort_order) VALUES
  ('lbi_1', 'lb_ss27', '/media/placeholder/lookbook-ss27-1.jpg', 'Tangier Trouser, Corniche Polo — evening walk.', 1),
  ('lbi_2', 'lb_ss27', '/media/placeholder/lookbook-ss27-2.jpg', 'Saadia Maxi — terrace at dusk.', 2),
  ('lbi_3', 'lb_ss27', '/media/placeholder/lookbook-ss27-3.jpg', 'Oualidia Set — lagoon light.', 3);

-- ---------- Static pages ----------
INSERT INTO pages (id, slug, title, body_md) VALUES
  ('pg_story', 'story', 'Our Story',
   'Maison Atlantique began with a simple observation: the best-dressed hour of the twentieth century happened on the Atlantic coast of Morocco, and almost nobody makes clothes for it anymore.\n\nWe design tailored resortwear — high-waisted trousers, draped dresses, knits with manners — and produce it in Casablanca, in ateliers where the trade never left. Men''s tailoring with mid-century proportions. Women''s pieces with clean, unhurried sensuality. Accessible in price, specific in place.\n\nThe name is a placeholder; the intent is not.'),
  ('pg_atelier', 'atelier', 'The Atelier',
   'Every Maison Atlantique piece is cut and sewn in Casablanca, Morocco.\n\nWe work with small ateliers — workshops of ten to forty people — rather than volume factories. Pilot runs are 150 to 200 pieces per style. Our fabrics travel from Spain (linen), Turkey (viscose), and Morocco itself (cotton jersey); the making happens here.\n\nProduction partners are being finalized for our first season. We publish our production calendar and partner list as they are confirmed.'),
  ('pg_size_guide', 'size-guide', 'Size Guide',
   '## Men''s trousers\n\nOrder your true waist size. The Tangier and Anfa sit at the natural waist — measure at the narrowest point of your torso, not where jeans sit.\n\n| Size | Waist (cm) | Hip (cm) |\n|------|-----------|----------|\n| 30 | 77 | 100 |\n| 32 | 82 | 105 |\n| 34 | 87 | 110 |\n\n## Women''s\n\nBias-cut pieces (Saadia) skim rather than cling; between sizes, size down.\n\n| Size | Bust (cm) | Waist (cm) | Hip (cm) |\n|------|-----------|------------|----------|\n| S | 86 | 68 | 94 |\n| M | 92 | 74 | 100 |\n| L | 98 | 80 | 106 |'),
  ('pg_shipping', 'shipping-returns', 'Shipping & Returns',
   '## Shipping\n\nAll pieces ship from Morocco.\n\n**European Union** — Morocco-origin qualifying apparel is expected to enter the EU without import duty under EU-Morocco trade arrangements. No surprise charges at delivery are expected for qualifying pieces.\n\n**United States** — Duties depend on fabric origin under the US-Morocco FTA. Where a piece does not qualify, we estimate and include applicable duties in checkout pricing.\n\nAll duty statements are estimates, not legal or customs advice.\n\n## Returns\n\nUnworn pieces with labels attached may be returned within 21 days of delivery. Pre-order deposits are refundable until the production cut-off communicated by email.'),
  ('pg_privacy', 'privacy', 'Privacy Policy',
   'PLACEHOLDER — replace with counsel-reviewed policy before launch.\n\nWe collect the minimum data needed to fulfil orders (name, email, shipping address) and to run the waitlist. Payments are processed by Stripe; we never see or store card numbers. We do not sell personal data.'),
  ('pg_terms', 'terms', 'Terms of Service',
   'PLACEHOLDER — replace with counsel-reviewed terms before launch.\n\nAll prices in USD unless stated. Pre-orders are charged at checkout and refundable until the communicated production cut-off. Duty estimates shown at checkout are estimates, not legal advice.'),
  ('pg_stockists', 'stockists', 'Stockists',
   'Maison Atlantique is direct-to-consumer first.\n\nSelective wholesale begins after our first season — European boutiques, Moroccan concept stores, and US resort boutiques. For wholesale inquiries, use the wholesale form on our contact page.');

-- ---------- Integration status placeholders ----------
INSERT INTO integration_credentials_metadata (id, provider, status, note) VALUES
  ('int_stripe', 'stripe', 'not_configured', 'Set STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET via wrangler secret.'),
  ('int_anthropic', 'anthropic', 'not_configured', 'Set ANTHROPIC_API_KEY via wrangler secret.');
