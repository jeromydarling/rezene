import { Hono } from "hono";
import { z } from "zod";
import { all, first, writeAudit, run } from "../services/db";
import { parseBody } from "../services/validators";
import { requireAdminOnly, requireSuperAdmin } from "../middleware/auth";
import { provisionShop } from "../services/provision";
import { PRIMARY_SHOP_ID, RESERVED_SLUGS, type Shop } from "../services/shops";
import type { AppContext } from "../types/env";

/**
 * Platform operations: the shop registry. Only admins of the PRIMARY shop
 * (the platform operator) can touch this — an admin of any other shop gets
 * a 403 even with a valid session, because their session only exists in
 * their own shop's database and this gate checks the resolved tenant.
 */
export const adminPlatformRoutes = new Hono<AppContext>();

adminPlatformRoutes.use("*", requireAdminOnly, requireSuperAdmin, async (c, next) => {
  if (c.var.shopId !== PRIMARY_SHOP_ID) {
    return c.json({ error: "Not found" }, 404);
  }
  await next();
});

adminPlatformRoutes.get("/shops", async (c) => {
  const rows = await all(
    c.env.DB,
    `SELECT id, slug, name, status, owner_email, plan, custom_domain, note, created_at
     FROM shops ORDER BY created_at DESC`,
  );
  return c.json(rows);
});

adminPlatformRoutes.post("/shops/:id/provision", requireAdminOnly, async (c) => {
  const shop = await first<Shop & { owner_email: string | null }>(
    c.env.DB,
    `SELECT id, slug, name, status, custom_domain, owner_email FROM shops WHERE id = ?`,
    c.req.param("id"),
  );
  if (!shop) return c.json({ error: "Shop not found" }, 404);
  if (shop.status === "active") return c.json({ error: "Shop is already active" }, 409);
  if (!shop.owner_email) return c.json({ error: "Shop has no owner email on file" }, 409);
  if (RESERVED_SLUGS.has(shop.slug)) return c.json({ error: "Reserved slug" }, 409);

  try {
    const result = await provisionShop(c.env, shop, shop.owner_email);
    await writeAudit(c.env.DB, c.var.userId, "platform.shop.provision", "shop", shop.id, {
      slug: shop.slug,
    });
    return c.json(result, 201);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Provisioning failed" }, 500);
  }
});

const shopPatchSchema = z.object({
  status: z.enum(["pending", "active", "suspended", "closed"]).optional(),
  customDomain: z
    .string()
    .max(200)
    .regex(/^[a-z0-9.-]+$/i, "Hostname only — no scheme or path")
    .nullable()
    .optional(),
  note: z.string().max(1000).nullable().optional(),
});

adminPlatformRoutes.patch("/shops/:id", requireAdminOnly, async (c) => {
  const body = await parseBody(c, shopPatchSchema);
  const sets: string[] = [`updated_at = datetime('now')`];
  const params: unknown[] = [];
  if (body.status !== undefined) (sets.push("status = ?"), params.push(body.status));
  if (body.customDomain !== undefined)
    (sets.push("custom_domain = ?"), params.push(body.customDomain?.toLowerCase() ?? null));
  if (body.note !== undefined) (sets.push("note = ?"), params.push(body.note));
  const result = await run(
    c.env.DB,
    `UPDATE shops SET ${sets.join(", ")} WHERE id = ?`,
    ...params,
    c.req.param("id"),
  );
  if (!result.meta.changes) return c.json({ error: "Shop not found" }, 404);
  await writeAudit(c.env.DB, c.var.userId, "platform.shop.update", "shop", c.req.param("id"), body);
  return c.json({ ok: true });
});
