import { Hono } from "hono";
import { z } from "zod";
import { all, first, run } from "../services/db";
import { parseBody } from "../services/validators";
import { requireAdminWrite, requireAdminOnly } from "../middleware/auth";
import { newId, randomToken, sha256Hex } from "../utils/id";
import type { AppContext } from "../types/env";

/**
 * The Client Book — the people a designer, stylist or tailor works with.
 * A client owns a measurement HISTORY (dated, append-only: bodies change),
 * style notes, a timeline of fittings and conversations, and links to the
 * work: saved patterns (fitting_looks) and model photos (fitting_models).
 * A client may optionally reference a storefront customer account; the two
 * are never merged. Deleting a client removes their measurements and
 * timeline and unlinks (not deletes) their patterns and photos — the
 * client's body data belongs to them.
 */
export const adminClientRoutes = new Hono<AppContext>();

type ClientRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  customer_id: string | null;
  style_notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

const clientSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().max(255).optional().nullable(),
  phone: z.string().max(60).optional().nullable(),
  customerId: z.string().max(60).optional().nullable(),
  styleNotes: z.string().max(8000).optional().nullable(),
  status: z.enum(["active", "archived"]).optional(),
});

function mapClient(r: ClientRow) {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    customerId: r.customer_id,
    styleNotes: r.style_notes,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

adminClientRoutes.get("/", async (c) => {
  try {
    const rows = await all<ClientRow & { measurement_count: number; look_count: number; model_count: number; last_event_at: string | null }>(
      c.var.db,
      `SELECT cl.*,
         (SELECT COUNT(*) FROM client_measurements m WHERE m.client_id = cl.id) AS measurement_count,
         (SELECT COUNT(*) FROM fitting_looks l WHERE l.client_id = cl.id) AS look_count,
         (SELECT COUNT(*) FROM fitting_models fm WHERE fm.client_id = cl.id) AS model_count,
         (SELECT MAX(event_at) FROM client_events e WHERE e.client_id = cl.id) AS last_event_at
       FROM clients cl
       ORDER BY cl.status = 'archived', cl.updated_at DESC`,
    );
    return c.json(
      rows.map((r) => ({
        ...mapClient(r),
        measurementCount: r.measurement_count,
        lookCount: r.look_count,
        modelCount: r.model_count,
        lastEventAt: r.last_event_at,
      })),
    );
  } catch {
    // Table not migrated on this shop DB yet — an empty book, not an error.
    return c.json([]);
  }
});

adminClientRoutes.post("/", requireAdminWrite, async (c) => {
  const body = await parseBody(c, clientSchema);
  const id = newId("client");
  await run(
    c.var.db,
    `INSERT INTO clients (id, name, email, phone, customer_id, style_notes, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    id,
    body.name.trim(),
    body.email?.trim() || null,
    body.phone?.trim() || null,
    body.customerId || null,
    body.styleNotes || null,
    body.status ?? "active",
  );
  const row = await first<ClientRow>(c.var.db, `SELECT * FROM clients WHERE id = ?`, id);
  return c.json(mapClient(row!), 201);
});

/**
 * Adopt the existing made-to-measure book: every saved pattern whose fit
 * carries measurements but has no client yet becomes (or joins) a client
 * named after it. One click brings years of "name it after a client"
 * convention into the real Client Book.
 */
adminClientRoutes.post("/adopt-existing", requireAdminWrite, async (c) => {
  const looks = await all<{ id: string; name: string; fit_json: string; created_at: string }>(
    c.var.db,
    `SELECT id, name, fit_json, created_at FROM fitting_looks WHERE client_id IS NULL`,
  );
  let created = 0;
  let linked = 0;
  for (const look of looks) {
    let fit: { measurements?: Record<string, unknown> } = {};
    try {
      fit = JSON.parse(look.fit_json || "{}");
    } catch {
      continue;
    }
    const meas = Object.entries(fit.measurements ?? {}).filter(([, v]) => v != null && v !== "");
    if (!meas.length) continue; // not a made-to-measure record
    const name = look.name.trim();
    if (!name) continue;
    let client = await first<ClientRow>(c.var.db, `SELECT * FROM clients WHERE lower(name) = lower(?)`, name);
    if (!client) {
      const id = newId("client");
      await run(c.var.db, `INSERT INTO clients (id, name) VALUES (?, ?)`, id, name);
      client = (await first<ClientRow>(c.var.db, `SELECT * FROM clients WHERE id = ?`, id))!;
      created++;
    }
    await run(c.var.db, `UPDATE fitting_looks SET client_id = ? WHERE id = ?`, client.id, look.id);
    linked++;
    // The look's measurements become that client's earliest dated set —
    // skipped if an identical set was already adopted.
    const json = JSON.stringify(Object.fromEntries(meas));
    const dup = await first<{ id: string }>(
      c.var.db,
      `SELECT id FROM client_measurements WHERE client_id = ? AND measurements_json = ?`,
      client.id,
      json,
    );
    if (!dup) {
      await run(
        c.var.db,
        `INSERT INTO client_measurements (id, client_id, taken_at, measurements_json, note)
         VALUES (?, ?, ?, ?, ?)`,
        newId("meas"),
        client.id,
        look.created_at,
        json,
        `Adopted from saved pattern “${look.name}”`,
      );
    }
  }
  return c.json({ ok: true, created, linked });
});

adminClientRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const client = await first<ClientRow>(c.var.db, `SELECT * FROM clients WHERE id = ?`, id);
  if (!client) return c.json({ error: "Client not found" }, 404);
  const [measurements, events, looks, models, customer, commissions] = await Promise.all([
    all<{ id: string; taken_at: string; measurements_json: string; note: string | null }>(
      c.var.db,
      `SELECT id, taken_at, measurements_json, note FROM client_measurements
       WHERE client_id = ? ORDER BY taken_at DESC`,
      id,
    ),
    all<{ id: string; kind: string; subject: string | null; body_md: string | null; event_at: string; commission_id?: string | null }>(
      c.var.db,
      `SELECT id, kind, subject, body_md, event_at, commission_id FROM client_events
       WHERE client_id = ? ORDER BY event_at DESC`,
      id,
    ),
    all<{ id: string; name: string; garment_id: string; style_id: string | null; updated_at: string }>(
      c.var.db,
      `SELECT id, name, garment_id, style_id, updated_at FROM fitting_looks
       WHERE client_id = ? ORDER BY updated_at DESC`,
      id,
    ),
    all<{ id: string; label: string; file_id: string; source: string; created_at: string }>(
      c.var.db,
      `SELECT id, label, file_id, source, created_at FROM fitting_models
       WHERE client_id = ? ORDER BY created_at DESC`,
      id,
    ),
    client.customer_id
      ? first<{ id: string; email: string; name: string | null }>(
          c.var.db,
          `SELECT id, email, name FROM customers WHERE id = ?`,
          client.customer_id,
        )
      : Promise.resolve(null),
    all<{ id: string; title: string; kind: string; stage: string; due_at: string | null; price_cents: number | null; updated_at: string }>(
      c.var.db,
      `SELECT id, title, kind, stage, due_at, price_cents, updated_at FROM commissions
       WHERE client_id = ? ORDER BY stage IN ('done','cancelled'), updated_at DESC`,
      id,
    ).catch(() => []),
  ]);
  const payments = await all<{
    commission_id: string;
    id: string;
    label: string;
    amount_cents: number;
    status: string;
    paid_at: string | null;
  }>(
    c.var.db,
    `SELECT commission_id, id, label, amount_cents, status, paid_at FROM commission_payments
     WHERE commission_id IN (SELECT id FROM commissions WHERE client_id = ?) AND status != 'void'
     ORDER BY created_at`,
    id,
  ).catch(() => []);
  return c.json({
    ...mapClient(client),
    measurements: measurements.map((m) => ({
      id: m.id,
      takenAt: m.taken_at,
      measurements: JSON.parse(m.measurements_json || "{}"),
      note: m.note,
    })),
    events: events.map((e) => ({
      id: e.id,
      kind: e.kind,
      subject: e.subject,
      body: e.body_md,
      eventAt: e.event_at,
      commissionId: e.commission_id ?? null,
    })),
    commissions: commissions.map((co) => ({
      id: co.id,
      title: co.title,
      kind: co.kind,
      stage: co.stage,
      dueAt: co.due_at,
      priceCents: co.price_cents,
      updatedAt: co.updated_at,
      payments: payments
        .filter((pm) => pm.commission_id === co.id)
        .map((pm) => ({ id: pm.id, label: pm.label, amountCents: pm.amount_cents, status: pm.status, paidAt: pm.paid_at })),
    })),
    looks: looks.map((l) => ({
      id: l.id,
      name: l.name,
      garmentId: l.garment_id,
      styleId: l.style_id,
      updatedAt: l.updated_at,
    })),
    models: models.map((m) => ({
      id: m.id,
      label: m.label,
      fileId: m.file_id,
      source: m.source,
      createdAt: m.created_at,
    })),
    customer,
  });
});

adminClientRoutes.put("/:id", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  const body = await parseBody(c, clientSchema.partial());
  const existing = await first<ClientRow>(c.var.db, `SELECT * FROM clients WHERE id = ?`, id);
  if (!existing) return c.json({ error: "Client not found" }, 404);
  await run(
    c.var.db,
    `UPDATE clients SET name = ?, email = ?, phone = ?, customer_id = ?, style_notes = ?, status = ?,
       updated_at = datetime('now') WHERE id = ?`,
    body.name?.trim() ?? existing.name,
    body.email !== undefined ? body.email?.trim() || null : existing.email,
    body.phone !== undefined ? body.phone?.trim() || null : existing.phone,
    body.customerId !== undefined ? body.customerId || null : existing.customer_id,
    body.styleNotes !== undefined ? body.styleNotes || null : existing.style_notes,
    body.status ?? existing.status,
    id,
  );
  const row = await first<ClientRow>(c.var.db, `SELECT * FROM clients WHERE id = ?`, id);
  return c.json(mapClient(row!));
});

// Deleting a client is the privacy path: measurements and timeline go with
// them (CASCADE); saved patterns and photos are unlinked, not destroyed.
adminClientRoutes.delete("/:id", requireAdminOnly, async (c) => {
  const id = c.req.param("id");
  const result = await run(c.var.db, `DELETE FROM clients WHERE id = ?`, id);
  if (!result.meta.changes) return c.json({ error: "Client not found" }, 404);
  return c.json({ ok: true });
});

/**
 * Portal invite: a one-time link (14 days) that signs this client into
 * their portal. Always returned for copy/share; also emailed when the
 * client has an email AND buyer email is configured (a logged no-op
 * otherwise, per the email house rule).
 */
adminClientRoutes.post("/:id/portal-link", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  const client = await first<ClientRow>(c.var.db, `SELECT * FROM clients WHERE id = ?`, id);
  if (!client) return c.json({ error: "Client not found" }, 404);
  const token = randomToken(24);
  await run(
    c.var.db,
    `INSERT INTO client_portal_tokens (id, client_id, token_hash, expires_at)
     VALUES (?, ?, ?, datetime('now', '+14 days'))`,
    newId("cpt"),
    id,
    await sha256Hex(token),
  );
  const origin = new URL(c.req.url).origin;
  const { getPrimaryShopBase } = await import("../services/shops");
  const shopBase = c.var.shopSlug ? `/${c.var.shopSlug}` : await getPrimaryShopBase(c.env.DB);
  const base = (c.env.APP_ENV === "development" ? origin : c.env.APP_URL || origin) + shopBase;
  const link = `${base}/portal?token=${encodeURIComponent(token)}`;
  let emailed = false;
  if (client.email) {
    try {
      const { buyerEmailConfigured, sendBuyerEmail } = await import("../services/buyer-email");
      const { getEmailBrand, renderBrandedEmail } = await import("../services/email-template");
      emailed = buyerEmailConfigured(c.env);
      const brand = await getEmailBrand(c.env, c.var.db);
      const html = renderBrandedEmail({
        brand,
        preheader: `Your fitting portal at ${brand.name}`,
        heading: `Your portal at ${brand.name}`,
        bodyHtml:
          `<p style="margin:0 0 16px;">See your pieces in progress, your fittings and your renders — and approve designs when you're happy. The link below signs you in; it works once and lasts 14 days.</p>` +
          `<p style="margin:0 0 20px;"><a href="${link}" style="display:inline-block;background:#1c2b3a;color:#fff;padding:12px 22px;border-radius:6px;text-decoration:none;">Open my portal</a></p>`,
        footerNote: `Sent by ${brand.name} for their client fittings.`,
      });
      await sendBuyerEmail(c.env, {
        to: client.email,
        subject: `Your fitting portal at ${brand.name}`,
        text: `Open your portal at ${brand.name}:\n\n${link}\n\nThe link signs you in; it works once and lasts 14 days.`,
        html,
      });
    } catch (err) {
      console.error("[clients] portal email failed:", String(err).slice(0, 160));
      emailed = false;
    }
  }
  return c.json({ ok: true, link, emailed });
});

const measurementSchema = z.object({
  measurements: z.record(z.string(), z.union([z.number(), z.string(), z.null()])),
  takenAt: z.string().max(40).optional(),
  note: z.string().max(500).optional().nullable(),
});

adminClientRoutes.post("/:id/measurements", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  const client = await first<{ id: string }>(c.var.db, `SELECT id FROM clients WHERE id = ?`, id);
  if (!client) return c.json({ error: "Client not found" }, 404);
  const body = await parseBody(c, measurementSchema);
  const entries = Object.entries(body.measurements).filter(([, v]) => v != null && v !== "");
  if (!entries.length) return c.json({ error: "Add at least one measurement." }, 400);
  const mid = newId("meas");
  await run(
    c.var.db,
    `INSERT INTO client_measurements (id, client_id, taken_at, measurements_json, note)
     VALUES (?, ?, ?, ?, ?)`,
    mid,
    id,
    body.takenAt || new Date().toISOString().slice(0, 19).replace("T", " "),
    JSON.stringify(Object.fromEntries(entries)).slice(0, 8000),
    body.note || null,
  );
  await run(c.var.db, `UPDATE clients SET updated_at = datetime('now') WHERE id = ?`, id);
  return c.json({ ok: true, id: mid }, 201);
});

adminClientRoutes.delete("/:id/measurements/:mid", requireAdminWrite, async (c) => {
  const result = await run(
    c.var.db,
    `DELETE FROM client_measurements WHERE id = ? AND client_id = ?`,
    c.req.param("mid"),
    c.req.param("id"),
  );
  if (!result.meta.changes) return c.json({ error: "Measurement set not found" }, 404);
  return c.json({ ok: true });
});

const eventSchema = z.object({
  kind: z.enum(["note", "consult", "fitting", "delivery", "occasion"]).optional(),
  subject: z.string().max(200).optional().nullable(),
  body: z.string().max(8000).optional().nullable(),
  eventAt: z.string().max(40).optional(),
});

adminClientRoutes.post("/:id/events", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  const client = await first<{ id: string }>(c.var.db, `SELECT id FROM clients WHERE id = ?`, id);
  if (!client) return c.json({ error: "Client not found" }, 404);
  const body = await parseBody(c, eventSchema);
  if (!body.subject?.trim() && !body.body?.trim()) {
    return c.json({ error: "Write a note first." }, 400);
  }
  const eid = newId("cev");
  await run(
    c.var.db,
    `INSERT INTO client_events (id, client_id, kind, subject, body_md, event_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    eid,
    id,
    body.kind ?? "note",
    body.subject?.trim() || null,
    body.body || null,
    body.eventAt || new Date().toISOString().slice(0, 19).replace("T", " "),
  );
  await run(c.var.db, `UPDATE clients SET updated_at = datetime('now') WHERE id = ?`, id);
  return c.json({ ok: true, id: eid }, 201);
});

adminClientRoutes.delete("/:id/events/:eid", requireAdminWrite, async (c) => {
  const result = await run(
    c.var.db,
    `DELETE FROM client_events WHERE id = ? AND client_id = ?`,
    c.req.param("eid"),
    c.req.param("id"),
  );
  if (!result.meta.changes) return c.json({ error: "Entry not found" }, 404);
  return c.json({ ok: true });
});

const linkSchema = z.object({
  lookId: z.string().max(60).optional(),
  modelId: z.string().max(60).optional(),
  // null client detaches
  detach: z.boolean().optional(),
});

// Link (or detach) a saved pattern or model photo to this client.
adminClientRoutes.post("/:id/link", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  const body = await parseBody(c, linkSchema);
  const target = body.detach ? null : id;
  if (!body.detach) {
    const client = await first<{ id: string }>(c.var.db, `SELECT id FROM clients WHERE id = ?`, id);
    if (!client) return c.json({ error: "Client not found" }, 404);
  }
  if (body.lookId) {
    await run(c.var.db, `UPDATE fitting_looks SET client_id = ? WHERE id = ?`, target, body.lookId);
  }
  if (body.modelId) {
    await run(c.var.db, `UPDATE fitting_models SET client_id = ? WHERE id = ?`, target, body.modelId);
  }
  return c.json({ ok: true });
});
