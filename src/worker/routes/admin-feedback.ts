import { Hono } from "hono";
import { all, first, run } from "../services/db";
import { feedbackCreateSchema, feedbackUpdateSchema, parseBody } from "../services/validators";
import { requireAdminRead, requireSuperAdmin } from "../middleware/auth";
import { newId } from "../utils/id";
import type { AppContext } from "../types/env";

/**
 * Support tickets. Any shop staffer can file a bug or feature request; the
 * ticket lands in the platform (primary) database — never the shop's — so the
 * Verto operator works one queue in HQ. Reads/writes to the queue are
 * SuperAdmin-only; filing is open to any admin-area user.
 */
export const adminFeedbackRoutes = new Hono<AppContext>();

// ---------- File a ticket (any admin-area user) ----------
adminFeedbackRoutes.post("/", requireAdminRead, async (c) => {
  const body = await parseBody(c, feedbackCreateSchema);
  const brand = await first<{ value: string }>(c.var.db, `SELECT value FROM settings WHERE key = 'brand_name'`);
  await run(
    c.env.DB, // platform DB, regardless of which shop is reporting
    `INSERT INTO feedback (id, kind, title, body, severity, shop_id, shop_slug, shop_name, reporter_email, reporter_name, page_path, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    newId("fb"),
    body.kind,
    body.title,
    body.body ?? null,
    body.kind === "bug" ? body.severity ?? null : null,
    c.var.shopId,
    c.var.shopSlug ?? null,
    brand?.value ?? null,
    c.var.userEmail ?? null,
    null,
    body.pagePath ?? null,
    (c.req.header("user-agent") ?? "").slice(0, 300),
  );
  return c.json({ ok: true }, 201);
});

// ---------- HQ triage queue (SuperAdmin only) ----------
adminFeedbackRoutes.get("/", requireSuperAdmin, async (c) => {
  const status = c.req.query("status");
  const rows = await all(
    c.env.DB,
    `SELECT * FROM feedback ${status ? "WHERE status = ?" : ""} ORDER BY
       CASE status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END,
       CASE severity WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
       created_at DESC LIMIT 300`,
    ...(status ? [status] : []),
  );
  const counts = await all<{ status: string; n: number }>(
    c.env.DB,
    `SELECT status, COUNT(*) AS n FROM feedback GROUP BY status`,
  );
  return c.json({ tickets: rows, counts: Object.fromEntries(counts.map((r) => [r.status, r.n])) });
});

adminFeedbackRoutes.patch("/:id", requireSuperAdmin, async (c) => {
  const id = c.req.param("id");
  const body = await parseBody(c, feedbackUpdateSchema);
  const existing = await first(c.env.DB, `SELECT id FROM feedback WHERE id = ?`, id);
  if (!existing) return c.json({ error: "Not found" }, 404);
  const sets: string[] = [];
  const params: unknown[] = [];
  const map: Record<string, string> = { status: "status", adminNote: "admin_note", severity: "severity", kind: "kind" };
  for (const [key, col] of Object.entries(map)) {
    if (key in body) {
      sets.push(`${col} = ?`);
      params.push((body as Record<string, unknown>)[key] ?? null);
    }
  }
  if ("status" in body) {
    sets.push(`resolved_at = ?`);
    params.push(body.status === "resolved" || body.status === "closed" ? new Date().toISOString() : null);
  }
  if (sets.length === 0) return c.json({ error: "No fields" }, 400);
  sets.push(`updated_at = datetime('now')`);
  await run(c.env.DB, `UPDATE feedback SET ${sets.join(", ")} WHERE id = ?`, ...params, id);
  return c.json({ ok: true });
});
