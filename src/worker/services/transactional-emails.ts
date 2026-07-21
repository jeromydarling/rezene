import { first } from "./db";
import { sendBuyerEmail, shipmentEmail, returnEmail } from "./buyer-email";
import type { Env } from "../types/env";

/**
 * Order-lifecycle transactional email. These wrap the buyer-email templates
 * with the shared "look up the order, resolve the brand, send" plumbing so the
 * shipping and returns routes can fire a customer email from one call. Every
 * function is best-effort: it swallows its own errors (a failed or unconfigured
 * send must never break the webhook/admin path that triggered it) and no-ops
 * when the order has no email on file.
 *
 * Deduplication is the caller's job — each call site fires only on the actual
 * status transition (guarding on the order's prior fulfilment/return state), so
 * a customer gets "shipped" and "delivered" exactly once even though carrier
 * webhooks deliver many in-transit events.
 */

export async function notifyShipmentStatus(
  env: Env,
  db: D1Database,
  opts: { orderId: string; kind: "shipped" | "delivered"; shopSlug?: string | null },
): Promise<void> {
  try {
    const order = await first<{ order_number: string; email: string | null }>(
      db,
      `SELECT order_number, email FROM orders WHERE id = ?`,
      opts.orderId,
    );
    if (!order?.email) return;
    // Newest shipment carries the tracking the customer wants to click.
    const ship = await first<{ carrier: string | null; tracking_number: string | null; tracking_url: string | null }>(
      db,
      `SELECT carrier, tracking_number, tracking_url FROM order_shipments
       WHERE order_id = ? ORDER BY created_at DESC LIMIT 1`,
      opts.orderId,
    );
    const { getEmailBrand } = await import("./email-template");
    const brand = await getEmailBrand(env, db, opts.shopSlug);
    const tpl = shipmentEmail(opts.kind, {
      brandName: brand.name,
      orderNumber: order.order_number,
      carrier: ship?.carrier,
      trackingNumber: ship?.tracking_number,
      trackingUrl: ship?.tracking_url,
      brand,
    });
    await sendBuyerEmail(env, { to: order.email, db, ...tpl });
  } catch (err) {
    console.error(`[transactional-email] shipment ${opts.kind} failed: ${String(err)}`);
  }
}

export async function notifyReturnStatus(
  env: Env,
  db: D1Database,
  opts: {
    orderId: string;
    kind: "received" | "declined" | "refunded";
    refundAmountCents?: number;
    currency?: string | null;
    shopSlug?: string | null;
  },
): Promise<void> {
  try {
    const order = await first<{ order_number: string; email: string | null }>(
      db,
      `SELECT order_number, email FROM orders WHERE id = ?`,
      opts.orderId,
    );
    if (!order?.email) return;
    const { getEmailBrand } = await import("./email-template");
    const brand = await getEmailBrand(env, db, opts.shopSlug);
    const tpl = returnEmail(opts.kind, {
      brandName: brand.name,
      orderNumber: order.order_number,
      refundAmountCents: opts.refundAmountCents,
      currency: opts.currency ?? undefined,
      brand,
    });
    await sendBuyerEmail(env, { to: order.email, db, ...tpl });
  } catch (err) {
    console.error(`[transactional-email] return ${opts.kind} failed: ${String(err)}`);
  }
}
