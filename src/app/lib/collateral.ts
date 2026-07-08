/**
 * Print collateral — self-contained, print-ready HTML documents composed from
 * the shop's brand identity (logo, palette, typography). Each template is sized
 * in physical inches with `@page` so "Print → Save as PDF" yields a correctly-
 * dimensioned, full-bleed file a print shop can use. Same pattern as the tech-
 * pack renderer: hand the browser real print HTML rather than fight a library.
 */
import type { BrandLogo, BrandPalette, BrandSettings } from "../../shared/types";
import { applyCase, brandFont, brandInitials, typePairing } from "../../shared/brand-identity";

export interface CollateralBrand {
  name: string;
  tagline: string;
  website: string;
  logo: BrandLogo | null;
  palette: BrandPalette;
  headingFamily: string;
  bodyFamily: string;
}

export function collateralBrand(s: BrandSettings, website: string): CollateralBrand {
  const pairing = typePairing(s.typography?.pairing);
  return {
    name: s.brandName,
    tagline: s.tagline || "",
    website,
    logo: s.logo ?? null,
    palette: s.palette ?? { primary: "#1f2a44", accent: "#c06e52", ink: "#23201b", bg: "#faf7f0" },
    headingFamily: pairing.headingFamily,
    bodyFamily: pairing.bodyFamily,
  };
}

/** Fields the templates draw from (each uses what it needs). */
export interface CollateralFields {
  personName: string;
  personTitle: string;
  email: string;
  phone: string;
  message: string;
  composition: string;
  care: string;
  madeIn: string;
}

export const EMPTY_FIELDS: CollateralFields = {
  personName: "",
  personTitle: "",
  email: "",
  phone: "",
  message: "",
  composition: "100% organic cotton",
  care: "Machine wash cold · Line dry · Warm iron · Do not bleach",
  madeIn: "",
};

export interface CollateralTemplate {
  id: string;
  label: string;
  /** Trim size in inches. */
  w: number;
  h: number;
  blurb: string;
  /** Fields this template surfaces in the editor. */
  fields: (keyof CollateralFields)[];
  render: (brand: CollateralBrand, f: CollateralFields) => string;
}

const esc = (s: string) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

/** Logo as HTML for print — image if uploaded, else the styled wordmark. */
function logoHtml(brand: CollateralBrand, onDark: boolean, px: number): string {
  const logo = brand.logo;
  const img = logo?.kind === "image" ? (onDark ? logo.darkImageUrl || logo.imageUrl : logo.imageUrl) : null;
  if (img) return `<img src="${esc(img)}" alt="${esc(brand.name)}" style="height:${px}px;width:auto;object-fit:contain;" />`;
  const wm = logo?.wordmark;
  const color = onDark ? "#ffffff" : brand.palette.primary;
  if (wm) {
    const font = brandFont(wm.font);
    return `<span style="font-family:${font.stack};font-weight:${wm.weight};letter-spacing:${wm.tracking}em;font-size:${px * 0.7}px;color:${color};text-transform:${wm.case === "upper" ? "uppercase" : wm.case === "lower" ? "lowercase" : "none"};">${esc(applyCase(wm.text || brand.name, wm.case))}</span>`;
  }
  return `<span style="font-family:${brand.headingFamily};font-weight:400;font-size:${px * 0.7}px;color:${color};">${esc(brand.name)}</span>`;
}

function monogram(brand: CollateralBrand, onDark: boolean, px: number): string {
  const color = onDark ? "#ffffff" : brand.palette.primary;
  return `<span style="font-family:${brand.headingFamily};font-size:${px}px;font-weight:500;color:${color};border:${Math.max(1, px * 0.04)}px solid ${color};border-radius:${px * 0.14}px;padding:${px * 0.14}px ${px * 0.22}px;display:inline-block;line-height:1;">${esc(brandInitials(brand.name))}</span>`;
}

// ── Templates ────────────────────────────────────────────────────────────────
export const TEMPLATES: readonly CollateralTemplate[] = [
  {
    id: "business-card",
    label: "Business card",
    w: 3.5,
    h: 2,
    blurb: "3.5 × 2 in · double-sided feel",
    fields: ["personName", "personTitle", "email", "phone"],
    render: (b, f) => `
      <div style="width:100%;height:100%;display:flex;background:${b.palette.bg};">
        <div style="flex:0 0 42%;background:${b.palette.primary};display:flex;align-items:center;justify-content:center;">
          ${monogram(b, true, 34)}
        </div>
        <div style="flex:1;padding:0.28in 0.3in;display:flex;flex-direction:column;justify-content:center;color:${b.palette.ink};font-family:${b.bodyFamily};">
          <div style="margin-bottom:0.12in;">${logoHtml(b, false, 22)}</div>
          ${f.personName ? `<div style="font-weight:600;font-size:11pt;">${esc(f.personName)}</div>` : ""}
          ${f.personTitle ? `<div style="font-size:8pt;color:${b.palette.accent};text-transform:uppercase;letter-spacing:0.12em;margin-bottom:0.08in;">${esc(f.personTitle)}</div>` : ""}
          <div style="font-size:8pt;line-height:1.5;opacity:0.8;">
            ${f.email ? `<div>${esc(f.email)}</div>` : ""}
            ${f.phone ? `<div>${esc(f.phone)}</div>` : ""}
            <div>${esc(b.website)}</div>
          </div>
        </div>
      </div>`,
  },
  {
    id: "hang-tag",
    label: "Hang tag",
    w: 2,
    h: 3.5,
    blurb: "2 × 3.5 in · with punch hole",
    fields: ["message"],
    render: (b, f) => `
      <div style="width:100%;height:100%;background:${b.palette.bg};color:${b.palette.ink};font-family:${b.bodyFamily};display:flex;flex-direction:column;align-items:center;text-align:center;padding:0.5in 0.24in 0.3in;position:relative;">
        <div style="position:absolute;top:0.16in;left:50%;transform:translateX(-50%);width:0.16in;height:0.16in;border:1.5px solid ${b.palette.ink};border-radius:50%;opacity:0.5;"></div>
        <div style="margin-top:0.2in;margin-bottom:auto;width:100%;">${logoHtml(b, false, 20)}</div>
        <div style="width:0.5in;height:2px;background:${b.palette.accent};margin:0.18in 0;flex:none;"></div>
        <div style="width:100%;font-family:${b.headingFamily};font-size:10.5pt;line-height:1.35;">${esc(f.message || b.tagline || "Made with care.")}</div>
        <div style="margin-top:auto;width:100%;font-size:7pt;letter-spacing:0.12em;text-transform:uppercase;opacity:0.6;">${esc(b.website)}</div>
      </div>`,
  },
  {
    id: "care-label",
    label: "Care & composition label",
    w: 2.5,
    h: 2,
    blurb: "2.5 × 2 in · sew-in or printed",
    fields: ["composition", "care", "madeIn"],
    render: (b, f) => `
      <div style="width:100%;height:100%;background:#ffffff;color:#111;font-family:'Helvetica Neue',Arial,sans-serif;padding:0.18in 0.2in;display:flex;flex-direction:column;">
        <div style="margin-bottom:0.1in;">${logoHtml(b, false, 16)}</div>
        <div style="font-size:7pt;line-height:1.5;letter-spacing:0.02em;">
          <div style="font-weight:700;text-transform:uppercase;letter-spacing:0.1em;">${esc(f.composition)}</div>
          <div style="margin-top:0.06in;">${esc(f.care)}</div>
          ${f.madeIn ? `<div style="margin-top:0.06in;text-transform:uppercase;letter-spacing:0.08em;">Made in ${esc(f.madeIn)}</div>` : ""}
          <div style="margin-top:0.06in;opacity:0.6;">${esc(b.website)}</div>
        </div>
      </div>`,
  },
  {
    id: "thank-you",
    label: "Thank-you insert",
    w: 5,
    h: 3.5,
    blurb: "5 × 3.5 in · packing insert",
    fields: ["message", "personName"],
    render: (b, f) => `
      <div style="width:100%;height:100%;background:${b.palette.bg};color:${b.palette.ink};font-family:${b.bodyFamily};padding:0.45in 0.5in;display:flex;flex-direction:column;">
        <div style="margin-bottom:0.22in;">${logoHtml(b, false, 26)}</div>
        <div style="font-family:${b.headingFamily};font-size:15pt;margin-bottom:0.12in;">Thank you.</div>
        <div style="font-size:9.5pt;line-height:1.6;max-width:3.6in;opacity:0.85;">${esc(f.message || "Your order was packed by hand. We hope it becomes a favourite — wear it well, and tell us how it fits.")}</div>
        <div style="margin-top:auto;display:flex;justify-content:space-between;align-items:flex-end;">
          <div style="font-family:${b.headingFamily};font-size:11pt;">${esc(f.personName || b.name)}</div>
          <div style="font-size:8pt;letter-spacing:0.14em;text-transform:uppercase;color:${b.palette.accent};">${esc(b.website)}</div>
        </div>
      </div>`,
  },
  {
    id: "sticker",
    label: "Sticker / seal",
    w: 2,
    h: 2,
    blurb: "2 in · round packaging seal",
    fields: [],
    render: (b) => `
      <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:${b.palette.bg};">
        <div style="width:1.8in;height:1.8in;border-radius:50%;background:${b.palette.primary};color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;">
          ${monogram(b, true, 30)}
          <div style="font-family:${b.headingFamily};font-size:8pt;letter-spacing:0.16em;text-transform:uppercase;margin-top:0.1in;color:#fff;opacity:0.85;">${esc(b.name)}</div>
        </div>
      </div>`,
  },
  {
    id: "letterhead",
    label: "Letterhead",
    w: 8.5,
    h: 11,
    blurb: "US Letter · correspondence",
    fields: ["message"],
    render: (b, f) => `
      <div style="width:100%;height:100%;background:#fff;color:${b.palette.ink};font-family:${b.bodyFamily};display:flex;flex-direction:column;">
        <div style="padding:0.7in 0.9in 0.3in;border-bottom:3px solid ${b.palette.accent};display:flex;justify-content:space-between;align-items:center;">
          ${logoHtml(b, false, 30)}
          <div style="font-size:8pt;text-align:right;letter-spacing:0.1em;text-transform:uppercase;opacity:0.7;">${esc(b.website)}</div>
        </div>
        <div style="padding:0.5in 0.9in;font-size:10.5pt;line-height:1.7;flex:1;white-space:pre-wrap;opacity:0.9;">${esc(f.message || "Date\n\nDear …,\n\n")}</div>
        <div style="padding:0.3in 0.9in 0.6in;font-size:8pt;letter-spacing:0.08em;text-transform:uppercase;color:${b.palette.accent};">${esc(b.name)}${b.tagline ? ` — ${esc(b.tagline)}` : ""}</div>
      </div>`,
  },
];

export function template(id: string): CollateralTemplate {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}

/** A complete print-ready HTML document at physical size for a print window. */
export function buildPrintDoc(t: CollateralTemplate, brand: CollateralBrand, f: CollateralFields): string {
  const pairing = typePairing(undefined); // ensure default families exist
  void pairing;
  // Load Fraunces + Inter (bundled in-app but absent in a blank window) plus the
  // pairing fonts, so wordmarks and body text render in the print window.
  const fontUrls = [
    "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500&family=Inter:wght@400;500;600&display=swap",
  ];
  const links = fontUrls.map((u) => `<link rel="stylesheet" href="${u}">`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(brand.name)} — ${esc(t.label)}</title>${links}
<style>
  @page { size: ${t.w}in ${t.h}in; margin: 0; }
  * { box-sizing: border-box; }
  html,body { margin:0; padding:0; }
  #art { width:${t.w}in; height:${t.h}in; overflow:hidden; }
  #art * { max-width:100%; overflow-wrap:break-word; }
  @media screen { body { background:#eee; display:flex; align-items:center; justify-content:center; min-height:100vh; } #art { box-shadow:0 10px 40px rgba(0,0,0,0.25); } }
</style></head>
<body><div id="art">${t.render(brand, f)}</div>
<script>window.addEventListener('load',function(){setTimeout(function(){window.focus();window.print();},400);});</script>
</body></html>`;
}
