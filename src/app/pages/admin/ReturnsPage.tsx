import { useState } from "react";
import { useFetch } from "../../lib/useFetch";
import { api, ApiRequestError } from "../../lib/api";
import { useToast } from "../../lib/toast";
import { formatDate, formatMoney } from "../../lib/format";
import { EmptyState, LoadingTable, PageHeader, SlideOver, StatusBadge } from "../../components/admin/ui";

interface ReturnRow {
  id: string;
  status: string;
  reason: string | null;
  refundAmountCents: number | null;
  currency: string | null;
  createdAt: string;
  orderNumber: string;
  customer: string | null;
  itemCount: number;
}
interface ReturnItem {
  id: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
  currency: string;
}
interface ReturnDetail {
  return: Record<string, unknown>;
  items: ReturnItem[];
}

const REASON_LABEL: Record<string, string> = {
  size: "Wrong size / fit",
  quality: "Quality issue",
  changed_mind: "Changed mind",
  faulty: "Arrived faulty",
  other: "Other",
};

export function ReturnsPage() {
  const list = useFetch<{ returns: ReturnRow[]; open: number; stripeReady: boolean }>("/api/admin/returns");
  const [openId, setOpenId] = useState<string | null>(null);

  const rows = list.data?.returns ?? [];

  return (
    <div>
      <PageHeader
        eyebrow="Commerce"
        title="Returns"
        help="returns"
        description="When a customer asks to send something back, it lands here. Approve to refund and restock in one step, or decline with a note."
      />

      {list.loading && <LoadingTable rows={4} />}
      {!list.loading && rows.length === 0 && (
        <EmptyState
          title="No returns"
          hint="Customers start a return from their account after an order is paid — you'll review each one here."
        />
      )}
      {rows.length > 0 && (
        <div className="admin-card overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Requested</th>
                <th>Order</th>
                <th>Customer</th>
                <th>Reason</th>
                <th>Items</th>
                <th>Refund</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="text-xs text-warmgrey">{formatDate(r.createdAt)}</td>
                  <td className="font-mono text-xs">{r.orderNumber}</td>
                  <td className="text-sm">{r.customer ?? "—"}</td>
                  <td className="text-sm">{r.reason ? REASON_LABEL[r.reason] ?? r.reason : "—"}</td>
                  <td>{r.itemCount}</td>
                  <td>{r.refundAmountCents != null ? formatMoney(r.refundAmountCents, r.currency || "EUR") : "—"}</td>
                  <td>
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="text-right">
                    <button type="button" className="link-quiet text-xs" onClick={() => setOpenId(r.id)}>
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SlideOver open={openId !== null} title="Review return" onClose={() => setOpenId(null)}>
        {openId && (
          <ReturnPanel
            id={openId}
            stripeReady={list.data?.stripeReady ?? false}
            onChanged={() => {
              list.reload();
            }}
            onClose={() => setOpenId(null)}
          />
        )}
      </SlideOver>
    </div>
  );
}

function ReturnPanel({
  id,
  stripeReady,
  onChanged,
  onClose,
}: {
  id: string;
  stripeReady: boolean;
  onChanged: () => void;
  onClose: () => void;
}) {
  const toast = useToast();
  const { data, loading, reload } = useFetch<ReturnDetail>(`/api/admin/returns/${id}`);
  const [restock, setRestock] = useState(true);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading || !data) return <LoadingTable rows={4} />;
  const r = data.return as Record<string, string | number | null>;
  const status = String(r.status);
  const refundDefault = Number(r.refund_amount_cents ?? 0);
  const currency = String(r.currency ?? "EUR");
  const done = status === "refunded" || status === "rejected";

  async function approve() {
    setBusy(true);
    try {
      await api.post(`/api/admin/returns/${id}/approve`, {
        refundAmountCents: refundDefault,
        restock,
        adminNote: note || undefined,
      });
      toast.success("Return approved", stripeReady ? "Refunded and restocked." : "Recorded and restocked.");
      reload();
      onChanged();
    } catch (e) {
      toast.error("Couldn't approve", e instanceof ApiRequestError ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  }

  async function decline() {
    setBusy(true);
    try {
      await api.post(`/api/admin/returns/${id}/decline`, { adminNote: note || undefined });
      toast.success("Return declined");
      reload();
      onChanged();
    } catch (e) {
      toast.error("Couldn't decline", e instanceof ApiRequestError ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-xs text-warmgrey">Order {String(r.order_number)}</p>
          <p className="text-warmgrey">{String(r.order_email ?? "")}</p>
        </div>
        <StatusBadge status={status} />
      </div>

      {r.reason && (
        <p>
          <span className="text-warmgrey">Reason: </span>
          {REASON_LABEL[String(r.reason)] ?? String(r.reason)}
        </p>
      )}
      {r.customer_note && (
        <p className="rounded bg-cream/60 p-3 text-ink/80">"{String(r.customer_note)}"</p>
      )}

      <div>
        <p className="mb-1 text-xs font-medium uppercase tracking-wider text-warmgrey">Items to return</p>
        <ul className="space-y-1">
          {data.items.map((it) => (
            <li key={it.id} className="flex justify-between rounded border border-ink/8 px-2.5 py-1.5">
              <span>
                {it.quantity} × {it.description}
              </span>
              <span className="text-warmgrey">{formatMoney(it.unitPriceCents * it.quantity, it.currency)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-right text-sm">
          Refund total: <span className="font-medium">{formatMoney(refundDefault, currency)}</span>
        </p>
      </div>

      {!done ? (
        <>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} />
            <span>Restock the returned pieces</span>
          </label>
          <textarea
            className="input"
            rows={2}
            placeholder="Note (optional) — the customer doesn't see this"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          {!stripeReady && refundDefault > 0 && (
            <p className="rounded bg-amber-50 p-2 text-xs text-amber-700">
              Connect Stripe to refund automatically. You can still record the return and restock.
            </p>
          )}
          <div className="flex gap-2">
            <button type="button" className="btn btn-primary flex-1" disabled={busy} onClick={() => void approve()}>
              {busy ? "Working…" : `Approve & refund ${formatMoney(refundDefault, currency)}`}
            </button>
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void decline()}>
              Decline
            </button>
          </div>
        </>
      ) : (
        <div className="rounded bg-cream/60 p-3 text-center text-sm text-warmgrey">
          This return is {status}.
          {r.admin_note ? <p className="mt-1 italic">"{String(r.admin_note)}"</p> : null}
          <button type="button" className="mt-2 block w-full text-xs text-navy hover:underline" onClick={onClose}>
            Close
          </button>
        </div>
      )}
    </div>
  );
}
