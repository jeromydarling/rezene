/**
 * Lookbook print composer — turns a resolved lookbook into a self-contained,
 * print-ready multi-page HTML document at magazine trim (8.5×11in) with
 * `@page`, so "Print → Save as PDF" yields a correctly-dimensioned file. Same
 * pattern as the collateral studio, scaled up to a paginated magazine: a cover,
 * an editorial opener, one spread per piece (three layouts), and a back cover.
 *
 * This composition is the durable artifact — a later phase hands the same HTML
 * to a headless-Chromium render for a print-on-demand fulfiller (Lulu et al.).
 */
import { brandFont, applyCase } from "../../shared/brand-identity";
import type { CollateralBrand } from "./collateral";
import type { LookbookLayout, LookbookProduct, LookbookRenderModel } from "../../shared/lookbook";

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

function money(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(
      cents / 100,
    );
  } catch {
    return `$${Math.round(cents / 100)}`;
  }
}

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
  return `<span style="font-family:${brand.headingFamily};font-weight:500;font-size:${px * 0.7}px;color:${color};">${esc(brand.name)}</span>`;
}

/** A named-piece caption block (name, price, and optionally fabric/origin). */
function pieceCaption(p: LookbookProduct, brand: CollateralBrand, opts: { detail: boolean; onDark?: boolean }): string {
  const color = opts.onDark ? "#fff" : brand.palette.ink;
  const sub = opts.onDark ? "rgba(255,255,255,0.82)" : brand.palette.ink + "aa";
  const bits: string[] = [];
  if (p.subtitle) bits.push(esc(p.subtitle));
  if (opts.detail && p.fabric) bits.push(esc(p.fabric));
  if (opts.detail && p.origin) bits.push(esc(p.origin));
  return `
    <div style="font-family:${brand.bodyFamily};color:${color};">
      <div style="font-family:${brand.headingFamily};font-size:0.26in;line-height:1.1;">${esc(p.name)}</div>
      ${bits.length ? `<div style="font-size:0.12in;color:${sub};margin-top:0.05in;">${bits.join(" · ")}</div>` : ""}
      <div style="font-size:0.15in;margin-top:0.08in;letter-spacing:0.02em;">${money(p.priceCents, p.currency)}</div>
    </div>`;
}

function imageBox(p: LookbookProduct, brand: CollateralBrand, style: string): string {
  if (p.imageUrl) {
    return `<img src="${esc(p.imageUrl)}" alt="${esc(p.imageAlt || p.name)}" style="${style};object-fit:cover;" />`;
  }
  // Graceful placeholder in brand tint when a piece has no photo.
  return `<div style="${style};background:${brand.palette.primary}14;display:flex;align-items:center;justify-content:center;font-family:${brand.headingFamily};color:${brand.palette.primary}88;font-size:0.2in;">${esc(p.name)}</div>`;
}

function spreadPage(
  p: LookbookProduct,
  layout: LookbookLayout,
  caption: string,
  brand: CollateralBrand,
): string {
  const cap = caption ? esc(caption) : "";
  if (layout === "hero") {
    return `<section class="page" style="background:#000;">
      ${imageBox(p, brand, "position:absolute;inset:0;width:100%;height:100%")}
      <div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,0.55),rgba(0,0,0,0) 45%);"></div>
      <div style="position:absolute;left:0.6in;right:0.6in;bottom:0.6in;">${pieceCaption(p, brand, { detail: false, onDark: true })}
        ${cap ? `<div style="font-family:${brand.bodyFamily};color:rgba(255,255,255,0.9);font-size:0.13in;margin-top:0.1in;max-width:5in;">${cap}</div>` : ""}
      </div>
    </section>`;
  }
  if (layout === "editorial") {
    const story = p.editorialStory ? esc(p.editorialStory) : cap;
    return `<section class="page" style="background:${brand.palette.bg};display:flex;">
      <div style="width:55%;height:100%;">${imageBox(p, brand, "width:100%;height:100%")}</div>
      <div style="width:45%;height:100%;padding:0.7in 0.6in;display:flex;flex-direction:column;justify-content:center;">
        ${pieceCaption(p, brand, { detail: true })}
        ${story ? `<div style="font-family:${brand.bodyFamily};color:${brand.palette.ink}cc;font-size:0.135in;line-height:1.6;margin-top:0.22in;">${story}</div>` : ""}
      </div>
    </section>`;
  }
  // clean
  return `<section class="page" style="background:${brand.palette.bg};padding:0.7in;display:flex;flex-direction:column;">
    <div style="flex:1;min-height:0;">${imageBox(p, brand, "width:100%;height:100%")}</div>
    <div style="margin-top:0.4in;display:flex;align-items:flex-end;justify-content:space-between;gap:0.4in;">
      ${pieceCaption(p, brand, { detail: true })}
      ${cap ? `<div style="font-family:${brand.bodyFamily};color:${brand.palette.ink}aa;font-size:0.12in;max-width:2.6in;text-align:right;">${cap}</div>` : ""}
    </div>
  </section>`;
}

function coverPage(model: LookbookRenderModel, brand: CollateralBrand): string {
  const lb = model.lookbook;
  const hero = model.spreads[0]?.product;
  const bg = hero?.imageUrl
    ? `${imageBox(hero, brand, "position:absolute;inset:0;width:100%;height:100%")}<div style="position:absolute;inset:0;background:linear-gradient(to bottom,rgba(0,0,0,0.28),rgba(0,0,0,0.5));"></div>`
    : `<div style="position:absolute;inset:0;background:${brand.palette.primary};"></div>`;
  return `<section class="page" style="background:#000;">
    ${bg}
    <div style="position:absolute;top:0.6in;left:0.6in;">${logoHtml(brand, true, 26)}</div>
    <div style="position:absolute;left:0.6in;right:0.6in;bottom:0.9in;color:#fff;">
      <div style="font-family:${brand.headingFamily};font-size:0.72in;line-height:1.02;">${esc(lb.title)}</div>
      ${lb.subtitle ? `<div style="font-family:${brand.bodyFamily};font-size:0.2in;letter-spacing:0.04em;margin-top:0.14in;color:rgba(255,255,255,0.9);">${esc(lb.subtitle)}</div>` : ""}
    </div>
  </section>`;
}

function introPage(model: LookbookRenderModel, brand: CollateralBrand): string {
  const lb = model.lookbook;
  const contents = model.spreads
    .map(
      (s, i) =>
        `<div style="display:flex;justify-content:space-between;font-family:${brand.bodyFamily};font-size:0.14in;color:${brand.palette.ink}cc;padding:0.06in 0;border-bottom:1px solid ${brand.palette.ink}18;">
          <span>${esc(s.product.name)}</span><span>${String(i + 1).padStart(2, "0")}</span>
        </div>`,
    )
    .join("");
  return `<section class="page" style="background:${brand.palette.bg};padding:1in 0.8in;display:flex;flex-direction:column;">
    <div style="font-family:${brand.headingFamily};font-size:0.34in;color:${brand.palette.primary};">${esc(lb.title)}</div>
    ${lb.intro ? `<div style="font-family:${brand.bodyFamily};font-size:0.15in;line-height:1.7;color:${brand.palette.ink}cc;margin-top:0.3in;max-width:5in;white-space:pre-wrap;">${esc(lb.intro)}</div>` : ""}
    <div style="margin-top:auto;">
      <div style="font-family:${brand.bodyFamily};font-size:0.1in;letter-spacing:0.14em;text-transform:uppercase;color:${brand.palette.ink}88;margin-bottom:0.12in;">In this issue</div>
      ${contents}
    </div>
  </section>`;
}

function backPage(brand: CollateralBrand): string {
  return `<section class="page" style="background:${brand.palette.primary};display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:#fff;">
    <div style="margin-bottom:0.3in;">${logoHtml(brand, true, 34)}</div>
    ${brand.tagline ? `<div style="font-family:${brand.bodyFamily};font-size:0.16in;letter-spacing:0.03em;color:rgba(255,255,255,0.88);max-width:4.5in;">${esc(brand.tagline)}</div>` : ""}
    ${brand.website ? `<div style="font-family:${brand.bodyFamily};font-size:0.13in;letter-spacing:0.08em;margin-top:0.4in;color:rgba(255,255,255,0.7);">${esc(brand.website)}</div>` : ""}
  </section>`;
}

/** Build the whole print-ready magazine document. `print` auto-opens the print dialog. */
export function buildLookbookDoc(
  model: LookbookRenderModel,
  brand: CollateralBrand,
  opts: { print?: boolean } = {},
): string {
  const fontLink =
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600&display=swap">';
  const pages = [
    coverPage(model, brand),
    introPage(model, brand),
    ...model.spreads.map((s) => spreadPage(s.product, s.layout, s.caption, brand)),
    backPage(brand),
  ].join("\n");
  const printScript = opts.print
    ? `<script>window.addEventListener('load',function(){setTimeout(function(){window.focus();window.print();},600);});</script>`
    : "";
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(brand.name)} — ${esc(model.lookbook.title)}</title>${fontLink}
<style>
  @page { size: 8.5in 11in; margin: 0; }
  * { box-sizing: border-box; }
  html,body { margin:0; padding:0; }
  .page { position:relative; width:8.5in; height:11in; overflow:hidden; page-break-after: always; break-after: page; }
  .page:last-child { page-break-after: auto; }
  .page * { overflow-wrap:break-word; }
  @media screen {
    body { background:#e9e6e0; padding:24px 0; }
    .page { margin:0 auto 20px; box-shadow:0 8px 30px rgba(0,0,0,0.18); }
  }
</style></head><body>${pages}${printScript}</body></html>`;
}
