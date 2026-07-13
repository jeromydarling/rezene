import { Hono } from "hono";
import { z } from "zod";
import { all, first, run } from "../services/db";
import { parseBody } from "../services/validators";
import { requireAdminWrite } from "../middleware/auth";
import { newId } from "../utils/id";
import { triggerByEvent, actionByType, CONDITION_OPS } from "../../shared/workflows";
import type { AppContext } from "../types/env";

/**
 * Custom workflows — CRUD for the no-code builder. A workflow is
 * WHEN <trigger>, IF <conditions>, THEN <actions>, validated against the
 * shared catalog so only real triggers/fields/actions can be stored. Mutations
 * go through requireAdminWrite so demo shops stay read-only.
 */
export const adminWorkflowRoutes = new Hono<AppContext>();

type Row = {
  id: string;
  name: string;
  description: string | null;
  trigger_event: string;
  conditions_json: string;
  actions_json: string;
  enabled: number;
  run_count: number;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
};

const parse = (s: string) => {
  try {
    return JSON.parse(s);
  } catch {
    return [];
  }
};

function mapRow(r: Row) {
  const trigger = triggerByEvent(r.trigger_event);
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    triggerEvent: r.trigger_event,
    triggerLabel: trigger?.label ?? r.trigger_event,
    conditions: parse(r.conditions_json),
    actions: parse(r.actions_json),
    enabled: Boolean(r.enabled),
    runCount: r.run_count,
    lastRunAt: r.last_run_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const OPS = new Set(CONDITION_OPS.map((o) => o.op));

const conditionSchema = z.object({
  field: z.string().max(60),
  op: z.string().max(20),
  value: z.string().max(300),
});
const actionSchema = z.object({
  type: z.string().max(40),
  params: z.record(z.string(), z.string().max(2000)),
});
const workflowSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional().nullable(),
  triggerEvent: z.string().max(60),
  conditions: z.array(conditionSchema).max(10).optional(),
  actions: z.array(actionSchema).min(1).max(8),
  enabled: z.boolean().optional(),
});

type WorkflowInput = z.infer<typeof workflowSchema>;

/** Validate a workflow against the catalog; returns an error string or null. */
function validate(input: WorkflowInput): string | null {
  const trigger = triggerByEvent(input.triggerEvent);
  if (!trigger) return "That trigger isn't available.";
  for (const c of input.conditions ?? []) {
    if (!trigger.fields.some((f) => f.key === c.field)) return `“${c.field}” isn't a detail this trigger carries.`;
    if (!OPS.has(c.op as (typeof CONDITION_OPS)[number]["op"])) return "That comparison isn't supported.";
  }
  for (const a of input.actions) {
    const def = actionByType(a.type);
    if (!def) return "One of the actions isn't available.";
    if (def.needsClient && !trigger.hasClient) return `“${def.label}” needs a trigger that involves a client.`;
  }
  return null;
}

adminWorkflowRoutes.get("/", async (c) => {
  try {
    const rows = await all<Row>(c.var.db, `SELECT * FROM workflows ORDER BY updated_at DESC`);
    return c.json(rows.map(mapRow));
  } catch {
    // Table not migrated on this shop DB yet — an empty builder, not an error.
    return c.json([]);
  }
});

adminWorkflowRoutes.post("/", requireAdminWrite, async (c) => {
  const body = await parseBody(c, workflowSchema);
  const err = validate(body);
  if (err) return c.json({ error: err }, 400);
  const id = newId("wf");
  await run(
    c.var.db,
    `INSERT INTO workflows (id, name, description, trigger_event, conditions_json, actions_json, enabled)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    id,
    body.name.trim(),
    body.description?.trim() || null,
    body.triggerEvent,
    JSON.stringify(body.conditions ?? []),
    JSON.stringify(body.actions),
    body.enabled === false ? 0 : 1,
  );
  const row = await first<Row>(c.var.db, `SELECT * FROM workflows WHERE id = ?`, id);
  return c.json(mapRow(row!), 201);
});

adminWorkflowRoutes.put("/:id", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  const existing = await first<Row>(c.var.db, `SELECT * FROM workflows WHERE id = ?`, id);
  if (!existing) return c.json({ error: "Workflow not found" }, 404);
  const body = await parseBody(c, workflowSchema);
  const err = validate(body);
  if (err) return c.json({ error: err }, 400);
  await run(
    c.var.db,
    `UPDATE workflows SET name = ?, description = ?, trigger_event = ?, conditions_json = ?, actions_json = ?,
       enabled = ?, updated_at = datetime('now') WHERE id = ?`,
    body.name.trim(),
    body.description?.trim() || null,
    body.triggerEvent,
    JSON.stringify(body.conditions ?? []),
    JSON.stringify(body.actions),
    body.enabled === false ? 0 : 1,
    id,
  );
  const row = await first<Row>(c.var.db, `SELECT * FROM workflows WHERE id = ?`, id);
  return c.json(mapRow(row!));
});

const toggleSchema = z.object({ enabled: z.boolean() });

adminWorkflowRoutes.patch("/:id", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  const body = await parseBody(c, toggleSchema);
  const result = await run(
    c.var.db,
    `UPDATE workflows SET enabled = ?, updated_at = datetime('now') WHERE id = ?`,
    body.enabled ? 1 : 0,
    id,
  );
  if (!result.meta.changes) return c.json({ error: "Workflow not found" }, 404);
  return c.json({ ok: true });
});

adminWorkflowRoutes.delete("/:id", requireAdminWrite, async (c) => {
  const result = await run(c.var.db, `DELETE FROM workflows WHERE id = ?`, c.req.param("id"));
  if (!result.meta.changes) return c.json({ error: "Workflow not found" }, 404);
  return c.json({ ok: true });
});

adminWorkflowRoutes.get("/:id/runs", async (c) => {
  const rows = await all<{ id: string; event_kind: string; status: string; detail: string | null; created_at: string }>(
    c.var.db,
    `SELECT id, event_kind, status, detail, created_at FROM workflow_runs
     WHERE workflow_id = ? ORDER BY created_at DESC LIMIT 20`,
    c.req.param("id"),
  ).catch(() => []);
  return c.json(
    rows.map((r) => ({ id: r.id, eventKind: r.event_kind, status: r.status, detail: r.detail, createdAt: r.created_at })),
  );
});
