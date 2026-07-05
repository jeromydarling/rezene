import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router";
import { useFetch } from "../../lib/useFetch";
import { useBrand } from "../../lib/brand";
import { api, ApiRequestError } from "../../lib/api";
import { formatDate, titleCase } from "../../lib/format";
import {
  EmptyState,
  ErrorNote,
  LoadingTable,
  PageHeader,
  SlideOver,
  StatusBadge,
} from "../../components/admin/ui";
import type {
  AdminStyle,
  AdminTechPackDetail,
  AdminTechPackSummary,
} from "../../../shared/types";

export function TechPacksPage() {
  const { data, loading, error, reload } = useFetch<AdminTechPackSummary[]>("/api/admin/tech-packs");
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div>
      <PageHeader
        eyebrow="Studio"
        title="Tech Packs"
        description="Factory-ready specifications. Printable, versioned, and (soon) AI-assisted."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setCreateOpen(true)}>
            New tech pack
          </button>
        }
      />
      {error && <ErrorNote message={error} />}
      {loading && <LoadingTable />}
      {data && data.length === 0 && (
        <EmptyState
          title="No tech packs"
          hint="A style without a tech pack is a sketch. Create one from a style to seed its overview."
        />
      )}
      {data && data.length > 0 && (
        <div className="admin-card overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Style</th>
                <th>Version</th>
                <th>Source</th>
                <th>Status</th>
                <th>Updated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.map((tp) => (
                <tr key={tp.id}>
                  <td className="font-mono text-xs">{tp.code}</td>
                  <td className="font-medium">{tp.name}</td>
                  <td>{tp.styleName ?? "—"}</td>
                  <td>v{tp.version}</td>
                  <td>{titleCase(tp.source)}</td>
                  <td>
                    <StatusBadge status={tp.status} />
                  </td>
                  <td className="text-xs text-warmgrey">{formatDate(tp.updatedAt)}</td>
                  <td>
                    <Link to={`/admin/tech-packs/${tp.id}`} className="link-quiet text-xs">
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <SlideOver open={createOpen} title="New tech pack" onClose={() => setCreateOpen(false)}>
        <TechPackCreateForm
          onCreated={() => {
            setCreateOpen(false);
            reload();
          }}
        />
      </SlideOver>
    </div>
  );
}

function TechPackCreateForm({ onCreated }: { onCreated: () => void }) {
  const { data: styles } = useFetch<AdminStyle[]>("/api/admin/styles");
  const [form, setForm] = useState({ name: "", styleId: "", season: "SS27", summary: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/admin/tech-packs", {
        name: form.name,
        styleId: form.styleId || undefined,
        season: form.season || undefined,
        summary: form.summary || undefined,
        source: form.styleId ? "style" : "blank",
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label">Name *</label>
        <input
          required
          className="input"
          placeholder="Tangier Trouser — Tech Pack"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </div>
      <div>
        <label className="label">From style (seeds the overview)</label>
        <select
          className="input"
          value={form.styleId}
          onChange={(e) => setForm({ ...form, styleId: e.target.value })}
        >
          <option value="">Blank tech pack</option>
          {styles?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.styleCode} — {s.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Season</label>
        <input
          className="input"
          value={form.season}
          onChange={(e) => setForm({ ...form, season: e.target.value })}
        />
      </div>
      <div>
        <label className="label">Summary</label>
        <textarea
          rows={3}
          className="input"
          value={form.summary}
          onChange={(e) => setForm({ ...form, summary: e.target.value })}
        />
      </div>
      {error && <p className="field-error">{error}</p>}
      <button type="submit" disabled={busy} className="btn btn-primary w-full">
        {busy ? "Creating…" : "Create tech pack"}
      </button>
    </form>
  );
}

interface TechPackExportRow {
  id: string;
  format: string;
  r2_key: string;
  version: number;
  created_at: string;
  exported_by: string | null;
}

/** Detail view doubles as the print-ready export (window.print → PDF). */
export function TechPackDetailPage() {
  const { id } = useParams();
  const brand = useBrand();
  const { data, loading, error } = useFetch<AdminTechPackDetail>(
    id ? `/api/admin/tech-packs/${id}` : null,
  );
  const exports = useFetch<TechPackExportRow[]>(id ? `/api/admin/tech-packs/${id}/exports` : null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  async function exportSnapshot() {
    if (!id) return;
    setExporting(true);
    setExportError(null);
    try {
      await api.post(`/api/admin/tech-packs/${id}/export`);
      exports.reload();
    } catch (err) {
      setExportError(err instanceof ApiRequestError ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  if (loading) return <LoadingTable rows={8} />;
  if (error) return <ErrorNote message={error} />;
  if (!data) return null;

  const filledSections = data.sections.filter(
    (s) => s.content && Object.keys(s.content as object).length > 0,
  );

  return (
    <div>
      {exportError && (
        <div className="no-print mb-4">
          <ErrorNote message={exportError} />
        </div>
      )}
      <div className="no-print">
        <PageHeader
          eyebrow="Tech Pack"
          title={data.name}
          description={`${data.code} · v${data.version} · ${data.styleName ?? "unlinked"}`}
          actions={
            <>
              <StatusBadge status={data.status} />
              <Link to={`/admin/tech-packs/${data.id}/ai-assist`} className="btn btn-terracotta">
                AI Assist
              </Link>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={exporting}
                onClick={() => void exportSnapshot()}
              >
                {exporting ? "Exporting…" : "Export snapshot → R2"}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
                Print / save PDF
              </button>
            </>
          }
        />
      </div>

      {/* Printable document */}
      <div className="admin-card mx-auto max-w-4xl space-y-8 p-8 print:border-0 print:shadow-none">
        {/* Cover */}
        <header className="border-b border-ink/15 pb-6 text-center">
          <p className="eyebrow mb-2">{brand.brandName} — Technical Specification</p>
          <h1 className="font-display text-3xl font-light">{data.name}</h1>
          <p className="mt-2 text-sm text-warmgrey">
            {data.code} · Version {data.version} · {data.season ?? ""}
          </p>
          {data.summary && <p className="prose-editorial mx-auto mt-3 max-w-lg">{data.summary}</p>}
        </header>

        {filledSections.map((section) => (
          <section key={section.id}>
            <h2 className="mb-3 border-b border-ink/10 pb-1 text-sm font-semibold uppercase tracking-wider text-ink/70">
              {section.title}
            </h2>
            <SectionContent content={section.content} />
          </section>
        ))}

        {data.constructionNotes.length > 0 && (
          <section>
            <h2 className="mb-3 border-b border-ink/10 pb-1 text-sm font-semibold uppercase tracking-wider text-ink/70">
              Construction Notes (EN / FR)
            </h2>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Area</th>
                  <th>Note</th>
                  <th>Note (FR)</th>
                </tr>
              </thead>
              <tbody>
                {data.constructionNotes.map((n) => (
                  <tr key={n.id}>
                    <td className="font-medium">{n.area}</td>
                    <td>{n.note}</td>
                    <td className="italic text-ink/70">{n.noteFr ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {data.stitchDetails.length > 0 && (
          <section>
            <h2 className="mb-3 border-b border-ink/10 pb-1 text-sm font-semibold uppercase tracking-wider text-ink/70">
              Stitch Details
            </h2>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Operation</th>
                  <th>Stitch class</th>
                  <th>SPI</th>
                  <th>Thread</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {data.stitchDetails.map((s) => (
                  <tr key={s.id}>
                    <td className="font-medium">{s.operation}</td>
                    <td>{s.stitchClass ?? "—"}</td>
                    <td>{s.spi ?? "—"}</td>
                    <td>{s.thread ?? "—"}</td>
                    <td>{s.note ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {data.labelsPackaging.length > 0 && (
          <section>
            <h2 className="mb-3 border-b border-ink/10 pb-1 text-sm font-semibold uppercase tracking-wider text-ink/70">
              Labels & Packaging
            </h2>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Placement</th>
                  <th>Material</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {data.labelsPackaging.map((l) => (
                  <tr key={l.id}>
                    <td className="font-medium">{l.item}</td>
                    <td>{l.placement ?? "—"}</td>
                    <td>{l.material ?? "—"}</td>
                    <td>{l.note ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <footer className="border-t border-ink/10 pt-4 text-center text-xs text-warmgrey">
          Generated by the {brand.brandName} brand OS · {formatDate(data.updatedAt)}
        </footer>
      </div>

      {/* Export history */}
      {exports.data && exports.data.length > 0 && (
        <div className="no-print mx-auto mt-6 max-w-4xl">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-warmgrey">
            R2 export snapshots
          </h2>
          <div className="admin-card overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Snapshot</th>
                  <th>Version</th>
                  <th>Exported</th>
                  <th>By</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {exports.data.map((exp) => (
                  <tr key={exp.id}>
                    <td className="font-mono text-xs">{exp.r2_key.split("/").pop()}</td>
                    <td>v{exp.version}</td>
                    <td className="text-xs text-warmgrey">{formatDate(exp.created_at)}</td>
                    <td className="text-xs text-warmgrey">{exp.exported_by ?? "—"}</td>
                    <td>
                      <a
                        href={`/api/admin/tech-packs/exports/${exp.id}/download`}
                        target="_blank"
                        rel="noreferrer"
                        className="link-quiet text-xs"
                      >
                        Open
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/** Render structured section JSON generically: rows, items, or key-value. */
function SectionContent({ content }: { content: unknown }) {
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
