import { useCallback, useEffect, useState } from "react";
import { api, ApiRequestError } from "../../lib/api";
import { useToast } from "../../lib/toast";
import { formatMoney } from "../../lib/format";

interface Me {
  email: string;
  company: string | null;
  discountPct: number;
  termsDays: number;
}
interface Sheet {
  id: string;
  title: string;
  season: string | null;
  currency: string;
  note: string | null;
}
interface SheetItem {
  productId: string;
  name: string;
  slug: string;
  image: string | null;
  minQty: number;
  priceCents: number;
  listPriceCents: number;
  customPrice: boolean;
  tiers: { minQty: number; priceCents: number }[];
}
interface WOrder {
  id: string;
  orderNumber: string;
  status: string;
  totalCents: number;
  currency: string;
  dueDate: string | null;
  paidAt: string | null;
  createdAt: string;
}

/** The buyer's unit price at a quantity — their base price, or the deepest tier reached. */
function unitPriceAt(item: SheetItem, qty: number): number {
  let price = item.priceCents;
  for (const t of item.tiers) if (qty >= t.minQty) price = t.priceCents;
  return price;
}

export function WholesalePortalPage() {
  const toast = useToast();
  const [me, setMe] = useState<Me | null>(null);
  const [checking, setChecking] = useState(true);

  const loadMe = useCallback(async () => {
    try {
      setMe(await api.get<Me>("/api/wholesale/me"));
    } catch {
      setMe(null);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    const token = url.searchParams.get("token");
    if (token) {
      api
        .post("/api/wholesale/verify", { token })
        .then(() => {
          url.searchParams.delete("token");
          window.history.replaceState({}, "", url.toString());
          toast.success("Signed in");
        })
        .catch((e) => toast.error("Couldn't sign in", e instanceof ApiRequestError ? e.message : undefined))
        .finally(() => void loadMe());
    } else {
      void loadMe();
    }
  }, [loadMe, toast]);

  if (checking) return <div className="mx-auto max-w-2xl px-5 py-24 text-center text-sm text-ink/50">Loading…</div>;
  if (!me) return <Gate />;
  return <Portal me={me} onSignOut={() => setMe(null)} />;
}

function Gate() {
  const [mode, setMode] = useState<"signin" | "apply">("signin");
  return (
    <div className="mx-auto max-w-md px-5 py-20">
      <p className="text-center text-[0.65rem] uppercase tracking-editorial text-ink/50">Wholesale</p>
      <h1 className="mt-1 text-center font-display text-3xl font-light">Trade portal</h1>
      <div className="mx-auto mt-6 flex max-w-xs overflow-hidden rounded-full border border-ink/15">
        {(
          [
            ["signin", "Sign in"],
            ["apply", "Apply"],
          ] as const
        ).map(([v, l]) => (
          <button
            key={v}
            type="button"
            onClick={() => setMode(v)}
            className={`flex-1 py-2 text-xs uppercase tracking-editorial ${mode === v ? "bg-navy text-chalk" : "text-ink/60"}`}
          >
            {l}
          </button>
        ))}
      </div>
      {mode === "signin" ? <SignIn /> : <Apply onApplied={() => setMode("signin")} />}
    </div>
  );
}

function SignIn() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (!email.trim()) return;
    setBusy(true);
    try {
      await api.post("/api/wholesale/request-link", { email: email.trim() });
      setSent(true);
    } finally {
      setBusy(false);
    }
  }
  if (sent)
    return (
      <p className="mt-8 rounded-lg border border-ink/10 bg-cream/50 p-6 text-center text-sm text-ink/80">
        If that address is an approved wholesale account, a sign-in link is on its way.
      </p>
    );
  return (
    <div className="mt-8 space-y-3">
      <p className="text-center text-sm text-ink/70">Approved buyers sign in with a secure email link.</p>
      <input className="input w-full" type="email" placeholder="you@boutique.com" value={email} onChange={(e) => setEmail(e.target.value)} />
      <button type="button" className="btn btn-primary w-full" disabled={busy} onClick={() => void submit()}>
        {busy ? "Sending…" : "Email me a link"}
      </button>
    </div>
  );
}

function Apply({ onApplied }: { onApplied: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ email: "", company: "", contactName: "" });
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (!form.email.trim()) return;
    setBusy(true);
    try {
      await api.post("/api/wholesale/apply", form);
      toast.success("Application received", "We'll review it and email you when you're approved.");
      onApplied();
    } catch (e) {
      toast.error("Couldn't apply", e instanceof ApiRequestError ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-8 space-y-3">
      <p className="text-center text-sm text-ink/70">Stock our pieces in your boutique. Tell us about you.</p>
      <input className="input w-full" placeholder="Boutique / company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
      <input className="input w-full" placeholder="Your name" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
      <input className="input w-full" type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      <button type="button" className="btn btn-primary w-full" disabled={busy} onClick={() => void submit()}>
        {busy ? "Sending…" : "Apply for wholesale"}
      </button>
    </div>
  );
}

function Portal({ me, onSignOut }: { me: Me; onSignOut: () => void }) {
  const toast = useToast();
  const [openSheet, setOpenSheet] = useState<string | null>(null);
  const [orders, setOrders] = useState<WOrder[]>([]);
  const [canPayOnline, setCanPayOnline] = useState(false);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [paying, setPaying] = useState<string | null>(null);

  const loadOrders = useCallback(() => {
    api
      .get<{ orders: WOrder[]; canPayOnline: boolean }>("/api/wholesale/orders")
      .then((d) => {
        setOrders(d.orders);
        setCanPayOnline(d.canPayOnline);
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    api.get<{ lineSheets: Sheet[] }>("/api/wholesale/line-sheets").then((d) => setSheets(d.lineSheets)).catch(() => {});
    loadOrders();
    // Back from a Stripe payment page — say so and refresh.
    const url = new URL(window.location.href);
    const paid = url.searchParams.get("paid");
    if (paid) {
      toast.success(`Payment received for ${paid}`, "Thank you — a receipt is on its way.");
      url.searchParams.delete("paid");
      window.history.replaceState({}, "", url.toString());
    }
  }, [loadOrders, toast]);

  async function signOut() {
    await api.post("/api/wholesale/logout");
    onSignOut();
  }

  async function payNow(order: WOrder) {
    setPaying(order.id);
    try {
      const res = await api.post<{ url: string }>(`/api/wholesale/orders/${order.id}/pay`);
      window.location.href = res.url;
    } catch (e) {
      toast.error("Couldn't start payment", e instanceof ApiRequestError ? e.message : undefined);
      setPaying(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-5 py-12">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <p className="text-[0.65rem] uppercase tracking-editorial text-ink/50">Wholesale</p>
          <h1 className="font-display text-3xl font-light">{me.company || me.email}</h1>
          <p className="mt-1 text-sm text-ink/60">
            {me.discountPct > 0 ? `${me.discountPct}% trade discount · ` : ""}
            {me.termsDays > 0 ? `Net ${me.termsDays} terms` : "Due on receipt"}
          </p>
        </div>
        <button type="button" onClick={() => void signOut()} className="text-xs text-ink/60 hover:text-ink">
          Sign out
        </button>
      </div>

      {openSheet ? (
        <OrderBuilder sheetId={openSheet} onBack={() => setOpenSheet(null)} onOrdered={() => { setOpenSheet(null); loadOrders(); }} />
      ) : (
        <>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink/50">Line sheets</h2>
          {sheets.length === 0 ? (
            <p className="rounded-lg border border-dashed border-ink/15 py-10 text-center text-sm text-ink/60">
              No line sheets available right now — check back soon.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {sheets.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setOpenSheet(s.id)}
                  className="rounded-lg border border-ink/12 p-4 text-left hover:border-navy"
                >
                  <p className="font-medium">{s.title}</p>
                  <p className="text-xs text-ink/55">{s.season || "Order now"}</p>
                </button>
              ))}
            </div>
          )}

          {orders.length > 0 && (
            <>
              <h2 className="mb-3 mt-10 text-sm font-semibold uppercase tracking-wider text-ink/50">Your orders</h2>
              <div className="space-y-2">
                {orders.map((o) => (
                  <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink/10 px-4 py-3 text-sm">
                    <div>
                      <span className="font-mono font-medium">{o.orderNumber}</span>
                      <span className="ml-2 text-xs uppercase tracking-wide text-ink/50">{o.status}</span>
                      {o.dueDate && o.status === "invoiced" && <span className="ml-2 text-xs text-ink/50">due {o.dueDate}</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{formatMoney(o.totalCents, o.currency)}</span>
                      {canPayOnline && (o.status === "invoiced" || o.status === "confirmed") && (
                        <button
                          type="button"
                          className="btn btn-primary !px-3 !py-1.5 text-xs"
                          disabled={paying === o.id}
                          onClick={() => void payNow(o)}
                        >
                          {paying === o.id ? "Opening…" : "Pay now"}
                        </button>
                      )}
                      {o.status === "paid" && <span className="text-xs font-medium text-palm">✓ Paid</span>}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function OrderBuilder({ sheetId, onBack, onOrdered }: { sheetId: string; onBack: () => void; onOrdered: () => void }) {
  const toast = useToast();
  const [data, setData] = useState<{ sheet: Sheet; items: SheetItem[]; currency: string } | null>(null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");
  const [ship, setShip] = useState({ name: "", line1: "", line2: "", city: "", state: "", postalCode: "", country: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get(`/api/wholesale/line-sheets/${sheetId}`).then(setData as never).catch(() => setData(null));
  }, [sheetId]);

  if (!data) return <p className="py-10 text-center text-sm text-ink/50">Loading…</p>;

  const total = data.items.reduce((s, it) => {
    const q = qty[it.productId] || 0;
    return s + q * unitPriceAt(it, q || it.minQty);
  }, 0);
  const units = Object.values(qty).reduce((s, n) => s + n, 0);

  async function submit() {
    const items = Object.entries(qty)
      .filter(([, q]) => q > 0)
      .map(([productId, quantity]) => ({ productId, quantity }));
    if (items.length === 0) {
      toast.error("Add some quantities first");
      return;
    }
    setBusy(true);
    try {
      const res = await api.post<{ orderNumber: string }>("/api/wholesale/orders", {
        lineSheetId: sheetId,
        items,
        note: note || undefined,
        shipTo: ship.line1 && ship.country ? ship : undefined,
      });
      toast.success(`Order ${res.orderNumber} placed`, "The shop will confirm and invoice you.");
      onOrdered();
    } catch (e) {
      toast.error("Couldn't place order", e instanceof ApiRequestError ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between print:hidden">
        <button type="button" onClick={onBack} className="text-sm text-ink/60 hover:text-ink">
          ← All line sheets
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded border border-ink/20 px-3 py-1.5 text-xs uppercase tracking-wider text-ink/60 hover:border-ink/50"
        >
          Print / Save as PDF
        </button>
      </div>
      <h2 className="font-display text-2xl font-light">{data.sheet.title}</h2>
      {data.sheet.note && <p className="mt-1 text-sm text-ink/60">{data.sheet.note}</p>}
      <p className="hidden text-xs text-ink/50 print:block">Pricing prepared for your account — confidential.</p>

      <div className="mt-5 space-y-2">
        {data.items.map((it) => {
          const q = qty[it.productId] || 0;
          const unit = unitPriceAt(it, q || it.minQty);
          return (
            <div key={it.productId} className="flex items-center gap-3 rounded-lg border border-ink/10 p-3">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded bg-cream">
                {it.image && <img src={it.image} alt={it.name} className="h-full w-full object-cover" />}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{it.name}</p>
                <p className="text-xs text-ink/55">
                  {formatMoney(unit, data.currency)} · min {it.minQty}
                  {it.customPrice && <span className="ml-1 rounded bg-palm/15 px-1.5 py-0.5 text-[0.6rem] uppercase tracking-wide text-palm">your price</span>}
                  {!it.customPrice && unit < it.listPriceCents && (
                    <span className="ml-1 line-through">{formatMoney(it.listPriceCents, data.currency)}</span>
                  )}
                </p>
                {it.tiers.length > 0 && (
                  <p className="mt-0.5 text-[0.7rem] text-ink/45">
                    {it.tiers.map((t) => `${t.minQty}+ ${formatMoney(t.priceCents, data.currency)}`).join(" · ")}
                  </p>
                )}
              </div>
              <input
                type="number"
                min={0}
                className="input w-20 text-sm print:hidden"
                placeholder="0"
                value={qty[it.productId] || ""}
                onChange={(e) => setQty({ ...qty, [it.productId]: Math.max(0, parseInt(e.target.value) || 0) })}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-5 rounded-lg border border-ink/10 p-4 print:hidden">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink/50">Ship to (optional)</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <input className="input text-sm sm:col-span-2" placeholder="Boutique / receiver name" value={ship.name} onChange={(e) => setShip({ ...ship, name: e.target.value })} />
          <input className="input text-sm" placeholder="Address line 1" value={ship.line1} onChange={(e) => setShip({ ...ship, line1: e.target.value })} />
          <input className="input text-sm" placeholder="Address line 2" value={ship.line2} onChange={(e) => setShip({ ...ship, line2: e.target.value })} />
          <input className="input text-sm" placeholder="City" value={ship.city} onChange={(e) => setShip({ ...ship, city: e.target.value })} />
          <input className="input text-sm" placeholder="State / region" value={ship.state} onChange={(e) => setShip({ ...ship, state: e.target.value })} />
          <input className="input text-sm" placeholder="Postal code" value={ship.postalCode} onChange={(e) => setShip({ ...ship, postalCode: e.target.value })} />
          <input className="input text-sm" placeholder="Country (2 letters, e.g. US)" maxLength={2} value={ship.country} onChange={(e) => setShip({ ...ship, country: e.target.value.toUpperCase() })} />
        </div>
        <p className="mt-1.5 text-[0.7rem] text-ink/45">With an address the shop can quote shipping and send tracking straight to you.</p>
      </div>

      <textarea
        className="input mt-4 w-full text-sm print:hidden"
        rows={2}
        placeholder="Notes for the shop (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      <div className="mt-4 flex items-center justify-between rounded-lg bg-cream/60 p-4 print:hidden">
        <div className="text-sm">
          <span className="text-ink/60">{units} units · </span>
          <span className="font-medium">{formatMoney(total, data.currency)}</span>
        </div>
        <button type="button" className="btn btn-primary" disabled={busy || units === 0} onClick={() => void submit()}>
          {busy ? "Placing…" : "Place order"}
        </button>
      </div>
    </div>
  );
}
