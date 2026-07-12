/**
 * The Drafting Room — period drafting systems implemented as deterministic,
 * parameterized code. Each system reproduces the construction method of a
 * public-domain cutter's guide the Verto School teaches from (adapted for
 * modern measurement input), lettering its construction points the way the
 * books do, and renders true-scale SVG in millimetres — the same coordinate
 * convention as the FreeSewing drafts, so the tiled-PDF printer and SVG
 * download work unchanged.
 *
 * Honest scope: these are faithful *adaptations* of each system's draft, not
 * facsimiles of every figure in the book — the source is always cited on the
 * sheet, and the book itself is a shelf away in the Timeless Library.
 *
 * This module is deliberately dependency-free (pure geometry + strings) so it
 * can be exercised headless in tests and probes.
 */

export interface Pt {
  x: number;
  y: number;
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const P = (x: number, y: number): Pt => ({ x, y });

/** Quadratic segment a→b whose control sits at the midpoint pushed `bulge` mm
 *  perpendicular to travel (positive bows to the LEFT of the a→b direction —
 *  for a segment travelling straight down, positive bows toward +x). */
function q(a: Pt, b: Pt, bulge: number): string {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const cx = mx + (dy / len) * bulge;
  const cy = my - (dx / len) * bulge;
  return `Q ${r1(cx)} ${r1(cy)} ${r1(b.x)} ${r1(b.y)}`;
}

const M = (p: Pt) => `M ${r1(p.x)} ${r1(p.y)}`;
const L = (p: Pt) => `L ${r1(p.x)} ${r1(p.y)}`;

/** A smooth open curve through the given points (Catmull-Rom → cubic Bézier),
 *  starting with a move — the books' "draw a graceful curve through…". */
function through(...pts: Pt[]): string {
  if (pts.length < 2) return "";
  let d = M(pts[0]);
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1 = P(p1.x + (p2.x - p0.x) / 6, p1.y + (p2.y - p0.y) / 6);
    const c2 = P(p2.x - (p3.x - p1.x) / 6, p2.y - (p3.y - p1.y) / 6);
    d += ` C ${r1(c1.x)} ${r1(c1.y)} ${r1(c2.x)} ${r1(c2.y)} ${r1(p2.x)} ${r1(p2.y)}`;
  }
  return d;
}

/** Same as through(), but as a continuation (no leading move). */
const throughOn = (...pts: Pt[]) => through(...pts).replace(/^M [^C]+/, "");

export interface PeriodPiece {
  name: string;
  cut: string; // "Cut 2 · main cloth"
  /** Closed outline path, mm, local coordinates (bbox computed by the renderer). */
  outline: string;
  /** Analytic bounds, for pieces whose outline rides large arcs. */
  bbox?: { minX: number; minY: number; maxX: number; maxY: number };
  /** Dashed construction lines / interior marks. */
  internals?: string[];
  /** Lettered construction points, drawn as the books letter them. */
  points?: { at: Pt; label: string }[];
  /** Free annotations (grain arrows get drawn from `grain`). */
  notes?: { at: Pt; text: string }[];
  /** Grain line: drawn as a double-headed arrow. */
  grain?: [Pt, Pt];
  /** Fold edge marker along a straight edge. */
  fold?: [Pt, Pt];
}

export interface PeriodOptionDef {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  dflt: number;
  unit: "mm" | "%";
  hint?: string;
}

export interface PeriodSystem {
  id: string;
  name: string;
  garment: string;
  era: string;
  source: { author: string; title: string; year: string };
  /** One warm line about where this draft comes from. */
  blurb: string;
  /** Measurement keys consumed (subset of the studio's standard set). */
  measurements: string[];
  options: PeriodOptionDef[];
  draft: (m: Record<string, number>, o: Record<string, number>) => PeriodPiece[];
}

// ---------------------------------------------------------------------------
// 1 · Trousers — after W.D.F. Vincent, "The Cutter's Practical Guide" (c. 1893)
// ---------------------------------------------------------------------------

function draftVincentTrousers(m: Record<string, number>, o: Record<string, number>): PeriodPiece[] {
  const waist = m.waist;
  const seat = m.seat;
  const inseam = m.inseam;
  const rise = Math.max(220, m.waistToFloor - inseam); // body rise, the old "side length less leg"
  const knee = m.knee;
  const bottom = o.bottomMm; // full hem circumference
  const ease = o.seatEaseMm;

  const kneeY = rise + inseam / 2 - 30;
  const hemY = rise + inseam;

  // --- Forepart -------------------------------------------------------------
  const seatWF = seat / 4 + ease / 2; // side → fly at seat line
  const forkF = seat / 16 + 5; // fork extension beyond the fly
  const totalF = seatWF + forkF;
  const waistWF = waist / 4 + 15;
  const creaseF = totalF / 2;
  const kneeHalfF = (knee + 80) / 4; // quarter of eased knee girth per leg-half
  const hemHalfF = bottom / 4 - 10;

  const A = P(0, 0); // side, waist
  const B = P(waistWF, 0); // fly, waist
  const C = P(seatWF - 8, rise - 70); // fly run, above fork
  const F = P(totalF, rise + 8); // fork point
  const K2 = P(creaseF + kneeHalfF, kneeY);
  const H2 = P(creaseF + hemHalfF, hemY);
  const K1 = P(creaseF - kneeHalfF, kneeY);
  const H1 = P(creaseF - hemHalfF, hemY);
  const S = P(0, rise); // side, seat line

  const fore: PeriodPiece = {
    name: "Forepart",
    cut: "Cut 2 · with the crease line on the straight grain",
    outline:
      M(A) +
      " " +
      q(A, S, 6) + // side seam, waist → seat (gentle spring)
      " " +
      q(S, K1, -14) + // side seam, seat → knee (hollowed)
      " " +
      L(H1) + // side seam, knee → hem
      " " +
      L(H2) + // hem
      " " +
      L(K2) + // inseam, hem → knee
      " " +
      q(K2, F, -10) + // inseam, knee → fork (hollowed)
      " " +
      q(F, C, 26) + // fork scoop
      " " +
      L(B) + // fly line
      " " +
      L(A), // waist
    internals: [
      `M 0 ${r1(rise)} L ${r1(totalF)} ${r1(rise)}`, // seat/fork line
      `M ${r1(K1.x)} ${r1(kneeY)} L ${r1(K2.x)} ${r1(kneeY)}`, // knee line
      `M ${r1(creaseF)} ${r1(rise)} L ${r1(creaseF)} ${r1(hemY)}`, // crease
    ],
    points: [
      { at: A, label: "A" },
      { at: B, label: "B" },
      { at: C, label: "C" },
      { at: F, label: "D" },
      { at: K2, label: "E" },
      { at: H2, label: "F" },
      { at: H1, label: "G" },
      { at: K1, label: "H" },
      { at: S, label: "I" },
    ],
    grain: [P(creaseF, rise + 80), P(creaseF, hemY - 80)],
    notes: [{ at: P(creaseF, kneeY + 40), text: "crease line" }],
  };

  // --- Backpart ---------------------------------------------------------------
  const seatWB = seat / 4 + ease / 2 + 12;
  const forkB = seat / 8 + 15;
  const totalB = seatWB + forkB;
  const waistWB = waist / 4 + 45; // includes the dart take
  const creaseB = totalB / 2;
  const kneeHalfB = (knee + 80) / 4 + 20;
  const hemHalfB = bottom / 4 + 10;
  const slant = 30; // seat-angle rise at the centre-back

  const A2 = P(0, 12); // side, waist
  const B2 = P(waistWB, -slant); // centre-back, waist (on the seat angle)
  const C2 = P(seatWB - 15, rise - 80);
  const F2 = P(totalB, rise + 14);
  const K4 = P(creaseB + kneeHalfB, kneeY);
  const H4 = P(creaseB + hemHalfB, hemY);
  const K3 = P(creaseB - kneeHalfB, kneeY);
  const H3 = P(creaseB - hemHalfB, hemY);
  const S2 = P(0, rise);
  const dartMid = P(waistWB / 2 + 10, -slant / 2 + 8);

  const back: PeriodPiece = {
    name: "Backpart",
    cut: "Cut 2 · with the crease line on the straight grain",
    outline:
      M(A2) +
      " " +
      q(A2, S2, 8) +
      " " +
      q(S2, K3, -16) +
      " " +
      L(H3) +
      " " +
      L(H4) +
      " " +
      L(K4) +
      " " +
      q(K4, F2, -12) +
      " " +
      q(F2, C2, 34) + // deeper back fork scoop
      " " +
      L(B2) + // seat seam run to the waist
      " " +
      L(A2), // slanted waist
    internals: [
      `M 0 ${r1(rise)} L ${r1(totalB)} ${r1(rise)}`,
      `M ${r1(K3.x)} ${r1(kneeY)} L ${r1(K4.x)} ${r1(kneeY)}`,
      `M ${r1(creaseB)} ${r1(rise)} L ${r1(creaseB)} ${r1(hemY)}`,
      // waist dart, folded out toward the seat
      `M ${r1(dartMid.x - 12)} ${r1(dartMid.y)} L ${r1(dartMid.x)} ${r1(dartMid.y + 120)} L ${r1(dartMid.x + 12)} ${r1(dartMid.y)}`,
    ],
    points: [
      { at: A2, label: "A" },
      { at: B2, label: "B" },
      { at: C2, label: "C" },
      { at: F2, label: "D" },
      { at: S2, label: "I" },
    ],
    grain: [P(creaseB, rise + 80), P(creaseB, hemY - 80)],
    notes: [{ at: P(dartMid.x, dartMid.y + 150), text: "dart · take 24 mm" }],
  };

  return [fore, back];
}

// ---------------------------------------------------------------------------
// 2 · Single-breasted vest — after Chas. Hecklinger, "The Keystone Systems" (1895)
// ---------------------------------------------------------------------------

function draftKeystoneVest(m: Record<string, number>, o: Record<string, number>): PeriodPiece[] {
  const halfB = m.chest / 2; // the cutter's "breast measure" working half
  const ease = o.chestEaseMm;
  const backLen = m.hpsToWaistBack;
  const neckW = m.neck / 5;

  const scyeY = halfB / 3 + 30;
  const waistY = backLen;
  const hemYB = backLen + 60;

  // --- Back -----------------------------------------------------------------
  const backW = halfB / 3 + 28;
  const O = P(0, 0);
  const N = P(neckW, -22);
  const Sh = P(backW - 5, 40);
  const Sc = P(backW + 8, scyeY);
  const W1 = P(backW - 20, waistY);
  const B1 = P(backW - 14, hemYB);
  const CBw = P(16, waistY);
  const CBb = P(16, hemYB);

  const back: PeriodPiece = {
    name: "Back",
    cut: "Cut 2 · main cloth or lining sateen",
    outline:
      M(O) +
      " " +
      q(O, N, -8) + // back neck, hollowed
      " " +
      L(Sh) + // shoulder
      " " +
      q(Sh, Sc, -12) + // back scye
      " " +
      q(Sc, W1, 6) + // side seam, sprung in at the waist
      " " +
      L(B1) +
      " " +
      L(CBb) + // bottom
      " " +
      L(CBw) +
      " " +
      q(CBw, O, -9) + // centre-back, hollowed to the waist
      "",
    internals: [
      `M 0 ${r1(scyeY)} L ${r1(backW + 8)} ${r1(scyeY)}`, // depth-of-scye line
      `M 0 ${r1(waistY)} L ${r1(backW)} ${r1(waistY)}`, // waist line
    ],
    points: [
      { at: O, label: "A" },
      { at: N, label: "B" },
      { at: Sh, label: "C" },
      { at: Sc, label: "D" },
      { at: W1, label: "E" },
    ],
    grain: [P(60, 120), P(60, hemYB - 40)],
  };

  // --- Forepart ---------------------------------------------------------------
  const frontW = halfB + ease - backW + 18; // side seam → centre-front + button stand
  const CF = frontW;
  const NP = P(CF - neckW - 8, 12); // front neck point
  const ShT = P(NP.x - 138, 74); // shoulder tip (matches the back shoulder run)
  const S0 = P(0, scyeY + 6); // side, at the scye
  const V = P(CF, scyeY + 55); // where the V-opening meets the button line
  const Wf = P(CF, waistY);
  const Point = P(CF - 34, hemYB + 74); // the vest's front point
  const Bf = P(60, hemYB + 6); // bottom, toward the side
  const Sw = P(12, waistY);

  const dartX = frontW * 0.52;

  const fore: PeriodPiece = {
    name: "Forepart",
    cut: "Cut 2 · main cloth",
    outline:
      M(NP) +
      " " +
      L(ShT) + // shoulder
      " " +
      q(ShT, S0, 34) + // front scye, well hollowed
      " " +
      q(S0, Sw, 7) + // side seam
      " " +
      L(Bf) +
      " " +
      q(Bf, Point, -14) + // bottom edge, swept to the point
      " " +
      L(Wf) + // button line, point → waist
      " " +
      L(V) + // button line, waist → V
      " " +
      q(V, NP, 20) + // the V-opening, cut away toward the shoulder
      "",
    internals: [
      `M 0 ${r1(scyeY)} L ${r1(CF)} ${r1(scyeY)}`,
      `M 0 ${r1(waistY)} L ${r1(CF)} ${r1(waistY)}`,
      // front waist dart
      `M ${r1(dartX)} ${r1(scyeY + 60)} L ${r1(dartX - 9)} ${r1(waistY)} L ${r1(dartX)} ${r1(hemYB + 10)} L ${r1(dartX + 9)} ${r1(waistY)} Z`,
      // welt-pocket mark
      `M ${r1(dartX - 90)} ${r1(waistY - 55)} L ${r1(dartX + 45)} ${r1(waistY - 65)}`,
    ],
    points: [
      { at: NP, label: "F" },
      { at: ShT, label: "G" },
      { at: S0, label: "H" },
      { at: V, label: "J" },
      { at: Point, label: "K" },
    ],
    grain: [P(dartX + 90, scyeY + 40), P(dartX + 90, hemYB)],
    notes: [
      { at: P(dartX - 20, waistY - 80), text: "welt pocket" },
      { at: P(CF - 55, scyeY + 120), text: "5 buttons, 1st at J" },
    ],
  };
  // Button marks down the front line
  fore.internals = fore.internals!.concat(
    Array.from({ length: 5 }, (_, i) => {
      const y = V.y + 30 + ((waistY + 40 - V.y - 30) / 4) * i;
      return `M ${r1(CF - 16)} ${r1(y)} a 4 4 0 1 0 0.1 0`;
    }),
  );

  return [back, fore];
}

// ---------------------------------------------------------------------------
// 3 · Shirt-waist — after Jane Fales, "Dressmaking" (1917)
// ---------------------------------------------------------------------------

function draftFalesShirtwaist(m: Record<string, number>, o: Record<string, number>): PeriodPiece[] {
  const bust = m.chest;
  const ease = o.bustEaseMm;
  const backLen = m.hpsToWaistBack;
  const neckW = m.neck / 5;
  const shoulderHalf = m.shoulderToShoulder / 2;

  const scyeY = bust / 8 + 70;
  const hemY = backLen + 75; // blousing below the waist

  // --- Back -------------------------------------------------------------------
  const widthB = bust / 4 + ease / 2;
  const O = P(0, 0);
  const N = P(neckW, -22);
  const Sh = P(shoulderHalf, 38);
  const U = P(widthB, scyeY); // underarm
  const Hs = P(widthB - 12, hemY);

  const back: PeriodPiece = {
    name: "Back",
    cut: "Cut 1 · on the fold",
    outline:
      M(O) +
      " " +
      q(O, N, -7) +
      " " +
      L(Sh) +
      " " +
      throughOn(Sh, P(widthB - 28, scyeY * 0.62), U) + // armscye
      " " +
      q(U, Hs, 5) + // underarm seam
      " " +
      L(P(0, hemY)) +
      " Z",
    internals: [
      `M 0 ${r1(scyeY)} L ${r1(widthB)} ${r1(scyeY)}`,
      `M 0 ${r1(backLen)} L ${r1(widthB - 10)} ${r1(backLen)}`, // waist line
    ],
    points: [
      { at: O, label: "A" },
      { at: N, label: "B" },
      { at: Sh, label: "C" },
      { at: U, label: "D" },
    ],
    fold: [P(0, 0), P(0, hemY)],
    grain: [P(55, scyeY), P(55, hemY - 40)],
    notes: [{ at: P(widthB / 2, backLen + 40), text: "gather 60 mm at the waist" }],
  };

  // --- Front ------------------------------------------------------------------
  const widthF = bust / 4 + ease / 2 + 20;
  const neckD = 85;
  const Shf = P(neckW + 16, -30); // shoulder neck end, raised (18 mm placket stand sits beyond CF)
  const ShTf = P(shoulderHalf + 14, 28);
  const Uf = P(widthF, scyeY);
  const Hf = P(widthF - 12, hemY);

  const front: PeriodPiece = {
    name: "Front",
    cut: "Cut 2 · placket stand on the centre-front",
    outline:
      M(P(18, neckD)) + // CF at the neck depth (on the placket line)
      " " +
      q(P(18, neckD), Shf, -42) + // front neck curve
      " " +
      L(ShTf) +
      " " +
      throughOn(ShTf, P(widthF - 34, scyeY * 0.66), Uf) +
      " " +
      q(Uf, Hf, 5) +
      " " +
      L(P(0, hemY)) +
      " " +
      L(P(0, neckD + 6)) +
      " " +
      L(P(18, neckD)),
    internals: [
      `M 18 ${r1(neckD)} L 18 ${r1(hemY)}`, // centre-front / button line
      `M 0 ${r1(scyeY)} L ${r1(widthF)} ${r1(scyeY)}`,
      `M 0 ${r1(backLen)} L ${r1(widthF - 10)} ${r1(backLen)}`,
      ...Array.from({ length: 6 }, (_, i) => {
        const y = neckD + 45 + i * ((backLen - neckD - 45) / 5);
        return `M 18 ${r1(y)} a 3.5 3.5 0 1 0 0.1 0`;
      }),
    ],
    points: [
      { at: Shf, label: "E" },
      { at: ShTf, label: "F" },
      { at: Uf, label: "G" },
    ],
    grain: [P(widthF - 60, scyeY), P(widthF - 60, hemY - 40)],
    notes: [{ at: P(widthF / 2, backLen + 40), text: "gather 80 mm each side of the buttons" }],
  };

  // --- Sleeve -----------------------------------------------------------------
  const sleeveW = m.biceps + 90;
  const capH = 118;
  const sleeveLen = m.shoulderToWrist - 95; // the cuff carries the rest
  const wristW = m.wrist + 95;
  const inset = (sleeveW - wristW) / 2;

  const sleeve: PeriodPiece = {
    name: "Sleeve",
    cut: "Cut 2 · gather the crown between the notches",
    outline:
      through(
        P(0, capH),
        P(sleeveW * 0.22, capH * 0.42),
        P(sleeveW * 0.48, 0),
        P(sleeveW * 0.78, capH * 0.5),
        P(sleeveW, capH),
      ) +
      " " +
      q(P(sleeveW, capH), P(sleeveW - inset, sleeveLen), -6) +
      " " +
      L(P(inset, sleeveLen)) +
      " " +
      q(P(inset, sleeveLen), P(0, capH), -6) +
      "",
    internals: [
      `M ${r1(sleeveW / 2)} ${r1(capH)} L ${r1(sleeveW / 2)} ${r1(sleeveLen)}`,
      // placket slash at the back of the wrist
      `M ${r1(sleeveW * 0.68)} ${r1(sleeveLen)} L ${r1(sleeveW * 0.68)} ${r1(sleeveLen - 75)}`,
    ],
    grain: [P(sleeveW / 2 - 55, capH + 40), P(sleeveW / 2 - 55, sleeveLen - 40)],
    notes: [
      { at: P(sleeveW / 2, capH - 20), text: "notch · gather crown" },
      { at: P(sleeveW * 0.68, sleeveLen - 90), text: "placket" },
    ],
  };

  const cuff: PeriodPiece = {
    name: "Cuff",
    cut: "Cut 2 · fold on the long edge",
    outline: `M 0 0 L ${r1(m.wrist + 70)} 0 L ${r1(m.wrist + 70)} 85 L 0 85 Z`,
    internals: [`M 0 42.5 L ${r1(m.wrist + 70)} 42.5`],
    fold: [P(0, 42.5), P(m.wrist + 70, 42.5)],
    grain: [P(30, 12), P(m.wrist + 40, 12)],
  };

  return [back, front, sleeve, cuff];
}

// ---------------------------------------------------------------------------
// 4 · Circular cape — after the cloak drafts in the period cutters' guides
// ---------------------------------------------------------------------------

function draftCircularCape(m: Record<string, number>, o: Record<string, number>): PeriodPiece[] {
  const neckArc = m.neck + 25;
  const sweepPct = o.sweepPct; // 50 = half circle, 100 = full circle
  const theta = Math.PI * 2 * (sweepPct / 100); // full-garment angle
  const r0 = neckArc / theta;
  const R = r0 + o.lengthMm;
  const phi = Math.min(Math.PI, theta / 2); // the piece is half the garment, on the fold

  // First edge along +x (the fold), sweeping downward (clockwise).
  const rot = (r: number, a: number) => P(r * Math.cos(a), r * Math.sin(a));
  const i0 = rot(r0, 0);
  const i1 = rot(r0, phi);
  const o0 = rot(R, 0);
  const o1 = rot(R, phi);
  const large = phi > Math.PI ? 1 : 0;

  // Analytic bounds: sample both arcs (the outer arc's extreme sits mid-sweep,
  // never on an endpoint once the sweep passes 90°).
  const capeBounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (let a = 0; a <= phi + 1e-6; a += Math.PI / 72) {
    for (const rr of [r0, R]) {
      const p = rot(rr, Math.min(a, phi));
      capeBounds.minX = Math.min(capeBounds.minX, p.x);
      capeBounds.maxX = Math.max(capeBounds.maxX, p.x);
      capeBounds.minY = Math.min(capeBounds.minY, p.y);
      capeBounds.maxY = Math.max(capeBounds.maxY, p.y);
    }
  }

  const cape: PeriodPiece = {
    name: "Cape",
    cut: "Cut 1 · on the fold along the straight edge",
    bbox: capeBounds,
    outline:
      M(i0) +
      ` A ${r1(r0)} ${r1(r0)} 0 ${large} 1 ${r1(i1.x)} ${r1(i1.y)} ` +
      L(o1) +
      ` A ${r1(R)} ${r1(R)} 0 ${large} 0 ${r1(o0.x)} ${r1(o0.y)} ` +
      "Z",
    internals: [
      // a mid sweep line, the guide for levelling the hem on the figure
      `M ${r1(rot((r0 + R) / 2, 0).x)} 0 A ${r1((r0 + R) / 2)} ${r1((r0 + R) / 2)} 0 ${large} 1 ${r1(rot((r0 + R) / 2, phi).x)} ${r1(rot((r0 + R) / 2, phi).y)}`,
    ],
    fold: [i0, o0],
    grain: [rot(r0 + 120, phi / 2), rot(R - 120, phi / 2)],
    notes: [
      { at: rot(r0 + 60, phi * 0.45), text: "neck edge" },
      { at: rot(R - 60, phi * 0.55), text: "hem" },
    ],
  };

  const collar: PeriodPiece = {
    name: "Collar stand",
    cut: "Cut 2 · interline for body",
    outline: `M 0 0 L ${r1(neckArc / 2 + 20)} 0 L ${r1(neckArc / 2 + 20)} 62 L 0 62 Z`,
    internals: [`M 0 31 L ${r1(neckArc / 2 + 20)} 31`],
    grain: [P(25, 10), P(neckArc / 2 - 5, 10)],
  };

  const pieces = [cape, collar];

  if (o.hood >= 1) {
    const hw = 340;
    const hh = 380;
    pieces.push({
      name: "Hood",
      cut: "Cut 2 · seam along the curved back edge",
      outline:
        M(P(0, 0)) +
        " " +
        L(P(0, hh)) + // face edge
        " " +
        L(P(hw * 0.62, hh)) + // neck edge
        " " +
        throughOn(P(hw * 0.62, hh), P(hw, hh * 0.62), P(hw * 0.8, hh * 0.12), P(hw * 0.3, 0), P(0, 0)),
      internals: [`M 0 ${r1(hh - 25)} L ${r1(hw * 0.62)} ${r1(hh - 25)}`],
      grain: [P(60, 60), P(60, hh - 60)],
      notes: [{ at: P(hw * 0.31, hh - 45), text: "gather to the neck" }],
    });
  }

  return pieces;
}

// ---------------------------------------------------------------------------
// The register
// ---------------------------------------------------------------------------

export const PERIOD_SYSTEMS: PeriodSystem[] = [
  {
    id: "vincent-trousers",
    name: "The Vincent trouser system",
    garment: "Trousers",
    era: "London, c. 1893",
    source: { author: "W.D.F. Vincent", title: "The Cutter's Practical Guide", year: "c. 1893" },
    blurb:
      "The workhorse trouser draft of the Victorian trade — fore and back parts struck from the seat scale, with the fish-dart back and a proper fork scoop.",
    measurements: ["waist", "seat", "inseam", "waistToFloor", "knee"],
    options: [
      { key: "bottomMm", label: "Hem circumference", min: 360, max: 580, step: 10, dflt: 440, unit: "mm", hint: "440 is the classic straight leg; narrow for a period taper." },
      { key: "seatEaseMm", label: "Seat ease", min: 20, max: 90, step: 5, dflt: 50, unit: "mm" },
    ],
    draft: draftVincentTrousers,
  },
  {
    id: "keystone-vest",
    name: "The Keystone vest",
    garment: "Single-breasted vest",
    era: "Philadelphia, 1895",
    source: { author: "Chas. Hecklinger", title: "The Keystone Systems", year: "1895" },
    blurb:
      "Hecklinger's single-breasted vest, struck from the breast measure: hollowed centre-back, V-opening with five buttons, front dart and welt pocket marked.",
    measurements: ["chest", "waist", "hpsToWaistBack", "neck"],
    options: [
      { key: "chestEaseMm", label: "Breast ease", min: 20, max: 90, step: 5, dflt: 45, unit: "mm" },
    ],
    draft: draftKeystoneVest,
  },
  {
    id: "fales-shirtwaist",
    name: "The Fales shirt-waist",
    garment: "Shirt-waist (blouse)",
    era: "New York, 1917",
    source: { author: "Jane Fales", title: "Dressmaking: A Manual for Schools and Colleges", year: "1917" },
    blurb:
      "The gathered shirt-waist every 1910s wardrobe was built on: blousing below the waist, gathered crown sleeve, buttoned cuff — four pieces, drafted flat.",
    measurements: ["chest", "hpsToWaistBack", "neck", "shoulderToShoulder", "biceps", "shoulderToWrist", "wrist"],
    options: [
      { key: "bustEaseMm", label: "Bust ease", min: 60, max: 160, step: 10, dflt: 100, unit: "mm" },
    ],
    draft: draftFalesShirtwaist,
  },
  {
    id: "circular-cape",
    name: "The circular cape",
    garment: "Cape / cloak",
    era: "the trade's standard, 1880s–1900s",
    source: { author: "the period cutters' guides", title: "standard cloak drafts", year: "1880s" },
    blurb:
      "The geometry every cloak in the plates hangs from: the neck arc sets the radius, the sweep sets the drama. Half circle for walking, full circle for opera.",
    measurements: ["neck"],
    options: [
      { key: "sweepPct", label: "Sweep", min: 50, max: 100, step: 25, dflt: 75, unit: "%", hint: "50% half circle · 75% three-quarter · 100% full circle" },
      { key: "lengthMm", label: "Length from the neck", min: 500, max: 1250, step: 25, dflt: 950, unit: "mm" },
      { key: "hood", label: "Hood", min: 0, max: 1, step: 1, dflt: 0, unit: "mm", hint: "0 = collar only, 1 = add the hood" },
    ],
    draft: draftCircularCape,
  },
];

export function periodSystem(id: string): PeriodSystem | undefined {
  return PERIOD_SYSTEMS.find((s) => s.id === id);
}

// ---------------------------------------------------------------------------
// Grading — the same standard body and scaling rules the Pattern Studio uses
// (a working subset kept here so this module stays free of the FreeSewing
// bundle; values mirror BASE_MEASUREMENTS in patterns.ts).
// ---------------------------------------------------------------------------

const PERIOD_BASE: Record<string, number> = {
  waist: 820, seat: 1000, inseam: 780, waistToFloor: 1080, knee: 380,
  chest: 1080, hpsToWaistBack: 460, neck: 400, shoulderToShoulder: 445,
  biceps: 335, shoulderToWrist: 620, wrist: 170,
};
const PERIOD_LENGTHS = new Set(["inseam", "waistToFloor", "hpsToWaistBack", "shoulderToWrist"]);
const BASE_CHEST_CM = 108;
const BASE_HEIGHT_CM = 170;

export interface PeriodBodyInput {
  chestCm?: number;
  waistCm?: number;
  hipsCm?: number;
  heightCm?: number;
  /** Per-measurement overrides in cm, keyed by measurement name. */
  exact?: Record<string, number | undefined>;
}

/** Standard body scaled per size (same rules as the Pattern Studio: girths
 *  follow chest, lengths follow height, direct inputs win). Returns mm. */
export function periodMeasurements(sizeScale: number, m?: PeriodBodyInput): Record<string, number> {
  const girth = m?.chestCm ? m.chestCm / BASE_CHEST_CM : sizeScale;
  const length = m?.heightCm ? m.heightCm / BASE_HEIGHT_CM : sizeScale;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(PERIOD_BASE)) {
    out[k] = Math.round(v * (PERIOD_LENGTHS.has(k) ? length : girth));
  }
  if (m?.chestCm) out.chest = Math.round(m.chestCm * 10);
  if (m?.waistCm) out.waist = Math.round(m.waistCm * 10);
  if (m?.hipsCm) out.seat = Math.round(m.hipsCm * 10);
  for (const [k, v] of Object.entries(m?.exact ?? {})) {
    if (k in out && typeof v === "number" && Number.isFinite(v) && v > 0) out[k] = Math.round(v * 10);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Rendering — pieces → one true-scale SVG sheet (mm coordinates)
// ---------------------------------------------------------------------------

interface Bounds { minX: number; minY: number; maxX: number; maxY: number }

/** Command-aware bounds: anchors + curve control points (close enough for our
 *  gentle curves). Arc radii are skipped; pieces built on large arcs declare
 *  their own analytic bbox instead. */
function pathBounds(d: string, own?: Bounds): Bounds {
  if (own) return own;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const take = (x: number, y: number) => {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  };
  const tokens = d.match(/[MLCQAZ]|-?\d+(\.\d+)?/gi) ?? [];
  let i = 0;
  let cmd = "";
  const num = () => Number(tokens[i++]);
  while (i < tokens.length) {
    const t = tokens[i];
    if (/^[MLCQAZ]$/i.test(String(t))) { cmd = String(t).toUpperCase(); i++; continue; }
    if (cmd === "M" || cmd === "L") take(num(), num());
    else if (cmd === "Q") { take(num(), num()); take(num(), num()); }
    else if (cmd === "C") { take(num(), num()); take(num(), num()); take(num(), num()); }
    else if (cmd === "A") { num(); num(); num(); num(); num(); take(num(), num()); }
    else i++;
  }
  if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 100, maxY: 100 };
  return { minX, minY, maxX, maxY };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export interface RenderMeta {
  system: PeriodSystem;
  /** "size M" or "made to measure" — printed on the sheet. */
  gradeNote: string;
}

/** Lay the pieces out on one sheet and render true-scale SVG (mm). */
export function renderPeriodSvg(pieces: PeriodPiece[], meta: RenderMeta): string {
  const GUTTER = 70;
  const TITLE_H = 92;
  const PAD = 25;

  interface Placed { piece: PeriodPiece; dx: number; dy: number; w: number; h: number }
  const placed: Placed[] = [];
  let cursorX = PAD;
  let rowH = 0;

  for (const piece of pieces) {
    const b = pathBounds(piece.outline, piece.bbox);
    const w = b.maxX - b.minX;
    const h = b.maxY - b.minY;
    placed.push({ piece, dx: cursorX - b.minX, dy: TITLE_H + PAD - b.minY, w, h });
    cursorX += w + GUTTER;
    rowH = Math.max(rowH, h);
  }
  const sheetW = cursorX - GUTTER + PAD;
  const sheetH = TITLE_H + PAD + rowH + PAD + 40;

  const g: string[] = [];

  // Fine grid: 10 mm light, 50 mm a touch heavier.
  g.push(`<g>`);
  for (let x = 0; x <= sheetW; x += 10) {
    g.push(`<line x1="${x}" y1="0" x2="${x}" y2="${r1(sheetH)}" stroke="#1c2b4a" stroke-opacity="${x % 50 === 0 ? 0.09 : 0.04}" stroke-width="0.35"/>`);
  }
  for (let y = 0; y <= sheetH; y += 10) {
    g.push(`<line x1="0" y1="${y}" x2="${r1(sheetW)}" y2="${y}" stroke="#1c2b4a" stroke-opacity="${y % 50 === 0 ? 0.09 : 0.04}" stroke-width="0.35"/>`);
  }
  g.push(`</g>`);

  // Title block.
  const s = meta.system;
  g.push(
    `<text x="${PAD}" y="30" font-size="17" font-family="Georgia, serif" fill="#16233f">${esc(s.name)} — ${esc(s.garment)}</text>`,
    `<text x="${PAD}" y="50" font-size="10" font-family="Georgia, serif" font-style="italic" fill="#42506b">After ${esc(s.source.author)}, “${esc(s.source.title)}” (${esc(s.source.year)}) · drafted ${esc(meta.gradeNote)} · Verto Drafting Room</text>`,
    `<text x="${PAD}" y="66" font-size="8.5" font-family="Georgia, serif" fill="#6b7690">An adaptation of the period system for modern measurement input — the source volume is in the Timeless Library. Seam allowance is NOT included; add your own as the period cutters did.</text>`,
  );
  // 5 cm scale bar.
  g.push(
    `<rect x="${PAD}" y="74" width="50" height="4" fill="#16233f"/>`,
    `<text x="${PAD + 56}" y="78" font-size="7.5" font-family="Georgia, serif" fill="#42506b">5 cm — check before cutting</text>`,
  );

  for (const { piece, dx, dy, w, h } of placed) {
    const b = pathBounds(piece.outline, piece.bbox);
    g.push(`<g transform="translate(${r1(dx)} ${r1(dy)})">`);
    g.push(`<path d="${piece.outline}" fill="#f7f1e4" fill-opacity="0.55" stroke="#16233f" stroke-width="1.4" stroke-linejoin="round"/>`);
    for (const d of piece.internals ?? []) {
      g.push(`<path d="${d}" fill="none" stroke="#42506b" stroke-width="0.7" stroke-dasharray="4 3"/>`);
    }
    if (piece.grain) {
      const [a, b2] = piece.grain;
      g.push(
        `<line x1="${r1(a.x)}" y1="${r1(a.y)}" x2="${r1(b2.x)}" y2="${r1(b2.y)}" stroke="#7a5c2e" stroke-width="0.9"/>`,
        `<path d="M ${r1(a.x - 4)} ${r1(a.y + 7)} L ${r1(a.x)} ${r1(a.y)} L ${r1(a.x + 4)} ${r1(a.y + 7)}" fill="none" stroke="#7a5c2e" stroke-width="0.9"/>`,
        `<path d="M ${r1(b2.x - 4)} ${r1(b2.y - 7)} L ${r1(b2.x)} ${r1(b2.y)} L ${r1(b2.x + 4)} ${r1(b2.y - 7)}" fill="none" stroke="#7a5c2e" stroke-width="0.9"/>`,
      );
    }
    if (piece.fold) {
      const [a, b2] = piece.fold;
      g.push(
        `<line x1="${r1(a.x)}" y1="${r1(a.y)}" x2="${r1(b2.x)}" y2="${r1(b2.y)}" stroke="#7a5c2e" stroke-width="1" stroke-dasharray="9 4"/>`,
        `<text x="${r1((a.x + b2.x) / 2 + 4)}" y="${r1((a.y + b2.y) / 2)}" font-size="7.5" font-family="Georgia, serif" fill="#7a5c2e" transform="rotate(${a.x === b2.x ? 90 : 0} ${r1((a.x + b2.x) / 2 + 4)} ${r1((a.y + b2.y) / 2)})">fold</text>`,
      );
    }
    for (const p of piece.points ?? []) {
      g.push(
        `<circle cx="${r1(p.at.x)}" cy="${r1(p.at.y)}" r="1.6" fill="#16233f"/>`,
        `<text x="${r1(p.at.x + 5)}" y="${r1(p.at.y - 4)}" font-size="9" font-family="Georgia, serif" font-style="italic" fill="#16233f">${esc(p.label)}</text>`,
      );
    }
    for (const n of piece.notes ?? []) {
      g.push(`<text x="${r1(n.at.x)}" y="${r1(n.at.y)}" font-size="7.5" font-family="Georgia, serif" fill="#42506b" text-anchor="middle">${esc(n.text)}</text>`);
    }
    // Piece caption under the piece.
    g.push(
      `<text x="${r1(b.minX + w / 2)}" y="${r1(b.maxY + 24)}" font-size="11" font-family="Georgia, serif" fill="#16233f" text-anchor="middle">${esc(piece.name)}</text>`,
      `<text x="${r1(b.minX + w / 2)}" y="${r1(b.maxY + 36)}" font-size="8" font-family="Georgia, serif" fill="#6b7690" text-anchor="middle">${esc(piece.cut)}</text>`,
    );
    g.push(`</g>`);
    void h;
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${r1(sheetW)} ${r1(sheetH)}" width="${r1(sheetW)}mm" height="${r1(sheetH)}mm">` +
    `<rect x="0" y="0" width="${r1(sheetW)}" height="${r1(sheetH)}" fill="#fdfbf6"/>` +
    g.join("") +
    `</svg>`
  );
}
