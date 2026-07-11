import { useState } from "react";
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
import { GeoTextMap } from "../../components/MapboxMap";
import { getShop } from "../../lib/shop";
import { emitToast } from "../../lib/toast";
import type { AdminSupplier, AdminSupplierInteraction } from "../../../shared/types";

interface SupplierDetail extends AdminSupplier {
  interactions: AdminSupplierInteraction[];
  samples: { id: string; round: number; kind: string; status: string; style_name: string }[];
  productionOrders: {
    id: string;
    po_number: string;
    status: string;
    currency: string;
    total_cost_cents: number | null;
    ex_factory_date: string | null;
  }[];
}

export function SuppliersPage() {
  const { data, loading, error, reload } = useFetch<AdminSupplier[]>("/api/admin/suppliers");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div>
      <PageHeader
        eyebrow="Production"
        title="Factories & Suppliers"
        help="suppliers"
        description="Your maker network. Leads marked 'unverified' are LLM-researched — confirm details before committing production."
        actions={
          <>
            <button
              type="button"
              className="btn"
              title="Copy an invitation link — your makers join the founding list for the Verto maker workspace"
              onClick={() => {
                const slug = getShop()?.slug ?? "verto";
                void navigator.clipboard
                  .writeText(`https://verto.style/makers?from=${encodeURIComponent(slug)}`)
                  .then(() => emitToast({ kind: "success", message: "Invitation link copied — send it to your makers." }));
              }}
            >
              Invite your makers
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
              + New supplier
            </button>
          </>
        }
      />
      <ExportIntelPanel suppliers={data ?? []} />
      {error && <ErrorNote message={error} />}
      {loading && <LoadingTable />}
      {data && data.length === 0 && (
        <EmptyState title="No suppliers" hint="Add the ateliers you're courting." />
      )}
      {data && data.length > 0 && (
        <div className="admin-card overflow-x-auto">
          <GeoTextMap
            className="mb-4 h-72"
            points={data
              .filter((sup) => sup.city || sup.country)
              .map((sup) => ({
                id: sup.id,
                query: [sup.city, sup.country].filter(Boolean).join(", "),
                label: sup.name,
                sublabel: [titleCase(sup.kind), [sup.city, sup.country].filter(Boolean).join(", ")]
                  .filter(Boolean)
                  .join(" · "),
                color: sup.isVerified ? "#4a7c59" : "#8b8578",
              }))}
          />
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Kind</th>
                <th>Location</th>
                <th>Capabilities</th>
                <th>MOQ</th>
                <th>Lead time</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.map((s) => (
                <tr key={s.id}>
                  <td className="font-medium">{s.name}</td>
                  <td>{titleCase(s.kind)}</td>
                  <td>
                    {[s.city, s.country].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td className="max-w-xs">
                    <div className="flex flex-wrap gap-1">
                      {s.capabilities.slice(0, 3).map((cap) => (
                        <span key={cap} className="badge badge-neutral">
                          {titleCase(cap)}
                        </span>
                      ))}
                      {s.capabilities.length > 3 && (
                        <span className="text-xs text-warmgrey">+{s.capabilities.length - 3}</span>
                      )}
                    </div>
                  </td>
                  <td>{s.moqUnits ?? "—"}</td>
                  <td>{s.leadTimeDays ? `${s.leadTimeDays}d` : "—"}</td>
                  <td>
                    <span className={`badge ${s.isVerified ? "badge-success" : "badge-saffron"}`}>
                      {s.isVerified ? "verified" : "unverified"}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="link-quiet text-xs"
                      onClick={() => setSelectedId(s.id)}
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <SlideOver
        open={Boolean(selectedId)}
        title="Supplier profile"
        onClose={() => setSelectedId(null)}
      >
        {selectedId && (
          <SupplierDetailPanel
            id={selectedId}
            onChanged={reload}
            onDeleted={() => {
              setSelectedId(null);
              reload();
            }}
          />
        )}
      </SlideOver>
      <SlideOver open={creating} title="New supplier" onClose={() => setCreating(false)}>
        <SupplierForm
          onSaved={() => {
            setCreating(false);
            reload();
          }}
          onCancel={() => setCreating(false)}
        />
      </SlideOver>
    </div>
  );
}

function SupplierDetailPanel({
  id,
  onChanged,
  onDeleted,
}: {
  id: string;
  onChanged?: () => void;
  onDeleted?: () => void;
}) {
  const { data, loading, error, reload } = useFetch<SupplierDetail>(`/api/admin/suppliers/${id}`);
  const [verifying, setVerifying] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function toggleVerified() {
    if (!data) return;
    setVerifying(true);
    try {
      await api.patch(`/api/admin/suppliers/${id}`, { isVerified: !data.isVerified });
      reload();
      onChanged?.();
    } finally {
      setVerifying(false);
    }
  }

  async function remove() {
    if (!data) return;
    if (
      !window.confirm(
        `Remove ${data.name}? This deletes the profile and its interaction log. Suppliers with production orders are kept.`,
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      await api.delete(`/api/admin/suppliers/${id}`);
      onDeleted?.();
    } catch (err) {
      window.alert(err instanceof ApiRequestError ? err.message : "Couldn't remove this supplier.");
    } finally {
      setDeleting(false);
    }
  }

  const [log, setLog] = useState({ kind: "email", subject: "", summary: "", needsResponse: false });
  const [logError, setLogError] = useState<string | null>(null);

  async function submitLog() {
    setLogError(null);
    try {
      await api.post(`/api/admin/suppliers/${id}/interactions`, {
        kind: log.kind,
        direction: "outbound",
        subject: log.subject || undefined,
        summary: log.summary || undefined,
        needsResponse: log.needsResponse,
      });
      setLogOpen(false);
      setLog({ kind: "email", subject: "", summary: "", needsResponse: false });
      reload();
    } catch (err) {
      setLogError(err instanceof ApiRequestError ? err.message : "Failed to log interaction");
    }
  }

  if (loading) return <LoadingTable rows={4} />;
  if (error) return <ErrorNote message={error} />;
  if (!data) return null;

  if (editing) {
    return (
      <SupplierForm
        supplier={data}
        onSaved={() => {
          setEditing(false);
          reload();
          onChanged?.();
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  const mapHref =
    data.mapUrl ||
    (data.address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${data.name} ${data.address}`)}`
      : null);

  return (
    <div className="space-y-6 text-sm">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-xl font-light">{data.name}</h3>
            <p className="text-warmgrey">
              {[data.city, data.country].filter(Boolean).join(", ")} · {titleCase(data.kind)}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <button
              type="button"
              className={`rounded-full border px-3 py-1 text-xs transition ${
                data.isVerified
                  ? "border-palm/40 bg-palm/10 text-palm hover:bg-palm/20"
                  : "border-navy bg-navy text-chalk hover:bg-navy/90"
              }`}
              disabled={verifying}
              onClick={() => void toggleVerified()}
            >
              {verifying ? "Saving…" : data.isVerified ? "✓ Verified — undo" : "Mark verified"}
            </button>
            <div className="flex gap-3 text-xs">
              <button type="button" className="link-quiet" onClick={() => setEditing(true)}>
                Edit
              </button>
              <button
                type="button"
                className="text-terracotta hover:underline disabled:opacity-50"
                disabled={deleting}
                onClick={() => void remove()}
              >
                {deleting ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        </div>
        {!data.isVerified && (
          <p className="mt-2 rounded bg-saffron/15 px-3 py-2 text-xs text-bark">
            Research/demo lead — verify capabilities, MOQ, and terms, then mark it verified.
          </p>
        )}
      </div>

      {(data.address || data.email || data.phone || data.whatsapp || data.website) && (
        <div className="space-y-1.5 rounded-lg border border-ink/8 p-3">
          <h4 className="text-[0.68rem] font-semibold uppercase tracking-wider text-warmgrey">Contact</h4>
          {data.address && (
            <p className="text-ink/85">
              {data.address}
              {mapHref && (
                <>
                  {" "}
                  <a href={mapHref} target="_blank" rel="noreferrer" className="text-navy hover:underline">
                    map ↗
                  </a>
                </>
              )}
            </p>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {data.phone && (
              <a href={`tel:${data.phone.replace(/[^+\d]/g, "")}`} className="text-navy hover:underline">
                📞 {data.phone}
              </a>
            )}
            {data.whatsapp && (
              <a
                href={`https://wa.me/${data.whatsapp.replace(/[^\d]/g, "")}`}
                target="_blank"
                rel="noreferrer"
                className="text-navy hover:underline"
              >
                WhatsApp {data.whatsapp}
              </a>
            )}
            {data.email && (
              <a href={`mailto:${data.email}`} className="text-navy hover:underline">
                ✉ {data.email}
              </a>
            )}
            {data.website && (
              <a
                href={data.website.startsWith("http") ? data.website : `https://${data.website}`}
                target="_blank"
                rel="noreferrer"
                className="text-navy hover:underline"
              >
                {data.website.replace(/^https?:\/\//, "")} ↗
              </a>
            )}
          </div>
        </div>
      )}

      <dl className="grid grid-cols-2 gap-3">
        {[
          ["MOQ", data.moqUnits ? `${data.moqUnits} units` : null],
          ["Lead time", data.leadTimeDays ? `${data.leadTimeDays} days` : null],
          ["Languages", data.languages.join(", ") || null],
          ["Capabilities", data.capabilities.map(titleCase).join(", ") || null],
          ["On-time score", data.onTimeScore?.toFixed(1) ?? null],
          ["Quality score", data.qualityScore?.toFixed(1) ?? null],
        ]
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k as string}>
              <dt className="text-[0.68rem] font-semibold uppercase tracking-wider text-warmgrey">
                {k}
              </dt>
              <dd>{v}</dd>
            </div>
          ))}
      </dl>

      {data.notes && <p className="rounded bg-cream p-3 text-xs leading-relaxed">{data.notes}</p>}

      {data.contacts.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-warmgrey">
            Contacts
          </h4>
          <ul className="space-y-1.5">
            {data.contacts.map((ct) => (
              <li key={ct.id}>
                <span className="font-medium">{ct.name}</span>
                {ct.role && <span className="text-warmgrey"> · {ct.role}</span>}
                {ct.email && <span className="block text-xs text-warmgrey">{ct.email}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-warmgrey">
            Interaction log
          </h4>
          <button type="button" className="link-quiet text-xs" onClick={() => setLogOpen(!logOpen)}>
            {logOpen ? "Cancel" : "Log interaction"}
          </button>
        </div>
        {logOpen && (
          <div className="mb-3 space-y-2 rounded border border-ink/10 p-3">
            <select
              className="input"
              value={log.kind}
              onChange={(e) => setLog({ ...log, kind: e.target.value })}
            >
              {["email", "call", "whatsapp", "visit", "quote", "sample_feedback", "other"].map(
                (k) => (
                  <option key={k} value={k}>
                    {titleCase(k)}
                  </option>
                ),
              )}
            </select>
            <input
              className="input"
              placeholder="Subject"
              value={log.subject}
              onChange={(e) => setLog({ ...log, subject: e.target.value })}
            />
            <textarea
              className="input"
              rows={3}
              placeholder="Summary"
              value={log.summary}
              onChange={(e) => setLog({ ...log, summary: e.target.value })}
            />
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={log.needsResponse}
                onChange={(e) => setLog({ ...log, needsResponse: e.target.checked })}
              />
              Awaiting their response
            </label>
            {logError && <p className="field-error">{logError}</p>}
            <button type="button" className="btn btn-primary w-full" onClick={() => void submitLog()}>
              Save
            </button>
          </div>
        )}
        {data.interactions.length === 0 ? (
          <p className="text-xs text-warmgrey">No interactions logged.</p>
        ) : (
          <ul className="space-y-2">
            {data.interactions.map((it) => (
              <li key={it.id} className="rounded border border-ink/8 p-2.5">
                <div className="flex items-center justify-between">
                  <span className="badge badge-neutral">{titleCase(it.kind)}</span>
                  <span className="text-xs text-warmgrey">{formatDate(it.createdAt)}</span>
                </div>
                {it.subject && <p className="mt-1 font-medium">{it.subject}</p>}
                {it.summary && <p className="text-xs text-ink/70">{it.summary}</p>}
                {it.needsResponse && (
                  <span className="badge badge-terracotta mt-1">awaiting response</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {data.productionOrders.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-warmgrey">
            Production orders
          </h4>
          <ul className="space-y-1.5">
            {data.productionOrders.map((po) => (
              <li key={po.id} className="flex items-center justify-between">
                <span className="font-mono text-xs">{po.po_number}</span>
                <span className="text-xs">
                  {po.total_cost_cents ? formatMoney(po.total_cost_cents, po.currency) : "—"}
                </span>
                <StatusBadge status={po.status} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---------- Create / edit form ----------
const SUPPLIER_KINDS = ["factory", "fabric_mill", "trim_supplier", "service", "logistics"] as const;

function SupplierForm({
  supplier,
  onSaved,
  onCancel,
}: {
  supplier?: AdminSupplier;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    name: supplier?.name ?? "",
    kind: supplier?.kind ?? "factory",
    city: supplier?.city ?? "",
    country: supplier?.country ?? "",
    address: supplier?.address ?? "",
    phone: supplier?.phone ?? "",
    whatsapp: supplier?.whatsapp ?? "",
    email: supplier?.email ?? "",
    website: supplier?.website ?? "",
    moqUnits: supplier?.moqUnits != null ? String(supplier.moqUnits) : "",
    leadTimeDays: supplier?.leadTimeDays != null ? String(supplier.leadTimeDays) : "",
    capabilities: (supplier?.capabilities ?? []).join(", "),
    languages: (supplier?.languages ?? []).join(", "),
    notes: supplier?.notes ?? "",
    isVerified: supplier?.isVerified ?? false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const toList = (s: string) =>
    s
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

  async function save() {
    if (!form.name.trim()) {
      setError("A name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      name: form.name.trim(),
      kind: form.kind,
      city: form.city.trim() || undefined,
      country: form.country.trim() || undefined,
      address: form.address.trim() || undefined,
      phone: form.phone.trim() || undefined,
      whatsapp: form.whatsapp.trim() || undefined,
      email: form.email.trim() || "",
      website: form.website.trim() || undefined,
      moqUnits: form.moqUnits.trim() ? Number(form.moqUnits) : null,
      leadTimeDays: form.leadTimeDays.trim() ? Number(form.leadTimeDays) : null,
      capabilities: toList(form.capabilities),
      languages: toList(form.languages),
      notes: form.notes.trim() || undefined,
      isVerified: form.isVerified,
    };
    try {
      if (supplier) await api.patch(`/api/admin/suppliers/${supplier.id}`, payload);
      else await api.post("/api/admin/suppliers", payload);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn't save this supplier.");
    } finally {
      setSaving(false);
    }
  }

  const input = "input";
  return (
    <div className="space-y-3 text-sm">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-warmgrey">Name *</span>
        <input className={input} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Atelier name" />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-warmgrey">Kind</span>
        <select className={input} value={form.kind} onChange={(e) => set("kind", e.target.value)}>
          {SUPPLIER_KINDS.map((k) => (
            <option key={k} value={k}>
              {titleCase(k)}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-warmgrey">City</span>
          <input className={input} value={form.city} onChange={(e) => set("city", e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-warmgrey">Country</span>
          <input className={input} value={form.country} onChange={(e) => set("country", e.target.value)} />
        </label>
      </div>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-warmgrey">Street address</span>
        <input className={input} value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Full postal address" />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-warmgrey">Phone</span>
          <input className={input} value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+212 …" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-warmgrey">WhatsApp</span>
          <input className={input} value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-warmgrey">Email</span>
          <input className={input} value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="hello@…" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-warmgrey">Website</span>
          <input className={input} value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="example.com" />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-warmgrey">MOQ (units)</span>
          <input className={input} inputMode="numeric" value={form.moqUnits} onChange={(e) => set("moqUnits", e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-warmgrey">Lead time (days)</span>
          <input className={input} inputMode="numeric" value={form.leadTimeDays} onChange={(e) => set("leadTimeDays", e.target.value)} />
        </label>
      </div>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-warmgrey">Capabilities</span>
        <input className={input} value={form.capabilities} onChange={(e) => set("capabilities", e.target.value)} placeholder="tailoring, small_batch, knitwear (comma-separated)" />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-warmgrey">Languages</span>
        <input className={input} value={form.languages} onChange={(e) => set("languages", e.target.value)} placeholder="fr, ar, en (comma-separated)" />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-warmgrey">Notes</span>
        <textarea className={input} rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
      </label>
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={form.isVerified} onChange={(e) => set("isVerified", e.target.checked)} />
        Mark as a verified maker (you've confirmed capabilities & terms)
      </label>
      {error && <p className="field-error">{error}</p>}
      <div className="flex gap-2 pt-1">
        <button type="button" className="btn btn-primary flex-1" disabled={saving} onClick={() => void save()}>
          {saving ? "Saving…" : supplier ? "Save changes" : "Add supplier"}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ---------- Live export intelligence (Perplexity) ----------
interface ExportIntel {
  enabled: boolean;
  cached?: boolean;
  error?: string;
  origin?: string;
  destination?: string;
  sections?: {
    agreement?: string;
    duties?: string;
    documents?: string[];
    gotchas?: string[];
    freight?: string;
    leadTime?: string;
    asOf?: string;
  };
  raw?: string | null;
  citations?: string[];
}

function ExportIntelPanel({ suppliers }: { suppliers: AdminSupplier[] }) {
  const defaultOrigin =
    suppliers.map((s) => s.country).find(Boolean) === "MA" ? "Morocco" : suppliers.map((s) => s.country).find(Boolean) || "Morocco";
  const [open, setOpen] = useState(false);
  const [origin, setOrigin] = useState(defaultOrigin);
  const [destination, setDestination] = useState("United States");
  const [data, setData] = useState<ExportIntel | null>(null);
  const [busy, setBusy] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  async function load(refresh = false) {
    setBusy(true);
    try {
      const res = await api.get<ExportIntel>(
        `/api/admin/sourcing/export-intel?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}${refresh ? "&refresh=1" : ""}`,
      );
      if (!res.enabled) setUnavailable(true);
      else setData(res);
    } catch {
      setData({ enabled: true, error: "Couldn't fetch export intel right now." });
    } finally {
      setBusy(false);
    }
  }

  const s = data?.sections;
  return (
    <div className="admin-card mb-5 overflow-hidden p-0">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-cream"
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next && !data && !unavailable) void load();
        }}
      >
        <span>
          <span className="block text-[0.6rem] font-semibold uppercase tracking-wider text-warmgrey">Export intelligence</span>
          <span className="text-sm font-medium">
            {origin} → {destination}{" "}
            <span className="text-xs font-normal text-warmgrey">· duties, docs & gotchas, live</span>
          </span>
        </span>
        <span className="text-warmgrey">{open ? "–" : "+"}</span>
      </button>

      {open && (
        <div className="space-y-3 border-t border-ink/10 px-4 py-3">
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-warmgrey">
              <span className="mb-0.5 block">From</span>
              <input className="input !py-1.5 text-sm" value={origin} onChange={(e) => setOrigin(e.target.value)} />
            </label>
            <label className="text-xs text-warmgrey">
              <span className="mb-0.5 block">To</span>
              <input className="input !py-1.5 text-sm" value={destination} onChange={(e) => setDestination(e.target.value)} />
            </label>
            <button type="button" className="btn btn-secondary !py-1.5 text-xs" disabled={busy} onClick={() => void load()}>
              {busy ? "Researching…" : "Check lane"}
            </button>
            {data && !data.error && (
              <button type="button" className="link-quiet text-xs" disabled={busy} onClick={() => void load(true)}>
                Refresh
              </button>
            )}
          </div>

          {unavailable && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Export intelligence isn’t switched on yet (needs the research key). The live-duty features light up once it’s set.
            </p>
          )}
          {busy && !data && <p className="text-xs text-warmgrey">Researching current trade conditions for this lane…</p>}
          {data?.error && <p className="field-error">{data.error}</p>}

          {data && !data.error && (s || data.raw) && (
            <div className="space-y-2 text-sm">
              {s?.agreement && <IntelRow label="Trade agreement" value={s.agreement} />}
              {s?.duties && <IntelRow label="Duties & tariffs" value={s.duties} />}
              {s?.freight && <IntelRow label="Freight & transit" value={s.freight} />}
              {s?.leadTime && <IntelRow label="Lead time" value={s.leadTime} />}
              {s?.documents && s.documents.length > 0 && <IntelList label="Documents" items={s.documents} />}
              {s?.gotchas && s.gotchas.length > 0 && <IntelList label="Gotchas" items={s.gotchas} tone="warn" />}
              {data.raw && <p className="whitespace-pre-wrap text-ink/80">{data.raw}</p>}
              <div className="flex items-center justify-between pt-1 text-[11px] text-warmgrey">
                <span>{s?.asOf ? `As of ${s.asOf}` : "Current"} {data.cached ? "· cached" : "· fresh"}</span>
                {data.citations && data.citations.length > 0 && (
                  <span>{data.citations.length} sources</span>
                )}
              </div>
              {data.citations && data.citations.length > 0 && (
                <details className="text-[11px] text-warmgrey">
                  <summary className="cursor-pointer">Sources</summary>
                  <ul className="mt-1 space-y-0.5">
                    {data.citations.slice(0, 12).map((c, i) => (
                      <li key={i}>
                        <a href={c} target="_blank" rel="noreferrer" className="text-navy hover:underline">
                          {c}
                        </a>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              <p className="text-[11px] text-warmgrey">LLM-researched — sanity-check duty rates against an official source before you commit.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function IntelRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-navy/[0.03] px-3 py-2">
      <p className="text-[0.6rem] font-semibold uppercase tracking-wider text-warmgrey">{label}</p>
      <p className="mt-0.5 text-ink/85">{value}</p>
    </div>
  );
}

function IntelList({ label, items, tone }: { label: string; items: string[]; tone?: "warn" }) {
  return (
    <div className={`rounded-md px-3 py-2 ${tone === "warn" ? "bg-amber-50" : "bg-navy/[0.03]"}`}>
      <p className={`text-[0.6rem] font-semibold uppercase tracking-wider ${tone === "warn" ? "text-amber-800" : "text-warmgrey"}`}>{label}</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-ink/85">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}
