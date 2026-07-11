import { Hono } from "hono";
import { all, first } from "../services/db";
import type { AppContext } from "../types/env";
import type { DashboardSummary } from "../../shared/types";

export const adminDashboardRoutes = new Hono<AppContext>();

/** "Needs your attention" — what's STUCK, as opposed to what's scheduled
 *  (the calendar) or what happened (the activity feed). Pure queries; each
 *  is best-effort so one missing table never blanks the card. */
adminDashboardRoutes.get("/attention", async (c) => {
  const db = c.var.db;
  const items: { label: string; count: number; href: string }[] = [];
  const check = async (label: string, href: string, sql: string) => {
    try {
      const row = await first<{ n: number }>(db, sql);
      if (row && row.n > 0) items.push({ label, count: row.n, href });
    } catch {
      /* module not provisioned on this shop */
    }
  };
  await check("overdue production tasks", "/admin/production",
    `SELECT COUNT(*) AS n FROM production_tasks WHERE status NOT IN ('done','cancelled') AND due_date IS NOT NULL AND due_date < date('now')`);
  await check("orders past their ex-factory date", "/admin/purchase-orders",
    `SELECT COUNT(*) AS n FROM production_orders WHERE status IN ('sent','confirmed','in_production','qc') AND ex_factory_date IS NOT NULL AND ex_factory_date < date('now')`);
  await check("sample rounds waiting over two weeks", "/admin/samples",
    `SELECT COUNT(*) AS n FROM samples WHERE status IN ('requested','in_progress','shipped') AND created_at < datetime('now','-14 days')`);
  await check("maker messages needing a response", "/admin/suppliers",
    `SELECT COUNT(*) AS n FROM supplier_interactions WHERE needs_response = 1`);
  await check("commissions past their due date", "/admin/commissions",
    `SELECT COUNT(*) AS n FROM commissions WHERE stage NOT IN ('done','cancelled') AND due_at IS NOT NULL AND due_at < datetime('now')`);
  await check("unconfirmed consult requests", "/admin/commissions",
    `SELECT COUNT(*) AS n FROM booking_requests WHERE status = 'new'`);
  return c.json({ items });
});

adminDashboardRoutes.get("/", async (c) => {
  const db = c.var.db;
  const today = new Date().toISOString().slice(0, 10);

  const revenue = await first<{ total: number | null; n: number; paid: number }>(
    db,
    `SELECT COALESCE(SUM(CASE WHEN payment_status IN ('paid','partially_refunded') THEN total_cents END), 0) AS total,
            COUNT(*) AS n,
            SUM(CASE WHEN payment_status IN ('paid','partially_refunded') THEN 1 ELSE 0 END) AS paid
     FROM orders`,
  );
  const openSamples = await first<{ n: number }>(
    db,
    `SELECT COUNT(*) AS n FROM samples WHERE status NOT IN ('approved','rejected')`,
  );
  const lateTasks = await first<{ n: number }>(
    db,
    `SELECT COUNT(*) AS n FROM production_tasks
     WHERE status NOT IN ('done','cancelled') AND due_date IS NOT NULL AND due_date < ?`,
    today,
  );
  const lowStock = await first<{ n: number }>(
    db,
    `SELECT COUNT(*) AS n FROM inventory_items
     WHERE (on_hand - reserved) <= low_stock_threshold AND (on_hand + incoming) > 0`,
  );
  const missingTechPacks = await first<{ n: number }>(
    db,
    `SELECT COUNT(*) AS n FROM styles s
     WHERE s.status NOT IN ('concept','discontinued')
       AND NOT EXISTS (SELECT 1 FROM tech_packs tp WHERE tp.style_id = s.id)`,
  );
  // Margin risk: latest cost sheet gross margin below the DTC floor target.
  const marginRisk = await first<{ n: number }>(
    db,
    `SELECT COUNT(*) AS n FROM cost_sheets cs
     JOIN margin_targets mt ON mt.channel = 'dtc' AND mt.category IS NULL
     WHERE cs.actual_retail_cents IS NOT NULL AND cs.actual_retail_cents > 0
       AND (1.0 - CAST(cs.fabric_cost_cents + cs.trim_cost_cents + cs.cut_sew_make_cents +
             cs.sample_allocation_cents + cs.packaging_cents + cs.freight_cents +
             cs.insurance_cents + cs.duty_cents + cs.payment_processing_cents +
             cs.returns_reserve_cents AS REAL) / cs.actual_retail_cents) * 100 < mt.floor_gross_margin_pct`,
  );
  const pendingFactory = await first<{ n: number }>(
    db,
    `SELECT COUNT(*) AS n FROM supplier_interactions WHERE needs_response = 1`,
  );
  const stageCounts = await all<{ stage: string; count: number }>(
    db,
    `SELECT ps.name AS stage, COUNT(pt.id) AS count
     FROM production_stages ps
     LEFT JOIN production_tasks pt ON pt.stage_id = ps.id AND pt.status NOT IN ('done','cancelled')
     GROUP BY ps.id ORDER BY ps.sort_order`,
  );
  const milestones = await all<{ title: string; startsOn: string; kind: string }>(
    db,
    `SELECT title, starts_on AS startsOn, kind FROM production_calendar_events
     WHERE COALESCE(ends_on, starts_on) >= ? ORDER BY starts_on LIMIT 6`,
    today,
  );

  const currency = await first<{ value: string }>(
    db,
    `SELECT value FROM settings WHERE key = 'default_currency'`,
  );

  const summary: DashboardSummary = {
    revenueCents: revenue?.total ?? 0,
    currency: currency?.value ?? "USD",
    orderCount: revenue?.n ?? 0,
    paidOrderCount: revenue?.paid ?? 0,
    openSampleCount: openSamples?.n ?? 0,
    lateTaskCount: lateTasks?.n ?? 0,
    lowStockCount: lowStock?.n ?? 0,
    stylesMissingTechPack: missingTechPacks?.n ?? 0,
    stylesWithMarginRisk: marginRisk?.n ?? 0,
    pendingFactoryResponses: pendingFactory?.n ?? 0,
    productionStageCounts: stageCounts.filter((s) => s.count > 0),
    upcomingMilestones: milestones,
  };
  return c.json(summary);
});
