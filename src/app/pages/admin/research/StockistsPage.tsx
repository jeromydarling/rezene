import { useMemo, useState } from "react";
import { PageHeader, EmptyState } from "../../../components/admin/ui";
import { Markdown } from "../../../components/Markdown";
import { api } from "../../../lib/api";
import { useFetch } from "../../../lib/useFetch";
import { useToast } from "../../../lib/toast";
import { ResearchNav, ResearchButton, Sources, sinceLabel } from "./shared";

/**
 * Stockist research — the wholesale pipeline before it's a pipeline: which
 * doors could carry the label, what they actually stock, how they buy, and
 * where each conversation stands. Research profiles a door with sources;
 * the status chip walks it from researching to stocked.
 */

interface Stockist {
  id: string;
  name: string;
  kind: string;
  city: string | null;
  country: string | null;
  website: string | null;
  instagram: string | null;
  email: string | null;
  phone: string | null;
  brandsCarried: string | null;
  pricePoint: string | null;
  fitNote: string | null;
  dossierMd: string | null;
  citations: string[];
  status: string;
  lastResearchedAt: string | null;
}

const KINDS = ["boutique", "department", "online", "showroom", "fair", "popup"] as const;
const STATUSES = ["researching", "shortlist", "pitched", "in_talks", "stocked", "passed"] as const;
const STATUS_LABEL: Record<string, string> = {
  researching: "researching",
  shortlist: "shortlist",
  pitched: "pitched",
  in_talks: "in talks",
  stocked: "stocked",
  passed: "passed",
};
const STATUS_TONE: Record<string, string> = {
  researching: "bg-ink/5 text-ink/70",
  shortlist: "bg-sky-100 text-sky-800",
  pitched: "bg-amber-100 text-amber-800",
  in_talks: "bg-violet-50 text-violet-700",
  stocked: "bg-emerald-100 text-emerald-800",
  passed: "bg-ink/5 text-ink/40 line-through",
};

function StockistCard({ stockist, enabled, onChanged }: { stockist: Stockist; enabled: boolean | undefined; onChanged: () => void }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const setStatus = async (status: string) => {
    await api.patch(`/api/admin/research/stockists/${stockist.id}`, { status });
    onChanged();
  };

  const research = async () => {
    setBusy(true);
    try {
      await api.post(`/api/admin/research/stockists/${stockist.id}/research`, {});
      toast.success("Door profiled — what they carry, how they buy, and whether you fit, with sources.");
      onChanged();
    } catch {
      /* handled */
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    const res = await api.delete<{ ok: boolean; undoId?: string }>(`/api/admin/research/stockists/${stockist.id}`);
    onChanged();
    if (res.undoId) {
      const undoId = res.undoId;
      toast.undo(`Deleted ${stockist.name}.`, async () => {
        await api.post(`/api/admin/undo/${undoId}`, {});
        onChanged();
      });
    }
  };

  return (
    <div className="rounded-lg border border-ink/10 bg-white">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <button onClick={() => setOpen(!open)} className="min-w-0 flex-1 text-left">
          <span className="font-medium text-ink">{stockist.name}</span>
          <span className="ml-2 text-xs text-warmgrey">
            {[stockist.kind, [stockist.city, stockist.country].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}
          </span>
        </button>
        {stockist.pricePoint && <span className="hidden text-xs text-warmgrey md:inline">{stockist.pricePoint}</span>}
        <select
          value={stockist.status}
          onChange={(e) => setStatus(e.target.value)}
          className={`rounded-full px-2 py-0.5 text-xs ${STATUS_TONE[stockist.status] ?? ""}`}
        >
          {STATUSES.map((st) => (
            <option key={st} value={st}>
              {STATUS_LABEL[st]}
            </option>
          ))}
        </select>
      </div>
      {open && (
        <div className="space-y-3 border-t border-ink/5 px-3 py-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-warmgrey">
            {stockist.website && (
              <a href={stockist.website.startsWith("http") ? stockist.website : `https://${stockist.website}`} target="_blank" rel="noreferrer" className="text-navy underline">
                {stockist.website}
              </a>
            )}
            {stockist.instagram && <span>{stockist.instagram.startsWith("@") ? stockist.instagram : `@${stockist.instagram}`}</span>}
            {stockist.email && <span>{stockist.email}</span>}
            {stockist.phone && <span>{stockist.phone}</span>}
          </div>
          {stockist.brandsCarried && (
            <p className="text-sm text-ink/80">
              <span className="text-warmgrey">Carries:</span> {stockist.brandsCarried}
            </p>
          )}
          {stockist.fitNote && <p className="text-sm text-ink/80">{stockist.fitNote}</p>}

          <div className="flex items-center gap-2">
            <ResearchButton
              busy={busy}
              refreshed={Boolean(stockist.dossierMd)}
              enabled={enabled}
              onClick={research}
              label="Profile this door"
              refreshLabel="Refresh profile"
            />
            {stockist.dossierMd && (
              <span className="text-xs text-warmgrey">profiled {sinceLabel(stockist.lastResearchedAt)}</span>
            )}
          </div>

          {stockist.dossierMd && (
            <div className="rounded-lg bg-ink/[0.02] p-3">
              <Markdown text={stockist.dossierMd} headingBase={2} />
              <Sources urls={stockist.citations} />
            </div>
          )}

          <button onClick={remove} className="text-xs text-red-600 hover:underline">
            Delete stockist
          </button>
        </div>
      )}
    </div>
  );
}

export function StockistsPage() {
  const stockists = useFetch<Stockist[]>("/api/admin/research/stockists");
  const cfg = useFetch<{ enabled: boolean }>("/api/admin/research/config");
  const [showNew, setShowNew] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState({ name: "", kind: "boutique", city: "", country: "", website: "" });

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return (stockists.data ?? []).filter(
      (st) =>
        (!statusFilter || st.status === statusFilter) &&
        (!q || [st.name, st.city, st.country, st.brandsCarried].filter(Boolean).some((v) => v!.toLowerCase().includes(q))),
    );
  }, [stockists.data, statusFilter, query]);

  const add = async () => {
    if (!draft.name.trim()) return;
    await api.post("/api/admin/research/stockists", draft);
    setDraft({ name: "", kind: "boutique", city: "", country: "", website: "" });
    setShowNew(false);
    stockists.reload();
  };

  return (
    <div>
      <PageHeader
        title="Stockists"
        eyebrow="R&D"
        description="The doors that could carry the label — boutiques, online retailers, showrooms, fairs. Profile each one, shortlist the fits, and walk the pipeline to stocked."
        help="rd-stockists"
        actions={
          <button onClick={() => setShowNew(true)} className="rounded bg-navy px-3 py-1.5 text-sm text-white">
            Add stockist
          </button>
        }
      />
      <ResearchNav />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search…"
          className="ml-auto w-48 rounded border border-ink/15 px-2 py-1 text-sm"
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded border border-ink/15 px-2 py-1 text-sm">
          <option value="">All statuses</option>
          {STATUSES.map((st) => (
            <option key={st} value={st}>
              {STATUS_LABEL[st]}
            </option>
          ))}
        </select>
      </div>

      {showNew && (
        <div className="mb-3 grid grid-cols-2 gap-2 rounded-xl border border-ink/10 bg-white p-3 md:grid-cols-6">
          <input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="Name *" className="rounded border border-ink/15 px-2 py-1.5 text-sm" />
          <select value={draft.kind} onChange={(e) => setDraft((d) => ({ ...d, kind: e.target.value }))} className="rounded border border-ink/15 bg-white px-2 py-1.5 text-sm">
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <input value={draft.city} onChange={(e) => setDraft((d) => ({ ...d, city: e.target.value }))} placeholder="City" className="rounded border border-ink/15 px-2 py-1.5 text-sm" />
          <input value={draft.country} onChange={(e) => setDraft((d) => ({ ...d, country: e.target.value }))} placeholder="Country" className="rounded border border-ink/15 px-2 py-1.5 text-sm" />
          <input value={draft.website} onChange={(e) => setDraft((d) => ({ ...d, website: e.target.value }))} placeholder="Website" className="rounded border border-ink/15 px-2 py-1.5 text-sm" />
          <div className="flex gap-2">
            <button onClick={add} className="rounded bg-navy px-3 py-1.5 text-sm text-white">Save</button>
            <button onClick={() => setShowNew(false)} className="rounded border border-ink/15 px-3 py-1.5 text-sm">Cancel</button>
          </div>
        </div>
      )}

      {filtered.length ? (
        <div className="space-y-2">
          {filtered.map((st) => (
            <StockistCard key={st.id} stockist={st} enabled={cfg.data?.enabled} onChanged={stockists.reload} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No stockists yet"
          hint="Add the boutiques and online retailers your customer already shops. Research profiles each door — what they carry, how they buy — and the pipeline tracks every pitch."
        />
      )}
    </div>
  );
}
