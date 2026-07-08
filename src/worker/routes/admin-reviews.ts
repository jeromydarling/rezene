import { Hono } from "hono";
import { all, run, writeAudit } from "../services/db";
import { requireAdminWrite } from "../middleware/auth";
import type { AppContext } from "../types/env";

/**
 * Review moderation. Reviews come only from verified buyers and publish on
 * arrival, so this is a light-touch queue: the shop can hide anything that
 * doesn't belong and delete spam.
 */
export const adminReviewsRoutes = new Hono<AppContext>();

adminReviewsRoutes.get("/", async (c) => {
  const rows = await all(
    c.var.db,
    `SELECT r.id, r.rating, r.title, r.body, r.author_name AS authorName, r.status, r.created_at AS createdAt,
            p.name AS productName, p.slug AS productSlug
     FROM product_reviews r JOIN products p ON p.id = r.product_id
     ORDER BY r.created_at DESC LIMIT 300`,
  );
  return c.json({ reviews: rows });
});

adminReviewsRoutes.post("/:id/status", requireAdminWrite, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { status?: string };
  const status = body.status === "hidden" ? "hidden" : "published";
  await run(c.var.db, `UPDATE product_reviews SET status = ? WHERE id = ?`, status, c.req.param("id"));
  await writeAudit(c.var.db, c.var.userId, "review.status", "product_review", c.req.param("id"), { status });
  return c.json({ ok: true });
});

adminReviewsRoutes.delete("/:id", requireAdminWrite, async (c) => {
  await run(c.var.db, `DELETE FROM product_reviews WHERE id = ?`, c.req.param("id"));
  await writeAudit(c.var.db, c.var.userId, "review.delete", "product_review", c.req.param("id"));
  return c.json({ ok: true });
});
