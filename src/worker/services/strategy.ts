import { all, first } from "./db";
import { aiComplete, AiUnavailableError } from "./ai";
import { parseModelJson } from "./anthropic";
import type { Env } from "../types/env";
import {
  STRATEGY_KINDS,
  strategyKindMeta,
  strategyDocLabel,
  type StrategyKind,
  type StrategyVariant,
  type StrategyPersona,
  type StrategyContent,
  type StrategySection,
  type StrategyAction,
} from "../../shared/strategy";

/**
 * Business Strategy generation — the R&D → Strategy engine. A shop picks a
 * tool (SWOT / business plan / OKRs / competitive), a Claude persona, and
 * optionally a written brief; we ground the request in the shop's own Brand
 * Brain and R&D signals, ask the model for a strictly-shaped JSON document,
 * and hand back something the page can render and turn into calendar items.
 *
 * Degrades exactly like every other AI feature: `aiComplete` uses the shop's
 * Anthropic key when set and falls back to Workers AI Llama otherwise, so the
 * only hard failure is when no provider exists at all (AiUnavailableError).
 */

// --- Personas ----------------------------------------------------------------

const PERSONA_VOICE: Record<StrategyPersona, string> = {
  advisor:
    "You are a seasoned independent-fashion strategy advisor. You are direct, practical, and honest about trade-offs. You never pad. You call weak ideas weak, kindly, and you always say what you'd do next.",
  investor:
    "You are an experienced early-stage investor and operator who has backed consumer and fashion brands. You pressure-test unit economics, defensibility, and the size of the prize. You are constructive but skeptical, and you flag the risks a founder is glossing over.",
  operator:
    "You are a fractional operating partner for small fashion labels. You think in sequencing, resourcing, and what actually ships when. You turn ambition into concrete, ordered execution and you are ruthless about focus.",
  coach:
    "You are a warm, plain-spoken founder coach for independent designers. You are encouraging and human, you translate strategy jargon into everyday language, and you keep everything doable for a small team.",
};

// --- Per-tool instructions ---------------------------------------------------

/** The document schema, described once for the model. */
const SCHEMA_DOC = `Return ONLY a single JSON object (no prose, no markdown fences) of this exact shape:
{
  "title": "short document title",
  "summary": "2-3 sentence executive summary in plain language",
  "sections": [ SECTION, ... ],
  "actions": [ ACTION, ... ]
}
A SECTION is one of:
  { "heading": "...", "kind": "list", "items": ["short point", ...] }
  { "heading": "...", "kind": "text", "body": "one or two short paragraphs" }
  { "heading": "...", "kind": "keyvalue", "pairs": [{ "label": "...", "value": "..." }, ...] }
  { "heading": "...", "kind": "okr", "objectives": [{ "objective": "...", "rationale": "why it matters", "keyResults": [{ "kr": "measurable result", "target": "the number/date to hit" }, ...] }, ...] }
An ACTION is a concrete next step to put on the calendar:
  { "title": "short imperative task", "detail": "one line of context", "kind": "milestone" | "deadline", "dueInDays": <integer number of days from today, 3-120> }
Provide 3 to 6 actions, ordered soonest first. Keep every string tight — this is a working document, not an essay.`;

function toolInstructions(kind: StrategyKind, variant: StrategyVariant | null): string {
  switch (kind) {
    case "swot":
      return `Produce a SWOT analysis. Use exactly four "list" sections with headings "Strengths", "Weaknesses", "Opportunities", and "Threats" (3-5 sharp, specific points each — no generic filler), then one "text" section headed "What this means" with the honest read, then one "list" section headed "Priority moves" with the 2-3 things to do about it. Actions should follow from the priority moves.`;
    case "business_plan":
      if (variant === "full") {
        return `Produce an investor-ready business plan. Use "text" and "keyvalue" sections with these headings in order: "Executive summary" (text), "The problem" (text), "The offer" (text), "Target customer" (text), "Market & opportunity" (text), "Go-to-market" (list), "Competition & moat" (text), "Operations & production" (text), "Business model" (keyvalue — pairs like Revenue streams, Unit economics, Pricing, Cost structure), "Financial outlook" (keyvalue — pairs like Path to profitability, Key assumptions, Funding need), "Risks" (list), and "Milestones" (list). Be concrete; where a number is unknown, state the assumption rather than inventing precision.`;
      }
      return `Produce a Lean Canvas as "keyvalue" and "list" sections in this order, one section each: "Problem" (list), "Customer segments" (list), "Unique value proposition" (text), "Solution" (list), "Channels" (list), "Revenue streams" (list), "Cost structure" (list), "Key metrics" (list), "Unfair advantage" (text). Keep each item to a short phrase — a canvas, not prose.`;
    case "okrs":
      return `Produce a set of quarterly OKRs. Use one "text" section headed "This quarter's focus" (one sentence on the theme), then one "okr" section headed "Objectives" with 2-4 objectives, each with a short rationale and 2-4 measurable key results (every key result needs a concrete target number or date). Then one "list" section headed "Watch-outs" naming what could derail the quarter. Actions should be the first steps toward the key results, dated within the quarter.`;
    case "competitive":
      return `Produce a competitive analysis. Use one "text" section headed "The landscape" (how the segment is shaped), one "keyvalue" section headed "The competitive set" (one pair per competitor: label = brand name, value = positioning + rough price + one strength / one weakness), one "list" section headed "Barriers to entry" (named plainly), and one "list" section headed "White space" (the openings this brand can credibly own). Ground it in the competitors named in the context; do not invent brands you have no basis for — if the set is thin, say so and reason from the segment.`;
  }
}

// --- Shop grounding ----------------------------------------------------------

const BRAIN_FIELDS: { id: string; label: string }[] = [
  { id: "brand.name", label: "Brand" },
  { id: "brand.category", label: "Category" },
  { id: "brand.target", label: "Target customer" },
  { id: "brand.feeling", label: "Feeling / world" },
  { id: "brand.gap", label: "Market gap" },
  { id: "brand.thesis", label: "Thesis" },
  { id: "brand.words", label: "Positioning words" },
  { id: "price.position", label: "Price position" },
];

/** Build a compact, defensive context block from the shop's own data. */
export async function buildStrategyContext(db: D1Database): Promise<string> {
  const lines: string[] = [];

  // Brand Brain answers (the Launch Playbook).
  try {
    const row = await first<{ answers_json: string }>(db, `SELECT answers_json FROM brand_brain WHERE id = 'brain'`);
    const answers = row?.answers_json ? (JSON.parse(row.answers_json) as Record<string, unknown>) : {};
    for (const f of BRAIN_FIELDS) {
      const v = answers[f.id];
      const text = Array.isArray(v) ? v.filter(Boolean).join(", ") : typeof v === "string" ? v.trim() : "";
      if (text) lines.push(`${f.label}: ${text.slice(0, 400)}`);
    }
  } catch {
    /* no brain yet */
  }

  // Competitors the shop already researched — invaluable for competitive/SWOT.
  try {
    const brands = await all<{ name: string; segment: string | null; positioning: string | null; price_floor_cents: number | null; price_ceiling_cents: number | null }>(
      db,
      `SELECT name, segment, positioning, price_floor_cents, price_ceiling_cents FROM research_brands ORDER BY watch DESC, name LIMIT 12`,
    );
    if (brands.length) {
      lines.push(
        "Competitors on file: " +
          brands
            .map((b) => {
              const range =
                b.price_floor_cents || b.price_ceiling_cents
                  ? ` ($${Math.round((b.price_floor_cents ?? 0) / 100)}-${Math.round((b.price_ceiling_cents ?? 0) / 100)})`
                  : "";
              return `${b.name}${b.segment ? ` [${b.segment}]` : ""}${b.positioning ? ` — ${b.positioning}` : ""}${range}`;
            })
            .join("; "),
      );
    }
  } catch {
    /* table not present */
  }

  // Trend directions in play.
  try {
    const trends = await all<{ title: string }>(db, `SELECT title FROM trend_boards ORDER BY updated_at DESC LIMIT 6`);
    if (trends.length) lines.push("Trend boards in play: " + trends.map((t) => t.title).join(", "));
  } catch {
    /* ignore */
  }

  // Scale signals.
  try {
    const counts = await Promise.all(
      ["styles", "products", "orders", "clients"].map(async (t) => {
        try {
          const r = await first<{ n: number }>(db, `SELECT COUNT(*) AS n FROM ${t}`);
          return `${t}: ${r?.n ?? 0}`;
        } catch {
          return null;
        }
      }),
    );
    const present = counts.filter(Boolean) as string[];
    if (present.length) lines.push("Catalog & sales scale — " + present.join(", "));
  } catch {
    /* ignore */
  }

  return lines.length ? lines.join("\n") : "No brand profile has been filled in yet — reason from general best practice for a small independent fashion label and say where you're guessing.";
}

// --- Generation --------------------------------------------------------------

export interface GenerateStrategyInput {
  kind: StrategyKind;
  variant: StrategyVariant | null;
  persona: StrategyPersona;
  brief: string;
  plain: boolean;
}

export interface GeneratedStrategy {
  title: string;
  content: StrategyContent;
  provider: string;
}

const MAX_TOKENS = 4000;

export async function generateStrategy(
  env: Env,
  db: D1Database,
  input: GenerateStrategyInput,
): Promise<GeneratedStrategy> {
  const kindMeta = strategyKindMeta(input.kind);
  if (!kindMeta) throw new Error("Unknown strategy tool");
  const voice = PERSONA_VOICE[input.persona] ?? PERSONA_VOICE.advisor;
  const context = await buildStrategyContext(db);

  const plainClause = input.plain
    ? "\n\nPLAIN-LANGUAGE MODE IS ON. Avoid jargon and MBA vocabulary entirely. Write the way you'd explain it to a talented maker who has never run a business before. Short sentences."
    : "";

  const system = `${voice}

You are helping the owner of a small independent fashion brand with their business strategy inside Verto. You are grounded in the brand's real profile below. Be specific to THIS brand — reference their category, customer, price position, and named competitors wherever it sharpens the work. Do not flatter. Do not invent facts, prices, or competitors you have no basis for; where you're inferring, say so briefly.

${toolInstructions(input.kind, input.variant)}${plainClause}

${SCHEMA_DOC}`;

  const brief = input.brief.trim();
  const prompt = `BRAND CONTEXT:
${context}

TASK: Produce the ${strategyDocLabel(input.kind, input.variant)} described above for this brand.${
    brief ? `\n\nWHAT THE FOUNDER ADDED:\n${brief.slice(0, 2000)}` : ""
  }

Respond with exactly one JSON object and nothing else.`;

  const run = async (): Promise<GeneratedStrategy> => {
    const completion = await aiComplete(env, { system, prompt, maxTokens: MAX_TOKENS });
    const parsed = parseModelJson(completion.text) as Record<string, unknown>;
    const content = normalizeContent(parsed);
    if (!content.sections.length) throw new Error("Empty strategy document");
    const title =
      typeof parsed.title === "string" && parsed.title.trim()
        ? parsed.title.trim().slice(0, 160)
        : strategyDocLabel(input.kind, input.variant);
    return { title, content, provider: completion.provider };
  };

  try {
    return await run();
  } catch (err) {
    if (err instanceof AiUnavailableError) throw err;
    // One retry — models occasionally trail prose or fumble the JSON.
    return await run();
  }
}

// --- Validation / normalization ---------------------------------------------

const str = (v: unknown, max = 2000): string => (typeof v === "string" ? v.trim().slice(0, max) : "");

function normalizeContent(raw: Record<string, unknown>): StrategyContent {
  const summary = str(raw.summary, 800);
  const rawSections = Array.isArray(raw.sections) ? raw.sections : [];
  const sections: StrategySection[] = [];
  for (const s of rawSections) {
    if (!s || typeof s !== "object") continue;
    const o = s as Record<string, unknown>;
    const heading = str(o.heading, 160);
    const kind = o.kind;
    if (!heading) continue;
    if (kind === "list") {
      const items = (Array.isArray(o.items) ? o.items : []).map((x) => str(x, 400)).filter(Boolean).slice(0, 20);
      if (items.length) sections.push({ heading, kind: "list", items });
    } else if (kind === "text") {
      const body = str(o.body, 3000);
      if (body) sections.push({ heading, kind: "text", body });
    } else if (kind === "keyvalue") {
      const pairs = (Array.isArray(o.pairs) ? o.pairs : [])
        .map((p) => {
          const po = (p ?? {}) as Record<string, unknown>;
          return { label: str(po.label, 120), value: str(po.value, 1200) };
        })
        .filter((p) => p.label && p.value)
        .slice(0, 20);
      if (pairs.length) sections.push({ heading, kind: "keyvalue", pairs });
    } else if (kind === "okr") {
      const objectives = (Array.isArray(o.objectives) ? o.objectives : [])
        .map((obj) => {
          const oo = (obj ?? {}) as Record<string, unknown>;
          const keyResults = (Array.isArray(oo.keyResults) ? oo.keyResults : [])
            .map((kr) => {
              const kro = (kr ?? {}) as Record<string, unknown>;
              return { kr: str(kro.kr, 400), target: str(kro.target, 200) || undefined };
            })
            .filter((kr) => kr.kr)
            .slice(0, 6);
          return { objective: str(oo.objective, 300), rationale: str(oo.rationale, 600) || undefined, keyResults };
        })
        .filter((obj) => obj.objective && obj.keyResults.length)
        .slice(0, 6);
      if (objectives.length) sections.push({ heading, kind: "okr", objectives });
    }
  }

  const rawActions = Array.isArray(raw.actions) ? raw.actions : [];
  const actions: StrategyAction[] = [];
  for (const a of rawActions) {
    if (!a || typeof a !== "object") continue;
    const o = a as Record<string, unknown>;
    const title = str(o.title, 200);
    if (!title) continue;
    const days = Number(o.dueInDays);
    const dueInDays = Number.isFinite(days) ? Math.min(120, Math.max(1, Math.round(days))) : 30;
    actions.push({
      title,
      detail: str(o.detail, 400) || undefined,
      kind: o.kind === "deadline" ? "deadline" : "milestone",
      dueInDays,
    });
    if (actions.length >= 8) break;
  }

  return { summary, sections, actions };
}

export { STRATEGY_KINDS };
