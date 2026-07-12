import { Hono } from "hono";
import { z } from "zod";
import { first, run } from "../services/db";
import { parseBody } from "../services/validators";
import { newId } from "../utils/id";
import { emit } from "../services/activity";
import { getShopBySlug, PRIMARY_SHOP_ID } from "../services/shops";
import { getShopDb } from "../services/tenant-db";
import type { AppContext, Env } from "../types/env";

/**
 * Inbound webhooks — the other half of the Zapier bridge. Zapier (or Make,
 * n8n, your own script) POSTs here to feed data INTO Verto: turn a new Gmail
 * into a note, a form submission into a client, a calendar invite into a
 * consult booking. No Google OAuth, no app to build — you wire the source in
 * the tool you already use, and point its webhook step at your shop's URL.
 *
 * The URL carries the shop slug (Zapier can't send our tenant header) and a
 * secret token the shop generates in Settings; the token both authorises the
 * call and, with the slug, scopes it to exactly one shop's database. Every
 * inbound call is create-only and emits `inbound.received`, so a shop's own
 * workflows can react to it.
 */
export const publicHookRoutes = new Hono<AppContext>();

const payloadSchema = z.object({
  type: z.enum(["note", "client", "booking"]).optional(),
  // shared / note
  subject: z.string().max(300).optional().nullable(),
  body: z.string().max(8000).optional().nullable(),
  // client / booking
  name: z.string().max(160).optional().nullable(),
  email: z.string().max(255).optional().nullable(),
  phone: z.string().max(60).optional().nullable(),
  note: z.string().max(4000).optional().nullable(),
  preferredAt: z.string().max(120).optional().nullable(),
  // route a note onto a specific client's timeline
  clientEmail: z.string().max(255).optional().nullable(),
});

publicHookRoutes.post("/:shopSlug/in/:token", async (c) => {
  const slug = c.req.param("shopSlug");
  const token = c.req.param("token");
  const shop = await getShopBySlug(c.env.DB, slug);
  if (!shop) return c.json({ error: "Unknown shop" }, 404);
  const db = getShopDb(c.env, shop.id, PRIMARY_SHOP_ID);

  const saved = await first<{ value: string }>(db, `SELECT value FROM settings WHERE key = 'inbound_webhook_token'`).catch(
    () => null,
  );
  if (!saved?.value) return c.json({ error: "Inbound webhooks aren't enabled for this shop." }, 403);
  // Length-checked constant-time-ish compare.
  if (token.length !== saved.value.length || token !== saved.value) {
    return c.json({ error: "Invalid token." }, 401);
  }

  const body = await parseBody(c, payloadSchema);
  const type = body.type ?? "note";
  const opts = { env: c.env, ctx: c.executionCtx };

  if (type === "client") {
    if (!body.name?.trim()) return c.json({ error: "A client needs a name." }, 400);
    const id = newId("client");
    await run(
      db,
      `INSERT INTO clients (id, name, email, phone, style_notes) VALUES (?, ?, ?, ?, ?)`,
      id,
      body.name.trim(),
      body.email?.trim() || null,
      body.phone?.trim() || null,
      body.note?.trim() || null,
    );
    await emit(
      db,
      {
        kind: "client.created",
        entityType: "client",
        entityId: id,
        title: `New client via webhook: ${body.name.trim()}`,
        payload: { clientId: id, name: body.name.trim() },
      },
      opts,
    );
    await emitInbound(db, "client", `Client added via webhook: ${body.name.trim()}`, opts);
    return c.json({ ok: true, created: "client", id }, 201);
  }

  if (type === "booking") {
    if (!body.name?.trim()) return c.json({ error: "A booking needs a name." }, 400);
    const id = newId("book");
    await run(
      db,
      `INSERT INTO booking_requests (id, name, email, phone, note, preferred_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      id,
      body.name.trim(),
      body.email?.trim() || null,
      body.phone?.trim() || null,
      body.note?.trim() || null,
      body.preferredAt?.trim() || null,
    );
    await emitInbound(db, "booking", `Consult request via webhook: ${body.name.trim()}`, opts);
    return c.json({ ok: true, created: "booking", id }, 201);
  }

  // Default: a note. Lands in the activity feed, and — if it names a known
  // client by email — on that client's timeline too.
  const subject = body.subject?.trim() || "Inbound note";
  const noteBody = body.body?.trim() || "";
  let clientId: string | null = null;
  if (body.clientEmail?.trim()) {
    const match = await first<{ id: string }>(
      db,
      `SELECT id FROM clients WHERE lower(email) = lower(?)`,
      body.clientEmail.trim(),
    ).catch(() => null);
    if (match) {
      clientId = match.id;
      await run(
        db,
        `INSERT INTO client_events (id, client_id, kind, subject, body_md, event_at)
         VALUES (?, ?, 'note', ?, ?, datetime('now'))`,
        newId("cev"),
        clientId,
        subject.slice(0, 200),
        noteBody || null,
      ).catch(() => {});
    }
  }
  await emitInbound(db, "note", subject.slice(0, 200), opts, { subject, body: noteBody, clientId });
  return c.json({ ok: true, created: "note", clientId }, 201);
});

async function emitInbound(
  db: D1Database,
  kind: string,
  title: string,
  opts: { env: Env; ctx: { waitUntil: (p: Promise<unknown>) => void } },
  extra?: Record<string, unknown>,
) {
  await emit(
    db,
    {
      kind: "inbound.received",
      entityType: "webhook",
      entityId: kind,
      title,
      payload: { inboundType: kind, ...extra },
    },
    opts,
  );
}
