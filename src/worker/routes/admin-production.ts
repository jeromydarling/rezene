import { Hono } from "hono";
import { all, first, run, writeAudit } from "../services/db";
import {
  calendarEventCreateSchema,
  fabricCreateSchema,
  fabricUpdateSchema,
  parseBody,
  productionOrderCreateSchema,
  productionOrderItemSchema,
  productionOrderUpdateSchema,
  sampleCreateSchema,
  sampleUpdateSchema,
  taskCreateSchema,
  taskUpdateSchema,
  trimCreateSchema,
  trimUpdateSchema,
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
    c.var.db,
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
    c.var.db,
    `${TASK_SELECT} ${where} ORDER BY CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END, t.due_date`,
    ...params,
  );
  return c.json(rows.map(mapTask));
});

adminProductionRoutes.post("/tasks", requireAdminWrite, async (c) => {
  const body = await parseBody(c, taskCreateSchema);
  const id = newId("task");
  await run(
    c.var.db,
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
  await writeAudit(c.var.db, c.var.userId, "production_task.create", "production_task", id, {
    title: body.title,
  });
  const row = await first(c.var.db, `${TASK_SELECT} WHERE t.id = ?`, id);
  return c.json(mapTask(row!), 201);
});

adminProductionRoutes.patch("/tasks/:id", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  const body = await parseBody(c, taskUpdateSchema);
  const existing = await first<{ id: string; status: string }>(
    c.var.db,
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
  await run(c.var.db, `UPDATE production_tasks SET ${sets.join(", ")} WHERE id = ?`, ...params, id);
  if (body.status && body.status !== existing.status) {
    await run(
      c.var.db,
      `INSERT INTO analytics_events (id, event, entity_type, entity_id, properties_json)
       VALUES (?, 'production_stage_changed', 'production_task', ?, ?)`,
      newId("evt"),
      id,
      JSON.stringify({ from: existing.status, to: body.status }),
    );
  }
  await writeAudit(c.var.db, c.var.userId, "production_task.update", "production_task", id, body);
  const row = await first(c.var.db, `${TASK_SELECT} WHERE t.id = ?`, id);
  return c.json(mapTask(row!));
});

// ---------- Calendar ----------
adminProductionRoutes.get("/calendar", async (c) => {
  const rows = await all<Record<string, unknown>>(
    c.var.db,
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
    c.var.db,
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
    supplierId: (row.supplier_id as string) ?? null,
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
  const rows = await all(c.var.db, `${SAMPLE_SELECT} ORDER BY sm.created_at DESC`);
  return c.json(rows.map(mapSample));
});

adminProductionRoutes.post("/samples", requireAdminWrite, async (c) => {
  const body = await parseBody(c, sampleCreateSchema);
  const id = newId("smp");
  await run(
    c.var.db,
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
  const row = await first(c.var.db, `${SAMPLE_SELECT} WHERE sm.id = ?`, id);
  return c.json(mapSample(row!), 201);
});

adminProductionRoutes.patch("/samples/:id", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  const body = await parseBody(c, sampleUpdateSchema);
  const existing = await first<{ id: string; status: string }>(
    c.var.db,
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
  await run(c.var.db, `UPDATE samples SET ${sets.join(", ")} WHERE id = ?`, ...params, id);
  if (body.status === "approved" && existing.status !== "approved") {
    await run(
      c.var.db,
      `INSERT INTO analytics_events (id, event, entity_type, entity_id)
       VALUES (?, 'sample_approved', 'sample', ?)`,
      newId("evt"),
      id,
    );
  }
  const row = await first(c.var.db, `${SAMPLE_SELECT} WHERE sm.id = ?`, id);
  return c.json(mapSample(row!));
});

adminProductionRoutes.delete("/samples/:id", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  const result = await run(c.var.db, `DELETE FROM samples WHERE id = ?`, id);
  if (!result.meta.changes) return c.json({ error: "Sample not found" }, 404);
  await writeAudit(c.var.db, c.var.userId, "sample.delete", "sample", id, {});
  return c.json({ ok: true });
});

adminProductionRoutes.delete("/tasks/:id", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  const result = await run(c.var.db, `DELETE FROM production_tasks WHERE id = ?`, id);
  if (!result.meta.changes) return c.json({ error: "Task not found" }, 404);
  await writeAudit(c.var.db, c.var.userId, "production_task.delete", "production_task", id, {});
  return c.json({ ok: true });
});

// ---------- Fabrics & materials ----------
adminProductionRoutes.get("/materials", async (c) => {
  const fabrics = await all(
    c.var.db,
    `SELECT f.id, f.name, f.composition, f.weight_gsm, f.origin_country,
            f.price_per_meter_cents, f.currency, f.lead_time_days, f.moq_meters, f.notes,
            sup.name AS supplier_name
     FROM fabrics f LEFT JOIN suppliers sup ON sup.id = f.supplier_id ORDER BY f.name`,
  );
  const trims = await all(
    c.var.db,
    `SELECT t.id, t.name, t.supplier_id, t.spec, t.price_per_unit_cents, t.currency, t.notes,
            sup.name AS supplier_name
     FROM trims t LEFT JOIN suppliers sup ON sup.id = t.supplier_id ORDER BY t.name`,
  );
  return c.json({ fabrics, trims });
});

adminProductionRoutes.post("/materials/fabrics", requireAdminWrite, async (c) => {
  const body = await parseBody(c, fabricCreateSchema);
  const id = newId("fab");
  await run(
    c.var.db,
    `INSERT INTO fabrics (id, name, supplier_id, composition, weight_gsm, origin_country,
       price_per_meter_cents, currency, lead_time_days, moq_meters, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    body.name,
    body.supplierId ?? null,
    body.composition ?? null,
    body.weightGsm ?? null,
    body.originCountry ?? null,
    body.pricePerMeterCents ?? null,
    body.currency ?? "EUR",
    body.leadTimeDays ?? null,
    body.moqMeters ?? null,
    body.notes ?? null,
  );
  await writeAudit(c.var.db, c.var.userId, "fabric.create", "fabric", id, { name: body.name });
  return c.json({ id }, 201);
});

const FABRIC_COLS: Record<string, string> = {
  name: "name",
  supplierId: "supplier_id",
  composition: "composition",
  weightGsm: "weight_gsm",
  originCountry: "origin_country",
  pricePerMeterCents: "price_per_meter_cents",
  currency: "currency",
  leadTimeDays: "lead_time_days",
  moqMeters: "moq_meters",
  notes: "notes",
};

adminProductionRoutes.patch("/materials/fabrics/:id", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  const body = await parseBody(c, fabricUpdateSchema);
  const existing = await first(c.var.db, `SELECT id FROM fabrics WHERE id = ?`, id);
  if (!existing) return c.json({ error: "Fabric not found" }, 404);
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [key, col] of Object.entries(FABRIC_COLS)) {
    if (key in body) {
      sets.push(`${col} = ?`);
      params.push((body as Record<string, unknown>)[key] ?? null);
    }
  }
  if (sets.length === 0) return c.json({ error: "No fields to update" }, 400);
  await run(c.var.db, `UPDATE fabrics SET ${sets.join(", ")} WHERE id = ?`, ...params, id);
  await writeAudit(c.var.db, c.var.userId, "fabric.update", "fabric", id, body);
  return c.json({ ok: true });
});

adminProductionRoutes.delete("/materials/fabrics/:id", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  const existing = await first<{ name: string }>(c.var.db, `SELECT name FROM fabrics WHERE id = ?`, id);
  if (!existing) return c.json({ error: "Fabric not found" }, 404);
  await run(c.var.db, `DELETE FROM fabrics WHERE id = ?`, id);
  await writeAudit(c.var.db, c.var.userId, "fabric.delete", "fabric", id, { name: existing.name });
  return c.json({ ok: true });
});

adminProductionRoutes.post("/materials/trims", requireAdminWrite, async (c) => {
  const body = await parseBody(c, trimCreateSchema);
  const id = newId("trm");
  await run(
    c.var.db,
    `INSERT INTO trims (id, name, supplier_id, spec, price_per_unit_cents, currency, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    id,
    body.name,
    body.supplierId ?? null,
    body.spec ?? null,
    body.pricePerUnitCents ?? null,
    body.currency ?? "EUR",
    body.notes ?? null,
  );
  await writeAudit(c.var.db, c.var.userId, "trim.create", "trim", id, { name: body.name });
  return c.json({ id }, 201);
});

const TRIM_COLS: Record<string, string> = {
  name: "name",
  supplierId: "supplier_id",
  spec: "spec",
  pricePerUnitCents: "price_per_unit_cents",
  currency: "currency",
  notes: "notes",
};

adminProductionRoutes.patch("/materials/trims/:id", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  const body = await parseBody(c, trimUpdateSchema);
  const existing = await first(c.var.db, `SELECT id FROM trims WHERE id = ?`, id);
  if (!existing) return c.json({ error: "Trim not found" }, 404);
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [key, col] of Object.entries(TRIM_COLS)) {
    if (key in body) {
      sets.push(`${col} = ?`);
      params.push((body as Record<string, unknown>)[key] ?? null);
    }
  }
  if (sets.length === 0) return c.json({ error: "No fields to update" }, 400);
  await run(c.var.db, `UPDATE trims SET ${sets.join(", ")} WHERE id = ?`, ...params, id);
  await writeAudit(c.var.db, c.var.userId, "trim.update", "trim", id, body);
  return c.json({ ok: true });
});

adminProductionRoutes.delete("/materials/trims/:id", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  const existing = await first<{ name: string }>(c.var.db, `SELECT name FROM trims WHERE id = ?`, id);
  if (!existing) return c.json({ error: "Trim not found" }, 404);
  await run(c.var.db, `DELETE FROM trims WHERE id = ?`, id);
  await writeAudit(c.var.db, c.var.userId, "trim.delete", "trim", id, { name: existing.name });
  return c.json({ ok: true });
});

// ---------- Production orders ----------
adminProductionRoutes.get("/orders", async (c) => {
  const rows = await all<Record<string, unknown>>(
    c.var.db,
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
    c.var.db,
    `SELECT po.*, sup.name AS supplier_name FROM production_orders po
     JOIN suppliers sup ON sup.id = po.supplier_id WHERE po.id = ?`,
    c.req.param("id"),
  );
  if (!row) return c.json({ error: "Production order not found" }, 404);
  const items = await all<Record<string, unknown>>(
    c.var.db,
    `SELECT i.*, s.name AS style_name FROM production_order_items i
     LEFT JOIN styles s ON s.id = i.style_id WHERE i.production_order_id = ?`,
    row.id,
  );
  // Header in camelCase (matches AdminProductionOrder); items stay snake_case.
  return c.json({
    id: row.id as string,
    poNumber: row.po_number as string,
    supplierId: row.supplier_id as string,
    supplierName: row.supplier_name as string,
    status: row.status as string,
    currency: row.currency as string,
    totalCostCents: (row.total_cost_cents as number) ?? null,
    exFactoryDate: (row.ex_factory_date as string) ?? null,
    incoterms: (row.incoterms as string) ?? null,
    issue_date: (row.issue_date as string) ?? null,
    received_date: (row.received_date as string) ?? null,
    notes: (row.notes as string) ?? null,
    itemCount: items.length,
    items,
  });
});

// Sum line items → total_cost_cents, keeping the PO header total honest.
async function recomputePoTotal(db: D1Database, poId: string): Promise<void> {
  const agg = await first<{ total: number | null }>(
    db,
    `SELECT SUM(quantity * COALESCE(unit_cost_cents, 0)) AS total
     FROM production_order_items WHERE production_order_id = ?`,
    poId,
  );
  await run(
    db,
    `UPDATE production_orders SET total_cost_cents = ?, updated_at = datetime('now') WHERE id = ?`,
    agg?.total ?? 0,
    poId,
  );
}

adminProductionRoutes.post("/orders", requireAdminWrite, async (c) => {
  const body = await parseBody(c, productionOrderCreateSchema);
  // Auto-number PO-YYYY-NNN when the caller doesn't supply one.
  let poNumber = body.poNumber?.trim();
  if (!poNumber) {
    const year = new Date().getUTCFullYear();
    const prefix = `PO-${year}-`;
    const last = await first<{ po_number: string }>(
      c.var.db,
      `SELECT po_number FROM production_orders WHERE po_number LIKE ? ORDER BY po_number DESC LIMIT 1`,
      `${prefix}%`,
    );
    const nextSeq = last ? parseInt(last.po_number.slice(prefix.length), 10) + 1 : 1;
    poNumber = `${prefix}${String(nextSeq).padStart(3, "0")}`;
  } else {
    const clash = await first(c.var.db, `SELECT id FROM production_orders WHERE po_number = ?`, poNumber);
    if (clash) return c.json({ error: `PO number ${poNumber} already exists.` }, 409);
  }

  const id = newId("po");
  await run(
    c.var.db,
    `INSERT INTO production_orders
       (id, po_number, supplier_id, status, currency, incoterms, issue_date, ex_factory_date, notes, total_cost_cents)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    id,
    poNumber,
    body.supplierId,
    body.status ?? "draft",
    body.currency ?? "EUR",
    body.incoterms ?? null,
    body.issueDate ?? null,
    body.exFactoryDate ?? null,
    body.notes ?? null,
  );
  for (const item of body.items ?? []) {
    await run(
      c.var.db,
      `INSERT INTO production_order_items
         (id, production_order_id, style_id, description, quantity, unit_cost_cents, currency)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      newId("poi"),
      id,
      item.styleId ?? null,
      item.description,
      item.quantity,
      item.unitCostCents ?? null,
      body.currency ?? "EUR",
    );
  }
  await recomputePoTotal(c.var.db, id);
  await writeAudit(c.var.db, c.var.userId, "production_order.create", "production_order", id, {
    poNumber,
  });
  return c.json({ id, poNumber }, 201);
});

adminProductionRoutes.patch("/orders/:id", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  const body = await parseBody(c, productionOrderUpdateSchema);
  const existing = await first(c.var.db, `SELECT id FROM production_orders WHERE id = ?`, id);
  if (!existing) return c.json({ error: "Production order not found" }, 404);
  const cols: Record<string, string> = {
    status: "status",
    currency: "currency",
    incoterms: "incoterms",
    issueDate: "issue_date",
    exFactoryDate: "ex_factory_date",
    receivedDate: "received_date",
    notes: "notes",
  };
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [key, col] of Object.entries(cols)) {
    if (key in body) {
      sets.push(`${col} = ?`);
      params.push((body as Record<string, unknown>)[key] ?? null);
    }
  }
  if (body.status === "received") sets.push(`received_date = COALESCE(received_date, date('now'))`);
  if (sets.length === 0) return c.json({ error: "No fields to update" }, 400);
  sets.push(`updated_at = datetime('now')`);
  await run(c.var.db, `UPDATE production_orders SET ${sets.join(", ")} WHERE id = ?`, ...params, id);
  await writeAudit(c.var.db, c.var.userId, "production_order.update", "production_order", id, body);
  return c.json({ ok: true });
});

adminProductionRoutes.delete("/orders/:id", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  const existing = await first<{ po_number: string }>(
    c.var.db,
    `SELECT po_number FROM production_orders WHERE id = ?`,
    id,
  );
  if (!existing) return c.json({ error: "Production order not found" }, 404);
  await run(c.var.db, `DELETE FROM production_order_items WHERE production_order_id = ?`, id);
  await run(c.var.db, `DELETE FROM production_orders WHERE id = ?`, id);
  await writeAudit(c.var.db, c.var.userId, "production_order.delete", "production_order", id, {
    poNumber: existing.po_number,
  });
  return c.json({ ok: true });
});

adminProductionRoutes.post("/orders/:id/items", requireAdminWrite, async (c) => {
  const poId = c.req.param("id");
  const body = await parseBody(c, productionOrderItemSchema);
  const po = await first<{ currency: string }>(
    c.var.db,
    `SELECT currency FROM production_orders WHERE id = ?`,
    poId,
  );
  if (!po) return c.json({ error: "Production order not found" }, 404);
  const id = newId("poi");
  await run(
    c.var.db,
    `INSERT INTO production_order_items
       (id, production_order_id, style_id, description, quantity, unit_cost_cents, currency)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    id,
    poId,
    body.styleId ?? null,
    body.description,
    body.quantity,
    body.unitCostCents ?? null,
    po.currency,
  );
  await recomputePoTotal(c.var.db, poId);
  return c.json({ id }, 201);
});

adminProductionRoutes.delete("/orders/:id/items/:itemId", requireAdminWrite, async (c) => {
  const poId = c.req.param("id");
  const itemId = c.req.param("itemId");
  const item = await first(
    c.var.db,
    `SELECT id FROM production_order_items WHERE id = ? AND production_order_id = ?`,
    itemId,
    poId,
  );
  if (!item) return c.json({ error: "Line item not found" }, 404);
  await run(c.var.db, `DELETE FROM production_order_items WHERE id = ?`, itemId);
  await recomputePoTotal(c.var.db, poId);
  return c.json({ ok: true });
});
