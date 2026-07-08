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
  const [transferRow, setTransferRow] = useState<AdminInventoryRow | null>(null);
  const [locationsOpen, setLocationsOpen] = useState(false);
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
        actions={
          <button type="button" className="btn btn-secondary" onClick={() => setLocationsOpen(true)}>
            Locations
          </button>
        }
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
                    <td className="whitespace-nowrap text-right text-xs">
                      <button type="button" className="link-quiet" onClick={() => setAdjusting(row)}>
                        Adjust
                      </button>
                      <button type="button" className="link-quiet ml-3" onClick={() => setTransferRow(row)}>
                        Transfer
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

      <SlideOver open={locationsOpen} title="Locations" onClose={() => setLocationsOpen(false)}>
        <LocationsPanel />
      </SlideOver>
      <SlideOver
        open={Boolean(transferRow)}
        title={transferRow ? `Transfer — ${transferRow.productName} ${transferRow.colorwayName}/${transferRow.size}` : ""}
        onClose={() => setTransferRow(null)}
      >
        {transferRow && (
          <TransferPanel
            variantId={transferRow.variantId}
            onDone={() => {
              setTransferRow(null);
              reload();
            }}
          />
        )}
      </SlideOver>
    </div>
  );
}

// ---------- Locations management ----------
interface LocationRow {
  id: string;
  name: string;
  kind: string;
  isDefault: number;
  units: number;
}

function LocationsPanel() {
  const { data, reload } = useFetch<{ locations: LocationRow[] }>("/api/admin/locations");
  const [name, setName] = useState("");
  const [kind, setKind] = useState("shopfront");
  const rows = data?.locations ?? [];

  async function add() {
    if (!name.trim()) return;
    await api.post("/api/admin/locations", { name: name.trim(), kind });
    setName("");
    reload();
  }
  async function remove(id: string) {
    try {
      await api.delete(`/api/admin/locations/${id}`);
      reload();
    } catch (e) {
      window.alert(e instanceof ApiRequestError ? e.message : "Couldn't remove.");
    }
  }

  return (
    <div className="space-y-4 text-sm">
      <ul className="space-y-2">
        {rows.map((l) => (
          <li key={l.id} className="flex items-center justify-between rounded border border-ink/10 px-3 py-2">
            <div>
              <p className="font-medium">
                {l.name}
                {l.isDefault ? <span className="ml-2 text-xs text-warmgrey">· default (storefront ships from here)</span> : null}
              </p>
              <p className="text-xs text-warmgrey">
                {l.kind} · {l.units} units
              </p>
            </div>
            {!l.isDefault && (
              <button type="button" className="text-xs text-terracotta hover:underline" onClick={() => void remove(l.id)}>
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>
      <div className="rounded border border-dashed border-ink/15 p-3">
        <p className="mb-2 text-xs font-medium text-warmgrey">Add a location</p>
        <input className="input mb-2 text-sm" placeholder="e.g. Marais shopfront" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="flex gap-2">
          <select className="input text-sm" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="shopfront">Shopfront</option>
            <option value="warehouse">Warehouse</option>
            <option value="studio">Studio</option>
          </select>
          <button type="button" className="btn btn-primary !py-1.5 text-sm" onClick={() => void add()}>
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Stock transfer ----------
interface StockAtLocation {
  locationId: string;
  name: string;
  isDefault: boolean;
  onHand: number;
}

function TransferPanel({ variantId, onDone }: { variantId: string; onDone: () => void }) {
  const { data, reload } = useFetch<{ stock: StockAtLocation[] }>(`/api/admin/locations/stock/${variantId}`);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [qty, setQty] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stock = data?.stock ?? [];

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/admin/locations/transfer", {
        variantId,
        fromLocationId: from,
        toLocationId: to,
        quantity: Number(qty) || 0,
      });
      setQty("");
      reload();
      onDone();
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : "Transfer failed.");
    } finally {
      setBusy(false);
    }
  }

  if (stock.length < 2)
    return <p className="text-sm text-warmgrey">Add a second location first (Inventory → Locations).</p>;

  return (
    <div className="space-y-3 text-sm">
      <div className="rounded bg-cream/60 p-3">
        <p className="mb-1 text-xs font-medium text-warmgrey">Stock by location</p>
        <ul className="space-y-0.5">
          {stock.map((s) => (
            <li key={s.locationId} className="flex justify-between">
              <span>{s.name}</span>
              <span className="font-medium">{s.onHand}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="label">From</span>
          <select className="input text-sm" value={from} onChange={(e) => setFrom(e.target.value)}>
            <option value="">Select…</option>
            {stock.map((s) => (
              <option key={s.locationId} value={s.locationId}>
                {s.name} ({s.onHand})
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">To</span>
          <select className="input text-sm" value={to} onChange={(e) => setTo(e.target.value)}>
            <option value="">Select…</option>
            {stock.map((s) => (
              <option key={s.locationId} value={s.locationId}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block">
        <span className="label">Units to move</span>
        <input className="input text-sm" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} />
      </label>
      {error && <p className="field-error">{error}</p>}
      <button type="button" className="btn btn-primary w-full" disabled={busy} onClick={() => void submit()}>
        {busy ? "Moving…" : "Transfer stock"}
      </button>
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
