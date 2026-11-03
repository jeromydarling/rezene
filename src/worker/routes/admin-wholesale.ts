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
  /** Quantity breaks: ascending minQty → unit price. Empty array clears. */
  priceTiers: z
    .array(z.object({ minQty: z.number().int().min(2), priceCents: z.number().int().min(0) }))
    .max(6)
    .optional(),
});

async function adminBaseUrl(c: { req: { url: string }; env: AppContext["Bindings"]; var: { shopSlug: string | null } }): Promise<string> {
  const origin = new URL(c.req.url).origin;
  const { getPrimaryShopBase } = await import("../services/shops");
  const shopBase = c.var.shopSlug ? `/${c.var.shopSlug}` : await getPrimaryShopBase(c.env.DB);
  return (c.env.APP_ENV === "development" ? origin : c.env.APP_URL || origin) + shopBase;
}

adminWholesaleRoutes.get("/line-sheets", async (c) => {
  const rows = await all(
    c.var.db,
    `SELECT ls.id, ls.title, ls.season, ls.currency, ls.note, ls.status, ls.created_at,
            ls.token_hash IS NOT NULL AS is_shared,
            (SELECT COUNT(*) FROM line_sheet_items i WHERE i.line_sheet_id = ls.id) AS item_count
     FROM line_sheets ls ORDER BY ls.created_at DESC`,
  );
  return c.json(rows);
});

adminWholesaleRoutes.get("/line-sheets/:id", async (c) => {
  const sheet = await first<Record<string, unknown>>(
    c.var.db,
    `SELECT id, title, season, currency, note, status, created_at FROM line_sheets WHERE id = ?`,
    c.req.param("id"),
  );
  if (!sheet) return c.json({ error: "Line sheet not found" }, 404);
  const items = await all(
    c.var.db,
    `SELECT i.id, i.product_id, i.wholesale_price_cents, i.min_qty, i.sort_order, i.price_tiers,
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
    c.var.db,
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
      c.var.db,
      `SELECT id, base_price_cents, style_id FROM products WHERE id = ?`,
      productId,
    );
    if (!product) continue;
    // Wholesale default: the style's cost sheet wholesale price if set,
    // otherwise the classic 50%-of-retail starting point.
    let wholesale: number | null = null;
    if (product.style_id) {
      const cs = await first<{ wholesale_price_cents: number | null }>(
        c.var.db,
        `SELECT wholesale_price_cents FROM cost_sheets WHERE style_id = ? ORDER BY updated_at DESC LIMIT 1`,
        product.style_id,
      );
      wholesale = cs?.wholesale_price_cents ?? null;
    }
    await run(
      c.var.db,
      `INSERT INTO line_sheet_items (id, line_sheet_id, product_id, wholesale_price_cents, min_qty, sort_order)
       VALUES (?, ?, ?, ?, 1, ?)`,
      newId("lsi"),
      id,
      product.id,
      wholesale ?? Math.round(product.base_price_cents / 2),
      sortOrder++,
    );
  }
  await writeAudit(c.var.db, c.var.userId, "line_sheet.create", "line_sheet", id, {
    title: body.title,
  });
  const { getPrimaryShopBase } = await import("../services/shops");
  const shopBase = c.var.shopSlug ? `/${c.var.shopSlug}` : await getPrimaryShopBase(c.env.DB);
  return c.json({ id, url: `${shopBase}/linesheet/${token}` }, 201);
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
  if (body.priceTiers !== undefined) {
    const tiers = [...body.priceTiers].sort((a, b) => a.minQty - b.minQty);
    sets.push(`price_tiers = ?`);
    params.push(tiers.length > 0 ? JSON.stringify(tiers) : null);
  }
  if (sets.length === 0) return c.json({ error: "No fields to update" }, 400);
  const result = await run(
    c.var.db,
    `UPDATE line_sheet_items SET ${sets.join(", ")} WHERE id = ?`,
    ...params,
    c.req.param("itemId"),
  );
  if (!result.meta.changes) return c.json({ error: "Item not found" }, 404);
  return c.json({ ok: true });
});

adminWholesaleRoutes.post("/line-sheets/:id/revoke", requireAdminWrite, async (c) => {
  const result = await run(
    c.var.db,
    `UPDATE line_sheets SET status = 'revoked' WHERE id = ? AND status = 'active'`,
    c.req.param("id"),
  );
  if (!result.meta.changes) return c.json({ error: "Line sheet not found or already revoked" }, 404);
  return c.json({ ok: true });
});

// ---------- Wholesale buyer accounts ----------
adminWholesaleRoutes.get("/accounts", async (c) => {
  const rows = await all(
    c.var.db,
    `SELECT a.id, a.email, a.company, a.contact_name AS contactName, a.status,
            a.discount_pct AS discountPct, a.terms_days AS termsDays, a.note, a.created_at AS createdAt,
            (SELECT COUNT(*) FROM wholesale_orders o WHERE o.account_id = a.id) AS orderCount
     FROM wholesale_accounts a ORDER BY
       CASE a.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END, a.created_at DESC`,
  );
  const pending = rows.filter((r) => (r as { status: string }).status === "pending").length;
  return c.json({ accounts: rows, pending });
});

adminWholesaleRoutes.post("/accounts/:id/approve", requireAdminWrite, async (c) => {
  const b = (await c.req.json().catch(() => ({}))) as { discountPct?: number; termsDays?: number; note?: string };
  await run(
    c.var.db,
    `UPDATE wholesale_accounts SET status = 'approved', discount_pct = ?, terms_days = ?,
            note = COALESCE(?, note), approved_at = datetime('now') WHERE id = ?`,
    Math.max(0, Math.min(90, Number(b.discountPct) || 0)),
    Math.max(0, Number(b.termsDays) || 0),
    b.note ?? null,
    c.req.param("id"),
  );
  await writeAudit(c.var.db, c.var.userId, "wholesale.account.approve", "wholesale_account", c.req.param("id"), b);
  return c.json({ ok: true });
});

adminWholesaleRoutes.post("/accounts/:id/reject", requireAdminWrite, async (c) => {
  await run(c.var.db, `UPDATE wholesale_accounts SET status = 'rejected' WHERE id = ?`, c.req.param("id"));
  return c.json({ ok: true });
});

// ---------- Per-buyer price lists (overrides) ----------
// Every product on an active line sheet, with this buyer's override (if any).
adminWholesaleRoutes.get("/accounts/:id/overrides", async (c) => {
  const accountId = c.req.param("id");
  const rows = await all(
    c.var.db,
    `SELECT DISTINCT p.id AS productId, p.name,
            MIN(i.wholesale_price_cents) AS listCents,
            (SELECT o.unit_price_cents FROM wholesale_price_overrides o
             WHERE o.account_id = ? AND o.product_id = p.id) AS overrideCents
     FROM line_sheet_items i
     JOIN line_sheets ls ON ls.id = i.line_sheet_id AND ls.status = 'active'
     JOIN products p ON p.id = i.product_id
     GROUP BY p.id, p.name ORDER BY p.name`,
    accountId,
  );
  return c.json({ products: rows });
});

const overrideSchema = z.object({
  productId: z.string().max(80),
  unitPriceCents: z.number().int().min(0).nullable(),
});

adminWholesaleRoutes.put("/accounts/:id/overrides", requireAdminWrite, async (c) => {
  const accountId = c.req.param("id");
  const body = await parseBody(c, overrideSchema);
  if (body.unitPriceCents === null) {
    await run(
      c.var.db,
      `DELETE FROM wholesale_price_overrides WHERE account_id = ? AND product_id = ?`,
      accountId,
      body.productId,
    );
  } else {
    await run(
      c.var.db,
      `INSERT INTO wholesale_price_overrides (id, account_id, product_id, unit_price_cents)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(account_id, product_id) DO UPDATE SET unit_price_cents = excluded.unit_price_cents`,
      newId("wpo"),
      accountId,
      body.productId,
      body.unitPriceCents,
    );
  }
  await writeAudit(c.var.db, c.var.userId, "wholesale.override.set", "wholesale_account", accountId, body);
  return c.json({ ok: true });
});

// ---------- Wholesale orders ----------
adminWholesaleRoutes.get("/orders", async (c) => {
  const rows = await all(
    c.var.db,
    `SELECT o.id, o.order_number AS orderNumber, o.status, o.total_cents AS totalCents, o.currency,
            o.due_date AS dueDate, o.paid_at AS paidAt, o.fulfillment_order_id AS fulfillmentOrderId,
            o.created_at AS createdAt, a.company, a.email
     FROM wholesale_orders o JOIN wholesale_accounts a ON a.id = o.account_id
     ORDER BY o.created_at DESC LIMIT 300`,
  );
  const open = rows.filter((r) => (r as { status: string }).status === "submitted").length;
  return c.json({ orders: rows, open });
});

adminWholesaleRoutes.get("/orders/:id", async (c) => {
  const order = await first<Record<string, unknown>>(
    c.var.db,
    `SELECT o.*, a.company, a.email, a.contact_name AS contactName, a.terms_days AS termsDays
     FROM wholesale_orders o JOIN wholesale_accounts a ON a.id = o.account_id WHERE o.id = ?`,
    c.req.param("id"),
  );
  if (!order) return c.json({ error: "Order not found" }, 404);
  const items = await all(
    c.var.db,
    `SELECT description, quantity, unit_price_cents AS unitPriceCents, currency
     FROM wholesale_order_items WHERE order_id = ?`,
    order.id,
  );
  return c.json({ order, items });
});

adminWholesaleRoutes.post("/orders/:id/status", requireAdminWrite, async (c) => {
  const b = (await c.req.json().catch(() => ({}))) as { status?: string };
  const valid = ["submitted", "confirmed", "invoiced", "paid", "cancelled"];
  if (!b.status || !valid.includes(b.status)) return c.json({ error: "Invalid status" }, 400);
  const id = c.req.param("id");
  const wholesale = await import("../services/wholesale");

  if (b.status === "invoiced") {
    // Invoicing stamps the due date from the buyer's net terms and emails the
    // invoice (amount, due date, sign-in-to-pay link). Best-effort email.
    const o = await first<{ terms_days: number }>(
      c.var.db,
      `SELECT a.terms_days FROM wholesale_orders o JOIN wholesale_accounts a ON a.id = o.account_id WHERE o.id = ?`,
      id,
    );
    await run(
      c.var.db,
      `UPDATE wholesale_orders SET status = 'invoiced',
              due_date = date('now', '+' || ? || ' days'), updated_at = datetime('now') WHERE id = ?`,
      o?.terms_days ?? 0,
      id,
    );
    await wholesale.sendWholesaleInvoiceEmail(c.env, c.var.db, { orderId: id, baseUrl: await adminBaseUrl(c) });
  } else if (b.status === "paid") {
    // Manual mark-paid (bank transfer etc.) — same paid path as the webhook.
    await wholesale.applyWholesalePaid(c.env, c.var.db, { orderId: id });
  } else {
    await run(
      c.var.db,
      `UPDATE wholesale_orders SET status = ?, updated_at = datetime('now') WHERE id = ?`,
      b.status,
      id,
    );
  }

  // Confirmation puts the order into the retail fulfilment pipeline, so
  // shipping rates, labels, tracking, and buyer emails all work on it.
  if (b.status === "confirmed") {
    await wholesale.materializeFulfillmentOrder(c.var.db, id).catch((err) => {
      console.error(`[wholesale] materialize failed: ${String(err).slice(0, 160)}`);
    });
  }
  await writeAudit(c.var.db, c.var.userId, "wholesale.order.status", "wholesale_order", id, b);
  return c.json({ ok: true });
});

/** A fresh Stripe payment link for an invoice — copy & send it anywhere. */
adminWholesaleRoutes.post("/orders/:id/payment-link", requireAdminWrite, async (c) => {
  const { createInvoiceCheckout } = await import("../services/wholesale");
  const result = await createInvoiceCheckout(c.env, c.var.db, {
    orderId: c.req.param("id"),
    shopId: c.var.shopId,
    baseUrl: await adminBaseUrl(c),
  });
  if ("error" in result) return c.json({ error: result.error }, 400);
  return c.json(result);
});
