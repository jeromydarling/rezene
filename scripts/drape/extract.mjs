/**
 * Drape extraction — FreeSewing draft → sewable piece geometry.
 *
 * Drafts the garment with the shop's measurements (falling back to the
 * studio's standard set) + quick-fit options, walks each piece's `seam` path
 * into polylines (mm), mirrors cut-on-fold pieces, and emits a pieces.json
 * the Blender sim consumes: pieces as closed point loops built from NAMED
 * SEGMENTS (so seam correspondence is exact point-index pairs, resampled to
 * matching counts), plus 3D placement hints and body-scale hints for the
 * ghost mannequin.
 *
 * Supported blocks (all Brian-family, so they share anchor names):
 *   classic-tee (Teagan)  front/back/sleeves, sewn armscyes
 *   aaron (Aaron tank)    front/back only, armholes are free edges
 *   relaxed-hoodie (Sven) front/back/long cuffed sleeves
 *   hugo (Hugo raglan)    raglan seams to the neckline; hood not simulated
 *   simon / simone        button-downs: two front panels pinned shut at the
 *                         buttons, back + yoke; collar not simulated
 *   huey (zip hoodie)     two front halves pinned at the CF zip; hood and
 *                         ribbed waistband not simulated
 *   slip-dress (Sophie)   bias slip, top edge pinned; straps not simulated
 *   wahid (waistcoat)     buttoned CF, waist darts sewn shut, sleeveless
 *   wide-trouser (Titan)  leg tubes + hip sweep on the lower-body mannequin
 *   pleated-skirt (Penelope) pencil skirt on the hip column, waist pinned
 *   paco (Paco)           summer trousers on the Titan topology
 *   charlie (Charlie)     chinos; slant-pocket corner restored, waistband-grip rise pin
 *   sandy (Sandy)         circle skirt: one ring sector, polar "circle" wrap
 *   bella (Bella)         foundation bodice; waist + side bust darts sewn
 *   yuri (Yuri)           zipless crossover hoodie: overlapping wrap fronts,
 *                         button-pinned diagonal opening; hood/gussets described
 *   walburga (Walburga)   tabard: two kite-hemmed panels joined only at the
 *                         shoulders, sides open by design
 *   carlton (Carlton)     the Sherlock coat: double-breasted fronts, waist
 *                         seam to a pleated tail, tailored two-piece sleeves
 *   carlita (Carlita)     Carlton's women's cut (side-panel body)
 *   uma (Uma)             briefs: hip-wrapped panels + crotch gusset on the
 *                         "brief" body (pinched fork keel, parted thighs)
 *   shin (Shin)           swim trunks: Titan leg topology, hip-slung anchor,
 *                         elastic waistband described not simulated
 *
 * Usage: node scripts/drape/extract.mjs '{"block":"classic-tee","easePct":8,"lengthPct":-12,"sleevePct":-25,"measurements":{"chest":1080}}' out/pieces.json
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const spec = JSON.parse(process.argv[2] ?? "{}");
const outPath = process.argv[3] ?? "pieces.json";

const BLOCKS = {
  "classic-tee": {
    module: "@freesewing/teagan",
    fabric: "knit",
    design: "Teagan",
    parts: { front: "teagan.front", back: "teagan.back", sleeve: "teagan.sleeve" },
    sleeveAnchors: { hemL: "hemLeft", hemR: "hemRight" },
    // At its true (longer) default length the tee's chest contact tunnels
    // through the standard 3 mm collision shell; its short loose sleeves
    // tolerate the thicker shell that long snug tubes can't.
    sim: { shellMm: 6 },
  },
  aaron: {
    module: "@freesewing/aaron",
    fabric: "knit",
    design: "Aaron",
    parts: { front: "aaron.front", back: "aaron.back" },
    // A tank's "shoulder seam" is the strap top; the Brian `shoulder` point
    // isn't on Aaron's outline at all.
    bodyAnchors: { armTop: "strapRight", neckSide: "strapLeft" },
  },
  "relaxed-hoodie": {
    module: "@freesewing/sven",
    fabric: "knit",
    design: "Sven",
    parts: { front: "sven.front", back: "sven.back", sleeve: "sven.sleeve" },
    sleeveAnchors: { hemL: "wristLeft", hemR: "wristRight" },
    cuffed: true, // ribbed cuffs grip the wrist — the sim pins the sleeve hems
    sim: { bending: 1.5 },
  },
  hugo: {
    module: "@freesewing/hugo",
    fabric: "knit",
    design: "Hugo",
    parts: { front: "hugo.front", back: "hugo.back", sleeve: "hugo.sleeve" },
    sleeveAnchors: { hemL: "wristLeft", hemR: "wristRight" },
    cuffed: true,
    // Raglan: no shoulder seam — the sleeve runs to the neckline and the
    // raglan seam replaces both shoulder seam and armscye. The hood is NOT
    // simulated; the text description carries it, the sim carries the body.
    raglan: true,
    sim: { bending: 1.5 },
  },
  simon: {
    module: "@freesewing/simon",
    design: "Simon",
    // Button-front: two separate front panels pinned closed at the placket,
    // back + yoke assembly, buttoned cuffs. Collar and collar stand are NOT
    // simulated — the description carries them (same honesty as Hugo's hood).
    buttonFront: true,
    parts: {
      frontR: "simon.frontRight",
      frontL: "simon.frontLeft",
      back: "simon.back",
      yoke: "simon.yoke",
      sleeve: "simon.sleeve",
    },
    sleeveAnchors: { hemL: "wristLeft", hemR: "wristRight" },
    cuffed: true,
    // At the true (shirt-tail) default length the heavier panels strain the
    // armscye springs open — stitch harder than the default force 2.
    sim: { sewForce: 4, bending: 1.5 },
  },
  simone: {
    module: "@freesewing/simone",
    design: "Simone",
    // Simone (women's button-down) drafts into the same simon.* part names.
    buttonFront: true,
    parts: {
      frontR: "simon.frontRight",
      frontL: "simon.frontLeft",
      back: "simon.back",
      yoke: "simon.yoke",
      sleeve: "simon.sleeve",
    },
    sleeveAnchors: { hemL: "wristLeft", hemR: "wristRight" },
    cuffed: true,
    sim: { sewForce: 4, bending: 1.5 },
  },
  huey: {
    module: "@freesewing/huey",
    fabric: "knit",
    design: "Huey",
    // Zip-up hoodie: two mirrored front halves whose CF zip edges are pinned
    // shut (a zip tape is rigid, unlike buttons), cut-on-fold back, set-in
    // sleeves with ribbed cuffs. Hood and ribbed waistband are described,
    // not simulated — the body hem is the ribbing attachment line.
    zipFront: true,
    parts: { front: "huey.front", back: "huey.back", sleeve: "huey.sleeve" },
    sleeveAnchors: { hemL: "wristLeft", hemR: "wristRight" },
    cuffed: true,
    // The side seams pull each front half outward; the zip springs need the
    // same firmer stitch as the button-downs to hold CF fully shut.
    sim: { sewForce: 4, bending: 1.5 },
  },
  yuri: {
    module: "@freesewing/yuri",
    fabric: "knit",
    design: "Yuri",
    // Zipless crossover sweater (based on Huey): two FULL front panels whose
    // opening edges sweep diagonally past CF — they overlap like a wrap
    // cardigan and button shut. Hood and underarm gussets are described,
    // not simulated (the gusset is a comfort diamond; its absence just
    // leaves the sim's usual underarm join).
    crossFront: true,
    parts: { front: "yuri.front", back: "yuri.back", sleeve: "yuri.sleeve" },
    sleeveAnchors: { hemL: "wristLeft", hemR: "wristRight" },
    cuffed: true,
    // Heavy overlapping knit panels need the button-down stitch.
    sim: { sewForce: 4, bending: 1.5 },
  },
  walburga: {
    module: "@freesewing/walburga",
    design: "Walburga",
    // Tabard (Wappenrock): two kite-hemmed panels joined ONLY at the
    // shoulders — the sides hang open by design (it is worn over garments,
    // often belted). The simplest construction in the catalogue.
    tabard: true,
    parts: { front: "walburga.front", back: "walburga.back" },
  },
  "slip-dress": {
    module: "@freesewing/sophie",
    design: "Sophie",
    // Bias slip dress: front/back panels cut on fold, top edge pinned at
    // chest height (straps come from the description, like collars/hoods).
    dressPanels: true,
    parts: { front: "sophie.frontPanel", back: "sophie.backPanel" },
    yOffset: 350, // pattern y=0 sits ~mid-torso; +350 = body coords (HPS=0)
    sim: { shellMm: 6 }, // long heavy panels tunnel a 3 mm shell (no sleeves to harm)
  },
  wahid: {
    module: "@freesewing/wahid",
    design: "Wahid",
    // Waistcoat: one front part cut twice (mirrored), buttoned CF, waist
    // darts sewn shut in the sim, sleeveless. Lapel-less V neck.
    waistcoat: true,
    parts: { front: "wahid.front", back: "wahid.back" },
    sim: { sewForce: 5 }, // darts must close against the side-seam pull
  },
  "wide-trouser": {
    module: "@freesewing/titan",
    design: "Titan",
    // Trousers: front + back drafted once, cut twice (mirrored per leg).
    // Panels wrap half-tubes around the leg stubs, sweeping onto the hip
    // shell above the fork; the waist is pinned (belt/waistband grip).
    trousers: true,
    parts: { front: "titan.front", back: "titan.back" },
    yOffset: 460,
    bodyKind: "lower",
  },
  "pleated-skirt": {
    module: "@freesewing/penelope",
    design: "Penelope",
    // Pencil skirt: front/back on fold, waist darts pinned flat under the
    // (described) waistband, hem vent left as drafted.
    skirt: true,
    parts: { front: "penelope.front", back: "penelope.back" },
    yOffset: 460,
    bodyKind: "lowerColumn",
  },
  paco: {
    module: "@freesewing/paco",
    design: "Paco",
    // Summer trousers on the Titan draft: same panel topology, so the leg
    // machinery applies verbatim. The elastic waist/cuffs are described, not
    // simulated (same honesty as collars and hoods).
    trousers: true,
    parts: { front: "paco.front", back: "paco.back" },
    yOffset: 460,
    bodyKind: "lower",
  },
  sandy: {
    module: "@freesewing/sandy",
    design: "Sandy",
    // Circle skirt: ONE ring-sector piece cut on fold. The flat inner arc is
    // the full waist; worn, that arc wraps 2π around the body and the ring
    // cones outward — the sim maps it polar-ly (kind "circle").
    circleSkirt: true,
    parts: { skirt: "sandy.skirt" },
    yOffset: 460,
    bodyKind: "lowerColumn",
    // NOTE: bending 2.0 was tried to match the ~7-9 broad folds a real
    // mid-weight circle skirt falls into (Cusick drapemeter data) — it froze
    // the fine flutes into knife pleats instead of merging them. Fold count
    // is set by mesh density, not stiffness; the prompt clause carries it.
  },
  charlie: {
    module: "@freesewing/charlie",
    design: "Charlie",
    // Chinos on the Titan draft. The slant pocket cuts the front panel's
    // waist-side corner; the extractor restores that corner synthetically
    // (the pocket bag fills it in the worn garment).
    trousers: true,
    parts: { front: "charlie.front", back: "charlie.back" },
    frontWaistCut: { top: "slantTop", bottom: "slantBottom" },
    // SEAT RECIPE (solved in three layers): the crumple was the slant-pocket
    // waist cut collapsing the top edgesProfile rows to a corner (the sim
    // clamps those); the CB hole was the back-panel hip sweep sending the
    // rise to the hip SIDE (s_n convention flips on mirrored panels — fixed
    // in the sim); and with placement finally coincident, pinning the rise
    // top (the waistband's grip) closes the seat: crotch_back 197mm -> 12mm.
    // Pins only help when the pinned sides land together — the armscye
    // lesson, both directions.
    riseTopPin: 0.2,
    yOffset: 460,
    bodyKind: "lower",
  },
  carlton: {
    module: "@freesewing/carlton",
    design: "Carlton",
    // The Sherlock coat: two full-length button fronts (double-breasted
    // overlap pinned shut), an above-waist back joined to a pleated tail at
    // the waist, and the tailored TWO-PIECE sleeve (topsleeve+undersleeve).
    // Described, not simulated: collar/stand, facings, linings, all seven
    // pocket pieces, the CB pleat vent (synthetic straight CB), the back
    // waist dart (small intake), and the tail's pleats (the extra width
    // gathers into the waist seam instead).
    coat: true,
    parts: {
      front: "carlton.front", back: "carlton.back", tail: "carlton.tail",
      topsleeve: "carlton.topsleeve", undersleeve: "carlton.undersleeve",
    },
    // Heavy overlapping wool panels: the tee's thick collision shell (big
    // chest contact, and coat sleeves are roomy enough to tolerate it) +
    // the long-sleeve ring softener. Sewing stays at the gentle default:
    // force 4 whipped the two-piece sleeves into accordion crumples (the
    // coat has no darts to justify more).
    sim: { shellMm: 6, bending: 1.5 },
  },
  carlita: {
    module: "@freesewing/carlita",
    design: "Carlita",
    // Carlita extends Carlton with a separate side panel (three-panel body)
    // and a women's cut; same construction machinery otherwise.
    coat: true,
    sidePanel: true,
    parts: {
      front: "carlita.front", back: "carlita.back", side: "carlita.side", tail: "carlton.tail",
      topsleeve: "carlton.topsleeve", undersleeve: "carlton.undersleeve",
    },
    sim: { shellMm: 6, bending: 1.5 },
  },
  diana: {
    module: "@freesewing/diana",
    design: "Diana",
    fabric: "knit",
    // Drape-neck top: Brian's body and set-in sleeve with the front neck
    // point pushed far out (x 250 vs 80) and CF raised ABOVE the HPS line
    // — the excess neckline cloth hangs as the cowl. That sag is the whole
    // garment, so the front neckline is NOT pinned (cowlFront names it
    // past the sim's neck-pinning rule); shoulders and back neck hold.
    cowlFront: true,
    parts: { front: "diana.front", back: "diana.back", sleeve: "diana.sleeve" },
    sleeveAnchors: { hemL: "wristLeft", hemR: "wristRight" },
    sim: { bending: 1.5 },
  },
  brian: {
    module: "@freesewing/brian",
    design: "Brian",
    // The foundation block itself: the pattern every Brian-family garment
    // descends from. Draping the base block shows a client the canvas
    // before any styling.
    parts: { front: "brian.front", back: "brian.back", sleeve: "library.sleeve" },
    sleeveAnchors: { hemL: "wristLeft", hemR: "wristRight" },
    sim: { bending: 1.5 },
  },
  bent: {
    module: "@freesewing/bent",
    design: "Bent",
    // Brian's body with the tailored TWO-PIECE sleeve — the jacket base.
    // Same bridged sleeve machinery as the coats, without the coat body —
    // and the coats' thick collision shell too: without it the roomy
    // sleeve tube's folds concentrate at the bridge bands and the seams
    // read as open slits.
    jacket: true,
    parts: {
      front: "brian.front", back: "brian.back",
      topsleeve: "library.topsleeve", undersleeve: "library.undersleeve",
    },
    sim: { shellMm: 6, bending: 1.5 },
  },
  bella: {
    module: "@freesewing/bella",
    design: "Bella",
    // Women's foundation bodice: fitted to the waist with waist darts front
    // and back plus a side bust dart — all sewn shut in the sim, which is
    // the whole point of draping a block: seeing the fit it encodes.
    bodice: true,
    parts: { front: "bella.frontSideDart", back: "bella.back" },
    // Force 6 closes the darts into soft seam shadows. Stronger pulls pinch
    // and tear the waist instead — the ghost form has no bust for the dart
    // shaping to wrap, so past a point the springs fight the collision body.
    sim: { sewForce: 6 },
  },
  noble: {
    module: "@freesewing/noble",
    design: "Noble",
    // Princess-seam bodice: the bust shaping lives in curved seams running
    // through the shoulder, splitting front and back into inside/outside
    // panels (the back's princess seam is a converted dart — its edges
    // coincide above the waist dart's old tip). Inside panels cut on the
    // fold; outside panels cut in pairs, drafted in their own frame.
    noble: true,
    parts: {
      frontInside: "noble.frontInside", frontOutside: "noble.frontOutside",
      backInside: "noble.backInside", backOutside: "noble.backOutside",
    },
    // Princess seams behave like Bella's darts: they shape against a form
    // with no bust, so they need Bella's dart force — at 4 the bake leaves
    // them as open ruffled gashes even though the relax closes them.
    sim: { sewForce: 6 },
  },
  waralee: {
    module: "@freesewing/waralee",
    design: "Waralee",
    // Wrap trousers: ONE pattern piece cut twice. Each piece wraps a FULL
    // leg with ~1.7 turns of cloth (the tie flaps overlap in layers), and
    // the two pieces join only along the crotch notch cut into the waist
    // edge — a seam that must close at the body's mid-plane, so it drapes
    // on the brief body and the seam is BRIDGED (the shin rise lesson).
    // Waistband/straps are described, not simulated (collar honesty).
    wrapPants: true,
    parts: { pants: "waralee.pants" },
    yOffset: 460,
    bodyKind: "brief",
    // Force 8: the crotch seam fights the whole wrap's tension — 5 (the
    // uma recipe) left the front rise baked open. Friction maxed: the
    // wrap's overlap layers otherwise creep around the body over the bake
    // and coverage tears open (more frames = more drift, not less).
    sim: { sewForce: 8, friction: 80 },
  },
  breanna: {
    module: "@freesewing/breanna",
    design: "Breanna",
    // Women's bodice block with a rotatable bust dart. At the default
    // orientation nearly all shaping lives in the primary (waist) dart —
    // sewn shut like Bella's — while the secondary dart is a ~2mm sliver
    // we collapse instead of sewing: triangulating a 150mm-deep 2mm notch
    // makes degenerate cloth. Needs bustFront/highBustFront in the set.
    breanna: true,
    parts: { front: "breanna.front", back: "breanna.back" },
    sim: { sewForce: 6 },
  },
  uma: {
    module: "@freesewing/uma",
    design: "Uma",
    fabric: "knit",
    // Briefs: hip-wrapped front/back panels (a very short skirt, waistband
    // pinned) joined by a crotch gusset — the first block whose cloth must
    // CROSS the mannequin's crotch, so it drapes on the "brief" body: the
    // trouser form's full-ellipse fork (276mm front-to-back, thigh stubs
    // overlapping the centreline) has no gap a ~127mm gusset could span.
    brief: true,
    parts: { front: "uma.front", back: "uma.back", gusset: "uma.gusset" },
    yOffset: 460,
    bodyKind: "brief",
    // Force 5: the gusset seams must haul the strip up against the keel
    // and both thighs — at the default force the front seam bakes as an
    // open slit (the relax closes it, but the render is what you see).
    // Bending 1.5 is the knit-family finish (brian/sven/hugo): without it
    // the free leg-opening edges scallop into fine ruffles.
    sim: { sewForce: 5, bending: 1.5 },
  },
  shin: {
    module: "@freesewing/shin",
    design: "Shin",
    fabric: "knit",
    // Swim trunks: the Titan leg topology cut hip-slung and thigh-short.
    // The waist edge is drafted AT the hip line (waistToHips drives it), so
    // the vertical anchor drops to waist+hips. The elastic waistband part
    // is described, not simulated (collar honesty); the waist edge pins
    // like every trouser block. Drafted for ~20% stretch swim knit — the
    // fit map's knit scale is what keeps that honest.
    trousers: true,
    parts: { front: "shin.front", back: "shin.back" },
    trouserAnchors: {
      waistOut: "hipSide", waistIn: "hipCb",
      floorOut: "legSide", floorIn: "legInner", fork: "crossSeam",
    },
    // Shin drafts its back panel front-oriented (inseam outboard), unlike
    // Titan's mirrored back — flip it to match the sim's wrap convention.
    trouserBackMirrored: true,
    crotchBridge: true,
    yOffset: 590,
    // The brief body (parted thighs + crotch keel): trunk inseams and rises
    // must MEET between the legs, and the trouser stubs leave no gap there.
    bodyKind: "brief",
    // Force 4 (the Simon lesson): these leg tubes are SNUG — the panels
    // start stretched over the thigh stubs and contract as they settle, and
    // default-force springs lose the seam edges to that slide (placement
    // starts every seam within 61mm; a default-force bake ends with the
    // worst 5% near 290mm).
    sim: { sewForce: 4, bending: 1.5 },
  },
  bruce: {
    module: "@freesewing/bruce",
    design: "Bruce",
    fabric: "knit",
    // Boxer briefs: five panels around the hip — back cut on fold with two
    // crotch "wings" that wrap under, side quads (carlita-style: they share
    // the front's wrap frame, x-shifted past the front panel's edge), a
    // double-layer front pouch whose bulge dart sews its two tusk curves
    // together (we drape a single layer — layer count is a make note, not a
    // drape difference), and two INSETS that cover the front of each thigh
    // from the side seam to the crotch — drafted like very short trouser
    // fronts, so they drape on the leg placement, not the hip plane.
    bruce: true,
    parts: { back: "bruce.back", front: "bruce.front", side: "bruce.side", inset: "bruce.inset" },
    // Draped at a moderate 8-degree bulge (documented in the KB): the
    // default 20-degree pouch is a deep pre-sewn fold — five seams (dart
    // pair, two tusks, two inset tips) converge at the crotch cross-point,
    // and across bakes 7-12 the solver baked that convergence as a hanging
    // knot however the seams were sprung or bridged. At 8 degrees the
    // fold is shallow enough to assemble in situ. Pre-folded placement
    // (rotating the tusk regions about the dart before the bake) is the
    // machinery that would unlock the full pouch.
    draftOptions: { bulge: 8 },
    // 580 puts the waistband at the hip-widest and the whole under-crotch
    // assembly (gussetTop ~730, tusks ~750, wings just under the keel) AT
    // the keel. The cross-seam arithmetic demands it: the body's back-
    // waist-to-crotch path is 410mm and this low-rise draft's CB is only
    // 172mm — at 500/530 the garment floated above the fork and the
    // crotch seams had to dive a full keel-depth (287mm start gaps).
    yOffset: 580,
    bodyKind: "brief",
    // Force 8 (waralee's crotch number): at 6 the sprung pouch/crotch
    // seams closed to ~50mm but left the bunched inset-tip cloth dangling
    // as a knot under the pouch. The panel seams are bridged, so the high
    // force only acts on the crotch cluster.
    sim: { sewForce: 8, bending: 1.5 },
  },
};

const blockId = BLOCKS[spec.block] ? spec.block : "classic-tee";
const cfg = BLOCKS[blockId];

// The studio's standard measurement set (mm) — any client measurement sent in
// the spec overrides its entry.
const M = {
  ankle: 230, biceps: 335, bustFront: 490, bustPointToUnderbust: 80, bustSpan: 190, chest: 1080,
  crotchDepth: 280, highBustFront: 470,
  crossSeam: 800, crossSeamFront: 390, head: 560, heel: 330, highBust: 1040, hips: 1000,
  hpsToBust: 270, hpsToWaistBack: 460, hpsToWaistFront: 505, inseam: 790, knee: 420, neck: 400, seat: 1050,
  seatBack: 520, shoulderSlope: 13, shoulderToElbow: 340, shoulderToShoulder: 445, shoulderToWrist: 620,
  underbust: 900, upperLeg: 600, waist: 820, waistBack: 410, waistToArmpit: 230,
  waistToFloor: 1040, waistToHead: 670, waistToHips: 130, waistToKnee: 590,
  waistToSeat: 230, waistToUnderbust: 110, waistToUpperLeg: 280, wrist: 170,
};
for (const [k, v] of Object.entries(spec.measurements ?? {})) {
  const n = Number(v);
  if (Number.isFinite(n) && n >= 50 && n <= 2500) M[k] = n;
}

const clampPct = (v, lo, hi) => Math.min(hi, Math.max(lo, Number(v) || 0)) / 100;
const wanted = {
  chestEase: clampPct(spec.easePct ?? 0, 0, 25),
  waistEase: clampPct(spec.easePct ?? 0, 0, 25),
  hipsEase: clampPct(spec.easePct ?? 0, 0, 25),
  lengthBonus: clampPct(spec.lengthPct ?? 0, -15, 20),
  sleeveLengthBonus: clampPct(spec.sleevePct ?? 0, -30, 10),
};

const { [cfg.design]: Design } = await import(cfg.module);
// Only pass options this design actually declares.
const declared = Design.patternConfig?.options ?? {};
const options = Object.fromEntries(Object.entries(wanted).filter(([k]) => k in declared));
// Per-block draft options: where a design's DEFAULT drafts construction the
// solver cannot yet assemble (Bruce's 20-degree pouch fold), the block
// drapes at a documented alternative the studio can equally draft.
Object.assign(options, cfg.draftOptions ?? {});
// Length/sleeve bonuses are RELATIVE to the design's own default (mirrors the
// Pattern Studio's slider semantics): Sandy drafts its entire skirt length
// from lengthBonus (default 50), so overriding with the raw slider value
// would collapse the garment to nothing.
for (const k of ["lengthBonus", "sleeveLengthBonus"]) {
  if (k in options) {
    const d = Number(declared[k]?.pct);
    options[k] += Number.isFinite(d) ? d / 100 : 0;
  }
}

const pattern = new Design({ measurements: M, options });
pattern.draft();
const set = pattern.parts[0];

/** Sample a path segment between two coordinates along a piece's seam path.
 *  We re-walk the seam ops, cutting at the anchor coordinates. */
function pathPolyline(path) {
  const pts = [];
  let cur = null;
  for (const op of path.ops) {
    if (op.type === "move") {
      cur = [op.to.x, op.to.y];
      pts.push(cur);
    } else if (op.type === "line") {
      cur = [op.to.x, op.to.y];
      pts.push(cur);
    } else if (op.type === "curve") {
      const [x0, y0] = cur;
      const { cp1, cp2, to } = op;
      for (let i = 1; i <= 16; i++) {
        const t = i / 16;
        const mt = 1 - t;
        const x = mt * mt * mt * x0 + 3 * mt * mt * t * cp1.x + 3 * mt * t * t * cp2.x + t * t * t * to.x;
        const y = mt * mt * mt * y0 + 3 * mt * mt * t * cp1.y + 3 * mt * t * t * cp2.y + t * t * t * to.y;
        pts.push([x, y]);
      }
      cur = [to.x, to.y];
    }
    // 'close' handled implicitly — segments are cut by anchors anyway.
  }
  return pts;
}

const nearIdx = (pts, target, eps = 2) => {
  let best = -1;
  let bestD = Infinity;
  pts.forEach(([x, y], i) => {
    const d = Math.hypot(x - target.x, y - target.y);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  if (bestD > eps * 10) throw new Error(`anchor miss (${target.x},${target.y}) best ${bestD}mm`);
  return best;
};

/** Slice the closed polyline from anchor A to anchor B (walking forward). */
function slice(pts, a, b) {
  const ia = nearIdx(pts, a);
  const ib = nearIdx(pts, b);
  if (ia <= ib) return pts.slice(ia, ib + 1);
  return [...pts.slice(ia), ...pts.slice(0, ib + 1)];
}

/** Resample a polyline to exactly n points (arc-length uniform). */
function resample(pts, n) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  }
  const total = cum[cum.length - 1];
  const out = [];
  for (let k = 0; k < n; k++) {
    const target = (total * k) / (n - 1);
    let i = 1;
    while (i < cum.length - 1 && cum[i] < target) i++;
    const t = (target - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]);
    out.push([
      pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t,
      pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t,
    ]);
  }
  return out;
}

const segLen = (pts) => {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return l;
};
const countFor = (pts, spacing = 12) => Math.max(4, Math.round(segLen(pts) / spacing) + 1);

/**
 * Build a piece from named segments. Each segment is [name, points]; the
 * boundary is their concatenation (consecutive segments share endpoints,
 * which we dedupe). Returns { name, points, segments: {name: [start,end]} }
 * where start/end are inclusive indices into points.
 */
function buildPiece(name, segs) {
  const points = [];
  const segments = {};
  for (const [segName, raw] of segs) {
    const n = countFor(raw);
    const pts = resample(raw, n);
    const start = points.length === 0 ? 0 : points.length - 1;
    if (points.length === 0) points.push(pts[0]);
    for (let i = 1; i < pts.length; i++) points.push(pts[i]);
    segments[segName] = [start, points.length - 1];
  }
  // Boundary is closed: last point ≈ first point → drop the duplicate.
  const first = points[0];
  const last = points[points.length - 1];
  if (Math.hypot(first[0] - last[0], first[1] - last[1]) < 1) {
    points.pop();
    for (const k of Object.keys(segments)) {
      if (segments[k][1] === points.length) segments[k][1] = 0;
    }
  }
  return { name, points, segments };
}

const mirror = (pts) => pts.map(([x, y]) => [-x, y]);

function bodyPiece(partName, pieceName) {
  const part = set[partName];
  const P = part.points;
  const poly = pathPolyline(part.paths.seam);
  const isFront = pieceName === "front";
  if (cfg.raglan) {
    // Raglan body: hem -> side -> raglan seam (underarm to neck) -> neckline.
    // The seam path uses the ribbing attachment line as its hem.
    const raglanTip = isFront ? P.raglanTipFront : P.raglanTipBack;
    const hemR = slice(poly, isFront ? P.cfRibbing : P.cbRibbing, P.ribbing ?? P.hem);
    const sideR = slice(poly, P.ribbing ?? P.hem, P.armhole);
    const raglanR = slice(poly, P.armhole, raglanTip);
    const neckR = slice(poly, raglanTip, isFront ? P.cfNeck : P.cbNeck);
    return buildPiece(pieceName, [
      ["hemR", hemR],
      ["sideR", sideR],
      ["raglanR", raglanR],
      ["neckR", neckR],
      ["neckL", mirror([...neckR].reverse())],
      ["raglanL", mirror([...raglanR].reverse())],
      ["sideL", mirror([...sideR].reverse())],
      ["hemL", mirror([...hemR].reverse())],
    ]);
  }
  const A = cfg.bodyAnchors ?? { armTop: "shoulder", neckSide: "neck" };
  // Right-half segments (drafted half, fold at x=0).
  const hemR = slice(poly, P.cfHem ?? P.cbHem ?? P.gridAnchor, P.hem);
  const sideR = slice(poly, P.hem, P.armhole);
  const armscyeR = slice(poly, P.armhole, P[A.armTop]);
  const shoulderR = slice(poly, P[A.armTop], P[A.neckSide]);
  const neckR = slice(poly, P[A.neckSide], isFront ? P.cfNeck : P.cbNeck);
  // A cowl front's neckline must HANG, not hold: the sim pins segments
  // named "neck*" (collar honesty — a neckband keeps its shape), but a
  // drape-neck's sag IS the garment. Different name, no pin.
  const neckName = isFront && cfg.cowlFront ? "cowl" : "neck";
  // Full outline: right half then mirrored left half walked back to start.
  return buildPiece(pieceName, [
    ["hemR", hemR],
    ["sideR", sideR],
    ["armscyeR", armscyeR],
    ["shoulderR", shoulderR],
    [`${neckName}R`, neckR],
    [`${neckName}L`, mirror([...neckR].reverse())],
    ["shoulderL", mirror([...shoulderR].reverse())],
    ["armscyeL", mirror([...armscyeR].reverse())],
    ["sideL", mirror([...sideR].reverse())],
    ["hemL", mirror([...hemR].reverse())],
  ]);
}

function sleevePiece(side) {
  const part = set[cfg.parts.sleeve];
  const P = part.points;
  const A = cfg.sleeveAnchors;
  const poly = pathPolyline(part.paths.seam);
  const hem = slice(poly, P[A.hemL], P[A.hemR]);
  const edgeR = slice(poly, P[A.hemR], P.bicepsRight);
  if (cfg.raglan) {
    // Raglan sleeve: the cap is replaced by two raglan edges meeting in a
    // short neckline arc at the top ("neck"/"cap" names keep the sim's
    // pinning rules working). Front raglan is on the piece's -x side.
    // Raglan sleeve edges are PINNED ("cap*") like set-in caps: left free,
    // the tube rotates on the arm and tears the raglan seams open. The free
    // body edges travel to meet them.
    const capRaglanBack = slice(poly, P.bicepsRight, P.raglanTipBack);
    const neckTop = slice(poly, P.raglanTipBack, P.raglanTipFront);
    const capRaglanFront = slice(poly, P.raglanTipFront, P.bicepsLeft);
    const edgeL = slice(poly, P.bicepsLeft, P[A.hemL]);
    return buildPiece(`sleeve_${side}`, [
      ["hem", hem],
      ["edgeR", edgeR],
      ["capRaglanBack", capRaglanBack],
      ["neckTop", neckTop],
      ["capRaglanFront", capRaglanFront],
      ["edgeL", edgeL],
    ]);
  }
  const capFront = slice(poly, P.bicepsRight, P.sleeveTop ?? P.top);
  const capBack = slice(poly, P.sleeveTop ?? P.top, P.bicepsLeft);
  const edgeL = slice(poly, P.bicepsLeft, P[A.hemL]);
  return buildPiece(`sleeve_${side}`, [
    ["hem", hem],
    ["edgeR", edgeR],
    ["capFront", capFront],
    ["capBack", capBack],
    ["edgeL", edgeL],
  ]);
}

// Top-edge profile per body piece: min pattern-y per x-bin along the
// boundary. The sim hangs the panel from this line (collapsing depth toward
// the seam/neck line above it), whatever shape the block's top edge takes —
// shoulder seam, tank strap, raglan diagonal or shirt-front yoke line.
function topProfile(piece) {
  const BIN = 25;
  const bins = new Map();
  for (const [x, y] of piece.points) {
    const b = Math.round(x / BIN) * BIN;
    if (!bins.has(b) || y < bins.get(b)) bins.set(b, y);
  }
  return [...bins.entries()].sort((a, b) => a[0] - b[0]);
}

// Width profile: max |x| per y-bin. The sim scales the wrap shell per height
// so a flared dress wraps snug at the chest and full at the hem — one global
// scale would bunch the excess wherever the garment is narrower.
function widthProfile(piece) {
  const BIN = 40;
  const bins = new Map();
  for (const [x, y] of piece.points) {
    const b = Math.round(y / BIN) * BIN;
    const w = Math.abs(x);
    if (!bins.has(b) || w > bins.get(b)) bins.set(b, w);
  }
  return [...bins.entries()].sort((a, b) => a[0] - b[0]);
}

/** Button-front panel (Simon frontRight/frontLeft): drafted as a full panel
 *  with the centre front at x=0 and the button/buttonhole stand crossing it.
 *  The two panels are natural mirror complements, so pattern coordinates map
 *  straight into world space. */
function frontPanel(partName, pieceName) {
  const part = set[partName];
  const P = part.points;
  const poly = pathPolyline(part.paths.seam);
  return buildPiece(pieceName, [
    ["hem", slice(poly, P.cfHem, P.hem)],
    ["side", slice(poly, P.hem, P.armhole)],
    ["armscye", slice(poly, P.armhole, P.shoulder)],
    ["shoulder", slice(poly, P.shoulder, P.neck)],
    ["neck", slice(poly, P.neck, P.cfNeck)],
    ["placket", slice(poly, P.cfNeck, P.cfHem)],
  ]);
}

/** Shirt back below the yoke (half draft, mirrored). */
function shirtBackPiece() {
  const part = set[cfg.parts.back];
  const P = part.points;
  const poly = pathPolyline(part.paths.seam);
  const hemR = slice(poly, P.cbHem, P.hem);
  const sideR = slice(poly, P.hem, P.armhole);
  const armscyeR = slice(poly, P.armhole, P.armholeYokeSplit);
  const yokeR = slice(poly, P.armholeYokeSplit, P.cbYoke);
  return buildPiece("back", [
    ["hemR", hemR],
    ["sideR", sideR],
    ["armscyeR", armscyeR],
    ["yokeR", yokeR],
    ["yokeL", mirror([...yokeR].reverse())],
    ["armscyeL", mirror([...armscyeR].reverse())],
    ["sideL", mirror([...sideR].reverse())],
    ["hemL", mirror([...hemR].reverse())],
  ]);
}

/** Shirt yoke (drafted full width). Bottom sews to the back, shoulders to
 *  the front panels, neck curve joins the pinned collar line. */
function yokePiece() {
  const part = set[cfg.parts.yoke];
  const P = part.points;
  const poly = pathPolyline(part.paths.seam);
  const m = (pt) => ({ x: -pt.x, y: pt.y });
  return buildPiece("yoke", [
    ["bottomR", slice(poly, P.cbYoke, P.armholeYokeSplit)],
    ["armTopR", slice(poly, P.armholeYokeSplit, P.shoulder)],
    ["shoulderR", slice(poly, P.shoulder, P.neck)],
    ["neckR", slice(poly, P.neck, P.cbNeck)],
    ["neckL", slice(poly, P.cbNeck, m(P.neck))],
    ["shoulderL", slice(poly, m(P.neck), m(P.shoulder))],
    ["armTopL", slice(poly, m(P.shoulder), m(P.armholeYokeSplit))],
    ["bottomL", slice(poly, m(P.armholeYokeSplit), P.cbYoke)],
  ]);
}

/** Slip-dress panel (Sophie): cut on fold, top edge pinned at chest height. */
function dressPanel(partName, pieceName) {
  const part = set[partName];
  const P = part.points;
  const poly = pathPolyline(part.paths.seam);
  const hemR = slice(poly, P.bottomCenterpoint, P.bottomSide);
  const sideR = slice(poly, P.bottomSide, P.topSide);
  const neckR = slice(poly, P.topSide, P.topCenterpoint);
  return buildPiece(pieceName, [
    ["hemR", hemR],
    ["sideR", sideR],
    ["neckR", neckR],
    ["neckL", mirror([...neckR].reverse())],
    ["sideL", mirror([...sideR].reverse())],
    ["hemL", mirror([...hemR].reverse())],
  ]);
}

/** Waistcoat front (Wahid): one drafted part, cut twice. The outline runs
 *  side -> armhole -> shoulder -> V-neck -> buttoned CF -> pointed hem with a
 *  waist dart slit (sewn shut in the sim). mirrored=true builds the other
 *  panel. */
/** Tabard panel (Walburga): the draft is pure named-point geometry (straight
 *  lines, drafted half at x<=0, cut on fold), so the piece is built from the
 *  points directly instead of walking the seam path (which backtracks over
 *  the head-slot notch). Front carries a V-neck; back a straight top edge. */
function tabardPiece(partName, pieceName) {
  const P = set[partName].points;
  const pt = (p) => [p.x, p.y];
  const mm = ([x, y]) => [-x, y];
  const isFront = pieceName === "front";
  const headL = pt(P.headLeft); // (-141, 0): head-slot edge
  const topL = pt(P.topLeft); // (-211, 0): shoulder tip
  const slitL = pt(P.triangleLeft); // (-211, 745): side edge ends
  const lowL = pt(P.bottomMiddle); // (-106, 876): kite point
  const cfLow = pt(P.triangle); // (0, 745): hem rises back to CF
  const neckCF = isFront ? pt(P.neckomid) : pt(P.top); // (0,135) V / (0,0) straight
  const neckR = isFront ? [neckCF, mm(pt(P.neckotop)), mm(headL)] : [neckCF, mm(headL)];
  const neckL = isFront ? [headL, pt(P.neckotop), neckCF] : [headL, neckCF];
  return buildPiece(pieceName, [
    ["neckR", neckR],
    ["shoulderR", [mm(headL), mm(topL)]],
    ["sideR", [mm(topL), mm(slitL)]],
    ["hemR", [mm(slitL), mm(lowL), cfLow]],
    ["hemL", [cfLow, lowL, slitL]],
    ["sideL", [slitL, topL]],
    ["shoulderL", [topL, headL]],
    ["neckL", neckL],
  ]);
}

function waistcoatFront(pieceName, mirrored) {
  const part = set[cfg.parts.front];
  const P = part.points;
  const poly = pathPolyline(part.paths.seam);
  const seg = (pts) => (mirrored ? mirror(pts) : pts);
  return buildPiece(pieceName, [
    ["side", seg(slice(poly, P.hem, P.armhole))],
    ["armscye", seg(slice(poly, P.armhole, P.shoulder))],
    ["shoulder", seg(slice(poly, P.shoulder, P.neck))],
    ["neck", seg(slice(poly, P.neck, P.closureTop))],
    ["placket", seg(slice(poly, P.closureTop, P.dartHemLeft))],
    ["dartL", seg(slice(poly, P.dartHemLeft, P.dartTop))],
    ["dartR", seg(slice(poly, P.dartTop, P.dartHemRight))],
    ["hem2", seg(slice(poly, P.dartHemRight, P.hem))],
  ]);
}

/** Waistcoat back (Wahid): half draft mirrored, CB fold excluded, one waist
 *  dart per side. */
function waistcoatBack() {
  const part = set[cfg.parts.back];
  const P = part.points;
  const poly = pathPolyline(part.paths.seam);
  const cbNeckPt = { x: 0, y: P.neck.y + 22 };
  const hem1R = slice(poly, P.cbHem, P.dartHemLeft);
  const dartLR = slice(poly, P.dartHemLeft, P.dartTop);
  const dartRR = slice(poly, P.dartTop, P.dartHemRight);
  const hem2R = slice(poly, P.dartHemRight, P.hem);
  const sideR = slice(poly, P.hem, P.armhole);
  const armscyeR = slice(poly, P.armhole, P.shoulder);
  const shoulderR = slice(poly, P.shoulder, P.neck);
  const neckR = slice(poly, P.neck, cbNeckPt);
  return buildPiece("back", [
    ["hem1R", hem1R],
    ["dartLR", dartLR],
    ["dartRR", dartRR],
    ["hem2R", hem2R],
    ["sideR", sideR],
    ["armscyeR", armscyeR],
    ["shoulderR", shoulderR],
    ["neckR", neckR],
    ["neckL", mirror([...neckR].reverse())],
    ["shoulderL", mirror([...shoulderR].reverse())],
    ["armscyeL", mirror([...armscyeR].reverse())],
    ["sideL", mirror([...sideR].reverse())],
    ["hem2L", mirror([...hem2R].reverse())],
    ["dartRL", mirror([...dartRR].reverse())],
    ["dartLL", mirror([...dartLR].reverse())],
    ["hem1L", mirror([...hem1R].reverse())],
  ]);
}

/** Coat front (Carlton/Carlita): a full-length double-breasted panel, cut
 *  twice mirrored. The drafted body extends to +x; the closure edge crosses
 *  CF to ~-68mm (the overlap that buttons shut). The lapel is simulated
 *  buttoned flat to the chest — the roll and collar live in the description.
 *  The side seam splits at the waist: above it sews to the back, below to
 *  the tail (Carlton) or side panel (Carlita). */
function coatFront(pieceName, mirrored) {
  const part = set[cfg.parts.front];
  const P = part.points;
  const poly = pathPolyline(part.paths.seam);
  const seg = (pts) => (mirrored ? mirror(pts) : pts);
  return buildPiece(pieceName, [
    ["sideLower", seg(slice(poly, P.hem, P.waist))],
    ["sideUpper", seg(slice(poly, P.waist, P.armhole))],
    ["armscye", seg(slice(poly, P.armhole, P.shoulder))],
    ["shoulder", seg(slice(poly, P.shoulder, P.hps))],
    ["neck", seg(slice(poly, P.hps, P.cfNeck))],
    ["placket", seg(slice(poly, P.cfNeck, P.hemEdge))],
    ["hem", seg(slice(poly, P.hemEdge, P.hem))],
  ]);
}

/** Coat back (Carlton): above-waist half draft, mirrored at CB. The CB pleat
 *  vent (bpTop/bpBottom detour) and the waist dart are SKIPPED — a synthetic
 *  straight waist edge stands in for both; the dart's intake is absorbed by
 *  the tail seam's gathering, and the vent is a described detail. */
function coatBack() {
  const part = set[cfg.parts.back];
  const P = part.points;
  const poly = pathPolyline(part.paths.seam);
  const cbWaistPt = { x: 0, y: P.cbWaist.y };
  const waistR = [[cbWaistPt.x, cbWaistPt.y], [P.waist.x, P.waist.y]];
  const sideR = slice(poly, P.waist, P.armhole);
  const armscyeR = slice(poly, P.armhole, P.shoulder);
  const shoulderR = slice(poly, P.shoulder, P.hps);
  const neckR = slice(poly, P.hps, P.cbNeck);
  return buildPiece("back", [
    ["waistR", waistR],
    ["sideR", sideR],
    ["armscyeR", armscyeR],
    ["shoulderR", shoulderR],
    ["neckR", neckR],
    ["neckL", mirror([...neckR].reverse())],
    ["shoulderL", mirror([...shoulderR].reverse())],
    ["armscyeL", mirror([...armscyeR].reverse())],
    ["sideL", mirror([...sideR].reverse())],
    ["waistL", mirror([...waistR].reverse())],
  ]);
}

/** Coat tail (Carlton): the pleated back skirt, drafted as a half rectangle
 *  (CB at x=0, cut on fold) in its own frame with y=0 at the waist seam.
 *  The pleat folds are NOT simulated — the flat width gathers into the waist
 *  seam by the springs, which is what pleats do to first order. backWaistY
 *  shifts the piece into body coordinates (it hangs from the back waist). */
function tailPiece(backWaistY) {
  const P = set[cfg.parts.tail].points;
  const pt = (p) => [p.x, p.y + backWaistY];
  const topR = [pt(P.cbTop), pt(P.waistTop)];
  const sideR = [pt(P.waistTop), pt(P.waistBottom)];
  const hemR = [pt(P.waistBottom), pt(P.cbBottom)];
  return buildPiece("tail", [
    ["topR", topR],
    ["sideR", sideR],
    ["hemR", hemR],
    ["hemL", mirror([...hemR].reverse())],
    ["sideL", mirror([...sideR].reverse())],
    ["topL", mirror([...topR].reverse())],
  ]);
}

/** Carlita front: the coat front's CF/lapel half, ending at a princess-style
 *  panel seam (psHem up through bustPoint to the front armhole pitch) — the
 *  side panel carries the rest of the body round to the back seam. */
function carlitaFront(pieceName, mirrored) {
  const part = set[cfg.parts.front];
  const P = part.points;
  const poly = pathPolyline(part.paths.seam);
  const seg = (pts) => (mirrored ? mirror(pts) : pts);
  return buildPiece(pieceName, [
    ["panel", seg(slice(poly, P.psHem, P.frontArmholePitch))],
    ["armscye", seg(slice(poly, P.frontArmholePitch, P.shoulder))],
    ["shoulder", seg(slice(poly, P.shoulder, P.hps))],
    ["neck", seg(slice(poly, P.hps, P.cfNeck))],
    ["placket", seg(slice(poly, P.cfNeck, P.hemEdge))],
    ["hem", seg(slice(poly, P.hemEdge, P.psHem))],
  ]);
}

/** Carlita side panel: full-length, owning the underarm curve of the
 *  armscye (armhole up to the pitch — unsewn, the honest underarm scope
 *  shared with the undersleeve cap). Its back edge splits at the waist:
 *  above to the back panel, below to the tail. */
function carlitaSide(pieceName, mirrored) {
  const part = set[cfg.parts.side];
  const P = part.points;
  const poly = pathPolyline(part.paths.seam);
  // The side panel's draft x starts ~12mm past where the front panel's seam
  // edge ends (drafting offsets, not garment geometry) — butt the pieces on
  // the wrap arc or the princess seam shows as a wide dark channel. A pure
  // translation, so the flat shape (and the strain it grades) is untouched.
  const dx = set[cfg.parts.front].points.psHem.x - P.psHem.x;
  const seg = (pts) => {
    const shifted = pts.map(([x, y]) => [x + dx, y]);
    return mirrored ? mirror(shifted) : shifted;
  };
  return buildPiece(pieceName, [
    ["sideLower", seg(slice(poly, P.hem, P.waist))],
    ["sideUpper", seg(slice(poly, P.waist, P.armhole))],
    ["armscye", seg(slice(poly, P.armhole, P.armholePitch))],
    ["panel", seg(slice(poly, P.armholePitch, P.psHem))],
    ["hem", seg(slice(poly, P.psHem, P.hem))],
  ]);
}

/** Tailored two-piece sleeve (Carlton/Carlita): topsleeve wraps the outer
 *  arm, undersleeve the underarm — both drafted in ONE shared coordinate
 *  frame (biceps line at the same y, elbow/wrist heights matched), which is
 *  what makes the pair sewable along both long edges. The front edges live
 *  at -x (frontPitchPoint side). The turnback cuff extension below the wrist
 *  is cut off with a synthetic straight hem — worn, it's folded up inside.
 *  The undersleeve's short cap (usTip) is the unsewn underarm scope: pinned
 *  to the arm tube via the cap* rule, described rather than seam-matched. */
function twoPieceSleeve(partKey, pieceName) {
  const part = set[cfg.parts[partKey]];
  const P = part.points;
  const poly = pathPolyline(part.paths.seam);
  const isTop = partKey === "topsleeve";
  const edgeL = isTop ? P.tsLeftEdge : P.usLeftEdge;
  const edgeR = isTop ? P.tsRightEdge : P.usRightEdge;
  const wristL = isTop ? P.tsWristLeft : P.usWristLeft;
  const wristR = isTop ? P.tsWristRight : P.usWristRight;
  // The undersleeve's short top curve IS pinned (cap* name), same as the
  // topsleeve cap: the whole top ring of the tube anchors like a one-piece
  // sleeve cap. (Unpinned was tried when the seams wouldn't close — the
  // free undersleeve just collapsed down the tilted arm into horizontal
  // accordion pleats instead; the real closure fix was the straight,
  // spiral-free seam placement, which makes the pinned ring coincident-
  // compatible with the sewn equilibrium — the armscye lesson satisfied.)
  // Side-panel coats (Carlita): the front panel's armscye is only the short
  // pitch-to-shoulder arc, so capFront splits at the front pitch point —
  // the upper half sews to it, the lower half (capFrontLow) stays a pinned
  // unsewn underarm edge alongside the side panel's own armscye curve.
  const capSegs = isTop
    ? [
        ["capBack", slice(poly, edgeR, P.top)],
        ...(cfg.sidePanel
          ? [
              ["capFront", slice(poly, P.top, P.frontPitchPoint)],
              ["capFrontLow", slice(poly, P.frontPitchPoint, edgeL)],
            ]
          : [["capFront", slice(poly, P.top, edgeL)]]),
      ]
    : [["capUnder", slice(poly, edgeR, edgeL)]];
  return buildPiece(pieceName, [
    ["edgeFront", slice(poly, edgeL, wristL)],
    ["hem", [[wristL.x, wristL.y], [wristR.x, wristR.y]]],
    ["edgeBack", slice(poly, wristR, edgeR)],
    ...capSegs,
  ]);
}

/** Crossover front (Yuri): the zipless sweater's front is a FULL panel, cut
 *  twice mirrored, whose opening edge sweeps diagonally from the neck across
 *  CF (the "button" point sits ~200mm past centre) down to the hem — the two
 *  fronts overlap like a wrap cardigan and button shut. */
function crossFrontPanel(pieceName, mirrored) {
  const part = set[cfg.parts.front];
  const P = part.points;
  const poly = pathPolyline(part.paths.seam);
  const seg = (pts) => (mirrored ? mirror(pts) : pts);
  // The opening edge from the neck point to the button crosses CF on its
  // way down. Its neck-side portion IS the front neckline — name it neck*
  // so the sim pins it like every collar (unpinned, the neck gapes open
  // and the fronts slump off the shoulders). The edge is one straight
  // line in the draft, so the CF crossing must be interpolated, not
  // looked up.
  const crossAll = slice(poly, P.hps, P.button);
  let cut = null;
  for (let i = 1; i < crossAll.length; i++) {
    const [x0, y0] = crossAll[i - 1];
    const [x1, y1] = crossAll[i];
    if (x0 > 0 && x1 <= 0) {
      const t = x0 / (x0 - x1);
      cut = { i, pt: [0, y0 + (y1 - y0) * t] };
      break;
    }
  }
  const crossSegs = cut
    ? [
        ["neckCross", seg([...crossAll.slice(0, cut.i), cut.pt])],
        ["cross", seg([cut.pt, ...crossAll.slice(cut.i)])],
      ]
    : [["cross", seg(crossAll)]];
  return buildPiece(pieceName, [
    ["hem", seg(slice(poly, P.cfBottom, P.bottom))],
    ["side", seg(slice(poly, P.bottom, P.armhole))],
    ["armscye", seg(slice(poly, P.armhole, P.shoulder))],
    ["shoulder", seg(slice(poly, P.shoulder, P.hps))],
    ...crossSegs,
    ["crossLow", seg(slice(poly, P.button, P.cfBottom))],
  ]);
}

/** Yuri back: cut on fold, hem at the drafted bottom edge (the generic
 *  bodyPiece can't be used — yuri's seam path hem anchors differ). */
function crossBack() {
  const part = set[cfg.parts.back];
  const P = part.points;
  const poly = pathPolyline(part.paths.seam);
  const hemR = slice(poly, P.cbBottom, P.bottom);
  const sideR = slice(poly, P.bottom, P.armhole);
  const armscyeR = slice(poly, P.armhole, P.shoulder);
  const shoulderR = slice(poly, P.shoulder, P.hps);
  const neckR = slice(poly, P.hps, P.cbNeck);
  return buildPiece("back", [
    ["hemR", hemR],
    ["sideR", sideR],
    ["armscyeR", armscyeR],
    ["shoulderR", shoulderR],
    ["neckR", neckR],
    ["neckL", mirror([...neckR].reverse())],
    ["shoulderL", mirror([...shoulderR].reverse())],
    ["armscyeL", mirror([...armscyeR].reverse())],
    ["sideL", mirror([...sideR].reverse())],
    ["hemL", mirror([...hemR].reverse())],
  ]);
}

/** Zip-front half (Huey): one drafted half-front, cut twice. The CF zip edge
 *  is pinned shut continuously — zip tape holds rigid, unlike buttons. */
function zipFrontHalf(pieceName, mirrored) {
  const part = set[cfg.parts.front];
  const P = part.points;
  const poly = pathPolyline(part.paths.seam);
  const seg = (pts) => (mirrored ? mirror(pts) : pts);
  return buildPiece(pieceName, [
    ["side", seg(slice(poly, P.hem, P.armhole))],
    ["armscye", seg(slice(poly, P.armhole, P.shoulder))],
    ["shoulder", seg(slice(poly, P.shoulder, P.neck))],
    ["neck", seg(slice(poly, P.neck, P.cfNeck))],
    ["zip", seg(slice(poly, P.cfNeck, P.cfHem))],
    ["hem", seg(slice(poly, P.cfHem, P.hem))],
  ]);
}

/** Slice that always takes the SHORT way between two anchors, regardless of
 *  the part's path direction (Titan's back walks opposite to its front). */
function sliceShort(poly, a, b) {
  const fwd = slice(poly, a, b);
  if (fwd.length <= poly.length / 2 + 1) return fwd;
  return [...slice(poly, b, a)].reverse();
}

/** Trouser panel (Titan front/back): outseam on one edge, inseam + crotch
 *  curve on the other, fork where they split. mirrored=true builds the other
 *  leg's copy. Emits an edges profile [y, xMin, xMax] so the sim can wrap the
 *  half-tube with the true local width. */
function trouserPanel(partName, pieceName, mirrored) {
  const part = set[partName];
  const P = part.points;
  const poly = pathPolyline(part.paths.seam);
  const seg = (pts) => (mirrored ? mirror(pts) : pts);
  // Titan-family anchor names by default; blocks drafted with other names
  // (Shin's hip-slung trunks) map theirs in via cfg.trouserAnchors.
  const N = cfg.trouserAnchors ?? {
    waistOut: "styleWaistOut", waistIn: "styleWaistIn",
    floorOut: "floorOut", floorIn: "floorIn", fork: "fork",
  };
  // A slant front pocket (chinos) cuts the waist-side corner off the panel.
  // Restore that corner synthetically — in the worn garment the pocket bag
  // fills it, and simulating the hole instead leaves the front panel
  // narrower than the back so the leg tubes misalign and the seams gape.
  const cut = cfg.frontWaistCut && pieceName.startsWith("front") ? cfg.frontWaistCut : null;
  const line = (p1, p2, n = 8) =>
    Array.from({ length: n + 1 }, (_, i) => [
      p1.x + ((p2.x - p1.x) * i) / n,
      p1.y + ((p2.y - p1.y) * i) / n,
    ]);
  const outseamPts = cut
    ? [...line(P[N.waistOut], P[cut.bottom]), ...sliceShort(poly, P[cut.bottom], P[N.floorOut])]
    : sliceShort(poly, P[N.waistOut], P[N.floorOut]);
  const waistPts = cut
    ? [...sliceShort(poly, P[N.waistIn], P[cut.top]), ...line(P[cut.top], P[N.waistOut])]
    : sliceShort(poly, P[N.waistIn], P[N.waistOut]);
  // Optionally pin the top of the rise (waistband grip continues down the
  // CF/CB seam): blocks with a deep back rise (chinos) crumple at the seat
  // when the whole rise must find its place by springs alone.
  const risePin = Number(cfg.riseTopPin) || 0;
  const crotchFull = sliceShort(poly, P[N.fork], P[N.waistIn]);
  const [crotchPts, riseTopPts] = risePin ? splitAt(crotchFull, 1 - risePin) : [crotchFull, null];
  const piece = buildPiece(pieceName, [
    ["outseam", seg(outseamPts)],
    ["hem", seg(sliceShort(poly, P[N.floorOut], P[N.floorIn]))],
    ["inseam", seg(sliceShort(poly, P[N.floorIn], P[N.fork]))],
    ["crotch", seg(crotchPts)],
    ...(riseTopPts ? [["riseTop", seg(riseTopPts)]] : []),
    ["waist", seg(waistPts)],
  ]);
  const BIN = 50;
  const bins = new Map();
  for (const [x, y] of piece.points) {
    const b = Math.round(y / BIN) * BIN;
    const e = bins.get(b) ?? [x, x];
    bins.set(b, [Math.min(e[0], x), Math.max(e[1], x)]);
  }
  piece.edgesProfile = [...bins.entries()].map(([y, [lo, hi]]) => [y, lo, hi]).sort((a, b) => a[0] - b[0]);
  piece.forkY = P[N.fork].y;
  return piece;
}

/** Skirt panel (Penelope front/back): cut on fold, CF/CB fold excluded,
 *  waist edge (with its dart V's) pinned flat under the waistband. */
function skirtPanel(partName, pieceName) {
  const part = set[partName];
  const P = part.points;
  const poly = pathPolyline(part.paths.seam);
  const hemR = slice(poly, P.lHem, P.rHem);
  const sideR = slice(poly, P.rHem, P.rWaist);
  const waistR = slice(poly, P.rWaist, P.lWaist);
  return buildPiece(pieceName, [
    ["hemR", hemR],
    ["sideR", sideR],
    ["waistR", waistR],
    ["waistL", mirror([...waistR].reverse())],
    ["sideL", mirror([...sideR].reverse())],
    ["hemL", mirror([...hemR].reverse())],
  ]);
}

/** Brief front (Uma): a hip-wrapped panel like a very short skirt — waistband
 *  on top (pinned), short side seams, free leg-opening curves, and a straight
 *  bottom edge the gusset sews to. That edge is one drafted line; the gusset's
 *  matching edge is split at CF by its own path start, so split ours the same
 *  way and the seams pair segment-for-segment. */
function briefFront() {
  const part = set[cfg.parts.front];
  const P = part.points;
  const poly = pathPolyline(part.paths.seam);
  const gy = P.frontGussetSplit.y;
  return buildPiece("front", [
    ["waistL", slice(poly, P.cfWaistbandDip, P.sideWaistbandFlipped)],
    ["sideL", slice(poly, P.sideWaistbandFlipped, P.sideLegFlipped)],
    ["legL", slice(poly, P.sideLegFlipped, P.frontGussetSplitFlipped)],
    ["gussetEdgeL", [[P.frontGussetSplitFlipped.x, gy], [0, gy]]],
    ["gussetEdgeR", [[0, gy], [P.frontGussetSplit.x, gy]]],
    ["legR", slice(poly, P.frontGussetSplit, P.sideLeg)],
    ["sideR", slice(poly, P.sideLeg, P.sideWaistband)],
    ["waistR", slice(poly, P.sideWaistband, P.cfWaistbandDip)],
  ]);
}

/** Brief back (Uma): drafted far below the shared base frame (waistband at
 *  y≈-551, gusset edge at y≈-368 — draft y still increases downward, no flip
 *  needed). Translating by the side-waistband delta lines both waistbands up
 *  in one pattern frame, so the plane placement's h = yOffset + y works
 *  untouched for both panels. */
function briefBack() {
  const part = set[cfg.parts.back];
  const P = part.points;
  const poly = pathPolyline(part.paths.seam);
  const dy = P.sideWaistband.y - P.sideWaistbandBack.y;
  const gy = P.backGussetSplit.y;
  const piece = buildPiece("back", [
    ["waistR", slice(poly, P.cfWaistbandDipBack, P.sideWaistbandBack)],
    ["sideR", slice(poly, P.sideWaistbandBack, P.sideLegBack)],
    ["legR", slice(poly, P.sideLegBack, P.backGussetSplit)],
    // The gusset's back edge is a single segment, so keep ours whole too.
    ["gussetEdge", [[P.backGussetSplit.x, gy], [P.backGussetSplitFlipped.x, gy]]],
    ["legL", slice(poly, P.backGussetSplitFlipped, P.sideLegBackFlipped)],
    ["sideL", slice(poly, P.sideLegBackFlipped, P.sideWaistbandBackFlipped)],
    ["waistL", slice(poly, P.sideWaistbandBackFlipped, P.cfWaistbandDipBack)],
  ]);
  piece.points = piece.points.map(([x, y]) => [x, y + dy]);
  return piece;
}

/** Brief gusset (Uma): the crotch strip. Front edge split at CF by the
 *  draft's own path start; the waisted side curves are the leg openings'
 *  inner arcs — free edges, like every leg opening. */
function briefGusset() {
  const part = set[cfg.parts.gusset];
  const P = part.points;
  const poly = pathPolyline(part.paths.seam);
  return buildPiece("gusset", [
    ["frontEdgeL", slice(poly, P.cfFrontGusset, P.frontGussetSplitFlipped)],
    ["sideEdgeL", slice(poly, P.frontGussetSplitFlipped, P.backGussetSplitFlipped)],
    ["backEdge", slice(poly, P.backGussetSplitFlipped, P.backGussetSplit)],
    ["sideEdgeR", slice(poly, P.backGussetSplit, P.frontGussetSplit)],
    ["frontEdgeR", slice(poly, P.frontGussetSplit, P.cfFrontGusset)],
  ]);
}

/** Bruce back: cut on fold — unfold across CB (x=0). The bottom edge is a
 *  W: a notch rising to gussetTop at CB between two crotch "wings" that drop
 *  to ±gussetRight. Each wing edge (the * crotch seam) is split by length
 *  ratio into the portion the front's tusk takes (nearest CB) and the
 *  portion the inset's gusset edge takes (the wing tip) — Bruce's
 *  gussetInsetRatio made flesh. */
function bruceBack(tuskFrac) {
  const part = set[cfg.parts.back];
  const P = part.points;
  const poly = pathPolyline(part.paths.seam);
  const crotchR = slice(poly, P.gussetTop, P.gussetRight);
  const [crotchTuskR, crotchInsetR] = splitAt(crotchR, tuskFrac);
  const legR = slice(poly, P.gussetRight, P.legRight);
  const sideR = slice(poly, P.legRight, P.sideRight);
  const waistR = slice(poly, P.sideRight, P.center);
  const rev = (pts) => [...pts].reverse();
  return buildPiece("back", [
    ["crotchTuskR", crotchTuskR],
    ["crotchInsetR", crotchInsetR],
    ["legR", legR],
    ["sideR", sideR],
    ["waistR", waistR],
    ["waistL", mirror(rev(waistR))],
    ["sideL", mirror(rev(sideR))],
    ["legL", mirror(rev(legR))],
    ["crotchInsetL", mirror(rev(crotchInsetR))],
    ["crotchTuskL", mirror(rev(crotchTuskR))],
  ]);
}

/** Bruce front (the pouch): drafted full-width. With bulge > 0 (the default)
 *  the bottom edge runs tusk → dart curve → dart curve → tusk; the two dart
 *  curves sew TO EACH OTHER (that fold is what makes the pouch a pouch). */
function bruceFront() {
  const part = set[cfg.parts.front];
  const P = part.points;
  const poly = pathPolyline(part.paths.seam);
  const hasDart = P.dartJoin.dist(P.rightTuskLeft) > 2;
  return buildPiece("front", [
    ["sideL", slice(poly, P.midLeft, P.topLeft)],
    ["waistL", slice(poly, P.topLeft, P.topMid)],
    ["waistR", slice(poly, P.topMid, P.topRight)],
    ["sideR", slice(poly, P.topRight, P.midRight)],
    ["curveR", slice(poly, P.midRight, P.rightTuskRight)],
    ...(hasDart
      ? [
          ["tuskR", slice(poly, P.rightTuskRight, P.rightTuskLeft)],
          ["dartR", slice(poly, P.rightTuskLeft, P.dartJoin)],
          ["dartL", slice(poly, P.dartJoin, P.leftTuskRight)],
          ["tuskL", slice(poly, P.leftTuskRight, P.leftTuskLeft)],
        ]
      : [
          ["tuskR", slice(poly, P.rightTuskRight, P.rightTuskLeft)],
          ["tuskL", slice(poly, P.rightTuskLeft, P.leftTuskLeft)],
        ]),
    ["curveL", slice(poly, P.leftTuskLeft, P.midLeft)],
  ]);
}

/** Bruce side: a quad sharing the front's wrap frame (carlita's trick) —
 *  shifted so its FRONT edge butts the front panel's side edge, wrapping
 *  around to carry its BACK edge toward the back panel's side edge. The
 *  front edge splits at the drafted notch: the top joins the front panel,
 *  the rest joins the inset. */
function bruceSide(pieceName, mirrored) {
  const part = set[cfg.parts.side];
  const P = part.points;
  const FP = set[cfg.parts.front].points;
  const poly = pathPolyline(part.paths.seam);
  const notchLen = FP.topRight.dist(FP.midRight);
  const frontEdge = slice(poly, P.topRight, P.bottomRight);
  const [frontUp, frontLo] = splitAt(frontEdge, notchLen / segLen(frontEdge));
  // Butt the # edge (drafted at x = topRight.x) against the front panel's
  // side edge; as-drafted + shift = body LEFT (arc x negative), mirrored
  // lands it on the right.
  const dx = -(P.topRight.x + FP.midRight.x);
  const seg = (pts) => {
    const shifted = pts.map(([x, y]) => [x + dx, y]);
    return mirrored ? mirror(shifted) : shifted;
  };
  return buildPiece(pieceName, [
    ["back", seg(slice(poly, P.bottomLeft, P.topLeft))],
    ["waist", seg(slice(poly, P.topLeft, P.topRight))],
    ["frontUp", seg(frontUp)],
    ["frontLo", seg(frontLo)],
    ["hem", seg(slice(poly, P.bottomRight, P.bottomLeft))],
  ]);
}

/** Bruce inset: the front-of-thigh panel — # side edge to the side panel,
 *  top curve to the pouch, gusset tip to the back's crotch wing, hem free
 *  around the leg. It sits ENTIRELY above the mannequin's fork, so the leg
 *  placement is wrong for it (a leg tube at those heights starts inside
 *  the hip volume — bake 3 squeezed both insets flat against the seat).
 *  Instead it joins the front-face RING: its # edge butts the side seam
 *  arc (mirror + shift, so drafted x=0 lands at the front panel's edge)
 *  and its tip crosses CF under the pouch, layered by outset where tips
 *  and tusks overlap. y is shifted so the # edge spans the side panel's
 *  below-notch front edge. */
function bruceInset(pieceName, mirrored) {
  const part = set[cfg.parts.inset];
  const P = part.points;
  const SP = set[cfg.parts.side].points;
  const FP = set[cfg.parts.front].points;
  const poly = pathPolyline(part.paths.seam);
  const notchLen = FP.topRight.dist(FP.midRight);
  const t = notchLen / SP.topRight.dist(SP.bottomRight);
  const notchY = SP.topRight.y + (SP.bottomRight.y - SP.topRight.y) * t;
  const dy = notchY - P.topLeft.y;
  // The drafted tip is 30mm wider than the arc from the side seam to CF.
  // Crossing CF stacked the insets against each other's seam targets (the
  // crotch seams pulled them through each other — a twisted knot), and a
  // hard clamp piled the excess at one arc position (a dangling bunch
  // under the pouch, bakes 5-9). Compress the arc UNIFORMLY instead:
  // same endpoints (# edge at the side seam, tip at CF+6), the extra
  // cloth spread as gentle pre-compression the pouch drape absorbs.
  const x0 = FP.midRight.x;
  const xTip = x0 - Math.max(...pathPolyline(part.paths.seam).map(([x]) => x));
  const k = (x0 - 6) / Math.max(1, x0 - xTip);
  const seg = (pts) => {
    const ring = pts.map(([x, y]) => [6 + (x0 - x - xTip) * k, y + dy]);
    return mirrored ? mirror(ring) : ring;
  };
  return buildPiece(pieceName, [
    ["gusset", seg(slice(poly, P.bottomRight, P.tip))],
    ["curve", seg(slice(poly, P.tip, P.topLeft))],
    ["side", seg(slice(poly, P.topLeft, P.bottomLeft))],
    ["hem", seg(slice(poly, P.bottomLeft, P.bottomRight))],
  ]);
}

/** Split a segment's raw polyline in two at a given arc-length fraction —
 *  used to pair one long seam edge against a dart-split opposite edge. */
function splitAt(pts, frac) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  }
  const target = cum[cum.length - 1] * frac;
  let i = 1;
  while (i < cum.length - 1 && cum[i] < target) i++;
  const t = (target - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]);
  const cut = [
    pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t,
    pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t,
  ];
  return [[...pts.slice(0, i), cut], [cut, ...pts.slice(i)]];
}

/** Circle skirt (Sandy): one ring-sector piece cut on fold. We unfold it here
 *  (mirror across the fold edge) so the sim sees the full flat sector; its
 *  inner arc is the whole waist and wraps 2π around the body. */
function circleSkirtPiece() {
  const part = set[cfg.parts.skirt];
  const P = part.points;
  const poly = pathPolyline(part.paths.seam);
  const C = P.center;
  // Work in polar coordinates about the sector centre. The drawn outline runs
  // between the two straight edges (in2..ex2 and in2Flipped..ex2Flipped) with
  // the waist arc (through in1) and hem arc (through ex1) between them.
  const rIn = Math.hypot(P.in1.x - C.x, P.in1.y - C.y);
  const rOut = Math.hypot(P.ex1.x - C.x, P.ex1.y - C.y);
  const angleOf = (pt) => Math.atan2(pt.y - C.y, pt.x - C.x);
  const a0 = angleOf(P.in2);
  const a1 = angleOf(P.in2Flipped);
  // Re-express every boundary point as (theta, r), unfolding across the
  // in2Flipped edge: the drawn sector spans [a0, a1]; the mirror spans
  // [a1, a1 + (a1 - a0)]. We rebuild the outline analytically (arcs are true
  // circles) — more robust than walking the drawn path through macro points.
  const span = a1 - a0;
  const N = 48;
  const arc = (r, t0, t1, n) => {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = t0 + ((t1 - t0) * i) / n;
      pts.push([t, r]); // (theta, r) — converted to flat mm below
    }
    return pts;
  };
  // Flat coordinates for the sim: x = theta * rMid (arc-length-ish), y = r.
  // The sim's circle placement reads thetaSpan/rIn/rOut and re-derives the
  // true angle from x, so the exact flattening only affects mesh density.
  const toFlat = ([t, r]) => [(t - a0) * ((rIn + rOut) / 2), r - rIn];
  const waist = arc(rIn, a0, a0 + 2 * span, N).map(toFlat);
  // Straight edges run radially at each end of the doubled sector.
  const radial = (t, r0, r1, n = 12) => {
    const pts = [];
    for (let i = 0; i <= n; i++) pts.push([t, r0 + ((r1 - r0) * i) / n]);
    return pts.map(toFlat);
  };
  const hem = arc(rOut, a0 + 2 * span, a0, N).map(toFlat);
  const piece = buildPiece("skirt", [
    ["waist", waist],
    ["edgeEnd", radial(a0 + 2 * span, rIn, rOut)],
    ["hem", hem],
    ["edgeStart", radial(a0, rOut, rIn)],
  ]);
  piece.circle = {
    rIn,
    rOut,
    // Total flat angle of the worn garment (the unfolded piece).
    thetaSpan: 2 * span,
    // Flat-x back to angle: theta = x / rMid.
    rMid: (rIn + rOut) / 2,
  };
  return piece;
}

/** Bodice front (Bella "frontSideDart"): cut on fold at CF, a waist dart in
 *  the hem and a side bust dart splitting the side seam — both sewn shut. */
/** Waralee pants piece: one closed outline — waist edges left and right of
 *  the crotch notch, straight overlap-flap side edges, a calf-length hem,
 *  and the cutout (the crotch curve, dipping from the waist to hip depth
 *  at its centre). Cut twice; mirrored for the left leg. */
function waraleePiece(pieceName, mirrored) {
  const part = set[cfg.parts.pants];
  const P = part.points;
  const poly = pathPolyline(part.paths.seam);
  const seg = (pts) => (mirrored ? mirror(pts) : pts);
  // Split the crotch curve into the two rises (above the fork, PINNED like
  // Charlie's riseTopPin — the wrap tension otherwise pulls them open mid-
  // span during the bake) and the under-crotch portion (sewn through the
  // brief body's thigh channel).
  const cutRaw = slice(poly, P.bWaistSide, P.fWaistSide);
  const yCut = P.mHip.y * 0.75;
  const cum = [0];
  for (let i = 1; i < cutRaw.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(cutRaw[i][0] - cutRaw[i - 1][0], cutRaw[i][1] - cutRaw[i - 1][1]));
  }
  let i1 = cutRaw.findIndex(([, yy]) => yy > yCut);
  let i2 = cutRaw.length - 1 - [...cutRaw].reverse().findIndex(([, yy]) => yy > yCut);
  const total = cum[cum.length - 1];
  const f1 = cum[Math.max(1, i1)] / total;
  const f2 = cum[Math.min(cum.length - 1, i2)] / total;
  const [riseB, rest] = splitAt(cutRaw, f1);
  const [under, riseF] = splitAt(rest, (f2 - f1) / (1 - f1));
  return buildPiece(pieceName, [
    ["waistFront", seg(slice(poly, P.fWaistSide, P.fWaistFrontOverlap))],
    ["sideFront", seg(slice(poly, P.fWaistFrontOverlap, P.fLegFrontOverlap))],
    ["hem", seg(slice(poly, P.fLegFrontOverlap, P.bLegBackOverlap))],
    ["sideBack", seg(slice(poly, P.bLegBackOverlap, P.bWaistBackOverlap))],
    ["waistBack", seg(slice(poly, P.bWaistBackOverlap, P.bWaistSide))],
    ["cutoutB", seg(riseB)],
    ["cutoutU", seg(under)],
    ["cutoutF", seg(riseF)],
  ]);
}

/** Noble inside panels: cut on the fold (CF/CB), carrying the neckline and
 *  the inner shoulder segment; the princess seam is their outer edge. The
 *  back's slight CB shaping folds flat (the Bella 12mm fudge). */
function nobleFrontInside() {
  const part = set[cfg.parts.frontInside];
  const P = part.points;
  const poly = pathPolyline(part.paths.seam);
  const princessR = slice(poly, P.waistDartLeft, P.shoulderDartInside);
  const shoulderR = slice(poly, P.shoulderDartInside, P.hps);
  const neckR = slice(poly, P.hps, P.cfNeck);
  const hemR = slice(poly, P.cfHem, P.waistDartLeft);
  return buildPiece("frontInside", [
    ["princessR", princessR],
    ["shoulderR", shoulderR],
    ["neckR", neckR],
    ["neckL", mirror([...neckR].reverse())],
    ["shoulderL", mirror([...shoulderR].reverse())],
    ["princessL", mirror([...princessR].reverse())],
    ["hemL", mirror([...hemR].reverse())],
    ["hemR", hemR],
  ]);
}

function nobleBackInside() {
  const part = set[cfg.parts.backInside];
  const P = part.points;
  const poly = pathPolyline(part.paths.insideSeam);
  const hemR = slice(poly, P.waistCenter, P.dartBottomLeft);
  const princessR = slice(poly, P.dartBottomLeft, P.shoulderDart);
  const shoulderR = slice(poly, P.shoulderDart, P.hps);
  const neckR = slice(poly, P.hps, P.cbNeck);
  return buildPiece("backInside", [
    ["hemR", hemR],
    ["princessR", princessR],
    ["shoulderR", shoulderR],
    ["neckR", neckR],
    ["neckL", mirror([...neckR].reverse())],
    ["shoulderL", mirror([...shoulderR].reverse())],
    ["princessL", mirror([...princessR].reverse())],
    ["hemL", mirror([...hemR].reverse())],
  ]);
}

/** Noble outside panels: cut in pairs, drafted in their own frame. Shift x
 *  so the princess foot butts the inside panel's foot for the plane wrap
 *  (the Carlita side-panel lesson); mirror for the left side. */
function nobleOutside(partName, pieceName, mirrored, A, insideFootX) {
  const part = set[partName];
  const P = part.points;
  const poly = pathPolyline(part.paths[A.path]);
  const dx = insideFootX - P[A.foot].x;
  const seg = (pts) => {
    const shifted = pts.map(([x, y]) => [x + dx, y]);
    return mirrored ? mirror(shifted) : shifted;
  };
  return buildPiece(pieceName, [
    ["hem", seg(slice(poly, P[A.foot], P[A.sideHem]))],
    ["side", seg(slice(poly, P[A.sideHem], P.armhole))],
    ["armscye", seg(slice(poly, P.armhole, P[A.shoulderOut]))],
    ["shoulder", seg(slice(poly, P[A.shoulderOut], P[A.shoulderIn]))],
    ["princess", seg(slice(poly, P[A.shoulderIn], P[A.foot]))],
  ]);
}

/** Breanna front: half draft with the CF a couple of mm off x=0 (shift it
 *  back before mirroring) and TWO rotatable bust darts. With the studio's
 *  small-cup measurement set (bustFront barely past highBustFront) both
 *  darts draft as millimetre slivers whose feet land ON the hem/side lines
 *  — triangulating a 2-8mm notch 150mm deep shreds the cloth mesh, so
 *  sliver darts are COLLAPSED (their feet weld via buildPiece's shared-
 *  endpoint dedupe). A fuller-cup draft makes the primary dart a real
 *  wedge, and then it is cut and sewn exactly like Bella's. */
function breannaFront() {
  const part = set[cfg.parts.front];
  const dx = -part.points.cfNeck.x;
  const P = Object.fromEntries(
    Object.entries(part.points).map(([k, p]) => [k, { x: p.x + dx, y: p.y }]),
  );
  const poly = pathPolyline(part.paths.seam).map(([x, y]) => [x + dx, y]);
  const dartW = Math.hypot(
    P.primaryBustDart1.x - P.primaryBustDart2.x,
    P.primaryBustDart1.y - P.primaryBustDart2.y,
  );
  const slim = dartW < 6;
  const hem1R = slice(poly, P.cfWaist, P.primaryBustDart1);
  const wdartLR = slice(poly, P.primaryBustDart1, P.primaryBustDartTip);
  const wdartRR = slice(poly, P.primaryBustDartTip, P.primaryBustDart2);
  const hem2R = slice(poly, P.primaryBustDart2, P.waist);
  const sideR = slice(poly, P.waist, P.secondaryBustDart1);
  const armscyeR = slice(poly, P.secondaryBustDart2, P.shoulder);
  const shoulderR = slice(poly, P.shoulder, P.hps);
  const neckR = slice(poly, P.hps, P.cfNeck);
  const dartSegsR = slim ? [] : [["wdartLR", wdartLR], ["wdartRR", wdartRR]];
  const dartSegsL = slim
    ? []
    : [["wdartRL", mirror([...wdartRR].reverse())], ["wdartLL", mirror([...wdartLR].reverse())]];
  return buildPiece("front", [
    ["hem1R", hem1R],
    ...dartSegsR,
    ["hem2R", hem2R],
    ["sideR", sideR],
    ["armscyeR", armscyeR],
    ["shoulderR", shoulderR],
    ["neckR", neckR],
    ["neckL", mirror([...neckR].reverse())],
    ["shoulderL", mirror([...shoulderR].reverse())],
    ["armscyeL", mirror([...armscyeR].reverse())],
    ["sideL", mirror([...sideR].reverse())],
    ["hem2L", mirror([...hem2R].reverse())],
    ...dartSegsL,
    ["hem1L", mirror([...hem1R].reverse())],
  ]);
}

/** Breanna back: half draft on the CB fold, one waist dart per side. */
function breannaBack() {
  const part = set[cfg.parts.back];
  const P = part.points;
  const poly = pathPolyline(part.paths.seam);
  const hem1R = slice(poly, P.cbWaist, P.waistDart1);
  const dartLR = slice(poly, P.waistDart1, P.waistDartTip);
  const dartRR = slice(poly, P.waistDartTip, P.waistDart2);
  const hem2R = slice(poly, P.waistDart2, P.waist);
  const sideR = slice(poly, P.waist, P.armhole);
  const armscyeR = slice(poly, P.armhole, P.shoulder);
  const shoulderR = slice(poly, P.shoulder, P.hps);
  const neckR = slice(poly, P.hps, P.cbNeck);
  return buildPiece("back", [
    ["hem1R", hem1R],
    ["dartLR", dartLR],
    ["dartRR", dartRR],
    ["hem2R", hem2R],
    ["sideR", sideR],
    ["armscyeR", armscyeR],
    ["shoulderR", shoulderR],
    ["neckR", neckR],
    ["neckL", mirror([...neckR].reverse())],
    ["shoulderL", mirror([...shoulderR].reverse())],
    ["armscyeL", mirror([...armscyeR].reverse())],
    ["sideL", mirror([...sideR].reverse())],
    ["hem2L", mirror([...hem2R].reverse())],
    ["dartRL", mirror([...dartRR].reverse())],
    ["dartLL", mirror([...dartLR].reverse())],
    ["hem1L", mirror([...hem1R].reverse())],
  ]);
}

function bodiceFront() {
  const part = set[cfg.parts.front];
  const P = part.points;
  const poly = pathPolyline(part.paths.seam);
  const hem1R = slice(poly, P.cfHem, P.waistDartLeft);
  const wdartLR = slice(poly, P.waistDartLeft, P.waistDartTip);
  const wdartRR = slice(poly, P.waistDartTip, P.waistDartRight);
  const hem2R = slice(poly, P.waistDartRight, P.sideHem);
  const sideLoR = slice(poly, P.sideHem, P.bustDartBottom);
  const bdartLR = slice(poly, P.bustDartBottom, P.bustDartTip);
  const bdartRR = slice(poly, P.bustDartTip, P.bustDartTop);
  const sideUpR = slice(poly, P.bustDartTop, P.armhole);
  const armscyeR = slice(poly, P.armhole, P.shoulder);
  const shoulderR = slice(poly, P.shoulder, P.hps);
  const neckR = slice(poly, P.hps, P.cfNeck);
  const piece = buildPiece("front", [
    ["hem1R", hem1R],
    ["wdartLR", wdartLR],
    ["wdartRR", wdartRR],
    ["hem2R", hem2R],
    ["sideLoR", sideLoR],
    ["bdartLR", bdartLR],
    ["bdartRR", bdartRR],
    ["sideUpR", sideUpR],
    ["armscyeR", armscyeR],
    ["shoulderR", shoulderR],
    ["neckR", neckR],
    ["neckL", mirror([...neckR].reverse())],
    ["shoulderL", mirror([...shoulderR].reverse())],
    ["armscyeL", mirror([...armscyeR].reverse())],
    ["sideUpL", mirror([...sideUpR].reverse())],
    ["bdartRL", mirror([...bdartRR].reverse())],
    ["bdartLL", mirror([...bdartLR].reverse())],
    ["sideLoL", mirror([...sideLoR].reverse())],
    ["hem2L", mirror([...hem2R].reverse())],
    ["wdartRL", mirror([...wdartRR].reverse())],
    ["wdartLL", mirror([...wdartLR].reverse())],
    ["hem1L", mirror([...hem1R].reverse())],
  ]);
  // Where the bust dart splits the front side seam, as a fraction of the
  // full side length — the back side seam is split at the same fraction so
  // the two seam halves pair up point-by-point.
  const loLen = segLen(sideLoR);
  piece.sideSplitFrac = loLen / (loLen + segLen(sideUpR));
  return piece;
}

/** Bodice back (Bella): half draft mirrored (the slight CB shaping is folded
 *  flat — a 12 mm fudge the drape can't see), one waist dart per side. */
function bodiceBack(splitFrac) {
  const part = set[cfg.parts.back];
  const P = part.points;
  const poly = pathPolyline(part.paths.seam);
  const hem1R = slice(poly, P.waistCenter, P.dartBottomLeft);
  const dartLR = slice(poly, P.dartBottomLeft, P.dartTip);
  const dartRR = slice(poly, P.dartTip, P.dartBottomRight);
  const hem2R = slice(poly, P.dartBottomRight, P.waistSide);
  const sideFull = slice(poly, P.waistSide, P.armhole);
  // Split the back side seam where the front's bust dart lands, so the front
  // (dart-split) and back side edges sew as two matched pairs.
  const [sideLoR, sideUpR] = splitAt(sideFull, splitFrac);
  const armscyeR = slice(poly, P.armhole, P.shoulder);
  const shoulderR = slice(poly, P.shoulder, P.hps);
  const neckR = slice(poly, P.hps, P.cbNeck);
  return buildPiece("back", [
    ["hem1R", hem1R],
    ["dartLR", dartLR],
    ["dartRR", dartRR],
    ["hem2R", hem2R],
    ["sideLoR", sideLoR],
    ["sideUpR", sideUpR],
    ["armscyeR", armscyeR],
    ["shoulderR", shoulderR],
    ["neckR", neckR],
    ["neckL", mirror([...neckR].reverse())],
    ["shoulderL", mirror([...shoulderR].reverse())],
    ["armscyeL", mirror([...armscyeR].reverse())],
    ["sideUpL", mirror([...sideUpR].reverse())],
    ["sideLoL", mirror([...sideLoR].reverse())],
    ["hem2L", mirror([...hem2R].reverse())],
    ["dartRL", mirror([...dartRR].reverse())],
    ["dartLL", mirror([...dartLR].reverse())],
    ["hem1L", mirror([...hem1R].reverse())],
  ]);
}

/** Two-piece sleeves: one shared ring per arm. Both long seams curve
 *  inward in pattern-x (the pieces share elbow/wrist points), so a linear
 *  taper can't keep the paired edges coincident — measure the four edge
 *  x's per height instead and let the sim wrap the exact local ring
 *  (rows [y, xLtop, xRtop, xLunder, xRunder]). capTopY: both pieces hang
 *  in the topsleeve's shared y-frame. */
function buildTwoPieceSleeves() {
  const tsP = set[cfg.parts.topsleeve].points;
  const usP = set[cfg.parts.undersleeve].points;
  const tsPoly = pathPolyline(set[cfg.parts.topsleeve].paths.seam);
  const usPoly = pathPolyline(set[cfg.parts.undersleeve].paths.seam);
  const xOfY = (pts, yy) => {
    const rows = [...pts].sort((a, b) => a[1] - b[1]);
    if (yy <= rows[0][1]) return rows[0][0];
    for (let i = 1; i < rows.length; i++) {
      if (yy <= rows[i][1]) {
        const t = (yy - rows[i - 1][1]) / Math.max(1e-6, rows[i][1] - rows[i - 1][1]);
        return rows[i - 1][0] + (rows[i][0] - rows[i - 1][0]) * t;
      }
    }
    return rows[rows.length - 1][0];
  };
  const edges = [
    slice(tsPoly, tsP.tsLeftEdge, tsP.tsWristLeft),
    slice(tsPoly, tsP.tsWristRight, tsP.tsRightEdge),
    slice(usPoly, usP.usLeftEdge, usP.usWristLeft),
    slice(usPoly, usP.usWristRight, usP.usRightEdge),
  ];
  const ringProfile = [];
  const yRingTop = tsP.tsLeftEdge.y;
  const yRingBot = Math.max(tsP.tsWristRight.y, usP.usWristRight.y);
  for (let i = 0; i <= 24; i++) {
    const yy = yRingTop + ((yRingBot - yRingTop) * i) / 24;
    ringProfile.push([yy, ...edges.map((e) => xOfY(e, yy))]);
  }
  const out = [];
  for (const dir of [1, -1]) {
    const side = dir > 0 ? "R" : "L";
    const top = twoPieceSleeve("topsleeve", `topsleeve_${side}`);
    const under = twoPieceSleeve("undersleeve", `undersleeve_${side}`);
    top.placement = { kind: "sleeve", dir, role: "top", ringProfile, capTopY: 0 };
    under.placement = { kind: "sleeve", dir, role: "under", ringProfile, capTopY: 0 };
    out.push(top, under);
  }
  return out;
}

const hasSleeves = Boolean(cfg.parts.sleeve);
const sleeves = hasSleeves ? [sleevePiece("R"), sleevePiece("L")] : [];

let bodyPieces;
if (cfg.trousers) {
  // Right leg wears the drafted panels as-is; the left leg wears mirrors.
  // (Titan's front is drafted with the outseam near x=0 and the inseam
  // outboard; the sim's leg wrap reads the edges profile either way.)
  // The sim's leg wrap assumes Titan's BACK convention: inseam/crotch near
  // x=0, mirrored relative to the front. Blocks that draft their back
  // front-oriented (Shin) flip it here, or the back inseam wraps to the
  // outseam side and every crotch seam starts half a tube away.
  const bm = Boolean(cfg.trouserBackMirrored);
  const frontR = trouserPanel(cfg.parts.front, "frontR", false);
  const backR = trouserPanel(cfg.parts.back, "backR", bm);
  const frontL = trouserPanel(cfg.parts.front, "frontL", true);
  const backL = trouserPanel(cfg.parts.back, "backL", !bm);
  frontR.placement = { kind: "leg", leg: 1, panel: "front" };
  backR.placement = { kind: "leg", leg: 1, panel: "back" };
  frontL.placement = { kind: "leg", leg: -1, panel: "front" };
  backL.placement = { kind: "leg", leg: -1, panel: "back" };
  for (const p of [frontR, backR, frontL, backL]) {
    p.pinSegments = ["waist"]; // waistband grip; seams close by stitching
  }
  bodyPieces = [frontR, backR, frontL, backL];
} else if (cfg.skirt) {
  const front = skirtPanel(cfg.parts.front, "front");
  const back = skirtPanel(cfg.parts.back, "back");
  front.placement = { kind: "plane", y: -160 };
  back.placement = { kind: "plane", y: 160 };
  front.pinSegments = ["waistR", "waistL"];
  back.pinSegments = ["waistR", "waistL"];
  bodyPieces = [front, back];
} else if (cfg.brief) {
  const front = briefFront();
  const back = briefBack();
  const gusset = briefGusset();
  // Panels wrap the hip shell exactly like a short skirt; the waistband is a
  // mid-body top edge, not a shoulder, so it must not collapse to a hang line.
  front.placement = { kind: "plane", y: -160, hangCollapse: false };
  back.placement = { kind: "plane", y: 160, hangCollapse: false };
  // The gusset bridges the panels' bottom edges under the crotch keel. Its
  // placement needs its own pattern-y span (y0..y1, front edge to back edge)
  // and the two attach heights (the panels' edge pattern-y, yF/yB).
  const gys = gusset.points.map(([, y]) => y);
  gusset.placement = {
    kind: "gusset",
    y0: Math.min(...gys),
    y1: Math.max(...gys),
    yF: set[cfg.parts.front].points.frontGussetSplit.y,
    yB: Math.max(...back.points.map(([, y]) => y)),
  };
  front.pinSegments = ["waistR", "waistL"];
  back.pinSegments = ["waistR", "waistL"];
  bodyPieces = [front, back, gusset];
} else if (cfg.bruce) {
  // Boxer briefs: hip panels (front pouch, back, two sides) + two thigh
  // insets. The crotch closes from three directions — back wings meet the
  // inset tips at the inner thighs and the front tusks under the pouch —
  // so each wing edge is pre-split at the drafted tusk/inset length ratio.
  const FP = set[cfg.parts.front].points;
  const IP = set[cfg.parts.inset].points;
  const tuskLen = FP.rightTuskRight.dist(FP.rightTuskLeft);
  const insetGussetLen = IP.bottomRight.dist(IP.tip);
  const front = bruceFront();
  const back = bruceBack(tuskLen / (tuskLen + insetGussetLen));
  const sideL = bruceSide("sideL", false);
  const sideR = bruceSide("sideR", true);
  const insetR = bruceInset("insetR", false);
  const insetL = bruceInset("insetL", true);
  // Hip panels share ONE wrap frame (the noble/carlita lesson): the sides'
  // arc x continues past the front's edge, so per-piece width scaling would
  // land the butted seam edges apart. But a RAW shared frame (f=1) fails
  // the other way: the front face carries front + both sides (~300mm arc
  // half-extent) — more than the shell's half-circumference — so the wrap
  // clamps both side panels at the lateral line in a bunched wing and the
  // back seams start ~200mm open. The honest frame is the garment's own
  // ring: per height, front-face extent + back extent IS the cloth that
  // wraps the body's half-circumference, so every piece scales by that
  // shared sum and the sides' back edges land where the back panel ends
  // (bruce drafts the back at 31.5% of the girth — the side/back seam
  // sits well behind the lateral line, and now the wrap agrees).
  front.placement = { kind: "plane", y: -160, hangCollapse: false, ringWrap: true };
  // The wing region (below gussetTop) pre-sweeps under the keel to the
  // front face where its tusk/inset seam partners sit — bake 5's crotch
  // pairs started at 286mm on springs alone and never closed.
  const BPn = set[cfg.parts.back].points;
  back.placement = {
    kind: "plane", y: 160, hangCollapse: false, ringWrap: true,
    tongue: {
      y0: BPn.gussetTop.y, y1: BPn.gussetBottom.y, yF: FP.rightTuskLeft.y,
      xC0: 0, xC1: Math.abs(BPn.gussetRight.x),
      xL0: Math.abs(BPn.legRight.x), xL1: Math.abs(BPn.gussetRight.x),
    },
  };
  sideL.placement = { kind: "plane", y: -160, hangCollapse: false, ringWrap: true };
  sideR.placement = { kind: "plane", y: -160, hangCollapse: false, ringWrap: true };
  const profOf = (pts) => widthProfile({ points: pts });
  const wAt = (prof, y) => {
    if (y <= prof[0][0]) return prof[0][1];
    for (let i = 1; i < prof.length; i++) {
      if (y <= prof[i][0]) {
        const t = (y - prof[i - 1][0]) / Math.max(1e-6, prof[i][0] - prof[i - 1][0]);
        return prof[i - 1][1] + (prof[i][1] - prof[i - 1][1]) * t;
      }
    }
    return prof[prof.length - 1][1];
  };
  const wFront = profOf([...front.points, ...sideL.points, ...sideR.points]);
  const wBack = profOf(back.points);
  const ys = [...new Set([...wFront, ...wBack].map(([y]) => y))].sort((a, b) => a - b);
  const combined = ys.map((y) => [y, wAt(wFront, y) + wAt(wBack, y)]);
  // The insets ride the same ring, tips layered over the tusks (and each
  // other) around CF like a placket stack — the crotch seams pull the
  // layers apart and under during the bake.
  // Same outset both sides: clamped at CF they no longer overlap each
  // other, only the tusk layer beneath.
  insetR.placement = { kind: "plane", y: -160, hangCollapse: false, ringWrap: true, outset: 6 };
  insetL.placement = { kind: "plane", y: -160, hangCollapse: false, ringWrap: true, outset: 6 };
  for (const p of [front, back, sideL, sideR, insetR, insetL]) {
    p.uniformWrap = true; // keep the generic pass from overwriting it
    p.widthProfile = combined;
  }
  front.pinSegments = ["waistR", "waistL"];
  back.pinSegments = ["waistR", "waistL"];
  sideL.pinSegments = ["waist"];
  sideR.pinSegments = ["waist"];
  bodyPieces = [front, back, sideL, sideR, insetR, insetL];
} else if (cfg.circleSkirt) {
  const skirt = circleSkirtPiece();
  skirt.placement = { kind: "circle", ...skirt.circle };
  skirt.pinSegments = ["waist"];
  bodyPieces = [skirt];
} else if (cfg.bodice) {
  const front = bodiceFront();
  const back = bodiceBack(front.sideSplitFrac);
  front.placement = { kind: "plane", y: -160 };
  back.placement = { kind: "plane", y: 160 };
  bodyPieces = [front, back];
} else if (cfg.breanna) {
  const front = breannaFront();
  const back = breannaBack();
  front.placement = { kind: "plane", y: -160 };
  back.placement = { kind: "plane", y: 160 };
  bodyPieces = [front, back];
} else if (cfg.wrapPants) {
  // Both pieces are the SAME cut — no mirror: the placement's leg sign
  // mirrors world positions, and identical flat coords keep the bridged
  // crotch pairing exact.
  const pantsR = waraleePiece("pantsR", false);
  const pantsL = waraleePiece("pantsL", false);
  const WP = set[cfg.parts.pants].points;
  const forkY = WP.mHip.y;
  // Crotch-notch edge x per height (front branch negative, back positive):
  // the sim anchors the leg wrap to THIS edge so both pieces' seam edges
  // start on the mid-plane at every height — and the mapping stays
  // continuous where the notch closes at the fork (edges -> 0).
  const cutSeg = (() => {
    const n = pantsR.points.length;
    const out = [];
    for (const nm of ["cutoutB", "cutoutU", "cutoutF"]) {
      const [s0, e0] = pantsR.segments[nm];
      let i = s0;
      for (;;) {
        out.push(pantsR.points[i % n]);
        if (i % n === e0 % n) break;
        i++;
      }
    }
    return out;
  })();
  const branchX = (pts, yy) => {
    let best = pts[0];
    for (const q of pts) if (Math.abs(q[1] - yy) < Math.abs(best[1] - yy)) best = q;
    return best[0];
  };
  const frontBranch = cutSeg.filter(([x]) => x <= 0);
  const backBranch = cutSeg.filter(([x]) => x >= 0);
  const cutoutProfile = [];
  for (let k = 0; k <= 12; k++) {
    const yy = ((forkY - 1) * k) / 12;
    cutoutProfile.push([yy, branchX(frontBranch, yy), branchX(backBranch, yy)]);
  }
  const cut = { cutF: WP.fWaistSide.x, cutB: WP.bWaistSide.x, cutoutProfile };
  pantsR.placement = { kind: "legTube", leg: 1, forkY, layerBias: 0, ...cut };
  pantsL.placement = { kind: "legTube", leg: -1, forkY, layerBias: 1, ...cut };
  // The wrap ties at the waist: both waist edges pinned, like every
  // trouser block's waistband grip.
  pantsR.pinSegments = ["waistFront", "waistBack"];
  pantsL.pinSegments = ["waistFront", "waistBack"];
  bodyPieces = [pantsR, pantsL];
} else if (cfg.noble) {
  const frontIn = nobleFrontInside();
  const backIn = nobleBackInside();
  const fiFoot = set[cfg.parts.frontInside].points.waistDartLeft.x;
  const biFoot = set[cfg.parts.backInside].points.dartBottomLeft.x;
  const FO = {
    path: "seam", foot: "waistDartRight", sideHem: "sideHemInitial",
    shoulderOut: "shoulder", shoulderIn: "shoulderDartOutside",
  };
  const BO = {
    path: "outsideSeam", foot: "dartBottomRight", sideHem: "waistSide",
    shoulderOut: "shoulder", shoulderIn: "shoulderDart",
  };
  const frontOutR = nobleOutside(cfg.parts.frontOutside, "frontOutR", false, FO, fiFoot);
  const frontOutL = nobleOutside(cfg.parts.frontOutside, "frontOutL", true, FO, fiFoot);
  const backOutR = nobleOutside(cfg.parts.backOutside, "backOutR", false, BO, biFoot);
  const backOutL = nobleOutside(cfg.parts.backOutside, "backOutL", true, BO, biFoot);
  frontIn.placement = { kind: "plane", y: -160 };
  // The outside panels' TOP edge (min-y per x-bin) is mostly their princess
  // curve, and the hang-line collapse would drag that whole seam edge to
  // the mid-plane while the inside panel's edge sits at wrapped depth —
  // ~100mm of pure depth mismatch. They hang from seams, not a shoulder
  // line: keep them at wrapped depth (the coat-tail rule).
  frontOutR.placement = { kind: "plane", y: -160, hangCollapse: false };
  frontOutL.placement = { kind: "plane", y: -160, hangCollapse: false };
  backIn.placement = { kind: "plane", y: 160 };
  backOutR.placement = { kind: "plane", y: 160, hangCollapse: false };
  backOutL.placement = { kind: "plane", y: 160, hangCollapse: false };
  // Rigidly align each outside panel onto its inside partner's princess
  // edge (2D Kabsch over arc-fraction-paired edge samples). The two edge
  // curves bow in OPPOSITE directions and spread their length over
  // different heights — the bust shaping — so no axis shift can butt them;
  // a rotation+translation is rest-length-legal and leaves the springs
  // only the true shaping residual. Seam pairs match by arc fraction, and
  // the inside edge walks waist→shoulder while the outside walks
  // shoulder→waist, hence the reverse.
  const segPts = (piece, segName) => {
    const [s, e] = piece.segments[segName];
    const n = piece.points.length;
    const out = [];
    let i = s;
    for (;;) {
      out.push(piece.points[i % n]);
      if (i % n === e % n) break;
      i++;
    }
    return out;
  };
  const rigidAlign = (piece, segName, targetPts) => {
    const src = resample(segPts(piece, segName), 40);
    const cx = (pts) => pts.reduce((s, p) => s + p[0], 0) / pts.length;
    const cy = (pts) => pts.reduce((s, p) => s + p[1], 0) / pts.length;
    const sx = cx(src), sy = cy(src);
    // The seam walk direction differs between R pieces and their mirrored
    // L twins — fit both pairings and keep the one that actually matches.
    const fit = (dst) => {
      const tx = cx(dst), ty = cy(dst);
      let dot = 0, cross = 0;
      for (let i = 0; i < src.length; i++) {
        const ax = src[i][0] - sx, ay = src[i][1] - sy;
        const bx = dst[i][0] - tx, by = dst[i][1] - ty;
        dot += ax * bx + ay * by;
        cross += ax * by - ay * bx;
      }
      const ang = Math.atan2(cross, dot);
      const c = Math.cos(ang), s = Math.sin(ang);
      let res = 0;
      for (let i = 0; i < src.length; i++) {
        const ax = src[i][0] - sx, ay = src[i][1] - sy;
        res += Math.hypot(tx + ax * c - ay * s - dst[i][0], ty + ax * s + ay * c - dst[i][1]);
      }
      return { tx, ty, c, s, res };
    };
    const f1 = fit(resample(targetPts, 40));
    const f2 = fit(resample([...targetPts].reverse(), 40));
    // A near-straight seam fits both walk directions almost equally well,
    // and the wrong one lands the panel body on the WRONG side of the seam
    // (across the centre front). The body must stay on the same side of
    // the seam as the builder placed it — outboard — so decide by side,
    // residual only as tie-break.
    const pcx = cx(piece.points), pcy = cy(piece.points);
    const sideBefore = Math.sign(pcx - sx);
    const tgx = cx(targetPts);
    const sideAfter = (f) => {
      const rx = pcx - sx, ry = pcy - sy;
      return Math.sign(f.tx + rx * f.c - ry * f.s - tgx);
    };
    const ok1 = sideAfter(f1) === sideBefore;
    const ok2 = sideAfter(f2) === sideBefore;
    const f = ok1 && ok2 ? (f1.res <= f2.res ? f1 : f2) : ok1 ? f1 : f2;
    piece.points = piece.points.map(([x, y]) => {
      const rx = x - sx, ry = y - sy;
      return [f.tx + rx * f.c - ry * f.s, f.ty + rx * f.s + ry * f.c];
    });
  };
  rigidAlign(frontOutR, "princess", segPts(frontIn, "princessR"));
  rigidAlign(frontOutL, "princess", segPts(frontIn, "princessL"));
  rigidAlign(backOutR, "princess", segPts(backIn, "princessR"));
  rigidAlign(backOutL, "princess", segPts(backIn, "princessL"));
  for (const piece of [frontIn, frontOutR, frontOutL, backIn, backOutR, backOutL]) {
    piece.uniformWrap = true;
  }
  bodyPieces = [frontIn, frontOutR, frontOutL, backIn, backOutR, backOutL];
} else if (cfg.dressPanels) {
  const front = dressPanel(cfg.parts.front, "front");
  const back = dressPanel(cfg.parts.back, "back");
  front.placement = { kind: "plane", y: -160 };
  back.placement = { kind: "plane", y: 160 };
  bodyPieces = [front, back];
} else if (cfg.tabard) {
  const front = tabardPiece(cfg.parts.front, "front");
  const back = tabardPiece(cfg.parts.back, "back");
  front.placement = { kind: "plane", y: -160 };
  back.placement = { kind: "plane", y: 160 };
  bodyPieces = [front, back];
} else if (cfg.coat) {
  // Wearer's left front lies on top of the double-breasted overlap (outset
  // like the buttoned shirts); the whole placket is pinned shut — a walking
  // coat's skirt flap can swing open in life, but an open 136mm overlap of
  // free-hanging layers just interpenetrates in the sim.
  const frontL = cfg.sidePanel ? carlitaFront("frontL", false) : coatFront("frontL", false);
  const frontR = cfg.sidePanel ? carlitaFront("frontR", true) : coatFront("frontR", true);
  const back = coatBack();
  const tail = tailPiece(set[cfg.parts.back].points.cbWaist.y);
  frontL.placement = { kind: "plane", y: -160, outset: 5 };
  frontR.placement = { kind: "plane", y: -160 };
  back.placement = { kind: "plane", y: 160 };
  // The tail hangs from the waist seam, not a shoulder: keep it at wrapped
  // depth all the way up instead of collapsing toward a hang line.
  tail.placement = { kind: "plane", y: 160, hangCollapse: false };
  frontL.pinSegments = ["placket"];
  frontR.pinSegments = ["placket"];
  frontL.pinStride = 6;
  frontR.pinStride = 6;
  bodyPieces = [frontL, frontR, back, tail];
  if (cfg.sidePanel) {
    // Three-panel body: the side panels wrap the front shell too — their
    // draft x starts where the front panel seam ends, so the plane wrap
    // lands them between the front edge and the side line.
    const sideL = carlitaSide("sideL", false);
    const sideR = carlitaSide("sideR", true);
    sideL.placement = { kind: "plane", y: -160 };
    sideR.placement = { kind: "plane", y: -160 };
    bodyPieces = [frontL, frontR, sideL, sideR, back, tail];
  }
  sleeves.push(...buildTwoPieceSleeves());
} else if (cfg.jacket) {
  // Jacket base (Bent): the plain cut-on-fold body with the tailored
  // two-piece sleeve — the coats' sleeve machinery without the coat body.
  const front = bodyPiece(cfg.parts.front, "front");
  const back = bodyPiece(cfg.parts.back, "back");
  front.placement = { kind: "plane", y: -160 };
  back.placement = { kind: "plane", y: 160 };
  bodyPieces = [front, back];
  sleeves.push(...buildTwoPieceSleeves());
} else if (cfg.waistcoat) {
  // The drafted front's body extends to +x (wearer's left panel).
  const frontL = waistcoatFront("frontL", false);
  const frontR = waistcoatFront("frontR", true);
  const back = waistcoatBack();
  frontL.placement = { kind: "plane", y: -160, outset: 5 };
  frontR.placement = { kind: "plane", y: -160 };
  back.placement = { kind: "plane", y: 160 };
  frontL.pinSegments = ["placket"];
  frontR.pinSegments = ["placket"];
  frontL.pinStride = 4;
  frontR.pinStride = 4;
  bodyPieces = [frontL, frontR, back];
} else if (cfg.crossFront) {
  // The drafted panel's body extends to +x (wearer's left front); it lies on
  // top of the mirrored right front with a small outset so the crossover
  // layers instead of interpenetrating. Buttons hold the wrap: pin the upper
  // (diagonal) opening edge at button spacing, leave the skirt edge free.
  const frontL = crossFrontPanel("frontL", false);
  const frontR = crossFrontPanel("frontR", true);
  const back = crossBack();
  frontL.placement = { kind: "plane", y: -160, outset: 5 };
  frontR.placement = { kind: "plane", y: -160 };
  frontL.pinSegments = ["cross"];
  frontR.pinSegments = ["cross"];
  frontL.pinStride = 4;
  frontR.pinStride = 4;
  back.placement = { kind: "plane", y: 160 };
  bodyPieces = [frontL, frontR, back];
} else if (cfg.zipFront) {
  // The drafted half's body extends to +x (wearer's left panel). Zip edges
  // butt rather than overlap, so no outset on either panel.
  const frontL = zipFrontHalf("frontL", false);
  const frontR = zipFrontHalf("frontR", true);
  const back = bodyPiece(cfg.parts.back, "back");
  frontL.placement = { kind: "plane", y: -160 };
  frontR.placement = { kind: "plane", y: -160 };
  back.placement = { kind: "plane", y: 160 };
  // The zip is SEWN (springs), not pinned: both edges place coincident at
  // CF, and pinning two coincident cloth layers makes self-collision fight
  // the pins into a dark trench down the front.
  bodyPieces = [frontL, frontR, back];
} else if (cfg.buttonFront) {
  // Wearer's left panel (frontLeft, body on +x) carries the button stand and
  // lies on top; it gets a small outward offset so the closed placket layers
  // instead of interpenetrating. Both plackets are pinned shut (buttoned).
  const frontR = frontPanel(cfg.parts.frontR, "frontR");
  const frontL = frontPanel(cfg.parts.frontL, "frontL");
  const back = shirtBackPiece();
  const yoke = yokePiece();
  frontR.placement = { kind: "plane", y: -160 };
  frontL.placement = { kind: "plane", y: -160, outset: 5 };
  back.placement = { kind: "plane", y: 160 };
  yoke.placement = { kind: "plane", y: 160 };
  // Pin the plackets at button spacing, not continuously: a fully rigid CF
  // line fights the wrapped panel's longer path over the chest and compresses
  // the fronts into horizontal ripples. Buttons every ~4th boundary point
  // (~50mm) hold the shirt closed and let the fabric relax between them.
  frontR.pinSegments = ["placket"];
  frontL.pinSegments = ["placket"];
  frontR.pinStride = 4;
  frontL.pinStride = 4;
  bodyPieces = [frontR, frontL, back, yoke];
} else {
  const front = bodyPiece(cfg.parts.front, "front");
  const back = bodyPiece(cfg.parts.back, "back");
  front.placement = { kind: "plane", y: -160 };
  back.placement = { kind: "plane", y: 160 };
  bodyPieces = [front, back];
}

// 3D placement hints. Body pieces wrap an elliptical shell (front/back sign);
// sleeves wrap tubes around the mannequin's tilted arm stubs.
const chestHalf = Math.max(...bodyPieces[0].points.map(([x]) => Math.abs(x)));
for (const p of bodyPieces) {
  p.topProfile = topProfile(p);
  // Multi-panel faces (princess bodices) must share ONE wrap scale: with
  // per-piece width profiles, the same pattern x maps to different arc
  // positions on neighbouring panels and their sewn seam edges land apart.
  if (!p.uniformWrap) p.widthProfile = widthProfile(p);
}

if (hasSleeves) {
  // Taper hints: half-width at the biceps line (pattern y=0) and at the hem,
  // so the sim wraps a cone rather than a cylinder (a straight tube around a
  // tapered sleeve leaves an open wedge along the forearm).
  const sp = set[cfg.parts.sleeve].points;
  const w0 = Math.abs(sp.bicepsRight.x);
  const hemPt = sp[cfg.sleeveAnchors.hemR];
  const taper = { w0, w1: Math.abs(hemPt.x), y1: hemPt.y };
  // Raglan sleeves sweep their above-biceps zone toward the neck; neckX is
  // where the raglan tips land on the body (the neckline edge).
  const raglan = cfg.raglan
    ? {
        raglan: true,
        neckX: Math.abs(set[cfg.parts.front].points.raglanTipFront.x) + 15,
        // Where the biceps line sits below the shoulder: the body armhole
        // depth. (For raglan, pattern-y above 0 is shoulder, not arm length.)
        armDepth: set[cfg.parts.front].points.armhole.y,
      }
    : {};
  // Ribbed cuffs grip the wrist: pin the sleeve hem ring so the sleeve
  // blouses naturally instead of accordion-sliding down the arm.
  const pinSegments = cfg.cuffed ? ["hem"] : [];
  sleeves[0].placement = { kind: "sleeve", dir: 1, ...taper, ...raglan };
  sleeves[1].placement = { kind: "sleeve", dir: -1, ...taper, ...raglan };
  sleeves[0].pinSegments = pinSegments;
  sleeves[1].pinSegments = pinSegments;
}

/** A seam joins segment a of one piece to segment b of another, matched
 *  point-by-point after resampling both to the same count (the sim
 *  auto-orients direction from world-space endpoints). Shoulders are pinned
 *  — the garment hangs from them on the ghost mannequin. */
const seams = cfg.trousers
  ? [
      // Hangs from the pinned waist. Out/in seams close each leg's tube;
      // crotch curves join the two legs at CF and CB.
      { name: "outseam_R", a: ["frontR", "outseam"], b: ["backR", "outseam"] },
      { name: "inseam_R", a: ["frontR", "inseam"], b: ["backR", "inseam"] },
      { name: "outseam_L", a: ["frontL", "outseam"], b: ["backL", "outseam"] },
      { name: "inseam_L", a: ["frontL", "inseam"], b: ["backL", "inseam"] },
      // Short snug blocks (Shin) BRIDGE the rises (structural strips, the
      // two-piece-sleeve lesson): four half-shells sprung around two limbs
      // never stabilise — the bake ended with rise seams ~150mm open while
      // the outseams closed to 3mm. Bridged, the two fronts are one sheet.
      { name: "crotch_front", a: ["frontR", "crotch"], b: ["frontL", "crotch"], ...(cfg.crotchBridge ? { bridge: true } : {}) },
      { name: "crotch_back", a: ["backR", "crotch"], b: ["backL", "crotch"], ...(cfg.crotchBridge ? { bridge: true } : {}) },
      // Deep-rise blocks pin the top of the rise like the waistband holds it.
      ...(cfg.riseTopPin
        ? [
            { name: "rise_front", a: ["frontR", "riseTop"], b: ["frontL", "riseTop"], pin: true },
            { name: "rise_back", a: ["backR", "riseTop"], b: ["backL", "riseTop"], pin: true },
          ]
        : []),
    ]
  : cfg.skirt
  ? [
      { name: "side_R", a: ["front", "sideR"], b: ["back", "sideR"] },
      { name: "side_L", a: ["front", "sideL"], b: ["back", "sideL"] },
    ]
  : cfg.brief
  ? [
      // Hangs from the pinned waistband. Short side seams close the hip
      // wrap; the gusset sews to both panels' bottom edges under the crotch.
      { name: "side_R", a: ["front", "sideR"], b: ["back", "sideR"] },
      { name: "side_L", a: ["front", "sideL"], b: ["back", "sideL"] },
      { name: "gusset_front_L", a: ["front", "gussetEdgeL"], b: ["gusset", "frontEdgeL"] },
      { name: "gusset_front_R", a: ["front", "gussetEdgeR"], b: ["gusset", "frontEdgeR"] },
      { name: "gusset_back", a: ["back", "gussetEdge"], b: ["gusset", "backEdge"] },
    ]
  : cfg.bruce
  ? [
      // Hangs from the pinned waistband ring. The sides join the front
      // panel above the notch and the inset below it; the back closes the
      // hip wrap. The pouch: each inset's top curve sews to the front's
      // curve, and the two dart curves sew to each other (the bulge fold).
      // The crotch closes from three directions: each back wing's inner
      // portion meets the front tusk, its tip meets the inset's gusset edge.
      // The six panel seams start within 16mm — bridge them (the sleeve
      // recipe): one continuous sheet instead of a sprung slit band. The
      // crotch and pouch seams start 30-130mm out and stay sprung — a
      // bridge across those gaps bakes as a toothed channel (waralee).
      { name: "side_up_R", a: ["front", "sideR"], b: ["sideR", "frontUp"], bridge: true },
      { name: "side_up_L", a: ["front", "sideL"], b: ["sideL", "frontUp"], bridge: true },
      { name: "side_lo_R", a: ["insetR", "side"], b: ["sideR", "frontLo"], bridge: true },
      { name: "side_lo_L", a: ["insetL", "side"], b: ["sideL", "frontLo"], bridge: true },
      { name: "back_R", a: ["back", "sideR"], b: ["sideR", "back"], bridge: true },
      { name: "back_L", a: ["back", "sideL"], b: ["sideL", "back"], bridge: true },
      // Pouch curves SPRUNG: bridging them baked the 130mm far ends as
      // standing flap fins (bake 11 — the toothed channel in mild form).
      { name: "pouch_curve_R", a: ["front", "curveR"], b: ["insetR", "curve"] },
      { name: "pouch_curve_L", a: ["front", "curveL"], b: ["insetL", "curve"] },
      // The dart is BRIDGED: it is the pouch's organizing seam — the tusk
      // edges' home is defined by the closed dart (four seams converge at
      // the crotch cross-point), and sprung it stayed half-closed while
      // the cloth around it wandered into a knot (bakes 7-11). Its band
      // lies INSIDE the pouch, where a tooth can't show.
      ...(bodyPieces[0].segments.dartR
        ? [{ name: "pouch_dart", a: ["front", "dartR"], b: ["front", "dartL"], bridge: true }]
        : []),
      { name: "crotch_tusk_R", a: ["back", "crotchTuskR"], b: ["front", "tuskR"] },
      { name: "crotch_tusk_L", a: ["back", "crotchTuskL"], b: ["front", "tuskL"] },
      { name: "crotch_inset_R", a: ["back", "crotchInsetR"], b: ["insetR", "gusset"] },
      { name: "crotch_inset_L", a: ["back", "crotchInsetL"], b: ["insetL", "gusset"] },
    ]
  : cfg.circleSkirt
  ? [
      // One piece: its two straight radial edges meet at CB.
      { name: "cb", a: ["skirt", "edgeStart"], b: ["skirt", "edgeEnd"] },
    ]
  : cfg.tabard
  ? [
      // A tabard joins ONLY at the shoulders; the sides hang open.
      { name: "shoulder_R", a: ["front", "shoulderR"], b: ["back", "shoulderR"], pin: true },
      { name: "shoulder_L", a: ["front", "shoulderL"], b: ["back", "shoulderL"], pin: true },
    ]
  : cfg.bodice
  ? [
      // Hangs from pinned shoulders + necklines; the side seams are split
      // where the bust dart lands so front and back pair edge-for-edge; all
      // six darts (2 waist front, 2 waist back, 2 bust) are sewn shut.
      { name: "shoulder_R", a: ["front", "shoulderR"], b: ["back", "shoulderR"], pin: true },
      { name: "shoulder_L", a: ["front", "shoulderL"], b: ["back", "shoulderL"], pin: true },
      { name: "side_R_lo", a: ["front", "sideLoR"], b: ["back", "sideLoR"] },
      { name: "side_R_up", a: ["front", "sideUpR"], b: ["back", "sideUpR"] },
      { name: "side_L_lo", a: ["front", "sideLoL"], b: ["back", "sideLoL"] },
      { name: "side_L_up", a: ["front", "sideUpL"], b: ["back", "sideUpL"] },
      { name: "wdartF_R", a: ["front", "wdartLR"], b: ["front", "wdartRR"] },
      { name: "wdartF_L", a: ["front", "wdartLL"], b: ["front", "wdartRL"] },
      { name: "bdart_R", a: ["front", "bdartLR"], b: ["front", "bdartRR"] },
      { name: "bdart_L", a: ["front", "bdartLL"], b: ["front", "bdartRL"] },
      { name: "dartB_R", a: ["back", "dartLR"], b: ["back", "dartRR"] },
      { name: "dartB_L", a: ["back", "dartLL"], b: ["back", "dartRL"] },
    ]
  : cfg.breanna
  ? [
      // Hangs from pinned shoulders + necklines; whole side seams (the
      // sliver secondary dart is always collapsed, so nothing splits
      // them). The primary bust darts sew shut only when the draft cut
      // them as real wedges — sliver drafts collapsed them away.
      { name: "shoulder_R", a: ["front", "shoulderR"], b: ["back", "shoulderR"], pin: true },
      { name: "shoulder_L", a: ["front", "shoulderL"], b: ["back", "shoulderL"], pin: true },
      { name: "side_R", a: ["front", "sideR"], b: ["back", "sideR"] },
      { name: "side_L", a: ["front", "sideL"], b: ["back", "sideL"] },
      ...(bodyPieces[0].segments.wdartLR
        ? [
            { name: "wdartF_R", a: ["front", "wdartLR"], b: ["front", "wdartRR"] },
            { name: "wdartF_L", a: ["front", "wdartLL"], b: ["front", "wdartRL"] },
          ]
        : []),
      { name: "dartB_R", a: ["back", "dartLR"], b: ["back", "dartRR"] },
      { name: "dartB_L", a: ["back", "dartLL"], b: ["back", "dartRL"] },
    ]
  : cfg.wrapPants
  ? [
      // The two pieces join ONLY along the crotch curve, at the body's
      // mid-plane — SEWN throughout: with the notch-edge-anchored wrap the
      // pairs start ~8mm apart (uma-gusset territory). A bridge here baked
      // as a toothed channel; PINNING the rises (the Charlie riseTopPin
      // idea) froze the seam while the wrap tension tore the cloth around
      // the pins into a hole — springs strong enough to hold are the
      // honest middle.
      // BRIDGED: springs at any force lost the front rise to the wrap's
      // tension (baked open as a slit), and with the notch-edge-anchored
      // wrap the pairs start ~8mm apart, so the bridge band is stitch-line
      // width — the sleeve recipe, not the toothed channel it was at the
      // old 45mm gaps.
      { name: "rise_back", a: ["pantsR", "cutoutB"], b: ["pantsL", "cutoutB"], bridge: true },
      { name: "crotch", a: ["pantsR", "cutoutU"], b: ["pantsL", "cutoutU"], bridge: true },
      { name: "rise_front", a: ["pantsR", "cutoutF"], b: ["pantsL", "cutoutF"], bridge: true },
    ]
  : cfg.noble
  ? [
      // Hangs from pinned shoulders (split by the princess seams into
      // inner + outer segments) + necklines; the princess seams and sides
      // are sewn.
      { name: "shoulder_in_R", a: ["frontInside", "shoulderR"], b: ["backInside", "shoulderR"], pin: true },
      { name: "shoulder_in_L", a: ["frontInside", "shoulderL"], b: ["backInside", "shoulderL"], pin: true },
      // Outer shoulder segments are SEWN but not pinned: their wrap
      // positions sit off the shoulder line (the arc past the neck stub),
      // and pinning them there froze the upper princess seams open. The
      // inside pair carries the hang; the outer panels settle onto the
      // shoulder through their seams.
      { name: "shoulder_out_R", a: ["frontOutR", "shoulder"], b: ["backOutR", "shoulder"] },
      { name: "shoulder_out_L", a: ["frontOutL", "shoulder"], b: ["backOutL", "shoulder"] },
      { name: "princess_front_R", a: ["frontInside", "princessR"], b: ["frontOutR", "princess"] },
      { name: "princess_front_L", a: ["frontInside", "princessL"], b: ["frontOutL", "princess"] },
      { name: "princess_back_R", a: ["backInside", "princessR"], b: ["backOutR", "princess"] },
      { name: "princess_back_L", a: ["backInside", "princessL"], b: ["backOutL", "princess"] },
      { name: "side_R", a: ["frontOutR", "side"], b: ["backOutR", "side"] },
      { name: "side_L", a: ["frontOutL", "side"], b: ["backOutL", "side"] },
    ]
  : cfg.dressPanels
  ? [
      { name: "side_R", a: ["front", "sideR"], b: ["back", "sideR"] },
      { name: "side_L", a: ["front", "sideL"], b: ["back", "sideL"] },
    ]
  : cfg.coat
  ? [
      // Hangs from pinned shoulders + necklines + pinned plackets. The side
      // seam splits at the waist: upper half to the back, lower half to the
      // tail, whose (wider, pleated) top edge gathers into the back waist.
      // Sleeves close along BOTH long edges (top/under pair); the
      // undersleeve's short cap is pinned, unsewn underarm scope.
      { name: "shoulder_R", a: ["frontL", "shoulder"], b: ["back", "shoulderR"], pin: true },
      { name: "shoulder_L", a: ["frontR", "shoulder"], b: ["back", "shoulderL"], pin: true },
      // Three-panel bodies (Carlita) route the princess panel seam between
      // front and side, and the side panel carries the side seam; two-panel
      // bodies (Carlton) run the front straight to the back/tail.
      ...(cfg.sidePanel
        ? [
            { name: "panel_R", a: ["frontL", "panel"], b: ["sideL", "panel"] },
            { name: "panel_L", a: ["frontR", "panel"], b: ["sideR", "panel"] },
            { name: "side_upper_R", a: ["sideL", "sideUpper"], b: ["back", "sideR"] },
            { name: "side_upper_L", a: ["sideR", "sideUpper"], b: ["back", "sideL"] },
            { name: "side_lower_R", a: ["sideL", "sideLower"], b: ["tail", "sideR"] },
            { name: "side_lower_L", a: ["sideR", "sideLower"], b: ["tail", "sideL"] },
          ]
        : [
            { name: "side_upper_R", a: ["frontL", "sideUpper"], b: ["back", "sideR"] },
            { name: "side_upper_L", a: ["frontR", "sideUpper"], b: ["back", "sideL"] },
            { name: "side_lower_R", a: ["frontL", "sideLower"], b: ["tail", "sideR"] },
            { name: "side_lower_L", a: ["frontR", "sideLower"], b: ["tail", "sideL"] },
          ]),
      { name: "tail_R", a: ["tail", "topR"], b: ["back", "waistR"] },
      { name: "tail_L", a: ["tail", "topL"], b: ["back", "waistL"] },
      { name: "armscye_R_front", a: ["frontL", "armscye"], b: ["topsleeve_R", "capFront"] },
      { name: "armscye_R_back", a: ["back", "armscyeR"], b: ["topsleeve_R", "capBack"] },
      { name: "armscye_L_front", a: ["frontR", "armscye"], b: ["topsleeve_L", "capFront"] },
      { name: "armscye_L_back", a: ["back", "armscyeL"], b: ["topsleeve_L", "capBack"] },
      // BOTH long sleeve seams are BRIDGED (structural cloth strips, not
      // springs): two separate shells sprung around one limb never
      // stabilised — springs shredded, accordioned, or (at gentle force)
      // simply never closed, across eight bake variants. Bridged, the
      // top/under pair is one continuous tube; the fit map still measures
      // both seams' residual gaps through their closure constraints.
      { name: "sleeveFront_R", a: ["topsleeve_R", "edgeFront"], b: ["undersleeve_R", "edgeFront"], bridge: true },
      { name: "sleeveBack_R", a: ["topsleeve_R", "edgeBack"], b: ["undersleeve_R", "edgeBack"], bridge: true },
      { name: "sleeveFront_L", a: ["topsleeve_L", "edgeFront"], b: ["undersleeve_L", "edgeFront"], bridge: true },
      { name: "sleeveBack_L", a: ["topsleeve_L", "edgeBack"], b: ["undersleeve_L", "edgeBack"], bridge: true },
    ]
  : cfg.jacket
  ? [
      // Jacket base: the classic hang (pinned shoulders + necklines, sewn
      // sides) with the coats' bridged two-piece sleeve pair.
      { name: "shoulder_R", a: ["front", "shoulderR"], b: ["back", "shoulderR"], pin: true },
      { name: "shoulder_L", a: ["front", "shoulderL"], b: ["back", "shoulderL"], pin: true },
      { name: "side_R", a: ["front", "sideR"], b: ["back", "sideR"] },
      { name: "side_L", a: ["front", "sideL"], b: ["back", "sideL"] },
      { name: "armscye_R_front", a: ["front", "armscyeR"], b: ["topsleeve_R", "capFront"] },
      { name: "armscye_R_back", a: ["back", "armscyeR"], b: ["topsleeve_R", "capBack"] },
      { name: "armscye_L_front", a: ["front", "armscyeL"], b: ["topsleeve_L", "capFront"] },
      { name: "armscye_L_back", a: ["back", "armscyeL"], b: ["topsleeve_L", "capBack"] },
      { name: "sleeveFront_R", a: ["topsleeve_R", "edgeFront"], b: ["undersleeve_R", "edgeFront"], bridge: true },
      { name: "sleeveBack_R", a: ["topsleeve_R", "edgeBack"], b: ["undersleeve_R", "edgeBack"], bridge: true },
      { name: "sleeveFront_L", a: ["topsleeve_L", "edgeFront"], b: ["undersleeve_L", "edgeFront"], bridge: true },
      { name: "sleeveBack_L", a: ["topsleeve_L", "edgeBack"], b: ["undersleeve_L", "edgeBack"], bridge: true },
    ]
  : cfg.waistcoat
  ? [
      // Hangs from pinned shoulders + pinned V-neck/CB + buttoned plackets;
      // waist darts are sewn shut for the fitted silhouette.
      { name: "shoulder_R", a: ["frontL", "shoulder"], b: ["back", "shoulderR"], pin: true },
      { name: "shoulder_L", a: ["frontR", "shoulder"], b: ["back", "shoulderL"], pin: true },
      { name: "side_R", a: ["frontL", "side"], b: ["back", "sideR"] },
      { name: "side_L", a: ["frontR", "side"], b: ["back", "sideL"] },
      { name: "dartF_R", a: ["frontL", "dartL"], b: ["frontL", "dartR"] },
      { name: "dartF_L", a: ["frontR", "dartL"], b: ["frontR", "dartR"] },
      { name: "dartB_R", a: ["back", "dartLR"], b: ["back", "dartRR"] },
      { name: "dartB_L", a: ["back", "dartLL"], b: ["back", "dartRL"] },
    ]
  : cfg.zipFront
  ? [
      // Hangs from pinned shoulders + necklines; the CF zip is sewn shut.
      { name: "zip", a: ["frontL", "zip"], b: ["frontR", "zip"] },
      { name: "shoulder_R", a: ["frontL", "shoulder"], b: ["back", "shoulderR"], pin: true },
      { name: "shoulder_L", a: ["frontR", "shoulder"], b: ["back", "shoulderL"], pin: true },
      { name: "side_R", a: ["frontL", "side"], b: ["back", "sideR"] },
      { name: "side_L", a: ["frontR", "side"], b: ["back", "sideL"] },
      { name: "armscye_R_front", a: ["frontL", "armscye"], b: ["sleeve_R", "capFront"] },
      { name: "armscye_R_back", a: ["back", "armscyeR"], b: ["sleeve_R", "capBack"] },
      { name: "armscye_L_front", a: ["frontR", "armscye"], b: ["sleeve_L", "capFront"] },
      { name: "armscye_L_back", a: ["back", "armscyeL"], b: ["sleeve_L", "capBack"] },
      { name: "underarm_R", a: ["sleeve_R", "edgeR"], b: ["sleeve_R", "edgeL"] },
      { name: "underarm_L", a: ["sleeve_L", "edgeR"], b: ["sleeve_L", "edgeL"] },
    ]
  : cfg.crossFront
  ? [
      // Crossover front: hangs from pinned shoulders; the diagonal opening
      // edges are button-pinned (pinSegments "cross") and overlap at CF.
      { name: "shoulder_R", a: ["frontL", "shoulder"], b: ["back", "shoulderR"], pin: true },
      { name: "shoulder_L", a: ["frontR", "shoulder"], b: ["back", "shoulderL"], pin: true },
      { name: "side_R", a: ["frontL", "side"], b: ["back", "sideR"] },
      { name: "side_L", a: ["frontR", "side"], b: ["back", "sideL"] },
      { name: "armscye_R_front", a: ["frontL", "armscye"], b: ["sleeve_R", "capFront"] },
      { name: "armscye_R_back", a: ["back", "armscyeR"], b: ["sleeve_R", "capBack"] },
      { name: "armscye_L_front", a: ["frontR", "armscye"], b: ["sleeve_L", "capFront"] },
      { name: "armscye_L_back", a: ["back", "armscyeL"], b: ["sleeve_L", "capBack"] },
      { name: "underarm_R", a: ["sleeve_R", "edgeR"], b: ["sleeve_R", "edgeL"] },
      { name: "underarm_L", a: ["sleeve_L", "edgeR"], b: ["sleeve_L", "edgeL"] },
    ]
  : cfg.buttonFront
  ? [
      // Button-front: the garment hangs from pinned shoulders + necklines +
      // pinned plackets. The yoke bridges back and fronts; the yoke's own
      // small armhole edges stay free (like the collar, they're covered by
      // the description, not the sim).
      { name: "shoulder_R", a: ["yoke", "shoulderR"], b: ["frontL", "shoulder"], pin: true },
      { name: "shoulder_L", a: ["yoke", "shoulderL"], b: ["frontR", "shoulder"], pin: true },
      { name: "yoke_R", a: ["yoke", "bottomR"], b: ["back", "yokeR"] },
      { name: "yoke_L", a: ["yoke", "bottomL"], b: ["back", "yokeL"] },
      { name: "side_R", a: ["frontL", "side"], b: ["back", "sideR"] },
      { name: "side_L", a: ["frontR", "side"], b: ["back", "sideL"] },
      { name: "armscye_R_front", a: ["frontL", "armscye"], b: ["sleeve_R", "capFront"] },
      { name: "armscye_R_back", a: ["back", "armscyeR"], b: ["sleeve_R", "capBack"] },
      { name: "armscye_L_front", a: ["frontR", "armscye"], b: ["sleeve_L", "capFront"] },
      { name: "armscye_L_back", a: ["back", "armscyeL"], b: ["sleeve_L", "capBack"] },
      { name: "underarm_R", a: ["sleeve_R", "edgeR"], b: ["sleeve_R", "edgeL"] },
      { name: "underarm_L", a: ["sleeve_L", "edgeR"], b: ["sleeve_L", "edgeL"] },
    ]
  : cfg.raglan
  ? [
      // Raglan: no shoulder seam — the garment hangs from the pinned
      // necklines (body + sleeve tops) and pinned raglan sleeve edges.
      { name: "side_R", a: ["front", "sideR"], b: ["back", "sideR"] },
      { name: "side_L", a: ["front", "sideL"], b: ["back", "sideL"] },
      { name: "raglan_R_front", a: ["front", "raglanR"], b: ["sleeve_R", "capRaglanFront"] },
      { name: "raglan_R_back", a: ["back", "raglanR"], b: ["sleeve_R", "capRaglanBack"] },
      { name: "raglan_L_front", a: ["front", "raglanL"], b: ["sleeve_L", "capRaglanFront"] },
      { name: "raglan_L_back", a: ["back", "raglanL"], b: ["sleeve_L", "capRaglanBack"] },
      { name: "underarm_R", a: ["sleeve_R", "edgeR"], b: ["sleeve_R", "edgeL"] },
      { name: "underarm_L", a: ["sleeve_L", "edgeR"], b: ["sleeve_L", "edgeL"] },
    ]
  : [
      { name: "shoulder_R", a: ["front", "shoulderR"], b: ["back", "shoulderR"], pin: true },
      { name: "shoulder_L", a: ["front", "shoulderL"], b: ["back", "shoulderL"], pin: true },
      { name: "side_R", a: ["front", "sideR"], b: ["back", "sideR"] },
      { name: "side_L", a: ["front", "sideL"], b: ["back", "sideL"] },
      ...(hasSleeves
        ? [
            { name: "armscye_R_front", a: ["front", "armscyeR"], b: ["sleeve_R", "capFront"] },
            { name: "armscye_R_back", a: ["back", "armscyeR"], b: ["sleeve_R", "capBack"] },
            { name: "armscye_L_front", a: ["front", "armscyeL"], b: ["sleeve_L", "capFront"] },
            { name: "armscye_L_back", a: ["back", "armscyeL"], b: ["sleeve_L", "capBack"] },
            { name: "underarm_R", a: ["sleeve_R", "edgeR"], b: ["sleeve_R", "edgeL"] },
            { name: "underarm_L", a: ["sleeve_L", "edgeR"], b: ["sleeve_L", "edgeL"] },
          ]
        : []),
    ];

const out = {
  block: blockId,
  spec,
  pieces: [...bodyPieces, ...sleeves],
  seams,
  // Vertical anchor (pattern y=0 in body coordinates, HPS=0/waist=460) and
  // which ghost-mannequin the sim should build.
  yOffset: cfg.yOffset ?? 0,
  bodyKind: cfg.bodyKind ?? "upper",
  // Fabric class for the fit map's colour scale: a knit worn at +20% girth
  // is comfortable, a woven at +20% is a split seam — the same strain must
  // not be graded the same way.
  fabric: cfg.fabric ?? "woven",
  // Per-block solver hints (e.g. darted blocks need stronger stitching to
  // pull the dart wedges shut against the side seams).
  sim: cfg.sim ?? {},
  // Ghost-mannequin scale hints: ratios of this draft's measurements to the
  // studio-standard body the sim's torso profile was modelled on.
  body: {
    chest: M.chest / 1080,
    biceps: M.biceps / 335,
    shoulder: M.shoulderToShoulder / 445,
    torso: M.hpsToWaistBack / 460,
  },
};
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(out));
console.log(
  `block: ${blockId} | pieces: ${out.pieces.map((p) => `${p.name}(${p.points.length})`).join(", ")} | seams: ${seams.length} | chestHalf: ${Math.round(chestHalf)}mm | body: ${JSON.stringify(out.body)}`,
);
