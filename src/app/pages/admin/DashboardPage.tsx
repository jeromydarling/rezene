import { Link } from "react-router";
import { useFetch } from "../../lib/useFetch";
import { formatDate, formatMoney } from "../../lib/format";
import { ErrorNote, StatCard } from "../../components/admin/ui";
import type { DashboardSummary } from "../../../shared/types";

// An issue-style date line for the cover, e.g. "Monday, 7 July 2026".
function issueDate(): string {
  try {
    return new Date().toLocaleDateString(undefined, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

export function DashboardPage() {
  const { data, loading, error } = useFetch<DashboardSummary>("/api/admin/dashboard");

  return (
    <div>
      {/* Cover masthead */}
      <div className="masthead">
        <p className="masthead-kicker">Overview · {issueDate()}</p>
        <h1 className="masthead-title">The Dashboard</h1>
        <p className="masthead-lede">
          The state of your brand — sales, production, and what needs your eye today.
        </p>
      </div>

      {error && <ErrorNote message={error} />}
      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton h-24" />
          ))}
        </div>
      )}
      {data && (
        <>
          {/* Lead story: revenue as a cover figure */}
          <div className="mb-10 grid items-end gap-8 border-b border-ink/10 pb-8 lg:grid-cols-[1.3fr_1fr]">
            <div>
              <p className="text-[0.66rem] font-medium uppercase tracking-editorial text-warmgrey">
                Revenue · paid to date
              </p>
              <p className="mt-3 font-display text-[3.6rem] font-light leading-[0.95] tabular-nums text-ink sm:text-[4.5rem]">
                {formatMoney(data.revenueCents, data.currency)}
              </p>
              <p className="mt-3 text-sm text-warmgrey">
                {data.paidOrderCount} paid of {data.orderCount} orders
              </p>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-[0.66rem] font-medium uppercase tracking-editorial text-warmgrey">Orders</p>
                <p className="mt-2 font-display text-[2.4rem] font-light leading-none tabular-nums text-ink">
                  {data.orderCount}
                </p>
              </div>
              <div>
                <p className="text-[0.66rem] font-medium uppercase tracking-editorial text-warmgrey">
                  Open samples
                </p>
                <p
                  className={`mt-2 font-display text-[2.4rem] font-light leading-none tabular-nums ${
                    data.openSampleCount > 0 ? "text-terracotta-deep" : "text-ink"
                  }`}
                >
                  {data.openSampleCount}
                </p>
              </div>
            </div>
          </div>

          {/* Needs attention */}
          <p className="mb-4 text-[0.68rem] font-medium uppercase tracking-editorial text-warmgrey">
            Needs attention
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Late production tasks"
              value={data.lateTaskCount}
              tone={data.lateTaskCount > 0 ? "danger" : "good"}
            />
            <StatCard
              label="Inventory alerts"
              value={data.lowStockCount}
              tone={data.lowStockCount > 0 ? "warn" : "good"}
              hint="At or below low-stock threshold"
            />
            <StatCard
              label="Styles missing tech packs"
              value={data.stylesMissingTechPack}
              tone={data.stylesMissingTechPack > 0 ? "warn" : "good"}
            />
            <StatCard
              label="Margin-risk styles"
              value={data.stylesWithMarginRisk}
              tone={data.stylesWithMarginRisk > 0 ? "danger" : "good"}
              hint="Below DTC margin floor"
            />
            <StatCard
              label="Pending factory responses"
              value={data.pendingFactoryResponses}
              tone={data.pendingFactoryResponses > 0 ? "warn" : "default"}
            />
          </div>

          <div className="mt-10 grid gap-8 lg:grid-cols-2">
            <div>
              <div className="mb-3 flex items-baseline justify-between border-b border-ink/10 pb-2">
                <h2 className="section-head">Production pipeline</h2>
                <Link to="/admin/production" className="link-quiet text-xs">
                  Open calendar
                </Link>
              </div>
              {data.productionStageCounts.length === 0 ? (
                <p className="py-6 text-sm text-warmgrey">No open production tasks.</p>
              ) : (
                <ul>
                  {data.productionStageCounts.map((s) => (
                    <li
                      key={s.stage}
                      className="flex items-center justify-between border-b border-ink/6 py-2.5 text-sm"
                    >
                      <span className="text-ink/80">{s.stage}</span>
                      <span className="font-display text-lg font-light tabular-nums text-ink">{s.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <div className="mb-3 flex items-baseline justify-between border-b border-ink/10 pb-2">
                <h2 className="section-head">Upcoming milestones</h2>
              </div>
              {data.upcomingMilestones.length === 0 ? (
                <p className="py-6 text-sm text-warmgrey">Nothing scheduled.</p>
              ) : (
                <ul>
                  {data.upcomingMilestones.map((m, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between gap-3 border-b border-ink/6 py-2.5 text-sm"
                    >
                      <span className="text-ink/80">{m.title}</span>
                      <span className="whitespace-nowrap text-xs uppercase tracking-wider text-warmgrey">
                        {formatDate(m.startsOn)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
