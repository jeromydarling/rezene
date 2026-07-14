import type { Env } from "../types/env";

/**
 * AI usage ledger writer. Every AI/external-model call best-effort logs one row
 * to the PLATFORM D1 (`env.DB`) so Verto HQ can read the whole fleet's spend in
 * one query. Fire-and-forget: mirrors recordActivationEvent — wrapped in
 * try/catch, never throws, never blocks the response.
 *
 * Cost is an ESTIMATE from the price table below (USD). Token/unit counts are
 * exact; cost is 0 where a model's price isn't listed. Prices are rough public
 * figures — edit `MODEL_PRICES` as they change; the HQ page labels cost
 * "estimated".
 */

/** Optional call context threaded from the request/handler for attribution. */
export interface UsageContext {
  shopId?: string | null;
  operation?: string;
}

export interface AiUsageEntry {
  shopId?: string | null;
  provider: string;
  model: string;
  operation?: string | null;
  tokensIn?: number;
  tokensOut?: number;
  units?: number;
}

/** USD per 1,000,000 tokens (in/out), matched by substring on the model id. */
const TOKEN_PRICES: { match: RegExp; inPerM: number; outPerM: number }[] = [
  { match: /opus/i, inPerM: 15, outPerM: 75 },
  { match: /haiku/i, inPerM: 0.8, outPerM: 4 },
  { match: /sonnet|claude/i, inPerM: 3, outPerM: 15 }, // default Claude tier
  { match: /sonar/i, inPerM: 3, outPerM: 15 }, // Perplexity sonar-pro (approx)
  // Workers AI (Llama) is billed per-neuron, not per-token — treat as included.
  { match: /llama|@cf\//i, inPerM: 0, outPerM: 0 },
];

/** USD per image/unit, matched by substring on the model id. */
const UNIT_PRICES: { match: RegExp; perUnit: number }[] = [
  { match: /flux|@cf\//i, perUnit: 0 }, // Workers AI images — included
  { match: /fashn|tryon/i, perUnit: 0.075 },
  { match: /nano-banana|fal-ai/i, perUnit: 0.05 },
  { match: /soul|higgsfield/i, perUnit: 0.1 },
];

/** Estimated cost in USD cents for a usage entry. */
export function estimateCostCents(e: AiUsageEntry): number {
  let usd = 0;
  const tp = TOKEN_PRICES.find((p) => p.match.test(e.model));
  if (tp) usd += ((e.tokensIn ?? 0) / 1e6) * tp.inPerM + ((e.tokensOut ?? 0) / 1e6) * tp.outPerM;
  if (e.units) {
    const up = UNIT_PRICES.find((p) => p.match.test(e.model));
    if (up) usd += e.units * up.perUnit;
  }
  return Math.round(usd * 100 * 1e4) / 1e4; // cents, 4dp
}

export async function recordAiUsage(env: Env, entry: AiUsageEntry): Promise<void> {
  try {
    const cost = estimateCostCents(entry);
    await env.DB.prepare(
      `INSERT INTO ai_usage (shop_id, provider, model, operation, tokens_in, tokens_out, units, cost_cents)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        entry.shopId ?? null,
        entry.provider,
        entry.model.slice(0, 120),
        (entry.operation ?? null) && String(entry.operation).slice(0, 80),
        Math.max(0, Math.round(entry.tokensIn ?? 0)),
        Math.max(0, Math.round(entry.tokensOut ?? 0)),
        Math.max(0, Math.round(entry.units ?? 0)),
        cost,
      )
      .run();
  } catch {
    /* analytics must never break a call */
  }
}
