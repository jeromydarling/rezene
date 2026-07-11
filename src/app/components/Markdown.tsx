import { Fragment, type ReactNode } from "react";

/**
 * Minimal, safe markdown renderer for trusted-ish editorial content
 * (headings, paragraphs, bold, lists, pipe tables, figures). Renders to
 * React elements — never innerHTML — so script injection is structurally
 * impossible. Extend or swap for a full parser when content needs grow.
 */

/** The block split the renderer uses — exported so features that walk the
 *  same text (the lesson audio reader) index blocks identically. */
export function markdownBlocks(text: string): string[] {
  return text
    .replaceAll("\\n", "\n")
    .split(/\n{2,}/)
    .map((b) => b.trim());
}

export function Markdown({
  text,
  headingBase = 1,
  activeBlock = null,
  onBlockSelect,
}: {
  text: string;
  headingBase?: 1 | 2;
  /** Index of the block to visually highlight (the audio reader's cursor). */
  activeBlock?: number | null;
  /** When set, blocks become clickable (jump the audio reader here). */
  onBlockSelect?: (index: number) => void;
}) {
  const blocks = markdownBlocks(text);
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
  if (activeBlock === null && !onBlockSelect) {
    return (
      <div className="space-y-5">
        {blocks.map((block, i) => (
          <Fragment key={i}>{renderBlock(block, levelFor)}</Fragment>
        ))}
      </div>
    );
  }
  // Audio-reader mode: each block gets a wrapper so the current paragraph can
  // glow and a click can jump the reader there.
  return (
    <div className="space-y-5">
      {blocks.map((block, i) => (
        <div
          key={i}
          onClick={onBlockSelect ? () => onBlockSelect(i) : undefined}
          className={`${onBlockSelect ? "cursor-pointer" : ""} ${
            activeBlock === i ? "-mx-2 rounded-md bg-navy/[0.06] px-2 py-1 ring-1 ring-navy/10" : ""
          }`.trim()}
        >
          {renderBlock(block, levelFor)}
        </div>
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
  // Figure: an image on its own block, optionally followed by an *italic*
  // caption line. Alt text carries the description; the caption the credit.
  const figure = block.match(/^!\[([^\]]*)\]\(([^)\s]+)\)\s*(?:\n\s*\*([^*]+)\*\s*)?$/);
  if (figure) {
    return (
      <figure>
        <img
          src={figure[2]}
          alt={figure[1]}
          loading="lazy"
          className="w-full rounded-lg border border-ink/10 bg-white"
        />
        {figure[3] && <figcaption className="mt-1.5 text-xs italic text-warmgrey">{figure[3]}</figcaption>}
      </figure>
    );
  }
  const heading = block.match(/^(#{1,4})\s+([\s\S]*)$/);
  if (heading) {
    const level = levelFor(heading[1].length);
    const Tag = `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
    return (
      <Tag className={HEADING_STYLES[Math.min(level, 4)]}>{renderInline(heading[2])}</Tag>
    );
  }
  const lines = block.split("\n");
  if (lines.every((l) => l.trim().startsWith(">"))) {
    const inner = lines.map((l) => l.replace(/^\s*>\s?/, "")).join(" ").trim();
    return (
      <blockquote className="border-l-2 border-navy/30 pl-4 text-[0.95em] text-ink/80 prose-editorial">
        {renderInline(inner)}
      </blockquote>
    );
  }
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
      <Fragment key={i}>{renderItalic(part)}</Fragment>
    ),
  );
}

function renderItalic(text: string): ReactNode {
  const parts = text.split(/(\*[^*\s][^*]*\*)/g);
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    part.length > 2 && part.startsWith("*") && part.endsWith("*") ? (
      <em key={i}>{part.slice(1, -1)}</em>
    ) : (
      part
    ),
  );
}
