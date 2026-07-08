import { Hono } from "hono";
import { all, first, run } from "../services/db";
import { getBrandName } from "../services/brand";
import { postShopMessage } from "../services/supplier-messaging";
import { requireAdminWrite } from "../middleware/auth";
import type { AppContext } from "../types/env";

export const adminMessagesRoutes = new Hono<AppContext>();

// Inbox: every supplier conversation, newest activity first.
adminMessagesRoutes.get("/", async (c) => {
  const threads = await all(
    c.var.db,
    `SELECT t.supplier_id AS supplierId, s.name AS supplierName, s.kind AS supplierKind,
            t.unread AS unread, t.last_message_at AS lastAt,
            (SELECT body FROM supplier_messages m WHERE m.thread_id = t.id ORDER BY m.created_at DESC LIMIT 1) AS snippet,
            (SELECT author_kind FROM supplier_messages m WHERE m.thread_id = t.id ORDER BY m.created_at DESC LIMIT 1) AS lastFrom
     FROM supplier_threads t JOIN suppliers s ON s.id = t.supplier_id
     ORDER BY t.last_message_at DESC`,
  );
  const totalUnread = threads.reduce((n, t) => n + Number((t as { unread: number }).unread || 0), 0);
  return c.json({ threads, totalUnread });
});

// A single conversation (marks it read).
adminMessagesRoutes.get("/:supplierId", async (c) => {
  const supplierId = c.req.param("supplierId");
  const supplier = await first<{ id: string; name: string; email: string | null; kind: string }>(
    c.var.db,
    `SELECT id, name, email, kind FROM suppliers WHERE id = ?`,
    supplierId,
  );
  if (!supplier) return c.json({ error: "Supplier not found" }, 404);

  const thread = await first<{ id: string }>(
    c.var.db,
    `SELECT id FROM supplier_threads WHERE supplier_id = ?`,
    supplierId,
  );
  const messages = thread
    ? await all(
        c.var.db,
        `SELECT id, author_kind AS authorKind, author_name AS authorName, body, via, context, created_at AS createdAt
         FROM supplier_messages WHERE thread_id = ? ORDER BY created_at`,
        thread.id,
      )
    : [];
  if (thread) await run(c.var.db, `UPDATE supplier_threads SET unread = 0 WHERE id = ?`, thread.id);

  return c.json({ supplier, messages, configured: Boolean(c.env.EMAIL && c.env.MAKER_INBOUND_DOMAIN) });
});

// Send a message to a supplier (records it, then emails the maker).
adminMessagesRoutes.post("/:supplierId", requireAdminWrite, async (c) => {
  const supplierId = c.req.param("supplierId");
  const body = (await c.req.json().catch(() => ({}))) as { body?: string; context?: string };
  const text = (body.body ?? "").toString().trim();
  if (!text) return c.json({ error: "Write a message first." }, 400);

  const supplier = await first<{ id: string; name: string; email: string | null }>(
    c.var.db,
    `SELECT id, name, email FROM suppliers WHERE id = ?`,
    supplierId,
  );
  if (!supplier) return c.json({ error: "Supplier not found" }, 404);

  const fromName = await getBrandName(c.env, c.var.db);
  const { message, emailed } = await postShopMessage(c.env, c.var.db, c.var.shopId, {
    supplierId,
    supplierName: supplier.name,
    supplierEmail: supplier.email,
    body: text,
    context: body.context?.slice(0, 120) || null,
    fromName,
  });
  return c.json({ message, emailed, hasEmail: Boolean(supplier.email) }, 201);
});
