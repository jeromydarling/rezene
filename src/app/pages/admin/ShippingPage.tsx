import { useMemo, useState, type FormEvent } from "react";
import { useFetch } from "../../lib/useFetch";
import { api, ApiRequestError } from "../../lib/api";
import { formatMoney } from "../../lib/format";
import {
  EmptyState,
  ErrorNote,
  LoadingTable,
  PageHeader,
  SlideOver,
} from "../../components/admin/ui";
import type {
  ShippingProviderSummary,
  ShippingQuote,
  ShippingRateRow,
  ShippingSettings,
  ShippingZoneRow,
} from "../../../shared/types";

export function ShippingPage() {
  const { data, loading, error, reload } = useFetch<ShippingSettings>("/api/admin/shipping");
  const [configuring, setConfiguring] = useState<ShippingProviderSummary | null>(null);

  return (
    <div>
      <PageHeader
        eyebrow="Commerce"
        title="Shipping"
        description="Connect the carriers you already use — or run on the built-in rate table. Enabled providers quote live rates at checkout; connected carriers also buy labels and push tracking updates back to your orders."
      />
      {error && <ErrorNote message={error} />}
      {loading && <LoadingTable />}
      {data && (
        <>
          <OriginCard settings={data} onSaved={reload} />
          <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wider text-warmgrey">
            Providers
          </h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.providers.map((p) => (
              <ProviderCard key={p.provider} provider={p} onConfigure={() => setConfiguring(p)} />
            ))}
          </div>
          <ManualRatesSection />
          <SlideOver
            open={configuring !== null}
            title={configuring?.name ?? ""}
            onClose={() => setConfiguring(null)}
          >
            {configuring && (
              <ProviderConfigForm
                provider={configuring}
                onSaved={() => {
                  setConfiguring(null);
                  reload();
                }}
              />
            )}
          </SlideOver>
        </>
      )}
    </div>
  );
}

// ---------- Origin address + parcel defaults ----------

function OriginCard({ settings, onSaved }: { settings: ShippingSettings; onSaved: () => void }) {
  const [form, setForm] = useState({
    line1: settings.origin.line1 ?? "",
    city: settings.origin.city ?? "",
    postalCode: settings.origin.postalCode ?? "",
    country: settings.origin.country ?? "MA",
    phone: settings.origin.phone ?? "",
    lengthCm: String(settings.parcel.lengthCm),
    widthCm: String(settings.parcel.widthCm),
    heightCm: String(settings.parcel.heightCm),
    weightKg: String(settings.parcel.weightKg),
    perItemWeightKg: String(settings.perItemWeightKg),
  });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNote(null);
    try {
      await api.put("/api/admin/shipping/origin", {
        origin: {
          line1: form.line1 || undefined,
          city: form.city || undefined,
          postalCode: form.postalCode || undefined,
          country: form.country.toUpperCase(),
          phone: form.phone || undefined,
        },
        parcel: {
          lengthCm: parseFloat(form.lengthCm),
          widthCm: parseFloat(form.widthCm),
          heightCm: parseFloat(form.heightCm),
          weightKg: parseFloat(form.weightKg),
        },
        perItemWeightKg: parseFloat(form.perItemWeightKg),
      });
      setNote("Saved");
      onSaved();
    } catch (err) {
      setNote(err instanceof ApiRequestError ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [key]: e.target.value });

  return (
    <form onSubmit={save} className="admin-card p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <div>
          <p className="font-display text-lg font-light">Ship-from & default parcel</p>
          <p className="text-xs text-warmgrey">
            Carriers quote from this address; the parcel is your typical box, with extra weight added
            per unit in the cart.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {note && <span className="text-xs text-warmgrey">{note}</span>}
          <button type="submit" disabled={busy} className="btn btn-primary">
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-5">
        <div className="md:col-span-2">
          <label className="label">Street address</label>
          <input className="input" value={form.line1} onChange={set("line1")} />
        </div>
        <div>
          <label className="label">City</label>
          <input className="input" value={form.city} onChange={set("city")} />
        </div>
        <div>
          <label className="label">Postal code</label>
          <input className="input" value={form.postalCode} onChange={set("postalCode")} />
        </div>
        <div>
          <label className="label">Country (ISO-2)</label>
          <input className="input uppercase" maxLength={2} value={form.country} onChange={set("country")} />
        </div>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-6">
        <div>
          <label className="label">Phone</label>
          <input className="input" value={form.phone} onChange={set("phone")} />
        </div>
        <div>
          <label className="label">Length (cm)</label>
          <input className="input" type="number" step="0.1" min="1" value={form.lengthCm} onChange={set("lengthCm")} />
        </div>
        <div>
          <label className="label">Width (cm)</label>
          <input className="input" type="number" step="0.1" min="1" value={form.widthCm} onChange={set("widthCm")} />
        </div>
        <div>
          <label className="label">Height (cm)</label>
          <input className="input" type="number" step="0.1" min="1" value={form.heightCm} onChange={set("heightCm")} />
        </div>
        <div>
          <label className="label">Base weight (kg)</label>
          <input className="input" type="number" step="0.05" min="0.05" value={form.weightKg} onChange={set("weightKg")} />
        </div>
        <div>
          <label className="label">+ per item (kg)</label>
          <input className="input" type="number" step="0.05" min="0.05" value={form.perItemWeightKg} onChange={set("perItemWeightKg")} />
        </div>
      </div>
    </form>
  );
}

// ---------- Provider cards ----------

function ProviderCard({
  provider,
  onConfigure,
}: {
  provider: ShippingProviderSummary;
  onConfigure: () => void;
}) {
  const anyCredentialMissing = provider.credentialFields.some(
    (f) => !f.label.includes("optional") && !provider.credentialsSet[f.key],
  );
  const state = provider.isEnabled
    ? provider.lastVerifyError
      ? { label: "check failed", tone: "badge-danger" }
      : { label: provider.useAtCheckout ? "live at checkout" : "enabled", tone: "badge-success" }
    : anyCredentialMissing && provider.credentialFields.length > 0
      ? { label: "not connected", tone: "badge-neutral" }
      : { label: "off", tone: "badge-neutral" };

  return (
    <div className="admin-card flex flex-col p-5">
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="font-display text-lg font-light">{provider.name}</p>
        <span className={`badge ${state.tone}`}>{state.label}</span>
      </div>
      <p className="text-xs text-warmgrey">{provider.blurb}</p>
      <p className="mt-2 text-xs text-warmgrey">
        <span className="font-semibold text-ink/70">Best for:</span> {provider.bestFor}
      </p>
      <div className="mt-3 flex flex-wrap gap-1">
        {provider.capabilities.map((cap) => (
          <span key={cap} className="badge badge-navy">
            {cap}
          </span>
        ))}
      </div>
      {provider.lastVerifyError && (
        <p className="mt-3 rounded bg-red-50 px-2 py-1.5 text-xs text-red-800">
          {provider.lastVerifyError}
        </p>
      )}
      <div className="mt-auto flex items-center justify-between pt-4">
        {provider.docsUrl ? (
          <a
            href={provider.docsUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-warmgrey underline hover:text-ink"
          >
            API docs
          </a>
        ) : (
          <span className="text-xs text-warmgrey">Built in — no account needed</span>
        )}
        <button type="button" className="btn btn-secondary" onClick={onConfigure}>
          {provider.isEnabled || !anyCredentialMissing ? "Configure" : "Connect"}
        </button>
      </div>
    </div>
  );
}

function ProviderConfigForm({
  provider,
  onSaved,
}: {
  provider: ShippingProviderSummary;
  onSaved: () => void;
}) {
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [config, setConfig] = useState<Record<string, string | boolean>>(
    Object.fromEntries(
      provider.configFields.map((f) => [
        f.key,
        f.kind === "boolean"
          ? Boolean(provider.config[f.key])
          : String(provider.config[f.key] ?? ""),
      ]),
    ),
  );
  const [isEnabled, setIsEnabled] = useState(provider.isEnabled);
  const [useAtCheckout, setUseAtCheckout] = useState(provider.useAtCheckout);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string; quotes?: ShippingQuote[] } | null>(null);

  async function save(alsoTest: boolean) {
    setBusy(true);
    setError(null);
    setTestResult(null);
    try {
      await api.put(`/api/admin/shipping/providers/${provider.provider}`, {
        // Only send fields the admin actually typed; blanks keep stored values.
        credentials: Object.fromEntries(Object.entries(credentials).filter(([, v]) => v !== "")),
        config,
        isEnabled,
        useAtCheckout,
      });
      if (alsoTest) {
        try {
          const res = await api.post<{ ok: boolean; quotes?: ShippingQuote[] }>(
            `/api/admin/shipping/providers/${provider.provider}/test`,
            { country: "US" },
          );
          setTestResult({ ok: true, message: "Connected — sample rates below", quotes: res.quotes });
        } catch (err) {
          setTestResult({
            ok: false,
            message: err instanceof ApiRequestError ? err.message : "Connection test failed",
          });
        }
      } else {
        onSaved();
      }
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {provider.credentialFields.map((f) => (
        <div key={f.key}>
          <label className="label">{f.label}</label>
          <input
            className="input"
            type={f.secret ? "password" : "text"}
            placeholder={
              provider.credentialsSet[f.key] ? "•••••• saved — type to replace" : (f.placeholder ?? "")
            }
            value={credentials[f.key] ?? ""}
            onChange={(e) => setCredentials({ ...credentials, [f.key]: e.target.value })}
            autoComplete="off"
          />
        </div>
      ))}
      {provider.configFields.map((f) =>
        f.kind === "boolean" ? (
          <label key={f.key} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(config[f.key])}
              onChange={(e) => setConfig({ ...config, [f.key]: e.target.checked })}
            />
            {f.label}
            {f.hint && <span className="text-xs text-warmgrey">— {f.hint}</span>}
          </label>
        ) : (
          <div key={f.key}>
            <label className="label">{f.label}</label>
            <input
              className="input"
              value={String(config[f.key] ?? "")}
              onChange={(e) => setConfig({ ...config, [f.key]: e.target.value })}
            />
            {f.hint && <p className="mt-1 text-xs text-warmgrey">{f.hint}</p>}
          </div>
        ),
      )}
      <div className="space-y-2 border-t border-ink/10 pt-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isEnabled} onChange={(e) => setIsEnabled(e.target.checked)} />
          Enabled — available for fulfillment on orders
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={useAtCheckout}
            onChange={(e) => setUseAtCheckout(e.target.checked)}
          />
          Quote live rates to buyers at checkout
        </label>
      </div>
      {provider.supportsWebhooks && provider.webhookPath && (
        <div className="rounded bg-cream px-3 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-warmgrey">
            Tracking webhook URL
          </p>
          <p className="mt-1 break-all font-mono text-[0.7rem]">
            {window.location.origin}
            {provider.webhookPath}
          </p>
          <p className="mt-1 text-xs text-warmgrey">
            Paste this into the provider's dashboard to stream tracking updates onto your orders.
          </p>
        </div>
      )}
      {error && <p className="field-error">{error}</p>}
      {testResult && (
        <div
          className={`rounded px-3 py-2.5 text-sm ${testResult.ok ? "bg-palm/10 text-palm" : "bg-red-50 text-red-800"}`}
        >
          <p>{testResult.message}</p>
          {testResult.quotes && testResult.quotes.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-ink/80">
              {testResult.quotes.map((q, i) => (
                <li key={i}>
                  {q.carrier} — {q.service}: {formatMoney(q.amountCents, q.currency)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          className="btn btn-secondary flex-1"
          onClick={() => void save(true)}
        >
          {busy ? "Working…" : "Save & test"}
        </button>
        <button
          type="button"
          disabled={busy}
          className="btn btn-primary flex-1"
          onClick={() => void save(false)}
        >
          {busy ? "Working…" : "Save"}
        </button>
      </div>
    </div>
  );
}

// ---------- Manual zones & rates ----------

function ManualRatesSection() {
  const { data, loading, error, reload } = useFetch<{
    zones: ShippingZoneRow[];
    rates: ShippingRateRow[];
  }>("/api/admin/shipping/zones");
  const [addZoneOpen, setAddZoneOpen] = useState(false);

  const ratesByZone = useMemo(() => {
    const map = new Map<string, ShippingRateRow[]>();
    for (const rate of data?.rates ?? []) {
      map.set(rate.zone_id, [...(map.get(rate.zone_id) ?? []), rate]);
    }
    return map;
  }, [data]);

  return (
    <div className="mt-10">
      <div className="mb-3 flex items-end justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-warmgrey">
            Manual rate table
          </h2>
          <p className="text-xs text-warmgrey">
            Used by the “Manual rate table” provider — flat rates per destination zone. A zone with
            no countries catches the rest of the world.
          </p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => setAddZoneOpen(true)}>
          Add zone
        </button>
      </div>
      {error && <ErrorNote message={error} />}
      {loading && <LoadingTable rows={3} />}
      {data && data.zones.length === 0 && (
        <EmptyState title="No zones" hint="Add a destination zone to start charging flat rates." />
      )}
      <div className="space-y-4">
        {data?.zones.map((zone) => (
          <ZoneCard
            key={zone.id}
            zone={zone}
            rates={ratesByZone.get(zone.id) ?? []}
            onChanged={reload}
          />
        ))}
      </div>
      <SlideOver open={addZoneOpen} title="New shipping zone" onClose={() => setAddZoneOpen(false)}>
        <ZoneForm
          onSaved={() => {
            setAddZoneOpen(false);
            reload();
          }}
        />
      </SlideOver>
    </div>
  );
}

function ZoneCard({
  zone,
  rates,
  onChanged,
}: {
  zone: ShippingZoneRow;
  rates: ShippingRateRow[];
  onChanged: () => void;
}) {
  const countries: string[] = (() => {
    try {
      return JSON.parse(zone.countries_json) as string[];
    } catch {
      return [];
    }
  })();
  const [addingRate, setAddingRate] = useState(false);

  async function removeZone() {
    if (!window.confirm(`Delete zone “${zone.name}” and its rates?`)) return;
    await api.delete(`/api/admin/shipping/zones/${zone.id}`);
    onChanged();
  }
  async function removeRate(id: string) {
    await api.delete(`/api/admin/shipping/rates/${id}`);
    onChanged();
  }

  return (
    <div className="admin-card p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-lg font-light">{zone.name}</p>
          <p className="text-xs text-warmgrey">
            {countries.length > 0 ? countries.join(", ") : "Rest of world (catch-all)"}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn btn-secondary" onClick={() => setAddingRate(true)}>
            Add rate
          </button>
          <button
            type="button"
            className="text-xs text-warmgrey underline hover:text-red-700"
            onClick={() => void removeZone()}
          >
            Delete
          </button>
        </div>
      </div>
      {rates.length > 0 && (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Rate</th>
              <th>Price</th>
              <th>Free over</th>
              <th>Transit</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rates.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>{formatMoney(r.amount_cents, r.currency)}</td>
                <td>{r.free_over_cents != null ? formatMoney(r.free_over_cents, r.currency) : "—"}</td>
                <td className="text-xs text-warmgrey">
                  {r.min_transit_days != null || r.max_transit_days != null
                    ? `${r.min_transit_days ?? "?"}–${r.max_transit_days ?? "?"} days`
                    : "—"}
                </td>
                <td className="text-right">
                  <button
                    type="button"
                    className="text-xs text-warmgrey underline hover:text-red-700"
                    onClick={() => void removeRate(r.id)}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <SlideOver open={addingRate} title={`New rate — ${zone.name}`} onClose={() => setAddingRate(false)}>
        <RateForm
          zoneId={zone.id}
          onSaved={() => {
            setAddingRate(false);
            onChanged();
          }}
        />
      </SlideOver>
    </div>
  );
}

function ZoneForm({ onSaved }: { onSaved: () => void }) {
  const [name, setName] = useState("");
  const [countries, setCountries] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/admin/shipping/zones", {
        name,
        countries: countries
          .split(/[,\s]+/)
          .map((s) => s.trim().toUpperCase())
          .filter((s) => s.length === 2),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label">Zone name *</label>
        <input required className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label className="label">Countries (ISO-2, comma-separated)</label>
        <input
          className="input"
          placeholder="FR, DE, ES — leave empty for rest of world"
          value={countries}
          onChange={(e) => setCountries(e.target.value)}
        />
      </div>
      {error && <p className="field-error">{error}</p>}
      <button type="submit" disabled={busy} className="btn btn-primary w-full">
        {busy ? "Creating…" : "Create zone"}
      </button>
    </form>
  );
}

function RateForm({ zoneId, onSaved }: { zoneId: string; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: "",
    amount: "",
    currency: "USD",
    freeOver: "",
    minDays: "",
    maxDays: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/admin/shipping/rates", {
        zoneId,
        name: form.name,
        amountCents: Math.round(parseFloat(form.amount) * 100),
        currency: form.currency,
        freeOverCents: form.freeOver ? Math.round(parseFloat(form.freeOver) * 100) : null,
        minTransitDays: form.minDays ? parseInt(form.minDays, 10) : null,
        maxTransitDays: form.maxDays ? parseInt(form.maxDays, 10) : null,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [key]: e.target.value });

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label">Rate name *</label>
        <input required className="input" placeholder="Standard" value={form.name} onChange={set("name")} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Price *</label>
          <input required type="number" step="0.01" min="0" className="input" value={form.amount} onChange={set("amount")} />
        </div>
        <div>
          <label className="label">Currency</label>
          <input className="input uppercase" maxLength={3} value={form.currency} onChange={set("currency")} />
        </div>
      </div>
      <div>
        <label className="label">Free over (order subtotal)</label>
        <input type="number" step="0.01" min="0" className="input" placeholder="Optional" value={form.freeOver} onChange={set("freeOver")} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Transit min (days)</label>
          <input type="number" min="0" className="input" value={form.minDays} onChange={set("minDays")} />
        </div>
        <div>
          <label className="label">Transit max (days)</label>
          <input type="number" min="0" className="input" value={form.maxDays} onChange={set("maxDays")} />
        </div>
      </div>
      {error && <p className="field-error">{error}</p>}
      <button type="submit" disabled={busy} className="btn btn-primary w-full">
        {busy ? "Creating…" : "Add rate"}
      </button>
    </form>
  );
}
