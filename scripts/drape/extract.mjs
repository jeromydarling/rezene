/**
 * Drape extraction — FreeSewing draft → sewable piece geometry.
 *
 * Drafts the garment with the studio's measurement set + quick-fit options,
 * walks each piece's `seam` path into polylines (mm), mirrors cut-on-fold
 * pieces, and emits a pieces.json the Blender sim consumes: pieces as closed
 * point loops built from NAMED SEGMENTS (so seam correspondence is exact
 * point-index pairs, resampled to matching counts), plus 3D placement hints.
 *
 * V1 covers the classic tee (Teagan): front, back, two sleeves; shoulder,
 * side, armscye and underarm seams; pinned at the shoulder seam for a
 * ghost-mannequin drape.
 *
 * Usage: node scripts/drape/extract.mjs '{"easePct":8,"lengthPct":-12,"sleevePct":-25}' out/pieces.json
 */
import { Teagan } from "@freesewing/teagan";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const spec = JSON.parse(process.argv[2] ?? "{}");
const outPath = process.argv[3] ?? "pieces.json";

const M = {
  biceps: 335, chest: 1080, hips: 1000, hpsToWaistBack: 460, neck: 400,
  shoulderSlope: 13, shoulderToShoulder: 445, shoulderToWrist: 620,
  waist: 820, waistToArmpit: 230, waistToHips: 130, wrist: 170,
};

const clampPct = (v, lo, hi) => Math.min(hi, Math.max(lo, Number(v) || 0)) / 100;
const options = {
  chestEase: clampPct(spec.easePct ?? 0, 0, 25),
  waistEase: clampPct(spec.easePct ?? 0, 0, 25),
  hipsEase: clampPct(spec.easePct ?? 0, 0, 25),
  lengthBonus: clampPct(spec.lengthPct ?? 0, -15, 20),
  sleeveLengthBonus: clampPct(spec.sleevePct ?? 0, -30, 10),
};

const pattern = new Teagan({ measurements: M, options });
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
  // Right-half segments (drafted half, fold at x=0).
  const hemR = slice(poly, P.cfHem ?? P.gridAnchor, P.hem);
  const sideR = slice(poly, P.hem, P.armhole);
  const armscyeR = slice(poly, P.armhole, P.shoulder);
  const shoulderR = slice(poly, P.shoulder, P.neck);
  const neckR = slice(poly, P.neck, partName.endsWith("front") ? P.cfNeck : P.cbNeck);
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
  const part = set["teagan.sleeve"];
  const P = part.points;
  const poly = pathPolyline(part.paths.seam);
  const hem = slice(poly, P.hemLeft, P.hemRight);
  const edgeR = slice(poly, P.hemRight, P.bicepsRight);
  const capFront = slice(poly, P.bicepsRight, P.sleeveTop ?? P.top);
  const capBack = slice(poly, P.sleeveTop ?? P.top, P.bicepsLeft);
  const edgeL = slice(poly, P.bicepsLeft, P.hemLeft);
  return buildPiece(`sleeve_${side}`, [
    ["hem", hem],
    ["edgeR", edgeR],
    ["capFront", capFront],
    ["capBack", capBack],
    ["edgeL", edgeL],
  ]);
}

const front = bodyPiece("teagan.front", "front");
const back = bodyPiece("teagan.back", "back");
const sleeveR = sleevePiece("R");
const sleeveL = sleevePiece("L");

// 3D placement hints (mm). Body pieces are vertical planes (x→X, y→-Z);
// sleeves are pre-curved around a vertical axis at the shoulder so the cap
// faces the armscye on both front and back sides.
const chestHalf = Math.max(...front.points.map(([x]) => Math.abs(x)));
// Planes sit just outside the sim's collision torso (±~130mm deep); the side
// seams' sewing springs pull them around it.
front.placement = { kind: "plane", y: -160 };
back.placement = { kind: "plane", y: 160 };
sleeveR.placement = { kind: "sleeve", centerX: chestHalf - 20, dir: 1 };
sleeveL.placement = { kind: "sleeve", centerX: -(chestHalf - 20), dir: -1 };

/** A seam joins segment a of one piece to segment b of another, matched
 *  point-by-point after resampling both to the same count. `reverseB` flips
 *  b's direction so the point orders correspond. */
const seams = [
  { name: "shoulder_R", a: ["front", "shoulderR"], b: ["back", "shoulderR"], reverseB: false, pin: true },
  { name: "shoulder_L", a: ["front", "shoulderL"], b: ["back", "shoulderL"], reverseB: false, pin: true },
  { name: "side_R", a: ["front", "sideR"], b: ["back", "sideR"], reverseB: false },
  { name: "side_L", a: ["front", "sideL"], b: ["back", "sideL"], reverseB: false },
  { name: "armscye_R_front", a: ["front", "armscyeR"], b: ["sleeve_R", "capFront"], reverseB: false },
  { name: "armscye_R_back", a: ["back", "armscyeR"], b: ["sleeve_R", "capBack"], reverseB: true },
  { name: "armscye_L_front", a: ["front", "armscyeL"], b: ["sleeve_L", "capFront"], reverseB: true },
  { name: "armscye_L_back", a: ["back", "armscyeL"], b: ["sleeve_L", "capBack"], reverseB: false },
  { name: "underarm_R", a: ["sleeve_R", "edgeR"], b: ["sleeve_R", "edgeL"], reverseB: true },
  { name: "underarm_L", a: ["sleeve_L", "edgeR"], b: ["sleeve_L", "edgeL"], reverseB: true },
];

const out = {
  block: "classic-tee",
  spec,
  pieces: [front, back, sleeveR, sleeveL],
  seams,
};
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(out));
console.log(
  `pieces: ${out.pieces.map((p) => `${p.name}(${p.points.length})`).join(", ")} | seams: ${seams.length} | chestHalf: ${Math.round(chestHalf)}mm`,
);
