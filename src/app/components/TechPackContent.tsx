import { titleCase } from "../lib/format";

/** Render structured section JSON generically: rows, items, or key-value. */
export function SectionContent({ content }: { content: unknown }) {
  if (!content || typeof content !== "object") return null;
  const obj = content as Record<string, unknown>;

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
