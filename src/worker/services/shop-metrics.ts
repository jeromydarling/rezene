import { all, first, run } from "./db";
import { getShopDb } from "./tenant-db";
import { PRIMARY_SHOP_ID } from "./shops";
import type { Env } from "../types/env";

/**
 * Fleet revenue rollup. Orders, refunds, and customers live in each shop's
 * isolated Durable Object; HQ needs to read the whole fleet's revenue in one
 * query. So a daily cron fans out over active shops, aggregates each shop's
 * day from its own DO, and upserts one row per (shop, day) into the platform
 * `shop_metrics_daily` table (env.DB). Best-effort per shop — one shop's DO
 * hiccup must never sink the whole sweep.
 *
 * Money is integer cents. Mixed-currency shops are summed in cents under their
 * dominant currency for the day; the HQ page labels totals as approximate when
 * currencies differ. Idempotent: re-running a day overwrites its row, so the
 * cron can safely refresh "today" repeatedly and re-close "yesterday".
 */

export interface ShopDayMetrics {
  shopId: string;
  day: string;
  currency: string;
  gmvCents: number;
  orders: number;
  refundsCents: number;
  newCustomers: number;
}

/** Aggregate one shop's single day from its own DO. Returns null on any error. */
export async function computeShopDay(env: Env, shopId: string, day: string): Promise<ShopDayMetrics | null> {
  try {
    const db = getShopDb(env, shopId, PRIMARY_SHOP_ID);
    const orders = await first<{ gmv: number; n: number; currency: string | null }>(
      db,
      `SELECT COALESCE(SUM(total_cents),0) AS gmv,
              COUNT(*) AS n,
              -- dominant currency that day (most orders); ties break arbitrarily
              (SELECT currency FROM orders
                 WHERE payment_status='paid' AND substr(created_at,1,10)=?1
                 GROUP BY currency ORDER BY COUNT(*) DESC LIMIT 1) AS currency
         FROM orders
        WHERE payment_status='paid' AND substr(created_at,1,10)=?1`,
      day,
    );
    const refunds = await first<{ amt: number }>(
      db,
      `SELECT COALESCE(SUM(amount_cents),0) AS amt FROM refunds WHERE substr(created_at,1,10)=?`,
      day,
    );
    const customers = await first<{ n: number }>(
      db,
      `SELECT COUNT(*) AS n FROM customers WHERE substr(created_at,1,10)=?`,
      day,
    );
    return {
      shopId,
      day,
      currency: orders?.currency ?? "USD",
      gmvCents: orders?.gmv ?? 0,
      orders: orders?.n ?? 0,
      refundsCents: refunds?.amt ?? 0,
      newCustomers: customers?.n ?? 0,
    };
  } catch (err) {
    console.error(`[metrics] compute failed for ${shopId} ${day}:`, String(err).slice(0, 200));
    return null;
  }
}

/** Upsert one shop-day row into the platform rollup table. */
export async function upsertShopDay(env: Env, m: ShopDayMetrics): Promise<void> {
  await run(
    env.DB,
    `INSERT INTO shop_metrics_daily (shop_id, day, currency, gmv_cents, orders, refunds_cents, new_customers, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(shop_id, day) DO UPDATE SET
       currency=excluded.currency,
       gmv_cents=excluded.gmv_cents,
       orders=excluded.orders,
       refunds_cents=excluded.refunds_cents,
       new_customers=excluded.new_customers,
       updated_at=datetime('now')`,
    m.shopId,
    m.day,
    m.currency,
    m.gmvCents,
    m.orders,
    m.refundsCents,
    m.newCustomers,
  );
}

/** UTC date string N days before today (0 = today), 'YYYY-MM-DD'. */
function utcDay(offset: number): string {
  const d = new Date(Date.now() - offset * 86400000);
  return d.toISOString().slice(0, 10);
}

/**
 * Roll up the given days (default: today + yesterday, so today stays fresh and
 * yesterday closes out) for every active shop. Returns how many shop-days were
 * written. Safe to call from the daily cron.
 */
export async function rollupFleetMetrics(env: Env, opts?: { days?: string[] }): Promise<number> {
  const days = opts?.days ?? [utcDay(0), utcDay(1)];
  const shops = await all<{ id: string }>(env.DB, `SELECT id FROM shops WHERE status='active'`);
  let written = 0;
  for (const shop of shops) {
    for (const day of days) {
      const m = await computeShopDay(env, shop.id, day);
      if (m) {
        await upsertShopDay(env, m).catch((err) =>
          console.error(`[metrics] upsert failed for ${shop.id} ${day}:`, String(err).slice(0, 200)),
        );
        written++;
      }
    }
  }
  return written;
}
