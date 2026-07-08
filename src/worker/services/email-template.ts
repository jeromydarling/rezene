import { all } from "./db";
import { DEFAULT_PALETTE, preferLightText } from "../../shared/brand-identity";
import type { BrandPalette } from "../../shared/types";
import type { Env } from "../types/env";

/**
 * Branded HTML email shell. Cloudflare's email binding sends whatever MIME we
 * hand it, and mimetext supports a text/html part, so transactional mail can be
 * fully styled — a logo (or the name) on the brand's primary colour, an accent
 * button, the palette throughout. Every send stays multipart/alternative with a
 * plain-text fallback, and the layout is old-school email-safe (tables + inline
 * styles + web fonts) so it survives Gmail/Outlook/Apple Mail.
 */

export interface EmailBrand {
  name: string;
  logoUrl: string | null; // absolute https URL, or null → render the name
  palette: BrandPalette;
}

/** Resolve the shop's email identity — name, absolute logo URL, palette. */
export async function getEmailBrand(env: Env, db: D1Database, shopSlug?: string | null): Promise<EmailBrand> {
  const rows = await all<{ key: string; value: string }>(
    db,
    `SELECT key, value FROM settings WHERE key IN ('brand_name','brand_logo','brand_palette')`,
  ).catch(() => [] as { key: string; value: string }[]);
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const name = map.brand_name?.trim() || env.BRAND_NAME;

  let palette = DEFAULT_PALETTE;
  try {
    const p = JSON.parse(map.brand_palette || "null") as BrandPalette | null;
    if (p?.primary && p.accent && p.ink && p.bg) palette = p;
  } catch {
    /* keep default */
  }

  let logoUrl: string | null = null;
  try {
    const logo = JSON.parse(map.brand_logo || "null") as { kind?: string; imageUrl?: string | null } | null;
    if (logo?.kind === "image" && logo.imageUrl) {
      const base = (env.APP_URL || "").replace(/\/$/, "");
      // imageUrl is a relative "/media/<id>"; address the shop explicitly so it
      // resolves regardless of which host the mail client fetches from.
      logoUrl = base ? `${base}${shopSlug ? `/${shopSlug}` : ""}${logo.imageUrl}` : null;
    }
  } catch {
    /* no logo */
  }

  return { name, logoUrl, palette };
}

const esc = (s: string) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

export interface BrandedEmailOpts {
  brand: EmailBrand;
  /** Hidden inbox preview line. */
  preheader?: string;
  heading: string;
  /** Inner HTML for the body (already escaped/trusted markup from composers). */
  bodyHtml: string;
  cta?: { label: string; href: string };
  footerNote?: string;
}

export function renderBrandedEmail(opts: BrandedEmailOpts): string {
  const { brand } = opts;
  const p = brand.palette;
  const headerText = preferLightText(p.primary) ? "#ffffff" : "#111111";
  const btnText = preferLightText(p.accent) ? "#ffffff" : "#111111";
  const serif = "Georgia,'Times New Roman',serif";

  const header = brand.logoUrl
    ? `<img src="${esc(brand.logoUrl)}" alt="${esc(brand.name)}" height="34" style="height:34px;width:auto;display:inline-block;border:0;" />`
    : `<span style="font-family:${serif};font-size:24px;font-weight:400;color:${headerText};letter-spacing:0.02em;">${esc(brand.name)}</span>`;

  const cta = opts.cta
    ? `<tr><td style="padding:8px 0 4px;">
         <a href="${esc(opts.cta.href)}" style="display:inline-block;background:${p.accent};color:${btnText};text-decoration:none;font-family:Arial,sans-serif;font-size:14px;font-weight:600;padding:12px 22px;border-radius:6px;">${esc(opts.cta.label)}</a>
       </td></tr>`
    : "";

  const footerNote = opts.footerNote
    ? `<p style="margin:0 0 10px;font-family:Arial,sans-serif;font-size:13px;line-height:1.5;color:#6f695c;">${opts.footerNote}</p>`
    : "";

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:${p.bg};">
<span style="display:none!important;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">${esc(opts.preheader ?? "")}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${p.bg};padding:24px 12px;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid rgba(0,0,0,0.06);">
      <tr><td style="background:${p.primary};padding:22px 28px;">${header}</td></tr>
      <tr><td style="padding:28px 28px 8px;">
        <h1 style="margin:0 0 14px;font-family:${serif};font-size:22px;font-weight:400;color:${p.ink};">${esc(opts.heading)}</h1>
        <div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:${p.ink};">${opts.bodyHtml}</div>
      </td></tr>
      <tr><td style="padding:4px 28px 24px;"><table role="presentation" cellpadding="0" cellspacing="0">${cta}</table></td></tr>
      <tr><td style="padding:18px 28px 24px;border-top:1px solid rgba(0,0,0,0.06);">
        ${footerNote}
        <p style="margin:0;font-family:${serif};font-size:14px;color:${p.ink};">${esc(brand.name)}</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

/** A simple two-column line-item table for order/receipt bodies. */
export function itemsTableHtml(
  rows: { label: string; right?: string; muted?: boolean }[],
  ink: string,
): string {
  const cells = rows
    .map(
      (r) =>
        `<tr><td style="padding:6px 0;border-bottom:1px solid rgba(0,0,0,0.05);color:${r.muted ? "#6f695c" : ink};">${esc(r.label)}</td>` +
        `<td align="right" style="padding:6px 0;border-bottom:1px solid rgba(0,0,0,0.05);white-space:nowrap;color:${r.muted ? "#6f695c" : ink};">${esc(r.right ?? "")}</td></tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif;font-size:14px;margin:4px 0 8px;">${cells}</table>`;
}
