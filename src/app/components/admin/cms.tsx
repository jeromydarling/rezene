import { useEffect, useRef, useState, type FormEvent } from "react";
import { api, ApiRequestError } from "../../lib/api";
import { getShopBase } from "../../lib/shop";
import { formatDate } from "../../lib/format";
import { Markdown } from "../Markdown";
import { ErrorNote } from "./ui";
import type { AdminFile, AiContentDraft } from "../../../shared/types";

const REWRITE_ACTIONS = [
  { label: "Shorten", instruction: "Make this noticeably shorter without losing the key points." },
  { label: "Expand", instruction: "Expand this with more concrete detail, keeping the same voice." },
  { label: "Warmer", instruction: "Make this warmer and more personal, without becoming salesy." },
  { label: "More direct", instruction: "Make this more direct and plain-spoken. Cut hedging." },
  { label: "Fix grammar", instruction: "Fix grammar, spelling, and punctuation only. Change nothing else." },
];

/**
 * Markdown editor with live preview and an LLM edit menu: select text (or
 * nothing, for the whole document) and apply a rewrite. The result replaces
 * the selection in place — undo is one revision-restore away.
 */
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
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function rewrite(instruction: string) {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? 0;
    const end = el?.selectionEnd ?? 0;
    const hasSelection = el && end > start;
    const target = hasSelection ? value.slice(start, end) : value;
    if (!target.trim()) return;
    setAiBusy(true);
    setAiError(null);
    try {
      const res = await api.post<{ text: string }>("/api/admin/content/ai-rewrite", {
        text: target,
        instruction,
      });
      onChange(hasSelection ? value.slice(0, start) + res.text + value.slice(end) : res.text);
    } catch (err) {
      setAiError(err instanceof ApiRequestError ? err.message : "Rewrite failed");
    } finally {
      setAiBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <label className="label !mb-0">Body (markdown)</label>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-xs">
            <span className="text-warmgrey">✨</span>
            {REWRITE_ACTIONS.map((action) => (
              <button
                key={action.label}
                type="button"
                disabled={aiBusy || mode !== "write"}
                title="Applies to the selected text, or the whole document when nothing is selected"
                className="rounded border border-ink/10 px-2 py-0.5 text-[0.66rem] uppercase tracking-wider text-ink/60 hover:border-navy hover:text-ink disabled:opacity-40"
                onClick={() => void rewrite(action.instruction)}
              >
                {action.label}
              </button>
            ))}
          </div>
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
      </div>
      {aiError && <p className="field-error mb-2">{aiError}</p>}
      {mode === "write" ? (
        <div className="relative">
          <textarea
            ref={textareaRef}
            rows={rows}
            className="input font-mono !text-[0.82rem] leading-relaxed"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={"## Heading\n\nParagraphs, **bold**, - lists, and | pipe | tables |"}
          />
          {aiBusy && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60">
              <p className="eyebrow">Rewriting…</p>
            </div>
          )}
        </div>
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
      onUploaded(`${getShopBase()}/media/${uploaded.id}`);
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

/**
 * Media library: browse and reuse every public image ever uploaded, with
 * alt text editing and vision-generated alt text. Rendered inside a
 * SlideOver by ImageField.
 */
export function MediaLibrary({ onPick }: { onPick: (url: string, alt: string | null) => void }) {
  const [query, setQuery] = useState("");
  const [files, setFiles] = useState<AdminFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async (q: string) => {
    try {
      setFiles(
        await api.get<AdminFile[]>(
          `/api/admin/files?publicImages=1${q ? `&q=${encodeURIComponent(q)}` : ""}`,
        ),
      );
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Could not load media");
    }
  };
  useEffect(() => {
    void load("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveAlt(file: AdminFile, altText: string) {
    if (altText === (file.altText ?? "")) return;
    await api.patch(`/api/admin/files/${file.id}`, { altText: altText || null });
    setFiles((prev) => prev?.map((f) => (f.id === file.id ? { ...f, altText: altText || null } : f)) ?? null);
  }

  async function generateAlt(file: AdminFile) {
    setBusyId(file.id);
    setError(null);
    try {
      const res = await api.post<{ altText: string }>(`/api/admin/files/${file.id}/ai-alt`);
      setFiles((prev) => prev?.map((f) => (f.id === file.id ? { ...f, altText: res.altText } : f)) ?? null);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Alt text generation failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          className="input flex-1"
          placeholder="Search by filename or alt text…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            void load(e.target.value);
          }}
        />
        <ImageUploadButton
          label="Upload new"
          entityType="general"
          onUploaded={(url) => {
            void load(query);
            onPick(url, null);
          }}
        />
      </div>
      {error && <ErrorNote message={error} />}
      {files && files.length === 0 && (
        <p className="py-8 text-center text-sm text-warmgrey">
          No images yet — upload the first one above.
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        {files?.map((file) => (
          <div key={file.id} className="space-y-1.5">
            <button
              type="button"
              className="block w-full overflow-hidden rounded border border-ink/10 hover:border-navy"
              onClick={() => onPick(`${getShopBase()}/media/${file.id}`, file.altText)}
              title="Use this image"
            >
              <img
                src={`${getShopBase()}/media/${file.id}`}
                alt={file.altText ?? file.filename}
                className="aspect-[4/3] w-full object-cover"
                loading="lazy"
              />
            </button>
            <input
              className="input !py-1 text-xs"
              placeholder="Alt text"
              defaultValue={file.altText ?? ""}
              onBlur={(e) => void saveAlt(file, e.target.value)}
            />
            <button
              type="button"
              className="link-quiet text-[0.66rem]"
              disabled={busyId === file.id}
              onClick={() => void generateAlt(file)}
            >
              {busyId === file.id ? "Looking…" : "✨ Generate alt text"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Image input: URL field + media library picker. The standard way to set
 * any image in the CMS (heroes, blocks, posts).
 */
export function ImageField({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  return (
    <div className="flex items-center gap-2">
      {value && (
        <img src={value} alt="" className="h-9 w-9 rounded border border-ink/10 object-cover" />
      )}
      <input
        className="input flex-1"
        placeholder="/media/… or external URL"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        className="btn btn-secondary !px-3 !py-1.5 !text-[0.68rem]"
        onClick={() => setPickerOpen(true)}
      >
        Choose
      </button>
      {pickerOpen && (
        <div className="fixed inset-0 z-[60]">
          <button
            type="button"
            aria-label="Close media library"
            className="absolute inset-0 bg-ink/30"
            onClick={() => setPickerOpen(false)}
          />
          <div className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-ink/10 px-5 py-4">
              <h2 className="font-display text-lg font-light">Media library</h2>
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                className="text-sm text-warmgrey hover:text-ink"
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-5">
              <MediaLibrary
                onPick={(url) => {
                  onChange(url);
                  setPickerOpen(false);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * LLM drafting interview: a handful of plain questions become a ready
 * draft (title, slug, body, kicker…). The caller decides what to do with
 * the accepted draft — prefill a create form or replace an editor's fields.
 */
export function AiDraftAssistant({
  kind,
  onAccept,
}: {
  kind: "page" | "journal";
  onAccept: (draft: AiContentDraft) => void;
}) {
  const [form, setForm] = useState({
    topic: "",
    audience: "",
    tone: "Editorial and understated",
    keyPoints: "",
    length: "medium",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<AiContentDraft | null>(null);

  async function generate(e?: FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await api.post<AiContentDraft>("/api/admin/content/ai-draft", {
        kind,
        topic: form.topic,
        audience: form.audience || undefined,
        tone: form.tone || undefined,
        keyPoints: form.keyPoints || undefined,
        length: form.length,
      });
      setDraft(result);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Drafting failed — try again");
    } finally {
      setBusy(false);
    }
  }

  if (draft) {
    return (
      <div className="space-y-4">
        <div className="admin-card max-h-96 overflow-y-auto p-4">
          <p className="eyebrow mb-1">{draft.heroEyebrow ?? ""}</p>
          <p className="font-display text-xl font-light">{draft.title}</p>
          {(draft.subtitle ?? draft.excerpt) && (
            <p className="mt-1 text-sm text-warmgrey">{draft.subtitle ?? draft.excerpt}</p>
          )}
          <div className="mt-4 border-t border-ink/10 pt-4">
            <Markdown text={draft.bodyMd} />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn btn-secondary flex-1"
            disabled={busy}
            onClick={() => void generate()}
          >
            {busy ? "Redrafting…" : "Try again"}
          </button>
          <button type="button" className="btn btn-primary flex-1" onClick={() => onAccept(draft)}>
            Use this draft
          </button>
        </div>
        <p className="text-xs text-warmgrey">
          The draft lands in the editor — nothing publishes until you save it yourself.
        </p>
        {error && <p className="field-error">{error}</p>}
      </div>
    );
  }

  return (
    <form onSubmit={generate} className="space-y-4">
      <div>
        <label className="label">What should this {kind === "journal" ? "post" : "page"} say? *</label>
        <textarea
          required
          rows={3}
          className="input"
          placeholder={
            kind === "journal"
              ? "e.g. Behind the scenes of our first production run in Casablanca — what surprised us, the people involved…"
              : "e.g. A press page introducing the brand to journalists: founding story, materials, where we produce…"
          }
          value={form.topic}
          onChange={(e) => setForm({ ...form, topic: e.target.value })}
        />
      </div>
      <div>
        <label className="label">Who is it for?</label>
        <input
          className="input"
          placeholder="e.g. First-time visitors deciding whether to trust us"
          value={form.audience}
          onChange={(e) => setForm({ ...form, audience: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Tone</label>
          <select
            className="input"
            value={form.tone}
            onChange={(e) => setForm({ ...form, tone: e.target.value })}
          >
            {[
              "Editorial and understated",
              "Warm and personal",
              "Direct and practical",
              "Playful",
            ].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Length</label>
          <select
            className="input"
            value={form.length}
            onChange={(e) => setForm({ ...form, length: e.target.value })}
          >
            <option value="short">Short (~150 words)</option>
            <option value="medium">Medium (~350 words)</option>
            <option value="long">Long (~700 words)</option>
          </select>
        </div>
      </div>
      <div>
        <label className="label">Anything that must be mentioned?</label>
        <textarea
          rows={2}
          className="input"
          placeholder="Names, dates, facts, links — one per line"
          value={form.keyPoints}
          onChange={(e) => setForm({ ...form, keyPoints: e.target.value })}
        />
      </div>
      {error && <p className="field-error">{error}</p>}
      <button type="submit" disabled={busy} className="btn btn-primary w-full">
        {busy ? "Writing…" : "Generate draft"}
      </button>
    </form>
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
