/**
 * "Get Selling Fast" — the activation sequence that picks up where the
 * Launch Playbook hands off. The Playbook drafts the brand and the site;
 * this gets the shop to a state where a stranger can actually buy something.
 *
 * Every step's `done` is DERIVED from real shop state (a priced product, a
 * Stripe key, a shipping rate, a published page, a real order) rather than a
 * checkbox the merchant ticks themselves — so the guide can never lie, and it
 * self-dismisses the moment the shop is genuinely open for business.
 *
 * The only persisted piece is a small JSON blob in `settings.onboarding_state`
 * holding the things we can't infer: whether the merchant dismissed the guide,
 * whether they've told us they shared their link, and when we celebrated.
 */
import { first, run } from "./db";
import type { Env } from "../types/env";

export interface OnboardingPersisted {
  /** Merchant hid the guide from the dashboard (still reachable from the menu). */
  dismissed: boolean;
  /** Merchant confirmed they shared their shop link (the last, un-inferrable step). */
  sharedClicked: boolean;
  /** ISO timestamp we first showed the "you're open" celebration (once only). */
  celebratedAt: string | null;
}

export interface ActivationStep {
  id: string;
  title: string;
  /** One warm line: why this step matters for making a sale. */
  why: string;
  /** Deep-link into the admin where the step gets done. */
  href: string;
  /** Call-to-action label on the button. */
  cta: string;
  /** Derived from real state — the merchant can't fake it. */
  done: boolean;
  /** Optional (nice-to-have) steps don't count against the "open for business" gate. */
  optional?: boolean;
  /** A live detail shown under the row, e.g. "2 products, both priced". */
  detail?: string;
}

export interface ActivationState {
  steps: ActivationStep[];
  /** 0–100 across the REQUIRED steps only. */
  percent: number;
  /** Every required step done → the shop can take a real order. */
  open: boolean;
  persisted: OnboardingPersisted;
}

const DEFAULT_PERSISTED: OnboardingPersisted = {
  dismissed: false,
  sharedClicked: false,
  celebratedAt: null,
};

/** Best-effort scalar count; a missing table on a lean shop reads as 0. */
async function count(db: D1Database, sql: string): Promise<number> {
  try {
    const row = await first<{ n: number }>(db, sql);
    return row?.n ?? 0;
  } catch {
    return 0;
  }
}

export async function readPersisted(db: D1Database): Promise<OnboardingPersisted> {
  try {
    const row = await first<{ value: string }>(
      db,
      `SELECT value FROM settings WHERE key = 'onboarding_state'`,
    );
    if (!row?.value) return { ...DEFAULT_PERSISTED };
    return { ...DEFAULT_PERSISTED, ...(JSON.parse(row.value) as Partial<OnboardingPersisted>) };
  } catch {
    return { ...DEFAULT_PERSISTED };
  }
}

export async function writePersisted(
  db: D1Database,
  patch: Partial<OnboardingPersisted>,
): Promise<OnboardingPersisted> {
  const current = await readPersisted(db);
  const next = { ...current, ...patch };
  await run(
    db,
    `INSERT INTO settings (key, value) VALUES ('onboarding_state', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    JSON.stringify(next),
  );
  return next;
}

/**
 * Compute the live activation state for a shop. `env` is read only for the
 * platform-level Stripe presence (payments are a Worker secret today); every
 * other signal comes from the shop's own database.
 */
export async function getActivationState(db: D1Database, env: Env): Promise<ActivationState> {
  const persisted = await readPersisted(db);

  // 1. Brand basics — the Playbook marks the brand brain onboarded.
  const brainOnboarded = await count(
    db,
    `SELECT COUNT(*) AS n FROM brand_brain WHERE id = 'brain' AND onboarded = 1`,
  );

  // 2. A first product, and specifically one that's sellable (priced + live).
  const productsAny = await count(db, `SELECT COUNT(*) AS n FROM products`);
  const productsSellable = await count(
    db,
    `SELECT COUNT(*) AS n FROM products WHERE availability = 'available' AND base_price_cents > 0`,
  );

  // 3. Payments — Stripe secret present (platform-level for now).
  const paymentsReady = Boolean(env.STRIPE_SECRET_KEY);

  // 4. Fulfillment — an active shipping rate, or a merchant who marked the
  //    shop pickup/digital-only (so shipping genuinely doesn't apply).
  const activeRates = await count(
    db,
    `SELECT COUNT(*) AS n FROM shipping_rates WHERE is_active = 1`,
  );
  const fulfillmentMode = await first<{ value: string }>(
    db,
    `SELECT value FROM settings WHERE key = 'fulfillment_mode'`,
  ).catch(() => null);
  const fulfillmentReady =
    activeRates > 0 || (fulfillmentMode?.value === "pickup" || fulfillmentMode?.value === "digital");

  // 5. Open the storefront — at least one published page so the shop is public.
  const publishedPages = await count(
    db,
    `SELECT COUNT(*) AS n FROM pages WHERE is_published = 1`,
  );

  // 6. First sale — any real order, or the merchant confirmed they shared.
  const orders = await count(db, `SELECT COUNT(*) AS n FROM orders`);

  const steps: ActivationStep[] = [
    {
      id: "brand",
      title: "Set your brand basics",
      why: "Your name, voice, and look — so the storefront and every document feel like you.",
      href: "/admin/launch",
      cta: "Open the Launch Playbook",
      done: brainOnboarded > 0,
      detail: brainOnboarded > 0 ? "Done in the Launch Playbook" : undefined,
    },
    {
      id: "product",
      title: "Add your first product",
      why: "Nothing sells until there's something to buy. One priced, available product is enough to open.",
      href: "/admin/products",
      cta: productsAny > 0 ? "Add another product" : "Add a product",
      done: productsSellable > 0,
      detail:
        productsSellable > 0
          ? `${productsSellable} product${productsSellable === 1 ? "" : "s"} ready to sell`
          : productsAny > 0
            ? `${productsAny} product${productsAny === 1 ? "" : "s"} — add a price and set to “available”`
            : undefined,
    },
    {
      id: "payments",
      title: "Connect payments",
      why: "The step that turns a website into a store. Stripe deposits sales straight to your bank.",
      href: "/admin/settings",
      cta: "Connect Stripe",
      done: paymentsReady,
      detail: paymentsReady ? "Stripe connected — you can take card payments" : undefined,
    },
    {
      id: "fulfillment",
      title: "Set how orders reach buyers",
      why: "Add a shipping rate (or mark the shop pickup/digital) so checkout can total an order.",
      href: "/admin/shipping",
      cta: activeRates > 0 ? "Review shipping" : "Set a shipping rate",
      done: fulfillmentReady,
      detail:
        activeRates > 0
          ? `${activeRates} active rate${activeRates === 1 ? "" : "s"}`
          : fulfillmentReady
            ? "Pickup / digital — no shipping needed"
            : undefined,
    },
    {
      id: "publish",
      title: "Open your storefront",
      why: "Publish your shop so the world can visit. Your address is live the moment a page is public.",
      href: "/admin/content",
      cta: publishedPages > 0 ? "Review your pages" : "Publish your storefront",
      done: publishedPages > 0,
      detail: publishedPages > 0 ? `${publishedPages} published page${publishedPages === 1 ? "" : "s"}` : undefined,
    },
    {
      id: "share",
      title: "Make your first sale",
      why: "Send your shop link to your list and your socials. Your first order is the one that counts.",
      href: "/admin/marketing",
      cta: "Share your shop",
      done: orders > 0 || persisted.sharedClicked,
      detail:
        orders > 0
          ? `${orders} order${orders === 1 ? "" : "s"} so far`
          : persisted.sharedClicked
            ? "Shared — first order coming"
            : undefined,
    },
  ];

  const required = steps.filter((s) => !s.optional);
  const doneCount = required.filter((s) => s.done).length;
  const percent = Math.round((doneCount / required.length) * 100);
  // "Open for business" = the merchant can actually receive a paid order:
  // a sellable product, payments, fulfillment, and a public storefront.
  const gate = new Set(["product", "payments", "fulfillment", "publish"]);
  const open = steps.filter((s) => gate.has(s.id)).every((s) => s.done);

  return { steps, percent, open, persisted };
}

/**
 * Record a shop's activation milestones at the PLATFORM database so Verto HQ
 * can read the whole funnel in one query. Idempotent by (shop_id, event): the
 * first time a milestone is observed it sticks with that timestamp; later loads
 * are no-ops. Best-effort — analytics must never break a dashboard load.
 *
 * Called with the derived state on the shop's own dashboard read ("derive and
 * log"), so the funnel populates from real activity without instrumenting every
 * action in the app.
 */
export async function recordActivationMilestones(
  platformDb: D1Database,
  shopId: string,
  state: ActivationState,
): Promise<void> {
  const events: string[] = [];
  for (const step of state.steps) if (step.done) events.push(step.id);
  if (state.open) events.push("open");
  if (!events.length) return;
  try {
    const stmt = platformDb.prepare(
      `INSERT OR IGNORE INTO activation_events (shop_id, event) VALUES (?, ?)`,
    );
    await platformDb.batch(events.map((e) => stmt.bind(shopId, e)));
  } catch {
    /* table absent or write failed — analytics is never load-critical */
  }
}

/** Record a single named milestone (e.g. 'signup' at provision time). */
export async function recordActivationEvent(
  platformDb: D1Database,
  shopId: string,
  event: string,
): Promise<void> {
  try {
    await platformDb
      .prepare(`INSERT OR IGNORE INTO activation_events (shop_id, event) VALUES (?, ?)`)
      .bind(shopId, event)
      .run();
  } catch {
    /* best-effort */
  }
}
