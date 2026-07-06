import { Fragment, type ReactNode } from "react";
import type { KbHeading } from "./types";

/**
 * Docs-grade markdown renderer for the Knowledge Base. Renders to React
 * elements (never innerHTML) so injection is structurally impossible.
 * Supports: #..#### headings with stable anchor ids, paragraphs, **bold**,
 * `inline code`, [links](url), ![images](src "caption"), - and 1. lists,
 * pipe tables, > blockquotes, typed callouts (> [!NOTE|TIP|WARNING|SUCCESS]),
 * and ``` fenced code blocks.
 */

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[`*_[\]()]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 64);
}

/** Pull headings (h2/h3) for the "On this page" rail, with de-duped ids. */
export function extractHeadings(md: string): KbHeading[] {
  const seen = new Map<string, number>();
  const out: KbHeading[] = [];
  for (const raw of md.replaceAll("\\n", "\n").split("\n")) {
    const m = raw.match(/^(#{1,4})\s+(.*)$/);
    if (!m) continue;
    const level = m[1].length;
    if (level < 2 || level > 3) continue; // only h2/h3 in the rail
    const text = stripInline(m[2].trim());
    let id = slugify(text);
    if (seen.has(id)) {
      const n = seen.get(id)! + 1;
      seen.set(id, n);
      id = `${id}-${n}`;
    } else {
      seen.set(id, 1);
    }
    out.push({ id, text, level });
  }
  return out;
}

function stripInline(t: string): string {
  return t.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/`([^`]+)`/g, "$1").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}

const HEADING_STYLES: Record<number, string> = {
  1: "font-display text-3xl font-light mt-2",
  2: "font-display text-2xl font-light mt-8 mb-1 scroll-mt-24",
  3: "font-display text-xl font-light mt-6 mb-1 scroll-mt-24",
  4: "text-base font-semibold mt-4",
};

const CALLOUT: Record<string, { cls: string; label: string; icon: string }> = {
  NOTE: { cls: "border-navy/25 bg-navy/[0.04]", label: "Note", icon: "ℹ️" },
  TIP: { cls: "border-palm/30 bg-palm/[0.06]", label: "Tip", icon: "💡" },
  WARNING: { cls: "border-saffron/40 bg-saffron/[0.08]", label: "Watch out", icon: "⚠️" },
  SUCCESS: { cls: "border-palm/30 bg-palm/[0.06]", label: "Nice", icon: "✅" },
};

export function KbMarkdown({ text }: { text: string }) {
  const src = text.replaceAll("\\n", "\n");
  const blocks = splitBlocks(src);
  const seen = new Map<string, number>();
  const headingId = (t: string): string => {
    let id = slugify(t);
    if (seen.has(id)) {
      const n = seen.get(id)! + 1;
      seen.set(id, n);
      id = `${id}-${n}`;
    } else seen.set(id, 1);
    return id;
  };
  return (
    <div className="space-y-4">
      {blocks.map((block, i) => (
        <Fragment key={i}>{renderBlock(block, headingId)}</Fragment>
      ))}
    </div>
  );
}

/** Split into blocks, keeping fenced code intact even with blank lines inside. */
function splitBlocks(src: string): string[] {
  const lines = src.split("\n");
  const blocks: string[] = [];
  let buf: string[] = [];
  let inFence = false;
  const flush = () => {
    if (buf.length && buf.join("\n").trim()) blocks.push(buf.join("\n"));
    buf = [];
  };
  for (const line of lines) {
    if (line.trimStart().startsWith("```")) {
      if (!inFence) {
        flush();
        inFence = true;
        buf.push(line);
      } else {
        buf.push(line);
        blocks.push(buf.join("\n"));
        buf = [];
        inFence = false;
      }
      continue;
    }
    if (inFence) {
      buf.push(line);
      continue;
    }
    if (line.trim() === "") flush();
    else buf.push(line);
  }
  flush();
  return blocks;
}

function renderBlock(block: string, headingId: (t: string) => string): ReactNode {
  const trimmed = block.trim();
  if (!trimmed) return null;

  // Fenced code
  if (trimmed.startsWith("```")) {
    const inner = trimmed.replace(/^```[^\n]*\n?/, "").replace(/```$/, "");
    return (
      <pre className="overflow-x-auto rounded-lg bg-ink/[0.92] p-4 text-xs leading-relaxed text-chalk">
        <code>{inner}</code>
      </pre>
    );
  }

  // Heading
  const heading = trimmed.match(/^(#{1,4})\s+([\s\S]*)$/);
  if (heading) {
    const level = heading[1].length;
    const plain = stripInline(heading[2].trim());
    const id = level >= 2 && level <= 3 ? headingId(plain) : undefined;
    const Tag = `h${Math.min(level, 6)}` as "h1" | "h2" | "h3" | "h4";
    return (
      <Tag id={id} className={HEADING_STYLES[Math.min(level, 4)]}>
        {renderInline(heading[2])}
      </Tag>
    );
  }

  // Standalone image → figure with optional caption from title text
  const img = trimmed.match(/^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)$/);
  if (img) {
    return (
      <figure className="my-5 overflow-hidden rounded-xl border border-ink/10 bg-cream/40">
        <img src={img[2]} alt={img[1]} loading="lazy" className="block w-full" />
        {(img[3] || img[1]) && (
          <figcaption className="border-t border-ink/8 px-4 py-2 text-xs text-warmgrey">
            {img[3] || img[1]}
          </figcaption>
        )}
      </figure>
    );
  }

  const lines = trimmed.split("\n");

  // Callout / blockquote
  if (lines.every((l) => l.trim().startsWith(">"))) {
    const body = lines.map((l) => l.replace(/^\s*>\s?/, "")).join("\n");
    const typed = body.match(/^\[!(NOTE|TIP|WARNING|SUCCESS)\]\s*([\s\S]*)$/);
    const kind = typed ? CALLOUT[typed[1]] : null;
    const content = typed ? typed[2].trim() : body;
    return (
      <div className={`rounded-lg border px-4 py-3 text-sm ${kind ? kind.cls : "border-ink/15 bg-cream/50"}`}>
        {kind && (
          <p className="mb-1 text-xs font-semibold">
            {kind.icon} {kind.label}
          </p>
        )}
        <div className="space-y-2 text-ink/80">
          {content.split("\n").map((p, i) => (
            <p key={i}>{renderInline(p)}</p>
          ))}
        </div>
      </div>
    );
  }

  // Ordered list
  if (lines.every((l) => /^\d+\.\s/.test(l.trim()))) {
    return (
      <ol className="list-decimal space-y-1.5 pl-5 prose-editorial">
        {lines.map((l, i) => (
          <li key={i}>{renderInline(l.trim().replace(/^\d+\.\s/, ""))}</li>
        ))}
      </ol>
    );
  }

  // Unordered list
  if (lines.every((l) => l.trim().startsWith("- "))) {
    return (
      <ul className="list-disc space-y-1.5 pl-5 prose-editorial">
        {lines.map((l, i) => (
          <li key={i}>{renderInline(l.trim().slice(2))}</li>
        ))}
      </ul>
    );
  }

  // Pipe table
  if (lines.length >= 2 && lines[0].includes("|") && /^\s*\|?[\s|:-]+\|?\s*$/.test(lines[1])) {
    const parseRow = (row: string) =>
      row
        .split("|")
        .map((c) => c.trim())
        .filter((_, idx, arr) => !(idx === 0 && arr[0] === "") && !(idx === arr.length - 1 && arr[arr.length - 1] === ""));
    const header = parseRow(lines[0]);
    const rows = lines.slice(2).map(parseRow);
    return (
      <div className="overflow-x-auto">
        <table className="admin-table">
          <thead>
            <tr>{header.map((h, i) => <th key={i}>{renderInline(h)}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((cells, r) => (
              <tr key={r}>{cells.map((c, ci) => <td key={ci}>{renderInline(c)}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return <p className="prose-editorial leading-relaxed">{renderInline(lines.join(" "))}</p>;
}

/** Inline: **bold**, `code`, [text](url), ![img](src) inline, and plain text. */
function renderInline(text: string): ReactNode {
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g);
  return tokens.map((tok, i) => {
    if (tok.startsWith("**") && tok.endsWith("**")) {
      return <strong key={i} className="font-semibold text-ink">{tok.slice(2, -2)}</strong>;
    }
    if (tok.startsWith("`") && tok.endsWith("`")) {
      return (
        <code key={i} className="rounded bg-ink/[0.06] px-1.5 py-0.5 font-mono text-[0.85em]">
          {tok.slice(1, -1)}
        </code>
      );
    }
    const link = tok.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      const href = link[2];
      const external = /^https?:\/\//.test(href);
      return (
        <a
          key={i}
          href={href}
          {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
          className="text-navy underline decoration-navy/30 underline-offset-2 hover:decoration-navy"
        >
          {link[1]}
          {external ? " ↗" : ""}
        </a>
      );
    }
    return <Fragment key={i}>{tok}</Fragment>;
  });
}
