import { Hono } from "hono";
import { all, first, run, writeAudit } from "../services/db";
import {
  calendarEventCreateSchema,
  parseBody,
  sampleCreateSchema,
  sampleUpdateSchema,
  taskCreateSchema,
  taskUpdateSchema,
} from "../services/validators";
import { requireAdminWrite } from "../middleware/auth";
import { newId } from "../utils/id";
import type { AppContext } from "../types/env";
import type {
  AdminCalendarEvent,
  AdminProductionOrder,
  AdminProductionStage,
  AdminProductionTask,
  AdminSample,
} from "../../shared/types";

export const adminProductionRoutes = new Hono<AppContext>();

// ---------- Stages ----------
adminProductionRoutes.get("/stages", async (c) => {
  const rows = await all<Record<string, unknown>>(
    c.env.DB,
    `SELECT id, name, sort_order, description FROM production_stages ORDER BY sort_order`,
  );
  const stages: AdminProductionStage[] = rows.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    sortOrder: r.sort_order as number,
    description: (r.description as string) ?? null,
  }));
  return c.json(stages);
});

// ---------- Tasks ----------
const TASK_SELECT = `
  SELECT t.*, ps.name AS stage_name, s.name AS style_name, sup.name AS supplier_name
  FROM production_tasks t
  LEFT JOIN production_stages ps ON ps.id = t.stage_id
  LEFT JOIN styles s ON s.id = t.style_id
  LEFT JOIN suppliers sup ON sup.id = t.supplier_id`;

function mapTask(row: Record<string, unknown>): AdminProductionTask {
  return {
    id: row.id as string,
    title: row.title as string,
    stageId: (row.stage_id as string) ?? null,
    stageName: (row.stage_name as string) ?? null,
    status: row.status as AdminProductionTask["status"],
    owner: (row.owner as string) ?? null,
    styleId: (row.style_id as string) ?? null,
    styleName: (row.style_name as string) ?? null,
    supplierId: (row.supplier_id as string) ?? null,
    supplierName: (row.supplier_name as string) ?? null,
    dueDate: (row.due_date as string) ?? null,
    riskFlag: Boolean(row.risk_flag),
    notes: (row.notes as string) ?? null,
  };
}

adminProductionRoutes.get("/tasks", async (c) => {
  const status = c.req.query("status");
  const params: unknown[] = [];
  let where = "";
  if (status) {
    where = `WHERE t.status = ?`;
    params.push(status);
  }
  const rows = await all(
    c.env.DB,
    `${TASK_SELECT} ${where} ORDER BY CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END, t.due_date`,
    ...params,
  );
  return c.json(rows.map(mapTask));
});

adminProductionRoutes.post("/tasks", requireAdminWrite, async (c) => {
  const body = await parseBody(c, taskCreateSchema);
  const id = newId("task");
  await run(
    c.env.DB,
    `INSERT INTO production_tasks
       (id, title, stage_id, status, owner, style_id, supplier_id, due_date, risk_flag, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    body.title,
    body.stageId ?? null,
    body.status ?? "todo",
    body.owner ?? null,
    body.styleId ?? null,
    body.supplierId ?? null,
    body.dueDate ?? null,
    body.riskFlag ? 1 : 0,
    body.notes ?? null,
  );
  await writeAudit(c.env.DB, c.var.userId, "production_task.create", "production_task", id, {
    title: body.title,
  });
  const row = await first(c.env.DB, `${TASK_SELECT} WHERE t.id = ?`, id);
  return c.json(mapTask(row!), 201);
});

adminProductionRoutes.patch("/tasks/:id", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  const body = await parseBody(c, taskUpdateSchema);
  const existing = await first<{ id: string; status: string }>(
    c.env.DB,
    `SELECT id, status FROM production_tasks WHERE id = ?`,
    id,
  );
  if (!existing) return c.json({ error: "Task not found" }, 404);

  const sets: string[] = [];
  const params: unknown[] = [];
  const fieldMap: Record<string, string> = {
    title: "title",
    stageId: "stage_id",
    status: "status",
    owner: "owner",
    styleId: "style_id",
    supplierId: "supplier_id",
    dueDate: "due_date",
    notes: "notes",
  };
  for (const [key, col] of Object.entries(fieldMap)) {
    if (key in body) {
      sets.push(`${col} = ?`);
      params.push((body as Record<string, unknown>)[key] ?? null);
    }
  }
  if ("riskFlag" in body) {
    sets.push(`risk_flag = ?`);
    params.push(body.riskFlag ? 1 : 0);
  }
  if (body.status === "done" && existing.status !== "done") {
    sets.push(`completed_at = datetime('now')`);
  }
  if (sets.length === 0) return c.json({ error: "No fields to update" }, 400);
  sets.push(`updated_at = datetime('now')`);
  await run(c.env.DB, `UPDATE production_tasks SET ${sets.join(", ")} WHERE id = ?`, ...params, id);
  if (body.status && body.status !== existing.status) {
    await run(
      c.env.DB,
      `INSERT INTO analytics_events (id, event, entity_type, entity_id, properties_json)
       VALUES (?, 'production_stage_changed', 'production_task', ?, ?)`,
      newId("evt"),
      id,
      JSON.stringify({ from: existing.status, to: body.status }),
    );
  }
  await writeAudit(c.env.DB, c.var.userId, "production_task.update", "production_task", id, body);
  const row = await first(c.env.DB, `${TASK_SELECT} WHERE t.id = ?`, id);
  return c.json(mapTask(row!));
});

// ---------- Calendar ----------
adminProductionRoutes.get("/calendar", async (c) => {
  const rows = await all<Record<string, unknown>>(
    c.env.DB,
    `SELECT e.*, ps.name AS stage_name FROM production_calendar_events e
     LEFT JOIN production_stages ps ON ps.id = e.stage_id
     ORDER BY e.starts_on`,
  );
  const events: AdminCalendarEvent[] = rows.map((r) => ({
    id: r.id as string,
    title: r.title as string,
    kind: r.kind as AdminCalendarEvent["kind"],
    stageId: (r.stage_id as string) ?? null,
    stageName: (r.stage_name as string) ?? null,
    startsOn: r.starts_on as string,
    endsOn: (r.ends_on as string) ?? null,
    notes: (r.notes as string) ?? null,
  }));
  return c.json(events);
});

adminProductionRoutes.post("/calendar", requireAdminWrite, async (c) => {
  const body = await parseBody(c, calendarEventCreateSchema);
  const id = newId("cal");
  await run(
    c.env.DB,
    `INSERT INTO production_calendar_events (id, title, kind, stage_id, starts_on, ends_on, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    id,
    body.title,
    body.kind ?? "milestone",
    body.stageId ?? null,
    body.startsOn,
    body.endsOn ?? null,
    body.notes ?? null,
  );
  return c.json({ id }, 201);
});

// ---------- Samples ----------
const SAMPLE_SELECT = `
  SELECT sm.*, s.name AS style_name, sup.name AS supplier_name
  FROM samples sm
  JOIN styles s ON s.id = sm.style_id
  LEFT JOIN suppliers sup ON sup.id = sm.supplier_id`;

function mapSample(row: Record<string, unknown>): AdminSample {
  return {
    id: row.id as string,
    styleId: row.style_id as string,
    styleName: row.style_name as string,
    supplierName: (row.supplier_name as string) ?? null,
    round: row.round as number,
    kind: row.kind as string,
    status: row.status as string,
    requestedAt: (row.requested_at as string) ?? null,
    receivedAt: (row.received_at as string) ?? null,
    notes: (row.notes as string) ?? null,
  };
}

adminProductionRoutes.get("/samples", async (c) => {
  const rows = await all(c.env.DB, `${SAMPLE_SELECT} ORDER BY sm.created_at DESC`);
  return c.json(rows.map(mapSample));
});

adminProductionRoutes.post("/samples", requireAdminWrite, async (c) => {
  const body = await parseBody(c, sampleCreateSchema);
  const id = newId("smp");
  await run(
    c.env.DB,
    `INSERT INTO samples (id, style_id, supplier_id, round, kind, status, requested_at, notes)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?)`,
    id,
    body.styleId,
    body.supplierId ?? null,
    body.round ?? 1,
    body.kind ?? "proto",
    body.status ?? "requested",
    body.notes ?? null,
  );
  const row = await first(c.env.DB, `${SAMPLE_SELECT} WHERE sm.id = ?`, id);
  return c.json(mapSample(row!), 201);
});

adminProductionRoutes.patch("/samples/:id", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  const body = await parseBody(c, sampleUpdateSchema);
  const existing = await first<{ id: string; status: string }>(
    c.env.DB,
    `SELECT id, status FROM samples WHERE id = ?`,
    id,
  );
  if (!existing) return c.json({ error: "Sample not found" }, 404);
  const sets: string[] = [];
  const params: unknown[] = [];
  const fieldMap: Record<string, string> = {
    supplierId: "supplier_id",
    round: "round",
    kind: "kind",
    status: "status",
    notes: "notes",
  };
  for (const [key, col] of Object.entries(fieldMap)) {
    if (key in body) {
      sets.push(`${col} = ?`);
      params.push((body as Record<string, unknown>)[key] ?? null);
    }
  }
  if (body.status === "received") sets.push(`received_at = datetime('now')`);
  if (sets.length === 0) return c.json({ error: "No fields to update" }, 400);
  sets.push(`updated_at = datetime('now')`);
  await run(c.env.DB, `UPDATE samples SET ${sets.join(", ")} WHERE id = ?`, ...params, id);
  if (body.status === "approved" && existing.status !== "approved") {
    await run(
      c.env.DB,
      `INSERT INTO analytics_events (id, event, entity_type, entity_id)
       VALUES (?, 'sample_approved', 'sample', ?)`,
      newId("evt"),
      id,
    );
  }
  const row = await first(c.env.DB, `${SAMPLE_SELECT} WHERE sm.id = ?`, id);
  return c.json(mapSample(row!));
});

// ---------- Production orders ----------
adminProductionRoutes.get("/orders", async (c) => {
  const rows = await all<Record<string, unknown>>(
    c.env.DB,
    `SELECT po.*, sup.name AS supplier_name,
       (SELECT COUNT(*) FROM production_order_items i WHERE i.production_order_id = po.id) AS item_count
     FROM production_orders po JOIN suppliers sup ON sup.id = po.supplier_id
     ORDER BY po.created_at DESC`,
  );
  const orders: AdminProductionOrder[] = rows.map((r) => ({
    id: r.id as string,
    poNumber: r.po_number as string,
    supplierId: r.supplier_id as string,
    supplierName: r.supplier_name as string,
    status: r.status as string,
    currency: r.currency as string,
    totalCostCents: (r.total_cost_cents as number) ?? null,
    exFactoryDate: (r.ex_factory_date as string) ?? null,
    incoterms: (r.incoterms as string) ?? null,
    itemCount: (r.item_count as number) ?? 0,
  }));
  return c.json(orders);
});

adminProductionRoutes.get("/orders/:id", async (c) => {
  const row = await first<Record<string, unknown>>(
    c.env.DB,
    `SELECT po.*, sup.name AS supplier_name FROM production_orders po
     JOIN suppliers sup ON sup.id = po.supplier_id WHERE po.id = ?`,
    c.req.param("id"),
  );
  if (!row) return c.json({ error: "Production order not found" }, 404);
  const items = await all<Record<string, unknown>>(
    c.env.DB,
    `SELECT i.*, s.name AS style_name FROM production_order_items i
     LEFT JOIN styles s ON s.id = i.style_id WHERE i.production_order_id = ?`,
    row.id,
  );
  return c.json({ ...row, items });
});
