import { useState } from "react";
import { useFetch } from "../../lib/useFetch";
import { api, ApiRequestError } from "../../lib/api";
import {
  EmptyState,
  ErrorNote,
  LoadingTable,
  PageHeader,
  SlideOver,
} from "../../components/admin/ui";
import type { AdminInventoryRow } from "../../../shared/types";

const MOVEMENT_KINDS = [
  { value: "receive", label: "Receive from production" },
  { value: "adjust", label: "Manual adjustment (+/-)" },
  { value: "return", label: "Customer return" },
  { value: "damage", label: "Damage write-off" },
  { value: "reserve", label: "Reserve" },
  { value: "release", label: "Release reservation" },
];

export function InventoryPage() {
  const { data, loading, error, reload } = useFetch<AdminInventoryRow[]>(
    "/api/admin/products/inventory/all",
  );
  const [adjusting, setAdjusting] = useState<AdminInventoryRow | null>(null);
  const [kind, setKind] = useState("receive");
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submitAdjust() {
    if (!adjusting) return;
    setBusy(true);
    setFormError(null);
    try {
      await api.post("/api/admin/products/inventory/adjust", {
        inventoryItemId: adjusting.inventoryItemId,
        kind,
        quantity: parseInt(qty, 10),
        note: note || undefined,
      });
      setAdjusting(null);
      setQty("");
      setNote("");
      reload();
    } catch (err) {
      setFormError(err instanceof ApiRequestError ? err.message : "Adjustment failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Catalog"
        title="Inventory"
        description="SKU-level stock with a full movement ledger. Available = on hand − reserved."
      />
      {error && <ErrorNote message={error} />}
      {loading && <LoadingTable rows={8} />}
      {data && data.length === 0 && (
        <EmptyState title="No inventory records" hint="Inventory rows are created per variant." />
      )}
      {data && data.length > 0 && (
        <div className="admin-card overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Variant</th>
                <th>SKU</th>
                <th>On hand</th>
                <th>Reserved</th>
                <th>Available</th>
                <th>Incoming</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => {
                const available = row.onHand - row.reserved;
                return (
                  <tr key={row.inventoryItemId} className={row.isLow ? "bg-terracotta/5" : ""}>
                    <td className="font-medium">{row.productName}</td>
                    <td>
                      {row.colorwayName} / {row.size}
                    </td>
                    <td className="font-mono text-xs">{row.skuCode ?? "—"}</td>
                    <td>{row.onHand}</td>
                    <td>{row.reserved}</td>
                    <td>
                      <span className={available <= row.lowStockThreshold ? "font-semibold text-terracotta-deep" : ""}>
                        {available}
                      </span>
                      {row.isLow && <span className="badge badge-terracotta ml-2">low</span>}
                    </td>
                    <td>{row.incoming}</td>
                    <td>
                      <button
                        type="button"
                        className="link-quiet text-xs"
                        onClick={() => setAdjusting(row)}
                      >
                        Adjust
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <SlideOver
        open={Boolean(adjusting)}
        title={adjusting ? `Adjust — ${adjusting.productName} ${adjusting.colorwayName}/${adjusting.size}` : ""}
        onClose={() => setAdjusting(null)}
      >
        <div className="space-y-4">
          <div>
            <label className="label">Movement type</label>
            <select className="input" value={kind} onChange={(e) => setKind(e.target.value)}>
              {MOVEMENT_KINDS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Quantity</label>
            <input
              type="number"
              className="input"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder={kind === "adjust" ? "Signed, e.g. -2" : "e.g. 40"}
            />
          </div>
          <div>
            <label className="label">Note</label>
            <input
              className="input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="PO-2027-001 partial delivery"
            />
          </div>
          {formError && <p className="field-error">{formError}</p>}
          <button
            type="button"
            disabled={busy || !qty}
            onClick={() => void submitAdjust()}
            className="btn btn-primary w-full"
          >
            {busy ? "Recording…" : "Record movement"}
          </button>
        </div>
      </SlideOver>
    </div>
  );
}
