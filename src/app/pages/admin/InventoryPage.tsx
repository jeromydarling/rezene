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
        help="inventory"
        description="SKU-level stock with a full movement ledger. Available = on hand − reserved."
      />
      <ReorderSuggestions />
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

// ---------- Reorder suggestions ----------
interface ReorderRow {
  productName: string;
  colorway: string;
  size: string;
  onHand: number;
  reserved: number;
  threshold: number;
  sold90: number;
  suggestedReorder: number;
}

function ReorderSuggestions() {
  const { data } = useFetch<{ suggestions: ReorderRow[] }>("/api/admin/export/reorder");
  const rows = data?.suggestions ?? [];
  const [open, setOpen] = useState(false);
  if (rows.length === 0) return null;
  return (
    <div className="admin-card mb-5 border-amber-200 bg-amber-50/60 p-4">
      <button type="button" className="flex w-full items-center justify-between" onClick={() => setOpen((v) => !v)}>
        <span className="text-sm font-semibold text-amber-800">
          {rows.length} {rows.length === 1 ? "piece needs" : "pieces need"} reordering
        </span>
        <span className="text-xs text-amber-700">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <div className="mt-3 overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Variant</th>
                <th>Available</th>
                <th>Sold (90d)</th>
                <th>Suggested reorder</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="font-medium">{r.productName}</td>
                  <td className="text-xs">{r.colorway} / {r.size}</td>
                  <td>{r.onHand - r.reserved}</td>
                  <td className="text-warmgrey">{r.sold90}</td>
                  <td className="font-medium text-navy">{r.suggestedReorder}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
