import { Hono } from "hono";
import { z } from "zod";
import { all, first, run } from "../services/db";
import { parseBody } from "../services/validators";
import { requireAdminWrite } from "../middleware/auth";
import {
  listLookbooks,
  createLookbook,
  updateLookbook,
  deleteLookbook,
  resolveRenderModel,
  availableProducts,
} from "../services/lookbook";
import type { AppContext } from "../types/env";

/**
 * Lookbook builder: a shop's print-ready seasonal magazine, composed from its
 * own products + brand identity. Reads resolve product data live; the client
 * renders the print HTML and (Phase A) saves a preview PDF.
 */
export const adminLookbookRoutes = new Hono<AppContext>();

adminLookbookRoutes.get("/", async (c) => {
  const rows = await listLookbooks(c.var.db);
  return c.json(rows);
});

/** The pool of products available to add to a lookbook (published + sellable). */
adminLookbookRoutes.get("/catalog", async (c) => {
  return c.json(await availableProducts(c.var.db));
});

adminLookbookRoutes.get("/:id", async (c) => {
  const model = await resolveRenderModel(c.var.db, c.req.param("id"));
  if (!model) return c.json({ error: "Lookbook not found" }, 404);
  return c.json(model);
});

/**
 * A print & mail cost estimate (beta). Always returns the page count so the UI
 * can show the shape of an issue; a live Lulu quote (marked up to the shop's
 * price) only when Lulu is configured. To a representative US destination — a
 * ballpark, not a final total (that's computed per real recipient at order).
 */
const ESTIMATE_DEST = {
  name: "Sample",
  street1: "123 Main St",
  city: "New York",
  state_code: "NY",
  postcode: "10001",
  country_code: "US",
  phone_number: "+12125550100",
} as const;

const estimateSchema = z.object({ quantity: z.number().int().min(1).max(500).optional() });

adminLookbookRoutes.post("/:id/print-estimate", async (c) => {
  const model = await resolveRenderModel(c.var.db, c.req.param("id"));
  if (!model) return c.json({ error: "Lookbook not found" }, 404);
  const body = await parseBody(c, estimateSchema);
  const quantity = body.quantity ?? 1;
  const { magazinePageCount, luluConfigured, luluMarkup, applyMarkup, calculatePrintCost } = await import(
    "../services/lulu"
  );
  const pageCount = magazinePageCount(model.spreads.length);
  const markupPct = Math.round(luluMarkup(c.env) * 100);
  if (!luluConfigured(c.env)) {
    return c.json({ configured: false, pageCount, quantity, markupPct });
  }
  try {
    const cost = await calculatePrintCost(c.env, {
      pageCount,
      quantity,
      shippingAddress: ESTIMATE_DEST,
      shippingLevel: "GROUND",
    });
    const retailCents = applyMarkup(cost.totalCents, luluMarkup(c.env));
    return c.json({
      configured: true,
      pageCount,
      quantity,
      markupPct,
      quote: {
        wholesaleCents: cost.totalCents,
        printCents: cost.printCostCents,
        shippingCents: cost.shippingCostCents,
        retailCents,
        perCopyRetailCents: Math.round(retailCents / quantity),
        currency: cost.currency,
      },
    });
  } catch (err) {
    return c.json({ configured: true, pageCount, quantity, markupPct, error: String(err).slice(0, 200) });
  }
});

const createSchema = z.object({
  title: z.string().max(200).optional(),
  subtitle: z.string().max(200).optional(),
  intro: z.string().max(4000).optional(),
});

adminLookbookRoutes.post("/", requireAdminWrite, async (c) => {
  const body = await parseBody(c, createSchema);
  const created = await createLookbook(c.var.db, body);
  return c.json(created, 201);
});

const layoutEnum = z.enum(["hero", "editorial", "clean"]);
const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  subtitle: z.string().max(200).nullable().optional(),
  intro: z.string().max(4000).nullable().optional(),
  template: z.string().max(40).optional(),
  spec: z
    .object({
      spreads: z
        .array(
          z.object({
            productId: z.string().max(64),
            layout: layoutEnum,
            caption: z.string().max(400).optional(),
          }),
        )
        .max(60),
    })
    .optional(),
});

adminLookbookRoutes.patch("/:id", requireAdminWrite, async (c) => {
  const body = await parseBody(c, updateSchema);
  const updated = await updateLookbook(c.var.db, c.req.param("id"), body);
  if (!updated) return c.json({ error: "Lookbook not found" }, 404);
  return c.json(updated);
});

adminLookbookRoutes.delete("/:id", requireAdminWrite, async (c) => {
  const ok = await deleteLookbook(c.var.db, c.req.param("id"));
  if (!ok) return c.json({ error: "Lookbook not found" }, 404);
  return c.json({ ok: true });
});

// ---- Print & mail orders -------------------------------------------------

const recipientSchema = z.object({
  name: z.string().min(1).max(120),
  street1: z.string().min(1).max(200),
  street2: z.string().max(200).optional(),
  city: z.string().min(1).max(120),
  state_code: z.string().max(20).optional(),
  postcode: z.string().min(1).max(20),
  country_code: z.string().length(2).optional(),
  phone_number: z.string().max(40).optional(),
  email: z.string().email().max(200).optional(),
});
const orderSchema = z.object({
  recipients: z.array(recipientSchema).min(1).max(200),
  copies: z.number().int().min(1).max(50).optional(),
  shippingLevel: z.enum(["MAIL", "PRIORITY_MAIL", "GROUND_HD", "GROUND_BUS", "GROUND", "EXPEDITED", "EXPRESS"]).optional(),
});

/** Create a print & mail order: cost it, authorize the shop's card, return a checkout URL. */
adminLookbookRoutes.post("/:id/order", requireAdminWrite, async (c) => {
  const body = await parseBody(c, orderSchema);
  const model = await resolveRenderModel(c.var.db, c.req.param("id"));
  if (!model) return c.json({ error: "Lookbook not found" }, 404);
  if (model.spreads.length === 0) return c.json({ error: "Add some pieces before ordering prints." }, 400);

  const { getStripe } = await import("../services/stripe");
  const stripe = getStripe(c.env);
  if (!stripe) return c.json({ error: "Connect payments (Stripe) to order printed lookbooks." }, 400);
  const { luluConfigured } = await import("../services/lulu");
  if (!luluConfigured(c.env)) return c.json({ error: "Print & mail isn't switched on for the platform yet." }, 503);

  const copies = body.copies ?? 1;
  const shippingLevel = (body.shippingLevel ?? "GROUND") as import("../services/lulu").LuluShippingLevel;
  const first = body.recipients[0];
  const sample = { ...first, country_code: first.country_code ?? "US", phone_number: first.phone_number ?? "+10000000000" };

  const { estimatePrintOrder, getLookbookBrand } = await import("../services/lookbook-print");
  let est;
  try {
    est = await estimatePrintOrder(c.env, c.var.db, {
      lookbookId: c.req.param("id"),
      recipients: body.recipients.length,
      copies,
      shippingLevel,
      sample,
    });
  } catch (err) {
    return c.json({ error: `Couldn't price this order: ${String(err).slice(0, 200)}` }, 502);
  }
  void getLookbookBrand; // (used by the renderer; ensures the import graph is intact)

  const { newId } = await import("../utils/id");
  const jobId = newId("lbprint");
  const { MAGAZINE_POD_PACKAGE_ID } = await import("../services/lulu");
  await run(
    c.var.db,
    `INSERT INTO lookbook_print_jobs
       (id, lookbook_id, title, status, page_count, copies_per_recipient, shipping_level, pod_package_id, wholesale_cents, retail_cents, currency, created_by)
     VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?)`,
    jobId,
    c.req.param("id"),
    model.lookbook.title,
    est.pageCount,
    copies,
    shippingLevel,
    MAGAZINE_POD_PACKAGE_ID,
    est.wholesaleCents,
    est.retailCents,
    est.currency,
    c.var.userId ?? null,
  );
  for (const r of body.recipients) {
    await run(
      c.var.db,
      `INSERT INTO lookbook_print_recipients (id, job_id, name, street1, street2, city, state_code, postcode, country_code, phone_number, email)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      newId("lbrcpt"),
      jobId,
      r.name,
      r.street1,
      r.street2 ?? null,
      r.city,
      r.state_code ?? null,
      r.postcode,
      r.country_code ?? "US",
      r.phone_number ?? null,
      r.email ?? null,
    );
  }

  const origin = new URL(c.req.url).origin;
  const shopBase = c.var.shopSlug ? `/${c.var.shopSlug}` : "";
  const appUrl = (c.env.APP_ENV === "development" ? origin : c.env.APP_URL || origin) + shopBase;
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_intent_data: { capture_method: "manual" },
    metadata: { kind: "lookbook_print", job_id: jobId, shop_id: c.var.shopId },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: est.currency.toLowerCase(),
          unit_amount: est.retailCents,
          product_data: {
            name: `Printed lookbook — ${model.lookbook.title}`,
            description: `${body.recipients.length} recipient(s) × ${copies} cop${copies === 1 ? "y" : "ies"}, printed & mailed. Charged once the jobs are placed.`,
          },
        },
      },
    ],
    success_url: `${appUrl}/admin/brand/lookbook?printed=${jobId}`,
    cancel_url: `${appUrl}/admin/brand/lookbook?print_cancelled=${jobId}`,
  });
  await run(c.var.db, `UPDATE lookbook_print_jobs SET stripe_session_id = ? WHERE id = ?`, session.id, jobId);
  return c.json({ jobId, checkoutUrl: session.url, estimate: est });
});

/** After the checkout redirect: confirm the authorization and kick off the render. */
adminLookbookRoutes.post("/:id/order/:jobId/activate", requireAdminWrite, async (c) => {
  const jobId = c.req.param("jobId");
  const job = await first<{ status: string; stripe_session_id: string | null }>(
    c.var.db,
    `SELECT status, stripe_session_id FROM lookbook_print_jobs WHERE id = ?`,
    jobId,
  );
  if (!job) return c.json({ error: "Order not found" }, 404);
  if (job.status !== "draft") return c.json({ status: job.status }); // idempotent
  const { getStripe } = await import("../services/stripe");
  const stripe = getStripe(c.env);
  if (!stripe || !job.stripe_session_id) return c.json({ error: "Payment not set up" }, 400);

  const session = await stripe.checkout.sessions.retrieve(job.stripe_session_id, { expand: ["payment_intent"] });
  const pi = session.payment_intent as { id: string; status: string } | null;
  if (!pi || pi.status !== "requires_capture") {
    return c.json({ status: "draft", error: "Payment isn't authorized yet." });
  }
  await run(
    c.var.db,
    `UPDATE lookbook_print_jobs SET stripe_payment_intent_id = ?, status = 'rendering', updated_at = datetime('now') WHERE id = ?`,
    pi.id,
    jobId,
  );
  const { dispatchLookbookRender } = await import("../services/lookbook-print");
  const dispatched = await dispatchLookbookRender(c.env, { shopId: c.var.shopId, jobId, lookbookId: c.req.param("id") });
  if (!dispatched.ok) {
    await run(c.var.db, `UPDATE lookbook_print_jobs SET status = 'failed', error = ? WHERE id = ?`, dispatched.error ?? "dispatch failed", jobId);
    // Release the authorization — nothing will render.
    try {
      await stripe.paymentIntents.cancel(pi.id);
    } catch {
      /* best effort */
    }
    return c.json({ status: "failed", error: "Couldn't reach the render service." }, 502);
  }
  return c.json({ status: "rendering" });
});

/** List a lookbook's print orders. */
adminLookbookRoutes.get("/:id/orders", async (c) => {
  const rows = await all(
    c.var.db,
    `SELECT j.id, j.title, j.status, j.retail_cents, j.currency, j.created_at,
            (SELECT COUNT(*) FROM lookbook_print_recipients r WHERE r.job_id = j.id) AS recipients
       FROM lookbook_print_jobs j WHERE j.lookbook_id = ? ORDER BY j.created_at DESC`,
    c.req.param("id"),
  );
  return c.json(rows);
});

/** One order with its recipients + tracking. */
adminLookbookRoutes.get("/orders/:jobId", async (c) => {
  const job = await first(c.var.db, `SELECT * FROM lookbook_print_jobs WHERE id = ?`, c.req.param("jobId"));
  if (!job) return c.json({ error: "Order not found" }, 404);
  const recipients = await all(
    c.var.db,
    `SELECT id, name, city, country_code, lulu_status, tracking_id, tracking_url, error FROM lookbook_print_recipients WHERE job_id = ?`,
    c.req.param("jobId"),
  );
  return c.json({ job, recipients });
});

/** Poll Lulu for the latest status of each recipient (webhook fallback). */
adminLookbookRoutes.post("/orders/:jobId/refresh", async (c) => {
  const jobId = c.req.param("jobId");
  const recipients = await all<{ id: string; lulu_job_id: string | null; lulu_status: string | null }>(
    c.var.db,
    `SELECT id, lulu_job_id, lulu_status FROM lookbook_print_recipients WHERE job_id = ?`,
    jobId,
  );
  const { getPrintJob, luluConfigured } = await import("../services/lulu");
  if (luluConfigured(c.env)) {
    for (const r of recipients) {
      if (!r.lulu_job_id) continue;
      try {
        const j = await getPrintJob(c.env, r.lulu_job_id);
        await run(
          c.var.db,
          `UPDATE lookbook_print_recipients SET lulu_status = ?, tracking_id = ?, tracking_url = ? WHERE id = ?`,
          j.status,
          j.trackingId,
          j.trackingUrls[0] ?? null,
          r.id,
        );
      } catch {
        /* skip this one */
      }
    }
  }
  const fresh = await all<{ lulu_status: string | null; lulu_job_id: string | null }>(
    c.var.db,
    `SELECT lulu_status, lulu_job_id FROM lookbook_print_recipients WHERE job_id = ?`,
    jobId,
  );
  const { rollupStatus } = await import("../services/lookbook-print");
  const status = rollupStatus(fresh);
  await run(c.var.db, `UPDATE lookbook_print_jobs SET status = CASE WHEN status IN ('submitted','shipped') THEN ? ELSE status END, updated_at = datetime('now') WHERE id = ?`, status, jobId);
  return c.json({ status });
});
