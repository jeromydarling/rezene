import { Hono } from "hono";
import { z } from "zod";
import { all, first, run } from "../services/db";
import { parseBody } from "../services/validators";
import { requireAdminWrite } from "../middleware/auth";
import { newId } from "../utils/id";
import type { AppContext } from "../types/env";

/**
 * Commissions — the staged pipeline of work a tailor or stylist does for a
 * client: consult → design approved → fabric sourced → cutting → fittings →
 * delivery. Alterations run the same machinery with a shorter stage list.
 * Stage changes and fittings write to the client's timeline (tagged with
 * the commission), so the client page tells one continuous story.
 */
export const adminCommissionRoutes = new Hono<AppContext>();

export const COMMISSION_STAGES = [
  "consult",
  "design",
  "fabric",
  "cutting",
  "fitting",
  "delivery",
  "done",
  "cancelled",
] as const;

// Alterations skip the design/fabric/cutting development stages.
export const ALTERATION_STAGES = ["consult", "fitting", "delivery", "done", "cancelled"] as const;

const STAGE_LABELS: Record<string, string> = {
  consult: "Consult",
  design: "Design approved",
  fabric: "Fabric sourced",
  cutting: "Cutting",
  fitting: "Fittings",
  delivery: "Delivery",
  done: "Done",
  cancelled: "Cancelled",
};

type CommissionRow = {
  id: string;
  client_id: string;
  title: string;
  kind: string;
  stage: string;
  look_id: string | null;
  style_id: string | null;
  brief_md: string | null;
  due_at: string | null;
  price_cents: number | null;
  created_at: string;
  updated_at: string;
  client_name?: string;
  look_name?: string | null;
  style_name?: string | null;
};

const COMMISSION_SELECT = `
  SELECT co.*, cl.name AS client_name, l.name AS look_name, s.name AS style_name
  FROM commissions co
  JOIN clients cl ON cl.id = co.client_id
  LEFT JOIN fitting_looks l ON l.id = co.look_id
  LEFT JOIN styles s ON s.id = co.style_id`;

function mapCommission(r: CommissionRow) {
  return {
    id: r.id,
    clientId: r.client_id,
    clientName: r.client_name,
    title: r.title,
    kind: r.kind,
    stage: r.stage,
    stageLabel: STAGE_LABELS[r.stage] ?? r.stage,
    lookId: r.look_id,
    lookName: r.look_name ?? null,
    styleId: r.style_id,
    styleName: r.style_name ?? null,
    brief: r.brief_md,
    dueAt: r.due_at,
    priceCents: r.price_cents,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

adminCommissionRoutes.get("/", async (c) => {
  try {
    const rows = await all<CommissionRow>(
      c.var.db,
      `${COMMISSION_SELECT} ORDER BY co.stage IN ('done','cancelled'), co.due_at IS NULL, co.due_at, co.updated_at DESC`,
    );
    return c.json(rows.map(mapCommission));
  } catch {
    // Table not migrated on this shop DB yet — an empty pipeline.
    return c.json([]);
  }
});

const commissionSchema = z.object({
  clientId: z.string().max(60),
  title: z.string().min(1).max(160),
  kind: z.enum(["commission", "alteration"]).optional(),
  brief: z.string().max(8000).optional().nullable(),
  dueAt: z.string().max(40).optional().nullable(),
  priceCents: z.number().int().min(0).max(100_000_000).optional().nullable(),
  lookId: z.string().max(60).optional().nullable(),
  styleId: z.string().max(60).optional().nullable(),
});

adminCommissionRoutes.post("/", requireAdminWrite, async (c) => {
  const body = await parseBody(c, commissionSchema);
  const client = await first<{ id: string; name: string }>(
    c.var.db,
    `SELECT id, name FROM clients WHERE id = ?`,
    body.clientId,
  );
  if (!client) return c.json({ error: "Client not found" }, 404);
  const id = newId("comm");
  await run(
    c.var.db,
    `INSERT INTO commissions (id, client_id, title, kind, brief_md, due_at, price_cents, look_id, style_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    body.clientId,
    body.title.trim(),
    body.kind ?? "commission",
    body.brief || null,
    body.dueAt || null,
    body.priceCents ?? null,
    body.lookId || null,
    body.styleId || null,
  );
  await run(
    c.var.db,
    `INSERT INTO client_events (id, client_id, commission_id, kind, subject)
     VALUES (?, ?, ?, 'consult', ?)`,
    newId("cev"),
    body.clientId,
    id,
    `${body.kind === "alteration" ? "Alteration" : "Commission"} opened: ${body.title.trim()}`,
  );
  const row = await first<CommissionRow>(c.var.db, `${COMMISSION_SELECT} WHERE co.id = ?`, id);
  return c.json(mapCommission(row!), 201);
});

adminCommissionRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const row = await first<CommissionRow>(c.var.db, `${COMMISSION_SELECT} WHERE co.id = ?`, id);
  if (!row) return c.json({ error: "Commission not found" }, 404);
  const [events, photos] = await Promise.all([
    all<{ id: string; kind: string; subject: string | null; body_md: string | null; event_at: string }>(
      c.var.db,
      `SELECT id, kind, subject, body_md, event_at FROM client_events
       WHERE commission_id = ? ORDER BY event_at DESC`,
      id,
    ),
    all<{ id: string; alt_text: string | null; created_at: string }>(
      c.var.db,
      `SELECT id, alt_text, created_at FROM files
       WHERE entity_type = 'commission' AND entity_id = ? ORDER BY created_at DESC`,
      id,
    ),
  ]);
  return c.json({
    ...mapCommission(row),
    events: events.map((e) => ({
      id: e.id,
      kind: e.kind,
      subject: e.subject,
      body: e.body_md,
      eventAt: e.event_at,
    })),
    photos: photos.map((p) => ({ id: p.id, url: `/media/${p.id}`, alt: p.alt_text, createdAt: p.created_at })),
  });
});

const updateSchema = commissionSchema.partial().extend({
  stage: z.enum(COMMISSION_STAGES).optional(),
});

adminCommissionRoutes.put("/:id", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  const existing = await first<CommissionRow>(c.var.db, `SELECT * FROM commissions WHERE id = ?`, id);
  if (!existing) return c.json({ error: "Commission not found" }, 404);
  const body = await parseBody(c, updateSchema);
  if (body.stage && existing.kind === "alteration" && !(ALTERATION_STAGES as readonly string[]).includes(body.stage)) {
    return c.json({ error: "Alterations only move between consult, fitting, delivery and done." }, 400);
  }
  await run(
    c.var.db,
    `UPDATE commissions SET title = ?, stage = ?, brief_md = ?, due_at = ?, price_cents = ?, look_id = ?, style_id = ?,
       updated_at = datetime('now') WHERE id = ?`,
    body.title?.trim() ?? existing.title,
    body.stage ?? existing.stage,
    body.brief !== undefined ? body.brief || null : existing.brief_md,
    body.dueAt !== undefined ? body.dueAt || null : existing.due_at,
    body.priceCents !== undefined ? (body.priceCents ?? null) : existing.price_cents,
    body.lookId !== undefined ? body.lookId || null : existing.look_id,
    body.styleId !== undefined ? body.styleId || null : existing.style_id,
    id,
  );
  // A stage change is part of the client's story — log it on the timeline.
  if (body.stage && body.stage !== existing.stage) {
    await run(
      c.var.db,
      `INSERT INTO client_events (id, client_id, commission_id, kind, subject)
       VALUES (?, ?, ?, 'note', ?)`,
      newId("cev"),
      existing.client_id,
      id,
      `“${body.title?.trim() ?? existing.title}” moved to ${STAGE_LABELS[body.stage] ?? body.stage}`,
    );
  }
  const row = await first<CommissionRow>(c.var.db, `${COMMISSION_SELECT} WHERE co.id = ?`, id);
  return c.json(mapCommission(row!));
});

adminCommissionRoutes.delete("/:id", requireAdminWrite, async (c) => {
  const result = await run(c.var.db, `DELETE FROM commissions WHERE id = ?`, c.req.param("id"));
  if (!result.meta.changes) return c.json({ error: "Commission not found" }, 404);
  return c.json({ ok: true });
});

const fittingSchema = z.object({
  subject: z.string().max(200).optional().nullable(),
  body: z.string().max(8000).optional().nullable(),
  kind: z.enum(["fitting", "note", "consult", "delivery"]).optional(),
});

// Record a fitting (or note) against this commission — lands on the
// client's timeline tagged with the commission.
adminCommissionRoutes.post("/:id/fittings", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  const commission = await first<{ id: string; client_id: string }>(
    c.var.db,
    `SELECT id, client_id FROM commissions WHERE id = ?`,
    id,
  );
  if (!commission) return c.json({ error: "Commission not found" }, 404);
  const body = await parseBody(c, fittingSchema);
  if (!body.subject?.trim() && !body.body?.trim()) return c.json({ error: "Write the fitting note first." }, 400);
  const eid = newId("cev");
  await run(
    c.var.db,
    `INSERT INTO client_events (id, client_id, commission_id, kind, subject, body_md)
     VALUES (?, ?, ?, ?, ?, ?)`,
    eid,
    commission.client_id,
    id,
    body.kind ?? "fitting",
    body.subject?.trim() || null,
    body.body || null,
  );
  await run(c.var.db, `UPDATE commissions SET updated_at = datetime('now') WHERE id = ?`, id);
  return c.json({ ok: true, id: eid }, 201);
});
