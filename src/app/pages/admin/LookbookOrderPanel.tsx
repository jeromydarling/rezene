import { useEffect, useState } from "react";
import { useFetch } from "../../lib/useFetch";
import { api, ApiRequestError } from "../../lib/api";
import { useToast } from "../../lib/toast";

/**
 * Print & mail order panel: add recipients (by hand or CSV), pick copies +
 * shipping, and place a print & mail order. Lulu prints and drop-ships each
 * copy; the shop is charged once the jobs are placed. Also lists past orders
 * with live status + tracking.
 */

interface Recipient {
  name: string;
  street1: string;
  street2?: string;
  city: string;
  state_code?: string;
  postcode: string;
  country_code?: string;
  phone_number?: string;
  email?: string;
}
interface OrderRow {
  id: string;
  title: string;
  status: string;
  retail_cents: number;
  currency: string;
  recipients: number;
  created_at: string;
}
interface OrderDetail {
  job: { id: string; status: string; error: string | null };
  recipients: { id: string; name: string; city: string; country_code: string; lulu_status: string | null; tracking_url: string | null; error: string | null }[];
}

// A lookbook is a lightweight saddle-stitch booklet, and Lulu only offers the
// mail tiers for it — the courier tiers (Ground/Expedited/Express) are for
// heavier boxed products and Lulu rejects them for a booklet ("no shipping
// option found"). Offer only the levels that actually price so a merchant can
// never pick one the order would fail on.
const SHIPPING = [
  { id: "MAIL", label: "Mail (cheapest, no tracking)" },
  { id: "PRIORITY_MAIL", label: "Priority (tracked)" },
];

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  rendering: "Printing file…",
  rendered: "Rendered",
  submitted: "Sent to print",
  shipped: "Shipped",
  failed: "Failed",
  cancelled: "Cancelled",
};

function money(cents: number, currency = "USD") {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toFixed(2)}`;
  }
}

const EMPTY: Recipient = { name: "", street1: "", city: "", state_code: "", postcode: "", country_code: "US", phone_number: "", email: "" };

/** Tiny CSV parser (header row → lowercased keys). Handles quoted fields + commas. */
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  const s = text.replace(/\r\n?/g, "\n");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else field += ch;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).filter((r) => r.some((c) => c.trim())).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => (obj[h] = r[i] ?? ""));
    return obj;
  });
}

export function PrintOrderPanel({ lookbookId }: { lookbookId: string }) {
  const toast = useToast();
  const orders = useFetch<OrderRow[]>(`/api/admin/print-lookbooks/${lookbookId}/orders`);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [draft, setDraft] = useState<Recipient>(EMPTY);
  const [copies, setCopies] = useState(1);
  const [shipping, setShipping] = useState("MAIL");
  const [placing, setPlacing] = useState(false);

  // On return from Stripe checkout, activate the order (confirm hold → render).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const printed = params.get("printed");
    if (!printed) return;
    (async () => {
      try {
        const r = await api.post<{ status: string; error?: string }>(`/api/admin/print-lookbooks/${lookbookId}/order/${printed}/activate`);
        toast.success("Order placed", r.status === "rendering" ? "We're preparing your print files now." : `Status: ${r.status}`);
        orders.reload();
      } catch (err) {
        toast.error("Couldn't start the order", err instanceof ApiRequestError ? err.message : undefined);
      }
      // Clear the query so a refresh doesn't re-activate.
      window.history.replaceState({}, "", window.location.pathname);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addDraft() {
    if (!draft.name || !draft.street1 || !draft.city || !draft.postcode) {
      toast.error("Missing details", "Name, street, city and postcode are required.");
      return;
    }
    setRecipients([...recipients, draft]);
    setDraft(EMPTY);
  }

  async function importCsv(file: File) {
    const table = parseCsv(await file.text());
    const rows: Recipient[] = [];
    for (const row of table) {
      const g = (k: string) => (row[k] ?? "").trim();
      const name = g("name") || [g("first_name"), g("last_name")].filter(Boolean).join(" ");
      const street1 = g("street1") || g("address") || g("address1");
      const city = g("city");
      const postcode = g("postcode") || g("zip") || g("postal_code");
      if (!name || !street1 || !city || !postcode) continue;
      rows.push({
        name,
        street1,
        street2: g("street2") || g("address2") || undefined,
        city,
        state_code: g("state") || g("state_code") || undefined,
        postcode,
        country_code: (g("country") || g("country_code") || "US").slice(0, 2).toUpperCase(),
        phone_number: g("phone") || g("phone_number") || undefined,
        email: g("email") || undefined,
      });
    }
    if (!rows.length) {
      toast.error("Nothing imported", "Expected columns like name, street1, city, postcode, country.");
      return;
    }
    setRecipients((prev) => [...prev, ...rows]);
    toast.success(`Imported ${rows.length} recipient${rows.length === 1 ? "" : "s"}`);
  }

  async function placeOrder() {
    if (recipients.length === 0) {
      toast.error("Add at least one recipient");
      return;
    }
    setPlacing(true);
    try {
      const res = await api.post<{ checkoutUrl?: string; sandbox?: boolean; error?: string }>(`/api/admin/print-lookbooks/${lookbookId}/order`, {
        recipients,
        copies,
        shippingLevel: shipping,
      });
      if (res.checkoutUrl) {
        window.location.href = res.checkoutUrl; // to Stripe; returns with ?printed=jobId
      } else if (res.sandbox) {
        // Sandbox skips checkout and renders immediately — no redirect.
        toast.success("Sandbox order placed", "Preparing print files now — no charge in sandbox.");
        setRecipients([]);
        orders.reload();
      }
    } catch (err) {
      toast.error("Couldn't place the order", err instanceof ApiRequestError ? err.message : undefined);
    } finally {
      setPlacing(false);
    }
  }

  return (
    <div className="admin-card space-y-4 p-5">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-warmgrey">Print &amp; mail</h2>
        <span className="rounded bg-navy/10 px-1.5 py-0.5 text-[0.6rem] font-medium uppercase tracking-wider text-navy">Beta</span>
      </div>
      <p className="text-xs text-warmgrey">
        Print this lookbook on demand and drop-ship a copy to each recipient. Add them by hand or
        upload a CSV, then place the order — you're charged once the print jobs are sent.
      </p>

      {/* Recipient entry */}
      <div className="grid grid-cols-2 gap-2">
        <input className="admin-input text-xs" placeholder="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        <input className="admin-input text-xs" placeholder="Street" value={draft.street1} onChange={(e) => setDraft({ ...draft, street1: e.target.value })} />
        <input className="admin-input text-xs" placeholder="City" value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} />
        <div className="flex gap-2">
          <input className="admin-input w-1/2 text-xs" placeholder="State" value={draft.state_code} onChange={(e) => setDraft({ ...draft, state_code: e.target.value })} />
          <input className="admin-input w-1/2 text-xs" placeholder="Postcode" value={draft.postcode} onChange={(e) => setDraft({ ...draft, postcode: e.target.value })} />
        </div>
        <input className="admin-input text-xs" placeholder="Country (US)" value={draft.country_code} onChange={(e) => setDraft({ ...draft, country_code: e.target.value.toUpperCase().slice(0, 2) })} />
        <input className="admin-input text-xs" placeholder="Phone (for the carrier)" value={draft.phone_number} onChange={(e) => setDraft({ ...draft, phone_number: e.target.value })} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-secondary !py-1 text-xs" onClick={addDraft}>Add recipient</button>
        <label className="btn btn-secondary !py-1 cursor-pointer text-xs">
          Upload CSV
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && void importCsv(e.target.files[0])} />
        </label>
        <span className="text-xs text-warmgrey">{recipients.length} recipient{recipients.length === 1 ? "" : "s"}</span>
      </div>

      {recipients.length > 0 && (
        <div className="max-h-32 space-y-1 overflow-y-auto text-xs">
          {recipients.map((r, i) => (
            <div key={i} className="flex items-center justify-between rounded bg-ink/5 px-2 py-1">
              <span className="truncate">{r.name} — {r.city}, {r.country_code}</span>
              <button type="button" className="text-warmgrey hover:text-red-700" onClick={() => setRecipients(recipients.filter((_, k) => k !== i))}>✕</button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs text-warmgrey">Copies each
          <input type="number" min={1} max={50} className="admin-input ml-2 w-16 !py-1 text-xs" value={copies} onChange={(e) => setCopies(Math.max(1, Math.min(50, Number(e.target.value) || 1)))} />
        </label>
        <label className="text-xs text-warmgrey">Shipping
          <select className="admin-input ml-2 !py-1 text-xs" value={shipping} onChange={(e) => setShipping(e.target.value)}>
            {SHIPPING.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
        <button type="button" className="btn btn-primary !py-1 text-xs" disabled={placing || recipients.length === 0} onClick={() => void placeOrder()}>
          {placing ? "…" : "Order & pay"}
        </button>
      </div>

      {/* Past orders */}
      {orders.data && orders.data.length > 0 && (
        <div className="border-t border-ink/10 pt-3">
          <p className="mb-2 text-[0.7rem] font-semibold uppercase tracking-wider text-warmgrey">Orders</p>
          <div className="space-y-1">
            {orders.data.map((o) => (
              <OrderLine key={o.id} order={o} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function OrderLine({ order }: { order: OrderRow }) {
  const [open, setOpen] = useState(false);
  const detail = useFetch<OrderDetail>(open ? `/api/admin/print-lookbooks/orders/${order.id}` : null);
  const toast = useToast();
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    try {
      await api.post(`/api/admin/print-lookbooks/orders/${order.id}/refresh`);
      detail.reload();
    } catch (err) {
      toast.error("Couldn't refresh", err instanceof ApiRequestError ? err.message : undefined);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="rounded bg-ink/5 px-2 py-1.5 text-xs">
      <button type="button" className="flex w-full items-center justify-between" onClick={() => setOpen(!open)}>
        <span>{order.recipients} recipient{order.recipients === 1 ? "" : "s"} · {money(order.retail_cents, order.currency)}</span>
        <span className="text-warmgrey">{STATUS_LABEL[order.status] ?? order.status}</span>
      </button>
      {open && detail.data && (
        <div className="mt-2 space-y-1">
          {detail.data.job.error && <p className="text-terracotta">{detail.data.job.error}</p>}
          {detail.data.recipients.map((r) => (
            <div key={r.id} className="flex items-center justify-between text-warmgrey">
              <span>{r.name} — {r.city}</span>
              <span>
                {r.tracking_url ? <a href={r.tracking_url} target="_blank" rel="noreferrer" className="text-navy underline">track</a> : (r.lulu_status ?? r.error ?? "—")}
              </span>
            </div>
          ))}
          <button type="button" className="link-quiet text-[0.7rem]" disabled={refreshing} onClick={() => void refresh()}>
            {refreshing ? "…" : "Refresh tracking"}
          </button>
        </div>
      )}
    </div>
  );
}
