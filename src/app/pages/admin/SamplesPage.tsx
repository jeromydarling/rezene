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

const PO_STATUSES = [
  "draft",
  "sent",
  "confirmed",
  "in_production",
  "qc",
  "shipped",
  "received",
  "cancelled",
];

interface PoItem {
  id: string;
  description: string;
  quantity: number;
  unit_cost_cents: number | null;
  currency: string;
  style_name: string | null;
}
interface PoDetail extends AdminProductionOrder {
  issue_date: string | null;
  received_date: string | null;
  notes: string | null;
  items: PoItem[];
}

export function PurchaseOrdersPage() {
  const { data, loading, error, reload } = useFetch<AdminProductionOrder[]>(
    "/api/admin/production/orders",
  );
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div>
      <PageHeader
        eyebrow="Production"
        title="Purchase Orders"
        description="Production orders to factories — pilot runs first, scale later."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
            + New PO
          </button>
        }
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
                <th></th>
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
                  <td>
                    <button type="button" className="link-quiet text-xs" onClick={() => setOpenId(po.id)}>
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SlideOver open={creating} title="New purchase order" onClose={() => setCreating(false)}>
        <PoCreateForm
          onCreated={(id) => {
            setCreating(false);
            reload();
            setOpenId(id);
          }}
          onCancel={() => setCreating(false)}
        />
      </SlideOver>
      <SlideOver open={openId !== null} title="Purchase order" onClose={() => setOpenId(null)}>
        {openId && (
          <PoDetailPanel
            id={openId}
            onChanged={reload}
            onDeleted={() => {
              setOpenId(null);
              reload();
            }}
          />
        )}
      </SlideOver>
    </div>
  );
}

interface DraftLine {
  description: string;
  styleId: string;
  quantity: string;
  unitCost: string;
}

function PoCreateForm({
  onCreated,
  onCancel,
}: {
  onCreated: (id: string) => void;
  onCancel: () => void;
}) {
  const { data: suppliers } = useFetch<AdminSupplier[]>("/api/admin/suppliers");
  const { data: styles } = useFetch<AdminStyle[]>("/api/admin/styles");
  const [form, setForm] = useState({
    supplierId: "",
    currency: "EUR",
    incoterms: "",
    exFactoryDate: "",
    status: "draft",
    notes: "",
  });
  const [lines, setLines] = useState<DraftLine[]>([{ description: "", styleId: "", quantity: "", unitCost: "" }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setLine = (i: number, patch: Partial<DraftLine>) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const addLine = () => setLines((ls) => [...ls, { description: "", styleId: "", quantity: "", unitCost: "" }]);
  const removeLine = (i: number) => setLines((ls) => ls.filter((_, idx) => idx !== i));

  async function submit() {
    if (!form.supplierId) return setError("Choose a supplier.");
    const items = lines
      .filter((l) => l.description.trim() && l.quantity.trim())
      .map((l) => ({
        description: l.description.trim(),
        styleId: l.styleId || null,
        quantity: numOrNull(l.quantity) ?? 0,
        unitCostCents: toCents(l.unitCost),
      }))
      .filter((it) => it.quantity > 0);
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ id: string }>("/api/admin/production/orders", {
        supplierId: form.supplierId,
        currency: form.currency || "EUR",
        incoterms: form.incoterms.trim() || null,
        exFactoryDate: form.exFactoryDate || null,
        status: form.status,
        notes: form.notes.trim() || null,
        items,
      });
      onCreated(res.id);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn't create the PO.");
    } finally {
      setBusy(false);
    }
  }

  const total = lines.reduce((sum, l) => {
    const q = numOrNull(l.quantity) ?? 0;
    const c = toCents(l.unitCost) ?? 0;
    return sum + q * c;
  }, 0);

  return (
    <div className="space-y-3 text-sm">
      <FieldRow label="Supplier *">
        <select className="input" value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}>
          <option value="">Select…</option>
          {suppliers?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </FieldRow>
      <div className="grid grid-cols-2 gap-3">
        <FieldRow label="Currency"><input className="input" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} /></FieldRow>
        <FieldRow label="Status">
          <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            {PO_STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
          </select>
        </FieldRow>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FieldRow label="Incoterms"><input className="input" placeholder="FOB Casablanca" value={form.incoterms} onChange={(e) => setForm({ ...form, incoterms: e.target.value })} /></FieldRow>
        <FieldRow label="Ex-factory date"><input type="date" className="input" value={form.exFactoryDate} onChange={(e) => setForm({ ...form, exFactoryDate: e.target.value })} /></FieldRow>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-medium text-warmgrey">Line items</span>
          <button type="button" className="link-quiet text-xs" onClick={addLine}>+ Add line</button>
        </div>
        <div className="space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="rounded border border-ink/10 p-2">
              <input className="input mb-1.5" placeholder="Description (e.g. Linen shirt, S–XL run)" value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} />
              <div className="grid grid-cols-3 gap-1.5">
                <select className="input !text-xs" value={l.styleId} onChange={(e) => setLine(i, { styleId: e.target.value })}>
                  <option value="">Style (opt)</option>
                  {styles?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <input className="input !text-xs" inputMode="numeric" placeholder="Qty" value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} />
                <input className="input !text-xs" inputMode="decimal" placeholder="Unit cost" value={l.unitCost} onChange={(e) => setLine(i, { unitCost: e.target.value })} />
              </div>
              {lines.length > 1 && (
                <button type="button" className="mt-1 text-[11px] text-terracotta hover:underline" onClick={() => removeLine(i)}>Remove line</button>
              )}
            </div>
          ))}
        </div>
        {total > 0 && (
          <p className="mt-1.5 text-right text-xs text-warmgrey">Est. total: {formatMoney(total, form.currency)}</p>
        )}
      </div>

      <FieldRow label="Notes"><textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></FieldRow>
      {error && <p className="field-error">{error}</p>}
      <div className="flex gap-2 pt-1">
        <button type="button" className="btn btn-primary flex-1" disabled={busy} onClick={() => void submit()}>{busy ? "Creating…" : "Create PO"}</button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function PoDetailPanel({
  id,
  onChanged,
  onDeleted,
}: {
  id: string;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const { data, loading, error, reload } = useFetch<PoDetail>(`/api/admin/production/orders/${id}`);
  const { data: styles } = useFetch<AdminStyle[]>("/api/admin/styles");
  const [saving, setSaving] = useState(false);
  const [newLine, setNewLine] = useState<DraftLine>({ description: "", styleId: "", quantity: "", unitCost: "" });

  async function patch(patchBody: Record<string, unknown>) {
    setSaving(true);
    try {
      await api.patch(`/api/admin/production/orders/${id}`, patchBody);
      reload();
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  async function addItem() {
    if (!newLine.description.trim() || !newLine.quantity.trim()) return;
    await api.post(`/api/admin/production/orders/${id}/items`, {
      description: newLine.description.trim(),
      styleId: newLine.styleId || null,
      quantity: numOrNull(newLine.quantity) ?? 0,
      unitCostCents: toCents(newLine.unitCost),
    });
    setNewLine({ description: "", styleId: "", quantity: "", unitCost: "" });
    reload();
    onChanged();
  }

  async function removeItem(itemId: string) {
    await api.delete(`/api/admin/production/orders/${id}/items/${itemId}`);
    reload();
    onChanged();
  }

  async function del() {
    if (!data) return;
    if (!window.confirm(`Delete ${data.poNumber} and its line items?`)) return;
    try {
      await api.delete(`/api/admin/production/orders/${id}`);
      onDeleted();
    } catch (err) {
      window.alert(err instanceof ApiRequestError ? err.message : "Couldn't delete.");
    }
  }

  if (loading) return <LoadingTable rows={4} />;
  if (error) return <ErrorNote message={error} />;
  if (!data) return null;

  return (
    <div className="space-y-5 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-mono text-lg">{data.poNumber}</h3>
          <p className="text-warmgrey">{data.supplierName}</p>
        </div>
        <button type="button" className="text-xs text-terracotta hover:underline" onClick={() => void del()}>Delete PO</button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FieldRow label="Status">
          <select className="input" value={data.status} disabled={saving} onChange={(e) => void patch({ status: e.target.value })}>
            {PO_STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
          </select>
        </FieldRow>
        <FieldRow label="Ex-factory date">
          <input type="date" className="input" defaultValue={data.exFactoryDate ?? ""} onBlur={(e) => void patch({ exFactoryDate: e.target.value || null })} />
        </FieldRow>
        <FieldRow label="Incoterms">
          <input className="input" defaultValue={data.incoterms ?? ""} onBlur={(e) => void patch({ incoterms: e.target.value || null })} />
        </FieldRow>
        <FieldRow label="Total">
          <div className="input flex items-center bg-cream/60">{data.totalCostCents ? formatMoney(data.totalCostCents, data.currency) : "—"}</div>
        </FieldRow>
      </div>

      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-warmgrey">Line items</h4>
        {data.items.length === 0 ? (
          <p className="text-xs text-warmgrey">No lines yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {data.items.map((it) => (
              <li key={it.id} className="flex items-center justify-between rounded border border-ink/8 px-2.5 py-1.5">
                <div>
                  <p className="font-medium">{it.description}</p>
                  <p className="text-xs text-warmgrey">
                    {it.style_name ? `${it.style_name} · ` : ""}{it.quantity} × {it.unit_cost_cents ? formatMoney(it.unit_cost_cents, it.currency) : "—"}
                  </p>
                </div>
                <button type="button" className="text-[11px] text-terracotta hover:underline" onClick={() => void removeItem(it.id)}>Remove</button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-2 rounded border border-dashed border-ink/15 p-2">
          <input className="input mb-1.5 !text-xs" placeholder="Add a line — description" value={newLine.description} onChange={(e) => setNewLine({ ...newLine, description: e.target.value })} />
          <div className="grid grid-cols-3 gap-1.5">
            <select className="input !text-xs" value={newLine.styleId} onChange={(e) => setNewLine({ ...newLine, styleId: e.target.value })}>
              <option value="">Style (opt)</option>
              {styles?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <input className="input !text-xs" inputMode="numeric" placeholder="Qty" value={newLine.quantity} onChange={(e) => setNewLine({ ...newLine, quantity: e.target.value })} />
            <input className="input !text-xs" inputMode="decimal" placeholder="Unit cost" value={newLine.unitCost} onChange={(e) => setNewLine({ ...newLine, unitCost: e.target.value })} />
          </div>
          <button type="button" className="btn btn-secondary mt-1.5 !py-1 text-xs" onClick={() => void addItem()}>+ Add line</button>
        </div>
      </div>

      <FieldRow label="Notes">
        <textarea className="input" rows={2} defaultValue={data.notes ?? ""} onBlur={(e) => void patch({ notes: e.target.value || null })} />
      </FieldRow>
    </div>
  );
}

interface FabricRow {
  id: string;
  name: string;
  supplier_id: string | null;
  composition: string | null;
  weight_gsm: number | null;
  origin_country: string | null;
  price_per_meter_cents: number | null;
  currency: string;
  lead_time_days: number | null;
  moq_meters: number | null;
  notes: string | null;
}
interface TrimRow {
  id: string;
  name: string;
  supplier_id: string | null;
  spec: string | null;
  price_per_unit_cents: number | null;
  currency: string;
  notes: string | null;
}
interface MaterialsResponse {
  fabrics: FabricRow[];
  trims: TrimRow[];
}

/** Parse a money field ("12.50") to integer cents, or null when blank. */
function toCents(v: string): number | null {
  const n = parseFloat(v);
  return v.trim() && !Number.isNaN(n) ? Math.round(n * 100) : null;
}
const fromCents = (c: number | null | undefined) => (c != null ? (c / 100).toString() : "");
const numOrNull = (v: string) => {
  const n = parseInt(v, 10);
  return v.trim() && !Number.isNaN(n) ? n : null;
};

export function MaterialsPage() {
  const { data, loading, error, reload } = useFetch<MaterialsResponse>(
    "/api/admin/production/materials",
  );
  const { data: suppliers } = useFetch<AdminSupplier[]>("/api/admin/suppliers");
  const [editFabric, setEditFabric] = useState<FabricRow | "new" | null>(null);
  const [editTrim, setEditTrim] = useState<TrimRow | "new" | null>(null);

  async function del(kind: "fabrics" | "trims", id: string, name: string) {
    if (!window.confirm(`Delete ${name}?`)) return;
    try {
      await api.delete(`/api/admin/production/materials/${kind}/${id}`);
      reload();
    } catch (err) {
      window.alert(err instanceof ApiRequestError ? err.message : "Couldn't delete.");
    }
  }

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
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-warmgrey">Fabrics</h2>
              <button type="button" className="btn btn-secondary !py-1.5 text-xs" onClick={() => setEditFabric("new")}>
                + Add fabric
              </button>
            </div>
            {data.fabrics.length === 0 ? (
              <EmptyState title="No fabrics yet" hint="Add the cloths you're sourcing." />
            ) : (
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
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.fabrics.map((f) => (
                      <tr key={f.id}>
                        <td className="font-medium">{f.name}</td>
                        <td>{f.composition ?? "—"}</td>
                        <td>{f.weight_gsm ? `${f.weight_gsm} gsm` : "—"}</td>
                        <td>{f.origin_country ?? "—"}</td>
                        <td>{f.price_per_meter_cents ? formatMoney(f.price_per_meter_cents, f.currency) : "—"}</td>
                        <td>{f.moq_meters ? `${f.moq_meters} m` : "—"}</td>
                        <td>{f.lead_time_days ? `${f.lead_time_days}d` : "—"}</td>
                        <td className="whitespace-nowrap text-right text-xs">
                          <button type="button" className="link-quiet" onClick={() => setEditFabric(f)}>Edit</button>
                          <button type="button" className="ml-3 text-terracotta hover:underline" onClick={() => void del("fabrics", f.id, f.name)}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-warmgrey">Trims</h2>
              <button type="button" className="btn btn-secondary !py-1.5 text-xs" onClick={() => setEditTrim("new")}>
                + Add trim
              </button>
            </div>
            {data.trims.length === 0 ? (
              <EmptyState title="No trims yet" hint="Buttons, zips, labels, elastics…" />
            ) : (
              <div className="admin-card overflow-x-auto">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Spec</th>
                      <th>Price / unit</th>
                      <th>Notes</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.trims.map((t) => (
                      <tr key={t.id}>
                        <td className="font-medium">{t.name}</td>
                        <td>{t.spec ?? "—"}</td>
                        <td>{t.price_per_unit_cents ? formatMoney(t.price_per_unit_cents, t.currency) : "—"}</td>
                        <td className="max-w-xs truncate text-xs text-warmgrey">{t.notes ?? "—"}</td>
                        <td className="whitespace-nowrap text-right text-xs">
                          <button type="button" className="link-quiet" onClick={() => setEditTrim(t)}>Edit</button>
                          <button type="button" className="ml-3 text-terracotta hover:underline" onClick={() => void del("trims", t.id, t.name)}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      <SlideOver open={editFabric !== null} title={editFabric === "new" ? "Add fabric" : "Edit fabric"} onClose={() => setEditFabric(null)}>
        {editFabric !== null && (
          <FabricForm
            fabric={editFabric === "new" ? undefined : editFabric}
            suppliers={suppliers ?? []}
            onSaved={() => { setEditFabric(null); reload(); }}
            onCancel={() => setEditFabric(null)}
          />
        )}
      </SlideOver>
      <SlideOver open={editTrim !== null} title={editTrim === "new" ? "Add trim" : "Edit trim"} onClose={() => setEditTrim(null)}>
        {editTrim !== null && (
          <TrimForm
            trim={editTrim === "new" ? undefined : editTrim}
            suppliers={suppliers ?? []}
            onSaved={() => { setEditTrim(null); reload(); }}
            onCancel={() => setEditTrim(null)}
          />
        )}
      </SlideOver>
    </div>
  );
}

function FabricForm({
  fabric,
  suppliers,
  onSaved,
  onCancel,
}: {
  fabric?: FabricRow;
  suppliers: AdminSupplier[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    name: fabric?.name ?? "",
    supplierId: fabric?.supplier_id ?? "",
    composition: fabric?.composition ?? "",
    weightGsm: fabric?.weight_gsm != null ? String(fabric.weight_gsm) : "",
    originCountry: fabric?.origin_country ?? "",
    price: fromCents(fabric?.price_per_meter_cents),
    currency: fabric?.currency ?? "EUR",
    leadTimeDays: fabric?.lead_time_days != null ? String(fabric.lead_time_days) : "",
    moqMeters: fabric?.moq_meters != null ? String(fabric.moq_meters) : "",
    notes: fabric?.notes ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!form.name.trim()) return setError("Name is required.");
    setBusy(true);
    setError(null);
    const payload = {
      name: form.name.trim(),
      supplierId: form.supplierId || null,
      composition: form.composition.trim() || null,
      weightGsm: numOrNull(form.weightGsm),
      originCountry: form.originCountry.trim() || null,
      pricePerMeterCents: toCents(form.price),
      currency: form.currency || "EUR",
      leadTimeDays: numOrNull(form.leadTimeDays),
      moqMeters: numOrNull(form.moqMeters),
      notes: form.notes.trim() || null,
    };
    try {
      if (fabric) await api.patch(`/api/admin/production/materials/fabrics/${fabric.id}`, payload);
      else await api.post("/api/admin/production/materials/fabrics", payload);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn't save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 text-sm">
      <FieldRow label="Name *"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></FieldRow>
      <FieldRow label="Supplier">
        <select className="input" value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}>
          <option value="">—</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </FieldRow>
      <FieldRow label="Composition"><input className="input" placeholder="100% linen" value={form.composition} onChange={(e) => setForm({ ...form, composition: e.target.value })} /></FieldRow>
      <div className="grid grid-cols-2 gap-3">
        <FieldRow label="Weight (gsm)"><input className="input" inputMode="numeric" value={form.weightGsm} onChange={(e) => setForm({ ...form, weightGsm: e.target.value })} /></FieldRow>
        <FieldRow label="Origin country"><input className="input" placeholder="Portugal" value={form.originCountry} onChange={(e) => setForm({ ...form, originCountry: e.target.value })} /></FieldRow>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FieldRow label="Price / metre"><input className="input" inputMode="decimal" placeholder="12.50" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></FieldRow>
        <FieldRow label="Currency"><input className="input" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} /></FieldRow>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FieldRow label="Lead time (days)"><input className="input" inputMode="numeric" value={form.leadTimeDays} onChange={(e) => setForm({ ...form, leadTimeDays: e.target.value })} /></FieldRow>
        <FieldRow label="MOQ (metres)"><input className="input" inputMode="numeric" value={form.moqMeters} onChange={(e) => setForm({ ...form, moqMeters: e.target.value })} /></FieldRow>
      </div>
      <FieldRow label="Notes"><textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></FieldRow>
      {error && <p className="field-error">{error}</p>}
      <div className="flex gap-2 pt-1">
        <button type="button" className="btn btn-primary flex-1" disabled={busy} onClick={() => void save()}>{busy ? "Saving…" : fabric ? "Save changes" : "Add fabric"}</button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function TrimForm({
  trim,
  suppliers,
  onSaved,
  onCancel,
}: {
  trim?: TrimRow;
  suppliers: AdminSupplier[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    name: trim?.name ?? "",
    supplierId: trim?.supplier_id ?? "",
    spec: trim?.spec ?? "",
    price: fromCents(trim?.price_per_unit_cents),
    currency: trim?.currency ?? "EUR",
    notes: trim?.notes ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!form.name.trim()) return setError("Name is required.");
    setBusy(true);
    setError(null);
    const payload = {
      name: form.name.trim(),
      supplierId: form.supplierId || null,
      spec: form.spec.trim() || null,
      pricePerUnitCents: toCents(form.price),
      currency: form.currency || "EUR",
      notes: form.notes.trim() || null,
    };
    try {
      if (trim) await api.patch(`/api/admin/production/materials/trims/${trim.id}`, payload);
      else await api.post("/api/admin/production/materials/trims", payload);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn't save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 text-sm">
      <FieldRow label="Name *"><input className="input" placeholder="Corozo button 20L" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></FieldRow>
      <FieldRow label="Supplier">
        <select className="input" value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}>
          <option value="">—</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </FieldRow>
      <FieldRow label="Spec"><input className="input" value={form.spec} onChange={(e) => setForm({ ...form, spec: e.target.value })} /></FieldRow>
      <div className="grid grid-cols-2 gap-3">
        <FieldRow label="Price / unit"><input className="input" inputMode="decimal" placeholder="0.40" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></FieldRow>
        <FieldRow label="Currency"><input className="input" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} /></FieldRow>
      </div>
      <FieldRow label="Notes"><textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></FieldRow>
      {error && <p className="field-error">{error}</p>}
      <div className="flex gap-2 pt-1">
        <button type="button" className="btn btn-primary flex-1" disabled={busy} onClick={() => void save()}>{busy ? "Saving…" : trim ? "Save changes" : "Add trim"}</button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-warmgrey">{label}</span>
      {children}
    </label>
  );
}
