import { Hono } from "hono";
import { z } from "zod";
import { all, first, run } from "../services/db";
import {
  AnthropicNotConfiguredError,
  askClaude,
  parseModelJson,
} from "../services/anthropic";
import { parseBody } from "../services/validators";
import { requireAdminWrite } from "../middleware/auth";
import { rateLimit } from "../middleware/rate-limit";
import { newId } from "../utils/id";
import type { AppContext } from "../types/env";

/**
 * AI assist for tech packs: structured, factory-grade first drafts that a
 * human reviews and applies. Server-side only — prompts and keys never
 * reach the browser. Every run is logged to ai_generations.
 */
export const adminTechPackAiRoutes = new Hono<AppContext>();

const ACTIONS = [
  "bom",
  "construction_notes",
  "qc_checklist",
  "measurement_points",
  "grading_rules",
  "translate_fr",
  "factory_summary",
  "factory_email",
  "completeness_check",
  "compare_versions",
] as const;

const assistSchema = z.object({
  action: z.enum(ACTIONS),
  input: z.string().max(6000).optional(),
  otherTechPackId: z.string().max(80).optional(),
});

const SYSTEM = `You are the technical design assistant for Maison Atlantique, a Morocco-produced clothing brand (tailored resortwear: high-waisted linen trousers, draped viscose dresses, resort knits) manufactured in small Casablanca ateliers.
You produce factory-grade apparel documentation: precise, conservative, and honest about uncertainty (mark assumptions with "TBC").
Always respond with ONLY a single JSON object matching the requested schema — no prose before or after.`;

interface ActionSpec {
  targetSectionKind: string | null;
  buildPrompt: (ctx: string, input?: string, otherCtx?: string) => string;
}

const ACTION_SPECS: Record<(typeof ACTIONS)[number], ActionSpec> = {
  bom: {
    targetSectionKind: "bom",
    buildPrompt: (ctx) =>
      `Draft a first-pass bill of materials for this garment.\n\n${ctx}\n\nRespond as {"rows":[{"component","material","qty","unit","placement","note"}]} — include shell fabric, linings/interlinings, closures, threads, labels (main, care, size), and packaging. Use metric units.`,
  },
  construction_notes: {
    targetSectionKind: "construction",
    buildPrompt: (ctx) =>
      `Draft construction notes for this garment, area by area, for a Casablanca tailoring atelier.\n\n${ctx}\n\nRespond as {"rows":[{"area","note"}]} — cover waistband/neckline, seams, closures, hems, pressing, and any couture details implied by the style.`,
  },
  qc_checklist: {
    targetSectionKind: "qc_checklist",
    buildPrompt: (ctx) =>
      `Draft a final-inspection QC checklist for this garment.\n\n${ctx}\n\nRespond as {"items":["..."]} — 8 to 14 concrete, checkable items covering measurements vs spec, symmetry, stitching, closures, labels, pressing, and packing.`,
  },
  measurement_points: {
    targetSectionKind: "measurement_points",
    buildPrompt: (ctx) =>
      `Suggest the measurement points a factory needs for this garment.\n\n${ctx}\n\nRespond as {"rows":[{"code","name","how_to_measure","tolerance_cm"}]} — use standard POM codes where they exist.`,
  },
  grading_rules: {
    targetSectionKind: "grading",
    buildPrompt: (ctx) =>
      `Suggest grading rules (per-size increments) for this garment's measurement points.\n\n${ctx}\n\nRespond as {"rows":[{"measurement","step_value_cm","note"}]} — conservative, standard grade rules; flag anything style-specific as TBC.`,
  },
  translate_fr: {
    targetSectionKind: null,
    buildPrompt: (ctx, input) =>
      `Translate the following factory notes into professional French garment-industry terminology (as used in Moroccan ateliers).\n\nNotes:\n${input ?? "(use the construction notes from the tech pack context)"}\n\nContext:\n${ctx}\n\nRespond as {"rows":[{"en","fr"}]}.`,
  },
  factory_summary: {
    targetSectionKind: null,
    buildPrompt: (ctx) =>
      `Write a concise factory-ready summary of this tech pack for a first briefing (what the garment is, key construction points, fabrics, sizes, and open questions).\n\n${ctx}\n\nRespond as {"summary_en":"...","summary_fr":"...","open_questions":["..."]}.`,
  },
  factory_email: {
    targetSectionKind: null,
    buildPrompt: (ctx, input) =>
      `Draft a professional email to a Casablanca atelier introducing this tech pack and requesting a proto sample quote. ${input ? `Additional instructions: ${input}` : ""}\n\n${ctx}\n\nRespond as {"subject":"...","body_en":"...","body_fr":"..."} — warm but precise, no invented commercial terms (MOQ/price/dates as questions, not claims).`,
  },
  completeness_check: {
    targetSectionKind: null,
    buildPrompt: (ctx) =>
      `Audit this tech pack for completeness before it is sent to a factory.\n\n${ctx}\n\nRespond as {"missing":[{"section","issue","severity"}],"ready_to_send":true|false,"notes":"..."} — severity is "blocker" | "important" | "nice_to_have".`,
  },
  compare_versions: {
    targetSectionKind: null,
    buildPrompt: (ctx, _input, otherCtx) =>
      `Compare these two tech packs and summarize what changed, section by section.\n\n=== TECH PACK A ===\n${ctx}\n\n=== TECH PACK B ===\n${otherCtx ?? "(missing)"}\n\nRespond as {"changes":[{"section","change"}],"summary":"..."}.`,
  },
};

async function buildTechPackContext(db: D1Database, id: string): Promise<string | null> {
  const tp = await first<Record<string, unknown>>(
    db,
    `SELECT tp.*, s.name AS style_name, s.description AS style_description,
            s.fit_notes, s.fabric_summary, s.category, s.gender
     FROM tech_packs tp LEFT JOIN styles s ON s.id = tp.style_id WHERE tp.id = ?`,
    id,
  );
  if (!tp) return null;
  const sections = await all<{ kind: string; title: string; content_json: string }>(
    db,
    `SELECT kind, title, content_json FROM tech_pack_sections
     WHERE tech_pack_id = ? AND content_json != '{}' ORDER BY sort_order`,
    id,
  );
  const construction = await all<{ area: string; note: string }>(
    db,
    `SELECT area, note FROM construction_notes WHERE tech_pack_id = ? ORDER BY sort_order`,
    id,
  );
  const lines = [
    `Tech pack: ${tp.name} (${tp.code}), season ${tp.season ?? "TBC"}, status ${tp.status}`,
    `Style: ${tp.style_name ?? "unlinked"} — ${tp.category ?? ""} (${tp.gender ?? ""})`,
    tp.style_description ? `Description: ${tp.style_description}` : "",
    tp.fit_notes ? `Fit: ${tp.fit_notes}` : "",
    tp.fabric_summary ? `Fabric: ${tp.fabric_summary}` : "",
    tp.summary ? `Summary: ${tp.summary}` : "",
    ...sections.map((s) => `Section ${s.kind}: ${s.content_json}`),
    ...(construction.length
      ? [`Construction notes: ${JSON.stringify(construction)}`]
      : []),
  ].filter(Boolean);
  return lines.join("\n");
}

adminTechPackAiRoutes.post(
  "/:id/ai-assist",
  requireAdminWrite,
  rateLimit({ key: "ai-assist", limit: 30, windowSeconds: 3600 }),
  async (c) => {
    const id = c.req.param("id");
    const { action, input, otherTechPackId } = await parseBody(c, assistSchema);

    const ctx = await buildTechPackContext(c.env.DB, id);
    if (!ctx) return c.json({ error: "Tech pack not found" }, 404);
    let otherCtx: string | undefined;
    if (action === "compare_versions") {
      if (!otherTechPackId) return c.json({ error: "otherTechPackId required for compare" }, 400);
      otherCtx = (await buildTechPackContext(c.env.DB, otherTechPackId)) ?? undefined;
      if (!otherCtx) return c.json({ error: "Comparison tech pack not found" }, 404);
    }

    const spec = ACTION_SPECS[action];
    let resultJson: unknown;
    let raw;
    try {
      raw = await askClaude(c.env, {
        system: SYSTEM,
        prompt: spec.buildPrompt(ctx, input, otherCtx),
      });
      resultJson = parseModelJson(raw.text);
    } catch (err) {
      if (err instanceof AnthropicNotConfiguredError) {
        return c.json(
          { error: "AI assist needs ANTHROPIC_API_KEY (wrangler secret put ANTHROPIC_API_KEY)." },
          503,
        );
      }
      throw err;
    }

    await run(
      c.env.DB,
      `INSERT INTO ai_generations
         (id, tech_pack_id, tool, model, prompt_text, output_kind, output_json, tokens_in, tokens_out)
       VALUES (?, ?, 'claude', ?, ?, 'json', ?, ?, ?)`,
      newId("gen"),
      id,
      raw.model,
      `tech-pack:${action}`,
      JSON.stringify(resultJson),
      raw.tokensIn,
      raw.tokensOut,
    );

    return c.json({
      action,
      result: resultJson,
      applicableSectionKind: spec.targetSectionKind,
      usage: { tokensIn: raw.tokensIn, tokensOut: raw.tokensOut, model: raw.model },
    });
  },
);
