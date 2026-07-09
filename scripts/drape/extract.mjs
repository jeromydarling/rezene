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
 *   slip-dress (Sophie)   bias slip, top edge pinned; straps not simulated
 *   wahid (waistcoat)     buttoned CF, waist darts sewn shut, sleeveless
 *   wide-trouser (Titan)  leg tubes + hip sweep on the lower-body mannequin
 *   pleated-skirt (Penelope) pencil skirt on the hip column, waist pinned
 *   paco (Paco)           summer trousers on the Titan topology
 *   charlie (Charlie)     chinos; slant-pocket corner restored synthetically
 *   sandy (Sandy)         circle skirt: one ring sector, polar "circle" wrap
 *   bella (Bella)         foundation bodice; waist + side bust darts sewn
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
    design: "Teagan",
    parts: { front: "teagan.front", back: "teagan.back", sleeve: "teagan.sleeve" },
    sleeveAnchors: { hemL: "hemLeft", hemR: "hemRight" },
  },
  aaron: {
    module: "@freesewing/aaron",
    design: "Aaron",
    parts: { front: "aaron.front", back: "aaron.back" },
    // A tank's "shoulder seam" is the strap top; the Brian `shoulder` point
    // isn't on Aaron's outline at all.
    bodyAnchors: { armTop: "strapRight", neckSide: "strapLeft" },
  },
  "relaxed-hoodie": {
    module: "@freesewing/sven",
    design: "Sven",
    parts: { front: "sven.front", back: "sven.back", sleeve: "sven.sleeve" },
    sleeveAnchors: { hemL: "wristLeft", hemR: "wristRight" },
    cuffed: true, // ribbed cuffs grip the wrist — the sim pins the sleeve hems
  },
  hugo: {
    module: "@freesewing/hugo",
    design: "Hugo",
    parts: { front: "hugo.front", back: "hugo.back", sleeve: "hugo.sleeve" },
    sleeveAnchors: { hemL: "wristLeft", hemR: "wristRight" },
    cuffed: true,
    // Raglan: no shoulder seam — the sleeve runs to the neckline and the
    // raglan seam replaces both shoulder seam and armscye. The hood is NOT
    // simulated; the text description carries it, the sim carries the body.
    raglan: true,
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
  },
  "slip-dress": {
    module: "@freesewing/sophie",
    design: "Sophie",
    // Bias slip dress: front/back panels cut on fold, top edge pinned at
    // chest height (straps come from the description, like collars/hoods).
    dressPanels: true,
    parts: { front: "sophie.frontPanel", back: "sophie.backPanel" },
    yOffset: 350, // pattern y=0 sits ~mid-torso; +350 = body coords (HPS=0)
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
    yOffset: 460,
    bodyKind: "lower",
  },
  bella: {
    module: "@freesewing/bella",
    design: "Bella",
    // Women's foundation bodice: fitted to the waist with waist darts front
    // and back plus a side bust dart — all sewn shut in the sim, which is
    // the whole point of draping a block: seeing the fit it encodes.
    bodice: true,
    parts: { front: "bella.frontSideDart", back: "bella.back" },
    sim: { sewForce: 9 }, // the bust dart's ~12 cm mouth needs a strong pull
  },
};

const blockId = BLOCKS[spec.block] ? spec.block : "classic-tee";
const cfg = BLOCKS[blockId];

// The studio's standard measurement set (mm) — any client measurement sent in
// the spec overrides its entry.
const M = {
  ankle: 230, biceps: 335, bustPointToUnderbust: 80, bustSpan: 190, chest: 1080,
  crossSeam: 800, crossSeamFront: 390, head: 560, heel: 330, highBust: 1040, hips: 1000,
  hpsToBust: 270, hpsToWaistBack: 460, hpsToWaistFront: 505, inseam: 790, knee: 420, neck: 400, seat: 1050,
  seatBack: 520, shoulderSlope: 13, shoulderToShoulder: 445, shoulderToWrist: 620,
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
  // Full outline: right half then mirrored left half walked back to start.
  return buildPiece(pieceName, [
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
    ? [...line(P.styleWaistOut, P[cut.bottom]), ...sliceShort(poly, P[cut.bottom], P.floorOut)]
    : sliceShort(poly, P.styleWaistOut, P.floorOut);
  const waistPts = cut
    ? [...sliceShort(poly, P.styleWaistIn, P[cut.top]), ...line(P[cut.top], P.styleWaistOut)]
    : sliceShort(poly, P.styleWaistIn, P.styleWaistOut);
  const piece = buildPiece(pieceName, [
    ["outseam", seg(outseamPts)],
    ["hem", seg(sliceShort(poly, P.floorOut, P.floorIn))],
    ["inseam", seg(sliceShort(poly, P.floorIn, P.fork))],
    ["crotch", seg(sliceShort(poly, P.fork, P.styleWaistIn))],
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
  piece.forkY = P.fork.y;
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

const hasSleeves = Boolean(cfg.parts.sleeve);
const sleeves = hasSleeves ? [sleevePiece("R"), sleevePiece("L")] : [];

let bodyPieces;
if (cfg.trousers) {
  // Right leg wears the drafted panels as-is; the left leg wears mirrors.
  // (Titan's front is drafted with the outseam near x=0 and the inseam
  // outboard; the sim's leg wrap reads the edges profile either way.)
  const frontR = trouserPanel(cfg.parts.front, "frontR", false);
  const backR = trouserPanel(cfg.parts.back, "backR", false);
  const frontL = trouserPanel(cfg.parts.front, "frontL", true);
  const backL = trouserPanel(cfg.parts.back, "backL", true);
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
} else if (cfg.dressPanels) {
  const front = dressPanel(cfg.parts.front, "front");
  const back = dressPanel(cfg.parts.back, "back");
  front.placement = { kind: "plane", y: -160 };
  back.placement = { kind: "plane", y: 160 };
  bodyPieces = [front, back];
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
  p.widthProfile = widthProfile(p);
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
      { name: "crotch_front", a: ["frontR", "crotch"], b: ["frontL", "crotch"] },
      { name: "crotch_back", a: ["backR", "crotch"], b: ["backL", "crotch"] },
    ]
  : cfg.skirt
  ? [
      { name: "side_R", a: ["front", "sideR"], b: ["back", "sideR"] },
      { name: "side_L", a: ["front", "sideL"], b: ["back", "sideL"] },
    ]
  : cfg.circleSkirt
  ? [
      // One piece: its two straight radial edges meet at CB.
      { name: "cb", a: ["skirt", "edgeStart"], b: ["skirt", "edgeEnd"] },
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
  : cfg.dressPanels
  ? [
      { name: "side_R", a: ["front", "sideR"], b: ["back", "sideR"] },
      { name: "side_L", a: ["front", "sideL"], b: ["back", "sideL"] },
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
