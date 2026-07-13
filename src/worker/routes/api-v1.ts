import { Hono } from "hono";
import { z } from "zod";
import { all, first, run } from "../services/db";
import { parseBody } from "../services/validators";
import { newId, randomToken } from "../utils/id";
import { apiKeyAuth } from "../middleware/api-key";
import { ingestClient, ingestBooking, ingestNote } from "../services/inbound";
import { triggerByEvent, WORKFLOW_TRIGGERS } from "../../shared/workflows";
import type { AppContext } from "../types/env";

/**
 * The developer API — the bearer-authenticated surface behind the native
 * Zapier app (and any external tool). Every route is gated by a shop's
 * personal access token (`apiKeyAuth`), which names the shop, so calls are
 * tenant-scoped without the `x-verto-shop` header.
 *
 * Actions (create note/client/booking) reuse the same ingest service as the
 * inbound webhook. Triggers are served two ways: a polling list of recent
 * events (`GET /events`), and REST-Hook subscriptions (`/subscriptions`) that
 * the event spine fans out to.
 */
export const apiV1Routes = new Hono<AppContext>();

apiV1Routes.use("*", apiKeyAuth);

// --- Connection test ---------------------------------------------------------
apiV1Routes.get("/me", async (c) => {
  const brand = await first<{ value: string }>(c.var.db, `SELECT value FROM settings WHERE key = 'brand_name'`).catch(
    () => null,
  );
  return c.json({
    shop: { slug: c.var.shopSlug, name: brand?.value?.trim() || c.var.shopSlug },
    roles: c.var.roles,
  });
});

// --- Actions (Zapier "creates") ---------------------------------------------
const clientSchema = z.object({
  name: z.string().min(1).max(160),
  email: z.string().max(255).optional().nullable(),
  phone: z.string().max(60).optional().nullable(),
  note: z.string().max(4000).optional().nullable(),
});
apiV1Routes.post("/clients", async (c) => {
  const body = await parseBody(c, clientSchema);
  const { id } = await ingestClient(c.var.db, body, { env: c.env, ctx: c.executionCtx }, "zapier");
  return c.json({ ok: true, id }, 201);
});

const bookingSchema = clientSchema.extend({ preferredAt: z.string().max(120).optional().nullable() });
apiV1Routes.post("/bookings", async (c) => {
  const body = await parseBody(c, bookingSchema);
  const { id } = await ingestBooking(c.var.db, body, { env: c.env, ctx: c.executionCtx }, "zapier");
  return c.json({ ok: true, id }, 201);
});

const noteSchema = z.object({
  subject: z.string().max(300).optional().nullable(),
  body: z.string().max(8000).optional().nullable(),
  clientEmail: z.string().max(255).optional().nullable(),
});
apiV1Routes.post("/notes", async (c) => {
  const body = await parseBody(c, noteSchema);
  const { clientId } = await ingestNote(c.var.db, body, { env: c.env, ctx: c.executionCtx }, "zapier");
  return c.json({ ok: true, clientId }, 201);
});

// --- Search (Zapier "search-or-create") -------------------------------------
apiV1Routes.get("/clients", async (c) => {
  const email = c.req.query("email");
  if (!email) return c.json([]);
  const rows = await all<{ id: string; name: string; email: string | null; phone: string | null }>(
    c.var.db,
    `SELECT id, name, email, phone FROM clients WHERE lower(email) = lower(?) ORDER BY created_at DESC LIMIT 10`,
    email,
  ).catch(() => []);
  return c.json(rows.map((r) => ({ id: r.id, name: r.name, email: r.email, phone: r.phone })));
});

// --- Triggers: catalog + polling list ---------------------------------------
apiV1Routes.get("/triggers", (c) =>
  c.json(WORKFLOW_TRIGGERS.map((t) => ({ event: t.event, label: t.label, fields: t.fields }))),
);

// Recent events of one kind — Zapier's polling trigger + REST-hook sample data.
apiV1Routes.get("/events", async (c) => {
  const event = c.req.query("event");
  if (!event || !triggerByEvent(event)) return c.json({ error: "Unknown or missing ?event" }, 400);
  const limit = Math.min(50, Math.max(1, Number(c.req.query("limit")) || 10));
  const rows = await all<{ id: string; kind: string; entity_type: string; entity_id: string; title: string; payload: string | null; created_at: string }>(
    c.var.db,
    `SELECT id, kind, entity_type, entity_id, title, payload, created_at
     FROM activity_events WHERE kind = ? ORDER BY created_at DESC LIMIT ?`,
    event,
    limit,
  ).catch(() => []);
  return c.json(
    rows.map((r) => ({
      id: r.id,
      event: r.kind,
      title: r.title,
      entityType: r.entity_type,
      entityId: r.entity_id,
      payload: r.payload ? safeParse(r.payload) : {},
      createdAt: r.created_at,
    })),
  );
});

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}

// --- Triggers: REST-Hook subscriptions --------------------------------------
const subscribeSchema = z.object({
  event: z.string().max(60),
  targetUrl: z.string().url().max(2000),
});
apiV1Routes.post("/subscriptions", async (c) => {
  const body = await parseBody(c, subscribeSchema);
  if (!triggerByEvent(body.event)) return c.json({ error: "That event isn't available to subscribe to." }, 400);
  const id = newId("whs");
  const secret = randomToken(24);
  await run(
    c.var.db,
    `INSERT INTO webhook_subscriptions (id, event, target_url, secret, source) VALUES (?, ?, ?, ?, 'zapier')`,
    id,
    body.event,
    body.targetUrl,
    secret,
  );
  // The secret is returned once so the subscriber can verify HMAC signatures.
  return c.json({ id, event: body.event, secret }, 201);
});

apiV1Routes.delete("/subscriptions/:id", async (c) => {
  const res = await run(c.var.db, `DELETE FROM webhook_subscriptions WHERE id = ?`, c.req.param("id"));
  if (!res.meta.changes) return c.json({ error: "Subscription not found" }, 404);
  return c.json({ ok: true });
});
