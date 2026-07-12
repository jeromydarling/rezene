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

/**
 * One-shot copy of the primary shop out of the bound D1 into its own
 * ShopDatabase Durable Object — the last step of making the flagship a
 * normal tenant. Copies every table the DO schema defines (platform-only
 * tables aren't in that schema, so they stay behind), INSERT OR REPLACE so
 * re-runs heal partial copies. Flip PRIMARY_ON_DO to "1" (wrangler.toml)
 * only after this reports ok.
 */
adminPlatformRoutes.post("/migrate-primary", async (c) => {
  if (c.env.PRIMARY_ON_DO === "1") {
    return c.json({ error: "The primary shop already resolves to its DO — nothing to migrate." }, 409);
  }
  const { getShopDoDb } = await import("../services/tenant-db");
  const target = getShopDoDb(c.env, PRIMARY_SHOP_ID);
  // First touch bootstraps the DO schema; its table list IS the shop schema.
  const doTables = await target
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '\\_cf%' ESCAPE '\\' AND name != 'd1_migrations'`)
    .all<{ name: string }>();
  const report: Record<string, number | string> = {};
  let total = 0;
  for (const { name } of doTables.results) {
    let rows: Record<string, unknown>[];
    try {
      rows = (await c.env.DB.prepare(`SELECT * FROM "${name}"`).all()).results;
    } catch {
      report[name] = "absent in D1 — skipped";
      continue;
    }
    if (rows.length === 0) continue;
    const cols = Object.keys(rows[0]);
    const sql = `INSERT OR REPLACE INTO "${name}" (${cols.map((k) => `"${k}"`).join(",")}) VALUES (${cols.map(() => "?").join(",")})`;
    const statements = rows.map((r) => target.prepare(sql).bind(...cols.map((k) => r[k] ?? null)));
    for (let i = 0; i < statements.length; i += 40) {
      await target.batch(statements.slice(i, i + 40));
    }
    report[name] = rows.length;
    total += rows.length;
  }
  await writeAudit(c.env.DB, c.var.userId!, "platform.migrate_primary", "shop", PRIMARY_SHOP_ID);
  return c.json({ ok: true, total, tables: report });
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
