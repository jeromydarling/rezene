import { useState } from "react";
import { useFetch } from "../../lib/useFetch";
import { api, ApiRequestError } from "../../lib/api";
import { formatDate } from "../../lib/format";
import { PageHeader, ErrorNote, LoadingTable, EmptyState } from "../../components/admin/ui";

/**
 * Errors (primary shop only): what's breaking across the fleet, for whom, and
 * how often. The worker logs every 500 here (deduped by signature); Sentry has
 * the full stack trace. This is the at-a-glance triage view — resolve an
 * incident when it's handled; a recurrence re-opens it automatically.
 */

interface Incident {
  id: number;
  shopId: string | null;
  method: string;
  path: string;
  status: number;
  message: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
  resolvedAt: string | null;
}
interface ErrorsReport {
  days: number;
  errors: Incident[];
  summary: { openIncidents: number; openEvents: number; totalIncidents: number };
}

const WINDOWS = [
  { days: 1, label: "24 hours" },
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
];

function StatTile({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="admin-card p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-warmgrey">{label}</p>
      <p className={`mt-1 font-display text-2xl font-light tabular-nums ${tone ?? "text-ink"}`}>{value}</p>
    </div>
  );
}

export function PlatformErrorsPage() {
  const [days, setDays] = useState(7);
  const { data, loading, error, reload } = useFetch<ErrorsReport>(
    `/api/admin/platform/errors?days=${days}`,
  );
  const [busyId, setBusyId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function resolve(id: number) {
    setBusyId(id);
    setActionError(null);
    try {
      await api.post(`/api/admin/platform/errors/${id}/resolve`);
      reload();
    } catch (err) {
      setActionError(err instanceof ApiRequestError ? err.message : "Could not resolve");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Platform"
        title="Errors"
        description="Every server error across the fleet, deduped so a recurring fault is one row with a count. Sentry holds the full stack trace; this is the at-a-glance triage view."
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
      {actionError && <ErrorNote message={actionError} />}
      {loading && <LoadingTable />}

      {data && (
        <>
          <div className="mb-6 grid grid-cols-3 gap-3">
            <StatTile
              label="Open incidents"
              value={data.summary.openIncidents}
              tone={data.summary.openIncidents ? "text-terracotta" : "text-palm"}
            />
            <StatTile label="Open error events" value={data.summary.openEvents} />
            <StatTile label="Total (incl. resolved)" value={data.summary.totalIncidents} />
          </div>

          {data.errors.length === 0 ? (
            <EmptyState
              title="No errors logged"
              hint="Nothing has thrown a 500 in this window. Incidents land here automatically when they do."
            />
          ) : (
            <div className="admin-card overflow-x-auto">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Incident</th>
                    <th>Shop</th>
                    <th className="text-right">Count</th>
                    <th className="text-right">Last seen</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.errors.map((e) => (
                    <tr key={e.id} className={e.resolvedAt ? "opacity-55" : ""}>
                      <td>
                        <p className="font-mono text-xs">
                          <span className="font-semibold">{e.method}</span> {e.path}
                        </p>
                        <p className="mt-0.5 max-w-lg truncate text-xs text-warmgrey" title={e.message}>
                          {e.message}
                        </p>
                      </td>
                      <td className="font-mono text-xs text-warmgrey">{e.shopId ?? "—"}</td>
                      <td className="text-right tabular-nums font-medium">{e.count.toLocaleString()}</td>
                      <td className="text-right text-xs text-warmgrey">{formatDate(e.lastSeen)}</td>
                      <td className="text-right">
                        {e.resolvedAt ? (
                          <span className="text-[0.65rem] uppercase tracking-wider text-palm">Resolved</span>
                        ) : (
                          <button
                            type="button"
                            className="link-quiet text-xs"
                            disabled={busyId === e.id}
                            onClick={() => void resolve(e.id)}
                          >
                            {busyId === e.id ? "…" : "Resolve"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="mt-4 text-xs text-warmgrey">
            Incidents dedupe by method + route + error class, so a repeating fault shows as one row
            with a rising count. Resolving one hides it; if it throws again it re-opens on its own.
            Open Sentry for the full stack trace and breadcrumbs.
          </p>
        </>
      )}
    </div>
  );
}
