import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router";
import { useFetch } from "../../lib/useFetch";
import { useBrand } from "../../lib/brand";
import { api, ApiRequestError } from "../../lib/api";
import { formatDate, titleCase } from "../../lib/format";
import { SectionContent } from "../../components/TechPackContent";
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
        description="Factory-ready specifications — printable, versioned, shareable with your atelier as a live link, and AI-assisted from a photo or sketch."
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
  const [mode, setMode] = useState<"standard" | "photo">("standard");
  const [form, setForm] = useState({ name: "", styleId: "", season: "SS27", summary: "" });
  const [photo, setPhoto] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "photo") {
        if (!photo) {
          setError("Choose a photo or sketch first");
          setBusy(false);
          return;
        }
        setPhase("Uploading image…");
        const uploadForm = new FormData();
        uploadForm.set("file", photo);
        uploadForm.set("entityType", "tech_pack");
        const uploaded = await api.upload<{ id: string }>("/api/admin/files/upload", uploadForm);
        setPhase("Analyzing garment — this takes ~30 seconds…");
        await api.post("/api/admin/tech-packs/from-image", {
          fileId: uploaded.id,
          name: form.name || undefined,
          styleId: form.styleId || undefined,
        });
      } else {
        await api.post("/api/admin/tech-packs", {
          name: form.name,
          styleId: form.styleId || undefined,
          season: form.season || undefined,
          summary: form.summary || undefined,
          source: form.styleId ? "style" : "blank",
        });
      }
      onCreated();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Create failed");
    } finally {
      setBusy(false);
      setPhase(null);
    }
  }

  if (mode === "photo") {
    return (
      <form onSubmit={submit} className="space-y-4">
        <ModeToggle mode={mode} setMode={setMode} />
        <p className="text-xs text-warmgrey">
          Upload a garment photo or a sketch — AI drafts the overview, BOM, measurement points,
          construction notes, and QC checklist. Everything is marked as a draft for your review.
        </p>
        <div>
          <label className="label">Photo / sketch * (JPEG, PNG, WebP · max 5MB)</label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="input"
            onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
          />
        </div>
        <div>
          <label className="label">Name (optional — AI suggests one)</label>
          <input
            className="input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Link to style (optional)</label>
          <select
            className="input"
            value={form.styleId}
            onChange={(e) => setForm({ ...form, styleId: e.target.value })}
          >
            <option value="">—</option>
            {styles?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.styleCode} — {s.name}
              </option>
            ))}
          </select>
        </div>
        {phase && <p className="text-sm text-navy">{phase}</p>}
        {error && <p className="field-error">{error}</p>}
        <button type="submit" disabled={busy || !photo} className="btn btn-terracotta w-full">
          {busy ? (phase ?? "Working…") : "Draft tech pack from image"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <ModeToggle mode={mode} setMode={setMode} />
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

function ModeToggle({
  mode,
  setMode,
}: {
  mode: "standard" | "photo";
  setMode: (m: "standard" | "photo") => void;
}) {
  return (
    <div className="flex overflow-hidden rounded-md border border-ink/15">
      {(
        [
          ["standard", "From style / blank"],
          ["photo", "From photo / sketch ✨"],
        ] as const
      ).map(([value, label]) => (
        <button
          key={value}
          type="button"
          onClick={() => setMode(value)}
          className={`flex-1 px-3 py-2 text-xs uppercase tracking-wider ${
            mode === value ? "bg-navy text-chalk" : "bg-white text-ink/60 hover:text-ink"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
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

interface ShareRow {
  id: string;
  label: string | null;
  language: string;
  status: string;
  approved_at: string | null;
  approved_by_name: string | null;
  last_viewed_at: string | null;
  view_count: number;
  supplier_name: string | null;
  created_at: string;
}

function FactorySharesPanel({ techPackId }: { techPackId: string }) {
  const shares = useFetch<ShareRow[]>(`/api/admin/tech-packs/${techPackId}/shares`);
  const suppliers = useFetch<{ id: string; name: string }[]>("/api/admin/suppliers");
  const [form, setForm] = useState({ label: "", supplierId: "", language: "fr" });
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createShare() {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ url: string }>(`/api/admin/tech-packs/${techPackId}/shares`, {
        label: form.label || undefined,
        supplierId: form.supplierId || undefined,
        language: form.language,
      });
      setCreatedUrl(`${location.origin}${res.url}`);
      shares.reload();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Share failed");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(shareId: string) {
    if (!window.confirm("Revoke this factory link? It stops working immediately.")) return;
    await api.post(`/api/admin/tech-packs/shares/${shareId}/revoke`);
    shares.reload();
  }

  return (
    <div className="no-print mx-auto mt-6 max-w-4xl">
      <div className="admin-card p-5">
        <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-warmgrey">
          Factory shares
        </h2>
        <p className="mb-4 text-xs text-warmgrey">
          A live, read-only link for the atelier — always the current version, with comments and
          spec approval built in. No account needed on their side.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-48 flex-1">
            <label className="label">Label</label>
            <input
              className="input"
              placeholder="Coupe Cousu — proto round"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Supplier</label>
            <select
              className="input !w-48"
              value={form.supplierId}
              onChange={(e) => setForm({ ...form, supplierId: e.target.value })}
            >
              <option value="">—</option>
              {suppliers.data?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Language</label>
            <select
              className="input !w-24"
              value={form.language}
              onChange={(e) => setForm({ ...form, language: e.target.value })}
            >
              <option value="en">EN</option>
              <option value="fr">FR</option>
            </select>
          </div>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void createShare()}>
            {busy ? "Creating…" : "Create link"}
          </button>
        </div>
        {error && <p className="field-error mt-2">{error}</p>}
        {createdUrl && (
          <div className="mt-3 flex items-center gap-2 rounded bg-cream p-3">
            <code className="flex-1 truncate text-xs">{createdUrl}</code>
            <button
              type="button"
              className="btn btn-secondary !px-3 !py-1 !text-[0.65rem]"
              onClick={() => {
                void navigator.clipboard.writeText(createdUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? "Copied ✓" : "Copy"}
            </button>
          </div>
        )}

        {shares.data && shares.data.length > 0 && (
          <table className="admin-table mt-4">
            <thead>
              <tr>
                <th>Label</th>
                <th>Supplier</th>
                <th>Lang</th>
                <th>Views</th>
                <th>Last viewed</th>
                <th>Approval</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {shares.data.map((share) => (
                <tr key={share.id} className={share.status === "revoked" ? "opacity-40" : ""}>
                  <td>{share.label ?? "—"}</td>
                  <td>{share.supplier_name ?? "—"}</td>
                  <td className="uppercase">{share.language}</td>
                  <td>{share.view_count}</td>
                  <td className="text-xs text-warmgrey">
                    {share.last_viewed_at ? formatDate(share.last_viewed_at) : "never"}
                  </td>
                  <td>
                    {share.approved_at ? (
                      <span className="badge badge-success">
                        ✓ {share.approved_by_name}
                      </span>
                    ) : (
                      <span className="badge badge-neutral">pending</span>
                    )}
                  </td>
                  <td>
                    {share.status === "active" ? (
                      <button
                        type="button"
                        className="text-xs text-red-700 hover:underline"
                        onClick={() => void revoke(share.id)}
                      >
                        Revoke
                      </button>
                    ) : (
                      <span className="text-xs text-warmgrey">revoked</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
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
                {exporting ? "Archiving…" : "Archive snapshot"}
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

      {id && <FactorySharesPanel techPackId={id} />}

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
