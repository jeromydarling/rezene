/**
 * Provider router for the Fitting Room. Registers every backend and picks the
 * best configured one for each capability, so the feature is always as good as
 * the keys allow and never crashes when a key is missing.
 *
 * Preference order (best first):
 *   generate     : fal → higgsfield → workers-ai
 *   referenceGen : fal → higgsfield → workers-ai
 *   tryOn        : fal → fashn → higgsfield  (higgsfield self-tunes its edit model)
 */
import type { Env } from "../../types/env";
import type { GenerateInput, ImageProvider, ImageResult, TryOnInput } from "./types";
import { NoProviderError, ProviderError } from "./types";
import { falProvider } from "./fal";
import { fashnProvider } from "./fashn";
import { higgsfieldProvider } from "./higgsfield";
import { workersAiProvider } from "./workers-ai";

// Higgsfield sits ahead of on-platform FLUX for generation and now offers a
// self-tuning image-edit path, so it also backs reference generation + try-on
// (after fal/FASHN, which have fully-documented contracts).
const GENERATE_ORDER: ImageProvider[] = [falProvider, higgsfieldProvider, workersAiProvider];
const TRYON_ORDER: ImageProvider[] = [falProvider, fashnProvider, higgsfieldProvider];

function pick(env: Env, order: ImageProvider[], cap: "generate" | "referenceGen" | "tryOn"): ImageProvider | null {
  return order.find((p) => p.capabilities[cap] && p.configured(env)) ?? null;
}

export interface FittingCapabilities {
  generate: { available: boolean; provider: string | null };
  referenceGen: { available: boolean; provider: string | null };
  tryOn: { available: boolean; provider: string | null };
}

/** What the Fitting Room can do given the current keys — surfaced to the UI. */
export function fittingCapabilities(env: Env): FittingCapabilities {
  const g = pick(env, GENERATE_ORDER, "generate");
  const r = pick(env, GENERATE_ORDER, "referenceGen");
  const t = pick(env, TRYON_ORDER, "tryOn");
  return {
    generate: { available: Boolean(g), provider: g?.label ?? null },
    referenceGen: { available: Boolean(r), provider: r?.label ?? null },
    tryOn: { available: Boolean(t), provider: t?.label ?? null },
  };
}

/**
 * Run through the eligible providers best-first, falling through to the next on
 * failure. This is what makes the layer resilient: if a configured provider is
 * momentarily down — or rejects an input — we still serve the result from the
 * next one instead of erroring the whole request.
 */
async function cascade<T>(
  env: Env,
  order: ImageProvider[],
  cap: "generate" | "referenceGen" | "tryOn",
  run: (p: ImageProvider) => Promise<T>,
): Promise<T> {
  const eligible = order.filter((p) => p.capabilities[cap] && p.configured(env));
  if (eligible.length === 0) throw new NoProviderError(cap);
  const failures: { id: string; err: unknown }[] = [];
  for (const p of eligible) {
    try {
      return await run(p);
    } catch (err) {
      // Every provider failure goes to Workers Logs — without this, a cascade
      // that ends in a fallback's error leaves no trace of the primary's.
      console.error(`[ai-image] ${p.id} ${cap} failed:`, err instanceof Error ? `${err.name}: ${err.message}` : err);
      failures.push({ id: p.id, err });
    }
  }
  // Rethrowing only the LAST error hides the primary provider's (usually the
  // informative) failure behind whatever a fallback said — combine them all.
  const detail = failures
    .map(({ id, err }) => `${id}: ${err instanceof Error ? err.message : String(err)}`)
    .join(" · ");
  const firstTyped = failures.find((f) => f.err instanceof ProviderError)?.err as ProviderError | undefined;
  throw new ProviderError(detail || `All ${cap} providers failed.`, firstTyped?.status ?? 502);
}

export async function generateLook(env: Env, input: GenerateInput): Promise<ImageResult[]> {
  const cap = (input.references?.length ?? 0) > 0 ? "referenceGen" : "generate";
  return cascade(env, GENERATE_ORDER, cap, (p) => p.generate!(env, input));
}

export async function tryOnGarment(env: Env, input: TryOnInput): Promise<ImageResult> {
  return cascade(env, TRYON_ORDER, "tryOn", (p) => p.tryOn!(env, input));
}

export * from "./types";
