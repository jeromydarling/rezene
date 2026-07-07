/**
 * Higgsfield adapter — a stopgap GENERATION engine (Soul) for the Fitting Room
 * until fal is funded. Soul is Higgsfield's photoreal text-to-image model, a
 * clear step up from on-platform FLUX for "generate a garment on a model".
 *
 * Scope note: Higgsfield's public REST API documents text-to-image + async
 * polling, but does NOT document an image-edit / multi-reference endpoint, so
 * we deliberately do NOT claim reference-generation or try-on here — those keep
 * flowing to their proper providers (FLUX for mood boards, fal/FASHN for
 * try-on). Contract per docs.higgsfield.ai (base platform.higgsfield.ai, auth
 * `Authorization: Key <id>:<secret>`, submit → poll status_url → images[0].url).
 */
import type { Env } from "../../types/env";
import type { GenerateInput, ImageProvider, ImageResult } from "./types";
import { ProviderError } from "./types";

const BASE = "https://platform.higgsfield.ai";
const SOUL = "higgsfield-ai/soul/standard";
const MAX_POLLS = 45;
const POLL_MS = 1300;

export const higgsfieldProvider: ImageProvider = {
  id: "higgsfield",
  label: "Higgsfield (Soul)",
  capabilities: { generate: true, referenceGen: false, tryOn: false },
  // Key is "KEY_ID:KEY_SECRET" — require the colon so a malformed key doesn't
  // advertise the provider as available.
  configured: (env) => Boolean(env.HIGGSFIELD_API_KEY && env.HIGGSFIELD_API_KEY.includes(":")),

  async generate(env, input: GenerateInput): Promise<ImageResult[]> {
    const count = Math.min(Math.max(input.count ?? 1, 1), 4);
    const body = {
      prompt: input.prompt.slice(0, 2000),
      aspect_ratio: input.aspectRatio || "3:4",
      resolution: "2K",
    };
    const out: ImageResult[] = [];
    for (let i = 0; i < count; i++) {
      const url = await runSoul(env, body);
      out.push({ ...(await fetchImage(url)), providerModel: SOUL });
    }
    return out;
  },
};

async function runSoul(env: Env, body: unknown): Promise<string> {
  const auth = { Authorization: `Key ${env.HIGGSFIELD_API_KEY}` };
  const submit = await fetch(`${BASE}/${SOUL}`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  if (!submit.ok) {
    const d = (await submit.text().catch(() => "")).slice(0, 300);
    throw new ProviderError(`Higgsfield ${submit.status}: ${d}`, submit.status === 429 ? 429 : 502);
  }
  const { status_url } = (await submit.json()) as { status_url?: string };
  if (!status_url) throw new ProviderError("Higgsfield did not return a status URL.");

  for (let i = 0; i < MAX_POLLS; i++) {
    await sleep(POLL_MS);
    const st = await fetch(status_url, { headers: { ...auth, Accept: "application/json" } });
    if (!st.ok) continue;
    const data = (await st.json()) as {
      status?: string;
      images?: { url?: string }[];
      error?: string;
    };
    if (data.status === "completed") {
      const url = data.images?.[0]?.url;
      if (!url) throw new ProviderError("Higgsfield completed with no image.");
      return url;
    }
    if (data.status === "failed") throw new ProviderError(`Higgsfield failed: ${data.error ?? "unknown"}`);
    if (data.status === "nsfw") throw new ProviderError("Higgsfield flagged the request (nsfw).");
    // queued / in_progress → keep polling.
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
