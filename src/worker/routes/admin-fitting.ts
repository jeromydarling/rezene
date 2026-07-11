import { Hono } from "hono";
import { all, first, run, writeAudit } from "../services/db";
import { requireAdminWrite } from "../middleware/auth";
import { newId } from "../utils/id";
import { GARMENT_LIBRARY, SIZE_STEPS } from "../../shared/garments";
import { FABRIC_LIBRARY } from "../../shared/fabrics";
import { fittingModel, fittingSetting, HOUSE_STYLE, BASE_MODEL_OUTFIT } from "../../shared/fitting-models";
import { ROSTER, rosterModel } from "../../shared/fitting-roster";
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
import { reserveFittingQuota, fittingQuotaExceededBody, peekFittingQuota } from "../services/ai-quota";
import { renderConfigured } from "../services/video-render";
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
  client_id?: string | null;
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
    clientId: r.client_id ?? null,
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
    clientId?: string | null;
  };
  const garment = GARMENT_LIBRARY.find((g) => g.id === body.garmentId);
  if (!garment) return c.json({ error: "Unknown garment" }, 400);
  const name = (body.name || "").trim() || `${garment.name} look`;
  const id = newId("look");
  await run(
    c.var.db,
    `INSERT INTO fitting_looks (id, name, garment_id, fabric_id, color, fit_json, style_id, client_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    name.slice(0, 120),
    garment.id,
    (body.fabricId || garment.defaultFabric).slice(0, 60),
    typeof body.color === "string" ? body.color.slice(0, 16) : null,
    JSON.stringify(body.fit ?? {}).slice(0, 2000),
    body.styleId || null,
    typeof body.clientId === "string" && body.clientId ? body.clientId : null,
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
  const body = (await c.req.json().catch(() => ({}))) as {
    prompt?: string;
    /** Optional block catalogue from the caller (the Pattern Studio sends its
     *  full FreeSewing picker), so the model chooses across every real block
     *  instead of the six stylized 3D silhouettes. Every id is re-validated
     *  against this same list before it's returned. */
    blocks?: { id?: string; name?: string; group?: string }[];
  };
  const prompt = (body.prompt || "").trim();
  if (!prompt) return c.json({ error: "Describe the garment you want." }, 400);

  const blocks = (Array.isArray(body.blocks) ? body.blocks : [])
    .filter((b) => typeof b.id === "string" && /^[a-z][a-z-]{1,39}$/.test(b.id) && typeof b.name === "string")
    .slice(0, 80)
    .map((b) => ({ id: b.id as string, name: (b.name as string).slice(0, 60), group: (b.group ?? "").slice(0, 40) }));

  const garments = blocks.length
    ? blocks.map((b) => `${b.id} (${b.name}${b.group ? `, ${b.group}` : ""})`).join("; ")
    : GARMENT_LIBRARY.map((g) => `${g.id} (${g.name}, ${g.category})`).join("; ");
  const garmentIds = blocks.length ? blocks.map((b) => b.id) : GARMENT_LIBRARY.map((g) => g.id);
  const fabrics = FABRIC_LIBRARY.map((f) => `${f.id} (${f.name})`).join("; ");
  const system =
    `You translate a plain-language garment description into a structured design spec for a stylized fitting studio. ` +
    `Pick the closest base garment and set its proportions using ONLY the given options. ` +
    `Respond with ONLY JSON: {"garmentId": one of [${garmentIds.join(", ")}], ` +
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

    const garmentId = garmentIds.includes(p.garmentId as string) ? (p.garmentId as string) : garmentIds[0];
    const size = (SIZE_STEPS as readonly string[]).includes(p.size as string) ? (p.size as string) : "M";
    const clamp = (n: unknown, lo: number, hi: number, d: number) => {
      const v = Number(n);
      return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;
    };
    const defaultFabric = GARMENT_LIBRARY.find((x) => x.id === garmentId)?.defaultFabric ?? FABRIC_LIBRARY[0].id;
    const fabricId = FABRIC_LIBRARY.find((f) => f.id === p.fabricId)?.id ?? defaultFabric;
    const color =
      typeof p.color === "string" && /^#[0-9a-fA-F]{6}$/.test(p.color) ? p.color : undefined;

    return c.json({
      garmentId,
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
 * Pattern assistant: plain language → the selected block's NATIVE drafting
 * options. The client sends the block's introspected option catalogue (names,
 * types, ranges, choices), so the model can only pick from what the design
 * actually defines — and the client re-validates every value on receipt. AI as
 * concierge: the result lands on the visible manual controls.
 */
adminFittingRoutes.post("/pattern-assist", requireAdminWrite, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    prompt?: string;
    block?: { id?: string; name?: string };
    options?: { key: string; type: string; min?: number; max?: number; choices?: string[] }[];
  };
  const prompt = (body.prompt || "").trim().slice(0, 500);
  const blockName = (body.block?.name || "garment").slice(0, 60);
  const options = (body.options ?? []).slice(0, 150);
  if (!prompt) return c.json({ error: "Describe what you want first." }, 400);
  if (options.length === 0) return c.json({ error: "No drafting options provided." }, 400);

  const catalogue = options
    .map((o) => {
      if (o.type === "list") return `${o.key} (choice: ${(o.choices ?? []).join("|")})`;
      if (o.type === "bool") return `${o.key} (true/false)`;
      return `${o.key} (${o.type}, ${o.min ?? 0}..${o.max ?? 100})`;
    })
    .join("; ");
  const system =
    `You configure a parametric sewing pattern (a ${blockName}) by choosing values for its drafting options. ` +
    `Only use option names from the catalogue, only values of the right type and within range — percent options ` +
    `are plain numbers (e.g. 12 for 12%). Change ONLY what the request calls for; leave everything else out. ` +
    `Respond with ONLY JSON: {"options": {"<optionName>": value, ...}, "rationale": "one short sentence"}. ` +
    `Catalogue: ${catalogue}.`;
  try {
    const { aiComplete } = await import("../services/ai");
    const { parseModelJson } = await import("../services/anthropic");
    const out = await aiComplete(c.env, { system, prompt, maxTokens: 700 });
    const parsed = (parseModelJson(out.text) ?? {}) as { options?: Record<string, unknown>; rationale?: string };
    if (!parsed.options || typeof parsed.options !== "object") {
      return c.json({ error: "Couldn't interpret that — try describing it differently." }, 502);
    }
    return c.json({
      options: parsed.options,
      rationale: typeof parsed.rationale === "string" ? parsed.rationale.slice(0, 240) : "",
    });
  } catch {
    return c.json({ error: "The assistant is unavailable right now — the manual controls do everything it does." }, 502);
  }
});

/**
 * Plain-language guidance for the drafted pattern — what each piece is, how to
 * cut, what to watch for. For the shop whose seamstress is learning.
 */
adminFittingRoutes.post("/pattern-explain", requireAdminWrite, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { block?: string; summary?: string };
  const block = (body.block || "garment").slice(0, 60);
  const summary = (body.summary || "").slice(0, 600);
  try {
    const { aiComplete } = await import("../services/ai");
    const out = await aiComplete(c.env, {
      system:
        "You are a patient sewing teacher. Given a garment pattern and its settings, write a short, practical " +
        "guide for someone about to cut and sew it: the pattern pieces they'll see and what each is, how many of " +
        "each to cut (note 'cut on fold' and 'cut 2' conventions), grain-line and seam-allowance reminders, and " +
        "2-3 things beginners get wrong on this garment type. Plain warm language, short bullet lines, no preamble.",
      prompt: `The pattern: a ${block}. Settings: ${summary || "standard"}.`,
      maxTokens: 700,
    });
    return c.json({ text: out.text.slice(0, 4000) });
  } catch {
    return c.json({ error: "Guidance is unavailable right now." }, 502);
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
  style_id: string | null;
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

// Today's render budget — read-only, so the UI can show "N renders left".
adminFittingRoutes.get("/quota", async (c) => {
  const q = await peekFittingQuota(c);
  return c.json({ used: q.used, limit: q.limit, remaining: Math.max(0, q.limit - q.used) });
});

// The shared platform model roster — a curated, diverse cast every shop can try
// garments onto. Images ship as static assets at /roster/<id>.jpg.
adminFittingRoutes.get("/roster", (c) =>
  c.json(
    ROSTER.map((m) => ({ id: m.id, name: m.name, gender: m.gender, build: m.build, url: `/roster/${m.id}.jpg` })),
  ),
);

/**
 * Garment sources from the Design Studio — the connection between the two:
 * every image a shop generated in the Design Studio is a garment they can pull
 * straight into the Fitting Room and try on a model. Returns favourites first.
 */
adminFittingRoutes.get("/garment-sources", async (c) => {
  try {
    const rows = await all<{ file_id: string; concept_name: string | null; prompt_text: string | null }>(
      c.var.db,
      `SELECT g.file_id, c.title AS concept_name, g.prompt_text
         FROM ai_generations g
         JOIN ai_concepts c ON c.id = g.concept_id
        WHERE g.output_kind = 'image' AND g.file_id IS NOT NULL
        ORDER BY g.is_favorite DESC, g.created_at DESC
        LIMIT 48`,
    );
    return c.json(
      rows.map((r) => ({
        id: r.file_id,
        url: `/media/${r.file_id}`,
        label: r.concept_name || "Design",
        prompt: r.prompt_text,
      })),
    );
  } catch {
    return c.json([]);
  }
});

/** Load a stored file (garment photo, model photo, mood-board ref) as an ImageInput.
 *  Carries the raw bytes AND a public /media URL — providers that inline bytes
 *  (fal) use the former; providers that fetch a URL (Higgsfield) use the latter. */
async function imageInputFromFile(c: Context<AppContext>, fileId: string): Promise<ImageInput | null> {
  const f = await first<{ r2_key: string; content_type: string | null; is_public: number }>(
    c.var.db,
    `SELECT r2_key, content_type, is_public FROM files WHERE id = ?`,
    fileId,
  );
  if (!f) return null;
  const obj = await c.env.FILES.get(f.r2_key);
  if (!obj) return null;
  return {
    kind: "bytes",
    bytes: new Uint8Array(await obj.arrayBuffer()),
    contentType: f.content_type || "image/jpeg",
    url: f.is_public ? publicMediaUrl(c, fileId) : undefined,
  };
}

/** Absolute, externally-fetchable URL for a public file, addressed to the shop. */
function publicMediaUrl(c: Context<AppContext>, fileId: string): string | undefined {
  const base = (c.env.APP_URL || "").replace(/\/$/, "");
  if (!base) return undefined;
  const slug = c.var.shopSlug;
  return slug ? `${base}/${slug}/media/${fileId}` : `${base}/media/${fileId}`;
}

/** Persist a produced image (R2 + files + fitting_renders) and return the render. */
async function storeRender(
  c: Context<AppContext>,
  result: ImageResult,
  meta: {
    kind: "generate" | "tryon" | "refit" | "colorway";
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
  console.error("[fitting] render failed:", err instanceof Error ? `${err.name}: ${err.message}` : err);
  if (err instanceof NoProviderError) return c.json({ error: err.message, code: "not_configured" }, 501);
  if (err instanceof ProviderError) return c.json({ error: err.message }, err.status >= 400 ? (err.status as 502) : 502);
  // Untyped errors carry the only clue there is — surface it rather than a blind
  // "try again" (this is the shop's own admin tool; the detail is theirs to see).
  const detail = err instanceof Error && err.message ? ` (${err.message.slice(0, 200)})` : "";
  return c.json({ error: `Render failed${detail} — try again.` }, 502);
}

/** Persist the produced image, but never let a SAVE failure read as a render
 *  failure — the distinction is the whole diagnosis. */
async function storeRenderOrFail(
  c: Context<AppContext>,
  result: ImageResult,
  meta: Parameters<typeof storeRender>[2],
) {
  try {
    return { ok: true as const, render: await storeRender(c, result, meta) };
  } catch (err) {
    console.error("[fitting] render SAVED FAILED (image was produced):", err instanceof Error ? `${err.name}: ${err.message}` : err);
    const detail = err instanceof Error && err.message ? ` (${err.message.slice(0, 200)})` : "";
    return {
      ok: false as const,
      response: c.json({ error: `The image rendered, but saving it to your library failed${detail} — try again.` }, 500),
    };
  }
}

/**
 * Generate a garment ON A MODEL from words (+ optional mood-board references).
 * Free-text description wins; else we compose a phrase from the picked garment.
 * With reference images it becomes "make a garment in the style of these".
 */
/** Turn the numeric fit config (the same ease/length/sleeve the 3D preview and
 *  sewing pattern use) into fashion language the image model acts on. */
function fitClause(fit?: { ease?: number; length?: number; sleeve?: number }): string {
  if (!fit) return "";
  const parts: string[] = [];
  const ease = Number(fit.ease);
  if (Number.isFinite(ease)) {
    if (ease <= 0.88) parts.push("a slim, tailored fit close to the body");
    else if (ease <= 1.1) parts.push("a regular, true-to-size fit");
    else if (ease <= 1.3) parts.push("a relaxed fit with visible ease through the body");
    else parts.push("an oversized, boxy fit with generous volume");
  }
  const len = Number(fit.length);
  if (Number.isFinite(len)) {
    if (len <= 0.92) parts.push("a cropped length");
    else if (len >= 1.08) parts.push("a longer-line hem");
  }
  const sleeve = Number(fit.sleeve);
  if (Number.isFinite(sleeve)) {
    if (sleeve <= 0.05) parts.push("no sleeves");
    else if (sleeve <= 0.55) parts.push("short sleeves");
    else if (sleeve <= 0.85) parts.push("three-quarter sleeves");
    else if (sleeve >= 1.15) parts.push("extra-long sleeves");
  }
  return parts.length ? `, cut with ${parts.join(", ")}` : "";
}

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
    /** How the references should be read: mood-board styling (default), a
     *  flat sewing-pattern sheet whose pieces define the garment's true
     *  proportions, or a 3D cloth-simulation drape of the exact garment
     *  (both Pattern Studio bridges). */
    referenceRole?: "mood" | "pattern" | "drape";
    fit?: { ease?: number; length?: number; sleeve?: number };
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
  const refClause =
    refIds.length === 0
      ? ""
      : body.referenceRole === "drape"
        ? ", matching EXACTLY the garment in the reference image — the reference is a 3D cloth simulation of " +
          "THIS garment draped on a dark charcoal mannequin: the LIGHT PALE muslin-toned fabric is the garment, the dark " +
          "form underneath is the mannequin's body and is NOT clothing; any thin black horizontal rings on the " +
          "mannequin are the dress form's fitting tape, never a belt, strap or trim. Copy the light garment's proportions " +
          "precisely — the hem ends exactly where the pale cloth ends on the torso, each sleeve ends exactly " +
          "where the pale cloth ends on the arm, and the width and ease match the pale cloth. Render it as " +
          "real sewn fabric on a real person: the pale colour, faceted surface and any small gaps at the " +
          "seams are simulation artifacts; the neckline is a clean, evenly-finished neck opening — any " +
          "notch, tear or raggedness at the neck edge in the reference is an artifact, never a design " +
          "detail; the shoulders are soft and unstructured — any pointiness, puffiness or padded look at " +
          "the shoulders in the reference is an artifact too; and the sleeves hang smooth — any horizontal " +
          "rings, ruching or accordion folds along the sleeves or legs in the reference are artifacts, not " +
          "a gathered design; fine regular vertical fluting on a skirt is the simulator's stiffness, not " +
          "pleating — real cloth falls in fewer, softer folds; a dark line down the centre front is a CLOSED " +
          "seam or zip, not an opening — the garment is worn closed unless the description says otherwise; " +
          "and every edge (waist, hems, openings) is " +
          "cleanly finished. Fabric and " +
          "colour come from the description alone, no mannequin or dress form may appear, and add no " +
          "clothing items beyond those described"
        : body.referenceRole === "pattern"
        ? ", constructed exactly from the flat sewing-pattern pieces shown in the reference image — read the " +
          "pieces ONLY to infer the garment's true proportions (sleeve length relative to torso, hem width and " +
          "height, collar scale). The reference is a technical cutting diagram, NOT a print or texture: no " +
          "pattern paper, piece outlines, or markings may appear anywhere in the photograph, and the " +
          "reference's colours are meaningless — take the garment's fabric and colour from the description " +
          "alone, and add no clothing items beyond those described"
        : " in the style, silhouette, and mood of the reference images";
  // Lead with the shared HOUSE_STYLE so every generated look matches the roster's
  // lighting, camera, and posture; the setting only swaps the backdrop.
  const prompt =
    `${HOUSE_STYLE} The subject is ${model.descriptor} wearing ${garmentPhrase}${fitClause(body.fit)}${refClause}, ` +
    `the garment fitting naturally and draping realistically on the body. ${setting.descriptor}.`;

  const references: ImageInput[] = [];
  for (const fid of refIds) {
    const img = await imageInputFromFile(c, fid);
    if (img) references.push(img);
  }

  const quota = await reserveFittingQuota(c);
  if (!quota.ok) return c.json(fittingQuotaExceededBody(quota), 429);
  let result: ImageResult | undefined;
  try {
    [result] = await generateLook(c.env, { prompt, references, aspectRatio: "3:4", count: 1 });
    if (!result) throw new ProviderError("No image produced.");
  } catch (err) {
    return providerFail(c, err);
  }
  const stored = await storeRenderOrFail(c, result, {
    kind: "generate",
    garmentId: body.garmentId || null,
    modelId: model.id,
    settingId: setting.id,
    prompt,
    styleId: body.styleId || null,
  });
  return stored.ok ? c.json(stored.render, 201) : stored.response;
});

/** Try-on engines read lighting as fabric: a window shadow raking across a
 *  flat lay comes back as a two-tone garment. So by default we re-light the
 *  garment photo first (reference-conditioned edit — same garment, even studio
 *  light) and hand the try-on the cleaned version. */
const GARMENT_CLEAN_PROMPT =
  "Re-light this garment product photo: remove every cast shadow, light streak and lighting gradient " +
  "falling across the fabric, so the garment is evenly lit by soft diffuse studio light on a plain, " +
  "pale, seamless background. Keep the garment itself exactly as it is — same silhouette, same true " +
  "fabric colour everywhere (shadowed areas are the SAME colour as brightly lit areas), same texture, " +
  "buttons, stitching, pockets and proportions. Do not redesign, recolour, crop or add anything.";

/**
 * Real virtual try-on: composite a photo of an ACTUAL garment onto a model
 * photo. Both are stored files (garmentFileId + modelFileId — the model may be
 * an uploaded photo or one from the shop's model library).
 */
adminFittingRoutes.post("/tryon", requireAdminWrite, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    garmentFileId?: string;
    modelFileId?: string;
    modelRosterId?: string;
    category?: GarmentCategory;
    garmentId?: string | null;
    styleId?: string | null;
    cleanGarment?: boolean;
  };
  if (!body.garmentFileId || (!body.modelFileId && !body.modelRosterId)) {
    return c.json({ error: "A garment photo and a model are both required." }, 400);
  }
  const garmentImage = await imageInputFromFile(c, body.garmentFileId);
  // Model is either a shop file or a platform roster asset (served publicly).
  let modelImage: ImageInput | null = null;
  if (body.modelRosterId) {
    const rm = rosterModel(body.modelRosterId);
    if (rm) modelImage = { kind: "url", url: `${c.env.APP_URL.replace(/\/$/, "")}/roster/${rm.id}.jpg` };
  } else if (body.modelFileId) {
    modelImage = await imageInputFromFile(c, body.modelFileId);
  }
  if (!garmentImage || !modelImage) return c.json({ error: "Couldn't load the images." }, 404);

  const quota = await reserveFittingQuota(c);
  if (!quota.ok) return c.json(fittingQuotaExceededBody(quota), 429);

  // Re-light the garment photo (default on). Best-effort: if the clean-up
  // engine is missing or fails, the try-on still runs on the original photo.
  let garmentForTryOn = garmentImage;
  if (body.cleanGarment !== false) {
    try {
      const [cleaned] = await generateLook(c.env, {
        prompt: GARMENT_CLEAN_PROMPT,
        references: [garmentImage],
        count: 1,
      });
      if (cleaned) {
        garmentForTryOn = { kind: "bytes", bytes: cleaned.bytes, contentType: cleaned.contentType };
      }
    } catch (err) {
      console.error(
        "[fitting] garment re-light failed, trying on the original photo:",
        err instanceof Error ? err.message : err,
      );
    }
  }

  let result: ImageResult;
  try {
    result = await tryOnGarment(c.env, { garmentImage: garmentForTryOn, modelImage, category: body.category ?? "auto" });
  } catch (err) {
    return providerFail(c, err);
  }
  const stored = await storeRenderOrFail(c, result, {
    kind: "tryon",
    garmentId: body.garmentId || null,
    modelId: body.modelRosterId || null,
    styleId: body.styleId || null,
    garmentFileId: body.garmentFileId,
    modelFileId: body.modelFileId || null,
    prompt: "Virtual try-on",
  });
  return stored.ok ? c.json(stored.render, 201) : stored.response;
});

// ---- Refit: adjust the fit of a finished render ------------------------------

/** The quick-pick adjustments the UI offers. Server-side map so the model only
 *  ever sees vetted instructions (the free-text note rides alongside).
 *  Image editors act unreliably on relative words alone ("shorter" often
 *  regresses to the garment's canonical form), so every instruction pairs the
 *  comparison against the reference with an ABSOLUTE anatomical target. */
const REFIT_PRESETS: Record<string, string> = {
  tighter:
    "take the garment in so it fits visibly slimmer and closer to the body than in the reference photo, " +
    "with clearly less fabric volume through the chest, waist and sleeves",
  looser:
    "let the garment out so it is visibly roomier and more relaxed than in the reference photo, " +
    "with clearly more fabric volume and drape",
  cropped: "shorten the hem so it ends at the natural waist — visibly higher than in the reference photo",
  longer: "lengthen the hem so it falls below the hips — visibly lower than in the reference photo",
  "sleeves-shorter":
    "shorten the sleeves so they end distinctly HIGHER on the arm than in the reference photo " +
    "(a short sleeve ends up at mid-bicep; a long sleeve ends at or above the elbow)",
  "sleeves-longer":
    "lengthen the sleeves so they end distinctly LOWER on the arm than in the reference photo " +
    "(a short sleeve reaches past the elbow; a long sleeve reaches the wrist)",
  // Styling — how the garment is WORN. Same discipline: name the exact end
  // state and the landmark, never a relative nudge.
  tucked:
    "tuck the garment's entire hem inside the waistband all the way around — no hem fabric visible " +
    "below the waistband, with a slight natural blouse of fabric above it",
  "tuck-full":
    "tuck the garment's entire hem inside the waistband all the way around — no hem fabric visible " +
    "below the waistband, with a slight natural blouse of fabric above it",
  "tuck-french":
    "French tuck: tuck ONLY the front centre of the hem inside the waistband; the sides and back of the " +
    "hem hang loose outside the trousers, clearly visible below the waistline",
  untucked:
    "let the garment hang fully untucked over the waistband, the entire hem visible below the waistline",
  "sleeves-rolled":
    "roll the sleeves up: a long sleeve is rolled into a neat cuff sitting just below the elbow with the " +
    "forearm bare; a short sleeve gets one clean shallow fold ending at mid-bicep",
  "pants-cuffed":
    "cuff the trousers: fold each trouser hem up once in a clean cuff about four centimetres deep, ending " +
    "just above the ankle bone so the ankles are visible",
  "collar-open":
    "open the collar: the top one or two buttons at the neck are undone and the collar sits open and " +
    "relaxed; every button below stays fastened",
  "collar-buttoned":
    "button up: every button is fastened including the top button at the neck, the collar sitting closed " +
    "and neat",
  pressed:
    "press the garment: the fabric looks freshly steamed, with wrinkles and rumples smoothed away, while " +
    "every seam, drape line, proportion and colour stays exactly as in the reference",
  "complete-outfit":
    "complete the outfit with simple neutral basics: plain straight-leg mid-grey trousers and clean minimal " +
    "white sneakers (if the featured garment IS trousers or a skirt, instead add a plain fitted white crew-neck " +
    "t-shirt and white sneakers). The featured garment stays EXACTLY as it is; the added pieces are understated, " +
    "logo-free and quiet so the featured garment remains the clear focus",
};

/**
 * Take a finished render (generate or try-on) and adjust ONLY the fit —
 * tighter, looser, cropped, different sleeves, or a free-text tweak — keeping
 * the person, garment design, and scene identical. Each refit saves as a new
 * render, so the gallery becomes a comparable fit progression.
 */
adminFittingRoutes.post("/renders/:id/refit", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as { adjustments?: string[]; note?: string };
  const instructions = (body.adjustments ?? [])
    .map((a) => REFIT_PRESETS[a])
    .filter((x): x is string => Boolean(x));
  const note = (body.note || "").trim().slice(0, 300);
  if (note) instructions.push(note);
  if (instructions.length === 0) {
    return c.json({ error: "Pick at least one adjustment, or describe the change you want." }, 400);
  }

  const row = await first<RenderRow>(c.var.db, `SELECT * FROM fitting_renders WHERE id = ?`, id);
  if (!row) return c.json({ error: "Render not found" }, 404);
  const source = await imageInputFromFile(c, row.file_id);
  if (!source) return c.json({ error: "Couldn't load the render image." }, 404);

  const prompt =
    `The reference photo shows a garment's CURRENT fit. Recreate the exact same photograph with only the fit ` +
    `adjusted as follows: ${instructions.join("; ")}. The adjustment must be clearly visible in a side-by-side ` +
    `comparison with the reference. Everything else stays identical: the same person (face, hair, body, skin ` +
    `tone, pose), the same garment design (same collar, placket, buttons, pockets, cuff style), the same fabric ` +
    `colour and texture, the same background, framing and lighting. The fabric drapes naturally and ` +
    `realistically in the new fit. Change nothing except the requested fit adjustments.`;

  const quota = await reserveFittingQuota(c);
  if (!quota.ok) return c.json(fittingQuotaExceededBody(quota), 429);
  let result: ImageResult | undefined;
  try {
    [result] = await generateLook(c.env, { prompt, references: [source], count: 1 });
    if (!result) throw new ProviderError("No image produced.");
  } catch (err) {
    return providerFail(c, err);
  }
  const stored = await storeRenderOrFail(c, result, {
    kind: "refit",
    garmentId: row.garment_id,
    modelId: row.model_id,
    settingId: row.setting_id,
    styleId: row.style_id,
    prompt: `Refit: ${instructions.join("; ")}`,
  });
  return stored.ok ? c.json(stored.render, 201) : stored.response;
});

// ---- Model library: base model photos a shop tries garments onto ------------

interface ModelRow {
  id: string;
  file_id: string;
  label: string;
  preset_id: string | null;
  source: string;
  client_id?: string | null;
  created_at: string;
}
const mapModel = (r: ModelRow) => ({
  id: r.id,
  fileId: r.file_id,
  url: `/media/${r.file_id}`,
  label: r.label,
  presetId: r.preset_id,
  source: r.source,
  clientId: r.client_id ?? null,
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

  // Generate a clean full-body model from a preset, in the shared house style so
  // it matches the roster.
  const model = fittingModel(body.presetId);
  const prompt =
    `${HOUSE_STYLE} The subject is ${model.descriptor}, ${BASE_MODEL_OUTFIT}. ` +
    `Seamless light warm-grey studio background.`;

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

/** Recolour ONLY the garment; everything else is pinned to the reference. */
function colorwayPrompt(color: string): string {
  return (
    `Recolour the featured garment in this photograph to ${color}. The change affects ONLY the garment's ` +
    `fabric colour — every design detail (seams, buttons, stitching, texture, weave), the person (face, hair, ` +
    `body, pose), any other clothing, the background, framing and lighting stay exactly as in the reference. ` +
    `The new colour must read as a true, natural ${color} under the same lighting.`
  );
}

/**
 * Colorways: one click, the same look re-dyed in up to three named colours.
 * Line-planning in a contact sheet — each colorway is a normal render (and a
 * normal quota unit), generated in parallel so the sheet lands in one wait.
 */
adminFittingRoutes.post("/renders/:id/colorways", requireAdminWrite, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { colors?: string[] };
  const colors = (body.colors ?? [])
    .map((s) => String(s).trim().slice(0, 40))
    .filter(Boolean)
    .slice(0, 3);
  if (colors.length === 0) return c.json({ error: "Name at least one colour." }, 400);

  const row = await first<RenderRow>(c.var.db, `SELECT * FROM fitting_renders WHERE id = ?`, c.req.param("id"));
  if (!row) return c.json({ error: "Render not found" }, 404);
  const source = await imageInputFromFile(c, row.file_id);
  if (!source) return c.json({ error: "Couldn't load the render image." }, 404);

  // Reserve one quota unit per colorway up front; trim the batch if the day
  // runs out midway rather than failing the whole sheet.
  let allowed = 0;
  let quotaFail: Awaited<ReturnType<typeof reserveFittingQuota>> | null = null;
  for (let i = 0; i < colors.length; i++) {
    const q = await reserveFittingQuota(c);
    if (!q.ok) {
      quotaFail = q;
      break;
    }
    allowed++;
  }
  if (allowed === 0 && quotaFail) return c.json(fittingQuotaExceededBody(quotaFail), 429);
  const batch = colors.slice(0, allowed);

  const results = await Promise.all(
    batch.map(async (color) => {
      try {
        const [img] = await generateLook(c.env, { prompt: colorwayPrompt(color), references: [source], count: 1 });
        if (!img) return null;
        return await storeRender(c, img, {
          kind: "colorway",
          garmentId: row.garment_id,
          modelId: row.model_id,
          settingId: row.setting_id,
          styleId: row.style_id,
          prompt: `Colorway: ${color}`,
        });
      } catch (err) {
        console.error(`[fitting] colorway "${color}" failed:`, err instanceof Error ? err.message : err);
        return null;
      }
    }),
  );
  const made = results.filter((r): r is NonNullable<typeof r> => Boolean(r));
  if (made.length === 0) return c.json({ error: "Couldn't produce any colorways — try again." }, 502);
  return c.json({ renders: made, requested: batch.length }, 201);
});

/**
 * A render exit: put a finished try-on/refit straight on the shop — as a
 * product photo or a lookbook image. Mirrors the Design Studio's "use" action
 * so fitting renders stop being a dead end.
 */
adminFittingRoutes.post("/renders/:id/use", requireAdminWrite, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    target?: "product" | "lookbook";
    productId?: string;
    lookbookId?: string;
  };
  const row = await first<{ file_id: string }>(
    c.var.db,
    `SELECT file_id FROM fitting_renders WHERE id = ?`,
    c.req.param("id"),
  );
  if (!row) return c.json({ error: "Render not found" }, 404);
  const url = `/media/${row.file_id}`;
  if (body.target === "product") {
    if (!body.productId) return c.json({ error: "Pick a product." }, 400);
    const next = await first<{ n: number }>(
      c.var.db,
      `SELECT COALESCE(MAX(sort_order),-1)+1 AS n FROM product_images WHERE product_id = ?`,
      body.productId,
    );
    await run(
      c.var.db,
      `INSERT INTO product_images (id, product_id, url, sort_order) VALUES (?, ?, ?, ?)`,
      newId("img"),
      body.productId,
      url,
      next?.n ?? 0,
    );
    return c.json({ ok: true, url });
  }
  if (body.target === "lookbook") {
    if (!body.lookbookId) return c.json({ error: "Pick a lookbook." }, 400);
    const next = await first<{ n: number }>(
      c.var.db,
      `SELECT COALESCE(MAX(sort_order),-1)+1 AS n FROM lookbook_images WHERE lookbook_id = ?`,
      body.lookbookId,
    );
    await run(
      c.var.db,
      `INSERT INTO lookbook_images (id, lookbook_id, image_url, sort_order) VALUES (?, ?, ?, ?)`,
      newId("lbi"),
      body.lookbookId,
      url,
      next?.n ?? 0,
    );
    return c.json({ ok: true, url });
  }
  return c.json({ error: "Pick where to use it." }, 400);
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

// ---- True-drape preview (beta) ---------------------------------------------
// A Pattern Studio draft becomes a physically-simulated grey drape render:
// the Worker dispatches a GitHub Actions job (FreeSewing draft → Blender
// cloth solver → callback), tracks it in KV, and the finished PNG feeds the
// photoreal generate as a `referenceRole: "drape"` reference. V1 covers the
// classic tee. Degrades cleanly when the render backend isn't configured.

const DRAPE_TTL = 60 * 60 * 24; // job records live a day

function drapeKey(shopId: string, jobId: string): string {
  return `drape:${shopId}:${jobId}`;
}

adminFittingRoutes.post("/drape", requireAdminWrite, async (c) => {
  if (!renderConfigured(c.env)) {
    return c.json(
      {
        error:
          "True-drape preview isn't switched on for this deployment yet — it needs the render " +
          "backend (GitHub dispatch token + callback secret). Everything else in the Pattern " +
          "Studio keeps working without it.",
      },
      503,
    );
  }
  const body = (await c.req.json().catch(() => ({}))) as {
    block?: string;
    easePct?: number;
    lengthPct?: number;
    sleevePct?: number;
    /** The draft's effective measurements (mm) so the sim sews the client's
     *  actual pattern and scales the ghost mannequin to their body. */
    measurementsMm?: Record<string, number>;
  };
  const DRAPE_BLOCKS = new Set([
    "classic-tee", "aaron", "relaxed-hoodie", "hugo", "simon", "simone",
    "slip-dress", "wahid", "wide-trouser", "pleated-skirt",
    "paco", "sandy", "bella", "huey", "yuri", "walburga", "charlie",
    "carlton", "carlita", "brian", "bent", "uma", "shin", "breanna", "noble",
    "cathrin",
  ]);
  const clamp = (v: unknown, lo: number, hi: number) =>
    Math.min(hi, Math.max(lo, Math.round(Number(v) || 0)));
  const measurements: Record<string, number> = {};
  for (const [k, v] of Object.entries(body.measurementsMm ?? {})) {
    const n = Number(v);
    if (/^[a-zA-Z]{2,40}$/.test(k) && Number.isFinite(n) && n >= 50 && n <= 2500) {
      measurements[k] = Math.round(n);
    }
    if (Object.keys(measurements).length >= 30) break;
  }
  const spec = {
    block: DRAPE_BLOCKS.has(body.block ?? "") ? body.block : "classic-tee",
    easePct: clamp(body.easePct, 0, 25),
    lengthPct: clamp(body.lengthPct, -15, 20),
    sleevePct: clamp(body.sleevePct, -30, 10),
    measurements,
  };

  const jobId = newId("drape");
  await c.env.KV.put(
    drapeKey(c.var.shopId, jobId),
    JSON.stringify({ status: "queued", spec, createdAt: new Date().toISOString() }),
    { expirationTtl: DRAPE_TTL },
  );

  const base = (c.env.APP_URL || "https://verto.style").replace(/\/$/, "");
  const res = await fetch(`https://api.github.com/repos/${c.env.RENDER_REPO}/dispatches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${c.env.GITHUB_DISPATCH_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "verto-render",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      event_type: "render_drape",
      client_payload: { shopId: c.var.shopId, jobId, spec, callbackBase: `${base}/api/render` },
    }),
  });
  if (res.status !== 204) {
    const detail = await res.text().catch(() => "");
    await c.env.KV.delete(drapeKey(c.var.shopId, jobId));
    return c.json({ error: `Couldn't start the drape render (GitHub ${res.status}). ${detail.slice(0, 150)}` }, 502);
  }
  await writeAudit(c.var.db, c.var.userId, "fitting_drape.start", "drape_job", jobId, spec);
  return c.json({ jobId, status: "queued" }, 202);
});

adminFittingRoutes.get("/drape/:jobId", async (c) => {
  const raw = await c.env.KV.get(drapeKey(c.var.shopId, c.req.param("jobId")));
  if (!raw) return c.json({ error: "Drape job not found (it may have expired)." }, 404);
  const job = JSON.parse(raw) as {
    status: string;
    fileId?: string;
    fitFileId?: string | null;
    pressureFileId?: string | null;
    error?: string;
  };
  return c.json({
    status: job.status,
    fileId: job.fileId,
    url: job.fileId ? `/media/${job.fileId}` : undefined,
    // Strain fit map (green = comfortable → red = tight vs the flat pattern).
    fitUrl: job.fitFileId ? `/media/${job.fitFileId}` : undefined,
    // Laplace pressure map (kPa where the garment presses on the body).
    pressureUrl: job.pressureFileId ? `/media/${job.pressureFileId}` : undefined,
    error: job.error,
  });
});
