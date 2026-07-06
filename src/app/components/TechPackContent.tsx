import { titleCase } from "../lib/format";

export interface SketchAnnotation {
  n: number;
  x: number; // percent 0-100
  y: number; // percent 0-100
  text: string;
}

/**
 * Read-only annotated flat sketch: the reference image with numbered
 * callout pins and a legend beneath. Techpacker and Backbone gate this
 * behind their editors; here it renders anywhere a tech pack is shown —
 * admin, print, and the factory portal — from the same JSON.
 */
export function AnnotatedSketch({
  imageUrl,
  annotations,
  caption,
}: {
  imageUrl: string;
  annotations: SketchAnnotation[];
  caption?: string;
}) {
  const sorted = [...annotations].sort((a, b) => a.n - b.n);
  return (
    <div className="space-y-3">
      <div className="relative inline-block max-w-full">
        <img src={imageUrl} alt={caption ?? "Flat sketch"} className="max-h-[70vh] w-auto rounded border border-ink/10" />
        {sorted.map((a) => (
          <span
            key={a.n}
            className="absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-terracotta text-[0.7rem] font-bold text-white shadow"
            style={{ left: `${a.x}%`, top: `${a.y}%` }}
            aria-hidden
          >
            {a.n}
          </span>
        ))}
      </div>
      {sorted.length > 0 && (
        <ol className="space-y-1 text-sm">
          {sorted.map((a) => (
            <li key={a.n} className="flex gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-terracotta text-[0.65rem] font-bold text-white">
                {a.n}
              </span>
              <span className="text-ink/85">{a.text}</span>
            </li>
          ))}
        </ol>
      )}
      {caption && <p className="text-xs text-warmgrey">{caption}</p>}
    </div>
  );
}

/** Render structured section JSON generically: rows, items, or key-value. */
export function SectionContent({ content }: { content: unknown }) {
  if (!content || typeof content !== "object") return null;
  const obj = content as Record<string, unknown>;

  // Annotated flat sketch: { imageUrl, annotations: [{n,x,y,text}] }
  if (typeof obj.imageUrl === "string" && obj.imageUrl) {
    const annotations = Array.isArray(obj.annotations) ? (obj.annotations as SketchAnnotation[]) : [];
    return (
      <AnnotatedSketch
        imageUrl={obj.imageUrl}
        annotations={annotations}
        caption={typeof obj.caption === "string" ? obj.caption : undefined}
      />
    );
  }

  if (Array.isArray(obj.rows) && obj.rows.length > 0) {
    const rows = obj.rows as Record<string, unknown>[];
    const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
    return (
      <table className="admin-table">
        <thead>
          <tr>
            {cols.map((col) => (
              <th key={col}>{titleCase(col)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {cols.map((col) => (
                <td key={col}>{String(row[col] ?? "—")}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  if (Array.isArray(obj.items) && obj.items.length > 0) {
    return (
      <ul className="list-disc space-y-1 pl-5 text-sm text-ink/85">
        {(obj.items as unknown[]).map((item, i) => (
          <li key={i}>{String(item)}</li>
        ))}
      </ul>
    );
  }
  const entries = Object.entries(obj).filter(
    ([k, v]) => k !== "rows" && k !== "items" && v != null && typeof v !== "object",
  );
  const listEntries = Object.entries(obj).filter(([, v]) => Array.isArray(v));
  return (
    <div className="space-y-2">
      {entries.length > 0 && (
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          {entries.map(([k, v]) => (
            <div key={k}>
              <dt className="text-[0.68rem] font-semibold uppercase tracking-wider text-warmgrey">
                {titleCase(k)}
              </dt>
              <dd className="text-ink/85">{String(v)}</dd>
            </div>
          ))}
        </dl>
      )}
      {listEntries.map(([k, v]) => (
        <div key={k} className="text-sm">
          <p className="text-[0.68rem] font-semibold uppercase tracking-wider text-warmgrey">
            {titleCase(k)}
          </p>
          <p className="text-ink/85">{(v as unknown[]).map(String).join(", ")}</p>
        </div>
      ))}
    </div>
  );
}
