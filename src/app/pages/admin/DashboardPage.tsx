import { Link } from "react-router";
import { useFetch } from "../../lib/useFetch";
import { formatDate, formatMoney } from "../../lib/format";
import { ErrorNote, PageHeader, StatCard } from "../../components/admin/ui";
import type { DashboardSummary } from "../../../shared/types";

export function DashboardPage() {
  const { data, loading, error } = useFetch<DashboardSummary>("/api/admin/dashboard");

  return (
    <div>
      <PageHeader
        eyebrow="Overview"
        title="Dashboard"
        description="The state of your brand — sales, production, and what needs attention today."
      />
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Revenue (paid)"
              value={formatMoney(data.revenueCents, data.currency)}
              hint={`${data.paidOrderCount} paid of ${data.orderCount} orders`}
            />
            <StatCard label="Orders" value={data.orderCount} />
            <StatCard
              label="Open samples"
              value={data.openSampleCount}
              tone={data.openSampleCount > 0 ? "warn" : "default"}
            />
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

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="admin-card p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-warmgrey">
                  Production pipeline
                </h2>
                <Link to="/admin/production" className="link-quiet text-xs">
                  Open calendar
                </Link>
              </div>
              {data.productionStageCounts.length === 0 ? (
                <p className="py-6 text-center text-sm text-warmgrey">
                  No open production tasks.
                </p>
              ) : (
                <ul className="space-y-2">
                  {data.productionStageCounts.map((s) => (
                    <li key={s.stage} className="flex items-center justify-between text-sm">
                      <span className="text-ink/80">{s.stage}</span>
                      <span className="badge badge-navy">{s.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="admin-card p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-warmgrey">
                  Upcoming milestones
                </h2>
              </div>
              {data.upcomingMilestones.length === 0 ? (
                <p className="py-6 text-center text-sm text-warmgrey">Nothing scheduled.</p>
              ) : (
                <ul className="space-y-2.5">
                  {data.upcomingMilestones.map((m, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-ink/80">{m.title}</span>
                      <span className="whitespace-nowrap text-xs text-warmgrey">
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
