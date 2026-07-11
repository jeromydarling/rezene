import { useRef, useState } from "react";
import {
  Archive,
  Box,
  File as FileIcon,
  FileText,
  Film,
  Music,
  Table2,
  Type,
} from "lucide-react";
import { useFetch } from "../../lib/useFetch";
import { api, ApiRequestError } from "../../lib/api";
import { formatDate, titleCase } from "../../lib/format";
import { EmptyState, ErrorNote, LoadingTable, PageHeader } from "../../components/admin/ui";
import type { AdminClo3dProject, AdminFile } from "../../../shared/types";

/** Icon + tint for a non-image file, chosen by content type then extension. */
function fileGlyph(f: AdminFile): { Icon: typeof FileIcon; tint: string; label: string } {
  const ct = f.contentType ?? "";
  const ext = (f.filename.split(".").pop() ?? "").toLowerCase();
  if (ct.startsWith("video/")) return { Icon: Film, tint: "bg-navy/10 text-navy", label: ext || "video" };
  if (ct.startsWith("audio/")) return { Icon: Music, tint: "bg-navy/10 text-navy", label: ext || "audio" };
  if (ct === "application/pdf" || ext === "pdf")
    return { Icon: FileText, tint: "bg-terracotta/10 text-terracotta", label: "pdf" };
  if (["csv", "xlsx", "xls", "tsv"].includes(ext) || ct.includes("spreadsheet") || ct === "text/csv")
    return { Icon: Table2, tint: "bg-olive/15 text-olive-deep", label: ext || "sheet" };
  if (["zip", "rar", "7z", "gz", "tar"].includes(ext) || ct.includes("zip"))
    return { Icon: Archive, tint: "bg-ink/5 text-ink/60", label: ext || "zip" };
  if (["glb", "gltf", "obj", "fbx", "stl", "zprj", "blend"].includes(ext))
    return { Icon: Box, tint: "bg-navy/10 text-navy", label: ext };
  if (["otf", "ttf", "woff", "woff2"].includes(ext) || ct.includes("font"))
    return { Icon: Type, tint: "bg-ink/5 text-ink/60", label: ext || "font" };
  return { Icon: FileIcon, tint: "bg-ink/5 text-ink/60", label: ext || "file" };
}

/** 40px preview: real thumbnail for images (streamed through the session-
 *  gated download route), a typed icon tile for everything else. */
function FileThumb({ file }: { file: AdminFile }) {
  const [broken, setBroken] = useState(false);
  const isImage = (file.contentType ?? "").startsWith("image/") && !broken;
  if (isImage) {
    return (
      <img
        src={`/api/admin/files/${file.id}/thumb`}
        alt={file.altText ?? file.filename}
        loading="lazy"
        onError={() => setBroken(true)}
        className="h-10 w-10 rounded-md border border-ink/10 bg-ink/5 object-cover"
      />
    );
  }
  const { Icon, tint, label } = fileGlyph(file);
  return (
    <span
      title={file.contentType ?? label}
      className={`flex h-10 w-10 flex-col items-center justify-center gap-0.5 rounded-md border border-ink/10 ${tint}`}
    >
      <Icon className="h-4 w-4" aria-hidden />
      <span className="text-[8px] font-semibold uppercase leading-none">{label.slice(0, 5)}</span>
    </span>
  );
}

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

  async function del(project: AdminClo3dProject) {
    if (!window.confirm(`Delete 3D project "${project.name}"?`)) return;
    try {
      await api.delete(`/api/admin/3d/projects/${project.id}`);
      reload();
    } catch (err) {
      window.alert(err instanceof ApiRequestError ? err.message : "Couldn't delete.");
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Studio"
        title="3D Simulation Bridge"
        help="three-d"
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
                  <td className="whitespace-nowrap text-right">
                    <button
                      type="button"
                      className="link-quiet text-xs"
                      onClick={() => void logFitIssue(p)}
                    >
                      {taskCreated === p.id ? "Task created ✓" : "Log fit issue → task"}
                    </button>
                    <button
                      type="button"
                      className="ml-3 text-xs text-terracotta hover:underline"
                      onClick={() => void del(p)}
                    >
                      Delete
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

  async function rename(f: AdminFile) {
    const next = window.prompt("Rename file", f.filename);
    if (!next || next.trim() === f.filename) return;
    try {
      await api.patch(`/api/admin/files/${f.id}`, { filename: next.trim() });
      reload();
    } catch (err) {
      window.alert(err instanceof ApiRequestError ? err.message : "Rename failed");
    }
  }

  async function del(f: AdminFile) {
    if (!window.confirm(`Delete ${f.filename}? This removes the file for good.`)) return;
    try {
      await api.delete(`/api/admin/files/${f.id}`);
      reload();
    } catch (err) {
      window.alert(err instanceof ApiRequestError ? err.message : "Delete failed");
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Studio"
        title="Files"
        help="files"
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
                <th className="w-12"></th>
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
                  <td className="!py-1.5">
                    <a href={`/api/admin/files/${f.id}/download`} target="_blank" rel="noreferrer">
                      <FileThumb file={f} />
                    </a>
                  </td>
                  <td className="font-medium">{f.filename}</td>
                  <td className="text-xs text-warmgrey">{f.contentType ?? "—"}</td>
                  <td className="text-xs">
                    {f.sizeBytes ? `${(f.sizeBytes / 1024).toFixed(1)} KB` : "—"}
                  </td>
                  <td>
                    <span className="badge badge-neutral">{titleCase(f.entityType ?? "general")}</span>
                  </td>
                  <td className="text-xs text-warmgrey">{formatDate(f.createdAt)}</td>
                  <td className="whitespace-nowrap text-right text-xs">
                    <a
                      href={`/api/admin/files/${f.id}/download`}
                      target="_blank"
                      rel="noreferrer"
                      className="link-quiet"
                    >
                      Open
                    </a>
                    <button type="button" className="link-quiet ml-3" onClick={() => void rename(f)}>
                      Rename
                    </button>
                    <button type="button" className="ml-3 text-terracotta hover:underline" onClick={() => void del(f)}>
                      Delete
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
