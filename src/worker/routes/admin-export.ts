import { Hono } from "hono";
import { all } from "../services/db";
import type { AppContext } from "../types/env";

/**
 * Data export — a boutique should never feel locked in. Products, customers,
 * and orders download as plain CSV a spreadsheet or accountant can open. Read
 * access (same as the pages that show this data).
 */
export const adminExportRoutes = new Hono<AppContext>();

/** Quote a value for CSV: wrap in quotes and double any internal quotes. */
function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvCell).join(",")];
  for (const r of rows) lines.push(r.map(csvCell).join(","));
  return lines.join("\r\n");
}

function csvResponse(c: { body: (b: string, s: number, h: Record<string, string>) => Response }, name: string, csv: string) {
  return c.body(csv, 200, {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${name}"`,
  });
}

adminExportRoutes.get("/products.csv", async (c) => {
  const rows = await all<Record<string, unknown>>(
    c.var.db,
    `SELECT p.slug, p.name, p.category, p.gender, p.availability, p.base_price_cents, p.currency,
            p.is_published,
            (SELECT COALESCE(SUM(i.on_hand),0) FROM inventory_items i
               JOIN product_variants v ON v.id = i.variant_id WHERE v.product_id = p.id) AS on_hand
     FROM products p ORDER BY p.name`,
  );
  const csv = toCsv(
    ["slug", "name", "category", "gender", "availability", "price", "currency", "published", "on_hand"],
    rows.map((r) => [
      r.slug,
      r.name,
      r.category,
      r.gender,
      r.availability,
      ((r.base_price_cents as number) / 100).toFixed(2),
      r.currency,
      r.is_published ? "yes" : "no",
      r.on_hand,
    ]),
  );
  return csvResponse(c, "products.csv", csv);
});

adminExportRoutes.get("/customers.csv", async (c) => {
  const rows = await all<Record<string, unknown>>(
    c.var.db,
    `SELECT c.email, c.name, c.country, c.created_at,
            (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id AND o.payment_status IN ('paid','partially_refunded')) AS orders,
            (SELECT COALESCE(SUM(o.total_cents),0) FROM orders o WHERE o.customer_id = c.id AND o.payment_status IN ('paid','partially_refunded')) AS spent_cents,
            c.marketing_opt_in
     FROM customers c ORDER BY c.created_at DESC`,
  );
  const csv = toCsv(
    ["email", "name", "country", "joined", "orders", "lifetime_spend", "marketing_opt_in"],
    rows.map((r) => [
      r.email,
      r.name,
      r.country,
      r.created_at,
      r.orders,
      ((r.spent_cents as number) / 100).toFixed(2),
      r.marketing_opt_in ? "yes" : "no",
    ]),
  );
  return csvResponse(c, "customers.csv", csv);
});

adminExportRoutes.get("/orders.csv", async (c) => {
  const rows = await all<Record<string, unknown>>(
    c.var.db,
    `SELECT o.order_number, o.created_at, o.email, o.payment_status, o.fulfillment_status,
            o.subtotal_cents, o.shipping_cents, o.tax_cents, o.discount_cents, o.total_cents, o.currency,
            o.shipping_country, o.is_pre_order
     FROM orders o WHERE o.payment_status != 'pending' ORDER BY o.created_at DESC`,
  );
  const money = (v: unknown) => ((Number(v) || 0) / 100).toFixed(2);
  const csv = toCsv(
    ["order", "date", "email", "payment", "fulfillment", "subtotal", "shipping", "tax", "discount", "total", "currency", "country", "pre_order"],
    rows.map((r) => [
      r.order_number,
      r.created_at,
      r.email,
      r.payment_status,
      r.fulfillment_status,
      money(r.subtotal_cents),
      money(r.shipping_cents),
      money(r.tax_cents),
      money(r.discount_cents),
      money(r.total_cents),
      r.currency,
      r.shipping_country,
      r.is_pre_order ? "yes" : "no",
    ]),
  );
  return csvResponse(c, "orders.csv", csv);
});

// ---- Accounting: a sales CSV your accountant / QuickBooks / Xero can import ----
// One row per paid order, with the figures split the way accounting software
// expects (net sales, discount, shipping, tax, total). Optional ?from=&to= dates.
adminExportRoutes.get("/accounting.csv", async (c) => {
  const from = c.req.query("from");
  const to = c.req.query("to");
  const params: unknown[] = [];
  let range = "";
  if (from) {
    range += ` AND o.created_at >= ?`;
    params.push(from);
  }
  if (to) {
    range += ` AND o.created_at < date(?, '+1 day')`;
    params.push(to);
  }
  const rows = await all<Record<string, unknown>>(
    c.var.db,
    `SELECT o.order_number, o.created_at, o.email, o.currency,
            o.subtotal_cents, o.discount_cents, o.shipping_cents, o.tax_cents, o.total_cents,
            (SELECT COALESCE(SUM(r.amount_cents),0) FROM refunds r WHERE r.order_id = o.id) AS refund_cents
     FROM orders o WHERE o.payment_status IN ('paid','partially_refunded','refunded') ${range}
     ORDER BY o.created_at`,
    ...params,
  );
  const m = (v: unknown) => ((Number(v) || 0) / 100).toFixed(2);
  const csv = toCsv(
    ["Date", "InvoiceNo", "Customer", "NetSales", "Discount", "Shipping", "Tax", "Total", "Refunds", "Currency"],
    rows.map((r) => [
      String(r.created_at).slice(0, 10),
      r.order_number,
      r.email,
      m((Number(r.subtotal_cents) || 0) - (Number(r.discount_cents) || 0)),
      m(r.discount_cents),
      m(r.shipping_cents),
      m(r.tax_cents),
      m(r.total_cents),
      m(r.refund_cents),
      r.currency,
    ]),
  );
  return csvResponse(c, "accounting-sales.csv", csv);
});

// ---- Journal: a monthly summary as debit/credit lines (manual-journal import) ----
adminExportRoutes.get("/journal.csv", async (c) => {
  const rows = await all<Record<string, number | string>>(
    c.var.db,
    `SELECT substr(o.created_at,1,7) AS month, o.currency,
            SUM(o.subtotal_cents - o.discount_cents) AS sales,
            SUM(o.shipping_cents) AS shipping,
            SUM(o.tax_cents) AS tax,
            SUM(o.total_cents) AS total,
            (SELECT COALESCE(SUM(r.amount_cents),0) FROM refunds r
               JOIN orders o2 ON o2.id = r.order_id
               WHERE substr(o2.created_at,1,7) = substr(o.created_at,1,7)) AS refunds
     FROM orders o WHERE o.payment_status IN ('paid','partially_refunded','refunded')
     GROUP BY month, o.currency ORDER BY month`,
  );
  const m = (v: unknown) => ((Number(v) || 0) / 100).toFixed(2);
  const lines: unknown[][] = [];
  for (const r of rows) {
    const date = `${r.month}-01`;
    // Debits (money in / expense), Credits (income / liability). Roughly:
    //   Bank = Sales + Shipping + Tax − Refunds
    lines.push([date, "Bank / Undeposited funds", m(Number(r.total) - Number(r.refunds)), "", "Net cash collected", r.month, r.currency]);
    lines.push([date, "Sales revenue", "", m(r.sales), "Net sales (after discounts)", r.month, r.currency]);
    lines.push([date, "Shipping income", "", m(r.shipping), "Shipping collected", r.month, r.currency]);
    lines.push([date, "Sales tax payable", "", m(r.tax), "Tax collected", r.month, r.currency]);
    if (Number(r.refunds) > 0)
      lines.push([date, "Refunds", m(r.refunds), "", "Refunds issued", r.month, r.currency]);
  }
  const csv = toCsv(["Date", "Account", "Debit", "Credit", "Description", "Period", "Currency"], lines);
  return csvResponse(c, "accounting-journal.csv", csv);
});

// ---- Reorder suggestions: variants at or below their low-stock threshold ----
adminExportRoutes.get("/reorder", async (c) => {
  const rows = await all(
    c.var.db,
    `SELECT p.name AS productName, v.colorway_name AS colorway, v.size,
            i.on_hand AS onHand, i.reserved AS reserved, i.incoming AS incoming,
            i.low_stock_threshold AS threshold,
            (SELECT COALESCE(SUM(oi.quantity),0)
               FROM order_items oi JOIN orders o ON o.id = oi.order_id
               WHERE oi.variant_id = v.id AND o.payment_status IN ('paid','partially_refunded')
                 AND o.created_at >= date('now','-90 days')) AS sold90
     FROM inventory_items i
     JOIN product_variants v ON v.id = i.variant_id
     JOIN products p ON p.id = v.product_id
     WHERE p.availability != 'archived' AND v.is_active = 1
       AND (i.on_hand - i.reserved) <= i.low_stock_threshold AND i.incoming = 0
     ORDER BY (i.on_hand - i.reserved) ASC, sold90 DESC
     LIMIT 200`,
  );
  // Suggest reordering to roughly cover the last 90 days' pace (min the threshold).
  const suggestions = rows.map((r) => {
    const row = r as Record<string, number | string>;
    const sold = Number(row.sold90) || 0;
    const suggested = Math.max(Number(row.threshold) || 0, Math.ceil(sold));
    return { ...row, suggestedReorder: suggested };
  });
  return c.json({ suggestions });
});
