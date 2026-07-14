import { Hono } from "hono";
import { z } from "zod";
import { all, first, writeAudit, run } from "../services/db";
import { parseBody } from "../services/validators";
import { requireAdminOnly, requireSuperAdmin } from "../middleware/auth";
import { provisionShop } from "../services/provision";
import { PRIMARY_SHOP_ID, RESERVED_SLUGS, type Shop } from "../services/shops";
import type { AppContext } from "../types/env";

/**
 * Platform operations: the shop registry. Only admins of the PRIMARY shop
 * (the platform operator) can touch this — an admin of any other shop gets
 * a 403 even with a valid session, because their session only exists in
 * their own shop's database and this gate checks the resolved tenant.
 */
export const adminPlatformRoutes = new Hono<AppContext>();

adminPlatformRoutes.use("*", requireAdminOnly, requireSuperAdmin, async (c, next) => {
  if (c.var.shopId !== PRIMARY_SHOP_ID) {
    return c.json({ error: "Not found" }, 404);
  }
  await next();
});

/**
 * The activation funnel — the answer to "where do new shops drop off?" Counts
 * distinct shops that have crossed each lifecycle milestone (recorded at the
 * platform by the derive-and-log helper), in canonical order. The denominator
 * is the shop registry itself, so a shop that signed up before analytics
 * existed still counts toward the total.
 */
const FUNNEL_STAGES: { event: string; label: string }[] = [
  { event: "signup", label: "Signed up" },
  { event: "brand", label: "Brand basics set" },
  { event: "product", label: "First product ready" },
  { event: "payments", label: "Payments connected" },
  { event: "fulfillment", label: "Fulfillment set" },
  { event: "publish", label: "Storefront published" },
  { event: "open", label: "Open for business" },
  { event: "share", label: "Shared / first sale" },
];

adminPlatformRoutes.get("/activation-funnel", async (c) => {
  const totalRow = await first<{ n: number }>(
    c.env.DB,
    `SELECT COUNT(*) AS n FROM shops WHERE status != 'closed'`,
  );
  const total = totalRow?.n ?? 0;

  let counts = new Map<string, number>();
  try {
    const rows = await all<{ event: string; n: number }>(
      c.env.DB,
      `SELECT event, COUNT(DISTINCT shop_id) AS n FROM activation_events GROUP BY event`,
    );
    counts = new Map(rows.map((r) => [r.event, r.n]));
  } catch {
    /* table not migrated yet — every stage reads 0 */
  }

  const stages = FUNNEL_STAGES.map((s) => {
    const count = counts.get(s.event) ?? 0;
    return {
      event: s.event,
      label: s.label,
      count,
      pctOfTotal: total ? Math.round((count / total) * 100) : 0,
    };
  });

  // 30-day signup trend, for a sense of top-of-funnel momentum.
  let signupsByDay: { day: string; n: number }[] = [];
  try {
    signupsByDay = await all<{ day: string; n: number }>(
      c.env.DB,
      `SELECT substr(created_at,1,10) AS day, COUNT(*) AS n
         FROM activation_events
        WHERE event = 'signup' AND created_at >= date('now','-30 days')
        GROUP BY day ORDER BY day`,
    );
  } catch {
    /* best-effort */
  }

  return c.json({ total, stages, signupsByDay });
});

/**
 * AI usage tracker — the fleet's AI/model spend in one read. Every low-level AI
 * call (Anthropic, Workers AI chat, Perplexity, Flux images) best-effort logs a
 * row to the platform `ai_usage` ledger; here we roll it up so HQ can see how
 * much is going through each model and API, and roughly what it costs. Cost is
 * an ESTIMATE (public price table in services/ai-usage.ts); token/unit counts
 * are exact. `?days=` bounds the window (default 30, capped at 365).
 */
adminPlatformRoutes.get("/ai-usage", async (c) => {
  const days = Math.min(365, Math.max(1, Number(c.req.query("days")) || 30));
  const since = `-${days} days`;
  const empty = {
    days,
    totals: { calls: 0, tokensIn: 0, tokensOut: 0, units: 0, costCents: 0 },
    byProvider: [] as unknown[],
    byModel: [] as unknown[],
    byOperation: [] as unknown[],
    byShop: [] as unknown[],
    byDay: [] as unknown[],
  };
  try {
    const totals = await first<{
      calls: number;
      tokensIn: number;
      tokensOut: number;
      units: number;
      costCents: number;
    }>(
      c.env.DB,
      `SELECT COUNT(*) AS calls,
              COALESCE(SUM(tokens_in),0) AS tokensIn,
              COALESCE(SUM(tokens_out),0) AS tokensOut,
              COALESCE(SUM(units),0) AS units,
              COALESCE(SUM(cost_cents),0) AS costCents
         FROM ai_usage WHERE created_at >= datetime('now', ?)`,
      since,
    );

    const byProvider = await all(
      c.env.DB,
      `SELECT provider,
              COUNT(*) AS calls,
              COALESCE(SUM(tokens_in),0) AS tokensIn,
              COALESCE(SUM(tokens_out),0) AS tokensOut,
              COALESCE(SUM(units),0) AS units,
              COALESCE(SUM(cost_cents),0) AS costCents
         FROM ai_usage WHERE created_at >= datetime('now', ?)
        GROUP BY provider ORDER BY costCents DESC, calls DESC`,
      since,
    );

    const byModel = await all(
      c.env.DB,
      `SELECT provider, model,
              COUNT(*) AS calls,
              COALESCE(SUM(tokens_in),0) AS tokensIn,
              COALESCE(SUM(tokens_out),0) AS tokensOut,
              COALESCE(SUM(units),0) AS units,
              COALESCE(SUM(cost_cents),0) AS costCents
         FROM ai_usage WHERE created_at >= datetime('now', ?)
        GROUP BY provider, model ORDER BY costCents DESC, calls DESC LIMIT 40`,
      since,
    );

    const byOperation = await all(
      c.env.DB,
      `SELECT COALESCE(operation,'(unlabeled)') AS operation,
              COUNT(*) AS calls,
              COALESCE(SUM(tokens_in),0) AS tokensIn,
              COALESCE(SUM(tokens_out),0) AS tokensOut,
              COALESCE(SUM(units),0) AS units,
              COALESCE(SUM(cost_cents),0) AS costCents
         FROM ai_usage WHERE created_at >= datetime('now', ?)
        GROUP BY operation ORDER BY calls DESC LIMIT 40`,
      since,
    );

    // Attribute spend to shops by name where we can; NULL shop_id = platform-level.
    const byShop = await all(
      c.env.DB,
      `SELECT u.shop_id AS shopId,
              COALESCE(s.name, CASE WHEN u.shop_id IS NULL THEN '(platform)' ELSE u.shop_id END) AS shopName,
              COUNT(*) AS calls,
              COALESCE(SUM(u.tokens_in),0) AS tokensIn,
              COALESCE(SUM(u.tokens_out),0) AS tokensOut,
              COALESCE(SUM(u.units),0) AS units,
              COALESCE(SUM(u.cost_cents),0) AS costCents
         FROM ai_usage u LEFT JOIN shops s ON s.id = u.shop_id
        WHERE u.created_at >= datetime('now', ?)
        GROUP BY u.shop_id ORDER BY costCents DESC, calls DESC LIMIT 40`,
      since,
    );

    const byDay = await all(
      c.env.DB,
      `SELECT substr(created_at,1,10) AS day,
              COUNT(*) AS calls,
              COALESCE(SUM(tokens_in),0) AS tokensIn,
              COALESCE(SUM(tokens_out),0) AS tokensOut,
              COALESCE(SUM(cost_cents),0) AS costCents
         FROM ai_usage WHERE created_at >= datetime('now', ?)
        GROUP BY day ORDER BY day`,
      since,
    );

    return c.json({
      days,
      totals: totals ?? empty.totals,
      byProvider,
      byModel,
      byOperation,
      byShop,
      byDay,
    });
  } catch {
    // Table not migrated yet (or empty) — return a well-formed empty shape.
    return c.json(empty);
  }
});

/**
 * Fleet revenue — the answer to "how much are my shops making?" Orders live in
 * each shop's own Durable Object; a daily cron rolls each shop's day up into the
 * platform `shop_metrics_daily` table, and here we read it back in one query.
 * `?days=` bounds the window (default 30, capped 365). Note: GMV sums cents
 * across shops that may bill in different currencies — the HQ page flags this.
 */
adminPlatformRoutes.get("/revenue", async (c) => {
  const days = Math.min(365, Math.max(1, Number(c.req.query("days")) || 30));
  const since = `-${days} days`;
  const empty = {
    days,
    totals: { gmvCents: 0, orders: 0, refundsCents: 0, newCustomers: 0, aovCents: 0, aiCostCents: 0 },
    currencies: [] as string[],
    byShop: [] as unknown[],
    byDay: [] as unknown[],
    lastRollupAt: null as string | null,
  };
  try {
    const totals = await first<{ gmvCents: number; orders: number; refundsCents: number; newCustomers: number }>(
      c.env.DB,
      `SELECT COALESCE(SUM(gmv_cents),0) AS gmvCents,
              COALESCE(SUM(orders),0) AS orders,
              COALESCE(SUM(refunds_cents),0) AS refundsCents,
              COALESCE(SUM(new_customers),0) AS newCustomers
         FROM shop_metrics_daily WHERE day >= date('now', ?)`,
      since,
    );
    const currencyRows = await all<{ currency: string }>(
      c.env.DB,
      `SELECT DISTINCT currency FROM shop_metrics_daily WHERE day >= date('now', ?) AND gmv_cents > 0`,
      since,
    );
    // Per-shop AI cost-to-serve over the same window, so HQ can read GMV net of
    // the AI spend that produced it. Correlated subquery over the ai_usage
    // ledger keyed by shop; the subquery's `since` binds before the outer one.
    const byShop = await all(
      c.env.DB,
      `SELECT m.shop_id AS shopId,
              COALESCE(s.name, m.shop_id) AS shopName,
              s.status AS status,
              COALESCE(SUM(m.gmv_cents),0) AS gmvCents,
              COALESCE(SUM(m.orders),0) AS orders,
              COALESCE(SUM(m.refunds_cents),0) AS refundsCents,
              COALESCE(SUM(m.new_customers),0) AS newCustomers,
              MAX(m.currency) AS currency,
              (SELECT COALESCE(SUM(a.cost_cents),0) FROM ai_usage a
                 WHERE a.shop_id = m.shop_id AND a.created_at >= datetime('now', ?)) AS aiCostCents
         FROM shop_metrics_daily m LEFT JOIN shops s ON s.id = m.shop_id
        WHERE m.day >= date('now', ?)
        GROUP BY m.shop_id ORDER BY gmvCents DESC LIMIT 100`,
      since,
      since,
    );
    // Fleet AI spend attributed to a shop over the window (for the totals row).
    const aiTotal = await first<{ aiCostCents: number }>(
      c.env.DB,
      `SELECT COALESCE(SUM(cost_cents),0) AS aiCostCents FROM ai_usage
        WHERE shop_id IS NOT NULL AND created_at >= datetime('now', ?)`,
      since,
    ).catch(() => ({ aiCostCents: 0 }));
    const byDay = await all(
      c.env.DB,
      `SELECT day,
              COALESCE(SUM(gmv_cents),0) AS gmvCents,
              COALESCE(SUM(orders),0) AS orders,
              COALESCE(SUM(refunds_cents),0) AS refundsCents
         FROM shop_metrics_daily WHERE day >= date('now', ?)
        GROUP BY day ORDER BY day`,
      since,
    );
    const meta = await first<{ lastRollupAt: string | null }>(
      c.env.DB,
      `SELECT MAX(updated_at) AS lastRollupAt FROM shop_metrics_daily`,
    );
    const t = totals ?? empty.totals;
    const aovCents = t.orders ? Math.round(t.gmvCents / t.orders) : 0;
    return c.json({
      days,
      totals: { ...t, aovCents, aiCostCents: aiTotal?.aiCostCents ?? 0 },
      currencies: currencyRows.map((r) => r.currency),
      byShop,
      byDay,
      lastRollupAt: meta?.lastRollupAt ?? null,
    });
  } catch {
    return c.json(empty);
  }
});

/**
 * Refresh the rollup on demand (the cron does it daily; this is the "refresh
 * now" button). Rolls up today + yesterday for every active shop. Write action,
 * so it goes through requireAdminOnly (demo/HQ-read sessions can't trigger it).
 */
adminPlatformRoutes.post("/revenue/rollup", requireAdminOnly, async (c) => {
  const { rollupFleetMetrics } = await import("../services/shop-metrics");
  const written = await rollupFleetMetrics(c.env);
  return c.json({ ok: true, shopDaysWritten: written });
});

/**
 * Per-shop activation scorecard — turns the funnel into names. The funnel says
 * "where does the fleet leak"; this says "which shops are stuck, at what step,
 * and for how long," so a drop-off becomes a to-do list. Reads entirely from
 * the platform (shops + activation_events); classification lives in the pure,
 * unit-tested buildShopProgress helper.
 */
adminPlatformRoutes.get("/shop-progress", async (c) => {
  const { buildShopProgress } = await import("../services/shop-progress");
  const shops = await all<{ id: string; name: string; slug: string; status: string; plan: string | null; created_at: string }>(
    c.env.DB,
    `SELECT id, name, slug, status, plan, created_at FROM shops WHERE status != 'closed' ORDER BY created_at DESC`,
  );
  let events: { shop_id: string; event: string; created_at: string }[] = [];
  try {
    events = await all<{ shop_id: string; event: string; created_at: string }>(
      c.env.DB,
      `SELECT shop_id, event, created_at FROM activation_events`,
    );
  } catch {
    /* table not migrated — every shop reads as no milestones */
  }
  return c.json(buildShopProgress(shops, events, Date.now()));
});

/**
 * Fleet activity pulse — the newest business-meaningful events across every
 * shop (publishes, sales, deposits, commission moves, new clients…). Fans out
 * over active shops' own activity spines and merges; read-only, on demand.
 */
adminPlatformRoutes.get("/activity", async (c) => {
  const { fleetActivity } = await import("../services/fleet-activity");
  const limit = Number(c.req.query("limit")) || 100;
  try {
    const result = await fleetActivity(c.env, { limit });
    return c.json(result);
  } catch {
    return c.json({ items: [], shopsScanned: 0 });
  }
});

/**
 * Error/incident view — what's breaking across the fleet, for whom, how often.
 * Reads the platform_errors log (written best-effort by the worker's onError
 * hook), open incidents first. Sentry holds the full stack trace; this is the
 * at-a-glance triage surface. `?days=` bounds the window (default 30).
 */
adminPlatformRoutes.get("/errors", async (c) => {
  const days = Math.min(365, Math.max(1, Number(c.req.query("days")) || 30));
  const since = `-${days} days`;
  try {
    const errors = await all<{
      id: number;
      shopId: string | null;
      method: string;
      path: string;
      status: number;
      message: string;
      count: number;
      firstSeen: string;
      lastSeen: string;
      resolvedAt: string | null;
    }>(
      c.env.DB,
      `SELECT id, shop_id AS shopId, method, path, status, message, count,
              first_seen AS firstSeen, last_seen AS lastSeen, resolved_at AS resolvedAt
         FROM platform_errors
        WHERE last_seen >= datetime('now', ?)
        ORDER BY (resolved_at IS NULL) DESC, last_seen DESC
        LIMIT 200`,
      since,
    );
    const open = errors.filter((e) => !e.resolvedAt);
    return c.json({
      days,
      errors,
      summary: {
        openIncidents: open.length,
        openEvents: open.reduce((n, e) => n + e.count, 0),
        totalIncidents: errors.length,
      },
    });
  } catch {
    return c.json({ days, errors: [], summary: { openIncidents: 0, openEvents: 0, totalIncidents: 0 } });
  }
});

/** Mark an incident handled. A later recurrence re-opens it automatically. */
adminPlatformRoutes.post("/errors/:id/resolve", requireAdminOnly, async (c) => {
  const result = await run(
    c.env.DB,
    `UPDATE platform_errors SET resolved_at = datetime('now') WHERE id = ?`,
    c.req.param("id"),
  );
  if (!result.meta.changes) return c.json({ error: "Not found" }, 404);
  return c.json({ ok: true });
});

adminPlatformRoutes.get("/shops", async (c) => {
  const rows = await all(
    c.env.DB,
    `SELECT id, slug, name, status, owner_email, plan, custom_domain, note, created_at
     FROM shops ORDER BY created_at DESC`,
  );
  return c.json(rows);
});

/**
 * One-shot copy of the primary shop out of the bound D1 into its own
 * ShopDatabase Durable Object — the last step of making the flagship a
 * normal tenant. Copies every table the DO schema defines (platform-only
 * tables aren't in that schema, so they stay behind), INSERT OR REPLACE so
 * re-runs heal partial copies. Flip PRIMARY_ON_DO to "1" (wrangler.toml)
 * only after this reports ok.
 */
adminPlatformRoutes.post("/migrate-primary", async (c) => {
  if (c.env.PRIMARY_ON_DO === "1") {
    return c.json({ error: "The primary shop already resolves to its DO — nothing to migrate." }, 409);
  }
  const { getShopDoDb } = await import("../services/tenant-db");
  const target = getShopDoDb(c.env, PRIMARY_SHOP_ID);
  const report: Record<string, number | string> = {};
  let step = "list DO tables";
  try {
    // First touch bootstraps the DO schema; its table list IS the shop schema.
    const doTables = await target
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '\\_cf%' ESCAPE '\\' AND name != 'd1_migrations'`)
      .all<{ name: string }>();
    const names = doTables.results.map((t) => t.name);

    // The DO's SQLite enforces foreign keys (D1 historically didn't), so the
    // copy must respect the FK graph: wipe children-first, insert
    // parents-first. Kahn's ordering from the schema's own FK metadata;
    // cycles (self-references) just land at the end.
    step = "read FK graph";
    const parentsOf = new Map<string, Set<string>>();
    for (const name of names) {
      const fks = await c.env.DB.prepare(`PRAGMA foreign_key_list("${name}")`).all<{ table: string }>().catch(() => ({ results: [] as { table: string }[] }));
      parentsOf.set(name, new Set(fks.results.map((f) => f.table).filter((p) => p !== name && names.includes(p))));
    }
    const { topoSortByParents } = await import("../utils/topo");
    const ordered = topoSortByParents(names, parentsOf);

    step = "wipe target";
    for (const name of [...ordered].reverse()) {
      await target.prepare(`DELETE FROM "${name}"`).run();
    }

    let total = 0;
    for (const name of ordered) {
      step = `copy ${name}`;
      let rows: Record<string, unknown>[];
      try {
        rows = (await c.env.DB.prepare(`SELECT * FROM "${name}"`).all()).results;
      } catch {
        report[name] = "absent in D1 — skipped";
        continue;
      }
      if (rows.length === 0) continue;
      const cols = Object.keys(rows[0]);
      const sql = `INSERT OR REPLACE INTO "${name}" (${cols.map((k) => `"${k}"`).join(",")}) VALUES (${cols.map(() => "?").join(",")})`;
      const statements = rows.map((r) => target.prepare(sql).bind(...cols.map((k) => r[k] ?? null)));
      for (let i = 0; i < statements.length; i += 40) {
        await target.batch(statements.slice(i, i + 40));
      }
      report[name] = rows.length;
      total += rows.length;
    }
    await writeAudit(c.env.DB, c.var.userId!, "platform.migrate_primary", "shop", PRIMARY_SHOP_ID);
    return c.json({ ok: true, total, tables: report });
  } catch (err) {
    // SuperAdmin-only endpoint: the real error is operational gold, return it.
    return c.json({ error: `migrate-primary failed at "${step}": ${String(err)}`, tables: report }, 500);
  }
});

adminPlatformRoutes.post("/shops/:id/provision", requireAdminOnly, async (c) => {
  const shop = await first<Shop & { owner_email: string | null }>(
    c.env.DB,
    `SELECT id, slug, name, status, custom_domain, owner_email FROM shops WHERE id = ?`,
    c.req.param("id"),
  );
  if (!shop) return c.json({ error: "Shop not found" }, 404);
  if (shop.status === "active") return c.json({ error: "Shop is already active" }, 409);
  if (!shop.owner_email) return c.json({ error: "Shop has no owner email on file" }, 409);
  if (RESERVED_SLUGS.has(shop.slug)) return c.json({ error: "Reserved slug" }, 409);

  try {
    const result = await provisionShop(c.env, shop, shop.owner_email);
    await writeAudit(c.env.DB, c.var.userId, "platform.shop.provision", "shop", shop.id, {
      slug: shop.slug,
    });
    return c.json(result, 201);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Provisioning failed" }, 500);
  }
});

const shopPatchSchema = z.object({
  status: z.enum(["pending", "active", "suspended", "closed"]).optional(),
  customDomain: z
    .string()
    .max(200)
    .regex(/^[a-z0-9.-]+$/i, "Hostname only — no scheme or path")
    .nullable()
    .optional(),
  note: z.string().max(1000).nullable().optional(),
});

adminPlatformRoutes.patch("/shops/:id", requireAdminOnly, async (c) => {
  const body = await parseBody(c, shopPatchSchema);
  const sets: string[] = [`updated_at = datetime('now')`];
  const params: unknown[] = [];
  if (body.status !== undefined) (sets.push("status = ?"), params.push(body.status));
  if (body.customDomain !== undefined)
    (sets.push("custom_domain = ?"), params.push(body.customDomain?.toLowerCase() ?? null));
  if (body.note !== undefined) (sets.push("note = ?"), params.push(body.note));
  const result = await run(
    c.env.DB,
    `UPDATE shops SET ${sets.join(", ")} WHERE id = ?`,
    ...params,
    c.req.param("id"),
  );
  if (!result.meta.changes) return c.json({ error: "Shop not found" }, 404);
  await writeAudit(c.env.DB, c.var.userId, "platform.shop.update", "shop", c.req.param("id"), body);
  return c.json({ ok: true });
});
