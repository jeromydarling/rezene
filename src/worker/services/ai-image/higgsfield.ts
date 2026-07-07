/**
 * Higgsfield adapter. Two capabilities on one key:
 *   • generate (text only)   → Soul (documented, stable).
 *   • referenceGen + tryOn   → nano-banana / Seedream style image EDITING.
 *
 * The edit path is SELF-TUNING. Higgsfield's public docs only publish a handful
 * of model_ids (Soul t2i, DoP video); the image-EDIT model_id that does try-on
 * isn't documented. But the platform is a fal.ai-compatible gateway — its slugs
 * mirror fal's exactly, minus the `fal-ai/` namespace prefix (confirmed by the
 * docs: `bytedance/seedance/v1/pro/image-to-video`, `kling-video/v2.1/pro/…`,
 * `reve/text-to-image` are all fal slugs with `fal-ai/` stripped). So the edit
 * models are fal's edit slugs (`fal-ai/nano-banana/edit`, `…/seedream/v4.5/edit`)
 * with the prefix dropped and the vendor namespace kept. On the first edit call
 * we probe the candidate list, keep whichever the account accepts, cache it in
 * KV, and after that it's a direct call. A 404 means "wrong path, try the next";
 * any other status means we hit a real model (so the error is about the body,
 * auth, or quota) and we surface it immediately instead of masking it.
 *
 * Body shape follows fal's edit contract (mirrored by the gateway): a top-level
 * `prompt` plus an `image_urls` array of public URLs. Higgsfield fetches the
 * URLs itself; it can't take raw bytes.
 *
 * Contract per docs.higgsfield.ai: base platform.higgsfield.ai, auth
 * `Authorization: Key <id>:<secret>`, submit → poll status_url → images[0].url.
 */
import type { Env } from "../../types/env";
import type { GenerateInput, ImageInput, ImageProvider, ImageResult, TryOnInput } from "./types";
import { ProviderError } from "./types";

const BASE = "https://platform.higgsfield.ai";
const SOUL = "higgsfield-ai/soul/standard";
const MAX_POLLS = 45;
const POLL_MS = 1300;

// Candidate edit model_ids, best try-on quality first. Higgsfield's REST slugs
// name the task in FULL — the confirmed ones are `…/text-to-image` and
// `…/image-to-video`, never fal's terse `/edit`. So the edit task is almost
// certainly `…/image-to-image`. The app records nano-banana as `nano_banana_2`,
// so we try both the hyphenated `nano-banana-2` and the `google/` vendor
// namespace, plus Seedream (instruction editing) and a fal-style `/edit` tail
// as a long-shot. The first the account accepts wins and is cached; a miss is a
// fast 404 (no polling), so a wide list is cheap.
const EDIT_CANDIDATES = [
  // image-to-image task naming (matches Higgsfield's confirmed convention)
  "nano-banana-2/image-to-image",
  "google/nano-banana-2/image-to-image",
  "higgsfield-ai/nano-banana-2/image-to-image",
  "nano-banana/image-to-image",
  "google/nano-banana/image-to-image",
  "nano-banana-pro/image-to-image",
  "google/nano-banana-pro/image-to-image",
  "bytedance/seedream/v4.5/image-to-image",
  "bytedance/seedream/v4/image-to-image",
  "reve/image-to-image",
  // fal-style `/edit` tail — long-shots, in case the gateway mirrors fal exactly
  "nano-banana/edit",
  "google/nano-banana-pro/edit",
  "bytedance/seedream/v4.5/edit",
  "flux-pro/kontext/max/multi",
];
const KV_EDIT_MODEL = "hf:edit_model";

/** Carries the raw HTTP status so runEdit can tell "wrong path" (404) from a
 *  real model rejecting the request (422/400/etc.). */
class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly detail: string,
    readonly model: string,
  ) {
    super(`Higgsfield ${model} ${status}: ${detail}`);
  }
}

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
      const statusUrl = await submitOrThrow(env, SOUL, body);
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
  const body = { prompt: prompt.slice(0, 2000), image_urls: imageUrls };

  const cached = await env.KV.get(KV_EDIT_MODEL).catch(() => null);
  const order = cached ? [cached, ...EDIT_CANDIDATES.filter((c) => c !== cached)] : EDIT_CANDIDATES;

  let notFound = 0;
  for (const model of order) {
    try {
      const statusUrl = await submit(env, model, body);
      // Worked → remember it (30-day TTL) and finish.
      if (model !== cached) console.log(`[higgsfield] edit model locked: ${model}`);
      await env.KV.put(KV_EDIT_MODEL, model, { expirationTtl: 60 * 60 * 24 * 30 }).catch(() => {});
      return { url: await poll(env, statusUrl), model };
    } catch (err) {
      if (err instanceof HttpError && err.status === 404) {
        // Wrong path — this model_id doesn't exist. Try the next candidate.
        notFound++;
        // A stale KV entry (model retired) shouldn't wedge us — clear and continue.
        if (model === cached) await env.KV.delete(KV_EDIT_MODEL).catch(() => {});
        continue;
      }
      // Anything else (422 bad body, 401 auth, 429 quota, 5xx) means we reached a
      // real model. Surface it — masking it would just retry the same failure.
      if (err instanceof HttpError) {
        throw new ProviderError(err.message, err.status === 429 ? 429 : 502);
      }
      throw err;
    }
  }
  throw new ProviderError(
    `Higgsfield edit: none of ${notFound} candidate model_ids exist on this account.`,
    502,
  );
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
    throw new HttpError(res.status, d, model);
  }
  const { status_url } = (await res.json()) as { status_url?: string };
  if (!status_url) throw new ProviderError("Higgsfield returned no status URL.");
  return status_url;
}

/** submit() for the single-model paths (Soul), normalising HttpError → ProviderError. */
async function submitOrThrow(env: Env, model: string, body: unknown): Promise<string> {
  try {
    return await submit(env, model, body);
  } catch (err) {
    if (err instanceof HttpError) throw new ProviderError(err.message, err.status === 429 ? 429 : 502);
    throw err;
  }
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
