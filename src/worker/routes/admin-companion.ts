import { Hono } from "hono";
import { companionAnswer, AiUnavailableError, type CompanionTurn } from "../services/companion";
import { reserveCompanionQuota, companionQuotaExceededBody } from "../services/ai-quota";
import type { AppContext } from "../types/env";

/**
 * The Verto Companion: one endpoint, stateless — the client carries the
 * conversation, the server retrieves from the school + KB corpus, answers
 * through the pluggable AI layer (the shop's Anthropic key when configured,
 * Workers AI Llama otherwise), and returns the citations it drew on.
 * Read-only by design: it advises and links; it never writes shop data,
 * which is also why the demo shop's viewer can talk to it freely.
 */
export const adminCompanionRoutes = new Hono<AppContext>();

adminCompanionRoutes.post("/ask", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const question = typeof body.question === "string" ? body.question.trim().slice(0, 2000) : "";
  if (!question) return c.json({ error: "Ask me something." }, 400);
  const route = typeof body.route === "string" ? body.route.slice(0, 200) : null;
  const history: CompanionTurn[] = Array.isArray(body.history)
    ? (body.history as CompanionTurn[])
        .filter((t) => t && (t.role === "user" || t.role === "assistant") && typeof t.content === "string")
        .slice(-8)
    : [];

  const quota = await reserveCompanionQuota(c);
  if (!quota.ok) return c.json(companionQuotaExceededBody(quota), 429);

  try {
    const result = await companionAnswer(c.env, question, route, history);
    return c.json({ ...result, remaining: quota.limit - quota.used });
  } catch (err) {
    if (err instanceof AiUnavailableError) {
      return c.json(
        { error: "The companion's voice isn't configured on this deployment yet — the Knowledge Base and the School still have the answers." },
        503,
      );
    }
    return c.json({ error: "The companion lost its train of thought — ask again." }, 500);
  }
});
