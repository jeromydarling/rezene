import { askClaude, AnthropicNotConfiguredError } from "./anthropic";
import { runWorkersAiChat } from "./workers-ai";
import type { UsageContext } from "./ai-usage";
import type { Env } from "../types/env";

/**
 * Provider-agnostic completion for AI features: uses the shop's own
 * Anthropic key when configured (best quality), otherwise falls back to
 * Workers AI Llama — "connect your own API or use Llama". Throws
 * AiUnavailableError only when neither provider can produce text.
 */

export class AiUnavailableError extends Error {
  constructor() {
    super("No AI provider is available (set ANTHROPIC_API_KEY, or Workers AI is unreachable)");
  }
}

export interface AiCompletion {
  text: string;
  provider: "anthropic" | "workers-ai";
}

export async function aiComplete(
  env: Env,
  opts: { system: string; prompt: string; maxTokens?: number; usage?: UsageContext },
): Promise<AiCompletion> {
  if (env.ANTHROPIC_API_KEY) {
    try {
      const result = await askClaude(env, { ...opts, usage: opts.usage });
      if (result.text.trim()) return { text: result.text, provider: "anthropic" };
    } catch (err) {
      if (!(err instanceof AnthropicNotConfiguredError)) {
        console.error("[ai] anthropic failed, trying workers-ai:", String(err).slice(0, 200));
      }
    }
  }
  const text = await runWorkersAiChat(
    env,
    [
      { role: "system", content: opts.system },
      { role: "user", content: opts.prompt },
    ],
    { maxTokens: opts.maxTokens ?? 2048, usage: opts.usage },
  );
  if (text) return { text, provider: "workers-ai" };
  throw new AiUnavailableError();
}
