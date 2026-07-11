import { useMemo, useRef, useState } from "react";
import { PageHeader, EmptyState } from "../../components/admin/ui";
import { api } from "../../lib/api";
import { useFetch } from "../../lib/useFetch";
import { useToast } from "../../lib/toast";

/**
 * R&D — the shop's research workspace. Where knowledge lives BEFORE it's
 * structured enough to be a supplier record or a tech pack: candidate makers
 * with a lightweight pipeline, free-form research notes, and live research
 * (Perplexity) whose answers are saved as cited notes. Makers promote into
 * Factories & Suppliers — R&D is the top of the sourcing funnel.
 */

interface Maker {
  id: string;
  name: string;
  market: string | null;
  location: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  speciality: string | null;
  techPack: string | null;
  minOrder: string | null;
  leadTime: string | null;
  priceUnit: string | null;
  about: string | null;
  bestUse: string | null;
  status: string;
  note: string | null;
  topic: string | null;
  supplierId: string | null;
  updatedAt: string;
}

interface Note {
  id: string;
  title: string;
  bodyMd: string;
  topic: string | null;
  tags: string[];
  sourceUrl: string | null;
  kind: string;
  citations: string[];
  pinned: boolean;
  updatedAt: string;
}

const STATUSES = ["researching", "contacted", "sampling", "approved", "passed"] as const;
const STATUS_TONE: Record<string, string> = {
  researching: "bg-ink/5 text-ink/70",
  contacted: "bg-sky-100 text-sky-800",
  sampling: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  passed: "bg-ink/5 text-ink/40 line-through",
};

/** RFC-4180-ish CSV parser — quoted fields, embedded commas and newlines. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else {
      cell += ch;
    }
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

const MAKER_TARGETS: { key: string; label: string; hints: string[] }[] = [
  { key: "name", label: "Name", hints: ["maker", "name", "company", "atelier", "factory"] },
  { key: "market", label: "Market", hints: ["market", "region", "country"] },
  { key: "location", label: "Location", hints: ["location", "city"] },
  { key: "website", label: "Website", hints: ["website", "site", "url"] },
  { key: "email", label: "Email / contact", hints: ["email", "contact"] },
  { key: "phone", label: "Phone", hints: ["phone", "tel", "whatsapp"] },
  { key: "speciality", label: "Speciality", hints: ["special", "capab", "products"] },
  { key: "techPack", label: "Tech pack?", hints: ["tech pack"] },
  { key: "minOrder", label: "Min. order", hints: ["min", "moq"] },
  { key: "leadTime", label: "Lead time", hints: ["lead"] },
  { key: "priceUnit", label: "Est. price / unit", hints: ["price", "cost"] },
  { key: "about", label: "About", hints: ["about", "description", "summary"] },
  { key: "bestUse", label: "Best use case", hints: ["best use", "use case", "pipeline", "notes"] },
];

const NOTE_TARGETS: { key: string; label: string; hints: string[] }[] = [
  { key: "title", label: "Title", hints: ["title", "name", "subject"] },
  { key: "bodyMd", label: "Body", hints: ["body", "content", "note", "text", "detail"] },
  { key: "topic", label: "Topic", hints: ["topic", "category", "project"] },
  { key: "tags", label: "Tags", hints: ["tags", "labels"] },
  { key: "sourceUrl", label: "Source URL", hints: ["url", "source", "link"] },
];

function autoMap(headers: string[], targets: typeof MAKER_TARGETS): Record<string, number> {
  const map: Record<string, number> = {};
  const used = new Set<number>();
  for (const t of targets) {
    const idx = headers.findIndex(
      (h, i) => !used.has(i) && t.hints.some((hint) => h.toLowerCase().includes(hint)),
    );
    if (idx >= 0) {
      map[t.key] = idx;
      used.add(idx);
    }
  }
  return map;
}

function ImportDialog({ mode: initialMode, onDone, onClose }: { mode: "makers" | "notes"; onDone: () => void; onClose: () => void }) {
  const toast = useToast();
  // What you're importing is chosen IN the dialog — inheriting it silently
  // from the active tab trapped people on the maker columns.
  const [mode, setMode] = useState<"makers" | "notes">(initialMode);
  const [rows, setRows] = useState<string[][] | null>(null);
  const [headerRow, setHeaderRow] = useState(0);
  const [mapping, setMapping] = useState<Record<string, number>>({});
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const targets = mode === "makers" ? MAKER_TARGETS : NOTE_TARGETS;

  const headers = rows?.[headerRow]?.map((h) => h.trim()) ?? [];
  const dataRows = rows ? rows.slice(headerRow + 1) : [];

  const switchMode = (m: "makers" | "notes") => {
    if (m === mode) return;
    setMode(m);
    // Re-run the auto-mapping against the other record type's columns.
    if (rows) {
      const t = m === "makers" ? MAKER_TARGETS : NOTE_TARGETS;
      setMapping(autoMap(rows[headerRow].map((h) => h.trim()), t));
    }
  };

  const pickHeaderRow = (parsed: string[][]) => {
    // Research exports often carry a title banner above the real header —
    // pick the first row where at least three cells look like column names.
    for (let i = 0; i < Math.min(parsed.length, 8); i++) {
      const filled = parsed[i].filter((c) => c.trim() !== "").length;
      if (filled >= 3) return i;
    }
    return 0;
  };

  const onFile = async (f: File) => {
    const text = await f.text();
    const parsed = parseCsv(text);
    if (!parsed.length) {
      toast.error("That file looks empty.");
      return;
    }
    const hr = pickHeaderRow(parsed);
    setRows(parsed);
    setHeaderRow(hr);
    setMapping(autoMap(parsed[hr].map((h) => h.trim()), targets));
  };

  const doImport = async () => {
    if (!rows || mapping[targets[0].key] === undefined) {
      toast.error(`Map the ${targets[0].label} column first.`);
      return;
    }
    setBusy(true);
    try {
      const payload = dataRows
        .map((r) => {
          const obj: Record<string, string> = {};
          for (const t of targets) {
            const idx = mapping[t.key];
            if (idx !== undefined && r[idx]?.trim()) obj[t.key] = r[idx].trim();
          }
          return obj;
        })
        .filter((o) => Object.keys(o).length > 0);
      const res = await api.post<{ imported: number; skipped: number }>(
        `/api/admin/research/${mode}/import`,
        { rows: payload, topic: topic.trim() || undefined },
      );
      toast.success(`Imported ${res.imported}${res.skipped ? ` (skipped ${res.skipped} without a ${targets[0].label.toLowerCase()})` : ""}.`);
      onDone();
      onClose();
    } catch {
      /* toast handled by api layer */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display text-lg">Import from CSV</h3>
        <div className="mt-2 inline-flex overflow-hidden rounded-lg border border-ink/15 text-sm">
          {(["makers", "notes"] as const).map((m) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              className={`px-3 py-1.5 ${mode === m ? "bg-navy text-white" : "bg-white text-ink/70 hover:bg-ink/5"}`}
            >
              {m === "makers" ? "Makers" : "Notes"}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-warmgrey">
          Export your research as CSV (from Excel or Sheets: File → Save as → CSV). We'll detect the
          header row and map the columns — check the mapping before importing. Nothing is overwritten;
          every row imports as a new {mode === "makers" ? "maker" : "note"}.
        </p>
        {!rows ? (
          <div className="mt-4">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
              className="block w-full text-sm"
            />
          </div>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {targets.map((t) => (
                <label key={t.key} className="text-xs text-warmgrey">
                  {t.label}
                  {t.key === targets[0].key ? " *" : ""}
                  <select
                    value={mapping[t.key] ?? -1}
                    onChange={(e) =>
                      setMapping((m) => {
                        const v = Number(e.target.value);
                        const next = { ...m };
                        if (v < 0) delete next[t.key];
                        else next[t.key] = v;
                        return next;
                      })
                    }
                    className="mt-0.5 block w-full rounded border border-ink/15 bg-white px-2 py-1 text-xs text-ink"
                  >
                    <option value={-1}>— not in this file —</option>
                    {headers.map((h, i) => (
                      <option key={i} value={i}>
                        {h || `(column ${i + 1})`}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <label className="mt-3 block text-xs text-warmgrey">
              Topic for this batch (optional)
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Bespoke fulfillment network"
                className="mt-0.5 block w-full rounded border border-ink/15 px-2 py-1 text-sm"
              />
            </label>
            <p className="mt-3 text-xs text-warmgrey">
              {dataRows.length} rows found below the header.
            </p>
          </>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded border border-ink/15 px-3 py-1.5 text-sm text-ink/70">
            Cancel
          </button>
          {rows && (
            <button
              onClick={doImport}
              disabled={busy}
              className="rounded bg-navy px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
              {busy ? "Importing…" : `Import ${dataRows.length} rows`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function MakerCard({ maker, onChanged }: { maker: Maker; onChanged: () => void }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const setStatus = async (status: string) => {
    await api.patch(`/api/admin/research/makers/${maker.id}`, { status });
    onChanged();
  };

  const promote = async () => {
    setBusy(true);
    try {
      await api.post(`/api/admin/research/makers/${maker.id}/promote`, {});
      toast.success(`${maker.name} added to Factories & Suppliers as an unverified lead.`);
      onChanged();
    } catch {
      /* handled */
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm(`Delete ${maker.name} from R&D? (A promoted supplier record stays.)`)) return;
    await api.delete(`/api/admin/research/makers/${maker.id}`);
    onChanged();
  };

  return (
    <div className="rounded-lg border border-ink/10 bg-white">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <button onClick={() => setOpen(!open)} className="min-w-0 flex-1 text-left">
          <span className="font-medium text-ink">{maker.name}</span>
          <span className="ml-2 text-xs text-warmgrey">
            {[maker.market, maker.location].filter(Boolean).join(" · ")}
          </span>
        </button>
        <span className="hidden text-xs text-warmgrey md:inline">{maker.minOrder}</span>
        <span className="hidden text-xs text-warmgrey md:inline">{maker.leadTime}</span>
        <select
          value={maker.status}
          onChange={(e) => setStatus(e.target.value)}
          className={`rounded-full px-2 py-0.5 text-xs ${STATUS_TONE[maker.status] ?? ""}`}
        >
          {STATUSES.map((st) => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
        </select>
        {maker.supplierId ? (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">in Suppliers</span>
        ) : (
          <button
            onClick={promote}
            disabled={busy}
            className="rounded border border-navy/30 px-2 py-0.5 text-xs text-navy hover:bg-navy hover:text-white disabled:opacity-50"
            title="Add to Factories & Suppliers as an unverified lead"
          >
            Promote
          </button>
        )}
      </div>
      {open && (
        <div className="space-y-1.5 border-t border-ink/5 px-3 py-2 text-sm text-ink/80">
          {maker.speciality && <p><span className="text-warmgrey">Speciality:</span> {maker.speciality}</p>}
          {maker.techPack && <p><span className="text-warmgrey">Tech pack:</span> {maker.techPack}</p>}
          {maker.priceUnit && <p><span className="text-warmgrey">Est. price/unit:</span> {maker.priceUnit}</p>}
          {maker.about && <p>{maker.about}</p>}
          {maker.bestUse && <p><span className="text-warmgrey">Best use:</span> {maker.bestUse}</p>}
          <p className="text-xs text-warmgrey">
            {maker.website && (
              <a href={maker.website.startsWith("http") ? maker.website : `https://${maker.website}`} target="_blank" rel="noreferrer" className="text-navy underline">
                {maker.website}
              </a>
            )}
            {maker.email && <span className="ml-2">{maker.email}</span>}
            {maker.phone && <span className="ml-2">{maker.phone}</span>}
          </p>
          <div className="pt-1">
            <button onClick={remove} className="text-xs text-red-600 hover:underline">
              Delete from R&D
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function NoteCard({ note, onChanged }: { note: Note; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const togglePin = async () => {
    await api.patch(`/api/admin/research/notes/${note.id}`, { pinned: !note.pinned });
    onChanged();
  };
  const remove = async () => {
    if (!confirm(`Delete “${note.title}”?`)) return;
    await api.delete(`/api/admin/research/notes/${note.id}`);
    onChanged();
  };
  return (
    <div className="rounded-lg border border-ink/10 bg-white">
      <div className="flex items-center gap-2 px-3 py-2">
        <button onClick={() => setOpen(!open)} className="min-w-0 flex-1 text-left">
          <span className="font-medium text-ink">{note.title}</span>
          {note.topic && <span className="ml-2 rounded-full bg-ink/5 px-2 py-0.5 text-xs text-ink/60">{note.topic}</span>}
          {note.kind === "search" && (
            <span className="ml-1 rounded-full bg-violet-50 px-2 py-0.5 text-xs text-violet-700">live research</span>
          )}
        </button>
        <button onClick={togglePin} className="text-sm" title={note.pinned ? "Unpin" : "Pin"}>
          {note.pinned ? "★" : "☆"}
        </button>
      </div>
      {open && (
        <div className="border-t border-ink/5 px-3 py-2">
          <pre className="whitespace-pre-wrap font-sans text-sm text-ink/80">{note.bodyMd}</pre>
          {note.citations.length > 0 && (
            <div className="mt-2 space-y-0.5">
              <p className="text-xs font-medium text-warmgrey">Sources</p>
              {note.citations.map((u, i) => (
                <a key={i} href={u} target="_blank" rel="noreferrer" className="block truncate text-xs text-navy underline">
                  {u}
                </a>
              ))}
            </div>
          )}
          {note.sourceUrl && (
            <a href={note.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 block truncate text-xs text-navy underline">
              {note.sourceUrl}
            </a>
          )}
          <div className="pt-2">
            <button onClick={remove} className="text-xs text-red-600 hover:underline">
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ResearchPage() {
  const toast = useToast();
  const [tab, setTab] = useState<"makers" | "notes">("makers");
  const makers = useFetch<Maker[]>("/api/admin/research/makers");
  const notes = useFetch<Note[]>("/api/admin/research/notes");
  const cfg = useFetch<{ enabled: boolean }>("/api/admin/research/config");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [query, setQuery] = useState("");
  const [importing, setImporting] = useState(false);
  const [asking, setAsking] = useState(false);
  const [askPrompt, setAskPrompt] = useState("");
  const [askTopic, setAskTopic] = useState("");
  const [showNewNote, setShowNewNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState({ title: "", topic: "", bodyMd: "" });
  const [showNewMaker, setShowNewMaker] = useState(false);
  const [makerDraft, setMakerDraft] = useState({ name: "", location: "", website: "", email: "", speciality: "" });

  const filteredMakers = useMemo(() => {
    const q = query.toLowerCase();
    return (makers.data ?? []).filter(
      (m) =>
        (!statusFilter || m.status === statusFilter) &&
        (!q ||
          [m.name, m.market, m.location, m.speciality, m.about, m.bestUse]
            .filter(Boolean)
            .some((v) => v!.toLowerCase().includes(q))),
    );
  }, [makers.data, statusFilter, query]);

  const filteredNotes = useMemo(() => {
    const q = query.toLowerCase();
    return (notes.data ?? []).filter(
      (n) => !q || [n.title, n.topic, n.bodyMd].filter(Boolean).some((v) => v!.toLowerCase().includes(q)),
    );
  }, [notes.data, query]);

  const ask = async () => {
    if (!askPrompt.trim()) return;
    setAsking(true);
    try {
      await api.post("/api/admin/research/ask", { prompt: askPrompt.trim(), topic: askTopic.trim() || undefined });
      toast.success("Answer saved to your notes, citations included.");
      setAskPrompt("");
      setTab("notes");
      notes.reload();
    } catch {
      /* handled */
    } finally {
      setAsking(false);
    }
  };

  const addNote = async () => {
    if (!noteDraft.title.trim()) return;
    await api.post("/api/admin/research/notes", noteDraft);
    setNoteDraft({ title: "", topic: "", bodyMd: "" });
    setShowNewNote(false);
    notes.reload();
  };

  const addMaker = async () => {
    if (!makerDraft.name.trim()) return;
    await api.post("/api/admin/research/makers", makerDraft);
    setMakerDraft({ name: "", location: "", website: "", email: "", speciality: "" });
    setShowNewMaker(false);
    makers.reload();
  };

  return (
    <div>
      <PageHeader
        title="R&D"
        eyebrow="Production"
        description="Your research workspace — candidate makers, findings, and live research that saves itself. When a maker earns it, promote them into Factories & Suppliers."
        help="rd-research"
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => setImporting(true)}
              className="rounded border border-ink/15 px-3 py-1.5 text-sm text-ink/80 hover:border-navy"
            >
              Import CSV
            </button>
            <button
              onClick={() => (tab === "makers" ? setShowNewMaker(true) : setShowNewNote(true))}
              className="rounded bg-navy px-3 py-1.5 text-sm text-white"
            >
              {tab === "makers" ? "Add maker" : "Add note"}
            </button>
          </div>
        }
      />

      {/* Ask panel */}
      <div className="mb-4 rounded-xl border border-ink/10 bg-white p-3">
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-0 flex-1 text-xs text-warmgrey">
            Ask a research question — the answer lands in your notes with its sources
            <input
              value={askPrompt}
              onChange={(e) => setAskPrompt(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && ask()}
              placeholder="e.g. Small-batch knitwear factories in Portugal that accept tech packs, MOQ under 50"
              className="mt-0.5 block w-full rounded border border-ink/15 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="w-44 text-xs text-warmgrey">
            Topic (optional)
            <input
              value={askTopic}
              onChange={(e) => setAskTopic(e.target.value)}
              placeholder="e.g. Knitwear"
              className="mt-0.5 block w-full rounded border border-ink/15 px-2 py-1.5 text-sm"
            />
          </label>
          <button
            onClick={ask}
            disabled={asking || cfg.data?.enabled === false}
            className="rounded bg-navy px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            {asking ? "Researching…" : "Research"}
          </button>
        </div>
        {cfg.data?.enabled === false && (
          <p className="mt-1 text-xs text-warmgrey">
            Live research isn't configured on this environment — notes, makers, and import all work without it.
          </p>
        )}
      </div>

      {/* Tabs + filters */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {(["makers", "notes"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-3 py-1 text-sm ${tab === t ? "bg-navy text-white" : "bg-ink/5 text-ink/70"}`}
          >
            {t === "makers" ? `Makers (${makers.data?.length ?? 0})` : `Notes (${notes.data?.length ?? 0})`}
          </button>
        ))}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search…"
          className="ml-auto w-48 rounded border border-ink/15 px-2 py-1 text-sm"
        />
        {tab === "makers" && (
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded border border-ink/15 px-2 py-1 text-sm"
          >
            <option value="">All statuses</option>
            {STATUSES.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* New maker / note inline forms */}
      {showNewMaker && tab === "makers" && (
        <div className="mb-3 grid grid-cols-2 gap-2 rounded-xl border border-ink/10 bg-white p-3 md:grid-cols-5">
          {(
            [
              ["name", "Name *"],
              ["location", "Location"],
              ["website", "Website"],
              ["email", "Email"],
              ["speciality", "Speciality"],
            ] as const
          ).map(([k, label]) => (
            <input
              key={k}
              value={makerDraft[k]}
              onChange={(e) => setMakerDraft((d) => ({ ...d, [k]: e.target.value }))}
              placeholder={label}
              className="rounded border border-ink/15 px-2 py-1.5 text-sm"
            />
          ))}
          <div className="col-span-2 flex gap-2 md:col-span-5">
            <button onClick={addMaker} className="rounded bg-navy px-3 py-1.5 text-sm text-white">
              Save maker
            </button>
            <button onClick={() => setShowNewMaker(false)} className="rounded border border-ink/15 px-3 py-1.5 text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}
      {showNewNote && tab === "notes" && (
        <div className="mb-3 space-y-2 rounded-xl border border-ink/10 bg-white p-3">
          <div className="flex gap-2">
            <input
              value={noteDraft.title}
              onChange={(e) => setNoteDraft((d) => ({ ...d, title: e.target.value }))}
              placeholder="Title *"
              className="flex-1 rounded border border-ink/15 px-2 py-1.5 text-sm"
            />
            <input
              value={noteDraft.topic}
              onChange={(e) => setNoteDraft((d) => ({ ...d, topic: e.target.value }))}
              placeholder="Topic"
              className="w-44 rounded border border-ink/15 px-2 py-1.5 text-sm"
            />
          </div>
          <textarea
            value={noteDraft.bodyMd}
            onChange={(e) => setNoteDraft((d) => ({ ...d, bodyMd: e.target.value }))}
            placeholder="Your research, in markdown or plain text…"
            rows={6}
            className="w-full rounded border border-ink/15 px-2 py-1.5 text-sm"
          />
          <div className="flex gap-2">
            <button onClick={addNote} className="rounded bg-navy px-3 py-1.5 text-sm text-white">
              Save note
            </button>
            <button onClick={() => setShowNewNote(false)} className="rounded border border-ink/15 px-3 py-1.5 text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Lists */}
      {tab === "makers" ? (
        filteredMakers.length ? (
          <div className="space-y-2">
            {filteredMakers.map((m) => (
              <MakerCard key={m.id} maker={m} onChanged={makers.reload} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No makers yet"
            hint="Import your research CSV, add makers by hand, or ask a research question above — candidates you like get promoted into Factories & Suppliers."
          />
        )
      ) : filteredNotes.length ? (
        <div className="space-y-2">
          {filteredNotes.map((n) => (
            <NoteCard key={n.id} note={n} onChanged={notes.reload} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No notes yet"
          hint="Save findings as notes, import them from CSV, or ask a research question — live answers save themselves here with citations."
        />
      )}

      {importing && (
        <ImportDialog
          mode={tab}
          onClose={() => setImporting(false)}
          onDone={() => (tab === "makers" ? makers.reload() : notes.reload())}
        />
      )}
    </div>
  );
}
