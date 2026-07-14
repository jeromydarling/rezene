/**
 * Render backend callbacks — the surface GitHub Actions talks to.
 *
 * These are NOT session-gated: the render runs in CI, not a browser. Every
 * call is authenticated by the shared RENDER_CALLBACK_SECRET, and the shop is
 * addressed explicitly in the path so the Action can write back to the right
 * per-shop database.
 *
 * Flow:
 *   GET  /:shopId/:jobId              → job spec + music prompt + formats
 *   GET  /:shopId/:jobId/composition  → the exact HTML the Action captures
 *   POST /:shopId/:jobId/progress     → scene-by-scene progress for the UI
 *   POST /:shopId/:jobId/complete     → one finished MP4 (multipart, per format)
 *   POST /:shopId/:jobId/finalize     → render done → capture payment / notify
 */
import { Hono } from "hono";
import { first, run } from "../services/db";
import { getShopDb } from "../services/tenant-db";
import { PRIMARY_SHOP_ID } from "../services/shops";
import { renderSecretOk } from "../services/video-render";
import { buildCompositionHtml, type VideoSpec } from "../services/video-composition";
import { getStripe } from "../services/stripe";
import { sendBuyerEmail } from "../services/buyer-email";
import { newId } from "../utils/id";
import type { Env } from "../types/env";
import type { D1Database } from "@cloudflare/workers-types";

export const renderCallbackRoutes = new Hono<{ Bindings: Env }>();

interface JobRow {
  id: string;
  title: string;
  spec_json: string;
  status: string;
  formats: string;
  outputs: string | null;
  price_cents: number;
  currency: string;
  stripe_payment_intent_id: string | null;
  paid_at: string | null;
  created_by: string | null;
}

function db(env: Env, shopId: string): D1Database {
  return getShopDb(env, shopId, PRIMARY_SHOP_ID) as unknown as D1Database;
}

function secretOk(c: { req: { header: (k: string) => string | undefined; query: (k: string) => string | undefined }; env: Env }): boolean {
  return renderSecretOk(c.env, c.req.header("x-render-secret") || c.req.query("secret"));
}

/** Absolute-ise /media and /verto asset paths so CI's browser can fetch them. */
function absolutise(spec: VideoSpec, appUrl: string): VideoSpec {
  const fix = (u: string) => (u && u.startsWith("/") ? `${appUrl}${u}` : u);
  return {
    ...spec,
    heroImg: fix(spec.heroImg),
    editorialImg: fix(spec.editorialImg),
    products: (spec.products ?? []).map((p) => ({ ...p, img: fix(p.img) })),
  };
}

function musicPromptFor(spec: VideoSpec): string {
  return `Elegant, cinematic fashion-runway underscore for a ${spec.durationSec ?? 30}-second brand promo. Understated, modern, confident; soft percussion building to a warm resolve. Instrumental, no vocals. Brand mood: refined, editorial, ${spec.brandName}.`;
}

// ---- Job metadata (spec, formats, music prompt) --------------------------
renderCallbackRoutes.get("/:shopId/:jobId", async (c) => {
  if (!secretOk(c)) return c.json({ error: "unauthorized" }, 401);
  const row = await first<JobRow>(db(c.env, c.req.param("shopId")), `SELECT * FROM video_jobs WHERE id = ?`, c.req.param("jobId"));
  if (!row) return c.json({ error: "not found" }, 404);
  const appUrl = (c.env.APP_URL || "https://verto.style").replace(/\/$/, "");
  const spec = absolutise(JSON.parse(row.spec_json) as VideoSpec, appUrl);
  return c.json({
    id: row.id,
    title: row.title,
    status: row.status,
    durationSec: spec.durationSec ?? 30,
    formats: JSON.parse(row.formats || "[\"16:9\"]") as string[],
    musicPrompt: musicPromptFor(spec),
    spec,
  });
});

// ---- Composition HTML (what the Action captures) -------------------------
renderCallbackRoutes.get("/:shopId/:jobId/composition", async (c) => {
  if (!secretOk(c)) return c.text("unauthorized", 401);
  const row = await first<JobRow>(db(c.env, c.req.param("shopId")), `SELECT spec_json FROM video_jobs WHERE id = ?`, c.req.param("jobId"));
  if (!row) return c.text("not found", 404);
  const appUrl = (c.env.APP_URL || "https://verto.style").replace(/\/$/, "");
  const spec = absolutise(JSON.parse(row.spec_json) as VideoSpec, appUrl);
  return c.html(buildCompositionHtml(spec));
});

// ---- Progress ------------------------------------------------------------
renderCallbackRoutes.post("/:shopId/:jobId/progress", async (c) => {
  if (!secretOk(c)) return c.json({ error: "unauthorized" }, 401);
  const body = (await c.req.json().catch(() => ({}))) as { progress?: number; label?: string; status?: string };
  const shopDb = db(c.env, c.req.param("shopId"));
  const progress = Math.max(0, Math.min(100, Math.round(Number(body.progress) || 0)));
  const status = body.status === "rendering" ? "rendering" : undefined;
  await run(
    shopDb,
    `UPDATE video_jobs SET progress = ?, progress_label = ?, ${status ? "status = ?, " : ""}
       render_started_at = COALESCE(render_started_at, datetime('now')), updated_at = datetime('now')
     WHERE id = ?`,
    ...(status
      ? [progress, body.label ?? null, status, c.req.param("jobId")]
      : [progress, body.label ?? null, c.req.param("jobId")]),
  );
  return c.json({ ok: true });
});

// ---- One finished MP4 (per requested format) -----------------------------
renderCallbackRoutes.post("/:shopId/:jobId/complete", async (c) => {
  // multipart: fields secret, format; files video (required), poster (optional)
  const form = await c.req.parseBody();
  if (!renderSecretOk(c.env, (form.secret as string) || c.req.header("x-render-secret"))) {
    return c.json({ error: "unauthorized" }, 401);
  }
  const shopId = c.req.param("shopId");
  const jobId = c.req.param("jobId");
  const shopDb = db(c.env, shopId);
  const row = await first<JobRow>(shopDb, `SELECT id, outputs FROM video_jobs WHERE id = ?`, jobId);
  if (!row) return c.json({ error: "not found" }, 404);

  const format = String(form.format || "16:9");
  const video = form.video as unknown as File | undefined;
  if (!video || typeof video.arrayBuffer !== "function") return c.json({ error: "missing video" }, 400);

  const key = `${shopId}/video/${jobId}/${format.replace(":", "x")}.mp4`;
  await c.env.FILES.put(key, await video.arrayBuffer(), { httpMetadata: { contentType: "video/mp4" } });
  const fileId = newId("file");
  await run(
    shopDb,
    `INSERT INTO files (id, r2_key, filename, content_type, entity_type, entity_id, is_public, uploaded_by)
     VALUES (?, ?, ?, 'video/mp4', 'general', ?, 1, NULL)`,
    fileId,
    key,
    `${jobId}-${format.replace(":", "x")}.mp4`,
    jobId,
  );

  let posterFileId: string | null = null;
  const poster = form.poster as unknown as File | undefined;
  if (poster && typeof poster.arrayBuffer === "function") {
    const pkey = `${shopId}/video/${jobId}/poster.jpg`;
    await c.env.FILES.put(pkey, await poster.arrayBuffer(), { httpMetadata: { contentType: "image/jpeg" } });
    posterFileId = newId("file");
    await run(
      shopDb,
      `INSERT INTO files (id, r2_key, filename, content_type, entity_type, entity_id, is_public, uploaded_by)
       VALUES (?, ?, ?, 'image/jpeg', 'general', ?, 1, NULL)`,
      posterFileId,
      pkey,
      `${jobId}-poster.jpg`,
      jobId,
    );
  }

  const outputs = (row.outputs ? JSON.parse(row.outputs) : {}) as Record<string, { fileId: string; url: string }>;
  // Served through the tenant-resolving /media route (studio requests carry the shop header).
  outputs[format] = { fileId, url: `/media/${fileId}` };
  await run(
    shopDb,
    `UPDATE video_jobs SET outputs = ?, ${posterFileId ? "poster_file_id = COALESCE(poster_file_id, ?), " : ""} updated_at = datetime('now') WHERE id = ?`,
    ...(posterFileId ? [JSON.stringify(outputs), posterFileId, jobId] : [JSON.stringify(outputs), jobId]),
  );
  return c.json({ ok: true, fileId });
});

// ---- Finalize: render succeeded or failed → settle payment + notify ------
renderCallbackRoutes.post("/:shopId/:jobId/finalize", async (c) => {
  if (!secretOk(c)) return c.json({ error: "unauthorized" }, 401);
  const body = (await c.req.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  const shopId = c.req.param("shopId");
  const jobId = c.req.param("jobId");
  const shopDb = db(c.env, shopId);
  const row = await first<JobRow>(shopDb, `SELECT * FROM video_jobs WHERE id = ?`, jobId);
  if (!row) return c.json({ error: "not found" }, 404);

  const stripe = getStripe(c.env);
  if (body.ok) {
    // Capture the authorization now that the MP4 exists. Charge-on-delivery:
    // a failed render (below) never reaches this branch, so we never bill it.
    let paidAt: string | null = row.paid_at;
    if (stripe && row.stripe_payment_intent_id && !row.paid_at && row.price_cents > 0) {
      try {
        const pi = await stripe.paymentIntents.capture(row.stripe_payment_intent_id);
        if (pi.status === "succeeded") paidAt = new Date().toISOString();
      } catch (err) {
        console.error(`[render] capture failed for ${jobId}: ${String(err)}`);
      }
    }
    await run(
      shopDb,
      `UPDATE video_jobs SET status = 'ready', progress = 100, progress_label = 'Ready', error = NULL,
         paid_at = ?, rendered_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
      paidAt,
      jobId,
    );
    await notifyOwner(c.env, shopDb, row, true);
  } else {
    // Release the hold so the customer is never charged for a render they can't use.
    if (stripe && row.stripe_payment_intent_id && !row.paid_at) {
      try {
        await stripe.paymentIntents.cancel(row.stripe_payment_intent_id);
      } catch (err) {
        console.error(`[render] PI cancel failed for ${jobId}: ${String(err)}`);
      }
    }
    await run(
      shopDb,
      `UPDATE video_jobs SET status = 'failed', progress_label = 'Render failed', error = ?, updated_at = datetime('now') WHERE id = ?`,
      (body.error || "render failed").slice(0, 500),
      jobId,
    );
    await notifyOwner(c.env, shopDb, row, false);
  }
  return c.json({ ok: true });
});

async function notifyOwner(env: Env, shopDb: D1Database, row: JobRow, ok: boolean): Promise<void> {
  if (!row.created_by) return;
  const user = await first<{ email: string; name: string | null }>(
    shopDb,
    `SELECT email, name FROM users WHERE id = ?`,
    row.created_by,
  );
  if (!user?.email) return;
  const brand = await first<{ value: string }>(shopDb, `SELECT value FROM settings WHERE key = 'brand_name'`);
  const name = brand?.value || "your shop";
  if (ok) {
    await sendBuyerEmail(env, {
      to: user.email,
      fromName: name,
      subject: `Your ${name} promo video is ready`,
      text: `Good news — "${row.title}" finished rendering and is ready to download from your Marketing Suite → Promo Video.\n\nYou were only charged now that the finished video exists.`,
    });
  } else {
    await sendBuyerEmail(env, {
      to: user.email,
      fromName: name,
      subject: `Your ${name} promo render needs another pass`,
      text: `"${row.title}" didn't finish rendering, so you were not charged. Open the Marketing Suite → Promo Video to retry — your composition is saved exactly as you left it.`,
    });
  }
}

// ---- Lookbook print renders (Playwright HTML → interior + cover PDFs) ------
// Same trust model: shared secret, shop in the path. The Action fetches the
// composition (per part) and posts back two PDFs, then finalizes — which
// submits the Lulu print jobs and captures the shop's authorized payment.

renderCallbackRoutes.get("/lookbook/:shopId/:jobId/composition", async (c) => {
  if (!secretOk(c)) return c.text("unauthorized", 401);
  const shopId = c.req.param("shopId");
  const shopDb = db(c.env, shopId);
  const job = await first<{ lookbook_id: string }>(
    shopDb,
    `SELECT lookbook_id FROM lookbook_print_jobs WHERE id = ?`,
    c.req.param("jobId"),
  );
  if (!job) return c.text("not found", 404);
  const partRaw = c.req.query("part");
  const part = partRaw === "cover" ? "cover" : partRaw === "interior" ? "interior" : "full";
  const { buildLookbookComposition } = await import("../services/lookbook-print");
  const html = await buildLookbookComposition(c.env, shopId, job.lookbook_id, part);
  if (!html) return c.text("not found", 404);
  return c.html(html);
});

renderCallbackRoutes.post("/lookbook/:shopId/:jobId/complete", async (c) => {
  const form = await c.req.parseBody();
  if (!renderSecretOk(c.env, (form.secret as string) || c.req.header("x-render-secret"))) {
    return c.json({ error: "unauthorized" }, 401);
  }
  const shopId = c.req.param("shopId");
  const jobId = c.req.param("jobId");
  const shopDb = db(c.env, shopId);
  const job = await first<{ id: string }>(shopDb, `SELECT id FROM lookbook_print_jobs WHERE id = ?`, jobId);
  if (!job) return c.json({ error: "not found" }, 404);

  async function storePdf(field: string, name: string): Promise<string | null> {
    const file = form[field] as unknown as File | undefined;
    if (!file || typeof file.arrayBuffer !== "function") return null;
    const key = `${shopId}/lookbook/${jobId}/${name}.pdf`;
    await c.env.FILES.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: "application/pdf" } });
    const fileId = newId("file");
    await run(
      shopDb,
      `INSERT INTO files (id, r2_key, filename, content_type, entity_type, entity_id, is_public, uploaded_by)
       VALUES (?, ?, ?, 'application/pdf', 'general', ?, 1, NULL)`,
      fileId,
      key,
      `${jobId}-${name}.pdf`,
      jobId,
    );
    return fileId;
  }

  const interiorId = await storePdf("interior", "interior");
  const coverId = await storePdf("cover", "cover");
  if (!interiorId || !coverId) return c.json({ error: "missing interior/cover pdf" }, 400);
  await run(
    shopDb,
    `UPDATE lookbook_print_jobs SET interior_file_id = ?, cover_file_id = ?, status = 'rendered', updated_at = datetime('now') WHERE id = ?`,
    interiorId,
    coverId,
    jobId,
  );
  return c.json({ ok: true });
});

renderCallbackRoutes.post("/lookbook/:shopId/:jobId/finalize", async (c) => {
  if (!secretOk(c)) return c.json({ error: "unauthorized" }, 401);
  const body = (await c.req.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  const shopId = c.req.param("shopId");
  const jobId = c.req.param("jobId");
  const shopDb = db(c.env, shopId);
  const job = await first<import("../services/lookbook-print").PrintJobRow>(
    shopDb,
    `SELECT * FROM lookbook_print_jobs WHERE id = ?`,
    jobId,
  );
  if (!job) return c.json({ error: "not found" }, 404);
  const { submitPrintJobToLulu, settlePrintPayment, luluConfigured } = await import("../services/lookbook-print");
  const { applyMarkup, luluMarkup } = await import("../services/lulu");

  if (!body.ok) {
    await settlePrintPayment(c.env, shopDb, job, { ok: false });
    await run(shopDb, `UPDATE lookbook_print_jobs SET status = 'failed', error = ?, updated_at = datetime('now') WHERE id = ?`, (body.error || "render failed").slice(0, 500), jobId);
    return c.json({ ok: true });
  }

  // Rendered — submit to Lulu (drop-ships each copy), then capture on success.
  if (!luluConfigured(c.env)) {
    // PDFs are ready but fulfilment isn't configured: release the hold, leave rendered.
    await settlePrintPayment(c.env, shopDb, job, { ok: false });
    await run(shopDb, `UPDATE lookbook_print_jobs SET status = 'rendered', error = 'Lulu not configured', updated_at = datetime('now') WHERE id = ?`, jobId);
    return c.json({ ok: true, note: "lulu not configured" });
  }
  try {
    const result = await submitPrintJobToLulu(c.env, shopId, jobId);
    if (result.submitted === 0) {
      await settlePrintPayment(c.env, shopDb, job, { ok: false });
      await run(shopDb, `UPDATE lookbook_print_jobs SET status = 'failed', error = 'all recipients failed at Lulu', updated_at = datetime('now') WHERE id = ?`, jobId);
      return c.json({ ok: true });
    }
    const retail = applyMarkup(result.wholesaleCents, luluMarkup(c.env));
    await settlePrintPayment(c.env, shopDb, { ...job }, { ok: true, captureCents: retail });
    await run(
      shopDb,
      `UPDATE lookbook_print_jobs SET status = 'submitted', wholesale_cents = ?, error = ?, updated_at = datetime('now') WHERE id = ?`,
      result.wholesaleCents,
      result.failed ? `${result.failed} recipient(s) failed` : null,
      jobId,
    );
    return c.json({ ok: true, submitted: result.submitted, failed: result.failed });
  } catch (err) {
    await settlePrintPayment(c.env, shopDb, job, { ok: false });
    await run(shopDb, `UPDATE lookbook_print_jobs SET status = 'failed', error = ?, updated_at = datetime('now') WHERE id = ?`, String(err).slice(0, 500), jobId);
    return c.json({ ok: true });
  }
});

// ---- Pattern drape renders (Blender ghost-mannequin sims) ------------------
// Same trust model as the video callbacks: authenticated by the shared
// secret, shop addressed in the path. The Action posts one grey PNG per job;
// job state lives in KV (the Worker's drape routes poll it).

const DRAPE_TTL = 60 * 60 * 24;

renderCallbackRoutes.post("/drape/:shopId/:jobId/complete", async (c) => {
  const form = await c.req.parseBody();
  if (!renderSecretOk(c.env, (form.secret as string) || c.req.header("x-render-secret"))) {
    return c.json({ error: "unauthorized" }, 401);
  }
  const shopId = c.req.param("shopId");
  const jobId = c.req.param("jobId");
  const kvKey = `drape:${shopId}:${jobId}`;
  const existing = await c.env.KV.get(kvKey);
  if (!existing) return c.json({ error: "job not found" }, 404);

  const image = form.image as unknown as File | undefined;
  if (!image || typeof image.arrayBuffer !== "function") return c.json({ error: "missing image" }, 400);

  const key = `${shopId}/drape/${jobId}.png`;
  await c.env.FILES.put(key, await image.arrayBuffer(), { httpMetadata: { contentType: "image/png" } });
  const fileId = newId("file");
  await run(
    db(c.env, shopId),
    `INSERT INTO files (id, r2_key, filename, content_type, entity_type, entity_id, is_public, uploaded_by)
     VALUES (?, ?, ?, 'image/png', 'general', ?, 1, NULL)`,
    fileId,
    key,
    `${jobId}-drape.png`,
    jobId,
  );
  // Optional second render: the strain fit map (green = comfortable,
  // red = tight vs the flat pattern). Older workflow runs won't send it.
  let fitFileId: string | null = null;
  const fit = form.fit as unknown as File | undefined;
  if (fit && typeof fit.arrayBuffer === "function") {
    const fitKey = `${shopId}/drape/${jobId}-fit.png`;
    await c.env.FILES.put(fitKey, await fit.arrayBuffer(), { httpMetadata: { contentType: "image/png" } });
    fitFileId = newId("file");
    await run(
      db(c.env, shopId),
      `INSERT INTO files (id, r2_key, filename, content_type, entity_type, entity_id, is_public, uploaded_by)
       VALUES (?, ?, ?, 'image/png', 'general', ?, 1, NULL)`,
      fitFileId,
      fitKey,
      `${jobId}-fit.png`,
      jobId,
    );
  }
  // Optional third render: the Laplace pressure map (kPa where the garment
  // presses — tension x body curvature at the contact).
  let pressureFileId: string | null = null;
  const pressure = form.pressure as unknown as File | undefined;
  if (pressure && typeof pressure.arrayBuffer === "function") {
    const pressKey = `${shopId}/drape/${jobId}-pressure.png`;
    await c.env.FILES.put(pressKey, await pressure.arrayBuffer(), { httpMetadata: { contentType: "image/png" } });
    pressureFileId = newId("file");
    await run(
      db(c.env, shopId),
      `INSERT INTO files (id, r2_key, filename, content_type, entity_type, entity_id, is_public, uploaded_by)
       VALUES (?, ?, ?, 'image/png', 'general', ?, 1, NULL)`,
      pressureFileId,
      pressKey,
      `${jobId}-pressure.png`,
      jobId,
    );
  }
  await c.env.KV.put(
    kvKey,
    JSON.stringify({ ...(JSON.parse(existing) as object), status: "done", fileId, fitFileId, pressureFileId }),
    { expirationTtl: DRAPE_TTL },
  );
  return c.json({ ok: true, fileId, fitFileId, pressureFileId });
});

renderCallbackRoutes.post("/drape/:shopId/:jobId/fail", async (c) => {
  if (!secretOk(c)) return c.json({ error: "unauthorized" }, 401);
  const body = (await c.req.json().catch(() => ({}))) as { error?: string };
  const kvKey = `drape:${c.req.param("shopId")}:${c.req.param("jobId")}`;
  const existing = await c.env.KV.get(kvKey);
  if (!existing) return c.json({ error: "job not found" }, 404);
  await c.env.KV.put(
    kvKey,
    JSON.stringify({
      ...(JSON.parse(existing) as object),
      status: "failed",
      error: (body.error || "render failed").slice(0, 300),
    }),
    { expirationTtl: DRAPE_TTL },
  );
  return c.json({ ok: true });
});
