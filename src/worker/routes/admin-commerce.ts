import { Hono } from "hono";
import { all, first, run, writeAudit } from "../services/db";
import { campaignCreateSchema, campaignUpdateSchema, parseBody } from "../services/validators";
import { requireAdminWrite } from "../middleware/auth";
import { newId } from "../utils/id";
import type { AppContext } from "../types/env";
import type { AdminCustomer, AdminOrder } from "../../shared/types";

export const adminCommerceRoutes = new Hono<AppContext>();

// ---------- Pre-order campaigns ----------
adminCommerceRoutes.get("/preorder-campaigns", async (c) => {
  const rows = await all(
    c.var.db,
    `SELECT pc.*, p.name AS product_name, p.slug AS product_slug, p.availability,
            sup.name AS supplier_name, sup.moq_units AS supplier_moq,
            (SELECT COALESCE(SUM(oi.quantity), 0) FROM order_items oi
               JOIN orders o ON o.id = oi.order_id
               WHERE oi.product_id = pc.product_id AND oi.is_pre_order = 1
                 AND o.payment_status IN ('paid','partially_refunded')) AS ordered_units
     FROM preorder_campaigns pc
     JOIN products p ON p.id = pc.product_id
     LEFT JOIN suppliers sup ON sup.id = pc.supplier_id
     ORDER BY pc.created_at DESC`,
  );
  return c.json(rows);
});

adminCommerceRoutes.post("/preorder-campaigns", requireAdminWrite, async (c) => {
  const body = await parseBody(c, campaignCreateSchema);
  const product = await first<{ id: string; availability: string }>(
    c.var.db,
    `SELECT id, availability FROM products WHERE id = ?`,
    body.productId,
  );
  if (!product) return c.json({ error: "Product not found" }, 404);
  const existing = await first(
    c.var.db,
    `SELECT id FROM preorder_campaigns WHERE product_id = ?`,
    body.productId,
  );
  if (existing) return c.json({ error: "This product already has a campaign" }, 409);
  const id = newId("pc");
  await run(
    c.var.db,
    `INSERT INTO preorder_campaigns (id, product_id, goal_units, max_units, cutoff_date, supplier_id, note)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    id,
    body.productId,
    body.goalUnits,
    body.maxUnits ?? null,
    body.cutoffDate ?? null,
    body.supplierId ?? null,
    body.note ?? null,
  );
  // A campaign implies the product sells as pre-order.
  if (product.availability !== "pre_order") {
    await run(
      c.var.db,
      `UPDATE products SET availability = 'pre_order', updated_at = datetime('now') WHERE id = ?`,
      body.productId,
    );
  }
  await writeAudit(c.var.db, c.var.userId, "preorder_campaign.create", "preorder_campaign", id, body);
  return c.json({ id }, 201);
});

adminCommerceRoutes.patch("/preorder-campaigns/:id", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  const body = await parseBody(c, campaignUpdateSchema);
  const existing = await first(c.var.db, `SELECT id FROM preorder_campaigns WHERE id = ?`, id);
  if (!existing) return c.json({ error: "Campaign not found" }, 404);
  const fieldMap: Record<string, string> = {
    goalUnits: "goal_units",
    maxUnits: "max_units",
    cutoffDate: "cutoff_date",
    status: "status",
    note: "note",
  };
  const sets: string[] = [`updated_at = datetime('now')`];
  const params: unknown[] = [];
  for (const [key, col] of Object.entries(fieldMap)) {
    if (key in body) {
      sets.push(`${col} = ?`);
      params.push((body as Record<string, unknown>)[key] ?? null);
    }
  }
  await run(c.var.db, `UPDATE preorder_campaigns SET ${sets.join(", ")} WHERE id = ?`, ...params, id);
  await writeAudit(c.var.db, c.var.userId, "preorder_campaign.update", "preorder_campaign", id, body);
  return c.json({ ok: true });
});

// ---------- Orders ----------
const ORDER_SELECT = `
  SELECT o.*, c.name AS customer_name,
    (SELECT COALESCE(SUM(quantity), 0) FROM order_items i WHERE i.order_id = o.id) AS item_count
  FROM orders o
  LEFT JOIN customers c ON c.id = o.customer_id`;

function mapOrder(row: Record<string, unknown>): AdminOrder {
  return {
    id: row.id as string,
    orderNumber: row.order_number as string,
    email: (row.email as string) ?? null,
    customerName: (row.customer_name as string) ?? null,
    totalCents: row.total_cents as number,
    currency: row.currency as string,
    paymentStatus: row.payment_status as string,
    fulfillmentStatus: row.fulfillment_status as string,
    isPreOrder: Boolean(row.is_pre_order),
    shippingCountry: (row.shipping_country as string) ?? null,
    itemCount: (row.item_count as number) ?? 0,
    placedAt: (row.placed_at as string) ?? null,
    createdAt: row.created_at as string,
  };
}

adminCommerceRoutes.get("/orders", async (c) => {
  const status = c.req.query("payment_status");
  const params: unknown[] = [];
  let where = "";
  if (status) {
    where = `WHERE o.payment_status = ?`;
    params.push(status);
  }
  const rows = await all(
    c.var.db,
    `${ORDER_SELECT} ${where} ORDER BY o.created_at DESC LIMIT 200`,
    ...params,
  );
  return c.json(rows.map(mapOrder));
});

adminCommerceRoutes.get("/orders/:id", async (c) => {
  const row = await first<Record<string, unknown>>(
    c.var.db,
    `${ORDER_SELECT} WHERE o.id = ?`,
    c.req.param("id"),
  );
  if (!row) return c.json({ error: "Order not found" }, 404);
  const items = await all(
    c.var.db,
    `SELECT id, description, quantity, unit_price_cents, currency FROM order_items WHERE order_id = ?`,
    row.id,
  );
  const payments = await all(
    c.var.db,
    `SELECT id, stripe_payment_intent_id, amount_cents, currency, status, method_summary, created_at
     FROM payments WHERE order_id = ?`,
    row.id,
  );
  const refunds = await all(
    c.var.db,
    `SELECT id, stripe_refund_id, amount_cents, currency, reason, status, created_at
     FROM refunds WHERE order_id = ?`,
    row.id,
  );
  return c.json({ ...mapOrder(row), shippingAddress: row.shipping_address_json, items, payments, refunds });
});

// ---------- Customers ----------
adminCommerceRoutes.get("/customers", async (c) => {
  const rows = await all<Record<string, unknown>>(
    c.var.db,
    `SELECT c.*,
       (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id) AS order_count,
       (SELECT COALESCE(SUM(o.total_cents), 0) FROM orders o
          WHERE o.customer_id = c.id AND o.payment_status IN ('paid','partially_refunded')) AS total_spent
     FROM customers c ORDER BY c.created_at DESC LIMIT 500`,
  );
  const customers: AdminCustomer[] = rows.map((r) => ({
    id: r.id as string,
    email: r.email as string,
    name: (r.name as string) ?? null,
    country: (r.country as string) ?? null,
    stripeCustomerId: (r.stripe_customer_id as string) ?? null,
    orderCount: (r.order_count as number) ?? 0,
    totalSpentCents: (r.total_spent as number) ?? 0,
    createdAt: r.created_at as string,
  }));
  return c.json(customers);
});

// ---------- Leads ----------
adminCommerceRoutes.get("/leads", async (c) => {
  const rows = await all(
    c.var.db,
    `SELECT id, kind, email, name, company, message, product_id, created_at
     FROM leads ORDER BY created_at DESC LIMIT 500`,
  );
  return c.json(rows);
});

// ---------- Promotions ----------
adminCommerceRoutes.get("/promotions", async (c) => {
  const rows = await all(
    c.var.db,
    `SELECT id, code, description, percent_off, amount_off_cents, currency, starts_at, ends_at, is_active
     FROM promotions ORDER BY created_at DESC`,
  );
  return c.json(rows);
});
