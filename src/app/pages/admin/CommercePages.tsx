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
import type { AdminCustomer, AdminOrder, AdminProduct, AdminSupplier } from "../../../shared/types";

export function OrdersPage() {
  const { data, loading, error } = useFetch<AdminOrder[]>("/api/admin/commerce/orders");
  return (
    <div>
      <PageHeader
        eyebrow="Commerce"
        title="Orders"
        description="Stripe-backed orders. Payment state mirrors Stripe via webhooks; fulfillment is managed here."
      />
      {error && <ErrorNote message={error} />}
      {loading && <LoadingTable />}
      {data && data.length === 0 && (
        <EmptyState
          title="No orders yet"
          hint="Orders appear here when Stripe Checkout completes — configure Stripe keys and webhooks to go live."
        />
      )}
      {data && data.length > 0 && (
        <div className="admin-card overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Total</th>
                <th>Payment</th>
                <th>Fulfillment</th>
                <th>Country</th>
                <th>Placed</th>
              </tr>
            </thead>
            <tbody>
              {data.map((o) => (
                <tr key={o.id}>
                  <td className="font-mono text-xs">
                    {o.orderNumber}
                    {o.isPreOrder && <span className="badge badge-saffron ml-2">pre-order</span>}
                  </td>
                  <td>{o.customerName ?? o.email ?? "—"}</td>
                  <td>{o.itemCount}</td>
                  <td>{formatMoney(o.totalCents, o.currency)}</td>
                  <td>
                    <StatusBadge status={o.paymentStatus} />
                  </td>
                  <td>
                    <StatusBadge status={o.fulfillmentStatus} />
                  </td>
                  <td>{o.shippingCountry ?? "—"}</td>
                  <td className="text-xs text-warmgrey">{formatDate(o.placedAt ?? o.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function CustomersPage() {
  const { data, loading, error } = useFetch<AdminCustomer[]>("/api/admin/commerce/customers");
  return (
    <div>
      <PageHeader
        eyebrow="Commerce"
        title="Customers"
        description="Customer records mirror Stripe customers — only IDs and non-sensitive metadata are stored."
      />
      {error && <ErrorNote message={error} />}
      {loading && <LoadingTable />}
      {data && data.length === 0 && (
        <EmptyState title="No customers yet" hint="Created automatically from Stripe checkout." />
      )}
      {data && data.length > 0 && (
        <div className="admin-card overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Name</th>
                <th>Country</th>
                <th>Orders</th>
                <th>Lifetime spend</th>
                <th>Since</th>
              </tr>
            </thead>
            <tbody>
              {data.map((cust) => (
                <tr key={cust.id}>
                  <td className="font-medium">{cust.email}</td>
                  <td>{cust.name ?? "—"}</td>
                  <td>{cust.country ?? "—"}</td>
                  <td>{cust.orderCount}</td>
                  <td>{formatMoney(cust.totalSpentCents)}</td>
                  <td className="text-xs text-warmgrey">{formatDate(cust.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------- Pre-order campaigns ----------

interface CampaignRow {
  id: string;
  product_id: string;
  product_name: string;
  product_slug: string;
  goal_units: number;
  max_units: number | null;
  cutoff_date: string | null;
  supplier_name: string | null;
  supplier_moq: number | null;
  status: string;
  note: string | null;
  ordered_units: number;
}

export function PreOrdersPage() {
  const { data, loading, error, reload } = useFetch<CampaignRow[]>(
    "/api/admin/commerce/preorder-campaigns",
  );
  const [createOpen, setCreateOpen] = useState(false);

  async function setStatus(campaign: CampaignRow, status: string) {
    await api.patch(`/api/admin/commerce/preorder-campaigns/${campaign.id}`, { status });
    reload();
  }

  return (
    <div>
      <PageHeader
        eyebrow="Commerce"
        title="Pre-orders"
        description="Campaigns that fund production runs — goals tied to factory MOQs, cutoffs tied to the calendar, and hard caps so a run can never oversell."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setCreateOpen(true)}>
            New campaign
          </button>
        }
      />
      {error && <ErrorNote message={error} />}
      {loading && <LoadingTable rows={3} />}
      {data && data.length === 0 && (
        <EmptyState
          title="No campaigns"
          hint="Create one on a pre-order product; the goal typically matches your atelier's MOQ."
        />
      )}
      {data && data.length > 0 && (
        <div className="space-y-4">
          {data.map((campaign) => {
            const pct = Math.min(
              100,
              Math.round((campaign.ordered_units / campaign.goal_units) * 100),
            );
            return (
              <div key={campaign.id} className="admin-card p-5">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-lg font-light">{campaign.product_name}</p>
                    <p className="text-xs text-warmgrey">
                      Goal {campaign.goal_units} units
                      {campaign.supplier_name &&
                        ` · ${campaign.supplier_name}${campaign.supplier_moq ? ` (MOQ ${campaign.supplier_moq})` : ""}`}
                      {campaign.cutoff_date && ` · closes ${formatDate(campaign.cutoff_date)}`}
                      {campaign.max_units != null && ` · cap ${campaign.max_units}`}
                    </p>
                  </div>
                  <select
                    className="rounded border border-ink/15 bg-white px-2 py-1 text-xs"
                    value={campaign.status}
                    onChange={(e) => void setStatus(campaign, e.target.value)}
                  >
                    {["draft", "live", "funded", "ended", "cancelled"].map((s) => (
                      <option key={s} value={s}>
                        {titleCase(s)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mb-1 flex items-baseline justify-between text-xs">
                  <span
                    className={
                      campaign.status === "funded" ? "font-semibold text-palm" : "text-warmgrey"
                    }
                  >
                    {campaign.status === "funded" ? "Funded ✓" : `${pct}% of goal`}
                  </span>
                  <span className="text-warmgrey">
                    {campaign.ordered_units} / {campaign.goal_units} ordered
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-ink/10">
                  <div
                    className={`h-2.5 rounded-full ${campaign.status === "funded" ? "bg-palm" : "bg-saffron"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {campaign.note && <p className="mt-2 text-xs text-warmgrey">{campaign.note}</p>}
              </div>
            );
          })}
        </div>
      )}
      <SlideOver open={createOpen} title="New pre-order campaign" onClose={() => setCreateOpen(false)}>
        <CampaignCreateForm
          onCreated={() => {
            setCreateOpen(false);
            reload();
          }}
        />
      </SlideOver>
    </div>
  );
}

function CampaignCreateForm({ onCreated }: { onCreated: () => void }) {
  const { data: products } = useFetch<AdminProduct[]>("/api/admin/products");
  const { data: suppliers } = useFetch<AdminSupplier[]>("/api/admin/suppliers");
  const [form, setForm] = useState({
    productId: "",
    supplierId: "",
    goalUnits: "",
    maxUnits: "",
    cutoffDate: "",
    note: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selectedSupplier = suppliers?.find((s) => s.id === form.supplierId);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/admin/commerce/preorder-campaigns", {
        productId: form.productId,
        supplierId: form.supplierId || undefined,
        goalUnits: parseInt(form.goalUnits, 10),
        maxUnits: form.maxUnits ? parseInt(form.maxUnits, 10) : undefined,
        cutoffDate: form.cutoffDate || undefined,
        note: form.note || undefined,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label">Product *</label>
        <select
          required
          className="input"
          value={form.productId}
          onChange={(e) => setForm({ ...form, productId: e.target.value })}
        >
          <option value="">Select…</option>
          {products?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-warmgrey">
          Creating a campaign switches the product to pre-order automatically.
        </p>
      </div>
      <div>
        <label className="label">Production partner (pulls MOQ)</label>
        <select
          className="input"
          value={form.supplierId}
          onChange={(e) => {
            const supplier = suppliers?.find((s) => s.id === e.target.value);
            setForm({
              ...form,
              supplierId: e.target.value,
              goalUnits:
                form.goalUnits === "" && supplier?.moqUnits
                  ? String(supplier.moqUnits)
                  : form.goalUnits,
            });
          }}
        >
          <option value="">—</option>
          {suppliers?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.moqUnits ? ` (MOQ ${s.moqUnits})` : ""}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Goal (units) *</label>
          <input
            required
            type="number"
            min="1"
            className="input"
            value={form.goalUnits}
            onChange={(e) => setForm({ ...form, goalUnits: e.target.value })}
          />
          {selectedSupplier?.moqUnits != null && (
            <p className="mt-1 text-xs text-warmgrey">
              {selectedSupplier.name} MOQ: {selectedSupplier.moqUnits}
            </p>
          )}
        </div>
        <div>
          <label className="label">Hard cap (optional)</label>
          <input
            type="number"
            min="1"
            className="input"
            placeholder="Oversell guard"
            value={form.maxUnits}
            onChange={(e) => setForm({ ...form, maxUnits: e.target.value })}
          />
        </div>
      </div>
      <div>
        <label className="label">Cutoff date</label>
        <input
          type="date"
          className="input"
          value={form.cutoffDate}
          onChange={(e) => setForm({ ...form, cutoffDate: e.target.value })}
        />
      </div>
      <div>
        <label className="label">Note</label>
        <input
          className="input"
          value={form.note}
          onChange={(e) => setForm({ ...form, note: e.target.value })}
        />
      </div>
      {error && <p className="field-error">{error}</p>}
      <button type="submit" disabled={busy} className="btn btn-primary w-full">
        {busy ? "Creating…" : "Launch campaign"}
      </button>
    </form>
  );
}

interface LeadRow {
  id: string;
  kind: string;
  email: string;
  name: string | null;
  company: string | null;
  message: string | null;
  created_at: string;
}

export function LeadsSection() {
  const { data } = useFetch<LeadRow[]>("/api/admin/commerce/leads");
  if (!data || data.length === 0) return null;
  return (
    <div className="mt-8">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-warmgrey">
        Recent leads
      </h2>
      <div className="admin-card overflow-x-auto">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Kind</th>
              <th>Email</th>
              <th>Name / company</th>
              <th>Message</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 25).map((lead) => (
              <tr key={lead.id}>
                <td>
                  <StatusBadge status={lead.kind} />
                </td>
                <td>{lead.email}</td>
                <td>{[lead.name, lead.company].filter(Boolean).join(" · ") || "—"}</td>
                <td className="max-w-xs truncate text-xs text-warmgrey">{lead.message ?? "—"}</td>
                <td className="text-xs text-warmgrey">{formatDate(lead.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
