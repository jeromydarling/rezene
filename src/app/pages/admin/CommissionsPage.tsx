import { Link } from "react-router";
import { useFetch } from "../../lib/useFetch";
import { formatDate, formatMoney } from "../../lib/format";
import { EmptyState, ErrorNote, LoadingTable, PageHeader, StatusBadge } from "../../components/admin/ui";

/**
 * The commission pipeline — every piece of client work in the studio,
 * grouped by stage. Cards link to the client's page, where the work
 * actually happens (fittings, stage moves, photos).
 */

interface CommissionSummary {
  id: string;
  clientId: string;
  clientName: string;
  title: string;
  kind: string;
  stage: string;
  stageLabel: string;
  dueAt: string | null;
  priceCents: number | null;
  updatedAt: string;
}

const PIPELINE_ORDER = ["consult", "design", "fabric", "cutting", "fitting", "delivery"] as const;
const STAGE_TITLES: Record<string, string> = {
  consult: "Consult",
  design: "Design approved",
  fabric: "Fabric sourced",
  cutting: "Cutting",
  fitting: "Fittings",
  delivery: "Delivery",
};

export function CommissionsPage() {
  const { data, loading, error } = useFetch<CommissionSummary[]>("/api/admin/commissions");
  const active = (data ?? []).filter((c) => !["done", "cancelled"].includes(c.stage));
  const finished = (data ?? []).filter((c) => ["done", "cancelled"].includes(c.stage));
  return (
    <div>
      <PageHeader
        eyebrow="Clients"
        title="Commissions"
        help="commissions"
        description="Every piece of client work, from first consult to delivery. Open a card to run fittings and move it along on the client's page."
      />
      {error && <ErrorNote message={error} />}
      {loading && <LoadingTable />}
      {data && data.length === 0 && (
        <EmptyState
          title="No commissions yet"
          hint="Open a client in the Client Book and start their first commission — a made-to-measure piece or an alteration."
        />
      )}
      {active.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {PIPELINE_ORDER.filter((st) => active.some((c) => c.stage === st)).map((st) => (
            <section key={st} className="admin-card p-4">
              <h2 className="mb-2 flex items-center justify-between font-medium">
                {STAGE_TITLES[st]}
                <span className="text-xs text-warmgrey">{active.filter((c) => c.stage === st).length}</span>
              </h2>
              <ul className="space-y-2">
                {active
                  .filter((c) => c.stage === st)
                  .map((c) => (
                    <li key={c.id} className="rounded border border-black/5 p-3 text-sm">
                      <Link to={`/admin/clients/${c.clientId}`} className="font-medium hover:underline">
                        {c.title}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-warmgrey">
                        <span>{c.clientName}</span>
                        {c.kind === "alteration" && <StatusBadge status="alteration" />}
                        {c.dueAt && <span>due {formatDate(c.dueAt)}</span>}
                        {c.priceCents != null && <span>{formatMoney(c.priceCents)}</span>}
                      </div>
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      {finished.length > 0 && (
        <section className="admin-card mt-4 p-4">
          <h2 className="mb-2 font-medium">Finished</h2>
          <ul className="space-y-1 text-sm">
            {finished.slice(0, 20).map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2">
                <Link to={`/admin/clients/${c.clientId}`} className="hover:underline">
                  {c.title} <span className="text-xs text-warmgrey">— {c.clientName}</span>
                </Link>
                <span className="flex items-center gap-2 text-xs text-warmgrey">
                  <StatusBadge status={c.stage} />
                  {formatDate(c.updatedAt)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
