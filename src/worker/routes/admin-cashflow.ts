import { Hono } from "hono";
import { all, first, run, writeAudit } from "../services/db";
import { requireAdminWrite } from "../middleware/auth";
import type { AppContext } from "../types/env";

/**
 * Cash-flow & open-to-buy — the planning layer a growing label needs but a
 * costing sheet can't give: money coming in and going out over the next weeks,
 * and how much of the season's buy budget is still uncommitted.
 *
 * Everything computes from what the shop already tracks — open POs (payables),
 * invoiced wholesale orders (receivables), and paid retail orders (run-rate).
 */
export const adminCashflowRoutes = new Hono<AppContext>();

adminCashflowRoutes.get("/", async (c) => {
  // Open-to-buy: a season budget vs. what's already committed on open POs.
  const budgetRow = await first<{ value: string }>(
    c.var.db,
    `SELECT value FROM settings WHERE key = 'otb_budget_cents'`,
  );
  const budgetCents = Number(budgetRow?.value) || 0;
  const committed = await first<{ n: number }>(
    c.var.db,
    `SELECT COALESCE(SUM(total_cost_cents), 0) AS n FROM production_orders
     WHERE status NOT IN ('received','cancelled')`,
  );
  const committedCents = committed?.n ?? 0;

  // Payables: open POs, soonest ex-factory first.
  const payables = await all(
    c.var.db,
    `SELECT po.po_number AS ref, s.name AS party, po.total_cost_cents AS amountCents,
            po.currency, po.ex_factory_date AS dueDate, po.status
     FROM production_orders po LEFT JOIN suppliers s ON s.id = po.supplier_id
     WHERE po.status NOT IN ('received','cancelled') AND po.total_cost_cents > 0
     ORDER BY po.ex_factory_date IS NULL, po.ex_factory_date`,
  );

  // Receivables: invoiced wholesale orders, soonest due first.
  const receivables = await all(
    c.var.db,
    `SELECT wo.order_number AS ref, COALESCE(a.company, a.email) AS party,
            wo.total_cents AS amountCents, wo.currency, wo.due_date AS dueDate, wo.status
     FROM wholesale_orders wo JOIN wholesale_accounts a ON a.id = wo.account_id
     WHERE wo.status = 'invoiced'
     ORDER BY wo.due_date IS NULL, wo.due_date`,
  );

  // Retail run-rate — paid revenue over the last 30 and 90 days.
  const rev = async (days: number) =>
    (
      await first<{ n: number }>(
        c.var.db,
        `SELECT COALESCE(SUM(total_cents),0) AS n FROM orders
         WHERE payment_status IN ('paid','partially_refunded') AND created_at >= date('now', ?)`,
        `-${days} days`,
      )
    )?.n ?? 0;

  const payableTotal = payables.reduce((s, p) => s + Number((p as { amountCents: number }).amountCents || 0), 0);
  const receivableTotal = receivables.reduce((s, r) => s + Number((r as { amountCents: number }).amountCents || 0), 0);

  return c.json({
    otb: { budgetCents, committedCents, remainingCents: budgetCents - committedCents },
    payables,
    receivables,
    payableTotal,
    receivableTotal,
    revenue30: await rev(30),
    revenue90: await rev(90),
    currency: (await first<{ value: string }>(c.var.db, `SELECT value FROM settings WHERE key = 'default_currency'`))?.value || "EUR",
  });
});

adminCashflowRoutes.put("/otb-budget", requireAdminWrite, async (c) => {
  const b = (await c.req.json().catch(() => ({}))) as { budgetCents?: number };
  const value = String(Math.max(0, Math.round(Number(b.budgetCents) || 0)));
  await run(
    c.var.db,
    `INSERT INTO settings (key, value) VALUES ('otb_budget_cents', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    value,
  );
  await writeAudit(c.var.db, c.var.userId, "settings.update", "settings", "otb_budget_cents", b);
  return c.json({ ok: true });
});
