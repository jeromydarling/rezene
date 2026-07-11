import type { Env } from "../types/env";

/**
 * Server-side Anthropic client (raw fetch — no SDK dependency needed in
 * Workers). The API key never leaves the Worker. Structured outputs are
 * requested as JSON and parsed defensively.
 *
 * To add Cloudflare AI Gateway later, point BASE_URL at the gateway
 * endpoint (https://gateway.ai.cloudflare.com/v1/<account>/<gateway>/anthropic)
 * — the request/response shape is unchanged.
 */

const BASE_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-sonnet-5";
const ANTHROPIC_VERSION = "2023-06-01";

export class AnthropicNotConfiguredError extends Error {
  constructor() {
    super("ANTHROPIC_API_KEY is not configured");
  }
}

export interface ClaudeResult {
  text: string;
  tokensIn: number;
  tokensOut: number;
  model: string;
}

export async function askClaude(
  env: Env,
  opts: {
    system: string;
    prompt: string;
    maxTokens?: number;
    model?: string;
    /** Optional image for vision tasks (sketch/photo → tech pack). */
    image?: { base64: string; mediaType: string };
    /** Several images (front + side photos, contact sheets). Wins over `image`. */
    images?: { base64: string; mediaType: string }[];
  },
): Promise<ClaudeResult> {
  if (!env.ANTHROPIC_API_KEY) throw new AnthropicNotConfiguredError();
  const model = opts.model ?? DEFAULT_MODEL;
  const imgs = opts.images ?? (opts.image ? [opts.image] : []);
  const content: unknown[] = [
    ...imgs.map((im) => ({
      type: "image",
      source: { type: "base64", media_type: im.mediaType, data: im.base64 },
    })),
    { type: "text", text: opts.prompt },
  ];
  const res = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model,
      max_tokens: opts.maxTokens ?? 2048,
      system: opts.system,
      messages: [{ role: "user", content }],
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Anthropic API error ${res.status}: ${detail.slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    content: { type: string; text?: string }[];
    usage?: { input_tokens?: number; output_tokens?: number };
    model?: string;
  };
  const text = data.content
    .filter((c) => c.type === "text" && c.text)
    .map((c) => c.text)
    .join("\n");
  return {
    text,
    tokensIn: data.usage?.input_tokens ?? 0,
    tokensOut: data.usage?.output_tokens ?? 0,
    model: data.model ?? model,
  };
}

/** Extract the first JSON object/array from a model response. */
export function parseModelJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(trimmed);
  const candidate = fenced ? fenced[1] : trimmed;
  const start = candidate.search(/[[{]/);
  if (start === -1) throw new Error("Model response contained no JSON");
  // Fast path: the whole tail is valid JSON.
  try {
    return JSON.parse(candidate.slice(start));
  } catch {
    /* fall through to balanced extraction */
  }
  // Balanced-bracket scan: pull out just the first complete JSON value, so
  // trailing prose (e.g. Perplexity appending notes/sources after the closing
  // brace) doesn't sink an otherwise-valid object.
  const open = candidate[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(candidate.slice(start, i + 1));
        } catch {
          throw new Error("Model response was not valid JSON");
        }
      }
    }
  }
  throw new Error("Model response was not valid JSON");
}
