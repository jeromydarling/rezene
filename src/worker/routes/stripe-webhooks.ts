import { Hono } from "hono";
import type Stripe from "stripe";
import { all, first, run } from "../services/db";
import { getStripe, webhookCryptoProvider } from "../services/stripe";
import { orderPaidNotification, sendNotification } from "../services/email";
import { orderConfirmationEmail, sendBuyerEmail } from "../services/buyer-email";
import { newId } from "../utils/id";
import type { AppContext, Env } from "../types/env";

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
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.metadata?.kind === "video_render") {
          await handleVideoRenderAuthorized(c.env, session);
          break;
        }
        const orderId = await handleCheckoutCompleted(c.env.DB, stripe, session);
        if (orderId) c.executionCtx.waitUntil(notifyOrderPaid(c.env, orderId));
        break;
      }
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

/**
 * Post-payment email fan-out: founder notification and buyer confirmation,
 * both via Cloudflare Email Service. Each degrades independently.
 */
async function notifyOrderPaid(env: Env, orderId: string): Promise<void> {
  const order = await first<{
    order_number: string;
    email: string | null;
    total_cents: number;
    currency: string;
    is_pre_order: number;
    shipping_country: string | null;
  }>(
    env.DB,
    `SELECT order_number, email, total_cents, currency, is_pre_order, shipping_country
     FROM orders WHERE id = ?`,
    orderId,
  );
  if (!order) return;
  const items = await all<{ description: string; quantity: number; is_pre_order: number }>(
    env.DB,
    `SELECT description, quantity, is_pre_order FROM order_items WHERE order_id = ?`,
    orderId,
  );
  await sendNotification(
    env,
    orderPaidNotification({
      orderNumber: order.order_number,
      email: order.email,
      totalCents: order.total_cents,
      currency: order.currency,
      isPreOrder: Boolean(order.is_pre_order),
      country: order.shipping_country,
      items,
    }),
  );
  if (order.email) {
    const { getEmailBrand } = await import("../services/email-template");
    const brand = await getEmailBrand(env, env.DB);
    await sendBuyerEmail(env, {
      to: order.email,
      ...orderConfirmationEmail({
        brandName: brand.name,
        orderNumber: order.order_number,
        totalCents: order.total_cents,
        currency: order.currency,
        items: items.map((i) => ({
          description: i.description,
          quantity: i.quantity,
          isPreOrder: Boolean(i.is_pre_order),
        })),
        brand,
      }),
    });
  }
}

/**
 * Promo-video render checkout completed → the card is now authorized (manual
 * capture holds the funds). Record the intent, queue the job, and dispatch the
 * GitHub Actions render. The hold is only captured when the finished MP4 lands
 * (see render-callbacks finalize), so an uncompleted render costs nothing.
 */
async function handleVideoRenderAuthorized(env: Env, session: Stripe.Checkout.Session): Promise<void> {
  const jobId = session.metadata?.job_id;
  const shopId = session.metadata?.shop_id;
  if (!jobId || !shopId) return;
  const { getShopDb } = await import("../services/tenant-db");
  const { PRIMARY_SHOP_ID } = await import("../services/shops");
  const { dispatchRender } = await import("../services/video-render");
  const db = getShopDb(env, shopId, PRIMARY_SHOP_ID);
  const pi = typeof session.payment_intent === "string" ? session.payment_intent : null;
  const formats = (() => {
    try {
      return JSON.parse(session.metadata?.formats || "[\"16:9\"]") as ("16:9" | "9:16" | "1:1")[];
    } catch {
      return ["16:9"] as ("16:9" | "9:16" | "1:1")[];
    }
  })();
  await run(
    db,
    `UPDATE video_jobs SET status = 'queued', progress = 0, progress_label = 'Queued',
       stripe_payment_intent_id = ?, updated_at = datetime('now') WHERE id = ?`,
    pi,
    jobId,
  );
  const dispatched = await dispatchRender(env, { shopId, jobId, formats });
  if (!dispatched.ok) {
    await run(db, `UPDATE video_jobs SET status = 'failed', error = ? WHERE id = ?`, dispatched.error ?? "dispatch failed", jobId);
  }
}

async function handleCheckoutCompleted(
  db: D1Database,
  stripe: Stripe,
  session: Stripe.Checkout.Session,
): Promise<string | null> {
  const orderId = session.metadata?.order_id ?? session.client_reference_id;
  if (!orderId) return null;

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

  // Chosen shipping option (when checkout offered live rates).
  const shippingCents = session.shipping_cost?.amount_total ?? null;
  let shippingMethod: string | null = null;
  if (typeof session.shipping_cost?.shipping_rate === "string") {
    try {
      const rate = await stripe.shippingRates.retrieve(session.shipping_cost.shipping_rate);
      shippingMethod = rate.display_name ?? null;
    } catch {
      // Display name is cosmetic; the amount is already captured.
    }
  }

  await run(
    db,
    `UPDATE orders SET
       payment_status = 'paid',
       customer_id = COALESCE(?, customer_id),
       stripe_payment_intent_id = ?,
       email = COALESCE(?, email),
       subtotal_cents = COALESCE(?, subtotal_cents),
       tax_cents = COALESCE(?, tax_cents),
       shipping_cents = COALESCE(?, shipping_cents),
       shipping_method = COALESCE(?, shipping_method),
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
    shippingCents,
    shippingMethod,
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

  // Inventory: per item — decrement stock, or count against pre-order
  // allocation (mixed carts settle each line correctly).
  const items = await db
    .prepare(
      `SELECT variant_id, product_id, quantity, is_pre_order FROM order_items WHERE order_id = ?`,
    )
    .bind(orderId)
    .all<{
      variant_id: string | null;
      product_id: string | null;
      quantity: number;
      is_pre_order: number;
    }>();
  for (const item of items.results) {
    if (!item.variant_id) continue;
    const inv = await first<{ id: string }>(
      db,
      `SELECT id FROM inventory_items WHERE variant_id = ?`,
      item.variant_id,
    );
    if (!inv) continue;
    if (item.is_pre_order) {
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
      item.is_pre_order ? "preorder_allocate" : "sell",
      -item.quantity,
      orderId,
    );
  }

  // Pre-order campaigns: mark funded the moment the goal is crossed.
  const preOrderProducts = [
    ...new Set(
      items.results.filter((i) => i.is_pre_order && i.product_id).map((i) => i.product_id!),
    ),
  ];
  for (const productId of preOrderProducts) {
    const campaign = await first<{ id: string; goal_units: number; supplier_id: string | null }>(
      db,
      `SELECT id, goal_units, supplier_id FROM preorder_campaigns
       WHERE product_id = ? AND status = 'live'`,
      productId,
    );
    if (!campaign) continue;
    const ordered = await first<{ n: number }>(
      db,
      `SELECT COALESCE(SUM(oi.quantity), 0) AS n FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE oi.product_id = ? AND oi.is_pre_order = 1
         AND o.payment_status IN ('paid','partially_refunded')`,
      productId,
    );
    if ((ordered?.n ?? 0) >= campaign.goal_units) {
      await run(
        db,
        `UPDATE preorder_campaigns SET status = 'funded', updated_at = datetime('now') WHERE id = ?`,
        campaign.id,
      );
      const product = await first<{ name: string }>(
        db,
        `SELECT name FROM products WHERE id = ?`,
        productId,
      );
      await run(
        db,
        `INSERT INTO production_tasks (id, title, stage_id, status, supplier_id, notes)
         VALUES (?, ?, 'stage_bulk_production', 'todo', ?, ?)`,
        newId("task"),
        `Pre-order funded: schedule production — ${product?.name ?? productId}`,
        campaign.supplier_id,
        `Campaign hit its goal of ${campaign.goal_units} units. Confirm the PO and production slot.`,
      );
    }
  }

  await run(
    db,
    `INSERT INTO analytics_events (id, event, entity_type, entity_id)
     VALUES (?, 'checkout_completed', 'order', ?)`,
    newId("evt"),
    orderId,
  );
  return orderId;
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
