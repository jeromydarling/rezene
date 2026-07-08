/**
 * Brand kit + guidelines generation — all client-side. Turns the stored brand
 * identity into shareable, downloadable artifacts: a print-ready guidelines
 * document, a wordmark SVG, a favicon SVG, a palette file, and correctly-sized
 * social images (rendered on a canvas). No server round-trip, no dependencies.
 */
import type { BrandPalette } from "../../shared/types";
import type { CollateralBrand } from "./collateral";
import { applyCase, brandFont, brandInitials, faviconDataUri, preferLightText } from "../../shared/brand-identity";

const esc = (s: string) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

export function hexToRgb(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "—";
  const n = parseInt(m[1], 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

/** Trigger a browser download of a string or blob. */
export function download(filename: string, data: string | Blob, mime = "text/plain") {
  const blob = typeof data === "string" ? new Blob([data], { type: mime }) : data;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** A downloadable SVG of the wordmark (vector logo asset). */
export function wordmarkSvg(brand: CollateralBrand): string {
  const wm = brand.logo?.wordmark;
  const text = applyCase(wm?.text || brand.name, wm?.case ?? "as-is");
  const font = brandFont(wm?.font);
  const size = 64;
  const w = Math.max(200, text.length * size * 0.62 + 80);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(w)}" height="140" viewBox="0 0 ${Math.round(w)} 140">
  <rect width="100%" height="100%" fill="none"/>
  <text x="${Math.round(w / 2)}" y="70" font-family="${esc(font.stack)}" font-size="${size}" font-weight="${wm?.weight ?? 400}" letter-spacing="${(wm?.tracking ?? 0.02) * size}" fill="${brand.palette.primary}" text-anchor="middle" dominant-baseline="central">${esc(text)}</text>
</svg>`;
}

export function faviconSvg(name: string, palette: BrandPalette): string {
  const uri = faviconDataUri(name, palette);
  return decodeURIComponent(uri.slice("data:image/svg+xml,".length));
}

export function paletteText(name: string, palette: BrandPalette): string {
  const line = (k: string, v: string) => `${k.padEnd(10)} ${v.toUpperCase()}   rgb(${hexToRgb(v)})`;
  return [
    `${name} — colour palette`,
    "",
    line("Primary", palette.primary),
    line("Accent", palette.accent),
    line("Ink", palette.ink),
    line("Background", palette.bg),
    "",
  ].join("\n");
}

/** A social image (PNG data URL) rendered on a canvas at the platform's size. */
export async function socialImage(
  kind: "avatar" | "og" | "banner",
  brand: CollateralBrand,
): Promise<string> {
  const dims = kind === "avatar" ? [1000, 1000] : kind === "og" ? [1200, 630] : [1500, 500];
  const [w, h] = dims;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const p = brand.palette;
  ctx.fillStyle = p.primary;
  ctx.fillRect(0, 0, w, h);
  const fg = preferLightText(p.primary) ? "#ffffff" : "#111111";

  // Try to draw an uploaded logo centered; else fall back to name/monogram text.
  const img = brand.logo?.kind === "image" ? brand.logo.darkImageUrl || brand.logo.imageUrl : null;
  const drawText = () => {
    ctx.fillStyle = fg;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (kind === "avatar") {
      ctx.font = `600 ${w * 0.34}px Georgia, serif`;
      ctx.fillText(brandInitials(brand.name), w / 2, h / 2);
    } else {
      ctx.font = `500 ${h * 0.16}px Georgia, serif`;
      ctx.fillText(brand.name, w / 2, h / 2 - (brand.tagline ? h * 0.06 : 0));
      if (brand.tagline) {
        ctx.fillStyle = p.accent;
        ctx.font = `${h * 0.055}px Helvetica, Arial, sans-serif`;
        ctx.fillText(brand.tagline, w / 2, h / 2 + h * 0.14);
      }
    }
  };

  if (img) {
    try {
      const el = await loadImage(img);
      const scale = Math.min((w * 0.5) / el.width, (h * 0.5) / el.height);
      const dw = el.width * scale;
      const dh = el.height * scale;
      ctx.drawImage(el, (w - dw) / 2, (h - dh) / 2, dw, dh);
    } catch {
      drawText();
    }
  } else {
    drawText();
  }
  return canvas.toDataURL("image/png");
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = "anonymous";
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = src;
  });
}

/** A complete, print-ready brand guidelines document (opens in a print window). */
export function buildGuidelinesDoc(brand: CollateralBrand, voice: string): string {
  const p = brand.palette;
  const logoLight =
    brand.logo?.kind === "image" && brand.logo.imageUrl
      ? `<img src="${esc(brand.logo.imageUrl)}" style="height:52px;width:auto;object-fit:contain;">`
      : `<span style="font-family:${brand.headingFamily};font-size:34px;color:${p.primary};">${esc(brand.name)}</span>`;
  const logoDark =
    brand.logo?.kind === "image" && (brand.logo.darkImageUrl || brand.logo.imageUrl)
      ? `<img src="${esc(brand.logo.darkImageUrl || brand.logo.imageUrl!)}" style="height:52px;width:auto;object-fit:contain;">`
      : `<span style="font-family:${brand.headingFamily};font-size:34px;color:#fff;">${esc(brand.name)}</span>`;

  const swatch = (label: string, hex: string) => `
    <div style="flex:1;min-width:120px;">
      <div style="height:80px;border-radius:8px;background:${hex};border:1px solid rgba(0,0,0,0.08);"></div>
      <div style="margin-top:8px;font-size:11px;">
        <div style="font-weight:600;">${esc(label)}</div>
        <div style="color:#6f695c;">${hex.toUpperCase()}</div>
        <div style="color:#6f695c;">rgb(${hexToRgb(hex)})</div>
      </div>
    </div>`;

  const section = (title: string, inner: string) => `
    <section style="margin:0 0 34px;">
      <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${p.accent};margin-bottom:12px;border-bottom:1px solid rgba(0,0,0,0.1);padding-bottom:6px;">${esc(title)}</div>
      ${inner}
    </section>`;

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(brand.name)} — Brand Guidelines</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500&family=Inter:wght@400;500;600&display=swap">
<style>
  @page { size: Letter; margin: 0.7in; }
  body { margin:0; font-family:${brand.bodyFamily}; color:${p.ink}; }
  h1 { font-family:${brand.headingFamily}; font-weight:400; }
  @media screen { body { background:#eee; } .sheet { background:#fff; max-width:8.5in; margin:20px auto; padding:0.7in; box-shadow:0 10px 40px rgba(0,0,0,0.2); } }
</style></head>
<body><div class="sheet">
  <div style="border-bottom:3px solid ${p.accent};padding-bottom:20px;margin-bottom:28px;">
    <div style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:${p.accent};">Brand Guidelines</div>
    <h1 style="font-size:40px;margin:8px 0 4px;color:${p.primary};">${esc(brand.name)}</h1>
    ${brand.tagline ? `<div style="color:#6f695c;font-size:14px;">${esc(brand.tagline)}</div>` : ""}
  </div>

  ${section(
    "Logo",
    `<div style="display:flex;gap:16px;">
      <div style="flex:1;background:${p.bg};border:1px solid rgba(0,0,0,0.08);border-radius:8px;height:120px;display:flex;align-items:center;justify-content:center;">${logoLight}</div>
      <div style="flex:1;background:${p.primary};border-radius:8px;height:120px;display:flex;align-items:center;justify-content:center;">${logoDark}</div>
    </div>
    <p style="font-size:11px;color:#6f695c;margin-top:10px;">Give the logo clear space on all sides (at least the height of the mark). Don't stretch, recolour, or add effects. Use the light-background version on pale surfaces and the reversed version on ${esc(brand.name)} primary.</p>`,
  )}

  ${section("Colour", `<div style="display:flex;gap:14px;">${swatch("Primary", p.primary)}${swatch("Accent", p.accent)}${swatch("Text", p.ink)}${swatch("Background", p.bg)}</div>`)}

  ${section(
    "Typography",
    `<div style="font-family:${brand.headingFamily};font-size:30px;color:${p.primary};">Aa Bb Cc — Headings</div>
     <div style="font-family:${brand.bodyFamily};font-size:14px;line-height:1.6;color:${p.ink};margin-top:8px;max-width:5in;">Body copy is set in the paired sans. The quick brown fox jumps over the lazy dog. 0123456789. Use it for product descriptions, editorial, and everything a customer reads.</div>`,
  )}

  ${voice ? section("Voice", `<p style="font-size:13px;line-height:1.7;max-width:5.4in;">${esc(voice)}</p>`) : ""}

  <div style="margin-top:24px;font-size:10px;color:#6f695c;letter-spacing:0.1em;text-transform:uppercase;">${esc(brand.website)}</div>
</div>
<script>window.addEventListener('load',function(){setTimeout(function(){window.focus();},300);});</script>
</body></html>`;
}
