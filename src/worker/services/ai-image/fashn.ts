/**
 * FASHN direct adapter — alternative virtual try-on provider when fal isn't
 * configured. FASHN is async: POST /run returns an id, then you poll /status
 * until `completed`. Try-on typically finishes in ~7–15s, so we poll a handful
 * of times with a short delay (awaiting fetch doesn't consume Worker CPU).
 */
import type { ImageInput, ImageProvider, ImageResult, TryOnInput } from "./types";
import { ProviderError } from "./types";

const BASE = "https://api.fashn.ai/v1";
const MODEL = "tryon-v1.6";
const MAX_POLLS = 30;
const POLL_MS = 1500;

export const fashnProvider: ImageProvider = {
  id: "fashn",
  label: "FASHN (virtual try-on)",
  capabilities: { generate: false, referenceGen: false, tryOn: true },
  configured: (env) => Boolean(env.FASHN_API_KEY),

  async tryOn(env, input: TryOnInput): Promise<ImageResult> {
    const runRes = await fetch(`${BASE}/run`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.FASHN_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model_name: MODEL,
        inputs: {
          model_image: await toImageRef(input.modelImage),
          garment_image: await toImageRef(input.garmentImage),
          category: input.category ?? "auto",
        },
      }),
    });
    if (!runRes.ok) {
      const d = (await runRes.text().catch(() => "")).slice(0, 300);
      throw new ProviderError(`FASHN ${runRes.status}: ${d}`, runRes.status === 429 ? 429 : 502);
    }
    const { id, error } = (await runRes.json()) as { id?: string; error?: string };
    if (error) throw new ProviderError(`FASHN: ${error}`);
    if (!id) throw new ProviderError("FASHN returned no job id.");

    for (let i = 0; i < MAX_POLLS; i++) {
      await sleep(POLL_MS);
      const st = await fetch(`${BASE}/status/${id}`, {
        headers: { Authorization: `Bearer ${env.FASHN_API_KEY}` },
      });
      if (!st.ok) continue;
      const data = (await st.json()) as { status?: string; output?: string[]; error?: string | null };
      if (data.status === "completed") {
        const url = data.output?.[0];
        if (!url) throw new ProviderError("FASHN completed with no output.");
        return { ...(await fetchImage(url)), providerModel: MODEL };
      }
      if (data.status === "failed") throw new ProviderError(`FASHN failed: ${data.error ?? "unknown"}`);
    }
    throw new ProviderError("FASHN try-on timed out.", 504);
  },
};

/** FASHN accepts a public URL or a base64 data URI in the image inputs. */
async function toImageRef(img: ImageInput): Promise<string> {
  if (img.kind === "url") return img.url;
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < img.bytes.length; i += chunk) {
    binary += String.fromCharCode(...img.bytes.subarray(i, i + chunk));
  }
  return `data:${img.contentType};base64,${btoa(binary)}`;
}

async function fetchImage(url: string): Promise<{ bytes: Uint8Array; contentType: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new ProviderError(`Couldn't fetch FASHN result (${res.status}).`);
  return {
    bytes: new Uint8Array(await res.arrayBuffer()),
    contentType: res.headers.get("content-type") || "image/png",
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
