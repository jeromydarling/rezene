/**
 * fal.ai adapter — the Fitting Room's primary engine. One key unlocks both:
 *   • Virtual try-on   — FASHN model on fal (garment photo → on a model)
 *   • Reference generation — nano-banana (Gemini image) editing/generation,
 *     the best-in-class path for "make this garment in the style of my mood board"
 *
 * fal jobs run ~8–17s, so we use the QUEUE API (submit → poll status → fetch
 * result) rather than the sync endpoint, and cap the inline poll well under
 * Cloudflare's ~100s edge budget. Images are passed inline as data URIs, so we
 * never touch fal's storage-upload flow. (A webhook callback would be even
 * lighter, but bounded polling keeps the request/response UX simple and matches
 * the rest of the app.)
 */
import type { Env } from "../../types/env";
import type { GenerateInput, ImageInput, ImageProvider, ImageResult, TryOnInput } from "./types";
import { ProviderError } from "./types";

// Model ids are centralised so they're trivial to bump as fal ships newer ones.
const MODELS = {
  tryOn: "fal-ai/fashn/tryon/v1.6",
  // nano-banana (Gemini 2.5 Flash Image): text→image and, with image_urls,
  // reference-conditioned generation/editing — ideal for mood-board → garment.
  generate: "fal-ai/nano-banana",
  generateWithRefs: "fal-ai/nano-banana/edit",
} as const;

const FAL_QUEUE = "https://queue.fal.run";
const MAX_POLLS = 45;
const POLL_MS = 1300;

export const falProvider: ImageProvider = {
  id: "fal",
  label: "fal.ai (FASHN try-on · nano-banana)",
  capabilities: { generate: true, referenceGen: true, tryOn: true },
  configured: (env) => Boolean(env.FAL_KEY),

  async generate(env, input: GenerateInput): Promise<ImageResult[]> {
    const refs = input.references ?? [];
    const useRefs = refs.length > 0;
    const model = useRefs ? MODELS.generateWithRefs : MODELS.generate;
    const count = Math.min(Math.max(input.count ?? 1, 1), 4);

    const body: Record<string, unknown> = { prompt: input.prompt, num_images: count };
    if (input.aspectRatio) body.aspect_ratio = input.aspectRatio;
    if (useRefs) body.image_urls = await Promise.all(refs.map((r) => toDataUri(r)));

    const out = await falRun(env, model, body);
    const urls = extractImageUrls(out);
    if (urls.length === 0) throw new ProviderError("fal returned no image.");
    return Promise.all(
      urls.map(async (u) => ({ ...(await fetchImage(u)), providerModel: model })),
    );
  },

  async tryOn(env, input: TryOnInput): Promise<ImageResult> {
    const body = {
      model_image: await toDataUri(input.modelImage),
      garment_image: await toDataUri(input.garmentImage),
      category: input.category ?? "auto",
      mode: "quality",
      output_format: "png",
    };
    const out = await falRun(env, MODELS.tryOn, body);
    const urls = extractImageUrls(out);
    if (urls.length === 0) throw new ProviderError("Try-on returned no image.");
    return { ...(await fetchImage(urls[0])), providerModel: MODELS.tryOn };
  },
};

/** Submit to fal's queue, poll status to completion, then fetch the result. */
async function falRun(env: Env, model: string, body: unknown): Promise<unknown> {
  const auth = { Authorization: `Key ${env.FAL_KEY}` };
  const submit = await fetch(`${FAL_QUEUE}/${model}`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch((e: unknown) => {
    // fetch() rejects with an untyped TypeError (network reset, oversized body…)
    throw new ProviderError(`fal submit failed: ${e instanceof Error ? e.message : String(e)}`);
  });
  if (!submit.ok) {
    const detail = (await submit.text().catch(() => "")).slice(0, 300);
    throw new ProviderError(`fal ${submit.status}: ${detail}`, submit.status === 429 ? 429 : 502);
  }
  const handle = (await submit.json().catch(() => null)) as {
    status_url?: string;
    response_url?: string;
  } | null;
  const { status_url, response_url } = handle ?? {};
  if (!status_url || !response_url) throw new ProviderError("fal did not return a queue handle.");

  for (let i = 0; i < MAX_POLLS; i++) {
    await sleep(POLL_MS);
    const st = await fetch(status_url, { headers: auth }).catch(() => null);
    if (!st || !st.ok) continue;
    const { status } = (await st.json().catch(() => ({}))) as { status?: string };
    if (status === "COMPLETED") {
      const done = await fetch(response_url, { headers: auth }).catch((e: unknown) => {
        throw new ProviderError(`fal result fetch failed: ${e instanceof Error ? e.message : String(e)}`);
      });
      if (!done.ok) {
        const d = (await done.text().catch(() => "")).slice(0, 300);
        throw new ProviderError(`fal result ${done.status}: ${d}`);
      }
      return done.json().catch(() => {
        throw new ProviderError("fal returned an unreadable result.");
      });
    }
    // IN_QUEUE / IN_PROGRESS → keep polling. Any FAILED-like state falls through.
    if (status && status !== "IN_QUEUE" && status !== "IN_PROGRESS") {
      throw new ProviderError(`fal job ${status}.`);
    }
  }
  throw new ProviderError("fal job timed out.", 504);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** fal outputs `{ images: [{ url }] }` or `{ image: { url } }` — normalise. */
function extractImageUrls(out: unknown): string[] {
  const o = out as { images?: { url?: string }[]; image?: { url?: string } };
  if (Array.isArray(o.images)) return o.images.map((i) => i.url ?? "").filter(Boolean);
  if (o.image?.url) return [o.image.url];
  return [];
}

async function fetchImage(url: string): Promise<{ bytes: Uint8Array; contentType: string }> {
  const res = await fetch(url).catch((e: unknown) => {
    throw new ProviderError(`Couldn't fetch fal result image: ${e instanceof Error ? e.message : String(e)}`);
  });
  if (!res.ok) throw new ProviderError(`Couldn't fetch fal result image (${res.status}).`);
  const contentType = res.headers.get("content-type") || "image/jpeg";
  return { bytes: new Uint8Array(await res.arrayBuffer()), contentType };
}

async function toDataUri(img: ImageInput): Promise<string> {
  if (img.kind === "url") return img.url; // fal accepts public URLs directly
  const b64 = base64(img.bytes);
  return `data:${img.contentType};base64,${b64}`;
}

function base64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
