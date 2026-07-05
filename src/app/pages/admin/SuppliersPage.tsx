import { useState } from "react";
import { useFetch } from "../../lib/useFetch";
import { api, ApiRequestError } from "../../lib/api";
import { formatDate, formatMoney, titleCase } from "../../lib/format";
import {
  EmptyState,
  ErrorNote,
  LoadingTable,
  PageHeader,
  SlideOver,
  StatusBadge,
} from "../../components/admin/ui";
import type { AdminSupplier, AdminSupplierInteraction } from "../../../shared/types";

interface SupplierDetail extends AdminSupplier {
  interactions: AdminSupplierInteraction[];
  samples: { id: string; round: number; kind: string; status: string; style_name: string }[];
  productionOrders: {
    id: string;
    po_number: string;
    status: string;
    currency: string;
    total_cost_cents: number | null;
    ex_factory_date: string | null;
  }[];
}

export function SuppliersPage() {
  const { data, loading, error } = useFetch<AdminSupplier[]>("/api/admin/suppliers");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div>
      <PageHeader
        eyebrow="Production"
        title="Factories & Suppliers"
        description="The Casablanca network. Leads marked 'unverified' are research data — verify before committing production."
      />
      {error && <ErrorNote message={error} />}
      {loading && <LoadingTable />}
      {data && data.length === 0 && (
        <EmptyState title="No suppliers" hint="Add the ateliers you're courting." />
      )}
      {data && data.length > 0 && (
        <div className="admin-card overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Kind</th>
                <th>Location</th>
                <th>Capabilities</th>
                <th>MOQ</th>
                <th>Lead time</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.map((s) => (
                <tr key={s.id}>
                  <td className="font-medium">{s.name}</td>
                  <td>{titleCase(s.kind)}</td>
                  <td>
                    {[s.city, s.country].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td className="max-w-xs">
                    <div className="flex flex-wrap gap-1">
                      {s.capabilities.slice(0, 3).map((cap) => (
                        <span key={cap} className="badge badge-neutral">
                          {titleCase(cap)}
                        </span>
                      ))}
                      {s.capabilities.length > 3 && (
                        <span className="text-xs text-warmgrey">+{s.capabilities.length - 3}</span>
                      )}
                    </div>
                  </td>
                  <td>{s.moqUnits ?? "—"}</td>
                  <td>{s.leadTimeDays ? `${s.leadTimeDays}d` : "—"}</td>
                  <td>
                    <span className={`badge ${s.isVerified ? "badge-success" : "badge-saffron"}`}>
                      {s.isVerified ? "verified" : "unverified"}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="link-quiet text-xs"
                      onClick={() => setSelectedId(s.id)}
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
      <SlideOver
        open={Boolean(selectedId)}
        title="Supplier profile"
        onClose={() => setSelectedId(null)}
      >
        {selectedId && <SupplierDetailPanel id={selectedId} />}
      </SlideOver>
    </div>
  );
}

function SupplierDetailPanel({ id }: { id: string }) {
  const { data, loading, error, reload } = useFetch<SupplierDetail>(`/api/admin/suppliers/${id}`);
  const [logOpen, setLogOpen] = useState(false);
  const [log, setLog] = useState({ kind: "email", subject: "", summary: "", needsResponse: false });
  const [logError, setLogError] = useState<string | null>(null);

  async function submitLog() {
    setLogError(null);
    try {
      await api.post(`/api/admin/suppliers/${id}/interactions`, {
        kind: log.kind,
        direction: "outbound",
        subject: log.subject || undefined,
        summary: log.summary || undefined,
        needsResponse: log.needsResponse,
      });
      setLogOpen(false);
      setLog({ kind: "email", subject: "", summary: "", needsResponse: false });
      reload();
    } catch (err) {
      setLogError(err instanceof ApiRequestError ? err.message : "Failed to log interaction");
    }
  }

  if (loading) return <LoadingTable rows={4} />;
  if (error) return <ErrorNote message={error} />;
  if (!data) return null;

  return (
    <div className="space-y-6 text-sm">
      <div>
        <h3 className="font-display text-xl font-light">{data.name}</h3>
        <p className="text-warmgrey">
          {[data.city, data.country].filter(Boolean).join(", ")} · {titleCase(data.kind)}
        </p>
        {!data.isVerified && (
          <p className="mt-2 rounded bg-saffron/15 px-3 py-2 text-xs text-bark">
            Research/demo lead — verify capabilities, MOQ, and terms before use.
          </p>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-3">
        {[
          ["Email", data.email],
          ["WhatsApp", data.whatsapp],
          ["MOQ", data.moqUnits ? `${data.moqUnits} units` : null],
          ["Lead time", data.leadTimeDays ? `${data.leadTimeDays} days` : null],
          ["Languages", data.languages.join(", ") || null],
          ["On-time score", data.onTimeScore?.toFixed(1) ?? null],
        ]
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k as string}>
              <dt className="text-[0.68rem] font-semibold uppercase tracking-wider text-warmgrey">
                {k}
              </dt>
              <dd>{v}</dd>
            </div>
          ))}
      </dl>

      {data.notes && <p className="rounded bg-cream p-3 text-xs leading-relaxed">{data.notes}</p>}

      {data.contacts.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-warmgrey">
            Contacts
          </h4>
          <ul className="space-y-1.5">
            {data.contacts.map((ct) => (
              <li key={ct.id}>
                <span className="font-medium">{ct.name}</span>
                {ct.role && <span className="text-warmgrey"> · {ct.role}</span>}
                {ct.email && <span className="block text-xs text-warmgrey">{ct.email}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-warmgrey">
            Interaction log
          </h4>
          <button type="button" className="link-quiet text-xs" onClick={() => setLogOpen(!logOpen)}>
            {logOpen ? "Cancel" : "Log interaction"}
          </button>
        </div>
        {logOpen && (
          <div className="mb-3 space-y-2 rounded border border-ink/10 p-3">
            <select
              className="input"
              value={log.kind}
              onChange={(e) => setLog({ ...log, kind: e.target.value })}
            >
              {["email", "call", "whatsapp", "visit", "quote", "sample_feedback", "other"].map(
                (k) => (
                  <option key={k} value={k}>
                    {titleCase(k)}
                  </option>
                ),
              )}
            </select>
            <input
              className="input"
              placeholder="Subject"
              value={log.subject}
              onChange={(e) => setLog({ ...log, subject: e.target.value })}
            />
            <textarea
              className="input"
              rows={3}
              placeholder="Summary"
              value={log.summary}
              onChange={(e) => setLog({ ...log, summary: e.target.value })}
            />
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={log.needsResponse}
                onChange={(e) => setLog({ ...log, needsResponse: e.target.checked })}
              />
              Awaiting their response
            </label>
            {logError && <p className="field-error">{logError}</p>}
            <button type="button" className="btn btn-primary w-full" onClick={() => void submitLog()}>
              Save
            </button>
          </div>
        )}
        {data.interactions.length === 0 ? (
          <p className="text-xs text-warmgrey">No interactions logged.</p>
        ) : (
          <ul className="space-y-2">
            {data.interactions.map((it) => (
              <li key={it.id} className="rounded border border-ink/8 p-2.5">
                <div className="flex items-center justify-between">
                  <span className="badge badge-neutral">{titleCase(it.kind)}</span>
                  <span className="text-xs text-warmgrey">{formatDate(it.createdAt)}</span>
                </div>
                {it.subject && <p className="mt-1 font-medium">{it.subject}</p>}
                {it.summary && <p className="text-xs text-ink/70">{it.summary}</p>}
                {it.needsResponse && (
                  <span className="badge badge-terracotta mt-1">awaiting response</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {data.productionOrders.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-warmgrey">
            Production orders
          </h4>
          <ul className="space-y-1.5">
            {data.productionOrders.map((po) => (
              <li key={po.id} className="flex items-center justify-between">
                <span className="font-mono text-xs">{po.po_number}</span>
                <span className="text-xs">
                  {po.total_cost_cents ? formatMoney(po.total_cost_cents, po.currency) : "—"}
                </span>
                <StatusBadge status={po.status} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
