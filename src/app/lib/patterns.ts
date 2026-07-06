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

export function patternLabel(garmentId: string): string | null {
  return DESIGN_MAP[garmentId]?.label ?? null;
}

/** Draft a real pattern and return its SVG (or null if unsupported / on error). */
export function draftPatternSvg(garmentId: string, size: SizeStep): { svg: string; label: string } | null {
  const entry = DESIGN_MAP[garmentId];
  if (!entry) return null;
  try {
    const scale = SIZE_SCALE[size];
    const measurements = Object.fromEntries(
      Object.entries(BASE_MEASUREMENTS).map(([k, v]) => [k, Math.round(v * scale)]),
    );
    const svg = new entry.design({ measurements, paperless: true }).use(pluginTheme).draft().render();
    return { svg, label: entry.label };
  } catch {
    return null;
  }
}
