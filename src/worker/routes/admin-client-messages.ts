import { Hono } from "hono";
import { z } from "zod";
import { all, first, run } from "../services/db";
import { parseBody } from "../services/validators";
import { requireAdminWrite } from "../middleware/auth";
import { newId } from "../utils/id";
import { sendClientMessage } from "../services/client-messages";
import type { AppContext } from "../types/env";

/**
 * The client-message outbox — the Approvals inbox for client-facing drafts.
 * Automations (welcome, stage updates, deposit thank-yous) file drafts here;
 * the shop edits them, then sends by email or publishes to the client's
 * portal. A shop can also compose one from scratch. Nothing reaches a client
 * until it's sent. All writes go through requireAdminWrite (demo stays
 * read-only).
 */
export const adminClientMessageRoutes = new Hono<AppContext>();

type Row = {
  id: string;
  client_id: string;
  commission_id: string | null;
  trigger: string | null;
  channel: string;
  subject: string | null;
  body_md: string;
  status: string;
  provider: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
  client_name?: string;
  client_email?: string | null;
  commission_title?: string | null;
};

function mapRow(r: Row) {
  return {
    id: r.id,
    clientId: r.client_id,
    clientName: r.client_name ?? null,
    clientEmail: r.client_email ?? null,
    commissionId: r.commission_id,
    commissionTitle: r.commission_title ?? null,
    trigger: r.trigger,
    channel: r.channel,
    subject: r.subject,
    body: r.body_md,
    status: r.status,
    provider: r.provider,
    sentAt: r.sent_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const SELECT = `
  SELECT m.*, cl.name AS client_name, cl.email AS client_email, co.title AS commission_title
  FROM client_messages m
  JOIN clients cl ON cl.id = m.client_id
  LEFT JOIN commissions co ON co.id = m.commission_id`;

// List — the Approvals inbox. ?status=draft|sent|dismissed (default draft),
// ?clientId to scope to one client's outbox.
adminClientMessageRoutes.get("/", async (c) => {
  const status = c.req.query("status") || "draft";
  const clientId = c.req.query("clientId");
  try {
    const where: string[] = [];
    const args: unknown[] = [];
    if (status !== "all") {
      where.push("m.status = ?");
      args.push(status);
    }
    if (clientId) {
      where.push("m.client_id = ?");
      args.push(clientId);
    }
    const rows = await all<Row>(
      c.var.db,
      `${SELECT} ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY m.created_at DESC LIMIT 200`,
      ...args,
    );
    return c.json(rows.map(mapRow));
  } catch {
    // Table not migrated on this shop DB yet — an empty inbox, not an error.
    return c.json([]);
  }
});

const composeSchema = z.object({
  clientId: z.string().max(60),
  commissionId: z.string().max(60).optional().nullable(),
  channel: z.enum(["email", "portal"]).optional(),
  subject: z.string().max(200).optional().nullable(),
  body: z.string().min(1).max(4000),
});

// Compose a message from scratch (still a draft until sent).
adminClientMessageRoutes.post("/", requireAdminWrite, async (c) => {
  const body = await parseBody(c, composeSchema);
  const client = await first<{ id: string; email: string | null }>(
    c.var.db,
    `SELECT id, email FROM clients WHERE id = ?`,
    body.clientId,
  );
  if (!client) return c.json({ error: "Client not found" }, 404);
  const id = newId("cmsg");
  await run(
    c.var.db,
    `INSERT INTO client_messages (id, client_id, commission_id, trigger, channel, subject, body_md, status)
     VALUES (?, ?, ?, 'manual', ?, ?, ?, 'draft')`,
    id,
    body.clientId,
    body.commissionId || null,
    body.channel ?? (client.email ? "email" : "portal"),
    body.subject?.trim() || null,
    body.body,
  );
  const row = await first<Row>(c.var.db, `${SELECT} WHERE m.id = ?`, id);
  return c.json(mapRow(row!), 201);
});

const editSchema = z.object({
  channel: z.enum(["email", "portal"]).optional(),
  subject: z.string().max(200).optional().nullable(),
  body: z.string().max(4000).optional(),
});

// Edit a draft — the "make it yours" step before it goes out.
adminClientMessageRoutes.patch("/:id", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  const existing = await first<Row>(c.var.db, `SELECT * FROM client_messages WHERE id = ?`, id);
  if (!existing) return c.json({ error: "Message not found" }, 404);
  if (existing.status !== "draft") return c.json({ error: "Only drafts can be edited." }, 400);
  const body = await parseBody(c, editSchema);
  await run(
    c.var.db,
    `UPDATE client_messages SET channel = ?, subject = ?, body_md = ?, updated_at = datetime('now') WHERE id = ?`,
    body.channel ?? existing.channel,
    body.subject !== undefined ? body.subject?.trim() || null : existing.subject,
    body.body !== undefined ? body.body : existing.body_md,
    id,
  );
  const row = await first<Row>(c.var.db, `${SELECT} WHERE m.id = ?`, id);
  return c.json(mapRow(row!));
});

// Approve → send: email via the branded shell, or publish to the portal.
adminClientMessageRoutes.post("/:id/send", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  const result = await sendClientMessage(c.env, c.var.db, id);
  if (!result.ok) return c.json({ error: result.error ?? "Couldn't send." }, 400);
  const row = await first<Row>(c.var.db, `${SELECT} WHERE m.id = ?`, id);
  return c.json({ ok: true, emailed: result.emailed, message: row ? mapRow(row) : null });
});

// Dismiss a draft you don't want to send.
adminClientMessageRoutes.post("/:id/dismiss", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  const result = await run(
    c.var.db,
    `UPDATE client_messages SET status = 'dismissed', updated_at = datetime('now') WHERE id = ? AND status = 'draft'`,
    id,
  );
  if (!result.meta.changes) return c.json({ error: "Only drafts can be dismissed." }, 400);
  return c.json({ ok: true });
});
