import { all, first, run } from "./db";
import { getShopDb } from "./tenant-db";
import { PRIMARY_SHOP_ID } from "./shops";
import { typePairing } from "../../shared/brand-identity";
import { buildLookbookDoc } from "../../shared/lookbook-doc";
import { resolveRenderModel } from "./lookbook";
import {
  calculatePrintCost,
  createPrintJob,
  luluConfigured,
  luluMarkup,
  applyMarkup,
  magazinePageCount,
  MAGAZINE_POD_PACKAGE_ID,
  type LuluAddress,
  type LuluShippingLevel,
} from "./lulu";
import { renderConfigured } from "./video-render";
import { getStripe } from "./stripe";
import type { Env } from "../types/env";
import type { LookbookBrand, LookbookProduct, LookbookRenderModel } from "../../shared/lookbook";
import type { BrandLogo, BrandPalette } from "../../shared/types";

/**
 * Lookbook print & mail orchestration. Renders the lookbook to interior + cover
 * PDFs (GitHub Actions / Playwright, same backend as promo video), then submits
 * one Lulu print job per recipient — Lulu prints and drop-ships each copy.
 * Charge-on-delivery: the shop's card is authorized at order time and captured
 * only once the jobs are actually submitted to Lulu.
 */

const parseJson = <T>(v: string | null | undefined): T | null => {
  try {
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
};

/** Assemble the shop's brand identity for the print composer, server-side. */
export async function getLookbookBrand(db: D1Database, website: string): Promise<LookbookBrand> {
  const rows = await all<{ key: string; value: string }>(
    db,
    `SELECT key, value FROM settings WHERE key IN ('brand_name','brand_tagline','brand_logo','brand_palette','brand_typography')`,
  );
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const pairing = typePairing(parseJson<{ pairing?: string }>(map.brand_typography)?.pairing);
  return {
    name: map.brand_name || "Your Label",
    tagline: map.brand_tagline || "",
    website,
    logo: parseJson<BrandLogo>(map.brand_logo),
    palette: parseJson<BrandPalette>(map.brand_palette) ?? {
      primary: "#1f2a44",
      accent: "#c06e52",
      ink: "#23201b",
      bg: "#faf7f0",
    },
    headingFamily: pairing.headingFamily,
    bodyFamily: pairing.bodyFamily,
  };
}

/** Make product/asset paths absolute + shop-addressed so CI's browser (and Lulu) can fetch them. */
function absolutise(model: LookbookRenderModel, appUrl: string, slug: string): LookbookRenderModel {
  const fix = (u: string | null): string | null => {
    if (!u) return u;
    if (u.startsWith("/media/")) return `${appUrl}/${slug}${u}`;
    if (u.startsWith("/")) return `${appUrl}${u}`;
    return u;
  };
  const fixP = (p: LookbookProduct): LookbookProduct => ({ ...p, imageUrl: fix(p.imageUrl) });
  return {
    ...model,
    spreads: model.spreads.map((s) => ({ ...s, product: fixP(s.product) })),
    catalog: model.catalog.map(fixP),
  };
}

/** Build the print composition HTML the render Action captures (one part). */
export async function buildLookbookComposition(
  env: Env,
  shopId: string,
  lookbookId: string,
  part: "interior" | "cover" | "full",
): Promise<string | null> {
  const db = getShopDb(env, shopId, PRIMARY_SHOP_ID);
  const model = await resolveRenderModel(db, lookbookId);
  if (!model) return null;
  const appUrl = (env.APP_URL || "https://verto.style").replace(/\/$/, "");
  const slug = await shopSlug(env, shopId);
  const brand = await getLookbookBrand(db, new URL(appUrl).host);
  return buildLookbookDoc(absolutise(model, appUrl, slug), brand, { part });
}

async function shopSlug(env: Env, shopId: string): Promise<string> {
  const row = await first<{ slug: string }>(env.DB, `SELECT slug FROM shops WHERE id = ?`, shopId);
  return row?.slug || "";
}

function mediaUrl(env: Env, slug: string, fileId: string): string {
  const appUrl = (env.APP_URL || "https://verto.style").replace(/\/$/, "");
  return `${appUrl}/${slug}/media/${fileId}`;
}

/** Dispatch the render workflow (GitHub Actions renders interior + cover PDFs). */
export async function dispatchLookbookRender(
  env: Env,
  args: { shopId: string; jobId: string; lookbookId: string },
): Promise<{ ok: boolean; error?: string }> {
  if (!renderConfigured(env)) return { ok: false, error: "render backend not configured" };
  const base = (env.APP_URL || "https://verto.style").replace(/\/$/, "");
  const res = await fetch(`https://api.github.com/repos/${env.RENDER_REPO}/dispatches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.GITHUB_DISPATCH_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "verto-render",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      event_type: "render_lookbook",
      client_payload: { shopId: args.shopId, jobId: args.jobId, callbackBase: `${base}/api/render/lookbook` },
    }),
  });
  if (res.status === 204) return { ok: true };
  const body = await res.text().catch(() => "");
  return { ok: false, error: `github dispatch ${res.status}: ${body.slice(0, 200)}` };
}

export interface PrintJobRow {
  id: string;
  lookbook_id: string;
  title: string;
  status: string;
  page_count: number;
  copies_per_recipient: number;
  shipping_level: string;
  pod_package_id: string | null;
  interior_file_id: string | null;
  cover_file_id: string | null;
  wholesale_cents: number;
  retail_cents: number;
  currency: string;
  stripe_session_id: string | null;
  stripe_payment_intent_id: string | null;
  paid_at: string | null;
  error: string | null;
  created_by: string | null;
}

export interface RecipientInput {
  name: string;
  street1: string;
  street2?: string;
  city: string;
  state_code?: string;
  postcode: string;
  country_code?: string;
  phone_number?: string;
  email?: string;
}

/**
 * A cost estimate for a run to a representative destination (the first
 * recipient), × recipient count. The exact per-recipient cost is computed at
 * submit; this is what we authorize against (with a buffer for destination
 * variance).
 */
export async function estimatePrintOrder(
  env: Env,
  db: D1Database,
  opts: { lookbookId: string; recipients: number; copies: number; shippingLevel: LuluShippingLevel; sample: LuluAddress },
): Promise<{ pageCount: number; perRecipientWholesaleCents: number; wholesaleCents: number; retailCents: number; currency: string }> {
  const model = await resolveRenderModel(db, opts.lookbookId);
  const pageCount = magazinePageCount(model?.spreads.length ?? 0);
  const cost = await calculatePrintCost(env, {
    pageCount,
    quantity: opts.copies,
    shippingAddress: opts.sample,
    shippingLevel: opts.shippingLevel,
  });
  const perRecipientWholesaleCents = cost.totalCents;
  const wholesaleCents = perRecipientWholesaleCents * opts.recipients;
  const retailCents = applyMarkup(wholesaleCents, luluMarkup(env));
  return { pageCount, perRecipientWholesaleCents, wholesaleCents, retailCents, currency: cost.currency };
}

/**
 * Submit one Lulu print job per recipient with the rendered PDFs. Returns the
 * actual summed wholesale cost. Best-effort per recipient — one bad address
 * doesn't sink the batch; its row records the error.
 */
export async function submitPrintJobToLulu(
  env: Env,
  shopId: string,
  jobId: string,
): Promise<{ submitted: number; failed: number; wholesaleCents: number }> {
  const db = getShopDb(env, shopId, PRIMARY_SHOP_ID);
  const job = await first<PrintJobRow>(db, `SELECT * FROM lookbook_print_jobs WHERE id = ?`, jobId);
  if (!job || !job.interior_file_id || !job.cover_file_id) throw new Error("job not renderable");
  const slug = await shopSlug(env, shopId);
  const interiorUrl = mediaUrl(env, slug, job.interior_file_id);
  const coverUrl = mediaUrl(env, slug, job.cover_file_id);
  const recipients = await all<{
    id: string;
    name: string;
    street1: string;
    street2: string | null;
    city: string;
    state_code: string | null;
    postcode: string;
    country_code: string;
    phone_number: string | null;
    email: string | null;
    lulu_job_id: string | null;
  }>(db, `SELECT * FROM lookbook_print_recipients WHERE job_id = ?`, jobId);

  let submitted = 0;
  let failed = 0;
  let wholesaleCents = 0;
  for (const r of recipients) {
    if (r.lulu_job_id) {
      submitted++;
      continue;
    } // idempotent re-run
    const address: LuluAddress = {
      name: r.name,
      street1: r.street1,
      street2: r.street2 ?? undefined,
      city: r.city,
      state_code: r.state_code ?? undefined,
      postcode: r.postcode,
      country_code: r.country_code,
      phone_number: r.phone_number ?? "+10000000000",
      email: r.email ?? undefined,
    };
    try {
      const cost = await calculatePrintCost(env, {
        pageCount: job.page_count,
        quantity: job.copies_per_recipient,
        shippingAddress: address,
        shippingLevel: job.shipping_level as LuluShippingLevel,
        podPackageId: job.pod_package_id ?? MAGAZINE_POD_PACKAGE_ID,
      });
      const luluJob = await createPrintJob(env, {
        title: job.title,
        interiorUrl,
        coverUrl,
        pageCount: job.page_count,
        quantity: job.copies_per_recipient,
        shippingAddress: address,
        shippingLevel: job.shipping_level as LuluShippingLevel,
        externalId: `${shopId}:${r.id}`,
        podPackageId: job.pod_package_id ?? MAGAZINE_POD_PACKAGE_ID,
      });
      wholesaleCents += cost.totalCents;
      submitted++;
      await run(
        db,
        `UPDATE lookbook_print_recipients SET lulu_job_id = ?, lulu_status = ?, cost_cents = ?, error = NULL WHERE id = ?`,
        luluJob.id,
        luluJob.status,
        cost.totalCents,
        r.id,
      );
    } catch (err) {
      failed++;
      await run(
        db,
        `UPDATE lookbook_print_recipients SET error = ? WHERE id = ?`,
        String(err).slice(0, 300),
        r.id,
      );
    }
  }
  return { submitted, failed, wholesaleCents };
}

/** Capture (or cancel) the shop's authorized payment. Captures at most the authorized amount. */
export async function settlePrintPayment(
  env: Env,
  db: D1Database,
  job: PrintJobRow,
  outcome: { ok: boolean; captureCents?: number },
): Promise<void> {
  const stripe = getStripe(env);
  if (!stripe || !job.stripe_payment_intent_id || job.paid_at) return;
  try {
    if (outcome.ok && (outcome.captureCents ?? job.retail_cents) > 0) {
      const authorized = job.retail_cents;
      const amount = Math.min(authorized, Math.max(1, Math.round(outcome.captureCents ?? authorized)));
      const pi = await stripe.paymentIntents.capture(job.stripe_payment_intent_id, { amount_to_capture: amount });
      if (pi.status === "succeeded") {
        await run(db, `UPDATE lookbook_print_jobs SET paid_at = datetime('now'), retail_cents = ? WHERE id = ?`, amount, job.id);
      }
    } else {
      await stripe.paymentIntents.cancel(job.stripe_payment_intent_id);
    }
  } catch (err) {
    console.error(`[lookbook-print] settle failed for ${job.id}: ${String(err)}`);
  }
}

/** Roll a job's status up from its recipients (used by the webhook + status refresh). */
export function rollupStatus(recipients: { lulu_status: string | null; lulu_job_id: string | null }[]): string {
  const withJob = recipients.filter((r) => r.lulu_job_id);
  if (!withJob.length) return "submitted";
  const shipped = withJob.filter((r) => (r.lulu_status ?? "").toUpperCase().includes("SHIP"));
  if (shipped.length === withJob.length) return "shipped";
  return "submitted";
}

export { luluConfigured };
