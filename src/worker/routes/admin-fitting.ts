import { Hono } from "hono";
import { all, first, run, writeAudit } from "../services/db";
import { requireAdminWrite } from "../middleware/auth";
import { newId } from "../utils/id";
import { GARMENT_LIBRARY, SIZE_STEPS } from "../../shared/garments";
import { FABRIC_LIBRARY } from "../../shared/fabrics";
import { fittingModel, fittingSetting } from "../../shared/fitting-models";
import {
  fittingCapabilities,
  generateLook,
  tryOnGarment,
  NoProviderError,
  ProviderError,
  type GarmentCategory,
  type ImageInput,
  type ImageResult,
} from "../services/ai-image";
import { reserveFittingQuota, fittingQuotaExceededBody } from "../services/ai-quota";
import type { AppContext } from "../types/env";
import type { Context } from "hono";

/**
 * 3D Fitting Room — saved looks. A look is a base garment + fabric + colour +
 * fit config, optionally tied to a Style. The garment library itself ships in
 * the client (src/shared/garments.ts); this only persists a shop's saved
 * configurations. Per-shop DB (c.var.db).
 */
export const adminFittingRoutes = new Hono<AppContext>();

interface LookRow {
  id: string;
  name: string;
  garment_id: string;
  fabric_id: string;
  color: string | null;
  fit_json: string;
  style_id: string | null;
  style_name: string | null;
  created_at: string;
  updated_at: string;
}

function mapLook(r: LookRow) {
  let fit: unknown = {};
  try {
    fit = JSON.parse(r.fit_json || "{}");
  } catch {
    fit = {};
  }
  return {
    id: r.id,
    name: r.name,
    garmentId: r.garment_id,
    fabricId: r.fabric_id,
    color: r.color,
    fit,
    styleId: r.style_id,
    styleName: r.style_name,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const LOOK_SELECT = `
  SELECT l.*, s.name AS style_name FROM fitting_looks l
  LEFT JOIN styles s ON s.id = l.style_id`;

adminFittingRoutes.get("/looks", async (c) => {
  try {
    const rows = await all<LookRow>(c.var.db, `${LOOK_SELECT} ORDER BY l.updated_at DESC`);
    return c.json(rows.map(mapLook));
  } catch {
    // Table not migrated on this shop DB yet — no looks to show.
    return c.json([]);
  }
});

adminFittingRoutes.post("/looks", requireAdminWrite, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    name?: string;
    garmentId?: string;
    fabricId?: string;
    color?: string;
    fit?: unknown;
    styleId?: string | null;
  };
  const garment = GARMENT_LIBRARY.find((g) => g.id === body.garmentId);
  if (!garment) return c.json({ error: "Unknown garment" }, 400);
  const name = (body.name || "").trim() || `${garment.name} look`;
  const id = newId("look");
  await run(
    c.var.db,
    `INSERT INTO fitting_looks (id, name, garment_id, fabric_id, color, fit_json, style_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    id,
    name.slice(0, 120),
    garment.id,
    (body.fabricId || garment.defaultFabric).slice(0, 60),
    typeof body.color === "string" ? body.color.slice(0, 16) : null,
    JSON.stringify(body.fit ?? {}).slice(0, 2000),
    body.styleId || null,
  );
  const row = await first<LookRow>(c.var.db, `${LOOK_SELECT} WHERE l.id = ?`, id);
  return c.json(mapLook(row!), 201);
});

/**
 * Design → spec. A Design2GarmentCode-style loop on our own clean stack: the
 * LLM reads a plain-language description and answers a fixed, multiple-choice
 * design vocabulary (garment + proportions + fabric + colour). We validate and
 * clamp everything to known values, so the model can only ever pick from the
 * catalogue — never freehand invalid output. The client applies the spec to
 * both the 3D preview and the real FreeSewing pattern.
 */
adminFittingRoutes.post("/design", requireAdminWrite, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { prompt?: string };
  const prompt = (body.prompt || "").trim();
  if (!prompt) return c.json({ error: "Describe the garment you want." }, 400);

  const garments = GARMENT_LIBRARY.map((g) => `${g.id} (${g.name}, ${g.category})`).join("; ");
  const fabrics = FABRIC_LIBRARY.map((f) => `${f.id} (${f.name})`).join("; ");
  const system =
    `You translate a plain-language garment description into a structured design spec for a stylized fitting studio. ` +
    `Pick the closest base garment and set its proportions using ONLY the given options. ` +
    `Respond with ONLY JSON: {"garmentId": one of [${GARMENT_LIBRARY.map((g) => g.id).join(", ")}], ` +
    `"size": one of [XS,S,M,L,XL,XXL] (default M), ` +
    `"ease": number (0.82 slim, 1.0 regular, 1.18 relaxed, 1.42 oversized), ` +
    `"length": number 0.85-1.2 (1.0 standard, lower=cropped, higher=longer), ` +
    `"sleeve": number 0-1.3 (0 sleeveless, 0.5 short, 1.0 long; ignored if the garment has no sleeves), ` +
    `"fabricId": one of the fabric ids, "color": a hex colour like "#3b5b7a", ` +
    `"rationale": one short sentence explaining the choices}. ` +
    `Base garments: ${garments}. Fabrics: ${fabrics}.`;

  try {
    const { aiComplete } = await import("../services/ai");
    const { parseModelJson } = await import("../services/anthropic");
    const out = await aiComplete(c.env, { system, prompt, maxTokens: 500 });
    const p = (parseModelJson(out.text) ?? {}) as Record<string, unknown>;

    const g = GARMENT_LIBRARY.find((x) => x.id === p.garmentId) ?? GARMENT_LIBRARY[0];
    const size = (SIZE_STEPS as readonly string[]).includes(p.size as string) ? (p.size as string) : "M";
    const clamp = (n: unknown, lo: number, hi: number, d: number) => {
      const v = Number(n);
      return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;
    };
    const fabricId = FABRIC_LIBRARY.find((f) => f.id === p.fabricId)?.id ?? g.defaultFabric;
    const color =
      typeof p.color === "string" && /^#[0-9a-fA-F]{6}$/.test(p.color) ? p.color : undefined;

    return c.json({
      garmentId: g.id,
      fit: {
        size,
        ease: clamp(p.ease, 0.7, 1.5, 1.0),
        length: clamp(p.length, 0.8, 1.2, 1.0),
        sleeve: clamp(p.sleeve, 0, 1.3, 1.0),
      },
      fabricId,
      color,
      rationale: typeof p.rationale === "string" ? p.rationale.slice(0, 240) : "",
    });
  } catch {
    return c.json({ error: "Couldn't interpret that — try describing it a bit differently." }, 502);
  }
});

/**
 * AI Look Studio — render a garment ON A MODEL as a photoreal image. This is
 * the honest, easy path to "impressive garment on a body": image generation
 * (Cloudflare Workers AI, FLUX.2) beats a home-grown cloth simulation for
 * perceived realism, needs no external keys, and reuses the same R2 + files
 * plumbing as the Design Studio. We build a tightly-scoped fashion prompt from
 * the garment + fabric + colour + a chosen model/setting, generate, store the
 * public image, and persist the render so the gallery survives reloads.
 */
interface RenderRow {
  id: string;
  file_id: string;
  garment_id: string | null;
  model_id: string | null;
  setting_id: string | null;
  prompt: string | null;
  kind: string | null;
  provider: string | null;
  created_at: string;
}
function mapRender(r: RenderRow) {
  return {
    id: r.id,
    url: `/media/${r.file_id}`,
    garmentId: r.garment_id,
    modelId: r.model_id,
    settingId: r.setting_id,
    prompt: r.prompt,
    kind: r.kind ?? "generate",
    provider: r.provider,
    createdAt: r.created_at,
  };
}

adminFittingRoutes.get("/renders", async (c) => {
  try {
    const rows = await all<RenderRow>(c.var.db, `SELECT * FROM fitting_renders ORDER BY created_at DESC LIMIT 60`);
    return c.json(rows.map(mapRender));
  } catch {
    return c.json([]);
  }
});

// What the Fitting Room can do given the platform's configured keys.
adminFittingRoutes.get("/capabilities", (c) => c.json(fittingCapabilities(c.env)));

/** Load a stored file (garment photo, model photo, mood-board ref) as an ImageInput. */
async function imageInputFromFile(c: Context<AppContext>, fileId: string): Promise<ImageInput | null> {
  const f = await first<{ r2_key: string; content_type: string | null }>(
    c.var.db,
    `SELECT r2_key, content_type FROM files WHERE id = ?`,
    fileId,
  );
  if (!f) return null;
  const obj = await c.env.FILES.get(f.r2_key);
  if (!obj) return null;
  return { kind: "bytes", bytes: new Uint8Array(await obj.arrayBuffer()), contentType: f.content_type || "image/jpeg" };
}

/** Persist a produced image (R2 + files + fitting_renders) and return the render. */
async function storeRender(
  c: Context<AppContext>,
  result: ImageResult,
  meta: {
    kind: "generate" | "tryon";
    garmentId?: string | null;
    modelId?: string | null;
    settingId?: string | null;
    prompt?: string | null;
    styleId?: string | null;
    garmentFileId?: string | null;
    modelFileId?: string | null;
  },
) {
  const ext = result.contentType.includes("png") ? "png" : "jpg";
  const fileId = newId("file");
  const key = `uploads/fitting/${meta.garmentId || meta.kind}/${fileId}.${ext}`;
  await c.env.FILES.put(key, result.bytes, { httpMetadata: { contentType: result.contentType } });
  await run(
    c.var.db,
    `INSERT INTO files (id, r2_key, filename, content_type, size_bytes, entity_type, entity_id, is_public, uploaded_by)
     VALUES (?, ?, ?, ?, ?, 'fitting_render', ?, 1, ?)`,
    fileId,
    key,
    `${meta.garmentId || meta.kind}.${ext}`,
    result.contentType,
    result.bytes.length,
    meta.garmentId || meta.kind,
    c.var.userId,
  );
  const id = newId("render");
  await run(
    c.var.db,
    `INSERT INTO fitting_renders
       (id, file_id, garment_id, model_id, setting_id, prompt, style_id, kind, garment_file_id, model_file_id, provider)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    fileId,
    meta.garmentId ?? null,
    meta.modelId ?? null,
    meta.settingId ?? null,
    (meta.prompt ?? "").slice(0, 1000),
    meta.styleId ?? null,
    meta.kind,
    meta.garmentFileId ?? null,
    meta.modelFileId ?? null,
    result.providerModel,
  );
  const row = await first<RenderRow>(c.var.db, `SELECT * FROM fitting_renders WHERE id = ?`, id);
  return mapRender(row!);
}

function providerFail(c: Context<AppContext>, err: unknown) {
  if (err instanceof NoProviderError) return c.json({ error: err.message, code: "not_configured" }, 501);
  if (err instanceof ProviderError) return c.json({ error: err.message }, err.status >= 400 ? (err.status as 502) : 502);
  return c.json({ error: "Render failed — try again." }, 502);
}

/**
 * Generate a garment ON A MODEL from words (+ optional mood-board references).
 * Free-text description wins; else we compose a phrase from the picked garment.
 * With reference images it becomes "make a garment in the style of these".
 */
adminFittingRoutes.post("/generate", requireAdminWrite, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    garmentId?: string;
    fabricId?: string;
    colorName?: string;
    description?: string;
    modelId?: string;
    settingId?: string;
    styleId?: string | null;
    referenceFileIds?: string[];
  };
  const garment = GARMENT_LIBRARY.find((g) => g.id === body.garmentId);
  const fabric = FABRIC_LIBRARY.find((f) => f.id === body.fabricId);
  const model = fittingModel(body.modelId);
  const setting = fittingSetting(body.settingId);

  const desc = (body.description || "").trim();
  const colorName = (body.colorName || "").trim().slice(0, 40);
  const refIds = (body.referenceFileIds ?? []).slice(0, 6);
  let garmentPhrase = desc;
  if (!garmentPhrase) {
    if (!garment) return c.json({ error: "Pick a garment or describe one." }, 400);
    const parts = [colorName, garment.name.toLowerCase()].filter(Boolean).join(" ");
    garmentPhrase = fabric ? `${parts} in ${fabric.name.toLowerCase()}` : parts;
  }
  const refClause = refIds.length ? " in the style, silhouette, and mood of the reference images" : "";
  const prompt =
    `Full-body studio fashion photograph of ${model.descriptor} wearing ${garmentPhrase}${refClause}. ` +
    `${setting.descriptor}. Standing facing the camera in a natural relaxed pose, ` +
    `full body visible from head to feet, photorealistic, sharp focus, flattering, centered composition, ` +
    `the garment fitting naturally and draping realistically on the body.`;

  const references: ImageInput[] = [];
  for (const fid of refIds) {
    const img = await imageInputFromFile(c, fid);
    if (img) references.push(img);
  }

  const quota = await reserveFittingQuota(c);
  if (!quota.ok) return c.json(fittingQuotaExceededBody(quota), 429);
  try {
    const [result] = await generateLook(c.env, { prompt, references, aspectRatio: "3:4", count: 1 });
    if (!result) throw new ProviderError("No image produced.");
    const render = await storeRender(c, result, {
      kind: "generate",
      garmentId: body.garmentId || null,
      modelId: model.id,
      settingId: setting.id,
      prompt,
      styleId: body.styleId || null,
    });
    return c.json(render, 201);
  } catch (err) {
    return providerFail(c, err);
  }
});

/**
 * Real virtual try-on: composite a photo of an ACTUAL garment onto a model
 * photo. Both are stored files (garmentFileId + modelFileId — the model may be
 * an uploaded photo or one from the shop's model library).
 */
adminFittingRoutes.post("/tryon", requireAdminWrite, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    garmentFileId?: string;
    modelFileId?: string;
    category?: GarmentCategory;
    garmentId?: string | null;
    styleId?: string | null;
  };
  if (!body.garmentFileId || !body.modelFileId) {
    return c.json({ error: "A garment photo and a model are both required." }, 400);
  }
  const garmentImage = await imageInputFromFile(c, body.garmentFileId);
  const modelImage = await imageInputFromFile(c, body.modelFileId);
  if (!garmentImage || !modelImage) return c.json({ error: "Couldn't load the images." }, 404);

  const quota = await reserveFittingQuota(c);
  if (!quota.ok) return c.json(fittingQuotaExceededBody(quota), 429);
  try {
    const result = await tryOnGarment(c.env, { garmentImage, modelImage, category: body.category ?? "auto" });
    const render = await storeRender(c, result, {
      kind: "tryon",
      garmentId: body.garmentId || null,
      styleId: body.styleId || null,
      garmentFileId: body.garmentFileId,
      modelFileId: body.modelFileId,
      prompt: "Virtual try-on",
    });
    return c.json(render, 201);
  } catch (err) {
    return providerFail(c, err);
  }
});

// ---- Model library: base model photos a shop tries garments onto ------------

interface ModelRow {
  id: string;
  file_id: string;
  label: string;
  preset_id: string | null;
  source: string;
  created_at: string;
}
const mapModel = (r: ModelRow) => ({
  id: r.id,
  fileId: r.file_id,
  url: `/media/${r.file_id}`,
  label: r.label,
  presetId: r.preset_id,
  source: r.source,
  createdAt: r.created_at,
});

adminFittingRoutes.get("/models", async (c) => {
  try {
    const rows = await all<ModelRow>(c.var.db, `SELECT * FROM fitting_models ORDER BY created_at DESC`);
    return c.json(rows.map(mapModel));
  } catch {
    return c.json([]);
  }
});

/**
 * Add a base model. Either generate one from a body preset + setting, or adopt
 * an already-uploaded photo (fileId) as a model.
 */
adminFittingRoutes.post("/models", requireAdminWrite, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    presetId?: string;
    settingId?: string;
    fileId?: string;
    label?: string;
  };

  // Adopt an uploaded photo as a model — no generation, no quota.
  if (body.fileId) {
    const f = await first<{ id: string }>(c.var.db, `SELECT id FROM files WHERE id = ?`, body.fileId);
    if (!f) return c.json({ error: "Uploaded file not found." }, 404);
    const id = newId("fmodel");
    await run(
      c.var.db,
      `INSERT INTO fitting_models (id, file_id, label, preset_id, source) VALUES (?, ?, ?, ?, 'uploaded')`,
      id,
      body.fileId,
      (body.label || "My model").slice(0, 80),
      null,
    );
    const row = await first<ModelRow>(c.var.db, `SELECT * FROM fitting_models WHERE id = ?`, id);
    return c.json(mapModel(row!), 201);
  }

  // Generate a clean full-body model from a preset.
  const model = fittingModel(body.presetId);
  const setting = fittingSetting(body.settingId);
  const prompt =
    `Full-body studio fashion photograph of ${model.descriptor}, wearing plain simple fitted neutral clothing ` +
    `(a plain tank top and leggings), no logos. ${setting.descriptor}. Standing straight facing the camera, ` +
    `arms relaxed slightly away from the body, full body from head to feet, photorealistic, sharp focus, centered.`;

  const quota = await reserveFittingQuota(c);
  if (!quota.ok) return c.json(fittingQuotaExceededBody(quota), 429);
  try {
    const [result] = await generateLook(c.env, { prompt, aspectRatio: "3:4", count: 1 });
    if (!result) throw new ProviderError("No image produced.");
    const ext = result.contentType.includes("png") ? "png" : "jpg";
    const fileId = newId("file");
    const key = `uploads/fitting/models/${fileId}.${ext}`;
    await c.env.FILES.put(key, result.bytes, { httpMetadata: { contentType: result.contentType } });
    await run(
      c.var.db,
      `INSERT INTO files (id, r2_key, filename, content_type, size_bytes, entity_type, entity_id, is_public, uploaded_by)
       VALUES (?, ?, ?, ?, ?, 'fitting_model', ?, 1, ?)`,
      fileId,
      key,
      `model-${model.id}.${ext}`,
      result.contentType,
      result.bytes.length,
      model.id,
      c.var.userId,
    );
    const id = newId("fmodel");
    await run(
      c.var.db,
      `INSERT INTO fitting_models (id, file_id, label, preset_id, source) VALUES (?, ?, ?, ?, 'generated')`,
      id,
      fileId,
      (body.label || model.label).slice(0, 80),
      model.id,
    );
    const row = await first<ModelRow>(c.var.db, `SELECT * FROM fitting_models WHERE id = ?`, id);
    return c.json(mapModel(row!), 201);
  } catch (err) {
    return providerFail(c, err);
  }
});

adminFittingRoutes.delete("/models/:id", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  const row = await first<{ file_id: string; source: string }>(
    c.var.db,
    `SELECT file_id, source FROM fitting_models WHERE id = ?`,
    id,
  );
  if (!row) return c.json({ error: "Model not found" }, 404);
  // Only delete the underlying file for models WE generated; uploaded photos may
  // be referenced elsewhere, so just detach them from the library.
  if (row.source === "generated") {
    const f = await first<{ r2_key: string }>(c.var.db, `SELECT r2_key FROM files WHERE id = ?`, row.file_id);
    if (f) await c.env.FILES.delete(f.r2_key).catch(() => {});
    await run(c.var.db, `DELETE FROM files WHERE id = ?`, row.file_id);
  }
  await run(c.var.db, `DELETE FROM fitting_models WHERE id = ?`, id);
  return c.json({ ok: true });
});

adminFittingRoutes.delete("/renders/:id", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  const row = await first<{ file_id: string }>(c.var.db, `SELECT file_id FROM fitting_renders WHERE id = ?`, id);
  if (!row) return c.json({ error: "Render not found" }, 404);
  const f = await first<{ r2_key: string }>(c.var.db, `SELECT r2_key FROM files WHERE id = ?`, row.file_id);
  if (f) await c.env.FILES.delete(f.r2_key).catch(() => {});
  await run(c.var.db, `DELETE FROM files WHERE id = ?`, row.file_id);
  await run(c.var.db, `DELETE FROM fitting_renders WHERE id = ?`, id);
  await writeAudit(c.var.db, c.var.userId, "fitting_render.delete", "fitting_render", id, {});
  return c.json({ ok: true });
});

adminFittingRoutes.delete("/looks/:id", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  const result = await run(c.var.db, `DELETE FROM fitting_looks WHERE id = ?`, id);
  if (!result.meta.changes) return c.json({ error: "Look not found" }, 404);
  await writeAudit(c.var.db, c.var.userId, "fitting_look.delete", "fitting_look", id, {});
  return c.json({ ok: true });
});
