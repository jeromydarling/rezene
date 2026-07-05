import { useRef, useState } from "react";
import { api, ApiRequestError } from "../../lib/api";
import { formatDate } from "../../lib/format";
import { Markdown } from "../Markdown";
import { ErrorNote } from "./ui";
import type { AdminFile } from "../../../shared/types";

/** Markdown editor with a live preview toggle (same renderer as the site). */
export function MarkdownEditor({
  value,
  onChange,
  rows = 18,
}: {
  value: string;
  onChange: (next: string) => void;
  rows?: number;
}) {
  const [mode, setMode] = useState<"write" | "preview">("write");
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="label !mb-0">Body (markdown)</label>
        <div className="flex overflow-hidden rounded border border-ink/15">
          {(["write", "preview"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`px-3 py-1 text-[0.68rem] uppercase tracking-wider ${
                mode === m ? "bg-navy text-chalk" : "bg-white text-ink/60 hover:text-ink"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
      {mode === "write" ? (
        <textarea
          rows={rows}
          className="input font-mono !text-[0.82rem] leading-relaxed"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={"## Heading\n\nParagraphs, **bold**, - lists, and | pipe | tables |"}
        />
      ) : (
        <div className="admin-card min-h-48 p-5">
          {value.trim() ? (
            <Markdown text={value} />
          ) : (
            <p className="text-sm text-warmgrey">Nothing to preview yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

/** Upload an image to R2 (public) and hand back its /media/:id URL. */
export function ImageUploadButton({
  label = "Upload image",
  entityType = "general",
  onUploaded,
}: {
  label?: string;
  entityType?: string;
  onUploaded: (mediaUrl: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("file", files[0]);
      form.set("entityType", entityType);
      form.set("isPublic", "1");
      const uploaded = await api.upload<AdminFile>("/api/admin/files/upload", form);
      onUploaded(`/media/${uploaded.id}`);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void upload(e.target.files)}
      />
      <button
        type="button"
        className="btn btn-secondary !px-3 !py-1.5 !text-[0.68rem]"
        disabled={busy}
        onClick={() => input.current?.click()}
      >
        {busy ? "Uploading…" : label}
      </button>
      {error && <span className="text-xs text-red-700">{error}</span>}
    </span>
  );
}

interface RevisionRow {
  id: string;
  created_at: string;
  saved_by: string | null;
}

/** Revision history list with one-click restore. */
export function RevisionsPanel({
  listPath,
  restorePath,
  onRestored,
}: {
  listPath: string;
  restorePath: (revId: string) => string;
  onRestored: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [revisions, setRevisions] = useState<RevisionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);

  async function load() {
    setOpen(true);
    setError(null);
    try {
      setRevisions(await api.get<RevisionRow[]>(listPath));
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed to load history");
    }
  }

  async function restore(revId: string) {
    setRestoring(revId);
    setError(null);
    try {
      await api.post(restorePath(revId));
      setOpen(false);
      setRevisions(null);
      onRestored();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Restore failed");
    } finally {
      setRestoring(null);
    }
  }

  if (!open) {
    return (
      <button type="button" className="link-quiet text-xs" onClick={() => void load()}>
        History
      </button>
    );
  }
  return (
    <div className="admin-card mt-3 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-warmgrey">
          Revision history
        </p>
        <button type="button" className="text-xs text-warmgrey hover:text-ink" onClick={() => setOpen(false)}>
          Close
        </button>
      </div>
      {error && <ErrorNote message={error} />}
      {revisions === null && !error && <p className="text-xs text-warmgrey">Loading…</p>}
      {revisions?.length === 0 && (
        <p className="text-xs text-warmgrey">No revisions yet — history starts with the first save.</p>
      )}
      <ul className="space-y-1.5">
        {revisions?.map((rev) => (
          <li key={rev.id} className="flex items-center justify-between text-xs">
            <span>
              {formatDate(rev.created_at)}{" "}
              <span className="text-warmgrey">
                {new Date(`${rev.created_at.replace(" ", "T")}Z`).toLocaleTimeString()} ·{" "}
                {rev.saved_by ?? "system"}
              </span>
            </span>
            <button
              type="button"
              className="link-quiet"
              disabled={restoring === rev.id}
              onClick={() => void restore(rev.id)}
            >
              {restoring === rev.id ? "Restoring…" : "Restore"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
