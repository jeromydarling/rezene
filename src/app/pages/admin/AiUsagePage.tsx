import { useState } from "react";
import { useFetch } from "../../lib/useFetch";
import { PageHeader, ErrorNote, LoadingTable, EmptyState } from "../../components/admin/ui";

/**
 * AI Usage (primary shop only): the fleet's model/API spend in one read. Every
 * low-level AI call across the platform — Anthropic, Workers AI chat, Perplexity,
 * Flux images — best-effort logs a row to the platform `ai_usage` ledger; this
 * page rolls it up so we can see, programmatically, how much AI is going through
 * each model and API and roughly what it costs. Cost is ESTIMATED from a public
 * price table (services/ai-usage.ts); token/unit counts are exact.
 */

interface UsageRow {
  provider?: string;
  model?: string;
  operation?: string;
  shopId?: string | null;
  shopName?: string;
  day?: string;
  calls: number;
  tokensIn?: number;
  tokensOut?: number;
  units?: number;
  costCents: number;
}
interface UsageReport {
  days: number;
  totals: { calls: number; tokensIn: number; tokensOut: number; units: number; costCents: number };
  byProvider: UsageRow[];
  byModel: UsageRow[];
  byOperation: UsageRow[];
  byShop: UsageRow[];
  byDay: UsageRow[];
}

const WINDOWS = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
  { days: 365, label: "1 year" },
];

/** Estimated cost cents → "$1.23" (or "$0.0042" for sub-cent totals). */
function fmtCost(cents: number): string {
  const usd = cents / 100;
  if (usd === 0) return "$0";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtNum(n: number | undefined): string {
  return (n ?? 0).toLocaleString();
}

/** A labelled horizontal bar chart over a metric (cost, calls, or tokens). */
function BarChart({
  title,
  rows,
  label,
  metric,
  format,
}: {
  title: string;
  rows: UsageRow[];
  label: (r: UsageRow) => string;
  metric: (r: UsageRow) => number;
  format: (n: number) => string;
}) {
  const max = Math.max(1, ...rows.map(metric));
  return (
    <div className="admin-card mb-6 p-5">
      <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-warmgrey">{title}</p>
      {rows.length === 0 ? (
        <p className="text-xs text-warmgrey">No usage in this window.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r, i) => {
            const value = metric(r);
            const width = Math.max(2, (value / max) * 100);
            return (
              <div key={i} className="flex items-center gap-3">
                <span className="w-44 shrink-0 truncate text-right text-xs text-ink/70" title={label(r)}>
                  {label(r)}
                </span>
                <div className="relative h-6 flex-1 overflow-hidden rounded bg-ink/5">
                  <div className="h-full rounded bg-navy/70" style={{ width: `${width}%` }} />
                  <span className="absolute inset-y-0 left-2 flex items-center text-[0.7rem] font-medium tabular-nums text-ink/80">
                    {format(value)}
                  </span>
                </div>
                <span className="w-24 shrink-0 text-right text-[0.7rem] tabular-nums text-warmgrey">
                  {r.calls.toLocaleString()} call{r.calls === 1 ? "" : "s"}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="admin-card p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-warmgrey">{label}</p>
      <p className="mt-1 font-display text-2xl font-light tabular-nums text-ink">{value}</p>
      {sub && <p className="text-xs text-warmgrey">{sub}</p>}
    </div>
  );
}

export function AiUsagePage() {
  const [days, setDays] = useState(30);
  const { data, loading, error } = useFetch<UsageReport>(`/api/admin/platform/ai-usage?days=${days}`);

  return (
    <div>
      <PageHeader
        eyebrow="Platform"
        title="AI Usage"
        description="How AI is being used across the whole platform — by model, API, operation, and shop. Token and unit counts are exact; cost is an estimate from public price tables."
        actions={
          <div className="flex gap-1 rounded-lg bg-ink/5 p-1">
            {WINDOWS.map((w) => (
              <button
                key={w.days}
                type="button"
                onClick={() => setDays(w.days)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                  days === w.days ? "bg-chalk text-ink shadow-sm" : "text-warmgrey hover:text-ink"
                }`}
              >
                {w.label}
              </button>
            ))}
          </div>
        }
      />

      {error && <ErrorNote message={error} />}
      {loading && <LoadingTable />}

      {data && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatTile label="AI calls" value={fmtNum(data.totals.calls)} sub={`last ${data.days} days`} />
            <StatTile
              label="Tokens"
              value={fmtNum(data.totals.tokensIn + data.totals.tokensOut)}
              sub={`${fmtNum(data.totals.tokensIn)} in · ${fmtNum(data.totals.tokensOut)} out`}
            />
            <StatTile label="Images / units" value={fmtNum(data.totals.units)} sub="Flux + external models" />
            <StatTile label="Est. cost" value={fmtCost(data.totals.costCents)} sub="approximate, USD" />
          </div>

          {data.totals.calls === 0 ? (
            <EmptyState
              title="No AI usage logged yet"
              hint="Rows land here as shops use AI features — design generation, marketing copy, sourcing research, the Companion. Cost is estimated from public price tables."
            />
          ) : (
            <>
              <BarChart
                title="Estimated cost by API / provider"
                rows={data.byProvider}
                label={(r) => r.provider ?? "—"}
                metric={(r) => r.costCents}
                format={fmtCost}
              />
              <BarChart
                title="Estimated cost by model"
                rows={data.byModel}
                label={(r) => r.model ?? "—"}
                metric={(r) => r.costCents}
                format={fmtCost}
              />
              <BarChart
                title="Calls by operation"
                rows={data.byOperation}
                label={(r) => r.operation ?? "(unlabeled)"}
                metric={(r) => r.calls}
                format={(n) => n.toLocaleString()}
              />
              <BarChart
                title="Estimated cost by shop"
                rows={data.byShop}
                label={(r) => r.shopName ?? r.shopId ?? "(platform)"}
                metric={(r) => r.costCents}
                format={fmtCost}
              />

              {/* Daily trend as a compact bar row. */}
              <div className="admin-card mb-6 p-5">
                <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-warmgrey">
                  Daily calls
                </p>
                {data.byDay.length === 0 ? (
                  <p className="text-xs text-warmgrey">No usage in this window.</p>
                ) : (
                  <div className="flex h-32 items-end gap-1">
                    {(() => {
                      const maxDay = Math.max(1, ...data.byDay.map((d) => d.calls));
                      return data.byDay.map((d) => (
                        <div
                          key={d.day}
                          className="group relative flex-1"
                          title={`${d.day}: ${d.calls} calls · ${fmtCost(d.costCents)}`}
                        >
                          <div
                            className="w-full rounded-t bg-navy/60 transition group-hover:bg-navy"
                            style={{ height: `${Math.max(2, (d.calls / maxDay) * 100)}%` }}
                          />
                        </div>
                      ));
                    })()}
                  </div>
                )}
                <p className="mt-2 text-[0.7rem] text-warmgrey">
                  Hover a bar for the day's call count and estimated cost.
                </p>
              </div>

              {/* Full model breakdown table. */}
              <div className="admin-card overflow-x-auto">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Provider</th>
                      <th>Model</th>
                      <th className="text-right">Calls</th>
                      <th className="text-right">Tokens in</th>
                      <th className="text-right">Tokens out</th>
                      <th className="text-right">Units</th>
                      <th className="text-right">Est. cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byModel.map((r, i) => (
                      <tr key={i}>
                        <td className="text-xs">{r.provider}</td>
                        <td className="font-mono text-xs">{r.model}</td>
                        <td className="text-right tabular-nums">{fmtNum(r.calls)}</td>
                        <td className="text-right tabular-nums text-warmgrey">{fmtNum(r.tokensIn)}</td>
                        <td className="text-right tabular-nums text-warmgrey">{fmtNum(r.tokensOut)}</td>
                        <td className="text-right tabular-nums text-warmgrey">{fmtNum(r.units)}</td>
                        <td className="text-right tabular-nums">{fmtCost(r.costCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <p className="mt-4 text-xs text-warmgrey">
            Cost is estimated from public price tables in <code>services/ai-usage.ts</code> — Workers
            AI (Llama, Flux) is billed per-neuron and shows as $0 here. Edit the price table as rates
            change. Token and unit counts are exact.
          </p>
        </>
      )}
    </div>
  );
}
