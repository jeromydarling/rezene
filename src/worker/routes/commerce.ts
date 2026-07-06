import { Hono } from "hono";
import { z } from "zod";
import type Stripe from "stripe";
import { first, run } from "../services/db";
import { getStripe, SHIPPING_COUNTRIES } from "../services/stripe";
import { buildRateRequest, quoteEnabledProviders, type RateQuote } from "../services/shipping";
import { parseBody } from "../services/validators";
import { rateLimit } from "../middleware/rate-limit";
import { newId } from "../utils/id";
import type { AppContext } from "../types/env";

export const commerceRoutes = new Hono<AppContext>();

const countrySchema = z
  .string()
  .length(2)
  .transform((s) => s.toUpperCase())
  .optional();
const checkoutItemSchema = z.object({
  variantId: z.string().min(1).max(80),
  quantity: z.number().int().min(1).max(10).default(1),
});
const checkoutSchema = z.union([
  z.object({
    items: z.array(checkoutItemSchema).min(1).max(20),
    shippingCountry: countrySchema,
  }),
  // Legacy single-item shape (PDP "Buy now").
  checkoutItemSchema.extend({ shippingCountry: countrySchema }),
]);

interface ResolvedItem {
  variantId: string;
  productId: string;
  slug: string;
  description: string;
  productName: string;
  variantLabel: string;
  quantity: number;
  unitPriceCents: number;
  currency: string;
  isPreOrder: boolean;
}

/**
 * Create a Stripe Checkout Session for one or more variants (cart).
 *
 * Guardrails per item: published + active, stock for in-stock items, and
 * for pre-orders the campaign rules — cutoff date and hard unit cap — so
 * a label can never oversell a production run.
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
    const parsed = await parseBody(c, checkoutSchema);
    const items = "items" in parsed ? parsed.items : [parsed];

    const resolved: ResolvedItem[] = [];
    const today = new Date().toISOString().slice(0, 10);

    for (const item of items) {
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
        c.var.db,
        `SELECT v.id, v.colorway_name, v.size, v.price_cents, v.currency, v.is_active,
                p.id AS product_id, p.name AS product_name, p.slug, p.base_price_cents,
                p.availability, p.is_published, i.on_hand, i.reserved
         FROM product_variants v
         JOIN products p ON p.id = v.product_id
         LEFT JOIN inventory_items i ON i.variant_id = v.id
         WHERE v.id = ?`,
        item.variantId,
      );
      if (!variant || !variant.is_active || !variant.is_published) {
        return c.json({ error: "One of the pieces in your cart is no longer available" }, 404);
      }
      if (variant.availability === "sold_out" || variant.availability === "archived") {
        return c.json({ error: `${variant.product_name} is sold out` }, 409);
      }
      const isPreOrder = variant.availability === "pre_order";
      if (!isPreOrder) {
        const available = Math.max(0, (variant.on_hand ?? 0) - (variant.reserved ?? 0));
        if (available < item.quantity) {
          return c.json({ error: `Not enough stock of ${variant.product_name}` }, 409);
        }
      } else {
        // Pre-order campaign guardrails: cutoff + hard cap against oversell.
        const campaign = await first<{
          status: string;
          cutoff_date: string | null;
          max_units: number | null;
        }>(
          c.var.db,
          `SELECT status, cutoff_date, max_units FROM preorder_campaigns WHERE product_id = ?`,
          variant.product_id,
        );
        if (campaign) {
          if (!["live", "funded"].includes(campaign.status)) {
            return c.json(
              { error: `The pre-order window for ${variant.product_name} has closed` },
              409,
            );
          }
          if (campaign.cutoff_date && campaign.cutoff_date < today) {
            return c.json(
              { error: `The pre-order window for ${variant.product_name} closed on ${campaign.cutoff_date}` },
              409,
            );
          }
          if (campaign.max_units != null) {
            const ordered = await first<{ n: number }>(
              c.var.db,
              `SELECT COALESCE(SUM(oi.quantity), 0) AS n FROM order_items oi
               JOIN orders o ON o.id = oi.order_id
               WHERE oi.product_id = ? AND oi.is_pre_order = 1
                 AND o.payment_status IN ('paid','partially_refunded')`,
              variant.product_id,
            );
            const remaining = campaign.max_units - (ordered?.n ?? 0);
            if (remaining < item.quantity) {
              return c.json(
                {
                  error:
                    remaining <= 0
                      ? `${variant.product_name} pre-orders are fully allocated`
                      : `Only ${remaining} unit(s) of ${variant.product_name} remain in this pre-order run`,
                },
                409,
              );
            }
          }
        }
      }
      resolved.push({
        variantId: variant.id,
        productId: variant.product_id,
        slug: variant.slug,
        description: `${variant.product_name} — ${variant.colorway_name} / ${variant.size}`,
        productName: variant.product_name,
        variantLabel: `${variant.colorway_name} / ${variant.size}`,
        quantity: item.quantity,
        unitPriceCents: variant.price_cents ?? variant.base_price_cents,
        currency: variant.currency,
        isPreOrder,
      });
    }

    const currency = resolved[0].currency;
    if (resolved.some((r) => r.currency !== currency)) {
      return c.json({ error: "Cart items must share a currency" }, 400);
    }
    const subtotal = resolved.reduce((sum, r) => sum + r.unitPriceCents * r.quantity, 0);
    const anyPreOrder = resolved.some((r) => r.isPreOrder);

    const orderId = newId("ord");
    const seq = await first<{ n: number }>(c.var.db, `SELECT COUNT(*) AS n FROM orders`);
    const orderNumber = `MA-${1000 + (seq?.n ?? 0) + 1}`;

    await run(
      c.var.db,
      `INSERT INTO orders (id, order_number, currency, subtotal_cents, total_cents,
         payment_status, is_pre_order)
       VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
      orderId,
      orderNumber,
      currency,
      subtotal,
      subtotal,
      anyPreOrder ? 1 : 0,
    );
    await c.var.db.batch(
      resolved.map((r) =>
        c.var.db.prepare(
          `INSERT INTO order_items (id, order_id, product_id, variant_id, description, quantity, unit_price_cents, currency, is_pre_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).bind(
          newId("oit"),
          orderId,
          r.productId,
          r.variantId,
          r.description,
          r.quantity,
          r.unitPriceCents,
          r.currency,
          r.isPreOrder ? 1 : 0,
        ),
      ),
    );

    // Live shipping options when the buyer told us their country on the cart
    // page. Quoting is best-effort: any provider failure (or no country) just
    // means Stripe collects the address without shipping charges, exactly as
    // before the shipping layer existed.
    let shippingOptions: Stripe.Checkout.SessionCreateParams.ShippingOption[] = [];
    if (parsed.shippingCountry) {
      try {
        const req = await buildRateRequest(c.var.db, {
          to: { country: parsed.shippingCountry },
          items: resolved.map((r) => ({
            description: r.description,
            quantity: r.quantity,
            valueCents: r.unitPriceCents,
            currency: r.currency,
          })),
          currency,
          subtotalCents: subtotal,
        });
        const { quotes } = await quoteEnabledProviders(c.var.db, req, {
          checkoutOnly: true,
          timeoutMs: 8_000,
        });
        shippingOptions = quotesToStripeOptions(quotes, currency);
      } catch (err) {
        console.error("[checkout] shipping quote failed:", err);
      }
    }

    const origin = new URL(c.req.url).origin;
    const { getPrimaryShopBase } = await import("../services/shops");
    const shopBase = c.var.shopSlug ? `/${c.var.shopSlug}` : await getPrimaryShopBase(c.env.DB);
    const appUrl =
      (c.env.APP_ENV === "development" ? origin : (c.env.APP_URL || origin)) + shopBase;
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      client_reference_id: orderId,
      metadata: { order_id: orderId, order_number: orderNumber },
      line_items: resolved.map((r) => ({
        quantity: r.quantity,
        price_data: {
          currency: r.currency.toLowerCase(),
          unit_amount: r.unitPriceCents,
          product_data: {
            name: r.productName,
            description: `${r.variantLabel}${r.isPreOrder ? " · Pre-order" : ""}`,
            metadata: { product_id: r.productId, variant_id: r.variantId },
          },
        },
      })),
      allow_promotion_codes: true,
      shipping_address_collection: { allowed_countries: SHIPPING_COUNTRIES },
      ...(shippingOptions.length > 0 ? { shipping_options: shippingOptions } : {}),
      // Enable once Stripe Tax is activated on the account:
      // automatic_tax: { enabled: true },
      success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: resolved.length === 1 ? `${appUrl}/products/${resolved[0].slug}` : `${appUrl}/cart`,
    });

    await run(
      c.var.db,
      `UPDATE orders SET stripe_checkout_session_id = ?, updated_at = datetime('now') WHERE id = ?`,
      session.id,
      orderId,
    );
    if (!session.url) return c.json({ error: "Stripe did not return a checkout URL" }, 502);
    return c.json({ url: session.url, orderId, orderNumber });
  },
);

/**
 * Stripe accepts at most 5 shipping options per session; quotes arrive
 * cheapest-first, and only quotes in the cart currency are usable (Stripe
 * requires the fixed amount to match the session currency).
 */
function quotesToStripeOptions(
  quotes: RateQuote[],
  currency: string,
): Stripe.Checkout.SessionCreateParams.ShippingOption[] {
  return quotes
    .filter((q) => q.currency.toUpperCase() === currency.toUpperCase())
    .slice(0, 5)
    .map((q) => ({
      shipping_rate_data: {
        display_name: `${q.carrier} — ${q.service}`.slice(0, 100),
        type: "fixed_amount" as const,
        fixed_amount: { amount: q.amountCents, currency: q.currency.toLowerCase() },
        ...(q.minDays != null || q.maxDays != null
          ? {
              delivery_estimate: {
                ...(q.minDays != null
                  ? { minimum: { unit: "business_day" as const, value: Math.max(1, q.minDays) } }
                  : {}),
                ...(q.maxDays != null
                  ? { maximum: { unit: "business_day" as const, value: Math.max(1, q.maxDays) } }
                  : {}),
              },
            }
          : {}),
        metadata: { provider: q.provider, rate_id: q.rateId ?? "" },
      },
    }));
}

/**
 * Cart-page shipping estimate: quote checkout-enabled providers for a
 * destination country before the buyer commits to Stripe. Rate-limited —
 * live carrier quotes are metered API calls.
 */
commerceRoutes.post(
  "/shipping/quote",
  rateLimit({ key: "shipping_quote", limit: 30, windowSeconds: 3600 }),
  async (c) => {
    const body = await parseBody(
      c,
      z.object({
        country: z.string().length(2).transform((s) => s.toUpperCase()),
        items: z.array(checkoutItemSchema).min(1).max(20),
      }),
    );
    const lines: { description: string; quantity: number; valueCents: number; currency: string }[] =
      [];
    for (const item of body.items) {
      const variant = await first<{
        price_cents: number | null;
        base_price_cents: number;
        currency: string;
        name: string;
      }>(
        c.var.db,
        `SELECT v.price_cents, p.base_price_cents, v.currency, p.name
         FROM product_variants v JOIN products p ON p.id = v.product_id WHERE v.id = ?`,
        item.variantId,
      );
      if (!variant) continue;
      lines.push({
        description: variant.name,
        quantity: item.quantity,
        valueCents: variant.price_cents ?? variant.base_price_cents,
        currency: variant.currency,
      });
    }
    if (lines.length === 0) return c.json({ quotes: [] });
    const subtotal = lines.reduce((sum, l) => sum + l.valueCents * l.quantity, 0);
    const req = await buildRateRequest(c.var.db, {
      to: { country: body.country },
      items: lines,
      currency: lines[0].currency,
      subtotalCents: subtotal,
    });
    const { quotes } = await quoteEnabledProviders(c.var.db, req, {
      checkoutOnly: true,
      timeoutMs: 8_000,
    });
    // Buyer-facing: strip provider internals, keep display fields.
    return c.json({
      quotes: quotes.slice(0, 6).map((q) => ({
        carrier: q.carrier,
        service: q.service,
        amountCents: q.amountCents,
        currency: q.currency,
        minDays: q.minDays ?? null,
        maxDays: q.maxDays ?? null,
      })),
    });
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
    c.var.db,
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
    c.var.db,
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
