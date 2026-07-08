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
import { Aaron } from "@freesewing/aaron";
import { Bella } from "@freesewing/bella";
import { Bent } from "@freesewing/bent";
import { Benjamin } from "@freesewing/benjamin";
import { Breanna } from "@freesewing/breanna";
import { Brian } from "@freesewing/brian";
import { Bruce } from "@freesewing/bruce";
import { Carlita } from "@freesewing/carlita";
import { Carlton } from "@freesewing/carlton";
import { Cathrin } from "@freesewing/cathrin";
import { Charlie } from "@freesewing/charlie";
import { Diana } from "@freesewing/diana";
import { Huey } from "@freesewing/huey";
import { Hugo } from "@freesewing/hugo";
import { Noble } from "@freesewing/noble";
import { Paco } from "@freesewing/paco";
import { Sandy } from "@freesewing/sandy";
import { Shin } from "@freesewing/shin";
import { Simon } from "@freesewing/simon";
import { Simone } from "@freesewing/simone";
import { Tamiko } from "@freesewing/tamiko";
import { Uma } from "@freesewing/uma";
import { Wahid } from "@freesewing/wahid";
import { Walburga } from "@freesewing/walburga";
import { Waralee } from "@freesewing/waralee";
import { Yuri } from "@freesewing/yuri";
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
  // Legacy ids (early saved patterns + the shared garment library use these).
  "classic-tee": { design: Teagan as unknown as Design, label: "T-shirt · FreeSewing \u201cTeagan\u201d" },
  "relaxed-hoodie": { design: Sven as unknown as Design, label: "Sweatshirt · FreeSewing \u201cSven\u201d" },
  "slip-dress": { design: Sophie as unknown as Design, label: "Slip dress · FreeSewing \u201cSophie\u201d" },
  "wide-trouser": { design: Titan as unknown as Design, label: "Trouser block · FreeSewing \u201cTitan\u201d" },
  "pleated-skirt": { design: Penelope as unknown as Design, label: "Skirt · FreeSewing \u201cPenelope\u201d" },
  // The rest of FreeSewing's apparel catalogue (each verified to draft against
  // the studio's measurement set — see the probe in the Pattern Studio PR).
  aaron: { design: Aaron as unknown as Design, label: "Tank top · FreeSewing \u201cAaron\u201d" },
  tamiko: { design: Tamiko as unknown as Design, label: "Loose-cut top · FreeSewing \u201cTamiko\u201d" },
  diana: { design: Diana as unknown as Design, label: "Drape-neck top · FreeSewing \u201cDiana\u201d" },
  simon: { design: Simon as unknown as Design, label: "Button-down shirt · FreeSewing \u201cSimon\u201d" },
  simone: { design: Simone as unknown as Design, label: "Button-down shirt (women's) · FreeSewing \u201cSimone\u201d" },
  hugo: { design: Hugo as unknown as Design, label: "Pullover hoodie · FreeSewing \u201cHugo\u201d" },
  huey: { design: Huey as unknown as Design, label: "Zip-up hoodie · FreeSewing \u201cHuey\u201d" },
  yuri: { design: Yuri as unknown as Design, label: "Hoodie dress · FreeSewing \u201cYuri\u201d" },
  walburga: { design: Walburga as unknown as Design, label: "Wrap dress · FreeSewing \u201cWalburga\u201d" },
  charlie: { design: Charlie as unknown as Design, label: "Chinos · FreeSewing \u201cCharlie\u201d" },
  paco: { design: Paco as unknown as Design, label: "Summer pants · FreeSewing \u201cPaco\u201d" },
  waralee: { design: Waralee as unknown as Design, label: "Wrap pants · FreeSewing \u201cWaralee\u201d" },
  sandy: { design: Sandy as unknown as Design, label: "Circle skirt · FreeSewing \u201cSandy\u201d" },
  carlita: { design: Carlita as unknown as Design, label: "Coat · FreeSewing \u201cCarlita\u201d" },
  carlton: { design: Carlton as unknown as Design, label: "Coat (men's) · FreeSewing \u201cCarlton\u201d" },
  bent: { design: Bent as unknown as Design, label: "Jacket block · FreeSewing \u201cBent\u201d" },
  wahid: { design: Wahid as unknown as Design, label: "Waistcoat · FreeSewing \u201cWahid\u201d" },
  cathrin: { design: Cathrin as unknown as Design, label: "Corset · FreeSewing \u201cCathrin\u201d" },
  brian: { design: Brian as unknown as Design, label: "Basic block (men's) · FreeSewing \u201cBrian\u201d" },
  bella: { design: Bella as unknown as Design, label: "Bodice block · FreeSewing \u201cBella\u201d" },
  breanna: { design: Breanna as unknown as Design, label: "Bodice block (alt) · FreeSewing \u201cBreanna\u201d" },
  noble: { design: Noble as unknown as Design, label: "Dart-manipulation bodice · FreeSewing \u201cNoble\u201d" },
  bruce: { design: Bruce as unknown as Design, label: "Briefs · FreeSewing \u201cBruce\u201d" },
  uma: { design: Uma as unknown as Design, label: "Underwear · FreeSewing \u201cUma\u201d" },
  shin: { design: Shin as unknown as Design, label: "Swim trunks · FreeSewing \u201cShin\u201d" },
  benjamin: { design: Benjamin as unknown as Design, label: "Bow tie · FreeSewing \u201cBenjamin\u201d" },
};

export function hasPattern(garmentId: string): boolean {
  return garmentId in DESIGN_MAP;
}

/** The garment blocks that can be drafted into a real pattern — for a picker
 *  in the Design Studio, where the AI concept has no fixed silhouette. */
export const PATTERN_GROUPS: readonly { label: string; blocks: readonly { id: string; name: string }[] }[] = [
  { label: "Tops", blocks: [
    { id: "classic-tee", name: "T-shirt" },
    { id: "aaron", name: "Tank top" },
    { id: "tamiko", name: "Loose-cut top" },
    { id: "diana", name: "Drape-neck top" },
  ]},
  { label: "Shirts", blocks: [
    { id: "simon", name: "Button-down shirt" },
    { id: "simone", name: "Button-down shirt (women's)" },
  ]},
  { label: "Hoodies & sweats", blocks: [
    { id: "relaxed-hoodie", name: "Sweatshirt" },
    { id: "hugo", name: "Pullover hoodie" },
    { id: "huey", name: "Zip-up hoodie" },
    { id: "yuri", name: "Hoodie dress" },
  ]},
  { label: "Dresses", blocks: [
    { id: "slip-dress", name: "Slip dress" },
    { id: "walburga", name: "Wrap dress" },
  ]},
  { label: "Bottoms", blocks: [
    { id: "wide-trouser", name: "Trouser block" },
    { id: "charlie", name: "Chinos" },
    { id: "paco", name: "Summer pants" },
    { id: "waralee", name: "Wrap pants" },
    { id: "pleated-skirt", name: "Pleated skirt" },
    { id: "sandy", name: "Circle skirt" },
  ]},
  { label: "Tailoring & outerwear", blocks: [
    { id: "carlita", name: "Coat" },
    { id: "carlton", name: "Coat (men's)" },
    { id: "bent", name: "Jacket block" },
    { id: "wahid", name: "Waistcoat" },
    { id: "cathrin", name: "Corset" },
  ]},
  { label: "Foundation blocks", blocks: [
    { id: "brian", name: "Basic block (men's)" },
    { id: "bella", name: "Bodice block" },
    { id: "breanna", name: "Bodice block (alt)" },
    { id: "noble", name: "Dart-manipulation bodice" },
  ]},
  { label: "Underwear, swim & extras", blocks: [
    { id: "bruce", name: "Briefs" },
    { id: "uma", name: "Underwear" },
    { id: "shin", name: "Swim trunks" },
    { id: "benjamin", name: "Bow tie" },
  ]},
];

export const PATTERN_BLOCKS: readonly { id: string; name: string }[] = PATTERN_GROUPS.flatMap(
  (g) => g.blocks,
);

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
  // Probed per design: only options each design actually defines are listed.
  "classic-tee": { ease: ["chestEase", "waistEase", "hipsEase"], length: ["lengthBonus"], sleeve: ["sleeveLengthBonus"] },
  "relaxed-hoodie": { ease: ["chestEase", "waistEase", "hipsEase"], length: ["lengthBonus"], sleeve: ["sleeveLengthBonus"] },
  "slip-dress": { ease: ["waistEase", "hipsEase", "seatEase", "bustEase"], length: ["lengthBonus"] },
  "wide-trouser": { ease: ["waistEase", "seatEase"], length: ["lengthBonus"] },
  "pleated-skirt": { ease: ["waistEase", "seatEase"], length: ["lengthBonus"] },
  aaron: { ease: ["chestEase", "hipsEase"], length: ["lengthBonus"] },
  tamiko: { ease: ["chestEase"], length: ["lengthBonus"] },
  diana: { ease: ["chestEase", "waistEase", "hipsEase"], length: ["lengthBonus"], sleeve: ["sleeveLengthBonus"] },
  simon: { ease: ["chestEase", "waistEase", "hipsEase"], length: ["lengthBonus"], sleeve: ["sleeveLengthBonus"] },
  simone: { ease: ["chestEase", "waistEase", "hipsEase"], length: ["lengthBonus"], sleeve: ["sleeveLengthBonus"] },
  hugo: { ease: ["chestEase", "hipsEase"], length: ["lengthBonus"], sleeve: ["sleeveLengthBonus"] },
  huey: { ease: ["chestEase", "hipsEase"], length: ["lengthBonus"], sleeve: ["sleeveLengthBonus"] },
  yuri: { ease: ["chestEase", "hipsEase"], length: ["lengthBonus"], sleeve: ["sleeveLengthBonus"] },
  walburga: { length: ["lengthBonus"] },
  charlie: { ease: ["waistEase", "seatEase"], length: ["lengthBonus"] },
  paco: { ease: ["waistEase", "seatEase"], length: ["lengthBonus"] },
  sandy: { length: ["lengthBonus"] },
  carlita: { ease: ["chestEase", "waistEase", "seatEase"], length: ["lengthBonus"], sleeve: ["sleeveLengthBonus"] },
  carlton: { ease: ["chestEase", "waistEase", "seatEase"], length: ["lengthBonus"], sleeve: ["sleeveLengthBonus"] },
  bent: { ease: ["chestEase"], length: ["lengthBonus"], sleeve: ["sleeveLengthBonus"] },
  wahid: { ease: ["chestEase", "waistEase", "hipsEase"], length: ["lengthBonus"] },
  brian: { ease: ["chestEase"], length: ["lengthBonus"], sleeve: ["sleeveLengthBonus"] },
  bella: { ease: ["chestEase", "waistEase"] },
  breanna: { ease: ["chestEase", "waistEase"], sleeve: ["sleeveLengthBonus"] },
  noble: { ease: ["chestEase", "waistEase"] },
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
