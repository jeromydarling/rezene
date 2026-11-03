import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { useFetch } from "../../lib/useFetch";
import { api, ApiRequestError } from "../../lib/api";
import { formatDate, formatMoney } from "../../lib/format";
import {
  EmptyState,
  ErrorNote,
  LoadingTable,
  PageHeader,
  SlideOver,
  StatusBadge,
} from "../../components/admin/ui";
import type { AdminProduct } from "../../../shared/types";

interface LineSheetRow {
  id: string;
  title: string;
  season: string | null;
  currency: string;
  status: string;
  created_at: string;
  item_count: number;
}

interface LineSheetItemRow {
  id: string;
  product_id: string;
  product_name: string;
  msrp_cents: number;
  wholesale_price_cents: number;
  min_qty: number;
  price_tiers: string | null;
}

/** "12@40, 24@36" ⇄ [{minQty:12, priceCents:4000}, …] for the compact tiers field. */
function tiersToText(json: string | null): string {
  try {
    const tiers = JSON.parse(json ?? "[]") as { minQty: number; priceCents: number }[];
    return tiers.map((t) => `${t.minQty}@${(t.priceCents / 100).toFixed(2).replace(/\.00$/, "")}`).join(", ");
  } catch {
    return "";
  }
}
function textToTiers(text: string): { minQty: number; priceCents: number }[] | null {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const tiers: { minQty: number; priceCents: number }[] = [];
  for (const part of trimmed.split(",")) {
    const m = part.trim().match(/^(\d+)\s*@\s*\$?(\d+(?:\.\d{1,2})?)$/);
    if (!m) return null;
    tiers.push({ minQty: parseInt(m[1], 10), priceCents: Math.round(parseFloat(m[2]) * 100) });
  }
  return tiers.filter((t) => t.minQty >= 2).slice(0, 6);
}

interface LineSheetDetail extends LineSheetRow {
  note: string | null;
  items: LineSheetItemRow[];
}

export function LineSheetsPage() {
  const { data, loading, error, reload } = useFetch<LineSheetRow[]>(
    "/api/admin/wholesale/line-sheets",
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [buyersOpen, setBuyersOpen] = useState(false);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const buyers = useFetch<{ accounts: BuyerRow[]; pending: number }>("/api/admin/wholesale/accounts");
  const wOrders = useFetch<{ orders: WOrderRow[]; open: number }>("/api/admin/wholesale/orders");

  async function revoke(id: string) {
    await api.post(`/api/admin/wholesale/line-sheets/${id}/revoke`);
    reload();
  }

  return (
    <div>
      <PageHeader
        eyebrow="Commerce"
        title="Line Sheets"
        description="Curated wholesale selections for boutique buyers. Approved buyers sign in to the trade portal and order at their own pricing; you manage those orders with net terms."
        actions={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setBuyersOpen(true)}>
              Buyers{buyers.data?.pending ? ` (${buyers.data.pending})` : ""}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setOrdersOpen(true)}>
              Orders{wOrders.data?.open ? ` (${wOrders.data.open})` : ""}
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setCreateOpen(true)}>
              New line sheet
            </button>
          </>
        }
      />
      {shareUrl && (
        <div className="mb-5 rounded-md border border-palm/40 bg-palm/10 p-4">
          <p className="mb-1 text-sm font-semibold">Share link created — copy it now.</p>
          <p className="mb-2 text-xs text-warmgrey">
            For security only a fingerprint is stored, so this exact URL is shown once.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded bg-white px-2 py-1 text-xs">
              {window.location.origin}
              {shareUrl}
            </code>
            <button
              type="button"
              className="btn btn-secondary !px-3 !py-1 text-xs"
              onClick={() => {
                void navigator.clipboard.writeText(`${window.location.origin}${shareUrl}`);
              }}
            >
              Copy
            </button>
            <button
              type="button"
              className="text-xs text-warmgrey underline"
              onClick={() => setShareUrl(null)}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
      {error && <ErrorNote message={error} />}
      {loading && <LoadingTable rows={3} />}
      {data && data.length === 0 && (
        <EmptyState
          title="No line sheets yet"
          hint="Create one from your catalog — wholesale prices default to your cost sheets (or 50% of retail) and are editable per sheet."
        />
      )}
      {data && data.length > 0 && (
        <div className="admin-card overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Season</th>
                <th>Products</th>
                <th>Status</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.map((sheet) => (
                <tr key={sheet.id}>
                  <td className="font-medium">
                    <button
                      type="button"
                      className="hover:underline"
                      onClick={() => setOpenId(sheet.id)}
                    >
                      {sheet.title}
                    </button>
                  </td>
                  <td>{sheet.season ?? "—"}</td>
                  <td>{sheet.item_count}</td>
                  <td>
                    <StatusBadge status={sheet.status} />
                  </td>
                  <td className="text-xs text-warmgrey">{formatDate(sheet.created_at)}</td>
                  <td className="text-right">
                    {sheet.status === "active" && (
                      <button
                        type="button"
                        className="text-xs text-clay hover:underline"
                        onClick={() => void revoke(sheet.id)}
                      >
                        Revoke link
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <SlideOver open={createOpen} title="New line sheet" onClose={() => setCreateOpen(false)}>
        <LineSheetCreateForm
          onCreated={(url) => {
            setCreateOpen(false);
            setShareUrl(url);
            reload();
          }}
        />
      </SlideOver>
      <SlideOver
        open={openId !== null}
        title="Line sheet pricing"
        onClose={() => setOpenId(null)}
      >
        {openId && <LineSheetDetailPanel id={openId} />}
      </SlideOver>
      <SlideOver open={buyersOpen} title="Wholesale buyers" onClose={() => setBuyersOpen(false)}>
        <BuyersPanel accounts={buyers.data?.accounts ?? []} onChanged={() => buyers.reload()} />
      </SlideOver>
      <SlideOver open={ordersOpen} title="Wholesale orders" onClose={() => setOrdersOpen(false)}>
        <WholesaleOrdersPanel orders={wOrders.data?.orders ?? []} onChanged={() => wOrders.reload()} />
      </SlideOver>
    </div>
  );
}

function LineSheetCreateForm({ onCreated }: { onCreated: (url: string) => void }) {
  const { data: products } = useFetch<AdminProduct[]>("/api/admin/products");
  const [title, setTitle] = useState("");
  const [season, setSeason] = useState("");
  const [note, setNote] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (selected.size === 0) {
      setError("Select at least one product.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ id: string; url: string }>(
        "/api/admin/wholesale/line-sheets",
        {
          title,
          season: season || undefined,
          note: note || undefined,
          productIds: [...selected],
        },
      );
      onCreated(res.url);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label">Title *</label>
        <input
          required
          className="input"
          placeholder="SS26 Boutique Selection"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Season</label>
          <input
            className="input"
            placeholder="SS26"
            value={season}
            onChange={(e) => setSeason(e.target.value)}
          />
        </div>
      </div>
      <div>
        <label className="label">Note to buyers</label>
        <input
          className="input"
          placeholder="Delivery March 2026 · payment terms net 30"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      <div>
        <label className="label">Products * ({selected.size} selected)</label>
        <div className="max-h-72 space-y-1 overflow-y-auto rounded-md border border-ink/15 p-2">
          {products?.map((p) => (
            <label
              key={p.id}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-cream"
            >
              <input
                type="checkbox"
                checked={selected.has(p.id)}
                onChange={() => toggle(p.id)}
              />
              <span className="flex-1">{p.name}</span>
              <span className="text-xs text-warmgrey">
                {formatMoney(p.basePriceCents, p.currency)}
              </span>
            </label>
          ))}
          {products && products.length === 0 && (
            <p className="p-2 text-xs text-warmgrey">No products in the catalog yet.</p>
          )}
        </div>
        <p className="mt-1 text-xs text-warmgrey">
          Wholesale prices default from your cost sheets (or 50% of retail) — adjust them after
          creating.
        </p>
      </div>
      {error && <p className="field-error">{error}</p>}
      <button type="submit" disabled={busy} className="btn btn-primary w-full">
        {busy ? "Creating…" : "Create & get share link"}
      </button>
    </form>
  );
}

function LineSheetDetailPanel({ id }: { id: string }) {
  const { data, loading, error, reload } = useFetch<LineSheetDetail>(
    `/api/admin/wholesale/line-sheets/${id}`,
  );
  const [saving, setSaving] = useState<string | null>(null);

  async function save(
    item: LineSheetItemRow,
    patch: { wholesalePriceCents?: number; minQty?: number; priceTiers?: { minQty: number; priceCents: number }[] },
  ) {
    setSaving(item.id);
    try {
      await api.patch(`/api/admin/wholesale/line-sheets/items/${item.id}`, patch);
      reload();
    } finally {
      setSaving(null);
    }
  }

  if (loading) return <LoadingTable rows={4} />;
  if (error) return <ErrorNote message={error} />;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div>
        <p className="font-display text-lg font-light">{data.title}</p>
        <p className="text-xs text-warmgrey">
          {[data.season, data.note].filter(Boolean).join(" · ") || "—"}
        </p>
      </div>
      <div className="overflow-x-auto">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>MSRP</th>
            <th>Wholesale</th>
            <th>Min qty</th>
            <th>Volume tiers</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((item) => (
            <tr key={item.id} className={saving === item.id ? "opacity-50" : ""}>
              <td className="text-sm">{item.product_name}</td>
              <td className="text-xs text-warmgrey">{formatMoney(item.msrp_cents)}</td>
              <td>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="input !w-24 !py-1 text-xs"
                  defaultValue={(item.wholesale_price_cents / 100).toFixed(2)}
                  onBlur={(e) => {
                    const cents = Math.round(Number.parseFloat(e.target.value || "0") * 100);
                    if (Number.isFinite(cents) && cents >= 0 && cents !== item.wholesale_price_cents) {
                      void save(item, { wholesalePriceCents: cents });
                    }
                  }}
                />
              </td>
              <td>
                <input
                  type="number"
                  min="1"
                  className="input !w-16 !py-1 text-xs"
                  defaultValue={item.min_qty}
                  onBlur={(e) => {
                    const qty = Number.parseInt(e.target.value || "1", 10);
                    if (Number.isFinite(qty) && qty >= 1 && qty !== item.min_qty) {
                      void save(item, { minQty: qty });
                    }
                  }}
                />
              </td>
              <td>
                <input
                  className="input !w-36 !py-1 text-xs"
                  placeholder="12@40, 24@36"
                  title="Quantity breaks: qty@price, comma-separated. Blank clears."
                  defaultValue={tiersToText(item.price_tiers)}
                  onBlur={(e) => {
                    const tiers = textToTiers(e.target.value);
                    if (tiers !== null && e.target.value.trim() !== tiersToText(item.price_tiers)) {
                      void save(item, { priceTiers: tiers });
                    }
                  }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      <p className="text-xs text-warmgrey">
        Edits save when you click away from a field. Volume tiers are quantity breaks — “12@40, 24@36”
        means $40 a unit from 12 pieces, $36 from 24. The shared page and portal always show current pricing.
      </p>
    </div>
  );
}

// ---------- Wholesale buyers & orders ----------
interface BuyerRow {
  id: string;
  email: string;
  company: string | null;
  contactName: string | null;
  status: string;
  discountPct: number;
  termsDays: number;
  note: string | null;
  createdAt: string;
  orderCount: number;
}
interface WOrderRow {
  id: string;
  orderNumber: string;
  status: string;
  totalCents: number;
  currency: string;
  dueDate: string | null;
  paidAt: string | null;
  fulfillmentOrderId: string | null;
  createdAt: string;
  company: string | null;
  email: string;
}

function BuyersPanel({ accounts, onChanged }: { accounts: BuyerRow[]; onChanged: () => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [discount, setDiscount] = useState("0");
  const [terms, setTerms] = useState("0");
  const [priceListFor, setPriceListFor] = useState<string | null>(null);

  async function approve(id: string) {
    await api.post(`/api/admin/wholesale/accounts/${id}/approve`, {
      discountPct: Number(discount) || 0,
      termsDays: Number(terms) || 0,
    });
    setEditing(null);
    onChanged();
  }
  async function reject(id: string) {
    await api.post(`/api/admin/wholesale/accounts/${id}/reject`);
    onChanged();
  }

  if (accounts.length === 0)
    return <p className="py-8 text-center text-sm text-warmgrey">No wholesale applications yet.</p>;

  return (
    <div className="space-y-3 text-sm">
      {accounts.map((a) => (
        <div key={a.id} className="rounded-lg border border-ink/10 p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-medium">{a.company || a.email}</p>
              <p className="text-xs text-warmgrey">
                {a.contactName ? `${a.contactName} · ` : ""}
                {a.email}
              </p>
              {a.status === "approved" && (
                <p className="mt-0.5 text-xs text-warmgrey">
                  {a.discountPct > 0 ? `${a.discountPct}% off · ` : ""}
                  {a.termsDays > 0 ? `Net ${a.termsDays}` : "Due on receipt"} · {a.orderCount} orders
                </p>
              )}
            </div>
            <StatusBadge status={a.status} />
          </div>

          {a.status === "approved" && (
            <div className="mt-2">
              <button
                type="button"
                className="text-xs text-navy underline"
                onClick={() => setPriceListFor(priceListFor === a.id ? null : a.id)}
              >
                {priceListFor === a.id ? "Hide price list" : "Custom price list"}
              </button>
              {priceListFor === a.id && <BuyerPriceList accountId={a.id} />}
            </div>
          )}

          {a.status === "pending" && (
            <div className="mt-2">
              {editing === a.id ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="text-xs text-warmgrey">Trade discount %</span>
                      <input className="input text-sm" inputMode="numeric" value={discount} onChange={(e) => setDiscount(e.target.value)} />
                    </label>
                    <label className="block">
                      <span className="text-xs text-warmgrey">Net terms (days)</span>
                      <input className="input text-sm" inputMode="numeric" value={terms} onChange={(e) => setTerms(e.target.value)} />
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" className="btn btn-primary flex-1 !py-1.5 text-xs" onClick={() => void approve(a.id)}>
                      Approve buyer
                    </button>
                    <button type="button" className="btn btn-secondary !py-1.5 text-xs" onClick={() => setEditing(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn btn-primary !py-1.5 text-xs"
                    onClick={() => {
                      setEditing(a.id);
                      setDiscount("0");
                      setTerms("30");
                    }}
                  >
                    Review & approve
                  </button>
                  <button type="button" className="text-xs text-terracotta hover:underline" onClick={() => void reject(a.id)}>
                    Decline
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const WO_STATUSES = ["submitted", "confirmed", "invoiced", "paid", "cancelled"];

/**
 * A buyer's custom price list: absolute unit prices per product that replace
 * the line-sheet price, tiers, and trade discount for that buyer. Blank =
 * standard pricing.
 */
function BuyerPriceList({ accountId }: { accountId: string }) {
  const { data, loading, reload } = useFetch<{
    products: { productId: string; name: string; listCents: number; overrideCents: number | null }[];
  }>(`/api/admin/wholesale/accounts/${accountId}/overrides`);
  const [saving, setSaving] = useState<string | null>(null);

  async function save(productId: string, unitPriceCents: number | null) {
    setSaving(productId);
    try {
      await api.put(`/api/admin/wholesale/accounts/${accountId}/overrides`, { productId, unitPriceCents });
      reload();
    } finally {
      setSaving(null);
    }
  }

  if (loading) return <p className="mt-2 text-xs text-warmgrey">Loading…</p>;
  if (!data || data.products.length === 0)
    return <p className="mt-2 text-xs text-warmgrey">No products on active line sheets yet.</p>;
  return (
    <div className="mt-2 space-y-1">
      {data.products.map((p) => (
        <div key={p.productId} className={`flex items-center gap-2 text-xs ${saving === p.productId ? "opacity-50" : ""}`}>
          <span className="flex-1 truncate">{p.name}</span>
          <span className="text-warmgrey">{formatMoney(p.listCents)}</span>
          <input
            type="number"
            min="0"
            step="0.01"
            className="input !w-24 !py-1 text-xs"
            placeholder="custom"
            defaultValue={p.overrideCents != null ? (p.overrideCents / 100).toFixed(2) : ""}
            onBlur={(e) => {
              const raw = e.target.value.trim();
              const cents = raw === "" ? null : Math.round(Number.parseFloat(raw) * 100);
              if (cents === null || (Number.isFinite(cents) && cents >= 0)) {
                if (cents !== p.overrideCents) void save(p.productId, cents);
              }
            }}
          />
        </div>
      ))}
      <p className="pt-1 text-[0.65rem] text-warmgrey">
        A custom price replaces the sheet price, tiers, and trade discount for this buyer. Blank = standard pricing.
      </p>
    </div>
  );
}

function WholesaleOrdersPanel({ orders, onChanged }: { orders: WOrderRow[]; onChanged: () => void }) {
  const [linkFor, setLinkFor] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function setStatus(id: string, status: string) {
    await api.post(`/api/admin/wholesale/orders/${id}/status`, { status });
    onChanged();
  }
  async function copyPaymentLink(id: string) {
    setLinkFor(id);
    try {
      const res = await api.post<{ url: string }>(`/api/admin/wholesale/orders/${id}/payment-link`);
      await navigator.clipboard.writeText(res.url);
      setCopied(id);
      setTimeout(() => setCopied(null), 2500);
    } catch (err) {
      alert(err instanceof ApiRequestError ? err.message : "Couldn't create a payment link");
    } finally {
      setLinkFor(null);
    }
  }
  if (orders.length === 0)
    return <p className="py-8 text-center text-sm text-warmgrey">No wholesale orders yet.</p>;
  return (
    <div className="space-y-2 text-sm">
      {orders.map((o) => (
        <div key={o.id} className="rounded-lg border border-ink/10 p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-mono font-medium">{o.orderNumber}</p>
              <p className="text-xs text-warmgrey">
                {o.company || o.email} · {formatDate(o.createdAt)}
                {o.dueDate && o.status === "invoiced" ? ` · due ${o.dueDate}` : ""}
                {o.paidAt ? " · paid" : ""}
              </p>
            </div>
            <span className="font-medium">{formatMoney(o.totalCents, o.currency)}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select
              className="input !w-auto !py-1 text-xs"
              value={o.status}
              onChange={(e) => void setStatus(o.id, e.target.value)}
            >
              {WO_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {titleCaseWord(s)}
                </option>
              ))}
            </select>
            {(o.status === "invoiced" || o.status === "confirmed") && (
              <button
                type="button"
                className="btn btn-secondary !px-2.5 !py-1 text-xs"
                disabled={linkFor === o.id}
                onClick={() => void copyPaymentLink(o.id)}
              >
                {copied === o.id ? "✓ Link copied" : linkFor === o.id ? "Creating…" : "Copy payment link"}
              </button>
            )}
            {o.fulfillmentOrderId && (
              <Link to="/admin/orders" className="text-xs text-navy underline">
                Open in Orders →
              </Link>
            )}
          </div>
          {o.status === "confirmed" && !o.fulfillmentOrderId && (
            <p className="mt-1 text-[0.65rem] text-warmgrey">Confirming creates a matching order under Selling → Orders for shipping & tracking.</p>
          )}
        </div>
      ))}
    </div>
  );
}

function titleCaseWord(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
