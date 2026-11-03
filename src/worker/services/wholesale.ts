import { all, first, run } from "./db";
import { newId } from "../utils/id";
import type { Env } from "../types/env";

/**
 * Wholesale 2.0 — the shared machinery behind the B2B channel's money and
 * fulfilment paths:
 *
 *  - Pricing resolution: one pure function decides a buyer's unit price from
 *    (in order of precedence) their per-product override → the line-sheet
 *    item's quantity tiers → the base wholesale price minus their trade %.
 *  - Invoice payment: a Stripe Checkout session for an invoiced order,
 *    Connect-aware (destination charge + application fee when the shop has
 *    payouts connected), marked paid by webhook. Degrades cleanly to the
 *    manual mark-paid flow when Stripe isn't configured.
 *  - Fulfilment: confirming a wholesale order materialises a linked order in
 *    the retail pipeline, so labels, tracking, and the shipped/delivered
 *    buyer emails all work unchanged.
 */

// ---------- Pricing ----------

export interface PriceTier {
  minQty: number;
  priceCents: number;
}

/** Parse + sanitise a price_tiers JSON column. Invalid input → no tiers. */
export function parsePriceTiers(json: string | null | undefined): PriceTier[] {
  if (!json) return [];
  try {
    const raw = JSON.parse(json) as unknown;
    if (!Array.isArray(raw)) return [];
    return raw
      .filter(
        (t): t is PriceTier =>
          typeof t === "object" &&
          t !== null &&
          Number.isInteger((t as PriceTier).minQty) &&
          (t as PriceTier).minQty > 1 &&
          Number.isInteger((t as PriceTier).priceCents) &&
          (t as PriceTier).priceCents >= 0,
      )
      .sort((a, b) => a.minQty - b.minQty)
      .slice(0, 6);
  } catch {
    return [];
  }
}

/**
 * A buyer's unit price for a line-sheet item at a given quantity.
 * Precedence: absolute per-buyer override → deepest quantity tier the qty
 * reaches → base wholesale price; the trade discount % applies to tier/base
 * pricing but never to an override (an override IS the negotiated price).
 */
export function resolveWholesaleUnitPrice(opts: {
  baseCents: number;
  tiers?: PriceTier[];
  qty: number;
  discountPct: number;
  overrideCents?: number | null;
}): number {
  if (opts.overrideCents != null && opts.overrideCents >= 0) return Math.round(opts.overrideCents);
  let price = opts.baseCents;
  for (const tier of opts.tiers ?? []) {
    if (opts.qty >= tier.minQty) price = tier.priceCents;
  }
  const factor = 1 - Math.max(0, Math.min(90, opts.discountPct)) / 100;
  return Math.round(price * factor);
}

/** The buyer's override map (product_id → unit cents) for pricing lookups. */
export async function loadOverrides(db: D1Database, accountId: string): Promise<Map<string, number>> {
  const rows = await all<{ product_id: string; unit_price_cents: number }>(
    db,
    `SELECT product_id, unit_price_cents FROM wholesale_price_overrides WHERE account_id = ?`,
    accountId,
  );
  return new Map(rows.map((r) => [r.product_id, r.unit_price_cents]));
}

// ---------- Fulfilment ----------

/**
 * Materialise a wholesale order into the retail fulfilment pipeline: a linked
 * row in `orders` + `order_items` so the shipping tools (rates, labels,
 * tracking webhooks) and the shipped/delivered buyer emails work unchanged.
 * Idempotent — returns the existing linked order id on re-confirmation.
 * Stock is NOT decremented automatically (wholesale items are product-level,
 * not variant-level); receiving/shipping stock stays a deliberate manual move.
 */
export async function materializeFulfillmentOrder(db: D1Database, wholesaleOrderId: string): Promise<string | null> {
  const wo = await first<{
    id: string;
    order_number: string;
    currency: string;
    total_cents: number;
    fulfillment_order_id: string | null;
    shipping_address_json: string | null;
    shipping_country: string | null;
    status: string;
    email: string;
    company: string | null;
  }>(
    db,
    `SELECT o.id, o.order_number, o.currency, o.total_cents, o.fulfillment_order_id,
            o.shipping_address_json, o.shipping_country, o.status, a.email, a.company
     FROM wholesale_orders o JOIN wholesale_accounts a ON a.id = o.account_id
     WHERE o.id = ?`,
    wholesaleOrderId,
  );
  if (!wo) return null;
  if (wo.fulfillment_order_id) return wo.fulfillment_order_id;

  const orderId = newId("ord");
  await run(
    db,
    `INSERT INTO orders (id, order_number, email, currency, subtotal_cents, total_cents,
                         payment_status, fulfillment_status, shipping_country, shipping_address_json, placed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'unfulfilled', ?, ?, datetime('now'))`,
    orderId,
    wo.order_number,
    wo.email,
    wo.currency,
    wo.total_cents,
    wo.total_cents,
    wo.status === "paid" ? "paid" : "pending",
    wo.shipping_country,
    wo.shipping_address_json,
  );
  const items = await all<{ product_id: string | null; description: string; quantity: number; unit_price_cents: number; currency: string }>(
    db,
    `SELECT product_id, description, quantity, unit_price_cents, currency FROM wholesale_order_items WHERE order_id = ?`,
    wholesaleOrderId,
  );
  for (const it of items) {
    await run(
      db,
      `INSERT INTO order_items (id, order_id, product_id, description, quantity, unit_price_cents, currency)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      newId("oi"),
      orderId,
      it.product_id,
      `${it.description} · Wholesale${wo.company ? ` — ${wo.company}` : ""}`,
      it.quantity,
      it.unit_price_cents,
      it.currency,
    );
  }
  await run(
    db,
    `UPDATE wholesale_orders SET fulfillment_order_id = ?, updated_at = datetime('now') WHERE id = ?`,
    orderId,
    wholesaleOrderId,
  );
  return orderId;
}

// ---------- Invoice payment (Stripe, Connect-aware) ----------

/**
 * A Checkout session that pays a wholesale invoice online. Rides the same
 * Connect rails as retail checkout: destination charge + application fee when
 * the shop has payouts connected, platform account otherwise. Returns null
 * (with a reason) when Stripe isn't configured or the order isn't payable —
 * callers surface the message; nothing crashes.
 */
export async function createInvoiceCheckout(
  env: Env,
  db: D1Database,
  opts: { orderId: string; shopId: string; baseUrl: string },
): Promise<{ url: string } | { error: string }> {
  const { getStripe } = await import("./stripe");
  const stripe = getStripe(env);
  if (!stripe) return { error: "Online payment isn't set up yet — pay by the method on your invoice." };

  const order = await first<{
    id: string;
    order_number: string;
    status: string;
    total_cents: number;
    currency: string;
    email: string;
    company: string | null;
  }>(
    db,
    `SELECT o.id, o.order_number, o.status, o.total_cents, o.currency, a.email, a.company
     FROM wholesale_orders o JOIN wholesale_accounts a ON a.id = o.account_id WHERE o.id = ?`,
    opts.orderId,
  );
  if (!order) return { error: "Order not found." };
  if (order.status === "paid") return { error: "This order is already paid." };
  if (!["confirmed", "invoiced"].includes(order.status))
    return { error: "This order isn't ready for payment yet — the shop confirms it first." };
  if (order.total_cents <= 0) return { error: "Nothing to pay on this order." };

  const { getShopStripeState, platformFeeCents } = await import("./stripe-connect");
  const connectShop = await getShopStripeState(env, opts.shopId).catch(() => null);
  const connectParams =
    connectShop?.stripe_account_id && connectShop.stripe_charges_enabled
      ? {
          payment_intent_data: {
            transfer_data: { destination: connectShop.stripe_account_id },
            application_fee_amount: platformFeeCents(env, connectShop.plan, order.total_cents),
          },
        }
      : {};

  const { getBrandName } = await import("./brand");
  const brand = await getBrandName(env, db);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: order.email,
    metadata: {
      kind: "wholesale_invoice",
      shop_id: opts.shopId,
      wholesale_order_id: order.id,
      order_number: order.order_number,
    },
    ...connectParams,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: order.currency.toLowerCase(),
          unit_amount: order.total_cents,
          product_data: {
            name: `${brand} wholesale invoice ${order.order_number}`,
            description: order.company ? `For ${order.company}` : "Wholesale order",
          },
        },
      },
    ],
    success_url: `${opts.baseUrl}/wholesale?paid=${encodeURIComponent(order.order_number)}`,
    cancel_url: `${opts.baseUrl}/wholesale`,
  });
  if (!session.url) return { error: "Stripe didn't return a payment page — try again." };
  await run(
    db,
    `UPDATE wholesale_orders SET stripe_checkout_session_id = ?, updated_at = datetime('now') WHERE id = ?`,
    session.id,
    order.id,
  );
  return { url: session.url };
}

/**
 * Webhook landing: mark the wholesale order paid, sync the linked fulfilment
 * order, and send the receipts. Idempotent on replays (already-paid no-ops).
 */
export async function applyWholesalePaid(
  env: Env,
  db: D1Database,
  opts: { orderId: string; paymentIntentId?: string | null },
): Promise<void> {
  const order = await first<{
    id: string;
    order_number: string;
    status: string;
    total_cents: number;
    currency: string;
    fulfillment_order_id: string | null;
    email: string;
  }>(
    db,
    `SELECT o.id, o.order_number, o.status, o.total_cents, o.currency, o.fulfillment_order_id, a.email
     FROM wholesale_orders o JOIN wholesale_accounts a ON a.id = o.account_id WHERE o.id = ?`,
    opts.orderId,
  );
  if (!order || order.status === "paid") return;

  await run(
    db,
    `UPDATE wholesale_orders SET status = 'paid', paid_at = datetime('now'),
            stripe_payment_intent_id = COALESCE(?, stripe_payment_intent_id), updated_at = datetime('now')
     WHERE id = ?`,
    opts.paymentIntentId ?? null,
    order.id,
  );
  if (order.fulfillment_order_id) {
    await run(
      db,
      `UPDATE orders SET payment_status = 'paid', updated_at = datetime('now') WHERE id = ?`,
      order.fulfillment_order_id,
    );
  }

  // Receipts — best effort, never on the critical path.
  try {
    const { sendBuyerEmail } = await import("./buyer-email");
    const { getEmailBrand, renderBrandedEmail, itemsTableHtml } = await import("./email-template");
    const brand = await getEmailBrand(env, db);
    const money = `${(order.total_cents / 100).toFixed(2)} ${order.currency}`;
    await sendBuyerEmail(env, {
      to: order.email,
      db,
      subject: `${brand.name} — payment received for ${order.order_number}`,
      text: `Thank you — we've received your payment of ${money} for wholesale order ${order.order_number}. We'll be in touch about delivery.\n\n— ${brand.name}`,
      html: renderBrandedEmail({
        brand,
        preheader: `Payment received for ${order.order_number}`,
        heading: "Payment received — thank you.",
        bodyHtml: itemsTableHtml(
          [
            { label: "Order", right: order.order_number, muted: true },
            { label: "Paid", right: money },
          ],
          brand.palette.ink,
        ),
        footerNote: "We'll be in touch about delivery.",
      }),
    });
    const { sendNotification } = await import("./email");
    await sendNotification(env, {
      subject: `Wholesale invoice paid: ${order.order_number} (${money})`,
      text: `Wholesale order ${order.order_number} was paid online (${money}) by ${order.email}.`,
    });
  } catch (err) {
    console.error(`[wholesale] paid receipts failed: ${String(err).slice(0, 160)}`);
  }
}

/** The "you've been invoiced" email, with due date and a sign-in-to-pay link. */
export async function sendWholesaleInvoiceEmail(
  env: Env,
  db: D1Database,
  opts: { orderId: string; baseUrl: string },
): Promise<void> {
  try {
    const order = await first<{
      order_number: string;
      total_cents: number;
      currency: string;
      due_date: string | null;
      email: string;
    }>(
      db,
      `SELECT o.order_number, o.total_cents, o.currency, o.due_date, a.email
       FROM wholesale_orders o JOIN wholesale_accounts a ON a.id = o.account_id WHERE o.id = ?`,
      opts.orderId,
    );
    if (!order) return;
    const { sendBuyerEmail } = await import("./buyer-email");
    const { getEmailBrand, renderBrandedEmail, itemsTableHtml } = await import("./email-template");
    const brand = await getEmailBrand(env, db);
    const money = `${(order.total_cents / 100).toFixed(2)} ${order.currency}`;
    const payUrl = `${opts.baseUrl}/wholesale`;
    await sendBuyerEmail(env, {
      to: order.email,
      db,
      subject: `${brand.name} — invoice for wholesale order ${order.order_number}`,
      text: `Your wholesale order ${order.order_number} has been invoiced.\n\nAmount: ${money}${order.due_date ? `\nDue:    ${order.due_date}` : ""}\n\nSign in to pay online:\n${payUrl}\n\n— ${brand.name}`,
      html: renderBrandedEmail({
        brand,
        preheader: `Invoice for ${order.order_number}`,
        heading: "Your order has been invoiced.",
        bodyHtml: itemsTableHtml(
          [
            { label: "Order", right: order.order_number, muted: true },
            { label: "Amount", right: money },
            ...(order.due_date ? [{ label: "Due", right: order.due_date }] : []),
          ],
          brand.palette.ink,
        ),
        cta: { label: "Sign in & pay online", href: payUrl },
        footerNote: "You can also pay by the method agreed with the shop — just reply to this email with any questions.",
      }),
    });
  } catch (err) {
    console.error(`[wholesale] invoice email failed: ${String(err).slice(0, 160)}`);
  }
}
