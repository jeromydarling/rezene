import { Hono } from "hono";
import { all, first, run, writeAudit } from "../services/db";
import { requireAdminWrite } from "../middleware/auth";
import { getStripe } from "../services/stripe";
import { newId } from "../utils/id";
import type { AppContext } from "../types/env";

/**
 * Returns / RMA — the shop's side. A customer files a return from their account;
 * here the shop reviews it, then either declines it or approves it. Approving
 * restocks the returned pieces and issues a Stripe refund in one step, so a
 * return is a single decision, not a checklist.
 */
export const adminReturnsRoutes = new Hono<AppContext>();

adminReturnsRoutes.get("/", async (c) => {
  const rows = await all(
    c.var.db,
    `SELECT r.id, r.status, r.reason, r.refund_amount_cents AS refundAmountCents, r.currency,
            r.created_at AS createdAt, o.order_number AS orderNumber, o.id AS orderId,
            COALESCE(cu.name, o.email) AS customer,
            (SELECT COALESCE(SUM(quantity),0) FROM return_items ri WHERE ri.return_id = r.id) AS itemCount
     FROM returns r
     JOIN orders o ON o.id = r.order_id
     LEFT JOIN customers cu ON cu.id = r.customer_id
     ORDER BY r.created_at DESC LIMIT 300`,
  );
  const open = rows.filter((r) => (r as { status: string }).status === "requested").length;
  return c.json({ returns: rows, open, stripeReady: Boolean(c.env.STRIPE_SECRET_KEY) });
});

adminReturnsRoutes.get("/:id", async (c) => {
  const r = await first<Record<string, unknown>>(
    c.var.db,
    `SELECT r.*, o.order_number AS order_number, o.stripe_payment_intent_id, o.email AS order_email,
            o.total_cents AS order_total_cents
     FROM returns r JOIN orders o ON o.id = r.order_id WHERE r.id = ?`,
    c.req.param("id"),
  );
  if (!r) return c.json({ error: "Return not found" }, 404);
  const items = await all(
    c.var.db,
    `SELECT id, description, quantity, unit_price_cents AS unitPriceCents, currency, variant_id AS variantId
     FROM return_items WHERE return_id = ?`,
    r.id,
  );
  return c.json({ return: r, items });
});

adminReturnsRoutes.post("/:id/decline", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as { adminNote?: string };
  const r = await first<{ status: string; order_id: string }>(
    c.var.db,
    `SELECT status, order_id FROM returns WHERE id = ?`,
    id,
  );
  if (!r) return c.json({ error: "Return not found" }, 404);
  await run(
    c.var.db,
    `UPDATE returns SET status = 'rejected', admin_note = ?, updated_at = datetime('now') WHERE id = ?`,
    body.adminNote ?? null,
    id,
  );
  await writeAudit(c.var.db, c.var.userId, "return.decline", "return", id, {});
  const { notifyReturnStatus } = await import("../services/transactional-emails");
  await notifyReturnStatus(c.env, c.var.db, { orderId: r.order_id, kind: "declined", shopSlug: c.var.shopSlug });
  return c.json({ ok: true });
});

adminReturnsRoutes.post("/:id/approve", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as {
    refundAmountCents?: number;
    restock?: boolean;
    adminNote?: string;
  };
  const r = await first<{
    id: string;
    order_id: string;
    status: string;
    refund_amount_cents: number | null;
    currency: string | null;
    restocked: number;
  }>(c.var.db, `SELECT id, order_id, status, refund_amount_cents, currency, restocked FROM returns WHERE id = ?`, id);
  if (!r) return c.json({ error: "Return not found" }, 404);
  if (r.status === "refunded") return c.json({ error: "This return is already refunded." }, 409);

  const order = await first<{ stripe_payment_intent_id: string | null; total_cents: number }>(
    c.var.db,
    `SELECT stripe_payment_intent_id, total_cents FROM orders WHERE id = ?`,
    r.order_id,
  );
  const amount = Math.min(
    body.refundAmountCents ?? r.refund_amount_cents ?? 0,
    order?.total_cents ?? Number.MAX_SAFE_INTEGER,
  );

  // Refund through Stripe. The charge.refunded webhook records the refund row
  // and flips the order's payment_status; we still stamp the return directly so
  // the shop sees the result immediately.
  let stripeRefundId: string | null = null;
  if (amount > 0 && order?.stripe_payment_intent_id) {
    const stripe = getStripe(c.env);
    if (!stripe) return c.json({ error: "Connect Stripe to refund this return." }, 400);
    try {
      // Destination charges (Stripe Connect) must reverse the transfer so the
      // refunded amount comes back out of the shop's balance, not Verto's.
      const pi = await stripe.paymentIntents.retrieve(order.stripe_payment_intent_id, {
        expand: ["latest_charge"],
      });
      const charge = pi.latest_charge as import("stripe").Stripe.Charge | null;
      const isDestinationCharge = Boolean(charge && typeof charge !== "string" && charge.transfer_data);
      const refund = await stripe.refunds.create({
        payment_intent: order.stripe_payment_intent_id,
        amount,
        ...(isDestinationCharge ? { reverse_transfer: true } : {}),
      });
      stripeRefundId = refund.id;
    } catch (err) {
      return c.json({ error: `Stripe couldn't process the refund: ${(err as Error).message}` }, 502);
    }
  }

  // Restock the returned pieces back into on-hand.
  let restocked = Boolean(r.restocked);
  if (body.restock && !r.restocked) {
    const items = await all<{ variant_id: string | null; quantity: number }>(
      c.var.db,
      `SELECT variant_id, quantity FROM return_items WHERE return_id = ?`,
      id,
    );
    for (const it of items) {
      if (!it.variant_id) continue;
      const inv = await first<{ id: string }>(
        c.var.db,
        `SELECT id FROM inventory_items WHERE variant_id = ?`,
        it.variant_id,
      );
      if (!inv) continue;
      await run(
        c.var.db,
        `UPDATE inventory_items SET on_hand = on_hand + ?, updated_at = datetime('now') WHERE id = ?`,
        it.quantity,
        inv.id,
      );
      await run(
        c.var.db,
        `INSERT INTO inventory_movements (id, inventory_item_id, kind, quantity, reference_type, reference_id, note, created_by)
         VALUES (?, ?, 'return', ?, 'order', ?, 'Customer return', ?)`,
        newId("mv"),
        inv.id,
        it.quantity,
        r.order_id,
        c.var.userId,
      );
    }
    restocked = true;
  }

  await run(
    c.var.db,
    `UPDATE returns SET status = 'refunded', refund_amount_cents = ?, stripe_refund_id = ?,
            restocked = ?, admin_note = COALESCE(?, admin_note), updated_at = datetime('now')
     WHERE id = ?`,
    amount,
    stripeRefundId,
    restocked ? 1 : 0,
    body.adminNote ?? null,
    id,
  );
  await writeAudit(c.var.db, c.var.userId, "return.approve", "return", id, { amount, restocked });
  const { notifyReturnStatus } = await import("../services/transactional-emails");
  await notifyReturnStatus(c.env, c.var.db, {
    orderId: r.order_id,
    kind: "refunded",
    refundAmountCents: amount,
    currency: r.currency,
    shopSlug: c.var.shopSlug,
  });
  return c.json({ ok: true, refundAmountCents: amount, stripeRefundId, restocked });
});
