/**
 * Native image generation via Cloudflare Workers AI (Flux). Zero external keys:
 * every shop gets the same engine on the platform. Like the chat models,
 * Cloudflare retires image models over time, so we try a small chain and use
 * the first that answers.
 */
import type { Env } from "../types/env";

const FLUX_MODELS = [
  "@cf/black-forest-labs/flux-1-schnell",
] as const;

export class FluxUnavailableError extends Error {
  constructor(detail?: string) {
    super(detail ? `Image generation is unavailable: ${detail}` : "Image generation is unavailable right now.");
  }
}

/** A random 31-bit seed (workerd has no Math.random restriction, but crypto is tidy). */
export function randomSeed(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % 2_000_000_000;
}

/**
 * Generate one image. Flux schnell returns a base64 JPEG in `image`. Returns
 * raw bytes ready for R2, plus the seed actually used.
 */
export async function generateFluxImage(
  env: Env,
  opts: { prompt: string; seed?: number; steps?: number },
): Promise<{ bytes: Uint8Array; seed: number; model: string }> {
  if (!env.AI) throw new FluxUnavailableError("no AI binding");
  const seed = opts.seed ?? randomSeed();
  const steps = Math.min(Math.max(opts.steps ?? 4, 1), 8);
  let lastErr = "";
  for (const model of FLUX_MODELS) {
    try {
      const res = (await env.AI.run(model, {
        prompt: opts.prompt.slice(0, 2000),
        seed,
        steps,
      })) as { image?: string } | Uint8Array | ReadableStream;
      const bytes = await toBytes(res);
      if (bytes && bytes.length > 0) return { bytes, seed, model };
      lastErr = "empty image";
    } catch (err) {
      lastErr = String(err).slice(0, 200);
      if (isRetired(lastErr)) continue;
      throw new FluxUnavailableError(lastErr);
    }
  }
  throw new FluxUnavailableError(lastErr);
}

function isRetired(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes("no such model") || m.includes("not found") || m.includes("deprecated");
}

async function toBytes(res: unknown): Promise<Uint8Array | null> {
  if (res instanceof Uint8Array) return res;
  if (res instanceof ReadableStream) {
    const reader = res.getReader();
    const chunks: Uint8Array[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    const total = chunks.reduce((n, c) => n + c.length, 0);
    const out = new Uint8Array(total);
    let o = 0;
    for (const c of chunks) {
      out.set(c, o);
      o += c.length;
    }
    return out;
  }
  if (res && typeof res === "object" && "image" in res && typeof (res as { image: string }).image === "string") {
    return base64ToBytes((res as { image: string }).image);
  }
  return null;
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
