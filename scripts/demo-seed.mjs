/**
 * Demo-shop seed: makes the primary (demo) shop read as an ACTIVE STUDIO —
 * Maison Atlantique, mid SS27 season — across every admin module. Used for
 * the live demo and the KB screenshot pipeline.
 *
 * Generates scripts/demo-seed.sql. Idempotent by construction: every row has
 * a fixed, demo-prefixed id and every statement is INSERT OR REPLACE (plus a
 * few scoped UPDATEs), so re-running refreshes rather than duplicates, and
 * nothing outside these ids is touched.
 *
 * Apply with:  npx wrangler d1 execute DB --remote --file=scripts/demo-seed.sql
 */
import { writeFileSync } from "node:fs";

const q = (s) => (s == null ? "NULL" : `'${String(s).replaceAll("'", "''")}'`);
const stmts = [];
const ins = (table, cols, rows) => {
  for (const r of rows) {
    stmts.push(
      `INSERT OR REPLACE INTO ${table} (${cols.join(", ")}) VALUES (${r
        .map((v) => (typeof v === "number" ? v : q(v)))
        .join(", ")});`,
    );
  }
};

// ---------------------------------------------------------------------------
// Materials — cloth with origins (origin drives duty math in cost sheets).
// ---------------------------------------------------------------------------
ins(
  "fabrics",
  ["id", "name", "supplier_id", "composition", "weight_gsm", "origin_country", "price_per_meter_cents", "currency", "lead_time_days", "moq_meters", "notes"],
  [
    ["fab_demo_libeco", "Libeco heritage linen", null, "100% linen", 240, "BE", 1850, "EUR", 28, 100, "The Tangier Trouser cloth. Softens beautifully after two washes."],
    ["fab_demo_poplin", "Somelos cotton poplin", null, "100% long-staple cotton", 120, "PT", 950, "EUR", 21, 150, "Corniche Polo collar stand + Medina Overshirt."],
    ["fab_demo_terry", "Atlas loop-back terry", "sup_coupe_cousu", "95% cotton / 5% elastane", 320, "MA", 720, "EUR", 14, 200, "Knitted in Casablanca — short lead, our workhorse."],
    ["fab_demo_crepe", "Bursa viscose crepe", null, "100% viscose", 180, "TR", 640, "EUR", 25, 300, "Saadia Maxi — the drape the whole dress depends on."],
    ["fab_demo_chambray", "Kurabo 4.5oz chambray", null, "100% cotton, indigo warp", 150, "JP", 2100, "EUR", 45, 80, "Leila Halter SS27 colourway. Worth the wait, watch the MOQ."],
    ["fab_demo_crochet", "Giza mercerised crochet yarn", null, "100% Egyptian cotton", null, "EG", 480, "EUR", 30, 250, "Essaouira Coverup — sold per cone, 480 = per 100g."],
    ["fab_demo_canvas", "Marrakech slub canvas", "sup_ma_ateliermarrakech", "80% cotton / 20% hemp", 280, "MA", 830, "EUR", 18, 120, "Oualidia Skirt Set body. Yarn-forward qualifies under US GSP review."],
  ],
);
ins(
  "trims",
  ["id", "name", "supplier_id", "spec", "price_per_unit_cents", "currency", "notes"],
  [
    ["trm_demo_corozo", "Corozo buttons 18L", null, "Natural corozo, dyed navy, 18 ligne", 38, "EUR", "Tangier + Medina. Corozo reads premium next to linen."],
    ["trm_demo_zip", "YKK Excella zip 18cm", null, "Antique brass, closed-end", 145, "EUR", "Oualidia skirt. Excella only — the teeth are jewellery."],
    ["trm_demo_label", "Woven main label", null, "Damask weave, 60x18mm, chalk on navy", 22, "EUR", "Porto mill, ships with care labels in the same box."],
    ["trm_demo_drawcord", "Braided drawcord 6mm", "sup_coupe_cousu", "Ecru cotton braid, waxed tips", 55, "EUR", "Anfa Trouser waist."],
    ["trm_demo_elastic", "Soft-hand elastic 30mm", null, "Plush-back, 30mm", 60, "EUR", "Oualidia waistband — the plush back is the whole point."],
  ],
);

// ---------------------------------------------------------------------------
// Suppliers — the four researched Moroccan makers the narrative leans on.
// These exist in the primary shop from real R&D imports but NOT in the demo
// DO's base catalog (0002), and later rows reference them by foreign key —
// the seed must be self-contained. Then promote the long-standing partners.
// ---------------------------------------------------------------------------
ins(
  "suppliers",
  ["id", "name", "kind", "city", "country", "email", "phone", "website", "capabilities", "moq_units", "lead_time_days", "is_verified", "notes"],
  [
    ["sup_ma_ateliermarrakech", "Atelier de Marrakech", "factory", "Marrakech", "MA", "atelierdemarrakech1@gmail.com", "+212 662 357 549", "https://atelierdemarrakech.com/", '["tailoring","cut_and_sew","private_label","small_batch"]', null, null, 1, "Real researched maker. Custom tailoring/confection studio, no stated minimum; design, pattern-making, fabric, labeling, packaging. Source: atelierdemarrakech.com"],
    ["sup_ma_cotexma", "Cotexma (Atelier Expert Couture Textile Maroc)", "factory", "Mohammedia", "MA", null, null, "https://atelierexpertcouturetextilemaroc.com/", '["wovens","tailoring","cut_and_sew","private_label","small_batch"]', null, null, 0, "Real researched maker. Specialist in small-quantity textile confection for launching brands and limited capsule collections; online from pattern CAD through prototyping. Source: atelierexpertcouturetextilemaroc.com"],
    ["sup_ma_flores", "Flores Confecciones", "factory", "Tangier", "MA", "flores.majd@floresconfecciones.com", "+212 539 951 164", "https://floresconfecciones.com/en/home/", '["wovens","knits","tailoring","cut_and_sew","private_label"]', null, null, 0, "Real researched maker. Specialties: soft wovens, jersey, tailoring; full collection design and development concept-to-delivery. Source: floresconfecciones.com"],
    ["sup_ma_vita", "Vita Couture SARL", "factory", "Tangier", "MA", "contact@vita-couture.com", "+212 5 39 39 26 53", "https://www.vita-couture.com/", '["wovens","tailoring","cut_and_sew","private_label"]', null, null, 1, "Real researched maker. Full-package woven garment supplier (concept to finished product, Barcelona design office); design, fabric sourcing, QC. Skews to larger programs. Source: vita-couture.com"],
  ],
);
stmts.push(`UPDATE suppliers SET is_verified = 1 WHERE id IN ('sup_coupe_cousu','sup_ma_ateliermarrakech','sup_ma_vita');`);
ins(
  "supplier_interactions",
  ["id", "supplier_id", "kind", "direction", "subject", "summary", "follow_up_due", "needs_response", "created_at"],
  [
    ["six_demo_01", "sup_coupe_cousu", "email", "outbound", "PO-2026-003 confirmation", "Sent the confirmed PO with the size breakdown. Asked for revised ex-factory after the Eid closure.", null, 0, "2026-06-24 09:12:00"],
    ["six_demo_02", "sup_coupe_cousu", "email", "inbound", "Re: PO-2026-003 confirmation", "Ex-factory confirmed 22 Aug. Terry greige already booked with the mill.", null, 0, "2026-06-25 15:40:00"],
    ["six_demo_03", "sup_ma_ateliermarrakech", "whatsapp", "inbound", "Saadia fit sample photos", "Sent photos of the fit round on their house form — waist stay looks right, hem still breaks 2cm long.", "2026-07-13", 1, "2026-07-09 18:05:00"],
    ["six_demo_04", "sup_ma_vita", "visit", "outbound", "Tangier factory visit", "Walked the line with Souad. Buttonhole density fixed since proto; agreed PP sample before bulk cut.", null, 0, "2026-06-17 11:00:00"],
    ["six_demo_05", "sup_ma_vita", "quote", "inbound", "Oualidia set CMT quote", "CMT at 61 MAD/set for 300 sets, 54 at 500. Zip insertion included, pressing extra.", "2026-07-14", 1, "2026-07-10 10:22:00"],
    ["six_demo_06", "sup_hitex", "email", "outbound", "Crochet capacity for October", "Asked whether the handwork cooperative can take 400 coverups for cruise. Awaiting confirmation.", null, 0, "2026-07-06 08:45:00"],
    ["six_demo_07", "sup_ma_flores", "call", "outbound", "Chambray allocation", "Reserved 90m of the Kurabo chambray through their Tangier agent; invoice to follow.", null, 0, "2026-07-02 16:30:00"],
    ["six_demo_08", "sup_ma_ateliermarrakech", "sample_feedback", "outbound", "Saadia fit round notes", "Sent annotated photos: raise armhole 8mm, ease waist dart 4mm, hem -20mm. Round 3 requested.", null, 0, "2026-07-10 09:15:00"],
    ["six_demo_09", "sup_coupe_cousu", "email", "inbound", "Terry lab dips", "Lab dips for Deep Navy and Sand attached. Navy is a half-shade warm — resubmitting Tuesday.", null, 0, "2026-07-08 13:55:00"],
    ["six_demo_10", "sup_ma_cotexma", "email", "outbound", "Intro + Anfa Trouser brief", "Introduced the studio, shared the Anfa tech pack for a second-source CMT quote.", null, 0, "2026-07-07 10:05:00"],
  ],
);

// ---------------------------------------------------------------------------
// Tech packs — every style carries its spec; statuses tell the season story.
// ---------------------------------------------------------------------------
ins(
  "tech_packs",
  ["id", "style_id", "code", "name", "version", "status", "season", "source", "summary"],
  [
    ["tp_demo_anfa", "sty_anfa_trouser", "TP-MA-M-TRS-002-v2", "Anfa Trouser", 2, "approved", "SS27", "style", "Relaxed drawcord trouser in slub canvas. v2 fixes the pocket-bag twist from proto."],
    ["tp_demo_corniche", "sty_corniche_polo", "TP-MA-M-PLO-003-v1", "Corniche Polo", 1, "sent_to_factory", "SS27", "style", "Terry polo, one-piece collar. Sent to Casablanca with the lab-dip references."],
    ["tp_demo_medina", "sty_medina_overshirt", "TP-MA-M-OSH-004-v1", "Medina Overshirt", 1, "approved", "SS27", "style", "Poplin overshirt, corozo front, split yoke."],
    ["tp_demo_leila", "sty_leila_halter", "TP-MA-W-HAL-006-v1", "Leila Halter Top", 1, "in_review", "SS27", "style", "Chambray halter — bias neck band under review after the drape test."],
    ["tp_demo_oualidia", "sty_oualidia_set", "TP-MA-W-SET-007-v1", "Oualidia Skirt Set", 1, "approved", "SS27", "style", "Two-piece: elastic-back skirt + cropped shell in slub canvas."],
    ["tp_demo_essaouira", "sty_essaouira_crochet", "TP-MA-W-CRO-008-v1", "Essaouira Coverup", 1, "draft", "Cruise 27", "style", "Hand-crochet coverup. Spec drafted; stitch diagrams pending the cooperative's gauge swatch."],
  ],
);

// ---------------------------------------------------------------------------
// Samples — the ladder in motion across the line.
// ---------------------------------------------------------------------------
ins(
  "samples",
  ["id", "style_id", "supplier_id", "round", "kind", "status", "requested_at", "received_at", "notes"],
  [
    ["smp_demo_tng_fit", "sty_tangier_trouser", "sup_ma_vita", 2, "fit", "approved", "2026-05-28", "2026-06-12", "Fit approved on the 32. Rise sits exactly on the tech pack line."],
    ["smp_demo_tng_pp", "sty_tangier_trouser", "sup_ma_vita", 3, "pp", "approved", "2026-06-18", "2026-07-02", "PP approved — buttonhole density corrected. Cleared for bulk cut."],
    ["smp_demo_saa_fit", "sty_saadia_dress", "sup_ma_ateliermarrakech", 2, "fit", "revisions_needed", "2026-06-20", "2026-07-08", "Armhole 8mm high, waist dart pulls, hem breaks long. Round 3 requested."],
    ["smp_demo_cor_proto", "sty_corniche_polo", "sup_coupe_cousu", 1, "proto", "approved", "2026-06-02", "2026-06-16", "Collar roll is right first try. Terry weight confirmed at 320gsm."],
    ["smp_demo_cor_sms", "sty_corniche_polo", "sup_coupe_cousu", 2, "sms", "in_review", "2026-06-24", "2026-07-09", "Salesman samples in both colourways — Navy lab dip half-shade warm."],
    ["smp_demo_anfa_proto", "sty_anfa_trouser", "sup_ma_vita", 1, "proto", "approved", "2026-05-15", "2026-06-01", "Pocket bag twist noted and fixed in tech pack v2."],
    ["smp_demo_anfa_fit", "sty_anfa_trouser", "sup_ma_cotexma", 2, "fit", "shipped", "2026-06-30", null, "Second-source fit sample — DHL AWB 774-2211 8837, due Monday."],
    ["smp_demo_med_proto", "sty_medina_overshirt", "sup_ma_vita", 1, "proto", "received", "2026-06-25", "2026-07-10", "Arrived yesterday. Review booked for Monday's fit session."],
    ["smp_demo_lei_proto", "sty_leila_halter", "sup_ma_flores", 1, "proto", "requested", "2026-07-05", null, "Awaiting chambray delivery to Tangier before cutting."],
    ["smp_demo_oua_pp", "sty_oualidia_set", "sup_ma_vita", 3, "pp", "in_progress", "2026-07-01", null, "PP under way alongside the CMT quote sharpening."],
  ],
);

// ---------------------------------------------------------------------------
// Purchase orders — money committed, at every lifecycle stage.
// ---------------------------------------------------------------------------
ins(
  "production_orders",
  ["id", "po_number", "supplier_id", "status", "currency", "total_cost_cents", "issue_date", "ex_factory_date", "received_date", "incoterms", "notes"],
  [
    ["po_demo_002", "PO-2026-002", "sup_ma_vita", "in_production", "EUR", 1093500, "2026-06-20", "2026-08-22", null, "FOB Tanger Med", "Tangier Trouser bulk — both colourways. PP approved 2 Jul."],
    ["po_demo_003", "PO-2026-003", "sup_coupe_cousu", "confirmed", "EUR", 630000, "2026-06-24", "2026-08-29", null, "FOB Casablanca", "Corniche Polo first run. Navy lab dip resubmission due before cut."],
    ["po_demo_004", "PO-2026-004", "sup_ma_ateliermarrakech", "sent", "EUR", 425000, "2026-07-08", "2026-09-12", null, "EXW Marrakech", "Saadia Maxi pilot — contingent on fit round 3 approval."],
    ["po_demo_005", "PO-2026-005", "sup_ma_vita", "received", "EUR", 258000, "2026-04-14", "2026-06-05", "2026-06-11", "FOB Tanger Med", "Anfa Trouser pilot run of 120 — reconciled, 2 seconds."],
    ["po_demo_006", "PO-2026-006", "sup_hitex", "draft", "EUR", 312000, null, "2026-10-15", null, "FOB Casablanca", "Essaouira Coverup cruise run — drafted from the approved sample automation."],
  ],
);
ins(
  "production_order_items",
  ["id", "production_order_id", "style_id", "description", "quantity", "unit_cost_cents", "currency", "size_breakdown"],
  [
    ["poi_demo_002a", "po_demo_002", "sty_tangier_trouser", "Tangier Trouser — Sand", 250, 2430, "EUR", '{"30":60,"32":110,"34":80}'],
    ["poi_demo_002b", "po_demo_002", "sty_tangier_trouser", "Tangier Trouser — Deep Navy", 200, 2430, "EUR", '{"30":50,"32":90,"34":60}'],
    ["poi_demo_003a", "po_demo_003", "sty_corniche_polo", "Corniche Polo — Cream", 350, 1800, "EUR", '{"S":90,"M":160,"L":100}'],
    ["poi_demo_004a", "po_demo_004", "sty_saadia_dress", "Saadia Maxi — Terracotta pilot", 170, 2500, "EUR", '{"S":70,"M":100}'],
    ["poi_demo_005a", "po_demo_005", "sty_anfa_trouser", "Anfa Trouser — Bark pilot", 120, 2150, "EUR", '{"32":120}'],
    ["poi_demo_006a", "po_demo_006", "sty_essaouira_crochet", "Essaouira Coverup — Cream", 400, 780, "EUR", '{"OS":400}'],
  ],
);

// ---------------------------------------------------------------------------
// Production board — tasks across the season's stages.
// ---------------------------------------------------------------------------
ins(
  "production_tasks",
  ["id", "title", "stage_id", "status", "owner", "style_id", "supplier_id", "production_order_id", "due_date", "completed_at", "risk_flag", "notes"],
  [
    ["task_demo_01", "Approve Saadia fit round 3", "stage_sample_review", "in_progress", "Amina", "sty_saadia_dress", "sup_ma_ateliermarrakech", null, "2026-07-18", null, 1, "PO-2026-004 is gated on this — atelier holding capacity until the 20th."],
    ["task_demo_02", "Navy terry lab dip re-approval", "stage_fabric_sourcing", "in_progress", "Amina", "sty_corniche_polo", "sup_coupe_cousu", "po_demo_003", "2026-07-15", null, 1, "Half-shade warm. Cut date slips if not closed this week."],
    ["task_demo_03", "Chase PO-2026-002 ex-factory", "stage_bulk_production", "todo", "Yousef", "sty_tangier_trouser", "sup_ma_vita", "po_demo_002", "2026-08-22", null, 0, "Filed automatically when the order was confirmed."],
    ["task_demo_04", "Inline QC visit — Tangier bulk", "stage_qc", "todo", "Yousef", "sty_tangier_trouser", "sup_ma_vita", "po_demo_002", "2026-08-05", null, 0, "Book the Tanger Med trip alongside the Vita PP review."],
    ["task_demo_05", "Gauge swatch from crochet cooperative", "stage_sampling", "todo", "Claire", "sty_essaouira_crochet", "sup_hitex", null, "2026-07-25", null, 0, "Blocks the stitch diagrams in the cruise tech pack."],
    ["task_demo_06", "Medina proto review — Monday fit session", "stage_sample_review", "todo", "Amina", "sty_medina_overshirt", "sup_ma_vita", null, "2026-07-14", null, 0, null],
    ["task_demo_07", "Reserve October crochet capacity", "stage_factory_briefings", "in_progress", "Claire", "sty_essaouira_crochet", "sup_hitex", "po_demo_006", "2026-07-20", null, 0, "400 units for cruise; cooperative confirms after Eid."],
    ["task_demo_08", "Oualidia CMT quote decision", "stage_factory_briefings", "todo", "Yousef", "sty_oualidia_set", "sup_ma_vita", null, "2026-07-16", null, 0, "61 vs 54 MAD/set — decide run size with the cash-flow view open."],
    ["task_demo_09", "Ship SMS set to Paris showroom", "stage_launch", "todo", "Claire", "sty_corniche_polo", null, null, "2026-07-22", null, 0, "Both colourways plus the Tangier PP pair."],
    ["task_demo_10", "Reconcile PO-2026-005 delivery", "stage_qc", "done", "Yousef", "sty_anfa_trouser", "sup_ma_vita", "po_demo_005", "2026-06-13", "2026-06-12 17:20:00", 0, "118 firsts, 2 seconds — stock updated."],
    ["task_demo_11", "Update Anfa tech pack to v2", "stage_tech_packs", "done", "Amina", "sty_anfa_trouser", null, null, "2026-06-08", "2026-06-06 11:02:00", 0, "Pocket-bag twist fix from proto."],
    ["task_demo_12", "Leila chambray delivery to Tangier", "stage_fabric_sourcing", "in_progress", "Yousef", "sty_leila_halter", "sup_ma_flores", null, "2026-07-17", null, 0, "90m reserved; agent invoicing this week."],
    ["task_demo_13", "SS27 lookbook shot list", "stage_launch", "todo", "Claire", null, null, null, "2026-08-01", null, 0, "Essaouira location scout — golden hour on the ramparts."],
  ],
);
ins(
  "production_calendar_events",
  ["id", "title", "kind", "stage_id", "starts_on", "ends_on", "style_id", "supplier_id", "notes"],
  [
    ["cal_demo_01", "Tangier bulk window", "window", "stage_bulk_production", "2026-07-14", "2026-08-22", "sty_tangier_trouser", "sup_ma_vita", null],
    ["cal_demo_02", "Paris showroom week", "milestone", "stage_launch", "2026-09-02", "2026-09-06", null, null, "SMS sets must land by 28 Aug."],
    ["cal_demo_03", "Cruise 27 line freeze", "deadline", "stage_tech_packs", "2026-08-15", null, null, null, null],
  ],
);

// ---------------------------------------------------------------------------
// Client book + commissions — the bespoke lane, mid-flight.
// ---------------------------------------------------------------------------
ins(
  "clients",
  ["id", "name", "email", "phone", "style_notes", "status"],
  [
    ["cli_demo_amira", "Amira El Fassi", "amira.elfassi@example.com", "+212 661-234567", "Prefers high closed necklines, no visible zips. Warm palette — terracotta, saffron.", "active"],
    ["cli_demo_claire", "Claire Fontaine", "claire.fontaine@example.com", "+33 6 12 34 56 78", "Paris gallery director. Sharp tailoring, always trousers, 90s YSL references.", "active"],
    ["cli_demo_sofia", "Sofia Marchetti", "sofia.marchetti@example.com", "+39 340 123 4567", "Bias-cut everything. Bringing her mother's vintage silk for the anniversary dress.", "active"],
    ["cli_demo_nadia", "Nadia Benjelloun", "nadia.b@example.com", "+212 662-998877", "Wedding season regular — three events this autumn. Loves the Saadia silhouette.", "active"],
    ["cli_demo_ines", "Inès Laurent", "ines.laurent@example.com", "+33 7 88 99 00 11", "First commission. Found us through the Corniche Polo. Wants a linen suit for Arles.", "active"],
    ["cli_demo_yasmine", "Yasmine Tazi", "yasmine.tazi@example.com", "+212 663-445566", "Petite grading — everything shortened 4cm from the block. Keeps a standing quarterly order.", "active"],
    ["cli_demo_marcus", "Marcus Webb", "marcus.webb@example.com", "+44 7700 900123", "London architect. Two Medina overshirts a year, always Chalk, always M-long.", "active"],
    ["cli_demo_leonor", "Leonor Duarte", "leonor.duarte@example.com", "+351 912 345 678", "Archived after relocation — kept measurements on file at her request.", "archived"],
  ],
);
ins(
  "client_measurements",
  ["id", "client_id", "taken_at", "measurements_json", "note"],
  [
    ["cm_demo_amira", "cli_demo_amira", "2026-05-20 10:00:00", '{"chestCm":92,"waistCm":74,"hipsCm":101,"heightCm":168,"shoulderToShoulderCm":39,"shoulderToWristCm":56,"inseamCm":76,"seatCm":103}', "Taken at spring consult — allow for the September fitting."],
    ["cm_demo_claire", "cli_demo_claire", "2026-06-11 14:30:00", '{"chestCm":88,"waistCm":70,"hipsCm":96,"heightCm":175,"shoulderToShoulderCm":41,"shoulderToWristCm":59,"inseamCm":82,"waistToFloorCm":108}', "Trouser block confirmed against the Tangier 32."],
    ["cm_demo_sofia", "cli_demo_sofia", "2026-06-28 11:15:00", '{"chestCm":95,"waistCm":78,"hipsCm":104,"heightCm":163,"shoulderToShoulderCm":38,"neckCm":34}', "Bias work — took the full set standing and seated."],
    ["cm_demo_yasmine", "cli_demo_yasmine", "2026-04-02 09:45:00", '{"chestCm":84,"waistCm":66,"hipsCm":92,"heightCm":155,"shoulderToShoulderCm":36,"shoulderToWristCm":52,"inseamCm":68}', "Petite block -4cm confirmed. Re-measure in October."],
    ["cm_demo_marcus", "cli_demo_marcus", "2026-03-15 16:00:00", '{"chestCm":104,"waistCm":88,"heightCm":186,"shoulderToShoulderCm":47,"shoulderToWristCm":64,"neckCm":41,"bicepsCm":33}', "M-long torso confirmed — +3cm body length on the overshirt block."],
  ],
);
ins(
  "commissions",
  ["id", "client_id", "title", "kind", "stage", "style_id", "brief_md", "due_at", "price_cents", "client_approved_at"],
  [
    ["com_demo_gala", "cli_demo_amira", "Saffron gala kaftan", "commission", "fitting", "sty_saadia_dress", "Floor-length kaftan off the Saadia block. Saffron crepe, closed neckline, hand-finished sfifa braid at cuffs.\n\nEvent: Fondation gala, **26 Sep**.", "2026-09-18", 340000, "2026-06-02 12:00:00"],
    ["com_demo_suit", "cli_demo_claire", "Ivory linen trouser suit", "commission", "cutting", "sty_tangier_trouser", "Two-piece in the Libeco linen — Tangier trouser base with a strong-shoulder jacket. No lining below the yoke.", "2026-08-30", 420000, "2026-06-20 10:00:00"],
    ["com_demo_anniv", "cli_demo_sofia", "Anniversary bias dress (heirloom silk)", "commission", "design", null, "Rebuild of her mother's 1968 dress in the client's own silk — 4.2m available, zero remnant tolerance. Toile first in matched-weight crepe.", "2026-10-10", 280000, null],
    ["com_demo_wedding", "cli_demo_nadia", "Wedding-guest set — October", "commission", "fabric", "sty_oualidia_set", "Oualidia set in dusty rose with a longer midi skirt and matching stole. Second of three autumn events.", "2026-10-02", 190000, "2026-07-05 17:30:00"],
    ["com_demo_arles", "cli_demo_ines", "Arles linen suit", "commission", "consult", null, "First consult booked — relaxed linen suit for the July festival next year. Photographs of references received.", "2027-06-15", null, null],
    ["com_demo_hem", "cli_demo_yasmine", "Anfa trouser re-hem + waist", "alteration", "delivery", "sty_anfa_trouser", "Standing quarterly alteration — take the new pair to her block: -4cm hem, -1cm waist.", "2026-07-15", 9500, "2026-07-01 09:00:00"],
  ],
);
ins(
  "commission_payments",
  ["id", "commission_id", "label", "amount_cents", "status", "paid_at", "note"],
  [
    ["cpay_demo_01", "com_demo_gala", "Deposit (50%)", 170000, "paid", "2026-06-03 09:21:00", null],
    ["cpay_demo_02", "com_demo_suit", "Deposit (50%)", 210000, "paid", "2026-06-21 14:02:00", null],
    ["cpay_demo_03", "com_demo_suit", "Balance", 210000, "requested", null, "Requested at cutting — due before final fitting."],
    ["cpay_demo_04", "com_demo_wedding", "Deposit (50%)", 95000, "paid", "2026-07-06 11:47:00", null],
    ["cpay_demo_05", "com_demo_hem", "Alteration fee", 9500, "requested", null, null],
  ],
);
ins(
  "client_events",
  ["id", "client_id", "kind", "subject", "body_md", "event_at", "commission_id"],
  [
    ["cev_demo_01", "cli_demo_amira", "fitting", "First fitting — kaftan toile", "Toile fits through the shoulder; neckline sits exactly as briefed. Sleeve length +1cm. Second fitting 4 Sep.", "2026-07-08 15:00:00", "com_demo_gala"],
    ["cev_demo_02", "cli_demo_claire", "consult", "Jacket shoulder direction", "Compared three shoulder references — settled on the soft-roped look. Cutting starts once canvas arrives.", "2026-07-03 11:00:00", "com_demo_suit"],
    ["cev_demo_03", "cli_demo_sofia", "note", "Heirloom silk received", "4.2m received and photographed. Two small water marks noted at the selvage — cutting plan will avoid.", "2026-07-09 10:30:00", "com_demo_anniv"],
    ["cev_demo_04", "cli_demo_ines", "consult", "First consult", "Showed the Libeco linen and the Tangier fit. She wants trousers slightly cropped — booking measurements next week.", "2026-07-10 16:30:00", "com_demo_arles"],
  ],
);
ins(
  "booking_requests",
  ["id", "name", "email", "note", "preferred_at", "status", "client_id", "created_at"],
  [
    ["bkg_demo_01", "Inès Laurent", "ines.laurent@example.com", "Measurement session for the Arles suit", "2026-07-17 15:00:00", "new", "cli_demo_ines", "2026-07-10 18:20:00"],
    ["bkg_demo_02", "Amira El Fassi", "amira.elfassi@example.com", "Second kaftan fitting", "2026-09-04 14:00:00", "confirmed", "cli_demo_amira", "2026-07-08 15:30:00"],
    ["bkg_demo_03", "New enquiry — Rim A.", "rim.a@example.com", "Interested in a made-to-measure Medina overshirt as a gift", "2026-07-21 10:00:00", "new", null, "2026-07-11 08:05:00"],
    ["bkg_demo_04", "Marcus Webb", "marcus.webb@example.com", "Autumn overshirt pair — usual spec", "2026-07-19 09:30:00", "confirmed", "cli_demo_marcus", "2026-07-07 12:00:00"],
  ],
);

// ---------------------------------------------------------------------------
// Storefront: customers + orders over the last eight weeks. Integer cents;
// totals = subtotal + tax + shipping − discount, always.
// ---------------------------------------------------------------------------
const CUSTOMERS = [
  ["cus_demo_01", "elena.rodriguez@example.com", "Elena Rodríguez", "ES", 1],
  ["cus_demo_02", "james.okafor@example.com", "James Okafor", "GB", 1],
  ["cus_demo_03", "haruka.sato@example.com", "Haruka Sato", "JP", 0],
  ["cus_demo_04", "marie.dubois@example.com", "Marie Dubois", "FR", 1],
  ["cus_demo_05", "david.chen@example.com", "David Chen", "US", 1],
  ["cus_demo_06", "fatima.alaoui@example.com", "Fatima Alaoui", "MA", 1],
  ["cus_demo_07", "lucas.meyer@example.com", "Lucas Meyer", "DE", 0],
  ["cus_demo_08", "sarah.goldberg@example.com", "Sarah Goldberg", "US", 1],
  ["cus_demo_09", "pieter.vandenberg@example.com", "Pieter van den Berg", "NL", 1],
  ["cus_demo_10", "chiara.russo@example.com", "Chiara Russo", "IT", 0],
  ["cus_demo_11", "emma.lindqvist@example.com", "Emma Lindqvist", "SE", 1],
  ["cus_demo_12", "omar.benali@example.com", "Omar Benali", "MA", 0],
];
ins("customers", ["id", "email", "name", "country", "marketing_opt_in"], CUSTOMERS);

// [variant, product, unitCents]
const V = {
  tng_snd_32: ["var_tng_snd_32", "prod_tangier_trouser", 19500],
  tng_nvy_32: ["var_tng_nvy_32", "prod_tangier_trouser", 19500],
  tng_nvy_34: ["var_tng_nvy_34", "prod_tangier_trouser", 19500],
  cor_crm_m: ["var_cor_crm_m", "prod_corniche_polo", 12500],
  cor_crm_l: ["var_cor_crm_l", "prod_corniche_polo", 12500],
  med_chk_m: ["var_med_chk_m", "prod_medina_overshirt", 16500],
  med_chk_l: ["var_med_chk_l", "prod_medina_overshirt", 16500],
  saa_ter_s: ["var_saa_ter_s", "prod_saadia_dress", 14500],
  saa_ter_m: ["var_saa_ter_m", "prod_saadia_dress", 14500],
  lei_ind_s: ["var_lei_ind_s", "prod_leila_halter", 8500],
  lei_ind_m: ["var_lei_ind_m", "prod_leila_halter", 8500],
  oua_ros_m: ["var_oua_ros_m", "prod_oualidia_set", 16500],
  ess_crm_os: ["var_ess_crm_os", "prod_essaouira_crochet", 15000],
  anf_brk_32: ["var_anf_brk_32", "prod_anfa_trouser", 23500],
};

// [n, customer, placedAt, items[[key,qty]], shipCents, taxPct, discountCents, payStatus, fulfillment, country]
const ORDERS = [
  [1001, "cus_demo_01", "2026-05-19 10:14:00", [["saa_ter_m", 1], ["lei_ind_m", 1]], 1800, 0, 0, "paid", "delivered", "ES"],
  [1002, "cus_demo_05", "2026-05-24 18:40:00", [["tng_nvy_32", 1]], 2200, 8, 0, "paid", "delivered", "US"],
  [1003, "cus_demo_02", "2026-05-28 09:03:00", [["cor_crm_m", 2]], 1500, 0, 0, "paid", "delivered", "GB"],
  [1004, "cus_demo_04", "2026-06-02 14:22:00", [["oua_ros_m", 1]], 1200, 0, 0, "paid", "delivered", "FR"],
  [1005, "cus_demo_08", "2026-06-05 21:10:00", [["saa_ter_s", 1], ["ess_crm_os", 1]], 2200, 8, 2950, "paid", "delivered", "US"],
  [1006, "cus_demo_06", "2026-06-09 11:31:00", [["med_chk_m", 1]], 0, 0, 0, "paid", "delivered", "MA"],
  [1007, "cus_demo_03", "2026-06-12 07:55:00", [["tng_snd_32", 1], ["cor_crm_m", 1]], 2600, 0, 0, "paid", "shipped", "JP"],
  [1008, "cus_demo_09", "2026-06-15 16:47:00", [["anf_brk_32", 1]], 1500, 0, 0, "paid", "delivered", "NL"],
  [1009, "cus_demo_10", "2026-06-19 12:18:00", [["lei_ind_s", 2]], 1500, 0, 0, "paid", "delivered", "IT"],
  [1010, "cus_demo_07", "2026-06-22 19:02:00", [["med_chk_l", 1], ["tng_nvy_34", 1]], 1800, 0, 0, "paid", "shipped", "DE"],
  [1011, "cus_demo_11", "2026-06-26 08:44:00", [["ess_crm_os", 1]], 1500, 0, 0, "paid", "shipped", "SE"],
  [1012, "cus_demo_05", "2026-06-28 22:05:00", [["cor_crm_l", 1], ["tng_snd_32", 1]], 2200, 8, 0, "paid", "processing", "US"],
  [1013, "cus_demo_01", "2026-07-01 10:52:00", [["oua_ros_m", 1], ["lei_ind_m", 1]], 1800, 0, 0, "paid", "processing", "ES"],
  [1014, "cus_demo_12", "2026-07-03 15:36:00", [["cor_crm_m", 1]], 0, 0, 0, "paid", "shipped", "MA"],
  [1015, "cus_demo_04", "2026-07-05 09:27:00", [["saa_ter_m", 2]], 1200, 0, 0, "paid", "processing", "FR"],
  [1016, "cus_demo_08", "2026-07-07 20:19:00", [["med_chk_m", 1]], 2200, 8, 0, "paid", "processing", "US"],
  [1017, "cus_demo_02", "2026-07-08 13:41:00", [["tng_nvy_32", 1], ["cor_crm_m", 1]], 1500, 0, 3200, "paid", "unfulfilled", "GB"],
  [1018, "cus_demo_03", "2026-07-09 06:58:00", [["lei_ind_s", 1]], 2600, 0, 0, "paid", "unfulfilled", "JP"],
  [1019, "cus_demo_11", "2026-07-10 17:23:00", [["saa_ter_s", 1]], 1500, 0, 0, "pending", "unfulfilled", "SE"],
  [1020, "cus_demo_09", "2026-07-10 21:44:00", [["ess_crm_os", 1], ["oua_ros_m", 1]], 1500, 0, 0, "paid", "unfulfilled", "NL"],
];

for (const [n, cust, placed, items, ship, taxPct, disc, pay, ful, country] of ORDERS) {
  const subtotal = items.reduce((s, [k, qty]) => s + V[k][2] * qty, 0);
  const tax = Math.round((subtotal * taxPct) / 100);
  const total = subtotal + tax + ship - disc;
  const oid = `ord_demo_${n}`;
  const email = CUSTOMERS.find((c) => c[0] === cust)[1];
  ins(
    "orders",
    ["id", "order_number", "customer_id", "email", "currency", "subtotal_cents", "tax_cents", "shipping_cents", "discount_cents", "total_cents", "payment_status", "fulfillment_status", "shipping_country", "promotion_code", "placed_at", "created_at", "updated_at"],
    [[oid, `MA-${n}`, cust, email, "USD", subtotal, tax, ship, disc, total, pay, ful, country, disc > 0 ? "SUMMER10" : null, placed, placed, placed]],
  );
  items.forEach(([k, qty], i) => {
    const [variant, product, unit] = V[k];
    ins(
      "order_items",
      ["id", "order_id", "product_id", "variant_id", "description", "quantity", "unit_price_cents", "currency"],
      [[`oit_demo_${n}_${i}`, oid, product, variant, k.replaceAll("_", " "), qty, unit, "USD"]],
    );
  });
  if (pay === "paid") {
    ins(
      "payments",
      ["id", "order_id", "amount_cents", "currency", "status", "method_summary", "created_at"],
      [[`pay_demo_${n}`, oid, total, "USD", "succeeded", "card •••• 4242", placed]],
    );
  }
}

// ---------------------------------------------------------------------------
// Cost sheets — the money story behind two more styles.
// ---------------------------------------------------------------------------
ins(
  "cost_sheets",
  ["id", "style_id", "name", "currency", "fabric_cost_cents", "trim_cost_cents", "cut_sew_make_cents", "sample_allocation_cents", "packaging_cents", "freight_cents", "insurance_cents", "duty_cents", "payment_processing_cents", "returns_reserve_cents", "target_retail_cents", "actual_retail_cents", "notes"],
  [
    ["cst_demo_corniche", "sty_corniche_polo", "Corniche Polo — US landed", "USD", 1290, 210, 1980, 240, 160, 410, 45, 780, 390, 250, 12500, 12500, "Terry from Casablanca keeps freight short; duty is the biggest lever."],
    ["cst_demo_saadia", "sty_saadia_dress", "Saadia Maxi — EU landed", "USD", 1150, 180, 2750, 320, 160, 280, 40, 0, 450, 290, 14500, 14500, "EU-Morocco association agreement — zero duty with EUR.1 certificate."],
  ],
);

// ---------------------------------------------------------------------------
// Activity feed — what the automations noticed lately (newest last).
// ---------------------------------------------------------------------------
ins(
  "activity_events",
  ["id", "kind", "entity_type", "entity_id", "title", "payload", "created_at"],
  [
    ["aev_demo_01", "po.status.received", "production_order", "po_demo_005", "PO-2026-005 received from Vita Couture SARL", '{"status":"received","poNumber":"PO-2026-005","supplierName":"Vita Couture SARL"}', "2026-06-11 14:20:00"],
    ["aev_demo_02", "sample.approved", "sample", "smp_demo_cor_proto", "Corniche Polo proto approved", '{"styleId":"sty_corniche_polo","styleName":"Corniche Polo","supplierId":"sup_coupe_cousu","supplierName":"YB Company","round":1,"status":"approved"}', "2026-06-16 10:05:00"],
    ["aev_demo_03", "po.status.confirmed", "production_order", "po_demo_002", "PO-2026-002 confirmed with Vita Couture SARL", '{"status":"confirmed","poNumber":"PO-2026-002","supplierName":"Vita Couture SARL"}', "2026-06-25 15:45:00"],
    ["aev_demo_04", "commission.stage_changed", "commission", "com_demo_suit", "Ivory linen trouser suit moved to cutting", '{"stage":"cutting","title":"Ivory linen trouser suit","clientName":"Claire Fontaine"}', "2026-07-04 09:30:00"],
    ["aev_demo_05", "sample.approved", "sample", "smp_demo_tng_pp", "Tangier Trouser PP approved", '{"styleId":"sty_tangier_trouser","styleName":"Tangier Trouser","supplierId":"sup_ma_vita","supplierName":"Vita Couture SARL","round":3,"status":"approved"}', "2026-07-02 11:12:00"],
    ["aev_demo_06", "sample.status_changed", "sample", "smp_demo_saa_fit", "Saadia Maxi fit sample needs revisions", '{"styleId":"sty_saadia_dress","styleName":"Saadia Maxi Dress","round":2,"status":"revisions_needed"}', "2026-07-08 16:40:00"],
    ["aev_demo_07", "research.maker_promoted", "supplier", "sup_ma_cotexma", "Cotexma promoted from R&D into Factories & Suppliers", '{"supplierName":"Cotexma (Atelier Expert Couture Textile Maroc)"}', "2026-07-07 09:58:00"],
    ["aev_demo_08", "commission.stage_changed", "commission", "com_demo_gala", "Saffron gala kaftan moved to fitting", '{"stage":"fitting","title":"Saffron gala kaftan","clientName":"Amira El Fassi"}', "2026-07-08 15:10:00"],
    ["aev_demo_09", "po.status.sent", "production_order", "po_demo_004", "PO-2026-004 sent to Atelier de Marrakech", '{"status":"sent","poNumber":"PO-2026-004","supplierName":"Atelier de Marrakech"}', "2026-07-08 17:25:00"],
    ["aev_demo_10", "sample.status_changed", "sample", "smp_demo_med_proto", "Medina Overshirt proto received", '{"styleId":"sty_medina_overshirt","styleName":"Medina Overshirt","round":1,"status":"received"}', "2026-07-10 12:33:00"],
  ],
);

// ---------------------------------------------------------------------------
// R&D studio — the research rooms mid-flight: makers under evaluation, cited
// notes, a watched brand dossier, a decided price study feeding costing, a
// trend board being weighed, and a stockist pipeline with one door in talks.
// ---------------------------------------------------------------------------
ins(
  "research_makers",
  ["id", "name", "market", "location", "website", "email", "speciality", "min_order", "lead_time", "price_unit", "about", "best_use", "status", "topic"],
  [
    ["rmaker_demo_01", "Atlas Knit Coop", "Morocco", "Marrakech, Morocco", "atlasknit.example.com", "hello@atlasknit.example.com", "Hand crochet & artisan knits", "50-200 (managed)", "6-8 wks", "$18-32", "Women's cooperative doing hand crochet and chunky knits; gauge swatches on request.", "Cruise crochet program if the Essaouira coverup scales.", "sampling", "Knitwear"],
    ["rmaker_demo_02", "Porto Fino Malhas", "Portugal", "Barcelos, Portugal", "portofinomalhas.example.pt", "geral@portofinomalhas.example.pt", "Fine-gauge knitwear", "100/style", "4-6 wks sample", "EUR 22-38", "Family knitting mill, fully-fashioned programs, GOTS cotton yarns in stock.", "AW28 knit capsule if we go fine-gauge.", "contacted", "Knitwear"],
    ["rmaker_demo_03", "Tanger Denim Works", "Morocco", "Tangier, Morocco", "tangerdenim.example.com", null, "Denim & heavy twill", "300/style", "8-10 wks", "$14-19", "Laser finishing and ozone wash in-house; mostly EU high-street contracts.", "Only if a denim line ever happens — MOQ is steep for us.", "researching", "Denim"],
    ["rmaker_demo_04", "Studio Lisboa Amostras", "Portugal", "Lisbon, Portugal", "lisboaamostras.example.pt", "studio@lisboaamostras.example.pt", "Sampling & small runs", "1-50 (managed)", "2-3 wks sample", "EUR 45-70", "Sample room that also does micro-runs; strong on fluid viscose and silk.", "Fast proto partner for the Saadia line when Casablanca is at capacity.", "approved", "Sampling"],
  ],
);
ins(
  "research_notes",
  ["id", "title", "body_md", "topic", "tags", "citations", "kind", "pinned"],
  [
    ["rnote_demo_01", "Linen sourcing — Belgian vs Portuguese mills", "## The short version\n\nBelgian linen (Libeco) reads as the quality story our customer expects, but Portuguese mills within two hours of our Tangier makers cut freight and lead time nearly in half.\n\n- Libeco: heritage story, 320gsm suiting weight, ~EUR 24/m at our volumes\n- Fielpor (Guimaraes): comparable hand, ~EUR 16/m, 3 wk delivery\n- Keep Libeco for hero pieces, move volume styles to Portuguese cloth\n\nDecision parked until the SS28 fabric budget is set.", "Fabrics", '["linen","mills","sourcing"]', '["https://www.libeco.com","https://european-flax.com"]', "search", 1],
    ["rnote_demo_02", "Wholesale timing — cruise buying windows", "Buyers for US resort doors write cruise orders **June through August** for November delivery. If we want Corniche Polo and Saadia Maxi in boutiques for Cruise 27 we need line sheets out by mid-June and PP samples photographed before Eid.\n\nShowroom option: join a Paris showroom for the January window instead — lower risk, later cash.", "Wholesale", '["cruise","buying-calendar"]', "[]", "note", 0],
  ],
);
ins(
  "research_brands",
  ["id", "name", "website", "instagram", "segment", "positioning", "price_floor_cents", "price_ceiling_cents", "currency", "channels", "dossier_md", "citations", "watch", "last_researched_at"],
  [
    ["rbrand_demo_01", "Marrakshi Life", "marrakshilife.com", "@marrakshilife", "direct", "Hand-woven Moroccan atelier wear, unisex, hotel-boutique darling.", 18500, 68000, "USD", '["dtc","wholesale"]', "## Positioning\nHand-woven-in-Marrakech atelier label selling artisanal ease to design-literate travellers; strong hotel and concept-store presence.\n\n## Price architecture\nWoven shirting $185-295, dresses and robes $340-480, outerwear to $680.\n\n## Channels & stockists\nDTC plus tight wholesale: concept stores and five-star hotel boutiques rather than department doors.\n\n## Recent moves\nLeaning into made-to-order and studio visits; steady drumbeat of hotel collaborations.\n\n## Read for an independent label\n- Their loom story earns the premium — our tailoring story must be equally concrete.\n- Hotel boutiques are a viable early wholesale lane in Morocco.\n- They under-serve tailored silhouettes; that is our gap.", '["https://marrakshilife.com","https://www.instagram.com/marrakshilife"]', 1, "2026-07-06 08:03:00"],
    ["rbrand_demo_02", "LemLem", "lemlem.com", "@lemlem", "aspirational", "Artisan-made resortwear at scale — proof the category supports real price ceilings.", 16000, 55000, "USD", '["dtc","wholesale","marketplace"]', null, "[]", 0, null],
    ["rbrand_demo_03", "Zeus+Dione", "zeusndione.com", "@zeusndione", "adjacent", "Greek craft-luxury resort house; adjacent geography, same customer on a different island.", 22000, 90000, "USD", '["dtc","wholesale"]', null, "[]", 0, null],
  ],
);
ins(
  "price_studies",
  ["id", "name", "category", "market", "style_id", "currency", "band_low_cents", "band_mid_cents", "band_high_cents", "recommendation_md", "citations", "status", "last_researched_at"],
  [
    ["pstudy_demo_01", "Linen maxi dress", "Linen maxi dress", "US direct-to-consumer", "sty_saadia_dress", "USD", 12500, 17500, 26500, "## Recommendation\nThe contemporary band for artisanal linen maxis sits $125-265; brands with a making story (Marrakshi Life, LemLem) hold $165-245 without discounting. With Belgian linen and Casablanca tailoring, **$145 target retail** sits confidently mid-band while protecting a wholesale margin at 2.3x.", '["https://marrakshilife.com","https://lemlem.com"]', "decided", "2026-07-03 10:12:00"],
    ["pstudy_demo_02", "Terry polo", "Cotton terry polo", "US direct-to-consumer", "sty_corniche_polo", "USD", 9500, 12500, 18500, null, "[]", "open", null],
  ],
);
ins(
  "price_study_comps",
  ["id", "study_id", "brand", "product", "price_cents", "currency", "url", "fabric", "origin"],
  [
    ["pcomp_demo_01", "pstudy_demo_01", "Marrakshi Life", "Woven maxi dress", 42000, "USD", "https://marrakshilife.com", "Hand-woven cotton", "Morocco"],
    ["pcomp_demo_02", "pstudy_demo_01", "LemLem", "Makeda maxi", 24500, "USD", "https://lemlem.com", "Cotton blend", "Ethiopia"],
    ["pcomp_demo_03", "pstudy_demo_01", "Reformation", "Linen maxi", 17800, "USD", "https://thereformation.com", "European linen", "Turkey"],
    ["pcomp_demo_04", "pstudy_demo_01", "Quince", "100% linen maxi", 6990, "USD", "https://quince.com", "European linen", "China"],
    ["pcomp_demo_05", "pstudy_demo_01", "Posse", "Emma linen dress", 26000, "USD", "https://posse.com", "French linen", "China"],
  ],
);
ins(
  "trend_boards",
  ["id", "title", "season", "focus", "brief_md", "citations", "items", "status", "watch", "last_researched_at"],
  [
    ["tboard_demo_01", "Fluid tailoring", "SS27", "silhouettes", "## The direction\nSoft-shoulder jackets and wide, pressed-crease trousers in fluid wovens — tailoring language without the armour.\n\n## Who's showing it\nConsistent across The Row, Toteme and Saint Laurent resort; filtering into contemporary via St. Agni and Rohe.\n\n## Materials & making\nFluid viscose-linen blends, sand-washed cupro, heavier silk twill. Our Tangier trouser block already speaks this language.\n\n## Wear it forward\n- Cut the Tangier trouser in the Kurabo chambray for a softer read\n- One soft blazer, not a suiting program\n- Press creases, no shoulder-pad tooling needed", '["https://www.vogue.com/fashion-shows"]', '[{"label":"soft-shoulder blazer"},{"label":"wide pressed-crease trouser"},{"label":"sand-washed cupro"}]', "exploring", 1, "2026-07-05 07:44:00"],
    ["tboard_demo_02", "Crochet revival", "Cruise 27", "fabrics", null, "[]", '[{"label":"open-work crochet coverups"},{"label":"raffia accents"}]', "exploring", 0, null],
  ],
);
ins(
  "research_stockists",
  ["id", "name", "kind", "city", "country", "website", "email", "brands_carried", "price_point", "fit_note", "status", "last_researched_at"],
  [
    ["rstock_demo_01", "Le 66 Concept", "boutique", "Marrakech", "Morocco", "le66concept.example.com", "buyer@le66concept.example.com", "Marrakshi Life, local ateliers, French resort labels", "contemporary", "Two blocks from the hotel cluster; buyer already carries our direct comp.", "in_talks", "2026-06-28 09:30:00"],
    ["rstock_demo_02", "Riad Yima Boutique", "boutique", "Marrakech", "Morocco", "riadyima.example.com", null, "Artisan-made resortwear, homeware, local designers", "contemporary", "Small but the right crowd; good first consignment door.", "stocked", null],
    ["rstock_demo_03", "Beldi Country Club Boutique", "boutique", "Marrakech", "Morocco", "beldicountryclub.example.com", null, "Artisan-made resortwear, homeware", "advanced contemporary", "Hotel boutique — exactly the Marrakshi Life lane; pitch after PP photography.", "shortlist", null],
    ["rstock_demo_04", "Couverture & The Garbstore", "boutique", "London", "UK", "couvertureandthegarbstore.com", null, "Rohe, Cawley, Studio Nicholson", "advanced contemporary", "Stretch door for AW28 — needs the fluid tailoring story to land first.", "researching", null],
  ],
);
ins(
  "activity_events",
  ["id", "kind", "entity_type", "entity_id", "title", "payload", "created_at"],
  [
    ["aev_demo_11", "research.brand_refreshed", "research_brand", "rbrand_demo_01", "Watched brand refreshed: Marrakshi Life — see what changed in R&D", '{"name":"Marrakshi Life"}', "2026-07-06 08:03:00"],
    ["aev_demo_12", "research.retail_applied", "cost_sheet", "cst_demo_saadia", "Target retail for Saadia Maxi Dress set from the Linen maxi dress price study", '{"styleId":"sty_saadia_dress","retail":14500}', "2026-07-03 10:20:00"],
  ],
);

const sql = `-- Demo-shop seed (generated by scripts/demo-seed.mjs — edit that, not this).\n-- Idempotent: fixed demo-prefixed ids, INSERT OR REPLACE throughout.\n\n${stmts.join("\n")}\n`;
writeFileSync("scripts/demo-seed.sql", sql);
console.log(`wrote scripts/demo-seed.sql — ${stmts.length} statements`);
