/**
 * The base garment library for the 3D Fitting Room (Phase 1 of the native
 * simulation studio). Each entry is a parametric silhouette a founder can
 * preview in 3D, adjust for fit, and drape in a chosen fabric.
 *
 * This is deliberately a *stylized* parametric preview, not a physics drape or
 * a made-to-measure fit — the real GarmentCode + Warp pipeline lands in a later
 * phase. Keeping this file pure data (no three.js) lets both the client viewer
 * and the worker share it. Fabric ids reference src/shared/fabrics.ts.
 */

export type GarmentType = "tee" | "dress" | "hoodie" | "pants" | "skirt";

/** A parametric silhouette in abstract units (roughly cm at size M, ease 1.0). */
export interface GarmentSilhouette {
  /** Body/hem length from the shoulder (or waist, for bottoms). */
  length: number;
  /** Radius at the chest/waist — the "fitted" circumference. */
  chest: number;
  /** Radius at the hem — >chest flares (A-line), <chest tapers (pencil). */
  hem: number;
  /** Shoulder half-width. */
  shoulder: number;
  /** Sleeve length (0 = sleeveless). */
  sleeve: number;
  /** Leg length for bottoms (0 for tops). */
  inseam: number;
}

export interface BaseGarment {
  id: string;
  name: string;
  type: GarmentType;
  category: string;
  blurb: string;
  /** Suggested fabrics (ids into FABRIC_LIBRARY), best first. */
  fabrics: string[];
  defaultFabric: string;
  silhouette: GarmentSilhouette;
}

export const GARMENT_LIBRARY: BaseGarment[] = [
  {
    id: "classic-tee",
    name: "Classic tee",
    type: "tee",
    category: "Tops",
    blurb: "A set-in-sleeve crew — the wardrobe workhorse.",
    fabrics: ["cotton-jersey", "organic-cotton-jersey", "modal-jersey", "rib-knit"],
    defaultFabric: "cotton-jersey",
    silhouette: { length: 70, chest: 20, hem: 20, shoulder: 22, sleeve: 22, inseam: 0 },
  },
  {
    id: "relaxed-hoodie",
    name: "Relaxed hoodie",
    type: "hoodie",
    category: "Tops",
    blurb: "A dropped-shoulder pullover with a generous hood.",
    fabrics: ["brushed-fleece", "french-terry", "waffle-knit"],
    defaultFabric: "brushed-fleece",
    silhouette: { length: 72, chest: 25, hem: 24, shoulder: 27, sleeve: 30, inseam: 0 },
  },
  {
    id: "slip-dress",
    name: "Bias slip dress",
    type: "dress",
    category: "Dresses",
    blurb: "A fluid, bias-cut column that skims the body.",
    fabrics: ["silk-charmeuse", "viscose-crepe", "sateen", "modal-jersey"],
    defaultFabric: "silk-charmeuse",
    silhouette: { length: 120, chest: 19, hem: 26, shoulder: 8, sleeve: 0, inseam: 0 },
  },
  {
    id: "aline-dress",
    name: "A-line dress",
    type: "dress",
    category: "Dresses",
    blurb: "A fitted bodice flaring to a swingy hem.",
    fabrics: ["cotton-linen", "linen", "poplin", "viscose-crepe"],
    defaultFabric: "cotton-linen",
    silhouette: { length: 100, chest: 19, hem: 34, shoulder: 14, sleeve: 12, inseam: 0 },
  },
  {
    id: "wide-trouser",
    name: "Wide trouser",
    type: "pants",
    category: "Bottoms",
    blurb: "A high-waisted, column leg with a fluid fall.",
    fabrics: ["wool-suiting", "twill", "cotton-linen", "ponte"],
    defaultFabric: "wool-suiting",
    silhouette: { length: 24, chest: 20, hem: 20, shoulder: 0, sleeve: 0, inseam: 78 },
  },
  {
    id: "pleated-skirt",
    name: "Pleated midi skirt",
    type: "skirt",
    category: "Bottoms",
    blurb: "A waist-anchored midi with a full, flared sweep.",
    fabrics: ["poplin", "sateen", "cotton-linen", "twill"],
    defaultFabric: "poplin",
    silhouette: { length: 70, chest: 17, hem: 40, shoulder: 0, sleeve: 0, inseam: 0 },
  },
];

export function getGarment(id: string): BaseGarment | undefined {
  return GARMENT_LIBRARY.find((g) => g.id === id);
}

/** Standard size steps → a uniform scale factor applied to the whole garment. */
export const SIZE_STEPS = ["XS", "S", "M", "L", "XL", "XXL"] as const;
export type SizeStep = (typeof SIZE_STEPS)[number];
export const SIZE_SCALE: Record<SizeStep, number> = {
  XS: 0.88,
  S: 0.94,
  M: 1.0,
  L: 1.07,
  XL: 1.15,
  XXL: 1.23,
};

/** Ease presets → how much room beyond the body (a looseness multiplier on width). */
export const FIT_PRESETS = [
  { id: "slim", label: "Slim", ease: 0.82 },
  { id: "regular", label: "Regular", ease: 1.0 },
  { id: "relaxed", label: "Relaxed", ease: 1.18 },
  { id: "oversized", label: "Oversized", ease: 1.42 },
] as const;
export type FitPresetId = (typeof FIT_PRESETS)[number]["id"];

/** The adjustable fit a user dials in for a preview. */
export interface FitConfig {
  size: SizeStep;
  ease: number; // looseness multiplier (from a preset or free slider)
  length: number; // multiplier on garment length (0.8–1.2)
  sleeve: number; // multiplier on sleeve length (0–1.3)
}

export const DEFAULT_FIT: FitConfig = { size: "M", ease: 1.0, length: 1.0, sleeve: 1.0 };
