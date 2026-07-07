/**
 * Higgsfield adapter. Two capabilities on one key:
 *   • generate (text only)   → Soul (documented, stable).
 *   • referenceGen + tryOn   → nano-banana / Flux-Kontext style image EDITING.
 *
 * The edit path is SELF-TUNING. Higgsfield's public docs only publish the Soul
 * text-to-image model_id; the edit model_id (the one that does try-on) isn't
 * documented. So on the first edit call we probe a short list of candidate
 * model_ids, keep whichever the account accepts, and cache it in KV — after
 * that it's a direct call. If none work, we throw and the router cascades to
 * the next provider. Images are passed as public URLs (Higgsfield fetches them;
 * it can't take raw bytes), in the SDK's `input_images:[{type,image_url}]` shape.
 *
 * Contract per docs.higgsfield.ai + higgsfield-js SDK: base platform.higgsfield.ai,
 * auth `Authorization: Key <id>:<secret>`, submit → poll status_url → images[0].url.
 */
import type { Env } from "../../types/env";
import type { GenerateInput, ImageInput, ImageProvider, ImageResult, TryOnInput } from "./types";
import { ProviderError } from "./types";

const BASE = "https://platform.higgsfield.ai";
const SOUL = "higgsfield-ai/soul/standard";
const MAX_POLLS = 45;
const POLL_MS = 1300;

// Candidate edit model_ids, most-likely first. Flux Kontext's path family is
// confirmed by the SDK (`flux-pro/kontext/max/text-to-image`); the nano-banana
// / seedream ids are informed guesses. The first that the account accepts wins
// and is cached, so a miss just costs one extra rejected submit on first use.
const EDIT_CANDIDATES = [
  "flux-pro/kontext/max/multi",
  "flux-pro/kontext/max",
  "nano-banana/edit",
  "nano-banana-2/edit",
  "bytedance/seedream-v4-5",
  "seedream-v4-5/edit",
  "google/nano-banana-2",
];
const KV_EDIT_MODEL = "hf:edit_model";

export const higgsfieldProvider: ImageProvider = {
  id: "higgsfield",
  label: "Higgsfield (Soul · nano-banana)",
  capabilities: { generate: true, referenceGen: true, tryOn: true },
  configured: (env) => Boolean(env.HIGGSFIELD_API_KEY && env.HIGGSFIELD_API_KEY.includes(":")),

  async generate(env, input: GenerateInput): Promise<ImageResult[]> {
    const refs = input.references ?? [];
    // Mood board → reference-conditioned edit; else plain Soul text-to-image.
    if (refs.length > 0) {
      const urls = refs.map(publicUrl);
      const { url, model } = await runEdit(env, input.prompt, urls);
      return [{ ...(await fetchImage(url)), providerModel: model }];
    }
    const count = Math.min(Math.max(input.count ?? 1, 1), 4);
    const body = { prompt: input.prompt.slice(0, 2000), aspect_ratio: input.aspectRatio || "3:4", resolution: "2K" };
    const out: ImageResult[] = [];
    for (let i = 0; i < count; i++) {
      const statusUrl = await submit(env, SOUL, body);
      out.push({ ...(await fetchImage(await poll(env, statusUrl))), providerModel: SOUL });
    }
    return out;
  },

  async tryOn(env, input: TryOnInput): Promise<ImageResult> {
    const model = publicUrl(input.modelImage);
    const garment = publicUrl(input.garmentImage);
    const prompt =
      "Virtual try-on. Photorealistic full-body studio fashion photograph of the exact person in the first " +
      "reference image, wearing the garment shown in the second reference image. Keep the person's face, hair, " +
      "body, skin tone and pose identical to the first image; the garment should drape naturally and fit " +
      "realistically. Seamless studio background, soft even lighting, full body head to feet.";
    const { url, model: m } = await runEdit(env, prompt, [model, garment]);
    return { ...(await fetchImage(url)), providerModel: m };
  },
};

/** Higgsfield can only fetch a public URL — pull one off the ImageInput or fail. */
function publicUrl(img: ImageInput): string {
  if (img.kind === "url") return img.url;
  if (img.url) return img.url;
  throw new ProviderError("Higgsfield needs a public image URL (none available).");
}

/** Run an image-edit generation, discovering + caching the working model_id. */
async function runEdit(env: Env, prompt: string, imageUrls: string[]): Promise<{ url: string; model: string }> {
  const body = {
    prompt: prompt.slice(0, 2000),
    input_images: imageUrls.map((u) => ({ type: "image_url", image_url: u })),
  };

  const cached = await env.KV.get(KV_EDIT_MODEL).catch(() => null);
  const order = cached ? [cached, ...EDIT_CANDIDATES.filter((c) => c !== cached)] : EDIT_CANDIDATES;

  let lastErr: unknown;
  for (const model of order) {
    try {
      const statusUrl = await submit(env, model, body);
      // Worked → remember it (30-day TTL) and finish.
      if (model !== cached) console.log(`[higgsfield] edit model locked: ${model}`);
      await env.KV.put(KV_EDIT_MODEL, model, { expirationTtl: 60 * 60 * 24 * 30 }).catch(() => {});
      return { url: await poll(env, statusUrl), model };
    } catch (err) {
      lastErr = err;
      // A model-not-found / bad-path answer → try the next candidate. Any other
      // error (auth, quota) will recur for every candidate and surface below.
    }
  }
  throw lastErr instanceof ProviderError ? lastErr : new ProviderError("Higgsfield edit: no model accepted the request.");
}

async function submit(env: Env, model: string, body: unknown): Promise<string> {
  const res = await fetch(`${BASE}/${model}`, {
    method: "POST",
    headers: {
      Authorization: `Key ${env.HIGGSFIELD_API_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const d = (await res.text().catch(() => "")).slice(0, 200);
    throw new ProviderError(`Higgsfield ${model} ${res.status}: ${d}`, res.status === 429 ? 429 : 502);
  }
  const { status_url } = (await res.json()) as { status_url?: string };
  if (!status_url) throw new ProviderError("Higgsfield returned no status URL.");
  return status_url;
}

async function poll(env: Env, statusUrl: string): Promise<string> {
  const auth = { Authorization: `Key ${env.HIGGSFIELD_API_KEY}`, Accept: "application/json" };
  for (let i = 0; i < MAX_POLLS; i++) {
    await sleep(POLL_MS);
    const st = await fetch(statusUrl, { headers: auth });
    if (!st.ok) continue;
    const data = (await st.json()) as { status?: string; images?: { url?: string }[]; error?: string };
    if (data.status === "completed") {
      const url = data.images?.[0]?.url;
      if (!url) throw new ProviderError("Higgsfield completed with no image.");
      return url;
    }
    if (data.status === "failed") throw new ProviderError(`Higgsfield failed: ${data.error ?? "unknown"}`);
    if (data.status === "nsfw") throw new ProviderError("Higgsfield flagged the request (nsfw).");
  }
  throw new ProviderError("Higgsfield job timed out.", 504);
}

async function fetchImage(url: string): Promise<{ bytes: Uint8Array; contentType: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new ProviderError(`Couldn't fetch Higgsfield result (${res.status}).`);
  return {
    bytes: new Uint8Array(await res.arrayBuffer()),
    contentType: res.headers.get("content-type") || "image/jpeg",
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
