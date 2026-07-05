import { Fragment, type ReactNode } from "react";

/**
 * Minimal, safe markdown renderer for trusted-ish editorial content
 * (headings, paragraphs, bold, lists, pipe tables). Renders to React
 * elements — never innerHTML — so script injection is structurally
 * impossible. Extend or swap for a full parser when content needs grow.
 */
export function Markdown({ text }: { text: string }) {
  const blocks = text.replaceAll("\\n", "\n").split(/\n{2,}/);
  return (
    <div className="space-y-5">
      {blocks.map((block, i) => (
        <Fragment key={i}>{renderBlock(block.trim())}</Fragment>
      ))}
    </div>
  );
}

function renderBlock(block: string): ReactNode {
  if (!block) return null;
  if (block.startsWith("## ")) {
    return <h2 className="font-display text-2xl font-light">{renderInline(block.slice(3))}</h2>;
  }
  if (block.startsWith("# ")) {
    return <h1 className="font-display text-3xl font-light">{renderInline(block.slice(2))}</h1>;
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
