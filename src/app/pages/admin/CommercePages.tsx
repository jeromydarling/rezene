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
  AdminCustomer,
  AdminOrder,
  AdminProduct,
  AdminSupplier,
  OrderShipmentRow,
  ShipmentEventRow,
  ShippingQuote,
} from "../../../shared/types";

export function OrdersPage() {
  const { data, loading, error, reload } = useFetch<AdminOrder[]>("/api/admin/commerce/orders");
  const [selected, setSelected] = useState<AdminOrder | null>(null);
  return (
    <div>
      <PageHeader
        eyebrow="Commerce"
        title="Orders"
        help="orders"
        description="Every order in one place — payment status updates itself the moment a customer pays; open an order to quote carriers, buy a label, or record tracking."
      />
      {error && <ErrorNote message={error} />}
      {loading && <LoadingTable />}
      {data && data.length === 0 && (
        <EmptyState
          title="No orders yet"
          hint="Orders appear here the moment a customer completes checkout. Connect your payment account in Settings to start selling."
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
                <tr
                  key={o.id}
                  className="cursor-pointer hover:bg-cream/60"
                  onClick={() => setSelected(o)}
                >
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
      <SlideOver
        open={selected !== null}
        title={selected ? `Order ${selected.orderNumber}` : ""}
        onClose={() => {
          setSelected(null);
          reload();
        }}
      >
        {selected && <OrderDetailPanel orderId={selected.id} />}
      </SlideOver>
    </div>
  );
}

// ---------- Order detail + fulfillment ----------

interface OrderDetail extends AdminOrder {
  shippingAddress: string | null;
  items: { id: string; description: string; quantity: number; unit_price_cents: number; currency: string }[];
}

function OrderDetailPanel({ orderId }: { orderId: string }) {
  const { data: order, error } = useFetch<OrderDetail>(`/api/admin/commerce/orders/${orderId}`);
  const {
    data: shipmentData,
    reload: reloadShipments,
  } = useFetch<{ shipments: OrderShipmentRow[]; events: ShipmentEventRow[] }>(
    `/api/admin/shipping/orders/${orderId}/shipments`,
  );

  if (error) return <ErrorNote message={error} />;
  if (!order) return <LoadingTable rows={3} />;

  const address = (() => {
    try {
      const parsed = order.shippingAddress ? JSON.parse(order.shippingAddress) : null;
      return parsed as { name?: string; address?: Record<string, string | null> } | null;
    } catch {
      return null;
    }
  })();

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 flex items-center gap-2">
          <StatusBadge status={order.paymentStatus} />
          <StatusBadge status={order.fulfillmentStatus} />
        </div>
        <table className="admin-table">
          <tbody>
            {order.items.map((i) => (
              <tr key={i.id}>
                <td className="text-sm">{i.description}</td>
                <td className="text-xs text-warmgrey">×{i.quantity}</td>
                <td className="text-right text-sm">
                  {formatMoney(i.unit_price_cents * i.quantity, i.currency)}
                </td>
              </tr>
            ))}
            <tr>
              <td className="font-semibold">Total</td>
              <td />
              <td className="text-right font-semibold">
                {formatMoney(order.totalCents, order.currency)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {address?.address && (
        <div className="rounded bg-cream px-3 py-2.5 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-warmgrey">Ship to</p>
          <p className="mt-1">
            {[
              address.name,
              address.address.line1,
              address.address.line2,
              [address.address.postal_code, address.address.city].filter(Boolean).join(" "),
              address.address.country,
            ]
              .filter(Boolean)
              .join(", ")}
          </p>
        </div>
      )}

      <ShipmentsSection
        orderId={orderId}
        paymentStatus={order.paymentStatus}
        hasAddress={Boolean(address?.address?.country ?? order.shippingCountry)}
        shipments={shipmentData?.shipments ?? []}
        events={shipmentData?.events ?? []}
        onChanged={reloadShipments}
      />
    </div>
  );
}

function ShipmentsSection({
  orderId,
  paymentStatus,
  hasAddress,
  shipments,
  events,
  onChanged,
}: {
  orderId: string;
  paymentStatus: string;
  hasAddress: boolean;
  shipments: OrderShipmentRow[];
  events: ShipmentEventRow[];
  onChanged: () => void;
}) {
  const [quotes, setQuotes] = useState<ShippingQuote[] | null>(null);
  const [quoteErrors, setQuoteErrors] = useState<{ provider: string; message: string }[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState({ carrier: "", trackingNumber: "", trackingUrl: "" });

  async function fetchRates() {
    setBusy("rates");
    setError(null);
    try {
      const res = await api.get<{ quotes: ShippingQuote[]; errors: { provider: string; message: string }[] }>(
        `/api/admin/shipping/orders/${orderId}/rates`,
      );
      setQuotes(res.quotes);
      setQuoteErrors(res.errors);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Rate lookup failed");
    } finally {
      setBusy(null);
    }
  }

  async function buyLabel(q: ShippingQuote) {
    setBusy(q.rateId ?? q.service);
    setError(null);
    try {
      await api.post(`/api/admin/shipping/orders/${orderId}/shipments`, {
        provider: q.provider,
        rateId: q.rateId,
        externalShipmentId: q.externalShipmentId,
        service: q.service,
      });
      setQuotes(null);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Label purchase failed");
    } finally {
      setBusy(null);
    }
  }

  async function recordManual(e: FormEvent) {
    e.preventDefault();
    setBusy("manual");
    setError(null);
    try {
      await api.post(`/api/admin/shipping/orders/${orderId}/shipments`, {
        provider: "manual",
        carrier: manual.carrier || undefined,
        trackingNumber: manual.trackingNumber || undefined,
        trackingUrl: manual.trackingUrl || undefined,
      });
      setManualOpen(false);
      setManual({ carrier: "", trackingNumber: "", trackingUrl: "" });
      onChanged();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Could not record shipment");
    } finally {
      setBusy(null);
    }
  }

  async function markDelivered(id: string) {
    await api.patch(`/api/admin/shipping/shipments/${id}`, { status: "delivered" });
    onChanged();
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-warmgrey">Shipments</h3>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn btn-secondary !px-2.5 !py-1 text-xs"
            disabled={busy !== null || !hasAddress}
            onClick={() => void fetchRates()}
            title={hasAddress ? "" : "The order needs a shipping address first"}
          >
            {busy === "rates" ? "Quoting…" : "Get live rates"}
          </button>
          <button
            type="button"
            className="btn btn-secondary !px-2.5 !py-1 text-xs"
            onClick={() => setManualOpen((v) => !v)}
          >
            Record tracking
          </button>
        </div>
      </div>
      {paymentStatus !== "paid" && (
        <p className="mb-2 text-xs text-warmgrey">
          Heads-up: this order isn't paid yet.
        </p>
      )}
      {error && <p className="field-error mb-2">{error}</p>}

      {manualOpen && (
        <form onSubmit={recordManual} className="mb-3 space-y-2 rounded bg-cream px-3 py-3">
          <input
            className="input"
            placeholder="Carrier (e.g. Amana, La Poste)"
            value={manual.carrier}
            onChange={(e) => setManual({ ...manual, carrier: e.target.value })}
          />
          <input
            className="input"
            placeholder="Tracking number"
            value={manual.trackingNumber}
            onChange={(e) => setManual({ ...manual, trackingNumber: e.target.value })}
          />
          <input
            className="input"
            placeholder="Tracking URL (optional)"
            value={manual.trackingUrl}
            onChange={(e) => setManual({ ...manual, trackingUrl: e.target.value })}
          />
          <button type="submit" disabled={busy === "manual"} className="btn btn-primary w-full">
            {busy === "manual" ? "Saving…" : "Mark shipped"}
          </button>
        </form>
      )}

      {quotes && (
        <div className="mb-3 space-y-1.5">
          {quotes.length === 0 && (
            <p className="text-xs text-warmgrey">No rates returned for this destination.</p>
          )}
          {quotes.map((q, i) => (
            <div key={i} className="flex items-center justify-between rounded border border-ink/10 px-3 py-2">
              <div>
                <p className="text-sm">
                  {q.carrier} — {q.service}
                </p>
                <p className="text-xs text-warmgrey">
                  {formatMoney(q.amountCents, q.currency)}
                  {q.minDays != null && ` · ${q.minDays}${q.maxDays && q.maxDays !== q.minDays ? `–${q.maxDays}` : ""} days`}
                  {` · via ${titleCase(q.provider ?? "provider")}`}
                </p>
              </div>
              {q.provider !== "manual" ? (
                <button
                  type="button"
                  className="btn btn-primary !px-2.5 !py-1 text-xs"
                  disabled={busy !== null}
                  onClick={() => void buyLabel(q)}
                >
                  {busy === (q.rateId ?? q.service) ? "Buying…" : "Buy label"}
                </button>
              ) : (
                <span className="text-xs text-warmgrey">flat rate</span>
              )}
            </div>
          ))}
          {quoteErrors.map((e) => (
            <p key={e.provider} className="text-xs text-terracotta-deep">
              {titleCase(e.provider)}: {e.message}
            </p>
          ))}
        </div>
      )}

      {shipments.length === 0 && !quotes && (
        <p className="text-xs text-warmgrey">
          Nothing shipped yet. Quote live rates to buy a label, or record tracking from a label you
          bought elsewhere.
        </p>
      )}
      <div className="space-y-2">
        {shipments.map((s) => {
          const shipmentEvents = events.filter((e) => e.shipment_id === s.id).slice(0, 4);
          return (
            <div key={s.id} className="rounded border border-ink/10 px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm">
                  {s.carrier ?? titleCase(s.provider)}
                  {s.service && <span className="text-warmgrey"> — {s.service}</span>}
                </p>
                <StatusBadge status={s.status} />
              </div>
              <p className="mt-1 text-xs text-warmgrey">
                {s.tracking_number ? (
                  s.tracking_url ? (
                    <a href={s.tracking_url} target="_blank" rel="noreferrer" className="underline hover:text-ink">
                      {s.tracking_number}
                    </a>
                  ) : (
                    s.tracking_number
                  )
                ) : (
                  "No tracking number"
                )}
                {s.cost_cents != null && ` · label ${formatMoney(s.cost_cents, s.currency)}`}
              </p>
              {shipmentEvents.length > 0 && (
                <ul className="mt-2 space-y-0.5 border-t border-ink/5 pt-2 text-xs text-warmgrey">
                  {shipmentEvents.map((e, i) => (
                    <li key={i}>
                      {formatDate(e.occurred_at ?? e.created_at)} — {e.description ?? e.status ?? "update"}
                      {e.location && ` (${e.location})`}
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-2 flex gap-3">
                {s.label_url && (
                  <a
                    href={s.label_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs underline hover:text-ink"
                  >
                    Label PDF
                  </a>
                )}
                {s.status !== "delivered" && s.status !== "cancelled" && (
                  <button
                    type="button"
                    className="text-xs text-warmgrey underline hover:text-ink"
                    onClick={() => void markDelivered(s.id)}
                  >
                    Mark delivered
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
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
        help="orders"
        description="Everyone who has bought from you — order history and lifetime spend at a glance. Card details never touch this system; they stay with your payment provider."
      />
      {error && <ErrorNote message={error} />}
      {loading && <LoadingTable />}
      {data && data.length === 0 && (
        <EmptyState
          title="No customers yet"
          hint="Customers appear here automatically after their first order."
        />
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
        help="pre-orders"
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
