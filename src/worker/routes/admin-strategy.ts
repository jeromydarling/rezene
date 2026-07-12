import { Hono } from "hono";
import { all, first, run, writeAudit } from "../services/db";
import { requireAdminWrite } from "../middleware/auth";
import { reserveCompanionQuota, companionQuotaExceededBody } from "../services/ai-quota";
import { newId } from "../utils/id";
import { emit } from "../services/activity";
import { softDelete } from "../services/tombstone";
import { AiUnavailableError } from "../services/ai";
import { generateStrategy } from "../services/strategy";
import {
  strategyKindMeta,
  strategyPersonaMeta,
  strategyDocLabel,
  type StrategyContent,
  type StrategyKind,
  type StrategyVariant,
  type StrategyPersona,
} from "../../shared/strategy";
import type { AppContext } from "../types/env";

/**
 * Business Strategy — the R&D → Strategy room. Work with a Claude persona to
 * produce SWOT analyses, business plans, OKRs, and competitive analyses that
 * are grounded in the shop's own Brand Brain, then turn the resulting action
 * items into Production Calendar entries.
 *
 * Writes are gated with requireAdminWrite (demo shops stay read-only), each
 * generation draws from the shared Companion daily quota, and everything
 * degrades to Workers AI Llama when no Anthropic key is set.
 */
export const adminStrategyRoutes = new Hono<AppContext>();

interface StrategyRow {
  id: string;
  kind: string;
  variant: string | null;
  persona: string;
  title: string;
  brief: string | null;
  content_json: string | null;
  scheduled_json: string;
  status: string;
  provider: string | null;
  plain: number;
  created_at: string;
  updated_at: string;
}

function parseJson<T>(s: string | null, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

function serialize(row: StrategyRow) {
  return {
    id: row.id,
    kind: row.kind as StrategyKind,
    variant: (row.variant as StrategyVariant | null) ?? null,
    persona: row.persona as StrategyPersona,
    title: row.title,
    brief: row.brief,
    content: parseJson<StrategyContent | null>(row.content_json, null),
    scheduled: parseJson<number[]>(row.scheduled_json, []),
    status: row.status as "active" | "archived",
    provider: row.provider,
    plain: Boolean(row.plain),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// --- List --------------------------------------------------------------------

adminStrategyRoutes.get("/", async (c) => {
  const rows = await all<StrategyRow>(
    c.var.db,
    `SELECT * FROM strategy_docs ORDER BY (status = 'archived'), updated_at DESC LIMIT 60`,
  );
  return c.json(rows.map(serialize));
});

// --- Generate ----------------------------------------------------------------

adminStrategyRoutes.post("/generate", requireAdminWrite, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    kind?: string;
    variant?: string;
    persona?: string;
    brief?: string;
    plain?: boolean;
    provider?: string;
  };

  const kindMeta = strategyKindMeta(body.kind ?? "");
  if (!kindMeta) return c.json({ error: "Pick a strategy tool to run." }, 400);
  const kind = kindMeta.key;
  const variant: StrategyVariant | null =
    kind === "business_plan" ? (body.variant === "full" ? "full" : "lean") : null;
  const persona: StrategyPersona = strategyPersonaMeta(body.persona ?? "")?.key ?? kindMeta.defaultPersona;
  const plain = Boolean(body.plain);
  const brief = typeof body.brief === "string" ? body.brief.slice(0, 4000) : "";

  const quota = await reserveCompanionQuota(c);
  if (!quota.ok) return c.json(companionQuotaExceededBody(quota), 429);

  let generated;
  try {
    generated = await generateStrategy(c.env, c.var.db, {
      kind,
      variant,
      persona,
      brief,
      plain,
      forceProvider: body.provider === "workers-ai" ? "workers-ai" : undefined,
    });
  } catch (err) {
    if (err instanceof AiUnavailableError) {
      return c.json(
        { error: "Strategy needs an AI provider. Add the shop's Anthropic key in Settings → AI, and it works beautifully." },
        503,
      );
    }
    console.error("[strategy] generate failed:", String(err).slice(0, 300));
    return c.json({ error: "Couldn't draft that one — give it another go in a moment." }, 502);
  }

  const id = newId("strat");
  await run(
    c.var.db,
    `INSERT INTO strategy_docs (id, kind, variant, persona, title, brief, content_json, provider, plain)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    kind,
    variant,
    persona,
    generated.title,
    brief || null,
    JSON.stringify(generated.content),
    generated.provider,
    plain ? 1 : 0,
  );
  await writeAudit(c.var.db, c.var.userId, "strategy.create", "strategy_docs", id, { kind, variant, persona });
  await emit(c.var.db, {
    kind: "strategy.created",
    entityType: "strategy_doc",
    entityId: id,
    title: `${strategyDocLabel(kind, variant)} drafted — ${generated.title}`,
    payload: { kind, variant, title: generated.title },
  });

  const row = await first<StrategyRow>(c.var.db, `SELECT * FROM strategy_docs WHERE id = ?`, id);
  return c.json(serialize(row!), 201);
});

// --- Update (title / archive) ------------------------------------------------

adminStrategyRoutes.patch("/:id", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as { title?: string; status?: string };
  const sets: string[] = [];
  const args: unknown[] = [];
  if (typeof body.title === "string" && body.title.trim()) {
    sets.push("title = ?");
    args.push(body.title.trim().slice(0, 160));
  }
  if (body.status === "active" || body.status === "archived") {
    sets.push("status = ?");
    args.push(body.status);
  }
  if (!sets.length) return c.json({ error: "Nothing to update." }, 400);
  sets.push("updated_at = datetime('now')");
  args.push(id);
  await run(c.var.db, `UPDATE strategy_docs SET ${sets.join(", ")} WHERE id = ?`, ...args);
  const row = await first<StrategyRow>(c.var.db, `SELECT * FROM strategy_docs WHERE id = ?`, id);
  if (!row) return c.json({ error: "Not found." }, 404);
  return c.json(serialize(row));
});

// --- Delete (with undo) ------------------------------------------------------

adminStrategyRoutes.delete("/:id", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  const row = await first<{ title: string }>(c.var.db, `SELECT title FROM strategy_docs WHERE id = ?`, id);
  if (!row) return c.json({ ok: true });
  const undoId = await softDelete(c.var.db, "strategy_docs", id, row.title);
  if (!undoId) await run(c.var.db, `DELETE FROM strategy_docs WHERE id = ?`, id);
  await writeAudit(c.var.db, c.var.userId, "strategy.delete", "strategy_docs", id, {});
  return c.json({ ok: true, undoId: undoId ?? undefined });
});

// --- Push action items onto the calendar -------------------------------------

adminStrategyRoutes.post("/:id/schedule", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as { actions?: number[] };
  const wanted = Array.isArray(body.actions) ? body.actions.filter((n) => Number.isInteger(n) && n >= 0) : [];
  if (!wanted.length) return c.json({ error: "Pick at least one action to schedule." }, 400);

  const row = await first<StrategyRow>(c.var.db, `SELECT * FROM strategy_docs WHERE id = ?`, id);
  if (!row) return c.json({ error: "Not found." }, 404);
  const content = parseJson<StrategyContent | null>(row.content_json, null);
  if (!content) return c.json({ error: "This document has no actions yet." }, 400);
  const already = new Set(parseJson<number[]>(row.scheduled_json, []));
  const label = strategyDocLabel(row.kind, row.variant);

  let added = 0;
  for (const idx of wanted) {
    const action = content.actions[idx];
    if (!action || already.has(idx)) continue;
    const startsOn = new Date(Date.now() + action.dueInDays * 86_400_000).toISOString().slice(0, 10);
    const calId = newId("cal");
    const notes = [action.detail, `From Strategy · ${label}: ${row.title}`].filter(Boolean).join(" — ");
    await run(
      c.var.db,
      `INSERT INTO production_calendar_events (id, title, kind, starts_on, notes)
       VALUES (?, ?, ?, ?, ?)`,
      calId,
      action.title.slice(0, 300),
      action.kind === "deadline" ? "deadline" : "milestone",
      startsOn,
      notes.slice(0, 1000),
    );
    already.add(idx);
    added++;
    await emit(c.var.db, {
      kind: "strategy.action_scheduled",
      entityType: "production_calendar_event",
      entityId: calId,
      title: `Scheduled “${action.title}” from ${label} for ${startsOn}`,
      payload: { strategyId: id, calendarId: calId, startsOn },
    });
  }

  const scheduled = [...already].sort((a, b) => a - b);
  await run(
    c.var.db,
    `UPDATE strategy_docs SET scheduled_json = ?, updated_at = datetime('now') WHERE id = ?`,
    JSON.stringify(scheduled),
    id,
  );
  await writeAudit(c.var.db, c.var.userId, "strategy.schedule", "strategy_docs", id, { added });
  return c.json({ ok: true, added, scheduled });
});
