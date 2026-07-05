import { Hono } from "hono";
import type Stripe from "stripe";
import { first, run } from "../services/db";
import { getStripe, webhookCryptoProvider } from "../services/stripe";
import { newId } from "../utils/id";
import type { AppContext } from "../types/env";

/**
 * Stripe webhook receiver: signature-verified, idempotent (event ids are
 * unique-keyed in the `webhooks` table), and the single writer for payment
 * state. Payment truth lives in Stripe; D1 stores ids + non-sensitive
 * mirrors only.
 *
 * Configure in Stripe dashboard → endpoint /api/stripe/webhooks with events:
 *   checkout.session.completed, payment_intent.succeeded,
 *   payment_intent.payment_failed, charge.refunded,
 *   customer.created, customer.updated
 */
export const stripeWebhookRoutes = new Hono<AppContext>();

stripeWebhookRoutes.post("/webhooks", async (c) => {
  const stripe = getStripe(c.env);
  if (!stripe || !c.env.STRIPE_WEBHOOK_SECRET) {
    return c.json({ error: "Webhook not configured" }, 503);
  }
  const signature = c.req.header("stripe-signature");
  if (!signature) return c.json({ error: "Missing signature" }, 400);

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      await c.req.text(),
      signature,
      c.env.STRIPE_WEBHOOK_SECRET,
      undefined,
      webhookCryptoProvider,
    );
  } catch {
    return c.json({ error: "Invalid signature" }, 400);
  }

  // Idempotency: first insert wins; replays are acknowledged and ignored.
  const receiptId = newId("wh");
  try {
    await run(
      c.env.DB,
      `INSERT INTO webhooks (id, provider, event_type, external_event_id, status)
       VALUES (?, 'stripe', ?, ?, 'received')`,
      receiptId,
      event.type,
      event.id,
    );
  } catch {
    return c.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(c.env.DB, stripe, event.data.object);
        break;
      case "payment_intent.succeeded":
        await handlePaymentIntent(c.env.DB, event.data.object, "paid");
        break;
      case "payment_intent.payment_failed":
        await handlePaymentIntent(c.env.DB, event.data.object, "failed");
        break;
      case "charge.refunded":
        await handleChargeRefunded(c.env.DB, event.data.object);
        break;
      case "customer.created":
      case "customer.updated":
        await upsertCustomer(c.env.DB, event.data.object);
        break;
      default:
        await run(
          c.env.DB,
          `UPDATE webhooks SET status = 'ignored', processed_at = datetime('now') WHERE id = ?`,
          receiptId,
        );
        return c.json({ received: true, ignored: true });
    }
    await run(
      c.env.DB,
      `UPDATE webhooks SET status = 'processed', processed_at = datetime('now') WHERE id = ?`,
      receiptId,
    );
    return c.json({ received: true });
  } catch (err) {
    await run(
      c.env.DB,
      `UPDATE webhooks SET status = 'failed', error = ?, processed_at = datetime('now') WHERE id = ?`,
      String(err).slice(0, 500),
      receiptId,
    );
    // 500 → Stripe retries; the idempotency guard above blocks double-apply
    // only for *successfully recorded* events, and failures re-enter here
    // under a new receipt row because the unique key already exists…
    // so mark this row consumed and let Stripe retry against the same id:
    await run(c.env.DB, `DELETE FROM webhooks WHERE id = ?`, receiptId);
    return c.json({ error: "Processing failed" }, 500);
  }
});

async function handleCheckoutCompleted(
  db: D1Database,
  stripe: Stripe,
  session: Stripe.Checkout.Session,
): Promise<void> {
  const orderId = session.metadata?.order_id ?? session.client_reference_id;
  if (!orderId) return;

  // Customer upsert from checkout details.
  const email = session.customer_details?.email ?? null;
  let customerId: string | null = null;
  if (email) {
    const existing = await first<{ id: string }>(
      db,
      `SELECT id FROM customers WHERE email = ? OR (stripe_customer_id IS NOT NULL AND stripe_customer_id = ?)`,
      email.toLowerCase(),
      typeof session.customer === "string" ? session.customer : "",
    );
    if (existing) {
      customerId = existing.id;
      await run(
        db,
        `UPDATE customers SET
           stripe_customer_id = COALESCE(stripe_customer_id, ?),
           name = COALESCE(?, name),
           country = COALESCE(?, country),
           updated_at = datetime('now')
         WHERE id = ?`,
        typeof session.customer === "string" ? session.customer : null,
        session.customer_details?.name ?? null,
        session.customer_details?.address?.country ?? null,
        customerId,
      );
    } else {
      customerId = newId("cus");
      await run(
        db,
        `INSERT INTO customers (id, stripe_customer_id, email, name, country)
         VALUES (?, ?, ?, ?, ?)`,
        customerId,
        typeof session.customer === "string" ? session.customer : null,
        email.toLowerCase(),
        session.customer_details?.name ?? null,
        session.customer_details?.address?.country ?? null,
      );
    }
  }

  const shipping =
    (session as { shipping_details?: { address?: unknown; name?: string } }).shipping_details ??
    session.customer_details;

  await run(
    db,
    `UPDATE orders SET
       payment_status = 'paid',
       customer_id = COALESCE(?, customer_id),
       stripe_payment_intent_id = ?,
       email = COALESCE(?, email),
       subtotal_cents = COALESCE(?, subtotal_cents),
       tax_cents = COALESCE(?, tax_cents),
       total_cents = COALESCE(?, total_cents),
       shipping_country = COALESCE(?, shipping_country),
       shipping_address_json = COALESCE(?, shipping_address_json),
       placed_at = datetime('now'),
       updated_at = datetime('now')
     WHERE id = ?`,
    customerId,
    typeof session.payment_intent === "string" ? session.payment_intent : null,
    email?.toLowerCase() ?? null,
    session.amount_subtotal,
    session.total_details?.amount_tax ?? null,
    session.amount_total,
    session.customer_details?.address?.country ?? null,
    shipping ? JSON.stringify(shipping) : null,
    orderId,
  );

  // Payment mirror row.
  if (typeof session.payment_intent === "string") {
    let methodSummary: string | null = null;
    try {
      const pi = await stripe.paymentIntents.retrieve(session.payment_intent, {
        expand: ["latest_charge"],
      });
      const charge = pi.latest_charge as Stripe.Charge | null;
      const card = charge?.payment_method_details?.card;
      if (card) methodSummary = `${card.brand} •••• ${card.last4}`;
      await run(
        db,
        `INSERT INTO payments (id, order_id, stripe_payment_intent_id, stripe_charge_id, amount_cents, currency, status, method_summary)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(stripe_payment_intent_id) DO UPDATE SET status = excluded.status`,
        newId("pay"),
        orderId,
        pi.id,
        charge?.id ?? null,
        pi.amount,
        pi.currency.toUpperCase(),
        pi.status,
        methodSummary,
      );
    } catch {
      // Payment detail enrichment is best-effort; order state is already settled.
    }
  }

  // Inventory: decrement stock (or count against pre-order allocation).
  const items = await db
    .prepare(`SELECT variant_id, quantity FROM order_items WHERE order_id = ?`)
    .bind(orderId)
    .all<{ variant_id: string | null; quantity: number }>();
  const isPreOrder = session.metadata?.pre_order === "true";
  for (const item of items.results) {
    if (!item.variant_id) continue;
    const inv = await first<{ id: string }>(
      db,
      `SELECT id FROM inventory_items WHERE variant_id = ?`,
      item.variant_id,
    );
    if (!inv) continue;
    if (isPreOrder) {
      await run(
        db,
        `UPDATE inventory_items SET pre_order_allocated = pre_order_allocated + ?, updated_at = datetime('now') WHERE id = ?`,
        item.quantity,
        inv.id,
      );
    } else {
      await run(
        db,
        `UPDATE inventory_items SET on_hand = MAX(0, on_hand - ?), updated_at = datetime('now') WHERE id = ?`,
        item.quantity,
        inv.id,
      );
    }
    await run(
      db,
      `INSERT INTO inventory_movements (id, inventory_item_id, kind, quantity, reference_type, reference_id)
       VALUES (?, ?, ?, ?, 'order', ?)`,
      newId("mov"),
      inv.id,
      isPreOrder ? "preorder_allocate" : "sell",
      -item.quantity,
      orderId,
    );
  }

  await run(
    db,
    `INSERT INTO analytics_events (id, event, entity_type, entity_id)
     VALUES (?, 'checkout_completed', 'order', ?)`,
    newId("evt"),
    orderId,
  );
}

async function handlePaymentIntent(
  db: D1Database,
  pi: Stripe.PaymentIntent,
  orderStatus: "paid" | "failed",
): Promise<void> {
  await run(
    db,
    `INSERT INTO payments (id, order_id, stripe_payment_intent_id, amount_cents, currency, status)
     VALUES (?, (SELECT id FROM orders WHERE stripe_payment_intent_id = ?), ?, ?, ?, ?)
     ON CONFLICT(stripe_payment_intent_id) DO UPDATE SET status = excluded.status`,
    newId("pay"),
    pi.id,
    pi.id,
    pi.amount,
    pi.currency.toUpperCase(),
    pi.status,
  );
  // Only downgrade to failed if the order isn't already settled as paid.
  await run(
    db,
    `UPDATE orders SET
       payment_status = CASE
         WHEN ? = 'failed' AND payment_status = 'paid' THEN payment_status
         ELSE ?
       END,
       updated_at = datetime('now')
     WHERE stripe_payment_intent_id = ?`,
    orderStatus,
    orderStatus,
    pi.id,
  );
}

async function handleChargeRefunded(db: D1Database, charge: Stripe.Charge): Promise<void> {
  const piId = typeof charge.payment_intent === "string" ? charge.payment_intent : null;
  if (!piId) return;
  const order = await first<{ id: string; total_cents: number }>(
    db,
    `SELECT id, total_cents FROM orders WHERE stripe_payment_intent_id = ?`,
    piId,
  );
  const refunds = charge.refunds?.data ?? [];
  for (const refund of refunds) {
    await run(
      db,
      `INSERT INTO refunds (id, order_id, stripe_refund_id, amount_cents, currency, reason, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(stripe_refund_id) DO UPDATE SET status = excluded.status`,
      newId("ref"),
      order?.id ?? null,
      refund.id,
      refund.amount,
      refund.currency.toUpperCase(),
      refund.reason ?? null,
      refund.status ?? "succeeded",
    );
  }
  if (order) {
    const fully = charge.amount_refunded >= order.total_cents;
    await run(
      db,
      `UPDATE orders SET payment_status = ?, updated_at = datetime('now') WHERE id = ?`,
      fully ? "refunded" : "partially_refunded",
      order.id,
    );
  }
}

async function upsertCustomer(db: D1Database, customer: Stripe.Customer): Promise<void> {
  if (!customer.email) return;
  const existing = await first<{ id: string }>(
    db,
    `SELECT id FROM customers WHERE stripe_customer_id = ? OR email = ?`,
    customer.id,
    customer.email.toLowerCase(),
  );
  if (existing) {
    await run(
      db,
      `UPDATE customers SET stripe_customer_id = ?, name = COALESCE(?, name), updated_at = datetime('now') WHERE id = ?`,
      customer.id,
      customer.name ?? null,
      existing.id,
    );
  } else {
    await run(
      db,
      `INSERT INTO customers (id, stripe_customer_id, email, name) VALUES (?, ?, ?, ?)`,
      newId("cus"),
      customer.id,
      customer.email.toLowerCase(),
      customer.name ?? null,
    );
  }
}
