import { useState } from "react";
import { useFetch } from "../../lib/useFetch";
import { api, ApiRequestError } from "../../lib/api";
import { formatMoney, formatDate } from "../../lib/format";
import { PageHeader, ErrorNote, LoadingTable, EmptyState } from "../../components/admin/ui";

/**
 * Fleet Revenue (primary shop only): how much every shop is making, in one
 * place. Orders live in each shop's own Durable Object; a daily cron rolls each
 * shop's day up into the platform table, and this page reads it back. Use
 * "Refresh now" to roll up today + yesterday on demand instead of waiting.
 */

interface ShopRow {
  shopId: string;
  shopName: string;
  status: string | null;
  gmvCents: number;
  orders: number;
  refundsCents: number;
  newCustomers: number;
  currency: string;
  aiCostCents: number;
}
interface DayRow {
  day: string;
  gmvCents: number;
  orders: number;
  refundsCents: number;
}
interface RevenueReport {
  days: number;
  totals: { gmvCents: number; orders: number; refundsCents: number; newCustomers: number; aovCents: number; aiCostCents: number };
  currencies: string[];
  byShop: ShopRow[];
  byDay: DayRow[];
  lastRollupAt: string | null;
}

const WINDOWS = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
  { days: 365, label: "1 year" },
];

/** Cents → money. When the fleet spans currencies we can't safely symbol it, so fall back to a plain number. */
function money(cents: number, currencies: string[]): string {
  if (currencies.length <= 1) return formatMoney(cents, currencies[0] || "USD");
  return `${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

export function FleetRevenuePage() {
  const [days, setDays] = useState(30);
  const { data, loading, error, reload } = useFetch<RevenueReport>(
    `/api/admin/platform/revenue?days=${days}`,
  );
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  async function refreshNow() {
    setRefreshing(true);
    setRefreshError(null);
    try {
      await api.post("/api/admin/platform/revenue/rollup");
      reload();
    } catch (err) {
      setRefreshError(err instanceof ApiRequestError ? err.message : "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }

  const currencies = data?.currencies ?? [];
  const mixed = currencies.length > 1;
  const maxShopGmv = Math.max(1, ...(data?.byShop ?? []).map((s) => s.gmvCents));
  const maxDayGmv = Math.max(1, ...(data?.byDay ?? []).map((d) => d.gmvCents));

  return (
    <div>
      <PageHeader
        eyebrow="Platform"
        title="Fleet Revenue"
        description="What every shop is making — gross merchandise value, orders, refunds, and new customers across the whole platform. Rolled up nightly from each shop; use Refresh now for the latest."
        actions={
          <div className="flex items-center gap-2">
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
            <button type="button" className="btn btn-secondary !py-1 text-xs" disabled={refreshing} onClick={() => void refreshNow()}>
              {refreshing ? "Refreshing…" : "Refresh now"}
            </button>
          </div>
        }
      />

      {error && <ErrorNote message={error} />}
      {refreshError && <ErrorNote message={refreshError} />}
      {loading && <LoadingTable />}

      {data && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatTile label="GMV" value={money(data.totals.gmvCents, currencies)} sub={`last ${data.days} days`} />
            <StatTile label="Paid orders" value={data.totals.orders.toLocaleString()} sub={`AOV ${money(data.totals.aovCents, currencies)}`} />
            <StatTile label="Refunds" value={money(data.totals.refundsCents, currencies)} sub="in the window" />
            <StatTile label="New customers" value={data.totals.newCustomers.toLocaleString()} sub="across all shops" />
          </div>

          {mixed && (
            <p className="mb-4 text-xs text-warmgrey">
              Shops in this window bill in multiple currencies ({currencies.join(", ")}). Totals sum
              the raw amounts without conversion — read them as approximate.
            </p>
          )}

          {data.totals.orders === 0 && data.totals.gmvCents === 0 ? (
            <EmptyState
              title="No revenue in this window"
              hint="Rows fill in as shops take paid orders. The nightly rollup writes each shop's day; Refresh now rolls up today and yesterday immediately."
            />
          ) : (
            <>
              {/* GMV by shop. */}
              <div className="admin-card mb-6 p-5">
                <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-warmgrey">
                  GMV by shop
                </p>
                <div className="space-y-2">
                  {data.byShop.map((s) => {
                    const width = Math.max(2, (s.gmvCents / maxShopGmv) * 100);
                    return (
                      <div key={s.shopId} className="flex items-center gap-3">
                        <span className="w-44 shrink-0 truncate text-right text-xs text-ink/70" title={s.shopName}>
                          {s.shopName}
                        </span>
                        <div className="relative h-6 flex-1 overflow-hidden rounded bg-ink/5">
                          <div className="h-full rounded bg-palm/70" style={{ width: `${width}%` }} />
                          <span className="absolute inset-y-0 left-2 flex items-center text-[0.7rem] font-medium tabular-nums text-ink/80">
                            {money(s.gmvCents, currencies)}
                          </span>
                        </div>
                        <span className="w-24 shrink-0 text-right text-[0.7rem] tabular-nums text-warmgrey">
                          {s.orders.toLocaleString()} order{s.orders === 1 ? "" : "s"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Daily GMV trend. */}
              <div className="admin-card mb-6 p-5">
                <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-warmgrey">
                  Daily GMV
                </p>
                <div className="flex h-32 items-end gap-1">
                  {data.byDay.map((d) => (
                    <div
                      key={d.day}
                      className="group relative flex-1"
                      title={`${d.day}: ${money(d.gmvCents, currencies)} · ${d.orders} orders`}
                    >
                      <div
                        className="w-full rounded-t bg-palm/60 transition group-hover:bg-palm"
                        style={{ height: `${Math.max(2, (d.gmvCents / maxDayGmv) * 100)}%` }}
                      />
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[0.7rem] text-warmgrey">Hover a bar for that day's GMV and order count.</p>
              </div>

              {/* Full per-shop table. */}
              <div className="admin-card overflow-x-auto">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Shop</th>
                      <th className="text-right">GMV</th>
                      <th className="text-right">Orders</th>
                      <th className="text-right">AOV</th>
                      <th className="text-right">Refunds</th>
                      <th className="text-right">AI cost</th>
                      <th className="text-right">GMV − AI</th>
                      <th className="text-right">New customers</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byShop.map((s) => (
                      <tr key={s.shopId}>
                        <td className="font-medium">{s.shopName}</td>
                        <td className="text-right tabular-nums">{money(s.gmvCents, currencies)}</td>
                        <td className="text-right tabular-nums">{s.orders.toLocaleString()}</td>
                        <td className="text-right tabular-nums text-warmgrey">
                          {money(s.orders ? Math.round(s.gmvCents / s.orders) : 0, currencies)}
                        </td>
                        <td className="text-right tabular-nums text-warmgrey">{money(s.refundsCents, currencies)}</td>
                        <td className="text-right tabular-nums text-warmgrey">{money(s.aiCostCents, currencies)}</td>
                        <td className="text-right tabular-nums">{money(s.gmvCents - s.aiCostCents, currencies)}</td>
                        <td className="text-right tabular-nums text-warmgrey">{s.newCustomers.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <p className="mt-4 text-xs text-warmgrey">
            {data.lastRollupAt
              ? `Last rolled up ${formatDate(data.lastRollupAt)}. `
              : "Not yet rolled up. "}
            The nightly cron aggregates each shop's orders, refunds, and new customers into the
            platform. GMV counts paid orders only. “AI cost” is the estimated model/API spend
            attributed to each shop over the window ({money(data.totals.aiCostCents, currencies)}{" "}
            fleet-wide); “GMV − AI” is revenue net of that cost to serve — it is not full margin
            (it excludes COGS, payment fees, and shipping).
          </p>
        </>
      )}
    </div>
  );
}
