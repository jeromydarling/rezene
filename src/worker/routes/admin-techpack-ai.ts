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

const fromImageSchema = z.object({
  fileId: z.string().min(1).max(80),
  name: z.string().max(200).optional(),
  styleId: z.string().max(80).nullable().optional(),
});

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function bufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/**
 * The wedge feature: upload a garment photo or sketch, get a draft tech
 * pack. Creates the pack with seeded sections (overview, BOM, colorways,
 * measurement points, construction, QC) that a human then reviews —
 * drafts, not gospel.
 */
adminTechPackAiRoutes.post(
  "/from-image",
  requireAdminWrite,
  rateLimit({ key: "ai-from-image", limit: 15, windowSeconds: 3600 }),
  async (c) => {
    const body = await parseBody(c, fromImageSchema);
    const fileRow = await first<{ r2_key: string; content_type: string | null; filename: string }>(
      c.env.DB,
      `SELECT r2_key, content_type, filename FROM files WHERE id = ?`,
      body.fileId,
    );
    if (!fileRow) return c.json({ error: "Uploaded file not found" }, 404);
    if (!fileRow.content_type || !IMAGE_TYPES.has(fileRow.content_type)) {
      return c.json({ error: "File must be a JPEG, PNG, WebP, or GIF image" }, 400);
    }
    const object = await c.env.FILES.get(fileRow.r2_key);
    if (!object) return c.json({ error: "Image missing from storage" }, 404);
    const buf = await object.arrayBuffer();
    if (buf.byteLength > MAX_IMAGE_BYTES) {
      return c.json({ error: "Image exceeds 5MB — resize and retry" }, 413);
    }

    let draft: Record<string, unknown>;
    let raw;
    try {
      raw = await askClaude(c.env, {
        system: SYSTEM,
        maxTokens: 4096,
        image: { base64: bufferToBase64(buf), mediaType: fileRow.content_type },
        prompt: `Analyze this garment photo or sketch and draft a first-pass tech pack for a Casablanca atelier. Be conservative: only state what is visible; mark guesses "TBC".

Respond as ONE JSON object:
{"name":"garment name","category":"trouser|polo|overshirt|dress|top|set|coverup|accessory|other","gender":"mens|womens|unisex","overview":{"description":"...","fit":"...","fabric":"visible fabric guess (TBC if unclear)","colorways":["..."]},"bom":{"rows":[{"component","material","qty","unit","note"}]},"construction":{"rows":[{"area","note"}]},"measurement_points":{"rows":[{"code","name","how_to_measure","tolerance_cm"}]},"qc_checklist":{"items":["..."]}}`,
      });
      draft = parseModelJson(raw.text) as Record<string, unknown>;
    } catch (err) {
      if (err instanceof AnthropicNotConfiguredError) {
        return c.json({ error: "AI needs ANTHROPIC_API_KEY configured." }, 503);
      }
      throw err;
    }

    // Create the pack + seed sections from the draft.
    const packId = newId("tp");
    const name =
      body.name || (typeof draft.name === "string" && draft.name ? draft.name : "Untitled from photo");
    const code = `TP-${packId.slice(3, 11).toUpperCase()}-v1`;
    await run(
      c.env.DB,
      `INSERT INTO tech_packs (id, style_id, code, name, version, status, source, summary, created_by)
       VALUES (?, ?, ?, ?, 1, 'draft', 'photo', ?, ?)`,
      packId,
      body.styleId ?? null,
      code,
      name.slice(0, 200),
      `Drafted by AI from ${fileRow.filename}. Review before sending to a factory.`,
      c.var.userId,
    );

    const sectionSeeds: { kind: string; title: string; content: unknown }[] = [
      { kind: "cover", title: "Cover", content: { style_name: name, brand: "", date: new Date().toISOString().slice(0, 10), source: "AI draft from photo" } },
      { kind: "style_overview", title: "Style Overview", content: draft.overview ?? {} },
      { kind: "bom", title: "Bill of Materials", content: draft.bom ?? {} },
      { kind: "measurement_points", title: "Measurement Points", content: draft.measurement_points ?? {} },
      { kind: "construction", title: "Construction Notes", content: draft.construction ?? {} },
      { kind: "qc_checklist", title: "QC Checklist", content: draft.qc_checklist ?? {} },
      { kind: "flat_sketch", title: "Flat Sketch / Reference", content: { reference_file: fileRow.filename } },
    ];
    await c.env.DB.batch(
      sectionSeeds.map((s, i) =>
        c.env.DB.prepare(
          `INSERT INTO tech_pack_sections (id, tech_pack_id, kind, title, content_json, sort_order)
           VALUES (?, ?, ?, ?, ?, ?)`,
        ).bind(newId("tps"), packId, s.kind, s.title, JSON.stringify(s.content), i + 1),
      ),
    );
    await run(
      c.env.DB,
      `INSERT INTO tech_pack_files (id, tech_pack_id, file_id, label, kind) VALUES (?, ?, ?, ?, 'reference')`,
      newId("tpf"),
      packId,
      body.fileId,
      "Source photo/sketch",
    );
    await run(
      c.env.DB,
      `INSERT INTO ai_generations (id, tech_pack_id, tool, model, prompt_text, output_kind, output_json, tokens_in, tokens_out)
       VALUES (?, ?, 'claude', ?, 'tech-pack:from-image', 'json', ?, ?, ?)`,
      newId("gen"),
      packId,
      raw.model,
      JSON.stringify(draft),
      raw.tokensIn,
      raw.tokensOut,
    );
    await run(
      c.env.DB,
      `INSERT INTO analytics_events (id, event, entity_type, entity_id) VALUES (?, 'tech_pack_created', 'tech_pack', ?)`,
      newId("evt"),
      packId,
    );
    return c.json({ id: packId, code, name }, 201);
  },
);

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
