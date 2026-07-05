import { useFetch } from "../../lib/useFetch";
import { api } from "../../lib/api";
import { formatDate, formatMoney, titleCase } from "../../lib/format";
import {
  EmptyState,
  ErrorNote,
  LoadingTable,
  PageHeader,
  StatusBadge,
} from "../../components/admin/ui";
import type { AdminProductionOrder, AdminSample } from "../../../shared/types";

const SAMPLE_STATUSES = [
  "requested",
  "in_progress",
  "shipped",
  "received",
  "in_review",
  "revisions_needed",
  "approved",
  "rejected",
];

export function SamplesPage() {
  const { data, loading, error, reload } = useFetch<AdminSample[]>("/api/admin/production/samples");

  async function setStatus(sample: AdminSample, status: string) {
    await api.patch(`/api/admin/production/samples/${sample.id}`, { status });
    reload();
  }

  return (
    <div>
      <PageHeader
        eyebrow="Production"
        title="Samples"
        description="Proto → fit → SMS → PP → TOP. Every round tracked against its style and atelier."
      />
      {error && <ErrorNote message={error} />}
      {loading && <LoadingTable />}
      {data && data.length === 0 && (
        <EmptyState title="No samples yet" hint="Request the first proto once tech packs are approved." />
      )}
      {data && data.length > 0 && (
        <div className="admin-card overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Style</th>
                <th>Round</th>
                <th>Type</th>
                <th>Atelier</th>
                <th>Requested</th>
                <th>Status</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {data.map((s) => (
                <tr key={s.id}>
                  <td className="font-medium">{s.styleName}</td>
                  <td>#{s.round}</td>
                  <td>{s.kind.toUpperCase()}</td>
                  <td>{s.supplierName ?? "—"}</td>
                  <td className="text-xs text-warmgrey">{formatDate(s.requestedAt)}</td>
                  <td>
                    <select
                      className="rounded border border-ink/15 bg-white px-1.5 py-1 text-xs"
                      value={s.status}
                      onChange={(e) => void setStatus(s, e.target.value)}
                    >
                      {SAMPLE_STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {titleCase(st)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="max-w-xs truncate text-xs text-warmgrey">{s.notes ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function PurchaseOrdersPage() {
  const { data, loading, error } = useFetch<AdminProductionOrder[]>("/api/admin/production/orders");
  return (
    <div>
      <PageHeader
        eyebrow="Production"
        title="Purchase Orders"
        description="Production orders to factories — pilot runs first, scale later."
      />
      {error && <ErrorNote message={error} />}
      {loading && <LoadingTable rows={3} />}
      {data && data.length === 0 && (
        <EmptyState title="No purchase orders" hint="Draft the pilot PO after sample approval." />
      )}
      {data && data.length > 0 && (
        <div className="admin-card overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>PO</th>
                <th>Supplier</th>
                <th>Lines</th>
                <th>Total</th>
                <th>Ex-factory</th>
                <th>Incoterms</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.map((po) => (
                <tr key={po.id}>
                  <td className="font-mono text-xs">{po.poNumber}</td>
                  <td className="font-medium">{po.supplierName}</td>
                  <td>{po.itemCount}</td>
                  <td>{po.totalCostCents ? formatMoney(po.totalCostCents, po.currency) : "—"}</td>
                  <td className="text-xs text-warmgrey">{formatDate(po.exFactoryDate)}</td>
                  <td className="text-xs">{po.incoterms ?? "—"}</td>
                  <td>
                    <StatusBadge status={po.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

interface MaterialsResponse {
  fabrics: {
    id: string;
    name: string;
    composition: string | null;
    weight_gsm: number | null;
    origin_country: string | null;
    price_per_meter_cents: number | null;
    currency: string;
    lead_time_days: number | null;
    moq_meters: number | null;
    notes: string | null;
  }[];
  trims: {
    id: string;
    name: string;
    spec: string | null;
    price_per_unit_cents: number | null;
    currency: string;
    notes: string | null;
  }[];
}

export function MaterialsPage() {
  const { data, loading, error } = useFetch<MaterialsResponse>("/api/admin/production/materials");
  return (
    <div>
      <PageHeader
        eyebrow="Production"
        title="Fabrics & Materials"
        description="Cloth and trims. Origin country matters — it drives duty qualification."
      />
      {error && <ErrorNote message={error} />}
      {loading && <LoadingTable />}
      {data && (
        <div className="space-y-8">
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-warmgrey">
              Fabrics
            </h2>
            <div className="admin-card overflow-x-auto">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Composition</th>
                    <th>Weight</th>
                    <th>Origin</th>
                    <th>Price / m</th>
                    <th>MOQ</th>
                    <th>Lead time</th>
                  </tr>
                </thead>
                <tbody>
                  {data.fabrics.map((f) => (
                    <tr key={f.id}>
                      <td className="font-medium">{f.name}</td>
                      <td>{f.composition ?? "—"}</td>
                      <td>{f.weight_gsm ? `${f.weight_gsm} gsm` : "—"}</td>
                      <td>{f.origin_country ?? "—"}</td>
                      <td>
                        {f.price_per_meter_cents
                          ? formatMoney(f.price_per_meter_cents, f.currency)
                          : "—"}
                      </td>
                      <td>{f.moq_meters ? `${f.moq_meters} m` : "—"}</td>
                      <td>{f.lead_time_days ? `${f.lead_time_days}d` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-warmgrey">
              Trims
            </h2>
            <div className="admin-card overflow-x-auto">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Spec</th>
                    <th>Price / unit</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {data.trims.map((t) => (
                    <tr key={t.id}>
                      <td className="font-medium">{t.name}</td>
                      <td>{t.spec ?? "—"}</td>
                      <td>
                        {t.price_per_unit_cents
                          ? formatMoney(t.price_per_unit_cents, t.currency)
                          : "—"}
                      </td>
                      <td className="text-xs text-warmgrey">{t.notes ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
