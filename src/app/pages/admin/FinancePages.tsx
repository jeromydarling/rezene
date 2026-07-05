import { useState } from "react";
import { useFetch } from "../../lib/useFetch";
import { api, ApiRequestError } from "../../lib/api";
import { formatMoney } from "../../lib/format";
import {
  EmptyState,
  ErrorNote,
  LoadingTable,
  PageHeader,
  SlideOver,
  StatCard,
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

export function CostingPage() {
  const { data, loading, error, reload } = useFetch<AdminCostSheet[]>(
    "/api/admin/costing/cost-sheets",
  );
  const [editing, setEditing] = useState<AdminCostSheet | null>(null);
  return (
    <div>
      <PageHeader
        eyebrow="Finance"
        title="Costing & Margins"
        description="Landed cost per style, scenario by destination. All duty figures are estimates — never legal or customs advice."
      />
      {error && <ErrorNote message={error} />}
      {loading && <LoadingTable />}
      {data && data.length === 0 && (
        <EmptyState title="No cost sheets" hint="Cost the hero style first — it sets the margin bar." />
      )}
      <div className="space-y-6">
        {data?.map((sheet) => (
          <div key={sheet.id} className="admin-card p-5">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-light">{sheet.styleName}</h2>
                <p className="text-xs text-warmgrey">{sheet.name}</p>
                <button
                  type="button"
                  className="link-quiet mt-1 text-xs"
                  onClick={() => setEditing(sheet)}
                >
                  Edit costs
                </button>
              </div>
              <div className="flex gap-3">
                <StatCard
                  label="Total cost"
                  value={formatMoney(sheet.totalCostCents, sheet.currency)}
                />
                <StatCard
                  label="Retail"
                  value={
                    sheet.actualRetailCents
                      ? formatMoney(sheet.actualRetailCents, sheet.currency)
                      : "—"
                  }
                />
                <StatCard
                  label="Gross margin"
                  value={sheet.grossMarginPct != null ? `${sheet.grossMarginPct}%` : "—"}
                  tone={
                    sheet.grossMarginPct == null
                      ? "default"
                      : sheet.grossMarginPct >= 60
                        ? "good"
                        : sheet.grossMarginPct >= 50
                          ? "warn"
                          : "danger"
                  }
                />
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-warmgrey">
                  Cost breakdown
                </h3>
                <table className="admin-table">
                  <tbody>
                    {(
                      [
                        ["Fabric", sheet.fabricCostCents],
                        ["Trims", sheet.trimCostCents],
                        ["Cut / sew / make", sheet.cutSewMakeCents],
                        ["Sample allocation", sheet.sampleAllocationCents],
                        ["Packaging", sheet.packagingCents],
                        ["Freight", sheet.freightCents],
                        ["Insurance", sheet.insuranceCents],
                        ["Duty", sheet.dutyCents],
                        ["Payment processing", sheet.paymentProcessingCents],
                        ["Returns reserve", sheet.returnsReserveCents],
                      ] as const
                    )
                      .filter(([, v]) => v > 0)
                      .map(([label, value]) => (
                        <tr key={label}>
                          <td>{label}</td>
                          <td className="text-right">{formatMoney(value, sheet.currency)}</td>
                        </tr>
                      ))}
                    <tr className="font-semibold">
                      <td>Total</td>
                      <td className="text-right">
                        {formatMoney(sheet.totalCostCents, sheet.currency)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-warmgrey">
                  Landed cost scenarios
                </h3>
                {sheet.scenarios.length === 0 ? (
                  <p className="text-sm text-warmgrey">No scenarios modeled.</p>
                ) : (
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Scenario</th>
                        <th>Duty</th>
                        <th>Landed</th>
                        <th>Margin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sheet.scenarios.map((sc) => (
                        <tr key={sc.id}>
                          <td>{sc.name}</td>
                          <td>{(sc.dutyRateUsed * 100).toFixed(1)}%</td>
                          <td>
                            {sc.landedCostCents
                              ? formatMoney(sc.landedCostCents, sheet.currency)
                              : "—"}
                          </td>
                          <td>{sc.grossMarginPct != null ? `${sc.grossMarginPct}%` : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <p className="mt-2 text-[0.68rem] italic text-warmgrey">
                  Estimates only. Not legal or customs advice — final classification requires
                  trade/legal review.
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
      <SlideOver
        open={Boolean(editing)}
        title={editing ? `Edit costs — ${editing.styleName}` : ""}
        onClose={() => setEditing(null)}
      >
        {editing && (
          <CostSheetEditForm
            sheet={editing}
            onSaved={() => {
              setEditing(null);
              reload();
            }}
          />
        )}
      </SlideOver>
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

interface AnalyticsSummary {
  days: number;
  byEvent: { event: string; count: number }[];
  byDay: { day: string; count: number }[];
  topPaths: { path: string; count: number }[];
}

export function AnalyticsPage() {
  const { data, loading, error } = useFetch<AnalyticsSummary>("/api/admin/settings/analytics");
  const max = Math.max(1, ...(data?.byDay.map((d) => d.count) ?? [1]));
  return (
    <div>
      <PageHeader
        eyebrow="Finance"
        title="Analytics"
        description="D1-backed event foundation — page views, product views, checkouts, signups. Export-ready for PostHog/GA4 later."
      />
      {error && <ErrorNote message={error} />}
      {loading && <LoadingTable />}
      {data && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="admin-card p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-warmgrey">
              Events · last {data.days} days
            </h2>
            {data.byEvent.length === 0 ? (
              <p className="py-8 text-center text-sm text-warmgrey">
                No events yet — browse the public site to generate some.
              </p>
            ) : (
              <ul className="space-y-2">
                {data.byEvent.map((e) => (
                  <li key={e.event} className="flex items-center justify-between text-sm">
                    <span>{e.event}</span>
                    <span className="badge badge-navy">{e.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="admin-card p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-warmgrey">
              Daily volume
            </h2>
            {data.byDay.length === 0 ? (
              <p className="py-8 text-center text-sm text-warmgrey">Nothing to chart yet.</p>
            ) : (
              <div className="flex h-32 items-end gap-1">
                {data.byDay.map((d) => (
                  <div
                    key={d.day}
                    className="flex-1 rounded-t bg-indigo-faded"
                    style={{ height: `${(d.count / max) * 100}%` }}
                    title={`${d.day}: ${d.count}`}
                  />
                ))}
              </div>
            )}
            {data.topPaths.length > 0 && (
              <>
                <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wider text-warmgrey">
                  Top pages
                </h3>
                <ul className="space-y-1 text-sm">
                  {data.topPaths.slice(0, 8).map((p) => (
                    <li key={p.path} className="flex justify-between">
                      <span className="truncate">{p.path}</span>
                      <span className="text-warmgrey">{p.count}</span>
                    </li>
                  ))}
                </ul>
              </>
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
        description="Brand identity is data, not code — the name ships as a placeholder and changes here."
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
                <span>Stripe secret key</span>
                <span className={`badge ${data.secretStatus.stripe ? "badge-success" : "badge-neutral"}`}>
                  {data.secretStatus.stripe ? "configured" : "not configured"}
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span>Stripe webhook secret</span>
                <span
                  className={`badge ${data.secretStatus.stripeWebhook ? "badge-success" : "badge-neutral"}`}
                >
                  {data.secretStatus.stripeWebhook ? "configured" : "not configured"}
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span>Anthropic API key</span>
                <span
                  className={`badge ${data.secretStatus.anthropic ? "badge-success" : "badge-neutral"}`}
                >
                  {data.secretStatus.anthropic ? "configured" : "not configured"}
                </span>
              </li>
            </ul>
            <p className="mt-4 text-xs text-warmgrey">
              Secrets are set with <code className="rounded bg-cream px-1">wrangler secret put</code>{" "}
              (or .dev.vars locally) — never stored in the database or exposed to the browser.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
