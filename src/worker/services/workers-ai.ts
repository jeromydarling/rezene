import type { Env } from "../types/env";

/**
 * Workers AI chat helper with a model fallback chain. Cloudflare retires
 * models over time (llama-3.1-8b died 2026-05-30 and took translations
 * with it), so callers get "newest model that still exists" semantics:
 * deprecated/missing models are skipped and the first working one is
 * remembered for the isolate's lifetime.
 */

export const CHAT_MODELS = [
  "@cf/meta/llama-4-scout-17b-16e-instruct",
  "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  "@cf/meta/llama-3.1-8b-instruct-fast",
  "@cf/meta/llama-3.1-8b-instruct",
];
let workingModelIndex = 0;

/** Why the most recent call failed (surfaced to admins in diagnostics). */
export let lastWorkersAiError: string | null = null;

function isModelGoneError(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("deprecated") || m.includes("no such model") || m.includes("not found");
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Pull the generated text out of a Workers AI result. The `.run()` return
 * shape has drifted across model generations — classic text models return
 * `{ response: string }`, but newer instruct models (llama-4-scout,
 * llama-3.3-70b) can wrap it as `{ response: { response } }`, an OpenAI-style
 * `{ choices: [{ message: { content } }] }`, or a `{ result: { response } }`.
 * Try each known shape rather than assuming one, so a shape change degrades to
 * "empty" (and a diagnostic) instead of throwing.
 */
function extractText(result: unknown): string {
  if (typeof result === "string") return result;
  if (!result || typeof result !== "object") return "";
  const r = result as Record<string, unknown>;
  if (typeof r.response === "string") return r.response;
  const resp = r.response as Record<string, unknown> | undefined;
  if (resp && typeof resp === "object") {
    if (typeof resp.response === "string") return resp.response;
    if (typeof resp.text === "string") return resp.text;
  }
  const res = r.result as Record<string, unknown> | undefined;
  if (res && typeof res.response === "string") return res.response;
  const choices = r.choices as { message?: { content?: unknown } }[] | undefined;
  if (Array.isArray(choices) && typeof choices[0]?.message?.content === "string") {
    return choices[0].message!.content as string;
  }
  return "";
}

export async function runWorkersAiChat(
  env: Env,
  messages: ChatMessage[],
  { maxTokens = 2048 } = {},
): Promise<string | null> {
  if (!env.AI) {
    lastWorkersAiError = "AI binding is not available on this deployment";
    return null;
  }
  for (let i = workingModelIndex; i < CHAT_MODELS.length; i++) {
    try {
      const result = await env.AI.run(CHAT_MODELS[i], { messages, max_tokens: maxTokens });
      const text = extractText(result).trim();
      if (!text) {
        lastWorkersAiError = `Model returned an unrecognized/empty response (${JSON.stringify(result).slice(0, 240)})`;
        return null;
      }
      workingModelIndex = i;
      return text;
    } catch (err) {
      const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      lastWorkersAiError = message;
      console.error(`[workers-ai] ${CHAT_MODELS[i]} failed:`, message);
      if (!isModelGoneError(message)) return null; // real failure — don't spray retries
    }
  }
  return null;
}
