import { Hono } from "hono";
import { z } from "zod";
import { all, first, run, writeAudit } from "../services/db";
import { parseBody } from "../services/validators";
import { requireAdminOnly, requireSuperAdmin } from "../middleware/auth";
import { PRIMARY_SHOP_ID } from "../services/shops";
import {
  crmFollowupSweep,
  logInteraction,
  reconcileContacts,
  upsertContact,
} from "../services/crm";
import { sendBuyerEmail } from "../services/buyer-email";
import { newId } from "../utils/id";
import type { AppContext } from "../types/env";

/**
 * Verto HQ CRM — platform-operator only (same tenant gate as the shop
 * registry) and admin-role only: this is customer PII.
 */
export const adminCrmRoutes = new Hono<AppContext>();

// SuperAdmin-only, and HQ data lives in the primary D1.
adminCrmRoutes.use("*", requireAdminOnly, requireSuperAdmin, async (c, next) => {
  if (c.var.shopId !== PRIMARY_SHOP_ID) {
    return c.json({ error: "Not found" }, 404);
  }
  await next();
});

// ---------- Overview: the morning screen ----------
adminCrmRoutes.get("/overview", async (c) => {
  await reconcileContacts(c.env);
  const counts = await all<{ status: string; n: number }>(
    c.env.DB,
    `SELECT status, COUNT(*) AS n FROM crm_contacts GROUP BY status`,
  );
  const dueTasks = await all(
    c.env.DB,
    `SELECT t.id, t.title, t.due_at, t.contact_id, c.name, c.email, c.company, c.timezone
     FROM crm_tasks t JOIN crm_contacts c ON c.id = t.contact_id
     WHERE t.done_at IS NULL ORDER BY t.due_at ASC LIMIT 25`,
  );
  const recent = await all(
    c.env.DB,
    `SELECT i.id, i.kind, i.subject, i.created_at, i.contact_id, c.name, c.email, c.company
     FROM crm_interactions i JOIN crm_contacts c ON c.id = i.contact_id
     ORDER BY i.created_at DESC LIMIT 20`,
  );
  const newThisWeek = await first<{ n: number }>(
    c.env.DB,
    `SELECT COUNT(*) AS n FROM crm_contacts WHERE created_at > datetime('now','-7 days')`,
  );
  return c.json({ counts, dueTasks, recent, newThisWeek: newThisWeek?.n ?? 0 });
});

// ---------- Contacts ----------
adminCrmRoutes.get("/contacts", async (c) => {
  await reconcileContacts(c.env);
  const status = c.req.query("status");
  const q = c.req.query("q")?.trim();
  const where: string[] = [];
  const params: unknown[] = [];
  if (status) {
    where.push("ct.status = ?");
    params.push(status);
  }
  if (q) {
    where.push("(ct.email LIKE ? OR ct.name LIKE ? OR ct.company LIKE ? OR ct.city LIKE ?)");
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  const rows = await all(
    c.env.DB,
    `SELECT ct.id, ct.email, ct.name, ct.company, ct.shop_id, ct.source, ct.status, ct.health,
            ct.country, ct.city, ct.timezone, ct.tags, ct.last_touch_at, ct.next_followup_at,
            ct.created_at, s.slug AS shop_slug, s.status AS shop_status,
            (SELECT COUNT(*) FROM crm_tasks t WHERE t.contact_id = ct.id AND t.done_at IS NULL) AS open_tasks
     FROM crm_contacts ct LEFT JOIN shops s ON s.id = ct.shop_id
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY ct.last_touch_at IS NULL, ct.last_touch_at DESC, ct.created_at DESC
     LIMIT 500`,
    ...params,
  );
  return c.json(rows);
});

const contactSchema = z.object({
  email: z.string().email().max(200),
  name: z.string().max(120).optional(),
  company: z.string().max(120).optional(),
});

adminCrmRoutes.post("/contacts", async (c) => {
  const body = await parseBody(c, contactSchema);
  const id = await upsertContact(c.env, { ...body, source: "manual" });
  await writeAudit(c.var.db, c.var.userId!, "crm.contact_create", "crm_contact", id);
  return c.json({ id });
});

adminCrmRoutes.get("/contacts/:id", async (c) => {
  // Live shop pulse: refresh the health snapshot when it's stale so the
  // drawer always shows current reality, not yesterday's cron.
  const pre = await first<{ id: string; shop_id: string | null; status: string; name: string | null; email: string; health_checked_at: string | null }>(
    c.env.DB,
    `SELECT id, shop_id, status, name, email, health_checked_at FROM crm_contacts WHERE id = ?`,
    c.req.param("id"),
  );
  if (!pre) return c.json({ error: "Not found" }, 404);
  if (pre.shop_id && (!pre.health_checked_at || pre.health_checked_at < oneHourAgo())) {
    const { refreshContactHealth } = await import("../services/crm-activity");
    await refreshContactHealth(c.env, pre);
  }
  const contact = await first(
    c.env.DB,
    `SELECT ct.*, s.slug AS shop_slug, s.status AS shop_status, s.plan AS shop_plan
     FROM crm_contacts ct LEFT JOIN shops s ON s.id = ct.shop_id WHERE ct.id = ?`,
    c.req.param("id"),
  );
  if (!contact) return c.json({ error: "Not found" }, 404);
  const interactions = await all(
    c.env.DB,
    `SELECT id, kind, subject, body_md, metadata, created_by, created_at
     FROM crm_interactions WHERE contact_id = ? ORDER BY created_at DESC LIMIT 200`,
    c.req.param("id"),
  );
  const tasks = await all(
    c.env.DB,
    `SELECT id, title, due_at, done_at, created_at FROM crm_tasks
     WHERE contact_id = ? ORDER BY done_at IS NOT NULL, due_at ASC LIMIT 100`,
    c.req.param("id"),
  );
  return c.json({ contact, interactions, tasks });
});

const patchSchema = z.object({
  name: z.string().max(120).nullish(),
  company: z.string().max(120).nullish(),
  status: z.enum(["lead", "trial", "active", "champion", "churn_risk", "churned"]).optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  notesMd: z.string().max(20000).nullish(),
  city: z.string().max(120).nullish(),
  country: z.string().max(8).nullish(),
  latitude: z.number().min(-90).max(90).nullish(),
  longitude: z.number().min(-180).max(180).nullish(),
  nextFollowupAt: z.string().max(40).nullish(),
});

adminCrmRoutes.patch("/contacts/:id", async (c) => {
  const body = await parseBody(c, patchSchema);
  const id = c.req.param("id");
  const existing = await first<{ id: string }>(c.env.DB, `SELECT id FROM crm_contacts WHERE id = ?`, id);
  if (!existing) return c.json({ error: "Not found" }, 404);
  const sets: string[] = [];
  const params: unknown[] = [];
  const map: [string, unknown][] = [
    ["name", body.name],
    ["company", body.company],
    ["status", body.status],
    ["tags", body.tags ? JSON.stringify(body.tags) : undefined],
    ["notes_md", body.notesMd],
    ["city", body.city],
    ["country", body.country],
    ["latitude", body.latitude],
    ["longitude", body.longitude],
    ["next_followup_at", body.nextFollowupAt],
  ];
  for (const [col, val] of map) {
    if (val !== undefined) {
      sets.push(`${col} = ?`);
      params.push(val);
    }
  }
  if (!sets.length) return c.json({ ok: true });
  params.push(id);
  await run(c.env.DB, `UPDATE crm_contacts SET ${sets.join(", ")}, updated_at = datetime('now') WHERE id = ?`, ...params);
  await writeAudit(c.var.db, c.var.userId!, "crm.contact_update", "crm_contact", id);
  return c.json({ ok: true });
});

// ---------- Timeline ----------
const interactionSchema = z.object({
  kind: z.enum(["note", "call", "meeting", "support"]),
  subject: z.string().max(200).optional(),
  bodyMd: z.string().max(20000).optional(),
});

adminCrmRoutes.post("/contacts/:id/interactions", async (c) => {
  const body = await parseBody(c, interactionSchema);
  const id = c.req.param("id");
  const existing = await first<{ id: string }>(c.env.DB, `SELECT id FROM crm_contacts WHERE id = ?`, id);
  if (!existing) return c.json({ error: "Not found" }, 404);
  await logInteraction(c.env, id, body.kind, {
    subject: body.subject,
    bodyMd: body.bodyMd,
    createdBy: c.var.userId!,
  });
  return c.json({ ok: true });
});

// ---------- Outbound email, logged to the timeline ----------
const emailSchema = z.object({
  subject: z.string().min(1).max(200),
  text: z.string().min(1).max(20000),
  fromName: z.string().max(80).optional(),
});

adminCrmRoutes.post("/contacts/:id/email", async (c) => {
  const body = await parseBody(c, emailSchema);
  const contact = await first<{ id: string; email: string }>(
    c.env.DB,
    `SELECT id, email FROM crm_contacts WHERE id = ?`,
    c.req.param("id"),
  );
  if (!contact) return c.json({ error: "Not found" }, 404);
  const sent = await sendBuyerEmail(c.env, {
    to: contact.email,
    subject: body.subject,
    text: body.text,
    fromName: body.fromName ?? "Verto",
  });
  await logInteraction(c.env, contact.id, "email_out", {
    subject: body.subject,
    bodyMd: body.text,
    metadata: { sent },
    createdBy: c.var.userId!,
  });
  await writeAudit(c.var.db, c.var.userId!, "crm.email_out", "crm_contact", contact.id);
  return c.json({ ok: true, sent });
});

// ---------- Tasks ----------
const taskSchema = z.object({
  title: z.string().min(1).max(200),
  dueAt: z.string().max(40).optional(),
});

adminCrmRoutes.post("/contacts/:id/tasks", async (c) => {
  const body = await parseBody(c, taskSchema);
  const id = c.req.param("id");
  const existing = await first<{ id: string }>(c.env.DB, `SELECT id FROM crm_contacts WHERE id = ?`, id);
  if (!existing) return c.json({ error: "Not found" }, 404);
  const taskId = newId("tk");
  await run(
    c.env.DB,
    `INSERT INTO crm_tasks (id, contact_id, title, due_at) VALUES (?, ?, ?, ?)`,
    taskId,
    id,
    body.title,
    body.dueAt ?? null,
  );
  return c.json({ id: taskId });
});

adminCrmRoutes.patch("/tasks/:id", async (c) => {
  const done = (await c.req.json<{ done?: boolean }>().catch(() => ({}) as { done?: boolean })).done;
  await run(
    c.env.DB,
    `UPDATE crm_tasks SET done_at = ${done ? "datetime('now')" : "NULL"} WHERE id = ?`,
    c.req.param("id"),
  );
  return c.json({ ok: true });
});

// ---------- Atlas: everyone with a location ----------
adminCrmRoutes.get("/atlas", async (c) => {
  await reconcileContacts(c.env);
  const rows = await all(
    c.env.DB,
    `SELECT ct.id, ct.email, ct.name, ct.company, ct.status, ct.source, ct.city, ct.country,
            ct.latitude, ct.longitude, ct.timezone, s.slug AS shop_slug
     FROM crm_contacts ct LEFT JOIN shops s ON s.id = ct.shop_id
     WHERE ct.latitude IS NOT NULL AND ct.longitude IS NOT NULL`,
  );
  return c.json(rows);
});

// Manual sweep trigger (also runs on the daily cron).
adminCrmRoutes.post("/sweep", async (c) => {
  const { crmHealthSweep } = await import("../services/crm-activity");
  await crmHealthSweep(c.env);
  await crmFollowupSweep(c.env);
  return c.json({ ok: true });
});

function oneHourAgo(): string {
  return new Date(Date.now() - 3600_000).toISOString().slice(0, 19).replace("T", " ");
}

// ---------- AI check-in: a draft in the founder's voice, never auto-sent ----------
adminCrmRoutes.post("/contacts/:id/draft-checkin", async (c) => {
  const contact = await first<{
    id: string;
    email: string;
    name: string | null;
    company: string | null;
    status: string;
    city: string | null;
    country: string | null;
    notes_md: string | null;
    health: string | null;
    shop_slug: string | null;
    shop_orders_total: number | null;
    last_shop_publish_at: string | null;
  }>(
    c.env.DB,
    `SELECT ct.id, ct.email, ct.name, ct.company, ct.status, ct.city, ct.country, ct.notes_md,
            ct.health, ct.shop_orders_total, ct.last_shop_publish_at, s.slug AS shop_slug
     FROM crm_contacts ct LEFT JOIN shops s ON s.id = ct.shop_id WHERE ct.id = ?`,
    c.req.param("id"),
  );
  if (!contact) return c.json({ error: "Not found" }, 404);
  const timeline = await all<{ kind: string; subject: string | null; created_at: string }>(
    c.env.DB,
    `SELECT kind, subject, created_at FROM crm_interactions
     WHERE contact_id = ? ORDER BY created_at DESC LIMIT 10`,
    contact.id,
  );

  const { aiComplete } = await import("../services/ai");
  const facts = [
    `Name: ${contact.name ?? "unknown"} <${contact.email}>`,
    contact.company ? `Their label: ${contact.company}${contact.shop_slug ? ` (live at verto.style/${contact.shop_slug})` : ""}` : null,
    contact.city || contact.country ? `Location: ${[contact.city, contact.country].filter(Boolean).join(", ")}` : null,
    `Relationship status: ${contact.status}${contact.health ? `, shop health: ${contact.health}` : ""}`,
    contact.shop_orders_total != null ? `Paid orders so far: ${contact.shop_orders_total}` : null,
    contact.notes_md ? `Founder's private notes: ${contact.notes_md.slice(0, 600)}` : null,
    `Recent timeline: ${timeline.map((t) => `${t.created_at.slice(0, 10)} ${t.kind}${t.subject ? ` (${t.subject})` : ""}`).join("; ") || "nothing yet"}`,
  ].filter(Boolean).join("\n");

  try {
    const result = await aiComplete(c.env, {
      system:
        "You draft short personal check-in emails for the founder of Verto, a platform for independent clothing labels. Write like one founder to another: warm, specific, under 130 words, plain text, no marketing language, no exclamation-mark enthusiasm, no emojis. Reference something real from the facts. End with one genuine, easy-to-answer question. Output exactly:\nSubject: <subject line>\n\n<email body>\nSign off with just \"— Jeromy\".",
      prompt: `Draft a check-in email using these facts:\n${facts}`,
      maxTokens: 400,
    });
    const match = result.text.match(/^Subject:\s*(.+?)\n+([\s\S]+)$/);
    const subject = match?.[1]?.trim() ?? `Checking in from Verto`;
    const body = (match?.[2] ?? result.text).trim();
    return c.json({ subject, body, provider: result.provider });
  } catch {
    return c.json({ error: "AI drafting is unavailable right now — write it by hand" }, 503);
  }
});
