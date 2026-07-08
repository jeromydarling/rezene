/**
 * Brand identity primitives shared by the Brand Studio (authoring), the
 * storefront/admin (rendering), and the worker (favicon + defaults). Keeping
 * the font list, palette presets, and the SVG/favicon helpers here means the
 * preview a designer sees, the logo the storefront renders, and the favicon the
 * edge serves are all generated from one source.
 */
import type { BrandLogo, BrandPalette, BrandWordmark } from "./types";

// ── Typefaces ────────────────────────────────────────────────────────────────
// Deliberately restrained to faces that render identically in every browser
// with no web-font fetch: two are bundled by the app (Fraunces, Inter), the
// rest are ubiquitous system families. A wordmark must look the same in the
// studio preview, on the storefront, and in the SVG favicon.
export interface BrandFont {
  key: string;
  label: string;
  /** Full CSS font stack. */
  stack: string;
  mood: string;
}

export const BRAND_FONTS: readonly BrandFont[] = [
  { key: "fraunces", label: "Fraunces", stack: '"Fraunces", "Georgia", serif', mood: "Editorial serif — warm, high-fashion" },
  { key: "georgia", label: "Georgia", stack: 'Georgia, "Times New Roman", serif', mood: "Classic serif — trustworthy, literary" },
  { key: "times", label: "Times", stack: '"Times New Roman", Times, serif', mood: "Traditional — heritage, tailoring" },
  { key: "inter", label: "Inter", stack: '"Inter", "Helvetica Neue", sans-serif', mood: "Modern sans — clean, contemporary" },
  { key: "helvetica", label: "Helvetica", stack: '"Helvetica Neue", Helvetica, Arial, sans-serif', mood: "Grotesque — minimal, confident" },
  { key: "courier", label: "Courier", stack: '"Courier New", ui-monospace, monospace', mood: "Typewriter — utilitarian, technical" },
] as const;

export function brandFont(key: string | undefined): BrandFont {
  return BRAND_FONTS.find((f) => f.key === key) ?? BRAND_FONTS[0];
}

// ── Type pairings ────────────────────────────────────────────────────────────
// Curated heading/body pairs that re-theme the storefront's --font-display and
// --font-sans. The first ("Editorial") is the app's bundled Fraunces + Inter, so
// it needs no web-font fetch; the rest load from Google Fonts on demand. Each
// carries the css2 query so the client can inject exactly the weights used.
export interface TypePairing {
  key: string;
  label: string;
  headingFamily: string;
  bodyFamily: string;
  /** Google Fonts css2 URL, or null for the bundled default. */
  googleUrl: string | null;
  mood: string;
}

const g = (families: string) => `https://fonts.googleapis.com/css2?${families}&display=swap`;

export const TYPE_PAIRINGS: readonly TypePairing[] = [
  {
    key: "editorial",
    label: "Editorial",
    headingFamily: '"Fraunces", Georgia, serif',
    bodyFamily: '"Inter", system-ui, sans-serif',
    googleUrl: null,
    mood: "Warm high-fashion serif + clean sans — the house default",
  },
  {
    key: "grand",
    label: "Grand",
    headingFamily: '"Playfair Display", Georgia, serif',
    bodyFamily: '"Inter", system-ui, sans-serif',
    googleUrl: g("family=Playfair+Display:wght@500;700&family=Inter:wght@400;500;600"),
    mood: "Dramatic high-contrast serif — luxe, editorial",
  },
  {
    key: "refined",
    label: "Refined",
    headingFamily: '"Cormorant Garamond", Georgia, serif',
    bodyFamily: '"Jost", system-ui, sans-serif',
    googleUrl: g("family=Cormorant+Garamond:wght@500;600&family=Jost:wght@400;500"),
    mood: "Delicate old-style serif + geometric sans — quiet luxury",
  },
  {
    key: "modern",
    label: "Modern",
    headingFamily: '"Space Grotesk", "Helvetica Neue", sans-serif',
    bodyFamily: '"Inter", system-ui, sans-serif',
    googleUrl: g("family=Space+Grotesk:wght@500;600&family=Inter:wght@400;500;600"),
    mood: "Contemporary grotesk — minimal, design-forward",
  },
  {
    key: "bold",
    label: "Bold",
    headingFamily: '"Archivo", "Helvetica Neue", sans-serif',
    bodyFamily: '"Archivo", "Helvetica Neue", sans-serif',
    googleUrl: g("family=Archivo:wght@500;700;800"),
    mood: "Heavy single-family grotesk — confident, streetwear",
  },
  {
    key: "warm",
    label: "Warm",
    headingFamily: '"DM Serif Display", Georgia, serif',
    bodyFamily: '"DM Sans", system-ui, sans-serif',
    googleUrl: g("family=DM+Serif+Display&family=DM+Sans:wght@400;500;600"),
    mood: "Friendly serif display + soft sans — approachable, crafted",
  },
  {
    key: "classic",
    label: "Classic",
    headingFamily: '"Libre Baskerville", Georgia, serif',
    bodyFamily: '"Source Sans 3", system-ui, sans-serif',
    googleUrl: g("family=Libre+Baskerville:wght@400;700&family=Source+Sans+3:wght@400;500;600"),
    mood: "Traditional book serif — heritage, trustworthy",
  },
  {
    key: "avant",
    label: "Avant",
    headingFamily: '"Syne", "Helvetica Neue", sans-serif',
    bodyFamily: '"Inter", system-ui, sans-serif',
    googleUrl: g("family=Syne:wght@600;700;800&family=Inter:wght@400;500"),
    mood: "Wide experimental display — art-house, statement",
  },
];

export function typePairing(key: string | undefined): TypePairing {
  return TYPE_PAIRINGS.find((p) => p.key === key) ?? TYPE_PAIRINGS[0];
}

export const DEFAULT_TYPOGRAPHY = { pairing: "editorial" };

// ── Palettes ─────────────────────────────────────────────────────────────────
export interface PalettePreset extends BrandPalette {
  key: string;
  label: string;
}

// The app's own tokens are the first ("Atelier") preset, so an untouched shop
// looks exactly as it does today.
export const PALETTE_PRESETS: readonly PalettePreset[] = [
  { key: "atelier", label: "Atelier (default)", primary: "#1f2a44", accent: "#c06e52", ink: "#23201b", bg: "#faf7f0" },
  { key: "noir", label: "Noir", primary: "#111111", accent: "#b0895f", ink: "#1a1a1a", bg: "#f6f4f0" },
  { key: "atelier-green", label: "Botanic", primary: "#2f3a2c", accent: "#7a8b5a", ink: "#22261f", bg: "#f4f2e9" },
  { key: "riviera", label: "Riviera", primary: "#20415c", accent: "#d98c4a", ink: "#1b2a33", bg: "#f7f3ea" },
  { key: "rose", label: "Blush", primary: "#3a2730", accent: "#c98a8a", ink: "#2a1f24", bg: "#faf4f1" },
  { key: "mono", label: "Monochrome", primary: "#232323", accent: "#6a6a6a", ink: "#1c1c1c", bg: "#f5f5f3" },
];

export const DEFAULT_PALETTE: BrandPalette = PALETTE_PRESETS[0];

export const DEFAULT_WORDMARK = (brandName: string): BrandWordmark => ({
  text: brandName,
  font: "fraunces",
  case: "as-is",
  tracking: 0.02,
  weight: 400,
  monogram: false,
  divider: false,
});

// ── Helpers ──────────────────────────────────────────────────────────────────
/** Uppercase initials (up to 2) from a brand name, for monograms / favicons. */
export function brandInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export function applyCase(text: string, c: BrandWordmark["case"]): string {
  return c === "upper" ? text.toUpperCase() : c === "lower" ? text.toLowerCase() : text;
}

/** True if white text reads better than black on this hex background. */
export function preferLightText(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255,
    g = (n >> 8) & 255,
    b = n & 255;
  // Relative luminance (sRGB, simple gamma) — < 0.5 → dark bg → light text.
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum < 0.5;
}

/**
 * A self-contained SVG favicon: the brand's initials (or emblem letter) on a
 * rounded square in the accent colour. Returned as a `data:` URI so it works
 * as a `<link rel="icon">` with no upload or rasterisation. Modern browsers
 * render SVG favicons; older ones fall back to the site's default.
 */
export function faviconDataUri(name: string, palette: BrandPalette): string {
  const initials = brandInitials(name);
  const fg = preferLightText(palette.primary) ? "#ffffff" : "#111111";
  const fontSize = initials.length > 1 ? 30 : 40;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">` +
    `<rect width="64" height="64" rx="14" fill="${palette.primary}"/>` +
    `<text x="32" y="33" font-family="Georgia, serif" font-size="${fontSize}" font-weight="500" ` +
    `fill="${fg}" text-anchor="middle" dominant-baseline="central">${escapeXml(initials)}</text>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (ch) =>
    ch === "<" ? "&lt;" : ch === ">" ? "&gt;" : ch === "&" ? "&amp;" : ch === "'" ? "&apos;" : "&quot;",
  );
}

/** Pick the best logo image URL for a surface given its background darkness. */
export function logoImageFor(logo: BrandLogo | null | undefined, onDark: boolean): string | null {
  if (!logo || logo.kind !== "image") return null;
  if (onDark) return logo.darkImageUrl || logo.imageUrl || null;
  return logo.imageUrl || logo.darkImageUrl || null;
}
