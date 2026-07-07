import { Hono } from "hono";
import { first, run, writeAudit } from "../services/db";
import { requireAdminWrite } from "../middleware/auth";
import { reserveResearchQuota, quotaExceededBody } from "../services/ai-quota";
import { PLAYBOOK, PLAYBOOK_FIELDS } from "../../shared/playbook";
import { FABRIC_LIBRARY } from "../../shared/fabrics";
import type { AppContext } from "../types/env";

/**
 * The Brand Brain — a per-shop structured brief compiled from the Launch
 * Playbook (or an imported plan). Populate it three ways (AI generate, paste,
 * PDF text) and compile it into a plan that seeds and guides every module.
 */
export const adminBrainRoutes = new Hono<AppContext>();

interface BrainRow {
  mode: string | null;
  status: string;
  answers_json: string;
  checklist_json: string;
  brief_json: string | null;
  plan_markdown: string | null;
  onboarded: number;
  updated_at: string;
}

async function loadBrain(db: D1Database): Promise<BrainRow> {
  const row = await first<BrainRow>(db, `SELECT * FROM brand_brain WHERE id = 'brain'`);
  if (row) return row;
  await run(db, `INSERT OR IGNORE INTO brand_brain (id) VALUES ('brain')`);
  return (await first<BrainRow>(db, `SELECT * FROM brand_brain WHERE id = 'brain'`))!;
}

function serialize(row: BrainRow) {
  const parse = (s: string | null, fallback: unknown) => {
    if (!s) return fallback;
    try {
      return JSON.parse(s);
    } catch {
      return fallback;
    }
  };
  return {
    mode: row.mode,
    status: row.status,
    onboarded: Boolean(row.onboarded),
    answers: parse(row.answers_json, {}) as Record<string, unknown>,
    checklist: parse(row.checklist_json, {}) as Record<string, boolean>,
    brief: parse(row.brief_json, null),
    planMarkdown: row.plan_markdown,
    updatedAt: row.updated_at,
  };
}

const FIELD_MANIFEST = PLAYBOOK_FIELDS.filter((f) => f.type !== "images")
  .map((f) => `${f.id} — ${f.label}${f.type === "list" ? " (list of short strings)" : ""}`)
  .join("\n");

adminBrainRoutes.get("/", async (c) => {
  const row = await loadBrain(c.var.db);
  return c.json(serialize(row));
});

adminBrainRoutes.put("/", requireAdminWrite, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    mode?: string;
    answers?: Record<string, unknown>;
    checklist?: Record<string, boolean>;
    onboarded?: boolean;
  };
  const row = await loadBrain(c.var.db);
  const sets: string[] = [];
  const params: unknown[] = [];
  if (body.mode !== undefined && ["established", "new"].includes(body.mode)) {
    sets.push("mode = ?");
    params.push(body.mode);
  }
  if (body.answers) {
    const current = safeParse(row.answers_json);
    sets.push("answers_json = ?");
    params.push(JSON.stringify({ ...current, ...body.answers }));
  }
  if (body.checklist) {
    const current = safeParse(row.checklist_json);
    sets.push("checklist_json = ?");
    params.push(JSON.stringify({ ...current, ...body.checklist }));
  }
  if (body.onboarded !== undefined) {
    sets.push("onboarded = ?");
    params.push(body.onboarded ? 1 : 0);
  }
  if (sets.length) {
    sets.push("updated_at = datetime('now')");
    await run(c.var.db, `UPDATE brand_brain SET ${sets.join(", ")} WHERE id = 'brain'`, ...params);
  }
  return c.json(serialize(await loadBrain(c.var.db)));
});

/**
 * AI-draft the Playbook fields from a short brief, backed by live research
 * (Perplexity) so region/duty/price benchmarks are current. Returns partial
 * answers to merge — the founder reviews everything.
 */
adminBrainRoutes.post("/generate", requireAdminWrite, async (c) => {
  const { perplexityConfigured, perplexityResearch } = await import("../services/perplexity");
  const body = (await c.req.json().catch(() => ({}))) as { idea?: string; category?: string; market?: string };
  if (!body.idea?.trim()) return c.json({ error: "Describe your brand idea first." }, 400);

  const system = `You are a fashion brand launch strategist filling in a founder's Launch Playbook. Given a brand idea, draft sensible, specific starting values for the fields below. Respond with ONLY a JSON object mapping field ids to values (strings, or arrays of short strings for list fields). Use current, realistic market knowledge (regions, duty lanes, price architecture). Omit fields you can't reasonably draft. Fields:\n${FIELD_MANIFEST}`;
  const prompt = `Brand idea: ${body.idea}\nCategory: ${body.category || "(infer)"}\nPrimary market(s): ${body.market || "(infer)"}\nDraft the Playbook.`;

  try {
    let text: string;
    if (perplexityConfigured(c.env)) {
      const quota = await reserveResearchQuota(c);
      if (!quota.ok) return c.json(quotaExceededBody(quota), 429);
      text = (await perplexityResearch(c.env, { system, prompt, maxTokens: 2200 })).text;
    } else {
      const { aiComplete } = await import("../services/ai");
      text = (await aiComplete(c.env, { system, prompt, maxTokens: 2200 })).text;
    }
    return c.json({ answers: extractAnswers(text) });
  } catch (err) {
    return c.json({ error: `Couldn't draft the plan: ${String(err).slice(0, 160)}` }, 502);
  }
});

/**
 * The "invisible business admin": fill in ONE section for the founder using the
 * context they've already given, and explain it in plain language. This is what
 * lets a new brand skip researching tariffs, landed cost, and margins — Verto
 * fills the technical sections and tells them what the numbers mean.
 */
adminBrainRoutes.post("/assist-section", requireAdminWrite, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { sectionId?: string };
  const section = PLAYBOOK.flatMap((p) => p.sections).find((s) => s.id === body.sectionId);
  if (!section) return c.json({ error: "Unknown section." }, 400);

  const row = await loadBrain(c.var.db);
  const answers = safeParse(row.answers_json);
  const contextText = PLAYBOOK_FIELDS.filter(
    (f) => f.type !== "images" && answers[f.id] != null && answers[f.id] !== "",
  )
    .map((f) => `${f.label}: ${Array.isArray(answers[f.id]) ? (answers[f.id] as string[]).join(", ") : answers[f.id]}`)
    .join("\n");
  const sectionManifest = section.fields
    .filter((f) => f.type !== "images")
    .map((f) => `${f.id} — ${f.label}${f.type === "list" ? " (list of short strings)" : ""}${f.type === "select" && f.options ? ` (one of: ${f.options.join(", ")})` : ""}`)
    .join("\n");

  const system = `You are the invisible business admin for a launching clothing brand — an expert who quietly handles the parts a first-time founder shouldn't have to research (tariffs, landed cost, margins, sourcing regions). Fill in the "${section.title}" section for them using everything they've already told you. Respond with ONLY a JSON object: {"answers":{fieldId:value,...},"explanation":"2-4 short sentences, warm and plain-English (no jargon), explaining what these values mean for their costs, margins, and launch — like a smart friend who's done this before"}. Use current, realistic benchmarks (price is typically 5-8x unit cost for DTC; DTC gross margin 70-85%). Only include fields from this list, and use a value from the allowed options where given:\n${sectionManifest}`;
  const prompt = `What they've told me so far:\n${contextText || "(not much yet — infer sensible defaults for an emerging brand)"}\n\nFill in the "${section.title}" section.`;

  try {
    const { perplexityConfigured, perplexityResearch } = await import("../services/perplexity");
    let text: string;
    if (perplexityConfigured(c.env)) {
      const quota = await reserveResearchQuota(c);
      if (!quota.ok) return c.json(quotaExceededBody(quota), 429);
      text = (await perplexityResearch(c.env, { system, prompt, maxTokens: 1400 })).text;
    } else {
      const { aiComplete } = await import("../services/ai");
      text = (await aiComplete(c.env, { system, prompt, maxTokens: 1400 })).text;
    }
    const { answers: rawAnswers, explanation } = parseAssist(text);
    // Keep only this section's fields, dropping blanks.
    const sectionFieldIds = new Set(section.fields.map((f) => f.id));
    const scoped: Record<string, unknown> = {};
    if (rawAnswers && typeof rawAnswers === "object") {
      for (const [k, v] of Object.entries(rawAnswers as Record<string, unknown>)) {
        if (sectionFieldIds.has(k) && v != null && v !== "") scoped[k] = v;
      }
    }

    if (Object.keys(scoped).length) {
      await run(
        c.var.db,
        `UPDATE brand_brain SET answers_json = ?, updated_at = datetime('now') WHERE id = 'brain'`,
        JSON.stringify({ ...answers, ...scoped }),
      );
    }
    return c.json({ answers: scoped, explanation });
  } catch (err) {
    return c.json({ error: `Couldn't fill that in: ${String(err).slice(0, 160)}` }, 502);
  }
});

/** Pull {answers, explanation} out of a model response, tolerant of prose. */
function parseAssist(text: string): { answers: unknown; explanation: string | null } {
  const start = text.search(/\{/);
  if (start !== -1) {
    try {
      const obj = JSON.parse(text.slice(start, text.lastIndexOf("}") + 1)) as {
        answers?: unknown;
        explanation?: string;
      };
      return { answers: obj.answers ?? {}, explanation: obj.explanation ?? null };
    } catch {
      /* fall through */
    }
  }
  return { answers: {}, explanation: null };
}

/**
 * Fabric drill-down: a founder describes what they want in human terms ("soft
 * and cozy for a hoodie") and we map it to real fabrics from the library. No
 * web research needed — this is matching, so it runs on the general LLM.
 */
adminBrainRoutes.post("/suggest-fabrics", requireAdminWrite, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { description?: string };
  if (!body.description?.trim()) return c.json({ error: "Describe the feel you want." }, 400);
  const { aiComplete } = await import("../services/ai");
  const manifest = FABRIC_LIBRARY.map((f) => `${f.id}: ${f.name} — ${f.feel} (good for ${f.goodFor})`).join("\n");
  try {
    const out = await aiComplete(c.env, {
      system: `You help a first-time fashion founder choose fabrics in plain language. From the LIBRARY below, pick the 2–5 that best match what they describe. Respond with ONLY JSON: {"picks":["fabric-id",...],"note":"one warm, jargon-free sentence explaining the choice"}. Only use ids that appear in the library.\nLIBRARY:\n${manifest}`,
      prompt: `They want: ${body.description}`,
      maxTokens: 500,
    });
    const { parseModelJson } = await import("../services/anthropic");
    let picks: string[] = [];
    let note: string | null = null;
    try {
      const p = parseModelJson(out.text) as { picks?: unknown; note?: unknown };
      if (Array.isArray(p.picks)) picks = p.picks.map(String);
      if (typeof p.note === "string") note = p.note;
    } catch {
      /* leave empty */
    }
    const valid = new Set(FABRIC_LIBRARY.map((f) => f.id));
    const resolved = picks
      .filter((id) => valid.has(id))
      .map((id) => FABRIC_LIBRARY.find((f) => f.id === id)!)
      .map((f) => ({ id: f.id, name: f.name, composition: f.composition, gsm: f.gsm }));
    return c.json({ picks: resolved, note });
  } catch (err) {
    return c.json({ error: `Couldn't suggest fabrics: ${String(err).slice(0, 160)}` }, 502);
  }
});

/** Parse a pasted / PDF-extracted launch plan into the Playbook fields. */
adminBrainRoutes.post("/parse", requireAdminWrite, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { text?: string };
  const text = (body.text || "").slice(0, 40000);
  if (text.trim().length < 40) return c.json({ error: "Paste more of your plan to parse." }, 400);
  const { aiComplete } = await import("../services/ai");
  const system = `You extract a founder's existing launch plan into structured fields. Read the plan and map its content onto the field ids below. Respond with ONLY a JSON object mapping field ids to values (strings, or arrays of short strings for list fields). Only include fields the plan actually supports — never invent. Fields:\n${FIELD_MANIFEST}`;
  try {
    const out = await aiComplete(c.env, { system, prompt: `PLAN:\n${text}`, maxTokens: 2200 });
    return c.json({ answers: extractAnswers(out.text) });
  } catch (err) {
    return c.json({ error: `Couldn't parse the plan: ${String(err).slice(0, 160)}` }, 502);
  }
});

/** Compile the filled Playbook into a structured brief + a readable plan. */
adminBrainRoutes.post("/compile", requireAdminWrite, async (c) => {
  const row = await loadBrain(c.var.db);
  const answers = safeParse(row.answers_json);
  if (Object.keys(answers).length === 0) {
    return c.json({ error: "Fill in some of the Playbook first." }, 400);
  }
  const { aiComplete } = await import("../services/ai");
  const answersText = PLAYBOOK_FIELDS.filter(
    (f) => f.type !== "images" && answers[f.id] != null && answers[f.id] !== "",
  )
    .map((f) => `${f.label}: ${Array.isArray(answers[f.id]) ? (answers[f.id] as string[]).join(", ") : answers[f.id]}`)
    .join("\n");

  try {
    const brief = await aiComplete(c.env, {
      system:
        "You are a brand strategist. From the founder's filled launch plan, produce a tight structured 'brand brief' as ONLY a JSON object: {\"name\":\"\",\"oneLiner\":\"\",\"voice\":\"\",\"customer\":\"\",\"aesthetic\":\"\",\"priceArchitecture\":\"\",\"productionRegion\":\"\",\"markets\":[\"\"],\"launchDate\":\"\",\"heroConcept\":\"\",\"nextSteps\":[\"3-6 concrete next actions\"]}. Be specific and usable — this becomes the app's operating brief.",
      prompt: answersText,
      maxTokens: 1200,
    });
    const plan = await aiComplete(c.env, {
      system:
        "You are a brand strategist. Turn the founder's filled launch plan into a clear, motivating one-page business plan in Markdown with short sections (Thesis, Product, Sourcing, Landed cost & pricing, Commerce, Launch, Finance, Risks). Use their own decisions; be concrete; no fluff.",
      prompt: answersText,
      maxTokens: 2000,
    });
    const { parseModelJson } = await import("../services/anthropic");
    let briefObj: unknown = null;
    try {
      briefObj = parseModelJson(brief.text);
    } catch {
      briefObj = { raw: brief.text };
    }
    await run(
      c.var.db,
      `UPDATE brand_brain SET status = 'compiled', brief_json = ?, plan_markdown = ?, updated_at = datetime('now') WHERE id = 'brain'`,
      JSON.stringify(briefObj),
      plan.text,
    );
    await writeAudit(c.var.db, c.var.userId, "brand_brain.compile", "brand_brain", "brain", {});
    return c.json({ brief: briefObj, planMarkdown: plan.text });
  } catch (err) {
    return c.json({ error: `Couldn't compile the plan: ${String(err).slice(0, 160)}` }, 502);
  }
});

function safeParse(s: string | null): Record<string, unknown> {
  if (!s) return {};
  try {
    const v = JSON.parse(s);
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

/** Pull the JSON field-map out of a model response and keep only known fields. */
function extractAnswers(text: string): Record<string, unknown> {
  let parsed: unknown = {};
  const start = text.search(/[[{]/);
  if (start !== -1) {
    try {
      parsed = JSON.parse(text.slice(start));
    } catch {
      const brace = text.match(/\{[\s\S]*\}/);
      if (brace) {
        try {
          parsed = JSON.parse(brace[0]);
        } catch {
          parsed = {};
        }
      }
    }
  }
  if (!parsed || typeof parsed !== "object") return {};
  const known = new Set(PLAYBOOK_FIELDS.map((f) => f.id));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    if (known.has(k) && v != null && v !== "") out[k] = v;
  }
  return out;
}
