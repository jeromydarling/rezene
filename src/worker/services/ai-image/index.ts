/**
 * Provider router for the Fitting Room. Registers every backend and picks the
 * best configured one for each capability, so the feature is always as good as
 * the keys allow and never crashes when a key is missing.
 *
 * Preference order (best first):
 *   generate     : fal → higgsfield → workers-ai
 *   referenceGen : fal → workers-ai   (higgsfield's edit API isn't public)
 *   tryOn        : fal → fashn        (higgsfield has no try-on)
 */
import type { Env } from "../../types/env";
import type { GenerateInput, ImageProvider, ImageResult, TryOnInput } from "./types";
import { NoProviderError } from "./types";
import { falProvider } from "./fal";
import { fashnProvider } from "./fashn";
import { higgsfieldProvider } from "./higgsfield";
import { workersAiProvider } from "./workers-ai";

// Higgsfield sits ahead of on-platform FLUX for plain generation (Soul is
// nicer) but only fal does reference-conditioned generation among the paid
// options, so it stays out of the referenceGen path.
const GENERATE_ORDER: ImageProvider[] = [falProvider, higgsfieldProvider, workersAiProvider];
const TRYON_ORDER: ImageProvider[] = [falProvider, fashnProvider];

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

export async function generateLook(env: Env, input: GenerateInput): Promise<ImageResult[]> {
  const cap = (input.references?.length ?? 0) > 0 ? "referenceGen" : "generate";
  const provider = pick(env, GENERATE_ORDER, cap);
  if (!provider?.generate) throw new NoProviderError(cap);
  return provider.generate(env, input);
}

export async function tryOnGarment(env: Env, input: TryOnInput): Promise<ImageResult> {
  const provider = pick(env, TRYON_ORDER, "tryOn");
  if (!provider?.tryOn) throw new NoProviderError("try-on");
  return provider.tryOn(env, input);
}

export * from "./types";
