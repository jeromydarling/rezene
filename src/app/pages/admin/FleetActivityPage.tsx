import { useFetch } from "../../lib/useFetch";
import { PageHeader, ErrorNote, LoadingTable, EmptyState } from "../../components/admin/ui";

/**
 * Fleet Activity (primary shop only): a live pulse of the business-meaningful
 * events happening across every shop — sales, publishes, deposits, commission
 * moves, new clients. Merged on demand from each shop's own activity spine, so
 * HQ can see at a glance that the fleet is alive and doing things.
 */

interface ActivityItem {
  shopId: string;
  shopName: string;
  kind: string;
  title: string;
  entityType: string | null;
  entityId: string | null;
  createdAt: string;
}
interface ActivityReport {
  items: ActivityItem[];
  shopsScanned: number;
}

/** Friendly label + accent per event kind. */
const KIND: Record<string, { label: string; dot: string }> = {
  "order.paid": { label: "Sale", dot: "bg-palm" },
  "deposit.paid": { label: "Deposit", dot: "bg-palm" },
  "product.published": { label: "Published", dot: "bg-navy" },
  "commission.stage_changed": { label: "Commission", dot: "bg-navy" },
  "client.created": { label: "New client", dot: "bg-navy" },
  "review.created": { label: "Review", dot: "bg-ink/40" },
  "sample.approved": { label: "Sample", dot: "bg-ink/40" },
  "po.status.confirmed": { label: "PO confirmed", dot: "bg-ink/40" },
  "po.status.received": { label: "PO received", dot: "bg-ink/40" },
  "inventory.sold_out": { label: "Sold out", dot: "bg-terracotta" },
  "inventory.restocked": { label: "Restocked", dot: "bg-ink/40" },
  "research.maker_promoted": { label: "Maker added", dot: "bg-ink/40" },
  "research.trend_adopted": { label: "Trend", dot: "bg-ink/40" },
};

/** Coarse relative time from a UTC 'YYYY-MM-DD HH:MM:SS' stamp. */
function ago(iso: string): string {
  const t = new Date(iso.replace(" ", "T") + "Z").getTime();
  if (!Number.isFinite(t)) return "";
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function FleetActivityPage() {
  const { data, loading, error, reload } = useFetch<ActivityReport>("/api/admin/platform/activity?limit=120");

  return (
    <div>
      <PageHeader
        eyebrow="Platform"
        title="Fleet Activity"
        description="A live pulse of what's happening across every shop — sales, publishes, deposits, commissions, new clients. Merged on demand from each shop's own activity feed."
        actions={
          <button type="button" className="btn btn-secondary !py-1 text-xs" onClick={() => reload()}>
            Refresh
          </button>
        }
      />

      {error && <ErrorNote message={error} />}
      {loading && <LoadingTable />}

      {data && (
        <>
          {data.items.length === 0 ? (
            <EmptyState
              title="Quiet across the fleet"
              hint="Notable events (sales, publishes, deposits, new clients) will appear here as shops do things."
            />
          ) : (
            <div className="admin-card divide-y divide-ink/5">
              {data.items.map((it, i) => {
                const meta = KIND[it.kind] ?? { label: it.kind, dot: "bg-ink/30" };
                return (
                  <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${meta.dot}`} aria-hidden />
                    <span className="w-28 shrink-0 text-xs font-medium uppercase tracking-wider text-warmgrey">
                      {meta.label}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-ink" title={it.title}>
                      {it.title}
                    </span>
                    <span className="w-40 shrink-0 truncate text-right text-xs text-ink/60" title={it.shopName}>
                      {it.shopName}
                    </span>
                    <span className="w-20 shrink-0 text-right text-xs tabular-nums text-warmgrey">
                      {ago(it.createdAt)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <p className="mt-4 text-xs text-warmgrey">
            Newest first, across {data.shopsScanned} active shop{data.shopsScanned === 1 ? "" : "s"}.
            Only business-meaningful events are shown. This reads each shop's feed live on load — hit
            Refresh for the latest.
          </p>
        </>
      )}
    </div>
  );
}
