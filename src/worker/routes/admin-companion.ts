import { Hono } from "hono";
import type { Context } from "hono";
import { companionAnswer, AiUnavailableError, type CompanionTurn } from "../services/companion";
import { reserveCompanionQuota, companionQuotaExceededBody } from "../services/ai-quota";
import { all } from "../services/db";
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

/**
 * A compact, route-keyed snapshot of the shop's own data, so the companion
 * advises about THIS studio, not a hypothetical one — the price studies on
 * this desk, the boards on this wall. A few names each, never documents;
 * every query is optional (a failed one just means less context).
 */
async function shopContext(c: Context<AppContext>, route: string | null): Promise<string | null> {
  if (!route) return null;
  const lines: string[] = [];
  const tryRows = async (sql: string, fmt: (r: Record<string, unknown>) => string): Promise<string[]> => {
    try {
      const rows = await all<Record<string, unknown>>(c.var.db, sql);
      return rows.map(fmt);
    } catch {
      return [];
    }
  };
  if (route.startsWith("/admin/research/pricing") || route.startsWith("/admin/costing")) {
    const studies = await tryRows(
      `SELECT name, band_mid_cents FROM price_studies ORDER BY updated_at DESC LIMIT 5`,
      (r) => `${r.name}${r.band_mid_cents ? ` (band mid $${(Number(r.band_mid_cents) / 100).toFixed(0)})` : ""}`,
    );
    if (studies.length) lines.push(`Price studies: ${studies.join("; ")}.`);
  }
  if (route.startsWith("/admin/research")) {
    const boards = await tryRows(
      `SELECT title, season FROM trend_boards ORDER BY updated_at DESC LIMIT 5`,
      (r) => `${r.title}${r.season ? ` (${r.season})` : ""}`,
    );
    if (boards.length) lines.push(`Trend boards: ${boards.join("; ")}.`);
  }
  if (route.startsWith("/admin/ai-concepts")) {
    const concepts = await tryRows(
      `SELECT title FROM ai_concepts WHERE status != 'archived' ORDER BY created_at DESC LIMIT 5`,
      (r) => String(r.title),
    );
    if (concepts.length) lines.push(`Design concepts in progress: ${concepts.join("; ")}.`);
  }
  if (route.startsWith("/admin/clients") || route.startsWith("/admin/patterns") || route.startsWith("/admin/commissions")) {
    const clients = await tryRows(
      `SELECT COUNT(*) AS n FROM clients`,
      (r) => `${r.n} clients in the Client Book`,
    );
    if (clients.length) lines.push(`${clients[0]}.`);
  }
  return lines.length ? lines.join(" ") : null;
}

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

  const plain = body.plain === true;

  const quota = await reserveCompanionQuota(c);
  if (!quota.ok) return c.json(companionQuotaExceededBody(quota), 429);

  try {
    const context = await shopContext(c, route);
    const result = await companionAnswer(c.env, question, route, history, { plain, shopContext: context });
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
