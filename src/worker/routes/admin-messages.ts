import { Hono } from "hono";
import { all, first, run } from "../services/db";
import { getBrandName } from "../services/brand";
import { getOrCreateThread, postMessage, type ThreadContext, type ThreadRef } from "../services/supplier-messaging";
import { requireAdminWrite } from "../middleware/auth";
import type { AppContext } from "../types/env";

export const adminMessagesRoutes = new Hono<AppContext>();

// Cheap unread total for the nav badge.
adminMessagesRoutes.get("/unread", async (c) => {
  const row = await first<{ n: number }>(
    c.var.db,
    `SELECT COALESCE(SUM(unread), 0) AS n FROM supplier_threads`,
  );
  return c.json({ count: row?.n ?? 0 });
});

// Inbox: every conversation (supplier + optional context), newest activity first.
adminMessagesRoutes.get("/", async (c) => {
  const threads = await all(
    c.var.db,
    `SELECT t.id AS threadId, t.supplier_id AS supplierId, s.name AS supplierName, s.kind AS supplierKind,
            t.context_type AS contextType, t.context_label AS contextLabel,
            t.unread AS unread, t.last_message_at AS lastAt,
            (SELECT body FROM supplier_messages m WHERE m.thread_id = t.id ORDER BY m.created_at DESC LIMIT 1) AS snippet,
            (SELECT author_kind FROM supplier_messages m WHERE m.thread_id = t.id ORDER BY m.created_at DESC LIMIT 1) AS lastFrom
     FROM supplier_threads t JOIN suppliers s ON s.id = t.supplier_id
     ORDER BY t.last_message_at DESC`,
  );
  const totalUnread = threads.reduce((n, t) => n + Number((t as { unread: number }).unread || 0), 0);
  return c.json({ threads, totalUnread, configured: Boolean(c.env.EMAIL && c.env.MAKER_INBOUND_DOMAIN) });
});

// Start (or continue) a conversation with a supplier, optionally about a context.
adminMessagesRoutes.post("/start", requireAdminWrite, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    supplierId?: string;
    contextType?: string;
    contextId?: string;
    contextLabel?: string;
    body?: string;
  };
  const text = (body.body ?? "").toString().trim();
  if (!body.supplierId) return c.json({ error: "Pick a supplier." }, 400);
  if (!text) return c.json({ error: "Write a message first." }, 400);

  const supplier = await first<{ id: string; name: string; email: string | null }>(
    c.var.db,
    `SELECT id, name, email FROM suppliers WHERE id = ?`,
    body.supplierId,
  );
  if (!supplier) return c.json({ error: "Supplier not found" }, 404);

  const context: ThreadContext | null =
    body.contextType === "sample" || body.contextType === "po" || body.contextType === "tech_pack"
      ? { type: body.contextType, id: body.contextId ?? "", label: (body.contextLabel ?? "").slice(0, 120) }
      : null;

  const thread = await getOrCreateThread(c.env, c.var.db, c.var.shopId, supplier.id, context);
  const fromName = await getBrandName(c.env, c.var.db);
  const { message, emailed } = await postMessage(c.env, c.var.db, thread, supplier, {
    body: text,
    fromName,
    contextLabel: context?.label ?? null,
  });
  return c.json({ threadId: thread.id, message, emailed, hasEmail: Boolean(supplier.email) }, 201);
});

// A single conversation by thread id (marks it read).
adminMessagesRoutes.get("/:threadId", async (c) => {
  const threadId = c.req.param("threadId");
  const thread = await first<{
    id: string;
    supplier_id: string;
    context_type: string | null;
    context_label: string | null;
  }>(c.var.db, `SELECT id, supplier_id, context_type, context_label FROM supplier_threads WHERE id = ?`, threadId);
  if (!thread) return c.json({ error: "Conversation not found" }, 404);

  const supplier = await first<{ id: string; name: string; email: string | null; kind: string }>(
    c.var.db,
    `SELECT id, name, email, kind FROM suppliers WHERE id = ?`,
    thread.supplier_id,
  );
  const messages = await all(
    c.var.db,
    `SELECT id, author_kind AS authorKind, author_name AS authorName, body, via, context, created_at AS createdAt
     FROM supplier_messages WHERE thread_id = ? ORDER BY created_at`,
    threadId,
  );
  await run(c.var.db, `UPDATE supplier_threads SET unread = 0 WHERE id = ?`, threadId);

  return c.json({
    supplier,
    context: thread.context_type ? { type: thread.context_type, label: thread.context_label } : null,
    messages,
    configured: Boolean(c.env.EMAIL && c.env.MAKER_INBOUND_DOMAIN),
  });
});

// Continue an existing conversation.
adminMessagesRoutes.post("/:threadId", requireAdminWrite, async (c) => {
  const threadId = c.req.param("threadId");
  const payload = (await c.req.json().catch(() => ({}))) as { body?: string };
  const text = (payload.body ?? "").toString().trim();
  if (!text) return c.json({ error: "Write a message first." }, 400);

  const thread = await first<ThreadRef & { context_label: string | null }>(
    c.var.db,
    `SELECT id, token, supplier_id, context_label FROM supplier_threads WHERE id = ?`,
    threadId,
  );
  if (!thread) return c.json({ error: "Conversation not found" }, 404);
  const supplier = await first<{ name: string; email: string | null }>(
    c.var.db,
    `SELECT name, email FROM suppliers WHERE id = ?`,
    thread.supplier_id,
  );
  if (!supplier) return c.json({ error: "Supplier not found" }, 404);

  const fromName = await getBrandName(c.env, c.var.db);
  const { message, emailed } = await postMessage(c.env, c.var.db, thread, supplier, {
    body: text,
    fromName,
    contextLabel: thread.context_label,
  });
  return c.json({ message, emailed, hasEmail: Boolean(supplier.email) }, 201);
});
