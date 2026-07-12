import { Hono } from "hono";
import { z } from "zod";
import { all, first, run } from "../services/db";
import { parseBody } from "../services/validators";
import { requireAdminWrite } from "../middleware/auth";
import { rateLimit } from "../middleware/rate-limit";
import { newId } from "../utils/id";
import { emit } from "../services/activity";
import type { AppContext } from "../types/env";

/**
 * Book a consult — the public door into the Client Book. A visitor leaves
 * their name and when suits them; the studio confirms (which creates or
 * matches a client and writes the consult to their timeline) or declines.
 * Email reminders arrive with the email wave; nothing here depends on them.
 */
export const publicBookingRoutes = new Hono<AppContext>();
export const adminBookingRoutes = new Hono<AppContext>();

const bookingSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().max(255).optional().nullable(),
  phone: z.string().max(60).optional().nullable(),
  note: z.string().max(2000).optional().nullable(),
  preferredAt: z.string().max(120).optional().nullable(),
});

publicBookingRoutes.post(
  "/",
  rateLimit({ key: "booking", limit: 6, windowSeconds: 3600 }),
  async (c) => {
    const body = await parseBody(c, bookingSchema);
    if (!body.email?.trim() && !body.phone?.trim()) {
      return c.json({ error: "Leave an email or a phone number so the studio can reach you." }, 400);
    }
    await run(
      c.var.db,
      `INSERT INTO booking_requests (id, name, email, phone, note, preferred_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      newId("book"),
      body.name.trim(),
      body.email?.trim() || null,
      body.phone?.trim() || null,
      body.note?.trim() || null,
      body.preferredAt?.trim() || null,
    );
    return c.json({ ok: true }, 201);
  },
);

adminBookingRoutes.get("/", async (c) => {
  try {
    const rows = await all<{
      id: string;
      name: string;
      email: string | null;
      phone: string | null;
      note: string | null;
      preferred_at: string | null;
      status: string;
      client_id: string | null;
      created_at: string;
    }>(c.var.db, `SELECT * FROM booking_requests ORDER BY status = 'new' DESC, created_at DESC LIMIT 100`);
    return c.json(
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        phone: r.phone,
        note: r.note,
        preferredAt: r.preferred_at,
        status: r.status,
        clientId: r.client_id,
        createdAt: r.created_at,
      })),
    );
  } catch {
    return c.json([]);
  }
});

// Confirming a consult makes the person REAL: an existing client is matched
// by email (or exact name), otherwise one is created; the consult lands on
// their timeline with the visitor's own words.
adminBookingRoutes.post("/:id/confirm", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  const req = await first<{
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    note: string | null;
    preferred_at: string | null;
    status: string;
  }>(c.var.db, `SELECT * FROM booking_requests WHERE id = ?`, id);
  if (!req) return c.json({ error: "Request not found" }, 404);
  if (req.status !== "new") return c.json({ error: "Already handled." }, 400);

  let client = req.email
    ? await first<{ id: string }>(c.var.db, `SELECT id FROM clients WHERE lower(email) = lower(?)`, req.email)
    : null;
  if (!client) {
    client = await first<{ id: string }>(c.var.db, `SELECT id FROM clients WHERE lower(name) = lower(?)`, req.name);
  }
  let created = false;
  if (!client) {
    const cid = newId("client");
    await run(
      c.var.db,
      `INSERT INTO clients (id, name, email, phone) VALUES (?, ?, ?, ?)`,
      cid,
      req.name,
      req.email,
      req.phone,
    );
    client = { id: cid };
    created = true;
  }
  await run(
    c.var.db,
    `INSERT INTO client_events (id, client_id, kind, subject, body_md)
     VALUES (?, ?, 'consult', ?, ?)`,
    newId("cev"),
    client.id,
    `Consult booked${req.preferred_at ? ` — ${req.preferred_at}` : ""}`,
    req.note,
  );
  await run(
    c.var.db,
    `UPDATE booking_requests SET status = 'confirmed', client_id = ? WHERE id = ?`,
    client.id,
    id,
  );
  if (created) {
    await emit(
      c.var.db,
      {
        kind: "client.created",
        entityType: "client",
        entityId: client.id,
        title: `New client from a consult booking: ${req.name}`,
        payload: { clientId: client.id, name: req.name },
      },
      { env: c.env, ctx: c.executionCtx },
    );
  }
  return c.json({ ok: true, clientId: client.id });
});

adminBookingRoutes.post("/:id/decline", requireAdminWrite, async (c) => {
  const result = await run(
    c.var.db,
    `UPDATE booking_requests SET status = 'declined' WHERE id = ? AND status = 'new'`,
    c.req.param("id"),
  );
  if (!result.meta.changes) return c.json({ error: "Request not found or already handled." }, 400);
  return c.json({ ok: true });
});
