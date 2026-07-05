import type { AdminTechPackDetail } from "../../shared/types";

/**
 * Server-side tech pack renderer: a self-contained, print-ready HTML
 * document (inline CSS, no scripts, no external requests) suitable for
 * storing as an R2 export snapshot, attaching to factory email, or
 * printing to PDF from any browser.
 *
 * All dynamic values pass through esc() — content is user/AI-authored.
 */

function esc(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function titleCase(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function renderTable(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  return `<table>
    <thead><tr>${cols.map((col) => `<th>${esc(titleCase(col))}</th>`).join("")}</tr></thead>
    <tbody>${rows
      .map(
        (row) => `<tr>${cols.map((col) => `<td>${esc(row[col] ?? "—")}</td>`).join("")}</tr>`,
      )
      .join("")}</tbody>
  </table>`;
}

function renderSectionContent(content: unknown): string {
  if (!content || typeof content !== "object") return "";
  const obj = content as Record<string, unknown>;
  const parts: string[] = [];
  if (Array.isArray(obj.rows) && obj.rows.length > 0) {
    parts.push(renderTable(obj.rows as Record<string, unknown>[]));
  }
  if (Array.isArray(obj.items) && obj.items.length > 0) {
    parts.push(
      `<ul>${(obj.items as unknown[]).map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`,
    );
  }
  const scalars = Object.entries(obj).filter(
    ([k, v]) => k !== "rows" && k !== "items" && v != null && typeof v !== "object",
  );
  if (scalars.length > 0) {
    parts.push(
      `<dl>${scalars
        .map(([k, v]) => `<dt>${esc(titleCase(k))}</dt><dd>${esc(v)}</dd>`)
        .join("")}</dl>`,
    );
  }
  const lists = Object.entries(obj).filter(([k, v]) => k !== "rows" && k !== "items" && Array.isArray(v));
  for (const [k, v] of lists) {
    parts.push(
      `<p class="listline"><strong>${esc(titleCase(k))}:</strong> ${esc((v as unknown[]).join(", "))}</p>`,
    );
  }
  return parts.join("\n");
}

export function renderTechPackHtml(tp: AdminTechPackDetail, brandName: string): string {
  const filledSections = tp.sections.filter(
    (s) => s.content && typeof s.content === "object" && Object.keys(s.content as object).length > 0,
  );

  const sectionsHtml = filledSections
    .map(
      (s) => `<section>
        <h2>${esc(s.title)}</h2>
        ${renderSectionContent(s.content)}
      </section>`,
    )
    .join("\n");

  const constructionHtml = tp.constructionNotes.length
    ? `<section><h2>Construction Notes (EN / FR)</h2>${renderTable(
        tp.constructionNotes.map((n) => ({ area: n.area, note: n.note, "note (FR)": n.noteFr ?? "—" })),
      )}</section>`
    : "";
  const stitchesHtml = tp.stitchDetails.length
    ? `<section><h2>Stitch Details</h2>${renderTable(
        tp.stitchDetails.map((s) => ({
          operation: s.operation,
          "stitch class": s.stitchClass ?? "—",
          spi: s.spi ?? "—",
          thread: s.thread ?? "—",
          note: s.note ?? "—",
        })),
      )}</section>`
    : "";
  const labelsHtml = tp.labelsPackaging.length
    ? `<section><h2>Labels &amp; Packaging</h2>${renderTable(
        tp.labelsPackaging.map((l) => ({
          item: l.item,
          placement: l.placement ?? "—",
          material: l.material ?? "—",
          note: l.note ?? "—",
        })),
      )}</section>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(tp.code)} — ${esc(tp.name)}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #23201b; background: #fff;
         max-width: 860px; margin: 0 auto; padding: 40px 32px; line-height: 1.5; }
  header { text-align: center; border-bottom: 2px solid #23201b; padding-bottom: 24px; margin-bottom: 32px; }
  .eyebrow { font-family: Helvetica, Arial, sans-serif; font-size: 10px; letter-spacing: 0.18em;
             text-transform: uppercase; color: #8c8577; margin: 0 0 8px; }
  h1 { font-weight: 300; font-size: 30px; margin: 0; }
  .meta { font-family: Helvetica, Arial, sans-serif; font-size: 12px; color: #8c8577; margin-top: 8px; }
  .summary { max-width: 560px; margin: 12px auto 0; font-size: 14px; color: #444; }
  section { margin: 28px 0; break-inside: avoid; }
  h2 { font-family: Helvetica, Arial, sans-serif; font-size: 12px; letter-spacing: 0.08em;
       text-transform: uppercase; border-bottom: 1px solid #d9d2c4; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; font-family: Helvetica, Arial, sans-serif; font-size: 12.5px; }
  th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em;
       color: #8c8577; border-bottom: 1px solid #d9d2c4; padding: 6px 8px; }
  td { border-bottom: 1px solid #efeadd; padding: 7px 8px; vertical-align: top; }
  ul { font-family: Helvetica, Arial, sans-serif; font-size: 13px; padding-left: 20px; }
  li { margin: 3px 0; }
  dl { display: grid; grid-template-columns: 160px 1fr; gap: 4px 16px;
       font-family: Helvetica, Arial, sans-serif; font-size: 13px; }
  dt { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: #8c8577; padding-top: 2px; }
  dd { margin: 0; }
  .listline { font-family: Helvetica, Arial, sans-serif; font-size: 13px; }
  footer { margin-top: 40px; border-top: 1px solid #d9d2c4; padding-top: 12px; text-align: center;
           font-family: Helvetica, Arial, sans-serif; font-size: 10px; color: #8c8577; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
<header>
  <p class="eyebrow">${esc(brandName)} — Technical Specification</p>
  <h1>${esc(tp.name)}</h1>
  <p class="meta">${esc(tp.code)} · Version ${esc(tp.version)}${tp.season ? ` · ${esc(tp.season)}` : ""}${tp.styleName ? ` · Style: ${esc(tp.styleName)}` : ""}</p>
  ${tp.summary ? `<p class="summary">${esc(tp.summary)}</p>` : ""}
</header>
${sectionsHtml}
${constructionHtml}
${stitchesHtml}
${labelsHtml}
<footer>Generated by the ${esc(brandName)} brand OS · ${esc(new Date().toISOString().slice(0, 10))} · Status: ${esc(tp.status)}</footer>
</body>
</html>`;
}
