import { useState } from "react";
import { useNavigate } from "react-router";
import { PageHeader, EmptyState } from "../../../components/admin/ui";
import { Markdown } from "../../../components/Markdown";
import { api } from "../../../lib/api";
import { useFetch } from "../../../lib/useFetch";
import { useToast } from "../../../lib/toast";
import { ResearchNav, ResearchButton, Sources, WatchToggle, sinceLabel } from "./shared";

/**
 * Trend boards — season scouting with receipts. Each board is one direction
 * you're considering (a silhouette, a fabric story, a color family); the
 * brief is live-researched with sources, watched boards stay current, and
 * an adopted board opens in the Design Studio as a concept ready to
 * generate from.
 */

interface Board {
  id: string;
  title: string;
  season: string | null;
  focus: string;
  briefMd: string | null;
  citations: string[];
  items: { label: string; note?: string }[];
  status: string;
  conceptId: string | null;
  watch: boolean;
  lastResearchedAt: string | null;
}

const FOCUS_OPTIONS = ["silhouettes", "fabrics", "colors", "details", "market"] as const;
const STATUS_TONE: Record<string, string> = {
  exploring: "bg-amber-100 text-amber-800",
  adopted: "bg-emerald-100 text-emerald-800",
  passed: "bg-ink/5 text-ink/40 line-through",
};

function BoardCard({ board, enabled, onChanged }: { board: Board; enabled: boolean | undefined; onChanged: () => void }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [newItem, setNewItem] = useState("");

  const research = async () => {
    setBusy(true);
    try {
      await api.post(`/api/admin/research/trends/${board.id}/research`, {});
      toast.success(`Brief ${board.briefMd ? "refreshed — check “What's new”" : "researched"}, sources included.`);
      onChanged();
    } catch {
      /* handled */
    } finally {
      setBusy(false);
    }
  };

  const setWatch = async (watch: boolean) => {
    await api.patch(`/api/admin/research/trends/${board.id}`, { watch });
    onChanged();
  };

  const setStatus = async (status: string) => {
    await api.patch(`/api/admin/research/trends/${board.id}`, { status });
    onChanged();
  };

  const addItem = async () => {
    if (!newItem.trim()) return;
    await api.patch(`/api/admin/research/trends/${board.id}`, {
      items: [...board.items, { label: newItem.trim() }],
    });
    setNewItem("");
    onChanged();
  };

  const removeItem = async (idx: number) => {
    await api.patch(`/api/admin/research/trends/${board.id}`, {
      items: board.items.filter((_, i) => i !== idx),
    });
    onChanged();
  };

  const toStudio = async () => {
    try {
      const res = await api.post<{ conceptId: string }>(`/api/admin/research/trends/${board.id}/to-design-studio`, {});
      toast.success("Board adopted — it's waiting in the Design Studio as a concept.");
      onChanged();
      if (res.conceptId) navigate("/admin/ai-concepts");
    } catch {
      /* handled */
    }
  };

  const remove = async () => {
    const res = await api.delete<{ ok: boolean; undoId?: string }>(`/api/admin/research/trends/${board.id}`);
    onChanged();
    if (res.undoId) {
      const undoId = res.undoId;
      toast.undo(`Deleted “${board.title}”.`, async () => {
        await api.post(`/api/admin/undo/${undoId}`, {});
        onChanged();
      });
    }
  };

  return (
    <div className="rounded-lg border border-ink/10 bg-white">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <button onClick={() => setOpen(!open)} className="min-w-0 flex-1 text-left">
          <span className="font-medium text-ink">{board.title}</span>
          <span className="ml-2 text-xs text-warmgrey">{[board.season, board.focus].filter(Boolean).join(" · ")}</span>
        </button>
        <select
          value={board.status}
          onChange={(e) => setStatus(e.target.value)}
          className={`rounded-full px-2 py-0.5 text-xs ${STATUS_TONE[board.status] ?? ""}`}
        >
          <option value="exploring">exploring</option>
          <option value="adopted">adopted</option>
          <option value="passed">passed</option>
        </select>
        <WatchToggle watch={board.watch} onToggle={setWatch} />
      </div>
      {open && (
        <div className="space-y-3 border-t border-ink/5 px-3 py-3">
          {/* Directions */}
          <div className="flex flex-wrap items-center gap-1.5">
            {board.items.map((item, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded-full bg-ink/5 px-2.5 py-0.5 text-xs text-ink/80">
                {item.label}
                <button onClick={() => removeItem(i)} className="text-ink/40 hover:text-red-600">
                  ×
                </button>
              </span>
            ))}
            <input
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addItem()}
              placeholder="Add a direction…"
              className="w-40 rounded border border-ink/15 px-2 py-0.5 text-xs"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ResearchButton
              busy={busy}
              refreshed={Boolean(board.briefMd)}
              enabled={enabled}
              onClick={research}
              label="Research this direction"
              refreshLabel="Refresh brief"
            />
            {board.conceptId ? (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">in the Design Studio</span>
            ) : (
              <button
                onClick={toStudio}
                className="rounded border border-navy/30 px-3 py-1.5 text-sm text-navy hover:bg-navy hover:text-white"
                title="Adopt this direction: it becomes a Design Studio concept with the brief attached"
              >
                Open in Design Studio
              </button>
            )}
            {board.briefMd && (
              <span className="text-xs text-warmgrey">researched {sinceLabel(board.lastResearchedAt)}</span>
            )}
          </div>

          {board.briefMd ? (
            <div className="rounded-lg bg-ink/[0.02] p-3">
              <Markdown text={board.briefMd} headingBase={2} />
              <Sources urls={board.citations} />
            </div>
          ) : (
            <p className="text-sm text-warmgrey">
              No brief yet — research grounds the direction: who's showing it, which fabrics carry
              it, and how to produce it small-batch, with sources.
            </p>
          )}

          <button onClick={remove} className="text-xs text-red-600 hover:underline">
            Delete board
          </button>
        </div>
      )}
    </div>
  );
}

export function TrendsPage() {
  const boards = useFetch<Board[]>("/api/admin/research/trends");
  const cfg = useFetch<{ enabled: boolean }>("/api/admin/research/config");
  const [showNew, setShowNew] = useState(false);
  const [draft, setDraft] = useState({ title: "", season: "", focus: "silhouettes" });

  const add = async () => {
    if (!draft.title.trim()) return;
    await api.post("/api/admin/research/trends", draft);
    setDraft({ title: "", season: "", focus: "silhouettes" });
    setShowNew(false);
    boards.reload();
  };

  return (
    <div>
      <PageHeader
        title="Trend boards"
        eyebrow="R&D"
        description="Season scouting with receipts — one board per direction you're weighing. Adopted boards open in the Design Studio; watched boards keep themselves current."
        help="rd-trends"
        actions={
          <button onClick={() => setShowNew(true)} className="rounded bg-navy px-3 py-1.5 text-sm text-white">
            New board
          </button>
        }
      />
      <ResearchNav />

      {showNew && (
        <div className="mb-3 grid grid-cols-2 gap-2 rounded-xl border border-ink/10 bg-white p-3 md:grid-cols-4">
          <input value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} placeholder="Direction, e.g. Fluid tailoring *" className="rounded border border-ink/15 px-2 py-1.5 text-sm" />
          <input value={draft.season} onChange={(e) => setDraft((d) => ({ ...d, season: e.target.value }))} placeholder="Season, e.g. SS27" className="rounded border border-ink/15 px-2 py-1.5 text-sm" />
          <select value={draft.focus} onChange={(e) => setDraft((d) => ({ ...d, focus: e.target.value }))} className="rounded border border-ink/15 bg-white px-2 py-1.5 text-sm">
            {FOCUS_OPTIONS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <button onClick={add} className="rounded bg-navy px-3 py-1.5 text-sm text-white">Create</button>
            <button onClick={() => setShowNew(false)} className="rounded border border-ink/15 px-3 py-1.5 text-sm">Cancel</button>
          </div>
        </div>
      )}

      {(boards.data ?? []).length ? (
        <div className="space-y-2">
          {(boards.data ?? []).map((b) => (
            <BoardCard key={b.id} board={b} enabled={cfg.data?.enabled} onChanged={boards.reload} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No trend boards yet"
          hint="Start a board per direction you're weighing for the season — research grounds it with sources, and adopting it hands the brief to the Design Studio."
        />
      )}
    </div>
  );
}
