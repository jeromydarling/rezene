import { useRef, useState, type FormEvent } from "react";
import { useFetch } from "../../lib/useFetch";
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
  AdminAiConcept,
  AdminAiPrompt,
  AdminClo3dProject,
  AdminFile,
} from "../../../shared/types";

// ---------------- AI Concept Lab ----------------

export function AiConceptsPage() {
  const prompts = useFetch<AdminAiPrompt[]>("/api/admin/ai/prompts");
  const concepts = useFetch<AdminAiConcept[]>("/api/admin/ai/concepts");
  const [tab, setTab] = useState<"concepts" | "prompts" | "bridges">("concepts");
  const [createOpen, setCreateOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  async function rate(concept: AdminAiConcept, rating: number) {
    await api.patch(`/api/admin/ai/concepts/${concept.id}`, { rating });
    concepts.reload();
  }

  return (
    <div>
      <PageHeader
        eyebrow="Studio"
        title="AI Concept Lab"
        description="The concepting bridge: brand prompt presets for Midjourney/Firefly, stored outputs, and concept-to-style conversion."
        actions={
          <>
            <div className="flex overflow-hidden rounded-md border border-ink/15">
              {(["concepts", "prompts", "bridges"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`px-3 py-1.5 text-xs uppercase tracking-wider ${
                    tab === t ? "bg-navy text-chalk" : "bg-white text-ink/60 hover:text-ink"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            {tab === "concepts" && (
              <button type="button" className="btn btn-primary" onClick={() => setCreateOpen(true)}>
                New concept
              </button>
            )}
          </>
        }
      />

      {tab === "prompts" && (
        <>
          {prompts.loading && <LoadingTable />}
          {prompts.error && <ErrorNote message={prompts.error} />}
          <div className="grid gap-4 md:grid-cols-2">
            {prompts.data?.map((p) => (
              <div key={p.id} className="admin-card p-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-medium">{p.name}</p>
                  <div className="flex items-center gap-2">
                    {p.isPreset && <span className="badge badge-navy">preset</span>}
                    <span className="badge badge-neutral">{p.targetTool}</span>
                  </div>
                </div>
                <p className="rounded bg-cream p-3 font-mono text-xs leading-relaxed text-ink/80">
                  {p.promptText}
                </p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-warmgrey">
                    v{p.version} · {titleCase(p.category)}
                  </span>
                  <button
                    type="button"
                    className="link-quiet text-xs"
                    onClick={() => {
                      void navigator.clipboard.writeText(p.promptText);
                      setCopied(p.id);
                      setTimeout(() => setCopied(null), 1500);
                    }}
                  >
                    {copied === p.id ? "Copied ✓" : "Copy prompt"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "concepts" && (
        <>
          {concepts.loading && <LoadingTable />}
          {concepts.error && <ErrorNote message={concepts.error} />}
          {concepts.data && concepts.data.length === 0 && (
            <EmptyState
              title="No concepts yet"
              hint="Start from a preset prompt, run it in Midjourney or Firefly, and log the results here."
            />
          )}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {concepts.data?.map((concept) => (
              <div key={concept.id} className="admin-card p-4">
                <div className="mb-1 flex items-start justify-between gap-2">
                  <p className="font-medium leading-snug">{concept.title}</p>
                  <StatusBadge status={concept.status} />
                </div>
                {concept.brief && <p className="text-xs text-warmgrey">{concept.brief}</p>}
                {concept.styleName && (
                  <p className="mt-1 text-xs text-ink/70">Style: {concept.styleName}</p>
                )}
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => void rate(concept, star)}
                        className={`text-sm ${
                          concept.rating && star <= concept.rating
                            ? "text-saffron"
                            : "text-ink/20 hover:text-saffron/60"
                        }`}
                        aria-label={`Rate ${star}`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                  <span className="text-xs text-warmgrey">{formatDate(concept.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "bridges" && <BridgesTab />}

      <SlideOver open={createOpen} title="New concept" onClose={() => setCreateOpen(false)}>
        <ConceptCreateForm
          prompts={prompts.data ?? []}
          onCreated={() => {
            setCreateOpen(false);
            concepts.reload();
          }}
        />
      </SlideOver>
    </div>
  );
}

// ---------------- External tool bridges (Midjourney / Firefly / CLO…) ----------------

interface ExternalExportRow {
  id: string;
  tool: string;
  entity_type: string | null;
  entity_id: string | null;
  title: string | null;
  external_url: string | null;
  metadata_json: string | null;
  created_at: string;
}

const BRIDGE_TOOLS = ["midjourney", "firefly", "dalle", "clo3d", "browzwear", "style3d", "illustrator", "figma"];

function BridgesTab() {
  const { data, loading, error, reload } = useFetch<ExternalExportRow[]>(
    "/api/admin/ai/external-exports",
  );
  const [form, setForm] = useState({ tool: "midjourney", title: "", externalUrl: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      await api.post("/api/admin/ai/external-exports", {
        tool: form.tool,
        title: form.title || undefined,
        externalUrl: form.externalUrl || undefined,
        metadata: form.notes ? { notes: form.notes } : undefined,
      });
      setForm({ tool: form.tool, title: "", externalUrl: "", notes: "" });
      reload();
    } catch (err) {
      setFormError(err instanceof ApiRequestError ? err.message : "Failed to log export");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
      <form onSubmit={submit} className="admin-card h-fit space-y-3 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-warmgrey">
          Log external output
        </h2>
        <div>
          <label className="label">Tool</label>
          <select
            className="input"
            value={form.tool}
            onChange={(e) => setForm({ ...form, tool: e.target.value })}
          >
            {BRIDGE_TOOLS.map((t) => (
              <option key={t} value={t}>
                {titleCase(t)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Title</label>
          <input
            className="input"
            placeholder="Tangier hero frame v3"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Job / output URL</label>
          <input
            className="input"
            placeholder="https://…"
            value={form.externalUrl}
            onChange={(e) => setForm({ ...form, externalUrl: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Notes (seed, license, measurements…)</label>
          <textarea
            rows={3}
            className="input"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>
        {formError && <p className="field-error">{formError}</p>}
        <button type="submit" disabled={busy} className="btn btn-primary w-full">
          {busy ? "Logging…" : "Log output"}
        </button>
        <p className="text-xs text-warmgrey">
          Image/file uploads go through Files (R2) — this logs the external
          job metadata and links it into the concepting record.
        </p>
      </form>

      <div>
        {loading && <LoadingTable />}
        {error && <ErrorNote message={error} />}
        {data && data.length === 0 && (
          <EmptyState
            title="No external outputs logged"
            hint="Run a preset prompt in Midjourney or Firefly, then log the job URL and metadata here."
          />
        )}
        {data && data.length > 0 && (
          <div className="admin-card overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Tool</th>
                  <th>Title</th>
                  <th>Link</th>
                  <th>Notes</th>
                  <th>Logged</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => {
                  let notes = "—";
                  try {
                    const meta = row.metadata_json ? JSON.parse(row.metadata_json) : null;
                    if (meta && typeof meta === "object" && "notes" in meta) {
                      notes = String((meta as { notes: unknown }).notes);
                    }
                  } catch {
                    // ignore malformed metadata
                  }
                  return (
                    <tr key={row.id}>
                      <td>
                        <span className="badge badge-navy">{titleCase(row.tool)}</span>
                      </td>
                      <td className="font-medium">{row.title ?? "—"}</td>
                      <td>
                        {row.external_url ? (
                          <a
                            href={row.external_url}
                            target="_blank"
                            rel="noreferrer"
                            className="link-quiet text-xs"
                          >
                            Open ↗
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="max-w-xs truncate text-xs text-warmgrey">{notes}</td>
                      <td className="text-xs text-warmgrey">{formatDate(row.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function ConceptCreateForm({
  prompts,
  onCreated,
}: {
  prompts: AdminAiPrompt[];
  onCreated: () => void;
}) {
  const [form, setForm] = useState({ title: "", brief: "", promptId: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/admin/ai/concepts", {
        title: form.title,
        brief: form.brief || undefined,
        promptId: form.promptId || undefined,
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
        <label className="label">Title *</label>
        <input
          required
          className="input"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
      </div>
      <div>
        <label className="label">Brief</label>
        <textarea
          rows={3}
          className="input"
          value={form.brief}
          onChange={(e) => setForm({ ...form, brief: e.target.value })}
        />
      </div>
      <div>
        <label className="label">From prompt preset</label>
        <select
          className="input"
          value={form.promptId}
          onChange={(e) => setForm({ ...form, promptId: e.target.value })}
        >
          <option value="">—</option>
          {prompts.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="field-error">{error}</p>}
      <button type="submit" disabled={busy} className="btn btn-primary w-full">
        {busy ? "Creating…" : "Create concept"}
      </button>
    </form>
  );
}

// ---------------- 3D Simulation Bridge ----------------

const SIM_STATUSES = ["not_started", "pattern_needed", "in_simulation", "fit_review", "approved"];

export function ThreeDPage() {
  const { data, loading, error, reload } = useFetch<AdminClo3dProject[]>("/api/admin/3d/projects");
  const [taskCreated, setTaskCreated] = useState<string | null>(null);

  async function setStatus(project: AdminClo3dProject, status: string) {
    await api.patch(`/api/admin/3d/projects/${project.id}`, { status });
    reload();
  }

  async function logFitIssue(project: AdminClo3dProject) {
    const issue = window.prompt(
      `Describe the fit issue found in "${project.name}" — a sample-revision task will be created:`,
    );
    if (!issue?.trim()) return;
    await api.post(`/api/admin/3d/projects/${project.id}/fit-issue-task`, { issue: issue.trim() });
    setTaskCreated(project.id);
    setTimeout(() => setTaskCreated(null), 2500);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Studio"
        title="3D Simulation Bridge"
        description="CLO 3D / Browzwear / Style3D project tracking — files, renders, measurements, and fit status. Simulation happens in the external tool; the record lives here."
      />
      {error && <ErrorNote message={error} />}
      {loading && <LoadingTable rows={3} />}
      {data && data.length === 0 && (
        <EmptyState title="No 3D projects" hint="Attach a CLO project to a style to begin." />
      )}
      {data && data.length > 0 && (
        <div className="admin-card overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Style</th>
                <th>Tool</th>
                <th>Status</th>
                <th>Notes</th>
                <th>Updated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.id}>
                  <td className="font-medium">{p.name}</td>
                  <td>{p.styleName ?? "—"}</td>
                  <td>{p.tool.toUpperCase()}</td>
                  <td>
                    <select
                      className="rounded border border-ink/15 bg-white px-1.5 py-1 text-xs"
                      value={p.status}
                      onChange={(e) => void setStatus(p, e.target.value)}
                    >
                      {SIM_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {titleCase(s)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="max-w-sm truncate text-xs text-warmgrey">{p.notes ?? "—"}</td>
                  <td className="text-xs text-warmgrey">{formatDate(p.updatedAt)}</td>
                  <td>
                    <button
                      type="button"
                      className="link-quiet whitespace-nowrap text-xs"
                      onClick={() => void logFitIssue(p)}
                    >
                      {taskCreated === p.id ? "Task created ✓" : "Log fit issue → task"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------- Files (R2) ----------------

export function FilesPage() {
  const { data, loading, error, reload } = useFetch<AdminFile[]>("/api/admin/files");
  const fileInput = useRef<HTMLInputElement>(null);
  const [entityType, setEntityType] = useState("general");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadError(null);
    try {
      const form = new FormData();
      form.set("file", files[0]);
      form.set("entityType", entityType);
      await api.upload("/api/admin/files/upload", form);
      reload();
    } catch (err) {
      setUploadError(err instanceof ApiRequestError ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Studio"
        title="Files"
        description="Every working file — sketches, patterns, 3D files, renders, and factory documents — filed against the style, product, or order it belongs to."
        actions={
          <div className="flex items-center gap-2">
            <select
              className="input !w-auto !py-1.5 text-xs"
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
            >
              {["general", "style", "tech_pack", "sample", "factory", "production_order", "concept", "3d_project"].map(
                (t) => (
                  <option key={t} value={t}>
                    {titleCase(t)}
                  </option>
                ),
              )}
            </select>
            <input
              ref={fileInput}
              type="file"
              className="hidden"
              onChange={(e) => void upload(e.target.files)}
            />
            <button
              type="button"
              className="btn btn-primary"
              disabled={uploading}
              onClick={() => fileInput.current?.click()}
            >
              {uploading ? "Uploading…" : "Upload file"}
            </button>
          </div>
        }
      />
      {uploadError && <ErrorNote message={uploadError} />}
      {error && <ErrorNote message={error} />}
      {loading && <LoadingTable />}
      {data && data.length === 0 && (
        <EmptyState
          title="No files yet"
          hint="Upload flat sketches, Midjourney exports, CLO project files, or factory PDFs."
        />
      )}
      {data && data.length > 0 && (
        <div className="admin-card overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Filename</th>
                <th>Type</th>
                <th>Size</th>
                <th>Entity</th>
                <th>Uploaded</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.map((f) => (
                <tr key={f.id}>
                  <td className="font-medium">{f.filename}</td>
                  <td className="text-xs text-warmgrey">{f.contentType ?? "—"}</td>
                  <td className="text-xs">
                    {f.sizeBytes ? `${(f.sizeBytes / 1024).toFixed(1)} KB` : "—"}
                  </td>
                  <td>
                    <span className="badge badge-neutral">{titleCase(f.entityType ?? "general")}</span>
                  </td>
                  <td className="text-xs text-warmgrey">{formatDate(f.createdAt)}</td>
                  <td>
                    <a
                      href={`/api/admin/files/${f.id}/download`}
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
      )}
    </div>
  );
}
