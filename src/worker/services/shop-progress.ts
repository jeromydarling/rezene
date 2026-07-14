/**
 * Per-shop activation scorecard. Pure transform over platform data (the shop
 * registry + the activation_events milestone log), so it's deterministic and
 * unit-testable without a DB. The route feeds it rows read from env.DB; the
 * classification (stuck / next step / how long) lives here.
 *
 * Milestone ids mirror the activation steps in services/activation.ts, plus the
 * derived "open" (open for business) event.
 */

export const PROGRESS_STEPS: { id: string; label: string }[] = [
  { id: "brand", label: "Brand basics" },
  { id: "product", label: "First product" },
  { id: "payments", label: "Payments" },
  { id: "fulfillment", label: "Fulfillment" },
  { id: "publish", label: "Storefront live" },
  { id: "share", label: "First sale / shared" },
];

export type ProgressState = "open" | "new" | "in_progress" | "stalled";

export interface ShopInput {
  id: string;
  name: string;
  slug: string;
  status: string;
  plan: string | null;
  created_at: string;
}
export interface EventInput {
  shop_id: string;
  event: string;
  created_at: string;
}

export interface ShopProgressRow {
  shopId: string;
  shopName: string;
  slug: string;
  status: string;
  plan: string | null;
  createdAt: string;
  signupDays: number;
  stalledDays: number;
  done: string[];
  open: boolean;
  nextStep: { id: string; label: string } | null;
  state: ProgressState;
}

export interface ShopProgressReport {
  steps: { id: string; label: string }[];
  shops: ShopProgressRow[];
  summary: { total: number; open: number; stalled: number; new: number; inProgress: number };
}

/** Parse a SQLite 'YYYY-MM-DD HH:MM:SS' (UTC) timestamp to epoch ms, NaN if unparseable. */
function parseTs(s: string | null | undefined): number {
  if (!s) return NaN;
  const t = new Date(s.replace(" ", "T") + "Z").getTime();
  return Number.isFinite(t) ? t : NaN;
}

/**
 * Build the scorecard. `nowMs` is injected so tests are deterministic and the
 * function stays pure. Sorted stalled-first (most days stuck), open last.
 */
export function buildShopProgress(
  shops: ShopInput[],
  events: EventInput[],
  nowMs: number,
): ShopProgressReport {
  const byShop = new Map<string, Map<string, string>>();
  for (const e of events) {
    if (!byShop.has(e.shop_id)) byShop.set(e.shop_id, new Map());
    byShop.get(e.shop_id)!.set(e.event, e.created_at);
  }
  const daysSince = (t: number): number => (Number.isFinite(t) ? Math.floor((nowMs - t) / 86400000) : 0);

  const rows: ShopProgressRow[] = shops.map((s) => {
    const evs = byShop.get(s.id) ?? new Map<string, string>();
    const done = PROGRESS_STEPS.filter((step) => evs.has(step.id)).map((step) => step.id);
    const open = evs.has("open");
    const nextStep = PROGRESS_STEPS.find((step) => !evs.has(step.id)) ?? null;
    const stamps = [...evs.values()].map(parseTs).filter(Number.isFinite);
    const lastActivity = stamps.length ? Math.max(...stamps) : parseTs(s.created_at);
    const signupDays = daysSince(parseTs(s.created_at));
    const stalledDays = daysSince(lastActivity);
    let state: ProgressState;
    if (open) state = "open";
    else if (signupDays < 3) state = "new";
    else if (stalledDays >= 14) state = "stalled";
    else state = "in_progress";
    return {
      shopId: s.id,
      shopName: s.name,
      slug: s.slug,
      status: s.status,
      plan: s.plan,
      createdAt: s.created_at,
      signupDays,
      stalledDays,
      done,
      open,
      nextStep: nextStep ? { id: nextStep.id, label: nextStep.label } : null,
      state,
    };
  });

  const summary = {
    total: rows.length,
    open: rows.filter((r) => r.state === "open").length,
    stalled: rows.filter((r) => r.state === "stalled").length,
    new: rows.filter((r) => r.state === "new").length,
    inProgress: rows.filter((r) => r.state === "in_progress").length,
  };
  const order: Record<ProgressState, number> = { stalled: 0, in_progress: 1, new: 2, open: 3 };
  rows.sort((a, b) => order[a.state] - order[b.state] || b.stalledDays - a.stalledDays);

  return { steps: PROGRESS_STEPS, shops: rows, summary };
}
