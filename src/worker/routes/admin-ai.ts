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
    c.env.DB,
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
    c.env.DB,
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
    c.env.DB,
    `SELECT * FROM ai_prompts WHERE id = ?`,
    parentId,
  );
  if (!parent) return c.json({ error: "Prompt not found" }, 404);
  const id = newId("aip");
  await run(
    c.env.DB,
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
  const rows = await all(c.env.DB, `${CONCEPT_SELECT} ORDER BY ac.created_at DESC`);
  return c.json(rows.map(mapConcept));
});

adminAiRoutes.get("/concepts/:id", async (c) => {
  const row = await first<Record<string, unknown>>(
    c.env.DB,
    `${CONCEPT_SELECT} WHERE ac.id = ?`,
    c.req.param("id"),
  );
  if (!row) return c.json({ error: "Concept not found" }, 404);
  const generations = await all(
    c.env.DB,
    `SELECT id, tool, model, prompt_text, output_kind, output_text, external_url, created_at
     FROM ai_generations WHERE concept_id = ? ORDER BY created_at DESC`,
    row.id,
  );
  return c.json({ ...mapConcept(row), generations });
});

adminAiRoutes.post("/concepts", requireAdminWrite, async (c) => {
  const body = await parseBody(c, aiConceptCreateSchema);
  const id = newId("aic");
  await run(
    c.env.DB,
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
    c.env.DB,
    `INSERT INTO analytics_events (id, event, entity_type, entity_id) VALUES (?, 'concept_created', 'ai_concept', ?)`,
    newId("evt"),
    id,
  );
  const row = await first(c.env.DB, `${CONCEPT_SELECT} WHERE ac.id = ?`, id);
  return c.json(mapConcept(row!), 201);
});

adminAiRoutes.patch("/concepts/:id", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  const body = await parseBody(c, aiConceptUpdateSchema);
  const existing = await first(c.env.DB, `SELECT id FROM ai_concepts WHERE id = ?`, id);
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
  await run(c.env.DB, `UPDATE ai_concepts SET ${sets.join(", ")} WHERE id = ?`, ...params, id);
  await writeAudit(c.env.DB, c.var.userId, "ai_concept.update", "ai_concept", id, body);
  return c.json({ ok: true });
});

// ---------- External tool exports (Midjourney / Firefly / CLO bridges) ----------
adminAiRoutes.get("/external-exports", async (c) => {
  const rows = await all(
    c.env.DB,
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
    c.env.DB,
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
