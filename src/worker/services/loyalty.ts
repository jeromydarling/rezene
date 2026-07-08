import { all, first, run } from "./db";
import { newId } from "../utils/id";

/**
 * Loyalty + referral, on store credit. Two things happen when an order is paid:
 * the buyer earns a % of it back as credit, and — if this is their first order
 * and they arrived on a referral — the referrer earns a reward. Redeeming
 * credit (turning it into a one-time discount code) lives in the account route,
 * because it needs Stripe.
 *
 * Settings (per-shop, in `settings`): loyalty_enabled ("true"/"false"),
 * loyalty_earn_pct (e.g. "5"), referral_reward_cents (e.g. "1000").
 */

async function setting(db: D1Database, key: string): Promise<string | null> {
  const row = await first<{ value: string }>(db, `SELECT value FROM settings WHERE key = ?`, key);
  return row?.value ?? null;
}

export async function creditBalanceCents(db: D1Database, customerId: string): Promise<number> {
  const row = await first<{ bal: number }>(
    db,
    `SELECT COALESCE(SUM(delta_cents), 0) AS bal FROM customer_credit_ledger WHERE customer_id = ?`,
    customerId,
  );
  return row?.bal ?? 0;
}

/** Called when an order is paid (from the Stripe webhook). Best-effort. */
export async function accrueLoyalty(db: D1Database, orderId: string): Promise<void> {
  if ((await setting(db, "loyalty_enabled")) !== "true") return;
  const order = await first<{ customer_id: string | null; subtotal_cents: number; email: string | null }>(
    db,
    `SELECT customer_id, subtotal_cents, email FROM orders WHERE id = ?`,
    orderId,
  );
  if (!order?.customer_id) return;

  // Earn: a % of the subtotal back as credit (guarded to once per order).
  const pct = Number(await setting(db, "loyalty_earn_pct")) || 0;
  if (pct > 0) {
    const earn = Math.round((order.subtotal_cents * pct) / 100);
    if (earn > 0) {
      try {
        await run(
          db,
          `INSERT INTO customer_credit_ledger (id, customer_id, delta_cents, kind, reason, order_id)
           VALUES (?, ?, ?, 'earned', ?, ?)`,
          newId("cl"),
          order.customer_id,
          earn,
          `${pct}% back on your order`,
          orderId,
        );
      } catch {
        // Unique index → already earned for this order (webhook retry). Fine.
      }
    }
  }

  // Referral: if this is the buyer's first paid order and they came via a code,
  // qualify the referral and reward the referrer.
  const paidCount = await first<{ n: number }>(
    db,
    `SELECT COUNT(*) AS n FROM orders WHERE customer_id = ? AND payment_status IN ('paid','partially_refunded')`,
    order.customer_id,
  );
  if ((paidCount?.n ?? 0) > 1) return; // not their first — nothing to qualify

  const ref = await first<{ id: string; referrer_customer_id: string; reward_cents: number }>(
    db,
    `SELECT id, referrer_customer_id, reward_cents FROM referrals
     WHERE status = 'pending' AND (referred_customer_id = ? OR lower(referred_email) = ?)
     ORDER BY created_at LIMIT 1`,
    order.customer_id,
    (order.email ?? "").toLowerCase(),
  );
  if (!ref) return;
  const reward = ref.reward_cents || Number(await setting(db, "referral_reward_cents")) || 0;
  await run(
    db,
    `UPDATE referrals SET status = 'qualified', referred_customer_id = ?, qualified_at = datetime('now') WHERE id = ?`,
    order.customer_id,
    ref.id,
  );
  if (reward > 0) {
    await run(
      db,
      `INSERT INTO customer_credit_ledger (id, customer_id, delta_cents, kind, reason)
       VALUES (?, ?, ?, 'referral', 'A friend you referred made their first order')`,
      newId("cl"),
      ref.referrer_customer_id,
      reward,
    );
  }
}

export async function ledgerFor(db: D1Database, customerId: string) {
  return all(
    db,
    `SELECT delta_cents AS deltaCents, kind, reason, created_at AS createdAt
     FROM customer_credit_ledger WHERE customer_id = ? ORDER BY created_at DESC LIMIT 50`,
    customerId,
  );
}
