import { useState, type FormEvent } from "react";
import { useParams } from "react-router";
import { useFetch } from "../../lib/useFetch";
import { api, ApiRequestError } from "../../lib/api";
import { formatMoney } from "../../lib/format";

interface LineSheetItem {
  product_id: string;
  wholesale_price_cents: number;
  min_qty: number;
  name: string;
  subtitle: string | null;
  category: string;
  gender: string;
  msrp_cents: number;
  fabric_composition: string | null;
  origin_statement: string | null;
  image_url: string | null;
  colorways: string | null;
  sizes: string | null;
}

interface LineSheetResponse {
  brandName: string;
  title: string;
  season: string | null;
  currency: string;
  note: string | null;
  items: LineSheetItem[];
}

/** Public wholesale line sheet — tokenized link for boutique buyers. */
export function LineSheetPage() {
  const { token } = useParams();
  const { data, loading, error } = useFetch<LineSheetResponse>(
    token ? `/api/linesheet/${token}` : null,
  );
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ name: "", email: "", company: "", message: "" });
  const [state, setState] = useState<"idle" | "busy" | "sent">("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const requested = data
    ? data.items
        .map((item) => ({ item, qty: Number.parseInt(quantities[item.product_id] ?? "", 10) }))
        .filter((r) => Number.isFinite(r.qty) && r.qty > 0)
    : [];
  const requestedTotalCents = requested.reduce(
    (sum, r) => sum + r.qty * r.item.wholesale_price_cents,
    0,
  );

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setState("busy");
    setSubmitError(null);
    try {
      await api.post(`/api/linesheet/${token}/inquiry`, {
        name: form.name,
        email: form.email,
        company: form.company || undefined,
        message: form.message || undefined,
        requests: requested.map((r) => ({ productId: r.item.product_id, quantity: r.qty })),
      });
      setState("sent");
    } catch (err) {
      setSubmitError(err instanceof ApiRequestError ? err.message : "Something went wrong.");
      setState("idle");
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <p className="eyebrow">Loading line sheet…</p>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream px-5">
        <div className="max-w-md text-center">
          <p className="eyebrow mb-3">Wholesale</p>
          <h1 className="font-display text-2xl font-light">This link isn’t available</h1>
          <p className="prose-editorial mt-3">
            {error ?? "The line sheet may have been revoked. Contact the brand for a fresh link."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <header className="bg-navy px-5 py-8 text-chalk print:bg-white print:text-ink">
        <div className="mx-auto flex max-w-5xl flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[0.65rem] uppercase tracking-editorial text-chalk/60 print:text-warmgrey">
              Wholesale line sheet{data.season ? ` · ${data.season}` : ""}
            </p>
            <h1 className="font-display text-3xl font-light">{data.brandName}</h1>
            <p className="mt-1 text-sm text-chalk/70 print:text-warmgrey">{data.title}</p>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded border border-chalk/30 px-3 py-1.5 text-xs uppercase tracking-wider text-chalk/80 hover:bg-chalk/10 print:hidden"
          >
            Print / save PDF
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-10">
        {data.note && (
          <p className="mb-8 rounded-md border border-ink/10 bg-white p-4 text-sm text-warmgrey">
            {data.note}
          </p>
        )}

        {/* Product grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {data.items.map((item) => (
            <article
              key={item.product_id}
              className="overflow-hidden rounded-md border border-ink/10 bg-white"
            >
              <div className="aspect-[4/5] bg-sand/40">
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt={item.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs uppercase tracking-wider text-warmgrey">
                    {item.category}
                  </div>
                )}
              </div>
              <div className="p-4">
                <h2 className="font-display text-lg font-light">{item.name}</h2>
                {item.subtitle && <p className="text-xs text-warmgrey">{item.subtitle}</p>}
                <dl className="mt-3 space-y-1 text-xs text-warmgrey">
                  {item.colorways && (
                    <div className="flex justify-between gap-2">
                      <dt>Colorways</dt>
                      <dd className="text-right text-ink">{item.colorways.replaceAll(",", ", ")}</dd>
                    </div>
                  )}
                  {item.sizes && (
                    <div className="flex justify-between gap-2">
                      <dt>Sizes</dt>
                      <dd className="text-right text-ink">{item.sizes.replaceAll(",", " · ")}</dd>
                    </div>
                  )}
                  {item.fabric_composition && (
                    <div className="flex justify-between gap-2">
                      <dt>Fabric</dt>
                      <dd className="text-right text-ink">{item.fabric_composition}</dd>
                    </div>
                  )}
                </dl>
                <div className="mt-4 flex items-end justify-between border-t border-ink/10 pt-3">
                  <div>
                    <p className="text-[0.65rem] uppercase tracking-wider text-warmgrey">
                      Wholesale
                    </p>
                    <p className="font-medium">
                      {formatMoney(item.wholesale_price_cents, data.currency)}
                    </p>
                    <p className="text-[0.7rem] text-warmgrey">
                      MSRP {formatMoney(item.msrp_cents, data.currency)} · min {item.min_qty}
                    </p>
                  </div>
                  <label className="text-right print:hidden">
                    <span className="mb-1 block text-[0.65rem] uppercase tracking-wider text-warmgrey">
                      Qty
                    </span>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      className="w-20 rounded border border-ink/15 px-2 py-1 text-right text-sm"
                      value={quantities[item.product_id] ?? ""}
                      onChange={(e) =>
                        setQuantities((prev) => ({ ...prev, [item.product_id]: e.target.value }))
                      }
                    />
                  </label>
                </div>
              </div>
            </article>
          ))}
        </div>

        {/* Inquiry */}
        <section className="mt-12 rounded-md border border-ink/10 bg-white p-6 print:hidden">
          <h2 className="font-display text-xl font-light">Send an inquiry</h2>
          <p className="mt-1 text-sm text-warmgrey">
            Enter quantities above (optional), leave your details, and {data.brandName} will get
            back to you with availability and terms.
          </p>
          {requested.length > 0 && (
            <p className="mt-3 rounded bg-cream px-3 py-2 text-sm">
              {requested.map((r) => `${r.qty} × ${r.item.name}`).join(" · ")}
              <span className="ml-2 font-medium">
                ≈ {formatMoney(requestedTotalCents, data.currency)} wholesale
              </span>
            </p>
          )}
          {state === "sent" ? (
            <p className="mt-4 rounded-md border border-palm/40 bg-palm/10 p-4 text-sm">
              Inquiry sent — the brand has been notified and will reply to {form.email}.
            </p>
          ) : (
            <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2">
              <input
                required
                placeholder="Your name *"
                className="input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <input
                required
                type="email"
                placeholder="Email *"
                className="input"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
              <input
                placeholder="Boutique / company"
                className="input sm:col-span-2"
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
              />
              <textarea
                placeholder="Anything else — delivery window, terms, questions…"
                rows={3}
                className="input sm:col-span-2"
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
              />
              {submitError && <p className="field-error sm:col-span-2">{submitError}</p>}
              <button
                type="submit"
                disabled={state === "busy"}
                className="btn btn-primary sm:col-span-2"
              >
                {state === "busy" ? "Sending…" : "Send inquiry"}
              </button>
            </form>
          )}
        </section>

        <footer className="mt-10 text-center text-[0.7rem] uppercase tracking-wider text-warmgrey">
          {data.brandName} — wholesale pricing, confidential. Please don’t share this link.
        </footer>
      </main>
    </div>
  );
}
