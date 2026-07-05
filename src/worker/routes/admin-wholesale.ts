import { Hono } from "hono";
import { z } from "zod";
import { all, first, run, writeAudit } from "../services/db";
import { parseBody } from "../services/validators";
import { requireAdminWrite } from "../middleware/auth";
import { newId, randomToken, sha256Hex } from "../utils/id";
import type { AppContext } from "../types/env";

/**
 * Wholesale line sheets: a curated product selection with wholesale
 * pricing, shared with boutiques via a tokenized link (same pattern as
 * the factory portal). Buyers submit an inquiry with requested
 * quantities — it lands in leads and notifies the founder.
 */
export const adminWholesaleRoutes = new Hono<AppContext>();

const lineSheetCreateSchema = z.object({
  title: z.string().min(1).max(200),
  season: z.string().max(20).optional(),
  note: z.string().max(2000).optional(),
  productIds: z.array(z.string().max(80)).min(1).max(100),
});

const lineSheetItemUpdateSchema = z.object({
  wholesalePriceCents: z.number().int().min(0).optional(),
  minQty: z.number().int().min(1).optional(),
});

adminWholesaleRoutes.get("/line-sheets", async (c) => {
  const rows = await all(
    c.env.DB,
    `SELECT ls.id, ls.title, ls.season, ls.currency, ls.note, ls.status, ls.created_at,
            ls.token_hash IS NOT NULL AS is_shared,
            (SELECT COUNT(*) FROM line_sheet_items i WHERE i.line_sheet_id = ls.id) AS item_count
     FROM line_sheets ls ORDER BY ls.created_at DESC`,
  );
  return c.json(rows);
});

adminWholesaleRoutes.get("/line-sheets/:id", async (c) => {
  const sheet = await first<Record<string, unknown>>(
    c.env.DB,
    `SELECT id, title, season, currency, note, status, created_at FROM line_sheets WHERE id = ?`,
    c.req.param("id"),
  );
  if (!sheet) return c.json({ error: "Line sheet not found" }, 404);
  const items = await all(
    c.env.DB,
    `SELECT i.id, i.product_id, i.wholesale_price_cents, i.min_qty, i.sort_order,
            p.name AS product_name, p.base_price_cents AS msrp_cents
     FROM line_sheet_items i JOIN products p ON p.id = i.product_id
     WHERE i.line_sheet_id = ? ORDER BY i.sort_order`,
    sheet.id,
  );
  return c.json({ ...sheet, items });
});

adminWholesaleRoutes.post("/line-sheets", requireAdminWrite, async (c) => {
  const body = await parseBody(c, lineSheetCreateSchema);
  const id = newId("ls");
  const token = randomToken(24);
  await run(
    c.env.DB,
    `INSERT INTO line_sheets (id, title, season, note, token_hash, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    id,
    body.title,
    body.season ?? null,
    body.note ?? null,
    await sha256Hex(token),
    c.var.userId,
  );

  let sortOrder = 0;
  for (const productId of body.productIds) {
    const product = await first<{ id: string; base_price_cents: number; style_id: string | null }>(
      c.env.DB,
      `SELECT id, base_price_cents, style_id FROM products WHERE id = ?`,
      productId,
    );
    if (!product) continue;
    // Wholesale default: the style's cost sheet wholesale price if set,
    // otherwise the classic 50%-of-retail starting point.
    let wholesale: number | null = null;
    if (product.style_id) {
      const cs = await first<{ wholesale_price_cents: number | null }>(
        c.env.DB,
        `SELECT wholesale_price_cents FROM cost_sheets WHERE style_id = ? ORDER BY updated_at DESC LIMIT 1`,
        product.style_id,
      );
      wholesale = cs?.wholesale_price_cents ?? null;
    }
    await run(
      c.env.DB,
      `INSERT INTO line_sheet_items (id, line_sheet_id, product_id, wholesale_price_cents, min_qty, sort_order)
       VALUES (?, ?, ?, ?, 1, ?)`,
      newId("lsi"),
      id,
      product.id,
      wholesale ?? Math.round(product.base_price_cents / 2),
      sortOrder++,
    );
  }
  await writeAudit(c.env.DB, c.var.userId, "line_sheet.create", "line_sheet", id, {
    title: body.title,
  });
  const { getPrimaryShopBase } = await import("../services/shops");
  return c.json({ id, url: `${await getPrimaryShopBase(c.env.DB)}/linesheet/${token}` }, 201);
});

adminWholesaleRoutes.patch("/line-sheets/items/:itemId", requireAdminWrite, async (c) => {
  const body = await parseBody(c, lineSheetItemUpdateSchema);
  const sets: string[] = [];
  const params: unknown[] = [];
  if (body.wholesalePriceCents !== undefined) {
    sets.push(`wholesale_price_cents = ?`);
    params.push(body.wholesalePriceCents);
  }
  if (body.minQty !== undefined) {
    sets.push(`min_qty = ?`);
    params.push(body.minQty);
  }
  if (sets.length === 0) return c.json({ error: "No fields to update" }, 400);
  const result = await run(
    c.env.DB,
    `UPDATE line_sheet_items SET ${sets.join(", ")} WHERE id = ?`,
    ...params,
    c.req.param("itemId"),
  );
  if (!result.meta.changes) return c.json({ error: "Item not found" }, 404);
  return c.json({ ok: true });
});

adminWholesaleRoutes.post("/line-sheets/:id/revoke", requireAdminWrite, async (c) => {
  const result = await run(
    c.env.DB,
    `UPDATE line_sheets SET status = 'revoked' WHERE id = ? AND status = 'active'`,
    c.req.param("id"),
  );
  if (!result.meta.changes) return c.json({ error: "Line sheet not found or already revoked" }, 404);
  return c.json({ ok: true });
});
