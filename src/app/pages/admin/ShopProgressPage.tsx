import { useFetch } from "../../lib/useFetch";
import { formatDate } from "../../lib/format";
import { PageHeader, ErrorNote, LoadingTable, EmptyState } from "../../components/admin/ui";

/**
 * Shop Progress (primary shop only): the activation funnel turned into names.
 * The funnel says where the fleet leaks; this says which shops are stuck, at
 * what step, and for how long — so a drop-off becomes a to-do list. Reads
 * entirely from the platform (shops + activation_events).
 */

interface Step {
  id: string;
  label: string;
}
interface ShopRow {
  shopId: string;
  shopName: string;
  slug: string;
  status: string;
  plan: string | null;
  createdAt: string;
  signupDays: number;
  stalledDays: number;
  done: string[];
  open: boolean;
  nextStep: { id: string; label: string } | null;
  state: "open" | "new" | "in_progress" | "stalled";
}
interface ProgressReport {
  steps: Step[];
  shops: ShopRow[];
  summary: { total: number; open: number; stalled: number; new: number; inProgress: number };
}

const STATE_LABEL: Record<ShopRow["state"], string> = {
  open: "Open",
  new: "New",
  in_progress: "In progress",
  stalled: "Stalled",
};
const STATE_CLASS: Record<ShopRow["state"], string> = {
  open: "bg-palm/15 text-palm",
  new: "bg-navy/10 text-navy",
  in_progress: "bg-ink/10 text-ink/70",
  stalled: "bg-terracotta/15 text-terracotta",
};

function StatTile({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="admin-card p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-warmgrey">{label}</p>
      <p className={`mt-1 font-display text-2xl font-light tabular-nums ${tone ?? "text-ink"}`}>{value}</p>
    </div>
  );
}

export function ShopProgressPage() {
  const { data, loading, error } = useFetch<ProgressReport>("/api/admin/platform/shop-progress");

  return (
    <div>
      <PageHeader
        eyebrow="Platform"
        title="Shop Progress"
        description="Which shops are getting set up, which are stuck, and exactly what step is blocking them. Milestones are derived from real shop state — a shop can't fake being open for business."
      />

      {error && <ErrorNote message={error} />}
      {loading && <LoadingTable />}

      {data && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
            <StatTile label="Shops" value={data.summary.total} />
            <StatTile label="Open for business" value={data.summary.open} tone="text-palm" />
            <StatTile label="In progress" value={data.summary.inProgress} />
            <StatTile label="New" value={data.summary.new} />
            <StatTile label="Stalled" value={data.summary.stalled} tone="text-terracotta" />
          </div>

          {data.shops.length === 0 ? (
            <EmptyState title="No shops yet" hint="Shops appear here as they sign up and start setting up." />
          ) : (
            <div className="admin-card overflow-x-auto">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Shop</th>
                    <th>State</th>
                    <th>Next step</th>
                    {data.steps.map((s) => (
                      <th key={s.id} className="text-center text-[0.62rem]" title={s.label}>
                        {s.label}
                      </th>
                    ))}
                    <th className="text-right">Signed up</th>
                    <th className="text-right">Last activity</th>
                  </tr>
                </thead>
                <tbody>
                  {data.shops.map((shop) => {
                    const doneSet = new Set(shop.done);
                    return (
                      <tr key={shop.shopId}>
                        <td className="font-medium">
                          {shop.shopName}
                          <p className="font-mono text-xs font-normal text-warmgrey">/{shop.slug}</p>
                        </td>
                        <td>
                          <span className={`inline-block rounded px-2 py-0.5 text-[0.65rem] font-medium ${STATE_CLASS[shop.state]}`}>
                            {STATE_LABEL[shop.state]}
                          </span>
                        </td>
                        <td className="text-xs">
                          {shop.open ? (
                            <span className="text-palm">— done —</span>
                          ) : shop.nextStep ? (
                            <span className="text-ink/80">{shop.nextStep.label}</span>
                          ) : (
                            <span className="text-warmgrey">—</span>
                          )}
                        </td>
                        {data.steps.map((s) => (
                          <td key={s.id} className="text-center">
                            {doneSet.has(s.id) ? (
                              <span className="text-palm" aria-label={`${s.label} done`}>
                                ●
                              </span>
                            ) : (
                              <span className="text-ink/15" aria-label={`${s.label} not done`}>
                                ○
                              </span>
                            )}
                          </td>
                        ))}
                        <td className="text-right text-xs text-warmgrey">
                          {formatDate(shop.createdAt)}
                          <span className="block">{shop.signupDays}d ago</span>
                        </td>
                        <td className="text-right text-xs text-warmgrey">
                          {shop.open ? (
                            "—"
                          ) : (
                            <span className={shop.state === "stalled" ? "text-terracotta" : ""}>
                              {shop.stalledDays}d ago
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <p className="mt-4 text-xs text-warmgrey">
            ● done · ○ not yet. “Stalled” means no new milestone for 14+ days and not yet open for
            business — those are the shops worth a nudge. “Next step” is the first milestone they
            haven't crossed.
          </p>
        </>
      )}
    </div>
  );
}
