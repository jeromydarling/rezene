import { Hono } from "hono";
import { all, first } from "../services/db";
import type { AppContext } from "../types/env";

/**
 * Store analytics for the admin — everything a shop owner tracks day to
 * day: sales, traffic, the browse→buy funnel, best sellers, size/color
 * demand, where visitors come from, and list growth. All computed live
 * from orders + on-site events; comparison deltas use the preceding
 * period of the same length.
 */
export const adminAnalyticsRoutes = new Hono<AppContext>();

interface PeriodTotals {
  revenueCents: number;
  orders: number;
  unitsSold: number;
  visitors: number;
  pageViews: number;
  signups: number;
}

async function periodTotals(db: D1Database, from: string, to: string): Promise<PeriodTotals> {
  const sales = await first<{ revenue: number | null; orders: number }>(
    db,
    `SELECT SUM(total_cents) AS revenue, COUNT(*) AS orders FROM orders
     WHERE payment_status = 'paid' AND created_at >= ? AND created_at < ?`,
    from,
    to,
  );
  const units = await first<{ units: number | null }>(
    db,
    `SELECT SUM(i.quantity) AS units FROM order_items i
     JOIN orders o ON o.id = i.order_id
     WHERE o.payment_status = 'paid' AND o.created_at >= ? AND o.created_at < ?`,
    from,
    to,
  );
  const traffic = await first<{ visitors: number; views: number }>(
    db,
    `SELECT COUNT(DISTINCT session_key) AS visitors, COUNT(*) AS views FROM analytics_events
     WHERE event = 'page_view' AND created_at >= ? AND created_at < ?`,
    from,
    to,
  );
  const signups = await first<{ n: number }>(
    db,
    `SELECT COUNT(*) AS n FROM leads WHERE created_at >= ? AND created_at < ?`,
    from,
    to,
  );
  return {
    revenueCents: sales?.revenue ?? 0,
    orders: sales?.orders ?? 0,
    unitsSold: units?.units ?? 0,
    visitors: traffic?.visitors ?? 0,
    pageViews: traffic?.views ?? 0,
    signups: signups?.n ?? 0,
  };
}

adminAnalyticsRoutes.get("/", async (c) => {
  const db = c.var.db;
  const days = Math.min(90, Math.max(7, parseInt(c.req.query("days") ?? "30", 10) || 30));
  const now = Date.now();
  const since = new Date(now - days * 86400 * 1000).toISOString();
  const prevSince = new Date(now - 2 * days * 86400 * 1000).toISOString();
  const nowIso = new Date(now).toISOString();

  const [current, previous] = [
    await periodTotals(db, since, nowIso),
    await periodTotals(db, prevSince, since),
  ];

  // Daily series: revenue/orders from paid orders, visitors from events.
  const revenueByDay = await all(
    db,
    `SELECT substr(created_at, 1, 10) AS day, SUM(total_cents) AS revenue_cents, COUNT(*) AS orders
     FROM orders WHERE payment_status = 'paid' AND created_at >= ?
     GROUP BY day ORDER BY day`,
    since,
  );
  const visitorsByDay = await all(
    db,
    `SELECT substr(created_at, 1, 10) AS day, COUNT(DISTINCT session_key) AS visitors
     FROM analytics_events WHERE event = 'page_view' AND created_at >= ?
     GROUP BY day ORDER BY day`,
    since,
  );

  // Browse → buy funnel, unique shopping sessions per stage.
  const funnelRows = await all<{ event: string; sessions: number }>(
    db,
    `SELECT event, COUNT(DISTINCT session_key) AS sessions FROM analytics_events
     WHERE created_at >= ? AND event IN ('page_view','product_view','add_to_cart','checkout_started')
     GROUP BY event`,
    since,
  );
  const funnelBy = Object.fromEntries(funnelRows.map((r) => [r.event, r.sessions]));

  // Best sellers with per-product revenue and units.
  const bestSellers = await all(
    db,
    `SELECT COALESCE(p.name, i.description) AS name, p.slug,
            SUM(i.quantity) AS units, SUM(i.quantity * i.unit_price_cents) AS revenue_cents
     FROM order_items i
     JOIN orders o ON o.id = i.order_id
     LEFT JOIN products p ON p.id = i.product_id
     WHERE o.payment_status = 'paid' AND o.created_at >= ?
     GROUP BY COALESCE(p.id, i.description) ORDER BY revenue_cents DESC LIMIT 10`,
    since,
  );

  // What sells, by size and by colorway — real demand data for the next
  // production run.
  const sizeCurve = await all(
    db,
    `SELECT v.size, SUM(i.quantity) AS units FROM order_items i
     JOIN orders o ON o.id = i.order_id
     JOIN product_variants v ON v.id = i.variant_id
     WHERE o.payment_status = 'paid' AND o.created_at >= ?
     GROUP BY v.size ORDER BY units DESC`,
    since,
  );
  const colorways = await all(
    db,
    `SELECT v.colorway_name AS colorway, SUM(i.quantity) AS units FROM order_items i
     JOIN orders o ON o.id = i.order_id
     JOIN product_variants v ON v.id = i.variant_id
     WHERE o.payment_status = 'paid' AND o.created_at >= ?
     GROUP BY v.colorway_name ORDER BY units DESC LIMIT 10`,
    since,
  );

  // Most-viewed products vs what actually sells.
  const mostViewed = await all(
    db,
    `SELECT p.name, p.slug, COUNT(*) AS views
     FROM analytics_events e JOIN products p ON p.id = e.entity_id
     WHERE e.event = 'product_view' AND e.created_at >= ?
     GROUP BY p.id ORDER BY views DESC LIMIT 10`,
    since,
  );

  // Where visitors come from.
  const referrerRows = await all<{ referrer: string; count: number }>(
    db,
    `SELECT referrer, COUNT(*) AS count FROM analytics_events
     WHERE created_at >= ? AND event = 'page_view' AND referrer IS NOT NULL AND referrer != ''
     GROUP BY referrer ORDER BY count DESC LIMIT 50`,
    since,
  );
  const bySource = new Map<string, number>();
  for (const row of referrerRows) {
    let source = row.referrer;
    try {
      source = new URL(row.referrer).hostname.replace(/^www\./, "");
    } catch {
      // keep raw value
    }
    bySource.set(source, (bySource.get(source) ?? 0) + row.count);
  }
  const referrers = [...bySource.entries()]
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const countries = await all(
    db,
    `SELECT country, COUNT(DISTINCT session_key) AS visitors FROM analytics_events
     WHERE created_at >= ? AND event = 'page_view' AND country IS NOT NULL
     GROUP BY country ORDER BY visitors DESC LIMIT 10`,
    since,
  );
  const orderCountries = await all(
    db,
    `SELECT shipping_country AS country, COUNT(*) AS orders, SUM(total_cents) AS revenue_cents
     FROM orders WHERE payment_status = 'paid' AND created_at >= ? AND shipping_country IS NOT NULL
     GROUP BY shipping_country ORDER BY revenue_cents DESC LIMIT 10`,
    since,
  );

  const topPages = await all(
    db,
    `SELECT path, COUNT(*) AS count FROM analytics_events
     WHERE created_at >= ? AND event = 'page_view' AND path IS NOT NULL
     GROUP BY path ORDER BY count DESC LIMIT 10`,
    since,
  );

  // Customers: repeat share among buyers active in the window.
  const repeat = await first<{ total: number; repeat_buyers: number }>(
    db,
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN order_count > 1 THEN 1 ELSE 0 END) AS repeat_buyers
     FROM (
       SELECT email, COUNT(*) AS order_count FROM orders
       WHERE payment_status = 'paid' AND email IS NOT NULL
       GROUP BY email
       HAVING MAX(created_at) >= ?
     )`,
    since,
  );

  // List growth by signup type.
  const leadsByKind = await all(
    db,
    `SELECT kind, COUNT(*) AS count FROM leads WHERE created_at >= ?
     GROUP BY kind ORDER BY count DESC`,
    since,
  );

  // Checkouts that never completed (payment pending > 24h).
  const abandoned = await first<{ n: number }>(
    db,
    `SELECT COUNT(*) AS n FROM analytics_events
     WHERE event = 'checkout_abandoned' AND created_at >= ?`,
    since,
  );

  // Live pre-order campaigns at a glance.
  const campaigns = await all(
    db,
    `SELECT pc.id, p.name AS product_name, pc.goal_units, pc.status,
            (SELECT COALESCE(SUM(oi.quantity), 0) FROM order_items oi
             JOIN orders o ON o.id = oi.order_id
             WHERE oi.is_pre_order = 1 AND o.payment_status = 'paid'
               AND oi.product_id = pc.product_id) AS ordered_units
     FROM preorder_campaigns pc JOIN products p ON p.id = pc.product_id
     WHERE pc.status IN ('live','funded')`,
  );

  return c.json({
    days,
    totals: { current, previous },
    revenueByDay,
    visitorsByDay,
    funnel: {
      visitors: funnelBy.page_view ?? 0,
      viewedProduct: funnelBy.product_view ?? 0,
      addedToCart: funnelBy.add_to_cart ?? 0,
      startedCheckout: funnelBy.checkout_started ?? 0,
      purchased: current.orders,
    },
    bestSellers,
    sizeCurve,
    colorways,
    mostViewed,
    referrers,
    countries,
    orderCountries,
    topPages,
    customers: {
      buyers: repeat?.total ?? 0,
      returning: repeat?.repeat_buyers ?? 0,
    },
    leadsByKind,
    abandonedCheckouts: abandoned?.n ?? 0,
    campaigns,
  });
});
