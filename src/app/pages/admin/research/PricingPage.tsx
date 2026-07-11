import { useMemo, useState } from "react";
import { Link } from "react-router";
import { PageHeader, EmptyState } from "../../../components/admin/ui";
import { Markdown } from "../../../components/Markdown";
import { api } from "../../../lib/api";
import { useFetch } from "../../../lib/useFetch";
import { useToast } from "../../../lib/toast";
import { ResearchNav, ResearchButton, Sources, money, parseMoney, sinceLabel } from "./shared";

/**
 * Price studies — one question per study: "what should this category retail
 * for, in this market?" A comps table of real garments at real prices, a
 * low/mid/high band, and a cited recommendation. The decision pushes the
 * target retail straight into the style's cost sheet, where margins take
 * over.
 */

interface Comp {
  id: string;
  brand: string;
  product: string | null;
  priceCents: number | null;
  currency: string;
  url: string | null;
  fabric: string | null;
  origin: string | null;
  note: string | null;
}

interface Study {
  id: string;
  name: string;
  category: string | null;
  market: string | null;
  styleId: string | null;
  currency: string;
  bandLowCents: number | null;
  bandMidCents: number | null;
  bandHighCents: number | null;
  recommendationMd: string | null;
  citations: string[];
  status: string;
  lastResearchedAt: string | null;
  comps: Comp[];
}

interface StyleLite {
  id: string;
  name: string;
  styleCode: string;
}

function CompRow({ comp, onChanged }: { comp: Comp; onChanged: () => void }) {
  const remove = async () => {
    await api.delete(`/api/admin/research/pricing/comps/${comp.id}`);
    onChanged();
  };
  return (
    <tr className="border-t border-ink/5">
      <td className="px-2 py-1.5 font-medium text-ink">{comp.brand}</td>
      <td className="px-2 py-1.5 text-ink/80">
        {comp.url ? (
          <a href={comp.url} target="_blank" rel="noreferrer" className="text-navy underline">
            {comp.product ?? "view"}
          </a>
        ) : (
          comp.product
        )}
      </td>
      <td className="px-2 py-1.5 text-right tabular-nums">{money(comp.priceCents, comp.currency)}</td>
      <td className="hidden px-2 py-1.5 text-ink/60 md:table-cell">{comp.fabric}</td>
      <td className="hidden px-2 py-1.5 text-ink/60 md:table-cell">{comp.origin}</td>
      <td className="px-2 py-1.5 text-right">
        <button onClick={remove} className="text-xs text-red-600 hover:underline">
          remove
        </button>
      </td>
    </tr>
  );
}

function StudyCard({
  study,
  styles,
  enabled,
  onChanged,
}: {
  study: Study;
  styles: StyleLite[];
  enabled: boolean | undefined;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [bands, setBands] = useState({
    low: study.bandLowCents !== null ? String(study.bandLowCents / 100) : "",
    mid: study.bandMidCents !== null ? String(study.bandMidCents / 100) : "",
    high: study.bandHighCents !== null ? String(study.bandHighCents / 100) : "",
  });
  const [comp, setComp] = useState({ brand: "", product: "", price: "", url: "", fabric: "", origin: "" });
  const [applyStyle, setApplyStyle] = useState(study.styleId ?? "");
  const [applyPrice, setApplyPrice] = useState(study.bandMidCents !== null ? String(study.bandMidCents / 100) : "");

  const research = async () => {
    setBusy(true);
    try {
      await api.post(`/api/admin/research/pricing/${study.id}/research`, {});
      toast.success("Price research saved — comparables, bands and a recommendation, with sources.");
      onChanged();
    } catch {
      /* handled */
    } finally {
      setBusy(false);
    }
  };

  const saveBands = async () => {
    await api.patch(`/api/admin/research/pricing/${study.id}`, {
      bandLowCents: parseMoney(bands.low),
      bandMidCents: parseMoney(bands.mid),
      bandHighCents: parseMoney(bands.high),
    });
    toast.success("Bands saved.");
    onChanged();
  };

  const addComp = async () => {
    if (!comp.brand.trim()) return;
    await api.post(`/api/admin/research/pricing/${study.id}/comps`, {
      brand: comp.brand,
      product: comp.product || undefined,
      priceCents: parseMoney(comp.price) ?? undefined,
      url: comp.url || undefined,
      fabric: comp.fabric || undefined,
      origin: comp.origin || undefined,
      currency: study.currency,
    });
    setComp({ brand: "", product: "", price: "", url: "", fabric: "", origin: "" });
    onChanged();
  };

  const applyRetail = async () => {
    const centsVal = parseMoney(applyPrice);
    if (!applyStyle || !centsVal) {
      toast.error("Pick a style and a target retail first.");
      return;
    }
    try {
      await api.post(`/api/admin/research/pricing/${study.id}/apply-retail`, { styleId: applyStyle, cents: centsVal });
      toast.success("Target retail pushed into the style's cost sheet — open Costing & Margins to see the margin.");
      onChanged();
    } catch {
      /* handled */
    }
  };

  const remove = async () => {
    const res = await api.delete<{ ok: boolean; undoId?: string }>(`/api/admin/research/pricing/${study.id}`);
    onChanged();
    if (res.undoId) {
      const undoId = res.undoId;
      toast.undo(`Deleted “${study.name}”.`, async () => {
        await api.post(`/api/admin/undo/${undoId}`, {});
        onChanged();
      });
    }
  };

  const bandSummary =
    study.bandLowCents !== null && study.bandHighCents !== null
      ? `${money(study.bandLowCents, study.currency)} – ${money(study.bandHighCents, study.currency)}`
      : null;

  return (
    <div className="rounded-lg border border-ink/10 bg-white">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <button onClick={() => setOpen(!open)} className="min-w-0 flex-1 text-left">
          <span className="font-medium text-ink">{study.name}</span>
          <span className="ml-2 text-xs text-warmgrey">{[study.market, bandSummary].filter(Boolean).join(" · ")}</span>
        </button>
        <span className="text-xs text-warmgrey">{study.comps.length} comps</span>
        <span
          className={`rounded-full px-2 py-0.5 text-xs ${study.status === "decided" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}
        >
          {study.status === "decided" ? "decided" : "open"}
        </span>
      </div>
      {open && (
        <div className="space-y-3 border-t border-ink/5 px-3 py-3">
          <div className="flex flex-wrap items-end gap-2">
            {(
              [
                ["low", "Accessible"],
                ["mid", "Core"],
                ["high", "Premium"],
              ] as const
            ).map(([k, label]) => (
              <label key={k} className="text-xs text-warmgrey">
                {label} ({study.currency})
                <input
                  value={bands[k]}
                  onChange={(e) => setBands((b) => ({ ...b, [k]: e.target.value }))}
                  placeholder="—"
                  className="mt-0.5 block w-24 rounded border border-ink/15 px-2 py-1 text-sm"
                />
              </label>
            ))}
            <button onClick={saveBands} className="rounded border border-ink/15 px-2.5 py-1 text-xs text-ink/70 hover:border-navy">
              Save bands
            </button>
            <div className="ml-auto">
              <ResearchButton
                busy={busy}
                refreshed={Boolean(study.recommendationMd)}
                enabled={enabled}
                onClick={research}
                label="Research this price point"
              />
            </div>
          </div>

          {/* Comps table */}
          <div className="overflow-x-auto rounded-lg border border-ink/10">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="bg-ink/[0.03] text-left text-xs text-warmgrey">
                  <th className="px-2 py-1.5 font-medium">Brand</th>
                  <th className="px-2 py-1.5 font-medium">Product</th>
                  <th className="px-2 py-1.5 text-right font-medium">Price</th>
                  <th className="hidden px-2 py-1.5 font-medium md:table-cell">Fabric</th>
                  <th className="hidden px-2 py-1.5 font-medium md:table-cell">Made in</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {study.comps.map((cp) => (
                  <CompRow key={cp.id} comp={cp} onChanged={onChanged} />
                ))}
                <tr className="border-t border-ink/5 bg-ink/[0.015]">
                  {(
                    [
                      ["brand", "Brand *"],
                      ["product", "Product"],
                      ["price", "Price"],
                      ["fabric", "Fabric"],
                      ["origin", "Made in"],
                    ] as const
                  ).map(([k, ph], i) => (
                    <td key={k} className={`px-1 py-1 ${i >= 3 ? "hidden md:table-cell" : ""}`}>
                      <input
                        value={comp[k]}
                        onChange={(e) => setComp((c0) => ({ ...c0, [k]: e.target.value }))}
                        placeholder={ph}
                        className={`w-full rounded border border-ink/15 px-1.5 py-1 text-xs ${k === "price" ? "text-right" : ""}`}
                      />
                    </td>
                  ))}
                  <td className="px-1 py-1 text-right">
                    <button onClick={addComp} className="rounded bg-navy px-2 py-1 text-xs text-white">
                      Add
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {study.recommendationMd && (
            <div className="rounded-lg bg-ink/[0.02] p-3">
              <p className="mb-1 text-xs text-warmgrey">Researched {sinceLabel(study.lastResearchedAt)}</p>
              <Markdown text={study.recommendationMd} headingBase={2} />
              <Sources urls={study.citations} />
            </div>
          )}

          {/* The handoff */}
          <div className="flex flex-wrap items-end gap-2 rounded-lg border border-navy/15 bg-navy/[0.03] p-3">
            <label className="text-xs text-warmgrey">
              Style
              <select
                value={applyStyle}
                onChange={(e) => setApplyStyle(e.target.value)}
                className="mt-0.5 block w-48 rounded border border-ink/15 bg-white px-2 py-1 text-sm"
              >
                <option value="">— pick a style —</option>
                {styles.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-warmgrey">
              Target retail ({study.currency})
              <input
                value={applyPrice}
                onChange={(e) => setApplyPrice(e.target.value)}
                placeholder="e.g. 245"
                className="mt-0.5 block w-28 rounded border border-ink/15 px-2 py-1 text-sm"
              />
            </label>
            <button onClick={applyRetail} className="rounded bg-navy px-3 py-1.5 text-sm text-white">
              Set as target retail
            </button>
            <p className="w-full text-xs text-warmgrey sm:w-auto sm:flex-1">
              Writes the number into the style's cost sheet —{" "}
              <Link to="/admin/costing" className="text-navy underline">
                Costing & Margins
              </Link>{" "}
              shows what's left after making it.
            </p>
          </div>

          <button onClick={remove} className="text-xs text-red-600 hover:underline">
            Delete study
          </button>
        </div>
      )}
    </div>
  );
}

export function PricingPage() {
  const studies = useFetch<Study[]>("/api/admin/research/pricing");
  const styles = useFetch<StyleLite[]>("/api/admin/styles");
  const cfg = useFetch<{ enabled: boolean }>("/api/admin/research/config");
  const [showNew, setShowNew] = useState(false);
  const [draft, setDraft] = useState({ name: "", market: "", currency: "USD" });

  const sorted = useMemo(() => studies.data ?? [], [studies.data]);

  const add = async () => {
    if (!draft.name.trim()) return;
    await api.post("/api/admin/research/pricing", { ...draft, category: draft.name });
    setDraft({ name: "", market: "", currency: "USD" });
    setShowNew(false);
    studies.reload();
  };

  return (
    <div>
      <PageHeader
        title="Price studies"
        eyebrow="R&D"
        description="What should it retail for? Collect real comparables, set the band, decide — and push the target retail straight into the style's cost sheet."
        help="rd-pricing"
        actions={
          <button onClick={() => setShowNew(true)} className="rounded bg-navy px-3 py-1.5 text-sm text-white">
            New study
          </button>
        }
      />
      <ResearchNav />

      {showNew && (
        <div className="mb-3 grid grid-cols-2 gap-2 rounded-xl border border-ink/10 bg-white p-3 md:grid-cols-4">
          <input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="Category, e.g. Linen shirt *" className="rounded border border-ink/15 px-2 py-1.5 text-sm" />
          <input value={draft.market} onChange={(e) => setDraft((d) => ({ ...d, market: e.target.value }))} placeholder="Market, e.g. US direct-to-consumer" className="rounded border border-ink/15 px-2 py-1.5 text-sm" />
          <input value={draft.currency} onChange={(e) => setDraft((d) => ({ ...d, currency: e.target.value.toUpperCase() }))} placeholder="USD" maxLength={3} className="rounded border border-ink/15 px-2 py-1.5 text-sm" />
          <div className="flex gap-2">
            <button onClick={add} className="rounded bg-navy px-3 py-1.5 text-sm text-white">Create</button>
            <button onClick={() => setShowNew(false)} className="rounded border border-ink/15 px-3 py-1.5 text-sm">Cancel</button>
          </div>
        </div>
      )}

      {sorted.length ? (
        <div className="space-y-2">
          {sorted.map((st) => (
            <StudyCard key={st.id} study={st} styles={styles.data ?? []} enabled={cfg.data?.enabled} onChanged={studies.reload} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No price studies yet"
          hint="Start one per category you're pricing — 'Linen shirt, US DTC'. Research fills the comparables and bands; you make the call and push it into costing."
        />
      )}
    </div>
  );
}
