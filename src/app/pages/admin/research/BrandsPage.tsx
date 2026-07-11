import { useMemo, useState } from "react";
import { PageHeader, EmptyState } from "../../../components/admin/ui";
import { Markdown } from "../../../components/Markdown";
import { api } from "../../../lib/api";
import { useFetch } from "../../../lib/useFetch";
import { useToast } from "../../../lib/toast";
import { ResearchNav, ResearchButton, Sources, WatchToggle, money, parseMoney, sinceLabel } from "./shared";

/**
 * Brand dossiers — competition research that stays current. Each dossier is
 * live-researched with citations; watched brands re-research themselves
 * weekly and every refresh keeps the previous dossier as a snapshot, so
 * "what changed" is an answer, not a memory.
 */

interface Brand {
  id: string;
  name: string;
  website: string | null;
  instagram: string | null;
  segment: string;
  positioning: string | null;
  priceFloorCents: number | null;
  priceCeilingCents: number | null;
  currency: string;
  channels: string[];
  dossierMd: string | null;
  citations: string[];
  note: string | null;
  watch: boolean;
  lastResearchedAt: string | null;
  snapshots: number;
}

interface Snapshot {
  id: string;
  dossierMd: string;
  citations: string[];
  createdAt: string;
}

const SEGMENT_LABEL: Record<string, string> = {
  direct: "direct competitor",
  aspirational: "aspirational",
  adjacent: "adjacent",
};
const SEGMENT_TONE: Record<string, string> = {
  direct: "bg-terracotta/10 text-terracotta",
  aspirational: "bg-violet-50 text-violet-700",
  adjacent: "bg-sky-50 text-sky-700",
};

function BrandCard({ brand, enabled, onChanged }: { brand: Brand; enabled: boolean | undefined; onChanged: () => void }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [snapshots, setSnapshots] = useState<Snapshot[] | null>(null);
  const [floor, setFloor] = useState(brand.priceFloorCents !== null ? String(brand.priceFloorCents / 100) : "");
  const [ceiling, setCeiling] = useState(brand.priceCeilingCents !== null ? String(brand.priceCeilingCents / 100) : "");

  const research = async () => {
    setBusy(true);
    try {
      await api.post(`/api/admin/research/brands/${brand.id}/research`, {});
      toast.success(`Dossier ${brand.dossierMd ? "refreshed — check “What changed”" : "researched"}, sources included.`);
      onChanged();
    } catch {
      /* handled */
    } finally {
      setBusy(false);
    }
  };

  const setWatch = async (watch: boolean) => {
    await api.patch(`/api/admin/research/brands/${brand.id}`, { watch });
    onChanged();
  };

  const savePrices = async () => {
    await api.patch(`/api/admin/research/brands/${brand.id}`, {
      priceFloorCents: parseMoney(floor),
      priceCeilingCents: parseMoney(ceiling),
    });
    toast.success("Price range saved.");
    onChanged();
  };

  const loadHistory = async () => {
    setShowHistory(!showHistory);
    if (!snapshots) {
      setSnapshots(await api.get<Snapshot[]>(`/api/admin/research/brands/${brand.id}/snapshots`));
    }
  };

  const remove = async () => {
    const res = await api.delete<{ ok: boolean; undoId?: string }>(`/api/admin/research/brands/${brand.id}`);
    onChanged();
    if (res.undoId) {
      const undoId = res.undoId;
      toast.undo(`Deleted ${brand.name}.`, async () => {
        await api.post(`/api/admin/undo/${undoId}`, {});
        onChanged();
      });
    }
  };

  return (
    <div className="rounded-lg border border-ink/10 bg-white">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <button onClick={() => setOpen(!open)} className="min-w-0 flex-1 text-left">
          <span className="font-medium text-ink">{brand.name}</span>
          <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${SEGMENT_TONE[brand.segment] ?? "bg-ink/5 text-ink/60"}`}>
            {SEGMENT_LABEL[brand.segment] ?? brand.segment}
          </span>
          {brand.priceFloorCents !== null && brand.priceCeilingCents !== null && (
            <span className="ml-2 text-xs text-warmgrey">
              {money(brand.priceFloorCents, brand.currency)}–{money(brand.priceCeilingCents, brand.currency)}
            </span>
          )}
        </button>
        <span className="hidden text-xs text-warmgrey sm:inline">
          {brand.dossierMd ? `researched ${sinceLabel(brand.lastResearchedAt)}` : "no dossier yet"}
        </span>
        <WatchToggle watch={brand.watch} onToggle={setWatch} />
      </div>
      {open && (
        <div className="space-y-3 border-t border-ink/5 px-3 py-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-warmgrey">
            {brand.website && (
              <a href={brand.website.startsWith("http") ? brand.website : `https://${brand.website}`} target="_blank" rel="noreferrer" className="text-navy underline">
                {brand.website}
              </a>
            )}
            {brand.instagram && <span>{brand.instagram.startsWith("@") ? brand.instagram : `@${brand.instagram}`}</span>}
            {brand.channels.length > 0 && <span>channels: {brand.channels.join(", ")}</span>}
          </div>
          {brand.positioning && <p className="text-sm text-ink/80">{brand.positioning}</p>}

          {/* Observed price range — the quick-read number on the card. */}
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-warmgrey">
              Entry price ({brand.currency})
              <input value={floor} onChange={(e) => setFloor(e.target.value)} placeholder="e.g. 120"
                className="mt-0.5 block w-28 rounded border border-ink/15 px-2 py-1 text-sm" />
            </label>
            <label className="text-xs text-warmgrey">
              Top price ({brand.currency})
              <input value={ceiling} onChange={(e) => setCeiling(e.target.value)} placeholder="e.g. 480"
                className="mt-0.5 block w-28 rounded border border-ink/15 px-2 py-1 text-sm" />
            </label>
            <button onClick={savePrices} className="rounded border border-ink/15 px-2.5 py-1 text-xs text-ink/70 hover:border-navy">
              Save range
            </button>
            <div className="ml-auto">
              <ResearchButton
                busy={busy}
                refreshed={Boolean(brand.dossierMd)}
                enabled={enabled}
                onClick={research}
                label="Research this brand"
                refreshLabel="Refresh dossier"
              />
            </div>
          </div>

          {brand.dossierMd ? (
            <div className="rounded-lg bg-ink/[0.02] p-3">
              <Markdown text={brand.dossierMd} headingBase={2} />
              <Sources urls={brand.citations} />
            </div>
          ) : (
            <p className="text-sm text-warmgrey">
              No dossier yet — research pulls their positioning, price architecture, channels and
              recent moves, with sources for every claim.
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            {brand.snapshots > 0 && (
              <button onClick={loadHistory} className="text-xs text-navy hover:underline">
                {showHistory ? "Hide history" : `History (${brand.snapshots})`}
              </button>
            )}
            <button onClick={remove} className="text-xs text-red-600 hover:underline">
              Delete dossier
            </button>
          </div>

          {showHistory && snapshots && (
            <div className="space-y-2">
              {snapshots.map((sn) => (
                <details key={sn.id} className="rounded border border-ink/10 p-2">
                  <summary className="cursor-pointer text-xs text-warmgrey">Snapshot · {sinceLabel(sn.createdAt)}</summary>
                  <div className="mt-2">
                    <Markdown text={sn.dossierMd} headingBase={2} />
                    <Sources urls={sn.citations} />
                  </div>
                </details>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function BrandsPage() {
  const brands = useFetch<Brand[]>("/api/admin/research/brands");
  const cfg = useFetch<{ enabled: boolean }>("/api/admin/research/config");
  const [showNew, setShowNew] = useState(false);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState({ name: "", website: "", instagram: "", segment: "direct", positioning: "" });

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return (brands.data ?? []).filter(
      (b) => !q || [b.name, b.positioning, b.dossierMd].filter(Boolean).some((v) => v!.toLowerCase().includes(q)),
    );
  }, [brands.data, query]);

  const add = async () => {
    if (!draft.name.trim()) return;
    await api.post("/api/admin/research/brands", draft);
    setDraft({ name: "", website: "", instagram: "", segment: "direct", positioning: "" });
    setShowNew(false);
    brands.reload();
  };

  return (
    <div>
      <PageHeader
        title="Brand dossiers"
        eyebrow="R&D"
        description="Who else sells to your customer — positioning, price architecture, channels, recent moves. Watch a brand and Verto keeps its dossier current for you."
        help="rd-brands"
        actions={
          <button onClick={() => setShowNew(true)} className="rounded bg-navy px-3 py-1.5 text-sm text-white">
            Add brand
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
      </div>

      {showNew && (
        <div className="mb-3 grid grid-cols-2 gap-2 rounded-xl border border-ink/10 bg-white p-3 md:grid-cols-5">
          <input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="Brand name *" className="rounded border border-ink/15 px-2 py-1.5 text-sm" />
          <input value={draft.website} onChange={(e) => setDraft((d) => ({ ...d, website: e.target.value }))} placeholder="Website" className="rounded border border-ink/15 px-2 py-1.5 text-sm" />
          <input value={draft.instagram} onChange={(e) => setDraft((d) => ({ ...d, instagram: e.target.value }))} placeholder="Instagram" className="rounded border border-ink/15 px-2 py-1.5 text-sm" />
          <select value={draft.segment} onChange={(e) => setDraft((d) => ({ ...d, segment: e.target.value }))} className="rounded border border-ink/15 bg-white px-2 py-1.5 text-sm">
            <option value="direct">Direct competitor</option>
            <option value="aspirational">Aspirational</option>
            <option value="adjacent">Adjacent</option>
          </select>
          <input value={draft.positioning} onChange={(e) => setDraft((d) => ({ ...d, positioning: e.target.value }))} placeholder="Your one-line read (optional)" className="rounded border border-ink/15 px-2 py-1.5 text-sm" />
          <div className="col-span-2 flex gap-2 md:col-span-5">
            <button onClick={add} className="rounded bg-navy px-3 py-1.5 text-sm text-white">Save brand</button>
            <button onClick={() => setShowNew(false)} className="rounded border border-ink/15 px-3 py-1.5 text-sm">Cancel</button>
          </div>
        </div>
      )}

      {filtered.length ? (
        <div className="space-y-2">
          {filtered.map((b) => (
            <BrandCard key={b.id} brand={b} enabled={cfg.data?.enabled} onChanged={brands.reload} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No brand dossiers yet"
          hint="Add the two or three labels your customer also shops, research each one, and put the direct competitors on watch — the weekly refresh tells you when their prices or stockists move."
        />
      )}
    </div>
  );
}
