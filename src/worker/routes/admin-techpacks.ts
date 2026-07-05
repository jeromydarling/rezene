import { Hono } from "hono";
import { all, first, jsonObject, run, writeAudit } from "../services/db";
import {
  parseBody,
  techPackCreateSchema,
  techPackSectionUpdateSchema,
} from "../services/validators";
import { requireAdminWrite } from "../middleware/auth";
import { newId } from "../utils/id";
import type { AppContext } from "../types/env";
import type { AdminTechPackDetail, AdminTechPackSummary } from "../../shared/types";

export const adminTechPackRoutes = new Hono<AppContext>();

/** Sections every new tech pack starts with, in factory-reading order. */
const DEFAULT_SECTIONS: { kind: string; title: string }[] = [
  { kind: "cover", title: "Cover" },
  { kind: "style_overview", title: "Style Overview" },
  { kind: "flat_sketch", title: "Flat Sketch / Reference" },
  { kind: "bom", title: "Bill of Materials" },
  { kind: "fabric_details", title: "Fabric Details" },
  { kind: "trim_details", title: "Trim Details" },
  { kind: "colorways", title: "Colorways" },
  { kind: "size_spec", title: "Size Specification" },
  { kind: "measurement_points", title: "Measurement Points" },
  { kind: "grading", title: "Grading Rules" },
  { kind: "construction", title: "Construction Notes" },
  { kind: "stitch_details", title: "Stitch Details" },
  { kind: "labels_packaging", title: "Labels & Packaging" },
  { kind: "care_label", title: "Care Label" },
  { kind: "qc_checklist", title: "QC Checklist" },
  { kind: "revision_history", title: "Revision History" },
];

const TP_SELECT = `
  SELECT tp.*, s.name AS style_name FROM tech_packs tp
  LEFT JOIN styles s ON s.id = tp.style_id`;

function mapSummary(row: Record<string, unknown>): AdminTechPackSummary {
  return {
    id: row.id as string,
    code: row.code as string,
    name: row.name as string,
    styleId: (row.style_id as string) ?? null,
    styleName: (row.style_name as string) ?? null,
    version: row.version as number,
    status: row.status as string,
    season: (row.season as string) ?? null,
    source: row.source as string,
    updatedAt: row.updated_at as string,
  };
}

adminTechPackRoutes.get("/", async (c) => {
  const rows = await all(c.env.DB, `${TP_SELECT} ORDER BY tp.updated_at DESC`);
  return c.json(rows.map(mapSummary));
});

adminTechPackRoutes.get("/:id", async (c) => {
  const row = await first<Record<string, unknown>>(
    c.env.DB,
    `${TP_SELECT} WHERE tp.id = ?`,
    c.req.param("id"),
  );
  if (!row) return c.json({ error: "Tech pack not found" }, 404);

  const sections = await all<Record<string, unknown>>(
    c.env.DB,
    `SELECT id, kind, title, content_json, sort_order FROM tech_pack_sections
     WHERE tech_pack_id = ? ORDER BY sort_order`,
    row.id,
  );
  const construction = await all<Record<string, unknown>>(
    c.env.DB,
    `SELECT id, area, note, note_fr FROM construction_notes WHERE tech_pack_id = ? ORDER BY sort_order`,
    row.id,
  );
  const stitches = await all<Record<string, unknown>>(
    c.env.DB,
    `SELECT id, operation, stitch_class, spi, thread, note FROM stitch_details
     WHERE tech_pack_id = ? ORDER BY sort_order`,
    row.id,
  );
  const labels = await all<Record<string, unknown>>(
    c.env.DB,
    `SELECT id, item, placement, material, note FROM labels_packaging
     WHERE tech_pack_id = ? ORDER BY sort_order`,
    row.id,
  );

  const detail: AdminTechPackDetail = {
    ...mapSummary(row),
    summary: (row.summary as string) ?? null,
    coverImageUrl: (row.cover_image_url as string) ?? null,
    sections: sections.map((s) => ({
      id: s.id as string,
      kind: s.kind as string,
      title: s.title as string,
      content: jsonObject(s.content_json),
      sortOrder: s.sort_order as number,
    })),
    constructionNotes: construction.map((n) => ({
      id: n.id as string,
      area: n.area as string,
      note: n.note as string,
      noteFr: (n.note_fr as string) ?? null,
    })),
    stitchDetails: stitches.map((s) => ({
      id: s.id as string,
      operation: s.operation as string,
      stitchClass: (s.stitch_class as string) ?? null,
      spi: (s.spi as string) ?? null,
      thread: (s.thread as string) ?? null,
      note: (s.note as string) ?? null,
    })),
    labelsPackaging: labels.map((l) => ({
      id: l.id as string,
      item: l.item as string,
      placement: (l.placement as string) ?? null,
      material: (l.material as string) ?? null,
      note: (l.note as string) ?? null,
    })),
  };
  return c.json(detail);
});

adminTechPackRoutes.post("/", requireAdminWrite, async (c) => {
  const body = await parseBody(c, techPackCreateSchema);
  const id = newId("tp");

  // Code: derive from style code when linked, otherwise from the id.
  let codeBase = id.toUpperCase();
  let seedOverview: Record<string, unknown> = {};
  if (body.styleId) {
    const style = await first<Record<string, unknown>>(
      c.env.DB,
      `SELECT style_code, name, description, fit_notes, fabric_summary, season FROM styles WHERE id = ?`,
      body.styleId,
    );
    if (!style) return c.json({ error: "Style not found" }, 404);
    codeBase = style.style_code as string;
    seedOverview = {
      description: style.description,
      fit: style.fit_notes,
      fabric: style.fabric_summary,
    };
  }
  const version = 1;
  const code = `TP-${codeBase}-v${version}`;

  await run(
    c.env.DB,
    `INSERT INTO tech_packs (id, style_id, code, name, version, status, season, source, summary, created_by)
     VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?)`,
    id,
    body.styleId ?? null,
    code,
    body.name,
    version,
    body.season ?? null,
    body.source ?? (body.styleId ? "style" : "blank"),
    body.summary ?? null,
    c.var.userId,
  );

  const stmts = DEFAULT_SECTIONS.map((s, i) =>
    c.env.DB.prepare(
      `INSERT INTO tech_pack_sections (id, tech_pack_id, kind, title, content_json, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind(
      newId("tps"),
      id,
      s.kind,
      s.title,
      s.kind === "style_overview" ? JSON.stringify(seedOverview) : "{}",
      i + 1,
    ),
  );
  await c.env.DB.batch(stmts);

  await run(
    c.env.DB,
    `INSERT INTO analytics_events (id, event, entity_type, entity_id) VALUES (?, 'tech_pack_created', 'tech_pack', ?)`,
    newId("evt"),
    id,
  );
  await writeAudit(c.env.DB, c.var.userId, "tech_pack.create", "tech_pack", id, { code });
  const row = await first(c.env.DB, `${TP_SELECT} WHERE tp.id = ?`, id);
  return c.json(mapSummary(row!), 201);
});

adminTechPackRoutes.patch("/:id/sections/:kind", requireAdminWrite, async (c) => {
  const { id, kind } = c.req.param();
  const body = await parseBody(c, techPackSectionUpdateSchema);
  const section = await first<{ id: string }>(
    c.env.DB,
    `SELECT id FROM tech_pack_sections WHERE tech_pack_id = ? AND kind = ?`,
    id,
    kind,
  );
  if (!section) return c.json({ error: "Section not found" }, 404);
  const sets: string[] = [`updated_at = datetime('now')`];
  const params: unknown[] = [];
  if (body.title !== undefined) {
    sets.push(`title = ?`);
    params.push(body.title);
  }
  if (body.content !== undefined) {
    sets.push(`content_json = ?`);
    params.push(JSON.stringify(body.content ?? {}));
  }
  await run(
    c.env.DB,
    `UPDATE tech_pack_sections SET ${sets.join(", ")} WHERE id = ?`,
    ...params,
    section.id,
  );
  await run(c.env.DB, `UPDATE tech_packs SET updated_at = datetime('now') WHERE id = ?`, id);
  await writeAudit(c.env.DB, c.var.userId, "tech_pack.section_update", "tech_pack", id, { kind });
  return c.json({ ok: true });
});

adminTechPackRoutes.patch("/:id", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as { status?: string; name?: string };
  const allowedStatus = ["draft", "in_review", "approved", "sent_to_factory", "superseded"];
  const sets: string[] = [];
  const params: unknown[] = [];
  if (body.status && allowedStatus.includes(body.status)) {
    sets.push(`status = ?`);
    params.push(body.status);
  }
  if (typeof body.name === "string" && body.name.length > 0 && body.name.length <= 200) {
    sets.push(`name = ?`);
    params.push(body.name);
  }
  if (sets.length === 0) return c.json({ error: "No valid fields to update" }, 400);
  sets.push(`updated_at = datetime('now')`);
  const result = await run(
    c.env.DB,
    `UPDATE tech_packs SET ${sets.join(", ")} WHERE id = ?`,
    ...params,
    id,
  );
  if (!result.meta.changes) return c.json({ error: "Tech pack not found" }, 404);
  await writeAudit(c.env.DB, c.var.userId, "tech_pack.update", "tech_pack", id, body);
  return c.json({ ok: true });
});
