import { useState, type FormEvent } from "react";
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
import type {
  AdminProductionOrder,
  AdminSample,
  AdminStyle,
  AdminSupplier,
} from "../../../shared/types";

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
  const [createOpen, setCreateOpen] = useState(false);

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
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setCreateOpen(true)}>
            Request sample
          </button>
        }
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
      <SlideOver open={createOpen} title="Request a sample" onClose={() => setCreateOpen(false)}>
        <SampleCreateForm
          existing={data ?? []}
          onCreated={() => {
            setCreateOpen(false);
            reload();
          }}
        />
      </SlideOver>
    </div>
  );
}

const SAMPLE_KINDS = [
  { value: "proto", label: "Proto — first shape" },
  { value: "fit", label: "Fit — on-body corrections" },
  { value: "sms", label: "SMS — salesman sample" },
  { value: "pp", label: "PP — pre-production" },
  { value: "top", label: "TOP — top of production" },
];

function SampleCreateForm({
  existing,
  onCreated,
}: {
  existing: AdminSample[];
  onCreated: () => void;
}) {
  const { data: styles } = useFetch<AdminStyle[]>("/api/admin/styles");
  const { data: suppliers } = useFetch<AdminSupplier[]>("/api/admin/suppliers");
  const [form, setForm] = useState({ styleId: "", supplierId: "", kind: "proto", notes: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Next round number for this style+kind, so rounds count up automatically.
  const nextRound =
    existing.filter((s) => s.styleId === form.styleId && s.kind === form.kind).length + 1;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/admin/production/samples", {
        styleId: form.styleId,
        supplierId: form.supplierId || undefined,
        kind: form.kind,
        round: nextRound,
        notes: form.notes || undefined,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Could not create the sample");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label">Style *</label>
        <select
          required
          className="input"
          value={form.styleId}
          onChange={(e) => setForm({ ...form, styleId: e.target.value })}
        >
          <option value="">Select…</option>
          {styles?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Sample type</label>
        <select
          className="input"
          value={form.kind}
          onChange={(e) => setForm({ ...form, kind: e.target.value })}
        >
          {SAMPLE_KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
        {form.styleId && (
          <p className="mt-1 text-xs text-warmgrey">This will be round #{nextRound}.</p>
        )}
      </div>
      <div>
        <label className="label">Atelier</label>
        <select
          className="input"
          value={form.supplierId}
          onChange={(e) => setForm({ ...form, supplierId: e.target.value })}
        >
          <option value="">—</option>
          {suppliers?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Notes for this round</label>
        <textarea
          rows={3}
          className="input"
          placeholder="What changed since the last round, what to check on arrival…"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
      </div>
      {error && <p className="field-error">{error}</p>}
      <button type="submit" disabled={busy || !form.styleId} className="btn btn-primary w-full">
        {busy ? "Requesting…" : "Request sample"}
      </button>
    </form>
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
