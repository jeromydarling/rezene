import { useState } from "react";
import { useFetch } from "../../lib/useFetch";
import { api, ApiRequestError } from "../../lib/api";
import { useToast } from "../../lib/toast";
import { ErrorNote, PageHeader } from "../../components/admin/ui";

/**
 * Sourcing — "find a maker". Describe the piece; Verto does deep web research
 * (Perplexity) to surface real tailors and small factories, then one-click adds
 * them to your Factories & Suppliers so you can request a sample.
 */

interface MakerLead {
  name: string;
  city: string | null;
  country: string | null;
  website: string | null;
  email: string | null;
  specialties: string[];
  moqUnits: number | null;
  leadTimeDays: number | null;
  whyFit: string | null;
}

export function SourcingPage() {
  const toast = useToast();
  const { data: config } = useFetch<{ enabled: boolean }>("/api/admin/sourcing/config");
  const [form, setForm] = useState({ garment: "", materials: "", moq: "", location: "", style: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leads, setLeads] = useState<MakerLead[] | null>(null);
  const [citations, setCitations] = useState<string[]>([]);
  const [added, setAdded] = useState<Record<string, boolean>>({});

  async function search() {
    setBusy(true);
    setError(null);
    setLeads(null);
    try {
      const res = await api.post<{ leads: MakerLead[]; citations: string[] }>("/api/admin/sourcing/search", form);
      setLeads(res.leads);
      setCitations(res.citations);
      if (res.leads.length === 0) setError("No confident matches — try widening the brief.");
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : "Search failed");
    } finally {
      setBusy(false);
    }
  }

  async function add(lead: MakerLead) {
    try {
      await api.post("/api/admin/sourcing/add", { ...lead, citations });
      setAdded((a) => ({ ...a, [lead.name]: true }));
      toast.success(`Added ${lead.name}`, "It's in Factories & Suppliers as an unverified lead — reach out to confirm.");
    } catch (e) {
      toast.error(e instanceof ApiRequestError ? e.message : "Couldn't add");
      if (e instanceof ApiRequestError && e.status === 409) setAdded((a) => ({ ...a, [lead.name]: true }));
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        eyebrow="Production"
        title="Find a maker"
        description="New line and no factory yet? Describe the piece and we'll research real tailors and small studios that can make it."
      />

      {config && !config.enabled && (
        <div className="admin-card mb-4 bg-amber-50 p-4 text-sm text-amber-900">
          Maker sourcing isn't switched on for this store yet. Once connected, describe a garment and get a shortlist of real
          makers with citations.
        </div>
      )}

      <div className="admin-card mb-6 space-y-3 p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="What are you making? *">
            <input className="input" value={form.garment} onChange={(e) => setForm({ ...form, garment: e.target.value })} placeholder="tailored linen trousers" />
          </Field>
          <Field label="Materials">
            <input className="input" value={form.materials} onChange={(e) => setForm({ ...form, materials: e.target.value })} placeholder="European linen, horn buttons" />
          </Field>
          <Field label="Order quantity (MOQ)">
            <input className="input" value={form.moq} onChange={(e) => setForm({ ...form, moq: e.target.value })} placeholder="50–100 units per style" />
          </Field>
          <Field label="Preferred location">
            <input className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Portugal, or near Los Angeles" />
          </Field>
          <Field label="Aesthetic / style">
            <input className="input" value={form.style} onChange={(e) => setForm({ ...form, style: e.target.value })} placeholder="elevated minimal, slow fashion" />
          </Field>
          <Field label="Anything else">
            <input className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="ethical / small-batch friendly" />
          </Field>
        </div>
        {error && <ErrorNote message={error} />}
        <button type="button" className="btn btn-primary" disabled={busy || !form.garment.trim() || Boolean(config && !config.enabled)} onClick={() => void search()}>
          {busy ? "Researching the web…" : "Find makers"}
        </button>
        {busy && <p className="text-xs text-warmgrey">Searching live sources for real makers — this takes a few seconds.</p>}
      </div>

      {leads && leads.length > 0 && (
        <div className="space-y-3">
          {leads.map((lead) => (
            <div key={lead.name} className="admin-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-display text-lg font-light">{lead.name}</h3>
                  <p className="text-xs text-warmgrey">
                    {[lead.city, lead.country].filter(Boolean).join(", ") || "location unlisted"}
                    {lead.moqUnits ? ` · MOQ ~${lead.moqUnits}` : ""}
                    {lead.leadTimeDays ? ` · ${lead.leadTimeDays}d lead` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary !py-1.5 text-xs"
                  disabled={added[lead.name]}
                  onClick={() => void add(lead)}
                >
                  {added[lead.name] ? "Added ✓" : "+ Add to factories"}
                </button>
              </div>
              {lead.whyFit && <p className="mt-2 text-sm text-ink/80">{lead.whyFit}</p>}
              {lead.specialties.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {lead.specialties.map((s) => (
                    <span key={s} className="rounded-full bg-navy/[0.05] px-2 py-0.5 text-[11px] text-ink/70">
                      {s}
                    </span>
                  ))}
                </div>
              )}
              {lead.website && (
                <a href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-navy hover:underline">
                  {lead.website} ↗
                </a>
              )}
            </div>
          ))}
          {citations.length > 0 && (
            <details className="admin-card p-4 text-xs text-warmgrey">
              <summary className="cursor-pointer">Sources ({citations.length})</summary>
              <ul className="mt-2 space-y-1">
                {citations.map((c, i) => (
                  <li key={i}>
                    <a href={c} target="_blank" rel="noreferrer" className="text-navy hover:underline">
                      {c}
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          )}
          <p className="text-center text-[11px] text-warmgrey">
            Leads are AI-researched and unverified — always confirm capabilities and terms before committing.
          </p>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-warmgrey">{label}</span>
      {children}
    </label>
  );
}
