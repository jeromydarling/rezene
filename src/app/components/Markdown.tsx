import { Fragment, type ReactNode } from "react";

/**
 * Minimal, safe markdown renderer for trusted-ish editorial content
 * (headings, paragraphs, bold, lists, pipe tables). Renders to React
 * elements — never innerHTML — so script injection is structurally
 * impossible. Extend or swap for a full parser when content needs grow.
 */
export function Markdown({ text, headingBase = 1 }: { text: string; headingBase?: 1 | 2 }) {
  const blocks = text
    .replaceAll("\\n", "\n")
    .split(/\n{2,}/)
    .map((b) => b.trim());
  // Accessible heading structure: when the page already owns the h1
  // (headingBase = 2), remap whatever depths the author used onto
  // sequential levels starting at h2 — no h1 collisions, no skips.
  const depths = [...new Set(
    blocks
      .map((b) => b.match(/^(#{1,4})\s/)?.[1].length)
      .filter((d): d is number => Boolean(d)),
  )].sort((a, b) => a - b);
  const levelFor = (depth: number): number =>
    headingBase === 2 ? Math.min(6, 2 + depths.indexOf(depth)) : Math.min(6, depth);
  return (
    <div className="space-y-5">
      {blocks.map((block, i) => (
        <Fragment key={i}>{renderBlock(block, levelFor)}</Fragment>
      ))}
    </div>
  );
}

const HEADING_STYLES: Record<number, string> = {
  1: "font-display text-3xl font-light",
  2: "font-display text-2xl font-light",
  3: "font-display text-xl font-light",
  4: "text-base font-semibold",
};

function renderBlock(block: string, levelFor: (depth: number) => number): ReactNode {
  if (!block) return null;
  const heading = block.match(/^(#{1,4})\s+([\s\S]*)$/);
  if (heading) {
    const level = levelFor(heading[1].length);
    const Tag = `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
    return (
      <Tag className={HEADING_STYLES[Math.min(level, 4)]}>{renderInline(heading[2])}</Tag>
    );
  }
  const lines = block.split("\n");
  if (lines.every((l) => l.trim().startsWith("- "))) {
    return (
      <ul className="list-disc space-y-1 pl-5 prose-editorial">
        {lines.map((l, i) => (
          <li key={i}>{renderInline(l.trim().slice(2))}</li>
        ))}
      </ul>
    );
  }
  if (lines.length >= 2 && lines[0].includes("|") && /^\s*\|?[\s|:-]+\|?\s*$/.test(lines[1])) {
    const parseRow = (row: string) =>
      row
        .split("|")
        .map((cell) => cell.trim())
        .filter((_, idx, arr) => !(idx === 0 && arr[0] === "") && !(idx === arr.length - 1 && arr[arr.length - 1] === ""));
    const header = parseRow(lines[0]);
    const rows = lines.slice(2).map(parseRow);
    return (
      <div className="overflow-x-auto">
        <table className="admin-table max-w-md">
          <thead>
            <tr>
              {header.map((h, i) => (
                <th key={i}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((cells, r) => (
              <tr key={r}>
                {cells.map((cell, ci) => (
                  <td key={ci}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return <p className="prose-editorial">{renderInline(lines.join(" "))}</p>;
}

function renderInline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="font-semibold">
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    ),
  );
}
