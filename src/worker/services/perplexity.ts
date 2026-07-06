/**
 * Perplexity deep research. Used to source real garment makers (tailors,
 * ateliers, small factories) with live web search + citations. Platform key:
 * every shop gets it, degrades to a clear "not configured" when absent.
 */
import type { Env } from "../types/env";

export function perplexityConfigured(env: Env): boolean {
  return Boolean(env.PERPLEXITY_API_KEY);
}

export interface ResearchResult {
  text: string;
  citations: string[];
}

export async function perplexityResearch(
  env: Env,
  opts: { system: string; prompt: string; maxTokens?: number },
): Promise<ResearchResult> {
  if (!env.PERPLEXITY_API_KEY) throw new Error("Perplexity is not configured.");
  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.PERPLEXITY_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "sonar-pro",
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.prompt },
      ],
      max_tokens: opts.maxTokens ?? 1800,
      temperature: 0.2,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Perplexity ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    citations?: string[];
    search_results?: { url?: string }[];
  };
  const text = data.choices?.[0]?.message?.content ?? "";
  const citations =
    data.citations ?? (data.search_results ?? []).map((s) => s.url ?? "").filter(Boolean);
  return { text, citations };
}
