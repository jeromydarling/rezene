import * as XLSX from "xlsx";
import { all, first } from "./db";

/**
 * Factory-ready Excel export. Factories still live in spreadsheets — the
 * incumbent tools either gate Excel behind top tiers or tell users to
 * convert PDFs by hand, so this is a wedge feature: every tech pack
 * exports a real multi-sheet workbook, current as of the moment it's
 * downloaded (no stale snapshots), from the admin or the factory portal.
 */

interface PackRow {
  id: string;
  style_id: string | null;
  code: string;
  name: string;
  version: number;
  season: string | null;
  summary: string | null;
}

export async function buildTechPackXlsx(
  db: D1Database,
  techPackId: string,
  brandName: string,
): Promise<{ filename: string; bytes: ArrayBuffer } | null> {
  const pack = await first<PackRow>(
    db,
    `SELECT id, style_id, code, name, version, season, summary FROM tech_packs WHERE id = ?`,
    techPackId,
  );
  if (!pack) return null;

  const wb = XLSX.utils.book_new();
  const sheet = (name: string, rows: (string | number | null)[][], widths?: number[]) => {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    if (widths) ws["!cols"] = widths.map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  };

  // ---- Overview ----
  sheet(
    "Overview",
    [
      [brandName, "Technical Specification"],
      [],
      ["Tech pack", pack.name],
      ["Code", pack.code],
      ["Version", pack.version],
      ["Season", pack.season ?? ""],
      ["Summary", pack.summary ?? ""],
      ["Exported", new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC"],
      [],
      ["Sheets", "Measurements (graded, with tolerances) · BOM · Construction (EN/FR) · Stitch Details · Labels & Packaging"],
    ],
    [16, 80],
  );

  // ---- Measurements: POM × size run, values graded from base via rules ----
  if (pack.style_id) {
    const specs = await all<{ id: string; name: string; base_size: string; size_run: string; unit: string }>(
      db,
      `SELECT id, name, base_size, size_run, unit FROM size_specs WHERE style_id = ? ORDER BY created_at`,
      pack.style_id,
    );
    for (const spec of specs) {
      let sizes: string[] = [];
      try {
        sizes = JSON.parse(spec.size_run) as string[];
      } catch {
        sizes = [spec.base_size];
      }
      const baseIdx = Math.max(0, sizes.indexOf(spec.base_size));
      const points = await all<{
        id: string;
        code: string;
        name: string;
        how_to_measure: string | null;
        base_value: number | null;
        tolerance: number | null;
      }>(
        db,
        `SELECT id, code, name, how_to_measure, base_value, tolerance
         FROM measurement_points WHERE size_spec_id = ? ORDER BY sort_order`,
        spec.id,
      );
      const grading = await all<{ measurement_point_id: string; step_value: number }>(
        db,
        `SELECT measurement_point_id, step_value FROM grading_rules WHERE size_spec_id = ?`,
        spec.id,
      );
      const stepFor = new Map(grading.map((g) => [g.measurement_point_id, g.step_value]));
      const header = ["POM", "Point of measure", "How to measure", `Tol ± (${spec.unit})`, ...sizes.map((s) => (s === spec.base_size ? `${s} (base)` : s))];
      const rows: (string | number | null)[][] = [header];
      for (const p of points) {
        const step = stepFor.get(p.id);
        const graded = sizes.map((_, i) => {
          if (p.base_value == null) return null;
          if (step == null) return i === baseIdx ? p.base_value : null;
          return Math.round((p.base_value + step * (i - baseIdx)) * 100) / 100;
        });
        rows.push([p.code, p.name, p.how_to_measure ?? "", p.tolerance ?? null, ...graded]);
      }
      rows.push([]);
      rows.push(["Notes", `Unit: ${spec.unit}. Sizes graded from base ${spec.base_size} by per-POM rules; blank cells have no grade rule — confirm before cutting.`]);
      sheet(`Measurements ${spec.name}`.slice(0, 31), rows, [8, 28, 40, 10, ...sizes.map(() => 9)]);
    }

    // ---- BOM ----
    const bom = await all<{
      component: string;
      material_type: string;
      quantity: number | null;
      unit: string | null;
      placement: string | null;
      supplier_note: string | null;
      fabric_name: string | null;
      fabric_comp: string | null;
      trim_name: string | null;
      trim_spec: string | null;
    }>(
      db,
      `SELECT b.component, b.material_type, b.quantity, b.unit, b.placement, b.supplier_note,
              f.name AS fabric_name, f.composition AS fabric_comp, t.name AS trim_name, t.spec AS trim_spec
       FROM bom_items b
       LEFT JOIN fabrics f ON f.id = b.fabric_id
       LEFT JOIN trims t ON t.id = b.trim_id
       WHERE b.style_id = ? ORDER BY b.component`,
      pack.style_id,
    );
    sheet(
      "BOM",
      [
        ["Component", "Type", "Material", "Composition / spec", "Qty", "Unit", "Placement", "Supplier note"],
        ...bom.map((b) => [
          b.component,
          b.material_type,
          b.fabric_name ?? b.trim_name ?? "",
          b.fabric_comp ?? b.trim_spec ?? "",
          b.quantity,
          b.unit ?? "",
          b.placement ?? "",
          b.supplier_note ?? "",
        ]),
      ],
      [24, 10, 26, 30, 7, 7, 22, 34],
    );
  }

  // ---- Construction (EN/FR) ----
  const construction = await all<{ area: string; note: string; note_fr: string | null }>(
    db,
    `SELECT area, note, note_fr FROM construction_notes WHERE tech_pack_id = ? ORDER BY sort_order`,
    pack.id,
  );
  sheet(
    "Construction",
    [["Area", "Note (EN)", "Note (FR)"], ...construction.map((n) => [n.area, n.note, n.note_fr ?? ""])],
    [22, 52, 52],
  );

  // ---- Stitch details ----
  const stitches = await all<{ operation: string; stitch_class: string | null; spi: string | null; thread: string | null; note: string | null }>(
    db,
    `SELECT operation, stitch_class, spi, thread, note FROM stitch_details WHERE tech_pack_id = ? ORDER BY sort_order`,
    pack.id,
  );
  sheet(
    "Stitch Details",
    [["Operation", "Stitch class", "SPI", "Thread", "Note"], ...stitches.map((s) => [s.operation, s.stitch_class ?? "", s.spi ?? "", s.thread ?? "", s.note ?? ""])],
    [30, 14, 8, 18, 40],
  );

  // ---- Labels & packaging ----
  const labels = await all<{ item: string; placement: string | null; material: string | null; note: string | null }>(
    db,
    `SELECT item, placement, material, note FROM labels_packaging WHERE tech_pack_id = ? ORDER BY sort_order`,
    pack.id,
  );
  sheet(
    "Labels & Packaging",
    [["Item", "Placement", "Material", "Note"], ...labels.map((l) => [l.item, l.placement ?? "", l.material ?? "", l.note ?? ""])],
    [26, 28, 22, 40],
  );

  const bytes = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return { filename: `${pack.code}-v${pack.version}.xlsx`, bytes };
}
