/**
 * On-platform fallback provider — Cloudflare Workers AI FLUX. Zero external
 * keys, always available. Handles generation (including reference-conditioned
 * generation via FLUX.2), but NOT try-on. Quality is a notch below fal's
 * nano-banana / FLUX.2-pro, so the router prefers fal when configured.
 */
import type { GenerateInput, ImageInput, ImageProvider, ImageResult } from "./types";
import { ProviderError } from "./types";

async function toBytes(img: ImageInput): Promise<Uint8Array> {
  if (img.kind === "bytes") return img.bytes;
  const res = await fetch(img.url);
  if (!res.ok) throw new ProviderError(`Couldn't fetch reference image (${res.status}).`);
  return new Uint8Array(await res.arrayBuffer());
}

export const workersAiProvider: ImageProvider = {
  id: "workers-ai",
  label: "On-platform (Cloudflare FLUX)",
  capabilities: { generate: true, referenceGen: true, tryOn: false },
  configured: (env) => Boolean(env.AI),

  async generate(env, input: GenerateInput): Promise<ImageResult[]> {
    const { generateFluxImage, generateFluxWithReferences, randomSeed, FluxUnavailableError } = await import(
      "../flux"
    );
    const count = Math.min(Math.max(input.count ?? 1, 1), 4);
    const refs: Uint8Array[] = [];
    for (const r of (input.references ?? []).slice(0, 4)) refs.push(await toBytes(r));
    const useRefs = refs.length > 0;
    const out: ImageResult[] = [];
    try {
      for (let i = 0; i < count; i++) {
        const seed = randomSeed();
        const { bytes, model } = useRefs
          ? await generateFluxWithReferences(env, { prompt: input.prompt, references: refs, seed })
          : await generateFluxImage(env, { prompt: input.prompt, seed });
        out.push({ bytes, contentType: "image/jpeg", providerModel: model });
      }
    } catch (err) {
      if (out.length === 0) {
        const msg = err instanceof FluxUnavailableError ? err.message : "Image generation failed.";
        throw new ProviderError(msg, 503);
      }
      // Partial success — return what we have.
    }
    return out;
  },
};
