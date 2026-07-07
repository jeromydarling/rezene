import type { Context } from "hono";
import type { AppContext } from "../types/env";

/**
 * Per-shop daily quota for PAID AI-research calls (Perplexity). Every shop uses
 * Verto's platform key, so without a cap one shop hammering "Find a maker" runs
 * up the platform bill. This is a fixed UTC-day counter in KV, shared across all
 * research features (search + enrich + export-intel + duties + costing) so the
 * cap is on total spend per shop per day, not per feature.
 *
 * Not billing-grade (the read-then-write isn't atomic), but a solid abuse/cost
 * damper. Only call it right before an actual upstream request — never on a
 * cache hit — so cached responses don't burn quota.
 *
 * Tune the daily cap with the PERPLEXITY_DAILY_LIMIT env var (default 40).
 */
const DEFAULT_DAILY_LIMIT = 40;

export interface QuotaResult {
  ok: boolean;
  used: number;
  limit: number;
}

function dailyLimit(env: AppContext["Bindings"]): number {
  const raw = env.PERPLEXITY_DAILY_LIMIT;
  const n = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_DAILY_LIMIT;
}

/** Reserve one unit of today's research quota for this shop. */
export async function reserveResearchQuota(c: Context<AppContext>): Promise<QuotaResult> {
  const limit = dailyLimit(c.env);
  const day = new Date().toISOString().slice(0, 10); // UTC day
  const key = `aiq:${c.var.shopId}:research:${day}`;
  const used = parseInt((await c.env.KV.get(key)) ?? "0", 10);
  if (used >= limit) return { ok: false, used, limit };
  await c.env.KV.put(key, String(used + 1), { expirationTtl: 172800 }); // 2 days
  return { ok: true, used: used + 1, limit };
}

/** Standard 429 body for an exhausted research quota. */
export function quotaExceededBody(q: QuotaResult) {
  return {
    error: `Daily research limit reached (${q.limit}/day for this shop). It resets at 00:00 UTC.`,
    code: "research_quota_exceeded" as const,
    used: q.used,
    limit: q.limit,
  };
}

const DEFAULT_FITTING_LIMIT = 30;

/**
 * Per-shop daily cap on paid Fitting Room renders (fal/FASHN cost real money).
 * Same fixed-UTC-day KV counter as research, on its own key. Tune with
 * FITTING_DAILY_LIMIT. Only reserve right before an actual upstream render.
 */
export async function reserveFittingQuota(c: Context<AppContext>): Promise<QuotaResult> {
  const raw = c.env.FITTING_DAILY_LIMIT;
  const parsed = raw ? parseInt(raw, 10) : NaN;
  const limit = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_FITTING_LIMIT;
  const day = new Date().toISOString().slice(0, 10);
  const key = `aiq:${c.var.shopId}:fitting:${day}`;
  const used = parseInt((await c.env.KV.get(key)) ?? "0", 10);
  if (used >= limit) return { ok: false, used, limit };
  await c.env.KV.put(key, String(used + 1), { expirationTtl: 172800 });
  return { ok: true, used: used + 1, limit };
}

export function fittingQuotaExceededBody(q: QuotaResult) {
  return {
    error: `Daily render limit reached (${q.limit}/day for this shop). It resets at 00:00 UTC.`,
    code: "fitting_quota_exceeded" as const,
    used: q.used,
    limit: q.limit,
  };
}
