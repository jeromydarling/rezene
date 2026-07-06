import { Hono } from "hono";
import { all, first, jsonArray, run, writeAudit } from "../services/db";
import {
  parseBody,
  supplierCreateSchema,
  supplierInteractionSchema,
  supplierUpdateSchema,
} from "../services/validators";
import { requireAdminWrite } from "../middleware/auth";
import { newId } from "../utils/id";
import type { AppContext } from "../types/env";
import type { AdminSupplier, AdminSupplierInteraction } from "../../shared/types";

export const adminSupplierRoutes = new Hono<AppContext>();

async function loadSupplier(db: D1Database, id: string): Promise<AdminSupplier | null> {
  const row = await first<Record<string, unknown>>(db, `SELECT * FROM suppliers WHERE id = ?`, id);
  if (!row) return null;
  const contacts = await all<Record<string, unknown>>(
    db,
    `SELECT id, name, role, email, phone, preferred_language FROM supplier_contacts WHERE supplier_id = ?`,
    id,
  );
  return mapSupplier(row, contacts);
}

function mapSupplier(
  row: Record<string, unknown>,
  contacts: Record<string, unknown>[] = [],
): AdminSupplier {
  return {
    id: row.id as string,
    name: row.name as string,
    kind: row.kind as string,
    city: (row.city as string) ?? null,
    country: (row.country as string) ?? null,
    address: (row.address as string) ?? null,
    mapUrl: (row.map_url as string) ?? null,
    email: (row.email as string) ?? null,
    phone: (row.phone as string) ?? null,
    whatsapp: (row.whatsapp as string) ?? null,
    website: (row.website as string) ?? null,
    languages: jsonArray(row.languages),
    capabilities: jsonArray(row.capabilities),
    moqUnits: (row.moq_units as number) ?? null,
    leadTimeDays: (row.lead_time_days as number) ?? null,
    onTimeScore: (row.on_time_score as number) ?? null,
    qualityScore: (row.quality_score as number) ?? null,
    isVerified: Boolean(row.is_verified),
    riskNotes: (row.risk_notes as string) ?? null,
    notes: (row.notes as string) ?? null,
    contacts: contacts.map((ct) => ({
      id: ct.id as string,
      name: ct.name as string,
      role: (ct.role as string) ?? null,
      email: (ct.email as string) ?? null,
      phone: (ct.phone as string) ?? null,
      preferredLanguage: (ct.preferred_language as string) ?? null,
    })),
  };
}

adminSupplierRoutes.get("/", async (c) => {
  const rows = await all<Record<string, unknown>>(
    c.var.db,
    `SELECT * FROM suppliers ORDER BY name`,
  );
  return c.json(rows.map((r) => mapSupplier(r)));
});

adminSupplierRoutes.get("/:id", async (c) => {
  const supplier = await loadSupplier(c.var.db, c.req.param("id"));
  if (!supplier) return c.json({ error: "Supplier not found" }, 404);

  const interactions = await all<Record<string, unknown>>(
    c.var.db,
    `SELECT * FROM supplier_interactions WHERE supplier_id = ? ORDER BY created_at DESC LIMIT 50`,
    supplier.id,
  );
  const samples = await all<Record<string, unknown>>(
    c.var.db,
    `SELECT sm.id, sm.round, sm.kind, sm.status, sm.requested_at, s.name AS style_name
     FROM samples sm JOIN styles s ON s.id = sm.style_id
     WHERE sm.supplier_id = ? ORDER BY sm.created_at DESC`,
    supplier.id,
  );
  const pos = await all<Record<string, unknown>>(
    c.var.db,
    `SELECT id, po_number, status, currency, total_cost_cents, ex_factory_date
     FROM production_orders WHERE supplier_id = ? ORDER BY created_at DESC`,
    supplier.id,
  );
  return c.json({
    ...supplier,
    interactions: interactions.map(mapInteraction),
    samples,
    productionOrders: pos,
  });
});

adminSupplierRoutes.post("/", requireAdminWrite, async (c) => {
  const body = await parseBody(c, supplierCreateSchema);
  const id = newId("sup");
  await run(
    c.var.db,
    `INSERT INTO suppliers (id, name, kind, city, country, address, map_url, email, phone, whatsapp, website,
       languages, capabilities, moq_units, lead_time_days, risk_notes, notes, is_verified)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    body.name,
    body.kind ?? "factory",
    body.city ?? null,
    body.country ?? null,
    body.address ?? null,
    body.mapUrl ?? null,
    body.email || null,
    body.phone ?? null,
    body.whatsapp ?? null,
    body.website ?? null,
    JSON.stringify(body.languages ?? []),
    JSON.stringify(body.capabilities ?? []),
    body.moqUnits ?? null,
    body.leadTimeDays ?? null,
    body.riskNotes ?? null,
    body.notes ?? null,
    body.isVerified ? 1 : 0,
  );
  await writeAudit(c.var.db, c.var.userId, "supplier.create", "supplier", id, { name: body.name });
  return c.json(await loadSupplier(c.var.db, id), 201);
});

adminSupplierRoutes.patch("/:id", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  const body = await parseBody(c, supplierUpdateSchema);
  const existing = await first(c.var.db, `SELECT id FROM suppliers WHERE id = ?`, id);
  if (!existing) return c.json({ error: "Supplier not found" }, 404);

  const sets: string[] = [];
  const params: unknown[] = [];
  const scalarMap: Record<string, string> = {
    name: "name",
    kind: "kind",
    city: "city",
    country: "country",
    address: "address",
    mapUrl: "map_url",
    email: "email",
    phone: "phone",
    whatsapp: "whatsapp",
    website: "website",
    moqUnits: "moq_units",
    leadTimeDays: "lead_time_days",
    riskNotes: "risk_notes",
    notes: "notes",
  };
  for (const [key, col] of Object.entries(scalarMap)) {
    if (key in body) {
      sets.push(`${col} = ?`);
      params.push((body as Record<string, unknown>)[key] ?? null);
    }
  }
  if ("languages" in body) {
    sets.push(`languages = ?`);
    params.push(JSON.stringify(body.languages ?? []));
  }
  if ("capabilities" in body) {
    sets.push(`capabilities = ?`);
    params.push(JSON.stringify(body.capabilities ?? []));
  }
  if ("isVerified" in body) {
    sets.push(`is_verified = ?`);
    params.push(body.isVerified ? 1 : 0);
  }
  if (sets.length === 0) return c.json({ error: "No fields to update" }, 400);
  sets.push(`updated_at = datetime('now')`);
  await run(c.var.db, `UPDATE suppliers SET ${sets.join(", ")} WHERE id = ?`, ...params, id);
  await writeAudit(c.var.db, c.var.userId, "supplier.update", "supplier", id, body);
  return c.json(await loadSupplier(c.var.db, id));
});

adminSupplierRoutes.delete("/:id", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  const existing = await first<{ name: string }>(
    c.var.db,
    `SELECT name FROM suppliers WHERE id = ?`,
    id,
  );
  if (!existing) return c.json({ error: "Supplier not found" }, 404);

  // production_orders references suppliers ON DELETE RESTRICT — don't silently
  // fail (or orphan a live PO). Block with a clear message so the merchant
  // deals with the order first rather than losing the paper trail.
  const po = await first<{ n: number }>(
    c.var.db,
    `SELECT COUNT(*) AS n FROM production_orders WHERE supplier_id = ?`,
    id,
  );
  if (po && po.n > 0) {
    return c.json(
      {
        error: `${existing.name} has ${po.n} production order${po.n === 1 ? "" : "s"}. Close or reassign those first — keeping the maker preserves that history.`,
        code: "supplier_has_orders",
      },
      409,
    );
  }

  // Children with ON DELETE CASCADE / SET NULL clean themselves up when FKs are
  // enforced; remove the CRM children explicitly so it works either way.
  await run(c.var.db, `DELETE FROM supplier_interactions WHERE supplier_id = ?`, id);
  await run(c.var.db, `DELETE FROM supplier_contacts WHERE supplier_id = ?`, id);
  await run(c.var.db, `DELETE FROM factories WHERE supplier_id = ?`, id);
  await run(c.var.db, `DELETE FROM suppliers WHERE id = ?`, id);
  await writeAudit(c.var.db, c.var.userId, "supplier.delete", "supplier", id, {
    name: existing.name,
  });
  return c.json({ ok: true });
});

adminSupplierRoutes.post("/:id/interactions", requireAdminWrite, async (c) => {
  const supplierId = c.req.param("id");
  const body = await parseBody(c, supplierInteractionSchema);
  const existing = await first(c.var.db, `SELECT id FROM suppliers WHERE id = ?`, supplierId);
  if (!existing) return c.json({ error: "Supplier not found" }, 404);
  const id = newId("sint");
  await run(
    c.var.db,
    `INSERT INTO supplier_interactions
       (id, supplier_id, kind, direction, subject, summary, follow_up_due, needs_response, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    supplierId,
    body.kind,
    body.direction ?? null,
    body.subject ?? null,
    body.summary ?? null,
    body.followUpDue ?? null,
    body.needsResponse ? 1 : 0,
    c.var.userId,
  );
  return c.json({ id }, 201);
});

function mapInteraction(row: Record<string, unknown>): AdminSupplierInteraction {
  return {
    id: row.id as string,
    supplierId: row.supplier_id as string,
    kind: row.kind as string,
    direction: (row.direction as string) ?? null,
    subject: (row.subject as string) ?? null,
    summary: (row.summary as string) ?? null,
    followUpDue: (row.follow_up_due as string) ?? null,
    needsResponse: Boolean(row.needs_response),
    createdAt: row.created_at as string,
  };
}
