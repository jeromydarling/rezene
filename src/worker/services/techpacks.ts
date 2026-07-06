/**
 * Shared tech-pack helpers: the default section skeleton and a one-call
 * creator, so both the Tech Packs module and the Design Studio's send-to-maker
 * flow build identical packs.
 */
import { newId } from "../utils/id";
import { run } from "./db";
import type { D1Database } from "@cloudflare/workers-types";

export const DEFAULT_SECTIONS: { kind: string; title: string }[] = [
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

/** Create a draft tech pack for a style, seeded with the default sections. */
export async function createTechPackForStyle(
  db: D1Database,
  opts: {
    styleId: string;
    styleCode: string;
    name: string;
    coverImageUrl?: string | null;
    source?: string;
    seedOverview?: Record<string, unknown>;
    createdBy?: string | null;
  },
): Promise<string> {
  const id = newId("tp");
  const code = `TP-${opts.styleCode}-v1`;
  await run(
    db,
    `INSERT INTO tech_packs (id, style_id, code, name, version, status, source, cover_image_url, created_by)
     VALUES (?, ?, ?, ?, 1, 'draft', ?, ?, ?)`,
    id,
    opts.styleId,
    code,
    opts.name,
    opts.source ?? "ai_concept",
    opts.coverImageUrl ?? null,
    opts.createdBy ?? null,
  );
  const flat = opts.coverImageUrl ? { imageUrl: opts.coverImageUrl } : {};
  await db.batch(
    DEFAULT_SECTIONS.map((s, i) =>
      db
        .prepare(
          `INSERT INTO tech_pack_sections (id, tech_pack_id, kind, title, content_json, sort_order)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          newId("tps"),
          id,
          s.kind,
          s.title,
          s.kind === "style_overview"
            ? JSON.stringify(opts.seedOverview ?? {})
            : s.kind === "flat_sketch"
              ? JSON.stringify(flat)
              : "{}",
          i + 1,
        ),
    ),
  );
  return id;
}
