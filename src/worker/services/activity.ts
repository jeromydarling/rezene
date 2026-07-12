/**
 * The event spine + built-in automations.
 *
 * Every meaningful write across the app calls `emit()` with a typed event.
 * The event is appended to `activity_events` (the substrate the derived
 * calendar, the automations, and the digest all build on), and any enabled
 * automation rules for that event kind run inline — they only ever CREATE
 * things (a task, a draft PO), never modify or destroy, so a surprise
 * automation is at worst a task you delete.
 *
 * Everything here is fire-and-forget: an automation failure must never break
 * the user's save. Errors are swallowed after a console log.
 */
import { all, first, run } from "./db";
import { newId } from "../utils/id";
import type { Env } from "../types/env";

type DB = D1Database;

/**
 * Optional runtime handles for rules that need to reach the network (AI, Stripe)
 * or defer work off the request path. DB-only rules ignore these; only call
 * sites that want those richer automations pass them (e.g. product publish).
 */
export interface EmitOpts {
  env?: Env;
  /** Anything with waitUntil — Hono's executionCtx or the raw ExecutionContext. */
  ctx?: { waitUntil: (promise: Promise<unknown>) => void };
}

export interface ActivityEvent {
  kind: string; // 'sample.approved', 'po.status.confirmed', 'commission.stage_changed', ...
  entityType: string;
  entityId: string;
  title: string; // human sentence for the activity feed
  payload?: Record<string, unknown>;
}

export interface AutomationRule {
  key: string;
  on: string; // event kind this rule listens for
  title: string; // short name for the settings page
  description: string; // plain-language "when X, Verto does Y"
}

/** The built-in rules, in the order the settings page lists them. */
export const AUTOMATION_RULES: AutomationRule[] = [
  {
    key: "sample-approved-po-draft",
    on: "sample.approved",
    title: "Sample approved → draft the production order",
    description:
      "When you approve a sample, Verto drafts a purchase order to that maker and files a production task to finalise it.",
  },
  {
    key: "po-confirmed-chase",
    on: "po.status.confirmed",
    title: "Order confirmed → ex-factory reminder",
    description:
      "When a purchase order is confirmed, Verto files a task to chase the ex-factory shipment on the promised date.",
  },
  {
    key: "po-received-reconcile",
    on: "po.status.received",
    title: "Order received → reconcile the delivery",
    description:
      "When a purchase order lands, Verto files a task to reconcile the delivery against the order and update stock.",
  },
  {
    key: "maker-promoted-follow-up",
    on: "research.maker_promoted",
    title: "R&D lead promoted → follow up",
    description:
      "When you promote a research lead into Factories & Suppliers, Verto files a reach-out task due in a week.",
  },
  {
    key: "research-watch-refresh",
    on: "cron.daily",
    title: "Watched research → weekly refresh",
    description:
      "Brand dossiers and trend boards you watch are re-researched about once a week (from your daily research allowance), and what changed lands in your activity feed and digest.",
  },
  {
    key: "commission-stage-next-step",
    on: "commission.stage_changed",
    title: "Commission moves stage → next step",
    description:
      "When a commission changes stage, Verto files the natural next task — source the fabric, schedule the fitting, arrange the handover.",
  },
  {
    key: "product-published-launch-kit",
    on: "product.published",
    title: "Product published → draft the launch kit",
    description:
      "When you publish a product, Verto drafts a launch campaign — an Instagram caption, a launch email, and an SEO article — into Marketing, ready for you to edit, schedule, and send. Nothing posts on its own.",
  },
  {
    key: "stock-restocked-post",
    on: "inventory.restocked",
    title: "Back in stock → draft an “it's back” post",
    description:
      "When a sold-out product is restocked, Verto drafts a warm “back in stock” post into Marketing for you to edit and send. (Your waitlist is emailed separately and automatically.)",
  },
  {
    key: "stock-low-post",
    on: "inventory.low",
    title: "Low stock → draft an urgency post",
    description:
      "When a product's stock runs low, Verto drafts an honest “selling fast” post into Marketing — real urgency, no fake scarcity — for you to edit and send.",
  },
  {
    key: "stock-soldout-post",
    on: "inventory.sold_out",
    title: "Sold out → draft a sold-out note",
    description:
      "When a product sells out, Verto drafts a gracious sold-out post into Marketing that points to your waitlist or next drop, for you to edit and send.",
  },
  {
    key: "trend-adopted-angle",
    on: "research.trend_adopted",
    title: "Trend adopted → draft a season angle",
    description:
      "When you adopt a trend board into the Design Studio, Verto drafts a campaign angle for that season direction into Marketing, for you to edit and send.",
  },
  {
    key: "review-repost",
    on: "review.created",
    title: "New review → draft a repost",
    description:
      "When a customer leaves a review, Verto drafts a tasteful repost into Marketing that quotes it and credits them, for you to edit and send.",
  },
];

/** Rule toggles: no row means enabled — rules are quiet (create-only). */
async function ruleEnabled(db: DB, key: string): Promise<boolean> {
  try {
    const row = await first<{ enabled: number }>(
      db,
      `SELECT enabled FROM automation_settings WHERE rule_key = ?`,
      key,
    );
    return row ? Boolean(row.enabled) : true;
  } catch {
    return true;
  }
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysFromNow = (n: number) => iso(new Date(Date.now() + n * 86400000));

async function createTask(
  db: DB,
  task: {
    title: string;
    dueDate?: string | null;
    styleId?: string | null;
    supplierId?: string | null;
    notes?: string | null;
  },
) {
  await run(
    db,
    `INSERT INTO production_tasks (id, title, status, style_id, supplier_id, due_date, notes)
     VALUES (?, ?, 'todo', ?, ?, ?, ?)`,
    newId("task"),
    task.title,
    task.styleId ?? null,
    task.supplierId ?? null,
    task.dueDate ?? null,
    task.notes ?? null,
  );
}

async function nextPoNumber(db: DB): Promise<string> {
  const year = new Date().getUTCFullYear();
  const prefix = `PO-${year}-`;
  const last = await first<{ po_number: string }>(
    db,
    `SELECT po_number FROM production_orders WHERE po_number LIKE ? ORDER BY po_number DESC LIMIT 1`,
    `${prefix}%`,
  );
  const nextSeq = last ? parseInt(last.po_number.slice(prefix.length), 10) + 1 : 1;
  return `${prefix}${String(nextSeq).padStart(3, "0")}`;
}

/** What each rule actually does. Create-only, by design. */
async function runRule(db: DB, key: string, ev: ActivityEvent, opts?: EmitOpts): Promise<void> {
  const p = (ev.payload ?? {}) as Record<string, string | null | undefined>;
  switch (key) {
    case "product-published-launch-kit": {
      // Needs the network (LLM) — defer off the request path. Skip silently if
      // this emit site didn't pass env/ctx (then it's feed-only).
      if (!opts?.env || !opts?.ctx || !p.productId) return;
      const env = opts.env;
      const productId = String(p.productId);
      const name = p.name ? String(p.name) : "your new product";
      opts.ctx.waitUntil(
        import("./marketing-automations").then(({ draftLaunchKit }) => draftLaunchKit(env, db, { productId, name })),
      );
      return;
    }
    case "stock-low-post":
    case "stock-restocked-post":
    case "stock-soldout-post": {
      if (!opts?.env || !opts?.ctx || !p.productId) return;
      const env = opts.env;
      const productId = String(p.productId);
      const name = p.name ? String(p.name) : "a product";
      const mode = key === "stock-low-post" ? "low" : key === "stock-restocked-post" ? "restocked" : "soldout";
      opts.ctx.waitUntil(
        import("./marketing-automations").then(({ draftStockPost }) =>
          draftStockPost(env, db, { productId, name, mode }),
        ),
      );
      return;
    }
    case "trend-adopted-angle": {
      if (!opts?.env || !opts?.ctx || !p.conceptId) return;
      const env = opts.env;
      const conceptId = String(p.conceptId);
      const trendTitle = p.trendTitle ? String(p.trendTitle) : "a season direction";
      const brief = p.brief ? String(p.brief) : null;
      opts.ctx.waitUntil(
        import("./marketing-automations").then(({ draftTrendAngle }) =>
          draftTrendAngle(env, db, { conceptId, trendTitle, brief }),
        ),
      );
      return;
    }
    case "review-repost": {
      if (!opts?.env || !opts?.ctx) return;
      const env = opts.env;
      const productId = p.productId ? String(p.productId) : null;
      const productName = p.productName ? String(p.productName) : "your product";
      const rating = Number(p.rating) || 5;
      const author = p.author ? String(p.author) : "";
      const body = p.body ? String(p.body) : "";
      opts.ctx.waitUntil(
        import("./marketing-automations").then(({ draftReviewRepost }) =>
          draftReviewRepost(env, db, { productId, productName, rating, author, body }),
        ),
      );
      return;
    }
    case "sample-approved-po-draft": {
      const styleName = p.styleName ?? "the style";
      if (p.supplierId) {
        const poNumber = await nextPoNumber(db);
        await run(
          db,
          `INSERT INTO production_orders (id, po_number, supplier_id, status, notes, total_cost_cents)
           VALUES (?, ?, ?, 'draft', ?, 0)`,
          newId("po"),
          poNumber,
          p.supplierId,
          `Drafted automatically when sample round ${p.round ?? "?"} of ${styleName} was approved. Add line items and send when ready.`,
        );
        await createTask(db, {
          title: `Finalise ${poNumber} for ${styleName} (sample approved)`,
          dueDate: daysFromNow(7),
          styleId: p.styleId,
          supplierId: p.supplierId,
          notes: "Filed automatically — the sample was approved, so the production order is drafted and waiting for line items.",
        });
      } else {
        await createTask(db, {
          title: `Raise the production order for ${styleName} (sample approved)`,
          dueDate: daysFromNow(7),
          styleId: p.styleId,
          notes: "Filed automatically — the sample was approved with no maker on record, so pick the maker and raise the order.",
        });
      }
      return;
    }
    case "po-confirmed-chase": {
      await createTask(db, {
        title: `Chase ex-factory shipment for ${p.poNumber ?? "the order"}`,
        dueDate: p.exFactoryDate || daysFromNow(30),
        supplierId: p.supplierId,
        notes: "Filed automatically when the order was confirmed. Due on the promised ex-factory date.",
      });
      return;
    }
    case "po-received-reconcile": {
      await createTask(db, {
        title: `Reconcile ${p.poNumber ?? "the delivery"} against the order + update stock`,
        dueDate: daysFromNow(2),
        supplierId: p.supplierId,
        notes: "Filed automatically when the order was marked received.",
      });
      return;
    }
    case "maker-promoted-follow-up": {
      await createTask(db, {
        title: `Reach out to ${p.name ?? "the new maker"} — new lead from R&D`,
        dueDate: daysFromNow(7),
        supplierId: p.supplierId,
        notes: "Filed automatically when the research lead was promoted into Factories & Suppliers.",
      });
      return;
    }
    case "commission-stage-next-step": {
      const NEXT: Record<string, string> = {
        design: "Prepare the design proposal for",
        fabric: "Source the fabric for",
        cutting: "Cut and baste",
        fitting: "Schedule the fitting for",
        delivery: "Arrange the handover of",
      };
      const verb = NEXT[p.stage ?? ""];
      if (!verb) return; // consult/done/cancelled need no push
      await createTask(db, {
        title: `${verb} ${p.title ?? "the commission"}${p.clientName ? ` · ${p.clientName}` : ""}`,
        dueDate: p.dueAt ? p.dueAt.slice(0, 10) : daysFromNow(7),
        styleId: p.styleId,
        notes: "Filed automatically when the commission moved stage.",
      });
      return;
    }
  }
}

/** Append to the spine and run any enabled rules. Never throws. Pass `opts`
 *  (env/ctx) at call sites whose rules reach the network (AI/Stripe). */
export async function emit(db: DB, ev: ActivityEvent, opts?: EmitOpts): Promise<void> {
  try {
    await run(
      db,
      `INSERT INTO activity_events (id, kind, entity_type, entity_id, title, payload)
       VALUES (?, ?, ?, ?, ?, ?)`,
      newId("act"),
      ev.kind,
      ev.entityType,
      ev.entityId,
      ev.title,
      ev.payload ? JSON.stringify(ev.payload) : null,
    );
  } catch (err) {
    console.log("activity emit failed", ev.kind, err);
  }
  for (const rule of AUTOMATION_RULES) {
    if (rule.on !== ev.kind) continue;
    try {
      if (await ruleEnabled(db, rule.key)) await runRule(db, rule.key, ev, opts);
    } catch (err) {
      console.log("automation failed", rule.key, err);
    }
  }
}

/** Recent activity, for the automations page feed. */
export async function recentActivity(db: DB, limit = 50) {
  try {
    return await all<Record<string, unknown>>(
      db,
      `SELECT id, kind, entity_type, entity_id, title, created_at
       FROM activity_events ORDER BY created_at DESC LIMIT ?`,
      limit,
    );
  } catch {
    return [];
  }
}
