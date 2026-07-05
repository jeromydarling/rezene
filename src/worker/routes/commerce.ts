import { Hono } from "hono";
import { z } from "zod";
import { first, run } from "../services/db";
import { getStripe, SHIPPING_COUNTRIES } from "../services/stripe";
import { parseBody } from "../services/validators";
import { rateLimit } from "../middleware/rate-limit";
import { newId } from "../utils/id";
import type { AppContext } from "../types/env";

export const commerceRoutes = new Hono<AppContext>();

const checkoutSchema = z.object({
  variantId: z.string().min(1).max(80),
  quantity: z.number().int().min(1).max(10).default(1),
});

/**
 * Create a Stripe Checkout Session for a single variant.
 *
 * Uses inline price_data (no upfront product sync required); the
 * stripe_product_mappings table remains available for a future sync
 * strategy. A pending order + line items are written first, and the
 * order id rides along as metadata/client_reference_id so the webhook
 * can settle it.
 */
commerceRoutes.post(
  "/checkout",
  rateLimit({ key: "checkout", limit: 20, windowSeconds: 3600 }),
  async (c) => {
    const stripe = getStripe(c.env);
    if (!stripe) {
      return c.json(
        { error: "Checkout is not configured yet (missing Stripe keys). See README." },
        503,
      );
    }
    const { variantId, quantity } = await parseBody(c, checkoutSchema);

    const variant = await first<{
      id: string;
      colorway_name: string;
      size: string;
      price_cents: number | null;
      currency: string;
      is_active: number;
      product_id: string;
      product_name: string;
      slug: string;
      base_price_cents: number;
      availability: string;
      is_published: number;
      on_hand: number | null;
      reserved: number | null;
    }>(
      c.env.DB,
      `SELECT v.id, v.colorway_name, v.size, v.price_cents, v.currency, v.is_active,
              p.id AS product_id, p.name AS product_name, p.slug, p.base_price_cents,
              p.availability, p.is_published, i.on_hand, i.reserved
       FROM product_variants v
       JOIN products p ON p.id = v.product_id
       LEFT JOIN inventory_items i ON i.variant_id = v.id
       WHERE v.id = ?`,
      variantId,
    );
    if (!variant || !variant.is_active || !variant.is_published) {
      return c.json({ error: "This piece is not available" }, 404);
    }
    if (variant.availability === "sold_out" || variant.availability === "archived") {
      return c.json({ error: "This piece is sold out" }, 409);
    }
    const isPreOrder = variant.availability === "pre_order";
    const available = Math.max(0, (variant.on_hand ?? 0) - (variant.reserved ?? 0));
    if (!isPreOrder && available < quantity) {
      return c.json({ error: "Not enough stock for that quantity" }, 409);
    }

    const unitPrice = variant.price_cents ?? variant.base_price_cents;
    const orderId = newId("ord");
    const seq = await first<{ n: number }>(c.env.DB, `SELECT COUNT(*) AS n FROM orders`);
    const orderNumber = `MA-${1000 + (seq?.n ?? 0) + 1}`;
    const description = `${variant.product_name} — ${variant.colorway_name} / ${variant.size}`;

    await run(
      c.env.DB,
      `INSERT INTO orders (id, order_number, currency, subtotal_cents, total_cents,
         payment_status, is_pre_order)
       VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
      orderId,
      orderNumber,
      variant.currency,
      unitPrice * quantity,
      unitPrice * quantity,
      isPreOrder ? 1 : 0,
    );
    await run(
      c.env.DB,
      `INSERT INTO order_items (id, order_id, product_id, variant_id, description, quantity, unit_price_cents, currency)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      newId("oit"),
      orderId,
      variant.product_id,
      variant.id,
      description,
      quantity,
      unitPrice,
      variant.currency,
    );

    const origin = new URL(c.req.url).origin;
    const appUrl = c.env.APP_ENV === "development" ? origin : (c.env.APP_URL || origin);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      client_reference_id: orderId,
      metadata: { order_id: orderId, order_number: orderNumber, pre_order: String(isPreOrder) },
      line_items: [
        {
          quantity,
          price_data: {
            currency: variant.currency.toLowerCase(),
            unit_amount: unitPrice,
            product_data: {
              name: variant.product_name,
              description: `${variant.colorway_name} / ${variant.size}${isPreOrder ? " · Pre-order" : ""}`,
              metadata: { product_id: variant.product_id, variant_id: variant.id },
            },
          },
        },
      ],
      allow_promotion_codes: true,
      shipping_address_collection: { allowed_countries: SHIPPING_COUNTRIES },
      // Enable once Stripe Tax is activated on the account:
      // automatic_tax: { enabled: true },
      success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/products/${variant.slug}`,
    });

    await run(
      c.env.DB,
      `UPDATE orders SET stripe_checkout_session_id = ?, updated_at = datetime('now') WHERE id = ?`,
      session.id,
      orderId,
    );
    if (!session.url) return c.json({ error: "Stripe did not return a checkout URL" }, 502);
    return c.json({ url: session.url, orderId, orderNumber });
  },
);

/** Lightweight confirmation for the success page (no auth — token is the session id). */
commerceRoutes.get("/checkout/confirm", async (c) => {
  const sessionId = c.req.query("session_id");
  if (!sessionId) return c.json({ error: "session_id required" }, 400);
  const order = await first<{
    order_number: string;
    payment_status: string;
    total_cents: number;
    currency: string;
    is_pre_order: number;
  }>(
    c.env.DB,
    `SELECT order_number, payment_status, total_cents, currency, is_pre_order
     FROM orders WHERE stripe_checkout_session_id = ?`,
    sessionId,
  );
  if (!order) return c.json({ error: "Order not found" }, 404);
  return c.json({
    orderNumber: order.order_number,
    paymentStatus: order.payment_status,
    totalCents: order.total_cents,
    currency: order.currency,
    isPreOrder: Boolean(order.is_pre_order),
  });
});

/**
 * Stripe Customer Portal launcher (placeholder route per spec).
 * Requires a customer id; wired into account UX when customer auth exists.
 */
commerceRoutes.post("/customer-portal", async (c) => {
  const stripe = getStripe(c.env);
  if (!stripe) return c.json({ error: "Stripe is not configured" }, 503);
  const body = (await c.req.json().catch(() => ({}))) as { customerId?: string };
  if (!body.customerId) {
    return c.json({ error: "customerId required — customer accounts land in a later phase" }, 400);
  }
  const customer = await first<{ stripe_customer_id: string | null }>(
    c.env.DB,
    `SELECT stripe_customer_id FROM customers WHERE id = ?`,
    body.customerId,
  );
  if (!customer?.stripe_customer_id) return c.json({ error: "Unknown customer" }, 404);
  const origin = new URL(c.req.url).origin;
  const session = await stripe.billingPortal.sessions.create({
    customer: customer.stripe_customer_id,
    return_url: origin,
  });
  return c.json({ url: session.url });
});
