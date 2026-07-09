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
 *   relaxed-hoodie (Sven) front/back/long sleeves
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
  },
};

const blockId = BLOCKS[spec.block] ? spec.block : "classic-tee";
const cfg = BLOCKS[blockId];

// The studio's standard measurement set (mm) — any client measurement sent in
// the spec overrides its entry.
const M = {
  biceps: 335, chest: 1080, hips: 1000, hpsToBust: 130, hpsToWaistBack: 460, neck: 400,
  shoulderSlope: 13, shoulderToShoulder: 445, shoulderToWrist: 620,
  waist: 820, waistToArmpit: 230, waistToHips: 130, wrist: 170,
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

const front = bodyPiece(cfg.parts.front, "front");
const back = bodyPiece(cfg.parts.back, "back");
const hasSleeves = Boolean(cfg.parts.sleeve);
const sleeves = hasSleeves ? [sleevePiece("R"), sleevePiece("L")] : [];

// 3D placement hints. Body pieces wrap an elliptical shell (front/back sign);
// sleeves wrap tubes around the mannequin's tilted arm stubs.
const chestHalf = Math.max(...front.points.map(([x]) => Math.abs(x)));
front.placement = { kind: "plane", y: -160 };
back.placement = { kind: "plane", y: 160 };
if (hasSleeves) {
  // Taper hints: half-width at the biceps line (pattern y=0) and at the hem,
  // so the sim wraps a cone rather than a cylinder (a straight tube around a
  // tapered sleeve leaves an open wedge along the forearm).
  const sp = set[cfg.parts.sleeve].points;
  const w0 = Math.abs(sp.bicepsRight.x);
  const hemPt = sp[cfg.sleeveAnchors.hemR];
  const taper = { w0, w1: Math.abs(hemPt.x), y1: hemPt.y };
  sleeves[0].placement = { kind: "sleeve", dir: 1, ...taper };
  sleeves[1].placement = { kind: "sleeve", dir: -1, ...taper };
}

/** A seam joins segment a of one piece to segment b of another, matched
 *  point-by-point after resampling both to the same count (the sim
 *  auto-orients direction from world-space endpoints). Shoulders are pinned
 *  — the garment hangs from them on the ghost mannequin. */
const seams = [
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
  pieces: [front, back, ...sleeves],
  seams,
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
