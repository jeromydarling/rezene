import { Hono } from "hono";
import { all, first, jsonArray, run, writeAudit } from "../services/db";
import {
  aiConceptCreateSchema,
  aiConceptUpdateSchema,
  aiPromptCreateSchema,
  parseBody,
} from "../services/validators";
import { requireAdminWrite } from "../middleware/auth";
import { newId } from "../utils/id";
import type { AppContext } from "../types/env";
import type { AdminAiConcept, AdminAiPrompt } from "../../shared/types";

export const adminAiRoutes = new Hono<AppContext>();

// ---------- Prompt library ----------
adminAiRoutes.get("/prompts", async (c) => {
  const rows = await all<Record<string, unknown>>(
    c.var.db,
    `SELECT * FROM ai_prompts ORDER BY is_preset DESC, category, name`,
  );
  const prompts: AdminAiPrompt[] = rows.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    category: r.category as string,
    targetTool: r.target_tool as string,
    promptText: r.prompt_text as string,
    version: r.version as number,
    isPreset: Boolean(r.is_preset),
    notes: (r.notes as string) ?? null,
  }));
  return c.json(prompts);
});

adminAiRoutes.post("/prompts", requireAdminWrite, async (c) => {
  const body = await parseBody(c, aiPromptCreateSchema);
  const id = newId("aip");
  await run(
    c.var.db,
    `INSERT INTO ai_prompts (id, name, category, target_tool, prompt_text, notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    id,
    body.name,
    body.category,
    body.targetTool ?? "claude",
    body.promptText,
    body.notes ?? null,
  );
  return c.json({ id }, 201);
});

/** Version a prompt: creates a new row pointing at its parent. */
adminAiRoutes.post("/prompts/:id/version", requireAdminWrite, async (c) => {
  const parentId = c.req.param("id");
  const body = await parseBody(c, aiPromptCreateSchema.pick({ promptText: true, notes: true }).partial({ notes: true }));
  const parent = await first<Record<string, unknown>>(
    c.var.db,
    `SELECT * FROM ai_prompts WHERE id = ?`,
    parentId,
  );
  if (!parent) return c.json({ error: "Prompt not found" }, 404);
  const id = newId("aip");
  await run(
    c.var.db,
    `INSERT INTO ai_prompts (id, name, category, target_tool, prompt_text, version, parent_prompt_id, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    parent.name,
    parent.category,
    parent.target_tool,
    body.promptText,
    (parent.version as number) + 1,
    parentId,
    body.notes ?? null,
  );
  return c.json({ id, version: (parent.version as number) + 1 }, 201);
});

// ---------- Concepts ----------
const CONCEPT_SELECT = `
  SELECT ac.*, s.name AS style_name FROM ai_concepts ac
  LEFT JOIN styles s ON s.id = ac.style_id`;

function mapConcept(row: Record<string, unknown>): AdminAiConcept {
  return {
    id: row.id as string,
    title: row.title as string,
    brief: (row.brief as string) ?? null,
    promptId: (row.prompt_id as string) ?? null,
    styleId: (row.style_id as string) ?? null,
    styleName: (row.style_name as string) ?? null,
    status: row.status as string,
    rating: (row.rating as number) ?? null,
    tags: jsonArray(row.tags),
    createdAt: row.created_at as string,
  };
}

adminAiRoutes.get("/concepts", async (c) => {
  const rows = await all(c.var.db, `${CONCEPT_SELECT} ORDER BY ac.created_at DESC`);
  return c.json(rows.map(mapConcept));
});

adminAiRoutes.get("/concepts/:id", async (c) => {
  const row = await first<Record<string, unknown>>(
    c.var.db,
    `${CONCEPT_SELECT} WHERE ac.id = ?`,
    c.req.param("id"),
  );
  if (!row) return c.json({ error: "Concept not found" }, 404);
  const generations = await all<Record<string, unknown>>(
    c.var.db,
    `SELECT id, tool, model, prompt_text, output_kind, output_text, external_url,
            file_id, is_favorite, seed, created_at
     FROM ai_generations WHERE concept_id = ? ORDER BY is_favorite DESC, created_at DESC`,
    row.id,
  );
  return c.json({
    ...mapConcept(row),
    generations: generations.map((g) => ({
      ...g,
      is_favorite: Boolean(g.is_favorite),
      url: g.file_id ? `/media/${g.file_id}` : g.external_url,
    })),
  });
});

adminAiRoutes.post("/concepts", requireAdminWrite, async (c) => {
  const body = await parseBody(c, aiConceptCreateSchema);
  const id = newId("aic");
  await run(
    c.var.db,
    `INSERT INTO ai_concepts (id, title, brief, prompt_id, style_id, tags, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    id,
    body.title,
    body.brief ?? null,
    body.promptId ?? null,
    body.styleId ?? null,
    JSON.stringify(body.tags ?? []),
    c.var.userId,
  );
  await run(
    c.var.db,
    `INSERT INTO analytics_events (id, event, entity_type, entity_id) VALUES (?, 'concept_created', 'ai_concept', ?)`,
    newId("evt"),
    id,
  );
  const row = await first(c.var.db, `${CONCEPT_SELECT} WHERE ac.id = ?`, id);
  return c.json(mapConcept(row!), 201);
});

adminAiRoutes.patch("/concepts/:id", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  const body = await parseBody(c, aiConceptUpdateSchema);
  const existing = await first(c.var.db, `SELECT id FROM ai_concepts WHERE id = ?`, id);
  if (!existing) return c.json({ error: "Concept not found" }, 404);
  const sets: string[] = [];
  const params: unknown[] = [];
  if (body.title !== undefined) {
    sets.push(`title = ?`);
    params.push(body.title);
  }
  if (body.brief !== undefined) {
    sets.push(`brief = ?`);
    params.push(body.brief);
  }
  if (body.status !== undefined) {
    sets.push(`status = ?`);
    params.push(body.status);
  }
  if (body.rating !== undefined) {
    sets.push(`rating = ?`);
    params.push(body.rating);
  }
  if (body.tags !== undefined) {
    sets.push(`tags = ?`);
    params.push(JSON.stringify(body.tags));
  }
  if (sets.length === 0) return c.json({ error: "No fields to update" }, 400);
  sets.push(`updated_at = datetime('now')`);
  await run(c.var.db, `UPDATE ai_concepts SET ${sets.join(", ")} WHERE id = ?`, ...params, id);
  await writeAudit(c.var.db, c.var.userId, "ai_concept.update", "ai_concept", id, body);
  return c.json({ ok: true });
});

// ============================================================
// Design Studio — native Flux generation, house style, ship-to-sample.
// ============================================================

const HOUSE_STYLE_KEY = "design_house_style";
const DEFAULT_HOUSE_STYLE =
  "editorial fashion photography, natural window light, matte film grain, muted warm palette, shot on 50mm, elegant restrained styling";

adminAiRoutes.get("/house-style", async (c) => {
  const row = await first<{ value: string }>(c.var.db, `SELECT value FROM settings WHERE key = ?`, HOUSE_STYLE_KEY);
  return c.json({ value: row?.value ?? DEFAULT_HOUSE_STYLE, isDefault: !row });
});

adminAiRoutes.put("/house-style", requireAdminWrite, async (c) => {
  const { houseStyleSchema } = await import("../services/validators");
  const body = await parseBody(c, houseStyleSchema);
  await run(
    c.var.db,
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    HOUSE_STYLE_KEY,
    body.value,
  );
  return c.json({ ok: true });
});

// AI prompt-builder assist: turn a rough brief (+ optional structured fields)
// into a polished Flux prompt.
adminAiRoutes.post("/prompt-suggest", requireAdminWrite, async (c) => {
  const { promptSuggestSchema } = await import("../services/validators");
  const body = await parseBody(c, promptSuggestSchema);
  try {
    const { aiComplete } = await import("../services/ai");
    const fields = body.fields ? Object.entries(body.fields).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join("; ") : "";
    const res = await aiComplete(c.env, {
      system:
        "You write prompts for a text-to-image model (Flux) that generates fashion garment imagery. Return ONE vivid, concrete prompt (max 60 words) describing the garment, fabric, cut, colour, styling and shot. No preamble, no quotes, no lists — just the prompt.",
      prompt: `Design brief: ${body.brief}${fields ? `\nDetails — ${fields}` : ""}`,
      maxTokens: 160,
    });
    return c.json({ prompt: res.text.trim().replace(/^["']|["']$/g, "") });
  } catch {
    return c.json({ error: "AI prompt help is unavailable — write the prompt by hand." }, 503);
  }
});

// Generate images with Flux → R2 → ai_generations.
adminAiRoutes.post("/concepts/:id/generate", requireAdminWrite, async (c) => {
  const { fluxGenerateSchema } = await import("../services/validators");
  const id = c.req.param("id");
  const body = await parseBody(c, fluxGenerateSchema);
  if (!(await first(c.var.db, `SELECT id FROM ai_concepts WHERE id = ?`, id))) {
    return c.json({ error: "Concept not found" }, 404);
  }
  let prompt = body.prompt.trim();
  if (body.useHouseStyle) {
    const hs = await first<{ value: string }>(c.var.db, `SELECT value FROM settings WHERE key = ?`, HOUSE_STYLE_KEY);
    const style = hs?.value ?? DEFAULT_HOUSE_STYLE;
    prompt = `${prompt}. ${style}`;
  }

  const { generateFluxImage, randomSeed, FluxUnavailableError } = await import("../services/flux");
  const created: unknown[] = [];
  try {
    for (let i = 0; i < body.count; i++) {
      // Lock the seed when given (consistency); otherwise vary per image.
      const seed = body.seed != null ? body.seed + i : randomSeed();
      const { bytes, seed: usedSeed, model } = await generateFluxImage(c.env, { prompt, seed });
      const fileId = newId("file");
      const key = `uploads/concept/${id}/${fileId}.jpg`;
      await c.env.FILES.put(key, bytes, { httpMetadata: { contentType: "image/jpeg" } });
      await run(
        c.var.db,
        `INSERT INTO files (id, r2_key, filename, content_type, size_bytes, entity_type, entity_id, is_public, uploaded_by)
         VALUES (?, ?, ?, 'image/jpeg', ?, 'concept', ?, 1, ?)`,
        fileId,
        key,
        `${id}-${usedSeed}.jpg`,
        bytes.length,
        id,
        c.var.userId,
      );
      const genId = newId("gen");
      await run(
        c.var.db,
        `INSERT INTO ai_generations (id, concept_id, tool, model, prompt_text, output_kind, file_id, seed)
         VALUES (?, ?, 'flux', ?, ?, 'image', ?, ?)`,
        genId,
        id,
        model,
        prompt,
        fileId,
        usedSeed,
      );
      // Usage log for future metering (free today).
      await run(
        c.var.db,
        `INSERT INTO analytics_events (id, event, entity_type, entity_id) VALUES (?, 'flux_generation', 'ai_concept', ?)`,
        newId("evt"),
        id,
      );
      created.push({ id: genId, url: `/media/${fileId}`, seed: usedSeed, is_favorite: false, output_kind: "image" });
    }
  } catch (err) {
    if (created.length === 0) {
      const msg = err instanceof FluxUnavailableError ? err.message : "Generation failed. Try again.";
      return c.json({ error: msg }, 503);
    }
    // Partial success — return what we made.
  }
  return c.json({ generations: created }, 201);
});

adminAiRoutes.post("/concepts/:id/generations/:genId/favorite", requireAdminWrite, async (c) => {
  await run(
    c.var.db,
    `UPDATE ai_generations SET is_favorite = CASE is_favorite WHEN 1 THEN 0 ELSE 1 END WHERE id = ? AND concept_id = ?`,
    c.req.param("genId"),
    c.req.param("id"),
  );
  return c.json({ ok: true });
});

adminAiRoutes.delete("/concepts/:id/generations/:genId", requireAdminWrite, async (c) => {
  const gen = await first<{ file_id: string | null }>(
    c.var.db,
    `SELECT file_id FROM ai_generations WHERE id = ? AND concept_id = ?`,
    c.req.param("genId"),
    c.req.param("id"),
  );
  await run(c.var.db, `DELETE FROM ai_generations WHERE id = ? AND concept_id = ?`, c.req.param("genId"), c.req.param("id"));
  if (gen?.file_id) {
    const f = await first<{ r2_key: string }>(c.var.db, `SELECT r2_key FROM files WHERE id = ?`, gen.file_id);
    if (f) {
      await c.env.FILES.delete(f.r2_key).catch(() => {});
      await run(c.var.db, `DELETE FROM files WHERE id = ?`, gen.file_id);
    }
  }
  return c.json({ ok: true });
});

// Ship a chosen design to sampling: ensure a Style, then request a sample from
// a supplier. Closes the loop idea → image → style → factory.
adminAiRoutes.post("/concepts/:id/ship", requireAdminWrite, async (c) => {
  const { conceptShipSchema } = await import("../services/validators");
  const id = c.req.param("id");
  const body = await parseBody(c, conceptShipSchema);
  const concept = await first<{ title: string; style_id: string | null }>(
    c.var.db,
    `SELECT title, style_id FROM ai_concepts WHERE id = ?`,
    id,
  );
  if (!concept) return c.json({ error: "Concept not found" }, 404);

  // Resolve or create the style behind this design.
  let styleId = body.styleId || concept.style_id;
  if (!styleId) {
    styleId = newId("sty");
    const code = `ST-${Date.now().toString(36).toUpperCase().slice(-6)}`;
    await run(
      c.var.db,
      `INSERT INTO styles (id, style_code, name, category, gender, status)
       VALUES (?, ?, ?, 'apparel', 'unisex', 'design')`,
      styleId,
      code,
      concept.title.slice(0, 120),
    );
    await run(
      c.var.db,
      `UPDATE ai_concepts SET style_id = ?, status = 'converted_to_style', updated_at = datetime('now') WHERE id = ?`,
      styleId,
      id,
    );
  }

  // Re-tag the chosen image to the style so the factory/sample sees it.
  if (body.generationId) {
    const gen = await first<{ file_id: string | null }>(c.var.db, `SELECT file_id FROM ai_generations WHERE id = ? AND concept_id = ?`, body.generationId, id);
    if (gen?.file_id) {
      await run(c.var.db, `UPDATE files SET entity_type = 'style', entity_id = ? WHERE id = ?`, styleId, gen.file_id);
    }
  }

  const sampleId = newId("smp");
  await run(
    c.var.db,
    `INSERT INTO samples (id, style_id, supplier_id, round, kind, status, requested_at, notes)
     VALUES (?, ?, ?, 1, ?, 'requested', datetime('now'), ?)`,
    sampleId,
    styleId,
    body.supplierId || null,
    body.kind,
    body.notes ?? `Sample requested from the Design Studio for "${concept.title}".`,
  );
  await writeAudit(c.var.db, c.var.userId, "concept.ship_to_sample", "ai_concept", id, { styleId, sampleId });
  return c.json({ styleId, sampleId }, 201);
});

// ---------- External tool exports (Midjourney / Firefly / CLO bridges) ----------
adminAiRoutes.get("/external-exports", async (c) => {
  const rows = await all(
    c.var.db,
    `SELECT id, tool, entity_type, entity_id, title, external_url, metadata_json, created_at
     FROM external_tool_exports ORDER BY created_at DESC LIMIT 200`,
  );
  return c.json(rows);
});

adminAiRoutes.post("/external-exports", requireAdminWrite, async (c) => {
  const body = (await c.req.json().catch(() => null)) as {
    tool?: string;
    entityType?: string;
    entityId?: string;
    title?: string;
    externalUrl?: string;
    metadata?: unknown;
  } | null;
  if (!body?.tool || typeof body.tool !== "string") {
    return c.json({ error: "tool is required" }, 400);
  }
  const id = newId("ext");
  await run(
    c.var.db,
    `INSERT INTO external_tool_exports (id, tool, entity_type, entity_id, title, external_url, metadata_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    id,
    body.tool.slice(0, 40),
    body.entityType?.slice(0, 40) ?? null,
    body.entityId?.slice(0, 80) ?? null,
    body.title?.slice(0, 300) ?? null,
    body.externalUrl?.slice(0, 1000) ?? null,
    body.metadata ? JSON.stringify(body.metadata) : null,
  );
  return c.json({ id }, 201);
});
