import { all, first, run } from "./db";
import { getShopDb } from "./tenant-db";
import { PRIMARY_SHOP_ID } from "./shops";
import { logInteraction } from "./crm";
import { newId } from "../utils/id";
import type { Env } from "../types/env";

/**
 * Health from the customer's own shop, not from our outreach: a founder
 * who logs in, takes orders, and publishes content is fine no matter how
 * long since we emailed them. Quiet in their OWN shop is the real churn
 * signal — and reaching for it means querying each shop's isolated
 * database, which only the platform's CRM is allowed to do.
 */

export interface ShopActivity {
  lastLoginAt: string | null;
  lastOrderAt: string | null;
  lastPublishAt: string | null;
  ordersTotal: number;
  orders30d: number;
  firstOrderAt: string | null;
}

export type Health = "healthy" | "cooling" | "at_risk" | "unknown";

export async function getShopActivity(env: Env, shopId: string): Promise<ShopActivity> {
  const db = getShopDb(env, shopId, PRIMARY_SHOP_ID);
  const login = await first<{ v: string | null }>(
    db,
    `SELECT MAX(last_login_at) AS v FROM users WHERE is_active = 1`,
  );
  const orders = await first<{ total: number; last: string | null; first: string | null; recent: number }>(
    db,
    `SELECT COUNT(*) AS total, MAX(created_at) AS last, MIN(created_at) AS first,
            SUM(CASE WHEN created_at > datetime('now','-30 days') THEN 1 ELSE 0 END) AS recent
     FROM orders WHERE payment_status = 'paid'`,
  );
  const publish = await first<{ v: string | null }>(
    db,
    `SELECT MAX(v) AS v FROM (
       SELECT MAX(updated_at) AS v FROM pages WHERE is_published = 1
       UNION ALL
       SELECT MAX(published_at) AS v FROM journal_posts WHERE is_published = 1
     )`,
  );
  return {
    lastLoginAt: login?.v ?? null,
    lastOrderAt: orders?.last ?? null,
    lastPublishAt: publish?.v ?? null,
    ordersTotal: orders?.total ?? 0,
    orders30d: orders?.recent ?? 0,
    firstOrderAt: orders?.first ?? null,
  };
}

export function computeHealth(activity: ShopActivity): Health {
  const stamps = [activity.lastLoginAt, activity.lastOrderAt, activity.lastPublishAt]
    .filter((s): s is string => Boolean(s))
    .map((s) => new Date(s.replace(" ", "T") + "Z").getTime())
    .filter((t) => Number.isFinite(t));
  if (!stamps.length) return "unknown";
  const days = (Date.now() - Math.max(...stamps)) / 86400000;
  if (days <= 7) return "healthy";
  if (days <= 21) return "cooling";
  return "at_risk";
}

/**
 * Refresh one contact's snapshot from their shop. Also walks status:
 * at_risk pulls trial/active down to churn_risk (+ a check-in task);
 * healthy pulls churn_risk back up. Best effort — a hiccup in one
 * shop's DO must not break the CRM screens.
 */
export async function refreshContactHealth(
  env: Env,
  contact: { id: string; shop_id: string | null; status: string; name?: string | null; email?: string },
): Promise<void> {
  if (!contact.shop_id) return;
  try {
    const activity = await getShopActivity(env, contact.shop_id);
    const health = computeHealth(activity);
    await run(
      env.DB,
      `UPDATE crm_contacts SET
         last_shop_login_at = ?, last_shop_order_at = ?, last_shop_publish_at = ?,
         shop_orders_total = ?, shop_orders_30d = ?, health = ?, health_checked_at = datetime('now'),
         updated_at = datetime('now')
       WHERE id = ?`,
      activity.lastLoginAt,
      activity.lastOrderAt,
      activity.lastPublishAt,
      activity.ordersTotal,
      activity.orders30d,
      health,
      contact.id,
    );
    if (health === "at_risk" && (contact.status === "trial" || contact.status === "active")) {
      await run(env.DB, `UPDATE crm_contacts SET status = 'churn_risk' WHERE id = ?`, contact.id);
      await run(
        env.DB,
        `INSERT OR IGNORE INTO crm_tasks (id, contact_id, title, due_at, auto_key)
         VALUES (?, ?, ?, datetime('now'), 'churn_check')`,
        newId("tk"),
        contact.id,
        `Check on ${contact.name ?? contact.email ?? "this label"} — their shop has been quiet for 3+ weeks`,
      );
    } else if (health === "healthy" && contact.status === "churn_risk") {
      await run(
        env.DB,
        `UPDATE crm_contacts SET status = ? WHERE id = ?`,
        activity.ordersTotal > 0 ? "active" : "trial",
        contact.id,
      );
    }
    await detectMilestones(env, contact.id, contact.shop_id, activity, contact.name ?? contact.email ?? null);
  } catch (err) {
    console.error(`[crm] health refresh failed for ${contact.id}:`, String(err).slice(0, 200));
  }
}

/**
 * Moments worth a human word: first sale, 100th order, one-year
 * anniversary. Each lands once (auto_key) as a timeline event plus a
 * congratulate-them task — celebration is retention.
 */
async function detectMilestones(
  env: Env,
  contactId: string,
  shopId: string,
  activity: ShopActivity,
  who: string | null,
): Promise<void> {
  const shop = await first<{ created_at: string; name: string }>(
    env.DB,
    `SELECT created_at, name FROM shops WHERE id = ?`,
    shopId,
  );
  const label = shop?.name ?? who ?? "this label";
  const celebrate = async (autoKey: string, subject: string, task: string) => {
    const inserted = await run(
      env.DB,
      `INSERT OR IGNORE INTO crm_tasks (id, contact_id, title, due_at, auto_key)
       VALUES (?, ?, ?, datetime('now'), ?)`,
      newId("tk"),
      contactId,
      task,
      autoKey,
    );
    // meta.changes === 0 → already celebrated; don't duplicate the timeline.
    if ((inserted as { meta?: { changes?: number } })?.meta?.changes) {
      await logInteraction(env, contactId, "milestone", { subject });
    }
  };
  if (activity.ordersTotal >= 1) {
    await celebrate("milestone_first_sale", `First sale for ${label} 🎉`, `Congratulate ${label} on their first sale`);
  }
  if (activity.ordersTotal >= 100) {
    await celebrate("milestone_100_orders", `${label} passed 100 orders 🎉`, `Celebrate ${label}'s 100th order — that's a real business`);
  }
  if (shop && new Date(shop.created_at.replace(" ", "T") + "Z").getTime() < Date.now() - 365 * 86400000) {
    await celebrate("milestone_anniversary_1", `One year of ${label} on Verto 🎂`, `Wish ${label} a happy first anniversary on Verto`);
  }
}

/** Daily: refresh every shop-linked contact (bounded — fine at platform scale). */
export async function crmHealthSweep(env: Env): Promise<void> {
  const contacts = await all<{ id: string; shop_id: string | null; status: string; name: string | null; email: string }>(
    env.DB,
    `SELECT ct.id, ct.shop_id, ct.status, ct.name, ct.email
     FROM crm_contacts ct JOIN shops s ON s.id = ct.shop_id
     WHERE s.status = 'active' LIMIT 100`,
  );
  for (const contact of contacts) {
    await refreshContactHealth(env, contact);
  }
}
