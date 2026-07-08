/**
 * Real 2D sewing patterns via FreeSewing (MIT, pure client-side JS). Given a
 * base garment + size, this drafts a manufacturable flat pattern and returns
 * its SVG — the "co-equal" pattern track alongside the 3D preview. FreeSewing
 * produces true pattern pieces (front/back/sleeve), not a 3D drape.
 *
 * Grading here is a simple proportional scale of a standard measurement set —
 * enough for a starter pattern designers can export and refine, not a graded
 * industrial nest.
 */
import { Teagan } from "@freesewing/teagan";
import { Titan } from "@freesewing/titan";
import { Penelope } from "@freesewing/penelope";
import { Sven } from "@freesewing/sven";
import { Sophie } from "@freesewing/sophie";
import { pluginTheme } from "@freesewing/plugin-theme";
import { SIZE_SCALE, type SizeStep } from "../../shared/garments";

// A standard-size measurement set (millimetres) covering every measurement the
// mapped designs require. Scaled per size for a first-pass grade.
const BASE_MEASUREMENTS: Record<string, number> = {
  ankle: 230, biceps: 335, bustFront: 490, bustPointToUnderbust: 60, bustSpan: 190,
  chest: 1080, crossSeam: 700, crossSeamFront: 340, crotchDepth: 280, head: 560,
  heel: 350, highBust: 1030, highBustFront: 470, hips: 1000, hpsToBust: 290,
  hpsToWaistBack: 460, hpsToWaistFront: 480, inseam: 780, knee: 380, neck: 400,
  seat: 1000, seatBack: 520, shoulderSlope: 13, shoulderToElbow: 340,
  shoulderToShoulder: 445, shoulderToWrist: 620, underbust: 900, upperLeg: 600,
  waist: 820, waistBack: 410, waistToArmpit: 230, waistToFloor: 1080,
  waistToHips: 130, waistToKnee: 580, waistToSeat: 280, waistToUnderbust: 180,
  waistToUpperLeg: 280, wrist: 170,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Design = new (settings: any) => { use: (p: unknown) => { draft: () => { render: () => string } } };

interface PatternEntry {
  design: Design;
  label: string;
}

const DESIGN_MAP: Record<string, PatternEntry> = {
  "classic-tee": { design: Teagan as unknown as Design, label: "T-shirt block · FreeSewing “Teagan”" },
  "relaxed-hoodie": { design: Sven as unknown as Design, label: "Sweatshirt block · FreeSewing “Sven”" },
  "slip-dress": { design: Sophie as unknown as Design, label: "Slip dress · FreeSewing “Sophie”" },
  "wide-trouser": { design: Titan as unknown as Design, label: "Trouser block · FreeSewing “Titan”" },
  "pleated-skirt": { design: Penelope as unknown as Design, label: "Skirt block · FreeSewing “Penelope”" },
};

export function hasPattern(garmentId: string): boolean {
  return garmentId in DESIGN_MAP;
}

/** The garment blocks that can be drafted into a real pattern — for a picker
 *  in the Design Studio, where the AI concept has no fixed silhouette. */
export const PATTERN_BLOCKS: readonly { id: string; name: string }[] = [
  { id: "classic-tee", name: "T-shirt" },
  { id: "relaxed-hoodie", name: "Hoodie / sweatshirt" },
  { id: "slip-dress", name: "Slip dress" },
  { id: "wide-trouser", name: "Trouser" },
  { id: "pleated-skirt", name: "Skirt" },
];

export function patternLabel(garmentId: string): string | null {
  return DESIGN_MAP[garmentId]?.label ?? null;
}

/** Optional made-to-measure inputs (centimetres). Blank fields fall back to the
 *  size-graded standard set. */
export interface BodyMeasurements {
  chestCm?: number;
  waistCm?: number;
  hipsCm?: number;
  heightCm?: number;
}

/**
 * Parametric pattern adjustments, expressed as percentage bonuses and mapped
 * onto each design's NATIVE FreeSewing options — so moving a slider redrafts
 * the actual pattern pieces, not a picture of them.
 */
export interface PatternOptions {
  /** Extra ease through the body, in % (0–25). */
  easePct?: number;
  /** Hem length bonus in % (−15 cropped … +20 longline). */
  lengthPct?: number;
  /** Sleeve length bonus in % (−30 … +10). */
  sleevePct?: number;
  /** Seam allowance in mm (0 = none drawn). */
  seamAllowanceMm?: number;
  /** Paperless mode prints the dimensions on the pattern itself. */
  paperless?: boolean;
}

// Which native option names carry each adjustment, per design. Only options a
// design actually defines are listed — unknown names would be ignored at best.
const OPTION_KEYS: Record<string, { ease?: string[]; length?: string[]; sleeve?: string[] }> = {
  "classic-tee": { ease: ["chestEase"], length: ["lengthBonus"], sleeve: ["sleeveLengthBonus"] },
  "relaxed-hoodie": { ease: ["chestEase"], length: ["lengthBonus"], sleeve: ["sleeveLengthBonus"] },
  "slip-dress": { length: ["lengthBonus"] },
  "wide-trouser": { ease: ["waistEase", "seatEase"] },
  "pleated-skirt": { ease: ["waistEase", "hipsEase"], length: ["lengthBonus"] },
};

/** Which sliders make sense for a block — drives the studio UI. */
export function patternAdjustables(garmentId: string): { ease: boolean; length: boolean; sleeve: boolean } {
  const k = OPTION_KEYS[garmentId] ?? {};
  return { ease: Boolean(k.ease), length: Boolean(k.length), sleeve: Boolean(k.sleeve) };
}

function designOptions(garmentId: string, opts?: PatternOptions): Record<string, number> {
  const keys = OPTION_KEYS[garmentId];
  const out: Record<string, number> = {};
  if (!keys || !opts) return out;
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v)) / 100;
  if (opts.easePct !== undefined && keys.ease) {
    for (const k of keys.ease) out[k] = clamp(opts.easePct, 0, 25);
  }
  if (opts.lengthPct !== undefined && keys.length) {
    for (const k of keys.length) out[k] = clamp(opts.lengthPct, -15, 20);
  }
  if (opts.sleevePct !== undefined && keys.sleeve) {
    for (const k of keys.sleeve) out[k] = clamp(opts.sleevePct, -30, 10);
  }
  return out;
}

// Measurements that scale with height (lengths) rather than girth.
const LENGTH_MEASURES = new Set([
  "ankle", "crotchDepth", "hpsToBust", "hpsToWaistBack", "hpsToWaistFront", "inseam",
  "knee", "shoulderToElbow", "shoulderToWrist", "waistToArmpit", "waistToFloor",
  "waistToHips", "waistToKnee", "waistToSeat", "waistToUnderbust", "waistToUpperLeg", "heel",
]);
const BASE_CHEST_CM = 108;
const BASE_HEIGHT_CM = 170;

function measurementsFor(size: SizeStep, m?: BodyMeasurements): Record<string, number> {
  const sizeScale = SIZE_SCALE[size];
  const girthScale = m?.chestCm ? m.chestCm / BASE_CHEST_CM : sizeScale;
  const lengthScale = m?.heightCm ? m.heightCm / BASE_HEIGHT_CM : sizeScale;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(BASE_MEASUREMENTS)) {
    out[k] = Math.round(v * (LENGTH_MEASURES.has(k) ? lengthScale : girthScale));
  }
  // Hard overrides for the girths the user gave (cm → mm).
  if (m?.chestCm) out.chest = Math.round(m.chestCm * 10);
  if (m?.waistCm) {
    out.waist = Math.round(m.waistCm * 10);
    out.waistBack = Math.round(m.waistCm * 10 * 0.5);
  }
  if (m?.hipsCm) {
    out.hips = Math.round(m.hipsCm * 10);
    out.seat = Math.round(m.hipsCm * 10);
  }
  return out;
}

/** Draft a real pattern and return its SVG (or null if unsupported / on error). */
export function draftPatternSvg(
  garmentId: string,
  size: SizeStep,
  measurements?: BodyMeasurements,
  opts?: PatternOptions,
): { svg: string; label: string } | null {
  const entry = DESIGN_MAP[garmentId];
  if (!entry) return null;
  const measured = measurementsFor(size, measurements);
  const base: Record<string, unknown> = {
    measurements: measured,
    paperless: opts?.paperless ?? true,
  };
  if (opts?.seamAllowanceMm) base.sa = opts.seamAllowanceMm;
  const draft = (settings: Record<string, unknown>) =>
    new entry.design(settings).use(pluginTheme).draft().render();
  try {
    return { svg: draft({ ...base, options: designOptions(garmentId, opts) }), label: entry.label };
  } catch {
    // An adjustment outside a design's accepted range shouldn't brick the
    // studio — fall back to the unadjusted draft.
    try {
      return { svg: draft(base), label: entry.label };
    } catch {
      return null;
    }
  }
}
