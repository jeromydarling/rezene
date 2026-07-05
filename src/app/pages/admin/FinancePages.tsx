import { useState, type FormEvent, type ReactNode } from "react";
import { useFetch } from "../../lib/useFetch";
import { api, ApiRequestError } from "../../lib/api";
import { formatMoney, titleCase } from "../../lib/format";
import {
  EmptyState,
  ErrorNote,
  LoadingTable,
  PageHeader,
  SlideOver,
} from "../../components/admin/ui";
import type { AdminCostSheet, AdminDutyRule } from "../../../shared/types";

// ---------------- Costing & Margins ----------------

const COST_FIELDS: { key: string; label: string }[] = [
  { key: "fabricCostCents", label: "Fabric" },
  { key: "trimCostCents", label: "Trims" },
  { key: "cutSewMakeCents", label: "Cut / sew / make" },
  { key: "sampleAllocationCents", label: "Sample allocation" },
  { key: "packagingCents", label: "Packaging" },
  { key: "freightCents", label: "Freight" },
  { key: "insuranceCents", label: "Insurance" },
  { key: "dutyCents", label: "Duty" },
  { key: "paymentProcessingCents", label: "Payment processing" },
  { key: "returnsReserveCents", label: "Returns reserve" },
  { key: "actualRetailCents", label: "Actual retail" },
  { key: "targetRetailCents", label: "Target retail" },
];

function CostSheetEditForm({
  sheet,
  onSaved,
}: {
  sheet: AdminCostSheet;
  onSaved: () => void;
}) {
  const initial: Record<string, string> = {};
  for (const f of COST_FIELDS) {
    const v = (sheet as unknown as Record<string, number | null>)[f.key];
    initial[f.key] = v != null ? (v / 100).toFixed(2) : "";
  }
  const [values, setValues] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const payload: Record<string, number | null> = {};
      for (const f of COST_FIELDS) {
        const raw = values[f.key].trim();
        payload[f.key] = raw === "" ? null : Math.round(parseFloat(raw) * 100);
      }
      // Cost components are required numbers server-side; nulls only for retail.
      for (const f of COST_FIELDS.slice(0, 10)) {
        if (payload[f.key] == null) payload[f.key] = 0;
      }
      await api.patch(`/api/admin/costing/cost-sheets/${sheet.id}`, payload);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-warmgrey">
        All values in {sheet.currency}. Margins and scenario math recompute on save.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {COST_FIELDS.map((f) => (
          <div key={f.key}>
            <label className="label">{f.label}</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="input"
              value={values[f.key]}
              onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
            />
          </div>
        ))}
      </div>
      {error && <p className="field-error">{error}</p>}
      <button type="button" disabled={busy} className="btn btn-primary w-full" onClick={() => void save()}>
        {busy ? "Saving…" : "Save cost sheet"}
      </button>
    </div>
  );
}

type CostSort = "style" | "cost" | "retail" | "margin";

export function CostingPage() {
  const { data, loading, error, reload } = useFetch<AdminCostSheet[]>(
    "/api/admin/costing/cost-sheets",
  );
  const [editing, setEditing] = useState<AdminCostSheet | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [sort, setSort] = useState<CostSort>("style");
  const [sortDir, setSortDir] = useState<1 | -1>(1);

  function sortBy(key: CostSort) {
    if (sort === key) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setSort(key);
      setSortDir(key === "style" ? 1 : -1);
    }
  }

  const sorted = [...(data ?? [])].sort((a, b) => {
    const val = (s: AdminCostSheet): string | number => {
      switch (sort) {
        case "style":
          return s.styleName.toLowerCase();
        case "cost":
          return s.totalCostCents;
        case "retail":
          return s.actualRetailCents ?? s.targetRetailCents ?? -1;
        case "margin":
          return s.grossMarginPct ?? -999;
      }
    };
    const av = val(a);
    const bv = val(b);
    return (av < bv ? -1 : av > bv ? 1 : 0) * sortDir;
  });

  // Keep the slide-over in sync with fresh data after saves.
  const editingFresh = editing ? (data?.find((s) => s.id === editing.id) ?? editing) : null;

  const arrow = (key: CostSort) => (sort === key ? (sortDir === 1 ? " ↑" : " ↓") : "");

  return (
    <div>
      <PageHeader
        eyebrow="Finance"
        title="Costing & Margins"
        description="What every style really costs to land, market by market — and the margin left at your price. Duty figures are estimates, not customs advice."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setCreateOpen(true)}>
            New cost sheet
          </button>
        }
      />
      {error && <ErrorNote message={error} />}
      {loading && <LoadingTable />}
      {data && data.length === 0 && (
        <EmptyState
          title="No cost sheets yet"
          hint="Start with your hero style — it sets the margin bar for the rest of the line."
        />
      )}
      {data && data.length > 0 && (
        <div className="admin-card overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>
                  <button type="button" onClick={() => sortBy("style")} className="hover:text-ink">
                    Style{arrow("style")}
                  </button>
                </th>
                <th>Sheet</th>
                <th className="text-right">
                  <button type="button" onClick={() => sortBy("cost")} className="hover:text-ink">
                    Total cost{arrow("cost")}
                  </button>
                </th>
                <th className="text-right">
                  <button type="button" onClick={() => sortBy("retail")} className="hover:text-ink">
                    Retail{arrow("retail")}
                  </button>
                </th>
                <th className="text-right">
                  <button type="button" onClick={() => sortBy("margin")} className="hover:text-ink">
                    Margin{arrow("margin")}
                  </button>
                </th>
                <th>Destinations</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((sheet) => (
                <tr key={sheet.id}>
                  <td className="font-medium">{sheet.styleName}</td>
                  <td className="text-xs text-warmgrey">{sheet.name}</td>
                  <td className="text-right">{formatMoney(sheet.totalCostCents, sheet.currency)}</td>
                  <td className="text-right">
                    {sheet.actualRetailCents
                      ? formatMoney(sheet.actualRetailCents, sheet.currency)
                      : sheet.targetRetailCents
                        ? `${formatMoney(sheet.targetRetailCents, sheet.currency)} (target)`
                        : "—"}
                  </td>
                  <td className="text-right">
                    {sheet.grossMarginPct != null ? (
                      <span
                        className={
                          sheet.grossMarginPct >= 60
                            ? "font-medium text-palm"
                            : sheet.grossMarginPct >= 50
                              ? "text-saffron"
                              : "font-medium text-clay"
                        }
                      >
                        {sheet.grossMarginPct}%
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="text-xs text-warmgrey">
                    {sheet.scenarios.length > 0
                      ? sheet.scenarios.map((sc) => sc.destinationRegion).join(", ")
                      : "—"}
                  </td>
                  <td className="text-right">
                    <button
                      type="button"
                      className="link-quiet text-xs"
                      onClick={() => setEditing(sheet)}
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-[0.68rem] italic text-warmgrey">
        Estimates only. Not legal or customs advice — final classification requires trade/legal
        review.
      </p>
      <SlideOver
        open={Boolean(editingFresh)}
        title={editingFresh ? `${editingFresh.styleName} — ${editingFresh.name}` : ""}
        onClose={() => setEditing(null)}
      >
        {editingFresh && <CostSheetDetail sheet={editingFresh} onChanged={reload} />}
      </SlideOver>
      <SlideOver open={createOpen} title="New cost sheet" onClose={() => setCreateOpen(false)}>
        <CostSheetCreateForm
          onCreated={() => {
            setCreateOpen(false);
            reload();
          }}
        />
      </SlideOver>
    </div>
  );
}

function CostSheetCreateForm({ onCreated }: { onCreated: () => void }) {
  const { data: styles } = useFetch<{ id: string; name: string; styleCode: string }[]>(
    "/api/admin/styles",
  );
  const [styleId, setStyleId] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/admin/costing/cost-sheets", {
        styleId,
        name: name || undefined,
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
        <label className="label">Style *</label>
        <select
          required
          className="input"
          value={styleId}
          onChange={(e) => setStyleId(e.target.value)}
        >
          <option value="">Select…</option>
          {styles?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-warmgrey">
          A style can carry several sheets — one per season or production run.
        </p>
      </div>
      <div>
        <label className="label">Sheet name</label>
        <input
          className="input"
          placeholder="SS26 production costing"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      {error && <p className="field-error">{error}</p>}
      <button type="submit" disabled={busy || !styleId} className="btn btn-primary w-full">
        {busy ? "Creating…" : "Create cost sheet"}
      </button>
    </form>
  );
}

function CostSheetDetail({ sheet, onChanged }: { sheet: AdminCostSheet; onChanged: () => void }) {
  return (
    <div className="space-y-6">
      <CostSheetEditForm sheet={sheet} onSaved={onChanged} />
      <ScenarioManager sheet={sheet} onChanged={onChanged} />
    </div>
  );
}

function ScenarioManager({ sheet, onChanged }: { sheet: AdminCostSheet; onChanged: () => void }) {
  const [form, setForm] = useState({
    name: "",
    destinationRegion: "EU",
    dutyRatePct: "",
    freight: "",
    insurance: "",
    retail: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function addScenario(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/admin/costing/cost-sheets/${sheet.id}/scenarios`, {
        name: form.name || `${form.destinationRegion} DTC`,
        destinationRegion: form.destinationRegion,
        dutyRatePct: parseFloat(form.dutyRatePct || "0"),
        freightCents: form.freight ? Math.round(parseFloat(form.freight) * 100) : undefined,
        insuranceCents: form.insurance ? Math.round(parseFloat(form.insurance) * 100) : undefined,
        retailPriceCents: form.retail ? Math.round(parseFloat(form.retail) * 100) : undefined,
      });
      setForm({ ...form, name: "", dutyRatePct: "", freight: "", insurance: "", retail: "" });
      onChanged();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Could not add destination");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    await api.delete(`/api/admin/costing/scenarios/${id}`);
    onChanged();
  }

  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-warmgrey">
        Destinations — landed cost by market
      </h3>
      {sheet.scenarios.length > 0 && (
        <table className="admin-table mb-3">
          <thead>
            <tr>
              <th>Destination</th>
              <th className="text-right">Duty</th>
              <th className="text-right">Landed</th>
              <th className="text-right">Margin</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sheet.scenarios.map((sc) => (
              <tr key={sc.id}>
                <td>
                  {sc.name}
                  <span className="ml-1.5 text-xs text-warmgrey">{sc.destinationRegion}</span>
                </td>
                <td className="text-right">{(sc.dutyRateUsed * 100).toFixed(1)}%</td>
                <td className="text-right">
                  {sc.landedCostCents ? formatMoney(sc.landedCostCents, sheet.currency) : "—"}
                </td>
                <td className="text-right">
                  {sc.grossMarginPct != null ? `${sc.grossMarginPct}%` : "—"}
                </td>
                <td className="text-right">
                  <button
                    type="button"
                    className="text-xs text-clay hover:underline"
                    onClick={() => void remove(sc.id)}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <form onSubmit={addScenario} className="space-y-3 rounded-md border border-ink/10 p-3">
        <p className="text-xs font-medium">Add a destination</p>
        <div className="grid grid-cols-2 gap-2">
          <input
            className="input"
            placeholder="Name (EU DTC)"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            required
            className="input"
            placeholder="Region (EU, US, UK…)"
            value={form.destinationRegion}
            onChange={(e) => setForm({ ...form, destinationRegion: e.target.value })}
          />
          <input
            required
            type="number"
            min="0"
            max="200"
            step="0.1"
            className="input"
            placeholder="Duty rate %"
            value={form.dutyRatePct}
            onChange={(e) => setForm({ ...form, dutyRatePct: e.target.value })}
          />
          <input
            type="number"
            min="0"
            step="0.01"
            className="input"
            placeholder="Freight / unit"
            value={form.freight}
            onChange={(e) => setForm({ ...form, freight: e.target.value })}
          />
          <input
            type="number"
            min="0"
            step="0.01"
            className="input"
            placeholder="Insurance / unit"
            value={form.insurance}
            onChange={(e) => setForm({ ...form, insurance: e.target.value })}
          />
          <input
            type="number"
            min="0"
            step="0.01"
            className="input"
            placeholder="Retail price there"
            value={form.retail}
            onChange={(e) => setForm({ ...form, retail: e.target.value })}
          />
        </div>
        <p className="text-xs text-warmgrey">
          Duty rates for your lanes live on the Duties page — Morocco → EU is 0% when preferential
          origin qualifies.
        </p>
        {error && <p className="field-error">{error}</p>}
        <button type="submit" disabled={busy} className="btn btn-secondary w-full">
          {busy ? "Adding…" : "Add destination"}
        </button>
      </form>
    </div>
  );
}

// ---------------- Duties & Landed Cost ----------------

interface DutyEstimate {
  ruleName: string;
  qualifiesCondition: string | null;
  dutyMinCents: number;
  dutyMaxCents: number;
  landedMinCents: number;
  landedMaxCents: number;
  disclaimer: string;
}

export function DutiesPage() {
  const { data, loading, error, reload } = useFetch<AdminDutyRule[]>("/api/admin/costing/duty-rules");
  const [est, setEst] = useState({ region: "US", base: "70", freight: "7" });
  const [estimates, setEstimates] = useState<DutyEstimate[] | null>(null);
  const [estBusy, setEstBusy] = useState(false);

  async function toggleRule(rule: AdminDutyRule) {
    await api.patch(`/api/admin/costing/duty-rules/${rule.id}`, { isActive: !rule.isActive });
    reload();
  }

  async function runEstimate() {
    setEstBusy(true);
    try {
      const res = await api.get<{ estimates: DutyEstimate[] }>(
        `/api/admin/costing/estimate?region=${est.region}&baseCents=${Math.round(parseFloat(est.base) * 100)}&freightCents=${Math.round(parseFloat(est.freight || "0") * 100)}`,
      );
      setEstimates(res.estimates);
    } finally {
      setEstBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Finance"
        title="Duties & Landed Cost"
        description="An editable rules engine, not a customs authority. Every figure is an estimate requiring trade/legal review."
      />
      {error && <ErrorNote message={error} />}
      {loading && <LoadingTable />}

      {data && (
        <div className="admin-card overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Rule</th>
                <th>Destination</th>
                <th>Condition</th>
                <th>Rate range</th>
                <th>Preferential</th>
                <th>Active</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.id}>
                  <td className="font-medium">{r.name}</td>
                  <td>{r.destinationRegion}</td>
                  <td className="max-w-md text-xs text-warmgrey">{r.qualifiesCondition ?? "—"}</td>
                  <td>
                    {(r.dutyRateMin * 100).toFixed(1)}%
                    {r.dutyRateMax !== r.dutyRateMin && ` – ${(r.dutyRateMax * 100).toFixed(1)}%`}
                  </td>
                  <td>{r.isPreferential ? "✓" : "—"}</td>
                  <td>
                    <button
                      type="button"
                      onClick={() => void toggleRule(r)}
                      className={`badge cursor-pointer ${r.isActive ? "badge-success" : "badge-neutral"}`}
                    >
                      {r.isActive ? "active" : "off"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="admin-card mt-6 p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-warmgrey">
          Quick estimator
        </h2>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label">Destination</label>
            <select
              className="input !w-28"
              value={est.region}
              onChange={(e) => setEst({ ...est, region: e.target.value })}
            >
              {["EU", "US", "UK", "CA"].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Base cost (USD)</label>
            <input
              type="number"
              className="input !w-32"
              value={est.base}
              onChange={(e) => setEst({ ...est, base: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Freight (USD)</label>
            <input
              type="number"
              className="input !w-32"
              value={est.freight}
              onChange={(e) => setEst({ ...est, freight: e.target.value })}
            />
          </div>
          <button
            type="button"
            className="btn btn-primary"
            disabled={estBusy}
            onClick={() => void runEstimate()}
          >
            Estimate
          </button>
        </div>
        {estimates && (
          <div className="mt-4 space-y-2">
            {estimates.length === 0 && (
              <p className="text-sm text-warmgrey">No active rules for this destination.</p>
            )}
            {estimates.map((e, i) => (
              <div key={i} className="rounded border border-ink/10 p-3 text-sm">
                <p className="font-medium">{e.ruleName}</p>
                {e.qualifiesCondition && (
                  <p className="text-xs text-warmgrey">{e.qualifiesCondition}</p>
                )}
                <p className="mt-1">
                  Duty {formatMoney(e.dutyMinCents)}
                  {e.dutyMaxCents !== e.dutyMinCents && ` – ${formatMoney(e.dutyMaxCents)}`} ·
                  Landed {formatMoney(e.landedMinCents)}
                  {e.landedMaxCents !== e.landedMinCents && ` – ${formatMoney(e.landedMaxCents)}`}
                </p>
                <p className="mt-1 text-[0.68rem] italic text-warmgrey">{e.disclaimer}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------- Analytics ----------------

interface AnalyticsPeriodTotals {
  revenueCents: number;
  orders: number;
  unitsSold: number;
  visitors: number;
  pageViews: number;
  signups: number;
}

interface AnalyticsSummary {
  days: number;
  totals: { current: AnalyticsPeriodTotals; previous: AnalyticsPeriodTotals };
  revenueByDay: { day: string; revenue_cents: number; orders: number }[];
  visitorsByDay: { day: string; visitors: number }[];
  funnel: {
    visitors: number;
    viewedProduct: number;
    addedToCart: number;
    startedCheckout: number;
    purchased: number;
  };
  bestSellers: { name: string; slug: string | null; units: number; revenue_cents: number }[];
  sizeCurve: { size: string; units: number }[];
  colorways: { colorway: string; units: number }[];
  mostViewed: { name: string; slug: string; views: number }[];
  referrers: { source: string; count: number }[];
  countries: { country: string; visitors: number }[];
  orderCountries: { country: string; orders: number; revenue_cents: number }[];
  topPages: { path: string; count: number }[];
  customers: { buyers: number; returning: number };
  leadsByKind: { kind: string; count: number }[];
  abandonedCheckouts: number;
  campaigns: { id: string; product_name: string; goal_units: number; status: string; ordered_units: number }[];
}

function deltaLabel(current: number, previous: number): { text: string; tone: "up" | "down" | "flat" } {
  if (previous === 0) return current > 0 ? { text: "new", tone: "up" } : { text: "—", tone: "flat" };
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return { text: "±0%", tone: "flat" };
  return { text: `${pct > 0 ? "+" : ""}${pct}%`, tone: pct > 0 ? "up" : "down" };
}

function KpiTile({
  label,
  value,
  current,
  previous,
  hint,
}: {
  label: string;
  value: string;
  current: number;
  previous: number;
  hint?: string;
}) {
  const delta = deltaLabel(current, previous);
  return (
    <div className="admin-card p-4">
      <p className="text-[0.65rem] uppercase tracking-wider text-warmgrey">{label}</p>
      <p className="mt-1 font-display text-2xl font-light">{value}</p>
      <p className="mt-1 text-xs">
        <span
          className={
            delta.tone === "up"
              ? "font-medium text-palm"
              : delta.tone === "down"
                ? "font-medium text-clay"
                : "text-warmgrey"
          }
        >
          {delta.text}
        </span>
        <span className="text-warmgrey"> {hint ?? "vs previous period"}</span>
      </p>
    </div>
  );
}

function BarRow({ label, value, max, detail }: { label: string; value: number; max: number; detail?: string }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-28 shrink-0 truncate" title={label}>
        {label}
      </span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-ink/8">
        <div
          className="h-2.5 rounded-full bg-navy/70"
          style={{ width: `${Math.max(2, (value / Math.max(1, max)) * 100)}%` }}
        />
      </div>
      <span className="w-20 shrink-0 text-right text-xs text-warmgrey">{detail ?? value}</span>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="admin-card p-5">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-warmgrey">{title}</h2>
      {children}
    </div>
  );
}

const NoDataYet = ({ note }: { note: string }) => (
  <p className="py-6 text-center text-sm text-warmgrey">{note}</p>
);

export function AnalyticsPage() {
  const [days, setDays] = useState(30);
  const { data, loading, error } = useFetch<AnalyticsSummary>(`/api/admin/analytics?days=${days}`);

  const revMax = Math.max(1, ...(data?.revenueByDay.map((d) => d.revenue_cents) ?? []));
  const visMax = Math.max(1, ...(data?.visitorsByDay.map((d) => d.visitors) ?? []));
  const cur = data?.totals.current;
  const prev = data?.totals.previous;
  const aov = cur && cur.orders > 0 ? cur.revenueCents / cur.orders : 0;
  const prevAov = prev && prev.orders > 0 ? prev.revenueCents / prev.orders : 0;
  const conversion = cur && cur.visitors > 0 ? (cur.orders / cur.visitors) * 100 : 0;
  const prevConversion = prev && prev.visitors > 0 ? (prev.orders / prev.visitors) * 100 : 0;

  const funnelSteps = data
    ? [
        { label: "Visited the shop", value: data.funnel.visitors },
        { label: "Viewed a product", value: data.funnel.viewedProduct },
        { label: "Added to cart", value: data.funnel.addedToCart },
        { label: "Started checkout", value: data.funnel.startedCheckout },
        { label: "Purchased", value: data.funnel.purchased },
      ]
    : [];
  const funnelMax = Math.max(1, ...funnelSteps.map((s) => s.value));

  return (
    <div>
      <PageHeader
        eyebrow="Insights"
        title="Analytics"
        description="How the shop is doing — sales, traffic, what's selling, and where your buyers come from."
        actions={
          <div className="flex gap-1">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={`rounded px-2.5 py-1 text-xs ${
                  days === d ? "bg-navy text-chalk" : "border border-ink/15 text-warmgrey hover:text-ink"
                }`}
              >
                {d} days
              </button>
            ))}
          </div>
        }
      />
      {error && <ErrorNote message={error} />}
      {loading && <LoadingTable />}
      {data && cur && prev && (
        <div className="space-y-4">
          {/* KPI tiles */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiTile
              label="Revenue"
              value={formatMoney(cur.revenueCents)}
              current={cur.revenueCents}
              previous={prev.revenueCents}
            />
            <KpiTile label="Orders" value={String(cur.orders)} current={cur.orders} previous={prev.orders} />
            <KpiTile
              label="Average order"
              value={aov ? formatMoney(Math.round(aov)) : "—"}
              current={Math.round(aov)}
              previous={Math.round(prevAov)}
            />
            <KpiTile
              label="Units sold"
              value={String(cur.unitsSold)}
              current={cur.unitsSold}
              previous={prev.unitsSold}
            />
            <KpiTile
              label="Visitors"
              value={String(cur.visitors)}
              current={cur.visitors}
              previous={prev.visitors}
            />
            <KpiTile
              label="Conversion"
              value={cur.visitors ? `${conversion.toFixed(1)}%` : "—"}
              current={Math.round(conversion * 10)}
              previous={Math.round(prevConversion * 10)}
              hint="of visitors buy"
            />
            <KpiTile
              label="Page views"
              value={String(cur.pageViews)}
              current={cur.pageViews}
              previous={prev.pageViews}
            />
            <KpiTile
              label="New signups"
              value={String(cur.signups)}
              current={cur.signups}
              previous={prev.signups}
            />
          </div>

          {/* Daily charts */}
          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title={`Revenue by day · last ${data.days} days`}>
              {data.revenueByDay.length === 0 ? (
                <NoDataYet note="Sales will chart here as orders come in." />
              ) : (
                <div className="flex h-32 items-end gap-1">
                  {data.revenueByDay.map((d) => (
                    <div
                      key={d.day}
                      className="flex-1 rounded-t bg-palm/60"
                      style={{ height: `${(d.revenue_cents / revMax) * 100}%` }}
                      title={`${d.day}: ${formatMoney(d.revenue_cents)} · ${d.orders} order${d.orders === 1 ? "" : "s"}`}
                    />
                  ))}
                </div>
              )}
            </SectionCard>
            <SectionCard title="Visitors by day">
              {data.visitorsByDay.length === 0 ? (
                <NoDataYet note="Traffic will chart here as people browse the shop." />
              ) : (
                <div className="flex h-32 items-end gap-1">
                  {data.visitorsByDay.map((d) => (
                    <div
                      key={d.day}
                      className="flex-1 rounded-t bg-indigo-faded"
                      style={{ height: `${(d.visitors / visMax) * 100}%` }}
                      title={`${d.day}: ${d.visitors} visitors`}
                    />
                  ))}
                </div>
              )}
            </SectionCard>
          </div>

          {/* Funnel + customers */}
          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="From browsing to buying">
              {data.funnel.visitors === 0 ? (
                <NoDataYet note="The funnel fills in once the shop has visitors." />
              ) : (
                <div className="space-y-2.5">
                  {funnelSteps.map((step, i) => {
                    const prevStep = i > 0 ? funnelSteps[i - 1].value : null;
                    const stepPct =
                      prevStep && prevStep > 0 && i > 0
                        ? ` · ${Math.round((step.value / prevStep) * 100)}% of previous`
                        : "";
                    return (
                      <BarRow
                        key={step.label}
                        label={step.label}
                        value={step.value}
                        max={funnelMax}
                        detail={`${step.value}${stepPct}`}
                      />
                    );
                  })}
                  {data.abandonedCheckouts > 0 && (
                    <p className="pt-1 text-xs text-warmgrey">
                      {data.abandonedCheckouts} checkout{data.abandonedCheckouts === 1 ? "" : "s"}{" "}
                      started but never completed — worth a follow-up email once you have their
                      address.
                    </p>
                  )}
                </div>
              )}
            </SectionCard>
            <SectionCard title="Customers">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="font-display text-3xl font-light">{data.customers.buyers}</p>
                  <p className="text-xs text-warmgrey">buyers all-time (active this period)</p>
                </div>
                <div>
                  <p className="font-display text-3xl font-light">
                    {data.customers.buyers > 0
                      ? `${Math.round((data.customers.returning / data.customers.buyers) * 100)}%`
                      : "—"}
                  </p>
                  <p className="text-xs text-warmgrey">have bought more than once</p>
                </div>
              </div>
              {data.leadsByKind.length > 0 && (
                <>
                  <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wider text-warmgrey">
                    Signups this period
                  </h3>
                  <ul className="space-y-1.5 text-sm">
                    {data.leadsByKind.map((l) => (
                      <li key={l.kind} className="flex justify-between">
                        <span>{titleCase(l.kind.replaceAll("_", " "))}</span>
                        <span className="text-warmgrey">{l.count}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </SectionCard>
          </div>

          {/* What's selling */}
          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="Best sellers">
              {data.bestSellers.length === 0 ? (
                <NoDataYet note="Your top products by revenue will rank here." />
              ) : (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th className="text-right">Units</th>
                      <th className="text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.bestSellers.map((p) => (
                      <tr key={p.name}>
                        <td>{p.name}</td>
                        <td className="text-right">{p.units}</td>
                        <td className="text-right">{formatMoney(p.revenue_cents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </SectionCard>
            <SectionCard title="Most viewed products">
              {data.mostViewed.length === 0 ? (
                <NoDataYet note="Product page views will rank here — compare against best sellers to spot pieces that draw looks but not orders." />
              ) : (
                <>
                  <div className="space-y-2">
                    {data.mostViewed.map((p) => (
                      <BarRow
                        key={p.slug}
                        label={p.name}
                        value={p.views}
                        max={data.mostViewed[0]?.views ?? 1}
                        detail={`${p.views} views`}
                      />
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-warmgrey">
                    A product with lots of views and few sales usually has a price, photo, or size
                    question to answer.
                  </p>
                </>
              )}
            </SectionCard>
          </div>

          {/* Demand shape — real data for the next production run */}
          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="Demand by size">
              {data.sizeCurve.length === 0 ? (
                <NoDataYet note="Once orders come in, this becomes your size curve for the next production run." />
              ) : (
                <>
                  <div className="space-y-2">
                    {data.sizeCurve.map((s) => (
                      <BarRow
                        key={s.size}
                        label={s.size}
                        value={s.units}
                        max={data.sizeCurve[0]?.units ?? 1}
                        detail={`${s.units} units`}
                      />
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-warmgrey">
                    Use this to weight sizes when you book the next run — it's your real size
                    curve, not a guess.
                  </p>
                </>
              )}
            </SectionCard>
            <SectionCard title="Demand by colorway">
              {data.colorways.length === 0 ? (
                <NoDataYet note="Colorway demand appears here with the first orders." />
              ) : (
                <div className="space-y-2">
                  {data.colorways.map((cw) => (
                    <BarRow
                      key={cw.colorway}
                      label={cw.colorway}
                      value={cw.units}
                      max={data.colorways[0]?.units ?? 1}
                      detail={`${cw.units} units`}
                    />
                  ))}
                </div>
              )}
            </SectionCard>
          </div>

          {/* Where buyers come from */}
          <div className="grid gap-4 lg:grid-cols-3">
            <SectionCard title="Traffic sources">
              {data.referrers.length === 0 ? (
                <NoDataYet note="Referring sites appear once visitors arrive via links." />
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {data.referrers.map((r) => (
                    <li key={r.source} className="flex justify-between">
                      <span className="truncate">{r.source}</span>
                      <span className="text-warmgrey">{r.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
            <SectionCard title="Visitors by country">
              {data.countries.length === 0 ? (
                <NoDataYet note="Visitor countries appear as traffic arrives." />
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {data.countries.map((cty) => (
                    <li key={cty.country} className="flex justify-between">
                      <span>{cty.country}</span>
                      <span className="text-warmgrey">{cty.visitors}</span>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
            <SectionCard title="Sales by country">
              {data.orderCountries.length === 0 ? (
                <NoDataYet note="Order destinations appear with the first sales." />
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {data.orderCountries.map((cty) => (
                    <li key={cty.country} className="flex justify-between">
                      <span>
                        {cty.country} <span className="text-xs text-warmgrey">({cty.orders})</span>
                      </span>
                      <span className="text-warmgrey">{formatMoney(cty.revenue_cents)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </div>

          {/* Pages + campaigns */}
          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="Most visited pages">
              {data.topPages.length === 0 ? (
                <NoDataYet note="Page traffic appears as visitors browse." />
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {data.topPages.map((p) => (
                    <li key={p.path} className="flex justify-between">
                      <span className="truncate">{p.path}</span>
                      <span className="text-warmgrey">{p.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
            {data.campaigns.length > 0 && (
              <SectionCard title="Pre-order campaigns">
                <div className="space-y-3">
                  {data.campaigns.map((cp) => {
                    const pct = Math.min(100, Math.round((cp.ordered_units / cp.goal_units) * 100));
                    return (
                      <div key={cp.id}>
                        <div className="mb-1 flex justify-between text-sm">
                          <span>{cp.product_name}</span>
                          <span className="text-xs text-warmgrey">
                            {cp.ordered_units}/{cp.goal_units}
                            {cp.status === "funded" ? " · funded ✓" : ""}
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-ink/8">
                          <div
                            className={`h-2 rounded-full ${cp.status === "funded" ? "bg-palm" : "bg-saffron"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </SectionCard>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------- Settings ----------------

interface SettingsResponse {
  settings: { key: string; value: string; description: string | null }[];
  integrations: { provider: string; status: string; note: string | null }[];
  secretStatus: { stripe: boolean; stripeWebhook: boolean; anthropic: boolean };
}

function ChangePasswordCard() {
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (form.next !== form.confirm) {
      setError("New passwords don't match");
      return;
    }
    setState("busy");
    setError(null);
    try {
      await api.post("/api/auth/change-password", {
        currentPassword: form.current,
        newPassword: form.next,
      });
      setState("done");
      setForm({ current: "", next: "", confirm: "" });
    } catch (err) {
      setState("idle");
      setError(err instanceof ApiRequestError ? err.message : "Password change failed");
    }
  }

  return (
    <div className="admin-card p-5">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-warmgrey">
        Account — change password
      </h2>
      <div className="space-y-3">
        <div>
          <label className="label">Current password</label>
          <input
            type="password"
            autoComplete="current-password"
            className="input"
            value={form.current}
            onChange={(e) => setForm({ ...form, current: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">New password (min 8)</label>
            <input
              type="password"
              autoComplete="new-password"
              className="input"
              value={form.next}
              onChange={(e) => setForm({ ...form, next: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Confirm new password</label>
            <input
              type="password"
              autoComplete="new-password"
              className="input"
              value={form.confirm}
              onChange={(e) => setForm({ ...form, confirm: e.target.value })}
            />
          </div>
        </div>
        {error && <p className="field-error">{error}</p>}
        {state === "done" && (
          <p className="text-sm text-palm">
            Password changed. All other sessions have been signed out.
          </p>
        )}
        <button
          type="button"
          className="btn btn-primary"
          disabled={state === "busy" || !form.current || !form.next || !form.confirm}
          onClick={() => void submit()}
        >
          {state === "busy" ? "Changing…" : "Change password"}
        </button>
      </div>
    </div>
  );
}

export function SettingsPage() {
  const { data, loading, error, reload } = useFetch<SettingsResponse>("/api/admin/settings");
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function save() {
    setSaveError(null);
    try {
      await api.patch("/api/admin/settings", draft);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      setDraft({});
      reload();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="System"
        title="Settings"
        description="Your brand's name, tagline, and identity — change them here and they update everywhere, from the storefront to your tech packs."
      />
      {error && <ErrorNote message={error} />}
      {loading && <LoadingTable rows={4} />}
      {data && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="admin-card p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-warmgrey">
              Brand
            </h2>
            <div className="space-y-4">
              {data.settings.map((s) => (
                <div key={s.key}>
                  <label className="label">{s.key.replaceAll("_", " ")}</label>
                  <input
                    className="input"
                    defaultValue={s.value}
                    onChange={(e) => setDraft({ ...draft, [s.key]: e.target.value })}
                  />
                  {s.description && <p className="mt-1 text-xs text-warmgrey">{s.description}</p>}
                </div>
              ))}
              {saveError && <p className="field-error">{saveError}</p>}
              <button
                type="button"
                className="btn btn-primary"
                disabled={Object.keys(draft).length === 0}
                onClick={() => void save()}
              >
                {saved ? "Saved ✓" : "Save changes"}
              </button>
            </div>
          </div>
          <div className="admin-card p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-warmgrey">
              Integrations
            </h2>
            <ul className="space-y-3 text-sm">
              <li className="flex items-center justify-between">
                <span>Payments (Stripe)</span>
                <span className={`badge ${data.secretStatus.stripe ? "badge-success" : "badge-neutral"}`}>
                  {data.secretStatus.stripe ? "connected" : "not connected"}
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span>Payment updates (Stripe)</span>
                <span
                  className={`badge ${data.secretStatus.stripeWebhook ? "badge-success" : "badge-neutral"}`}
                >
                  {data.secretStatus.stripeWebhook ? "connected" : "not connected"}
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span>AI assistance</span>
                <span
                  className={`badge ${data.secretStatus.anthropic ? "badge-success" : "badge-neutral"}`}
                >
                  {data.secretStatus.anthropic ? "connected" : "not connected"}
                </span>
              </li>
            </ul>
            <p className="mt-4 text-xs text-warmgrey">
              Connection keys are stored securely outside the app — they never appear in the
              database or the browser.
            </p>
          </div>
          <ChangePasswordCard />
        </div>
      )}
    </div>
  );
}
