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
}
interface WOrder {
  id: string;
  orderNumber: string;
  status: string;
  totalCents: number;
  currency: string;
  dueDate: string | null;
  createdAt: string;
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
  const [openSheet, setOpenSheet] = useState<string | null>(null);
  const [orders, setOrders] = useState<WOrder[]>([]);
  const [sheets, setSheets] = useState<Sheet[]>([]);

  const loadOrders = useCallback(() => {
    api.get<{ orders: WOrder[] }>("/api/wholesale/orders").then((d) => setOrders(d.orders)).catch(() => {});
  }, []);
  useEffect(() => {
    api.get<{ lineSheets: Sheet[] }>("/api/wholesale/line-sheets").then((d) => setSheets(d.lineSheets)).catch(() => {});
    loadOrders();
  }, [loadOrders]);

  async function signOut() {
    await api.post("/api/wholesale/logout");
    onSignOut();
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
                  <div key={o.id} className="flex items-center justify-between rounded-lg border border-ink/10 px-4 py-3 text-sm">
                    <div>
                      <span className="font-mono font-medium">{o.orderNumber}</span>
                      <span className="ml-2 text-xs uppercase tracking-wide text-ink/50">{o.status}</span>
                      {o.dueDate && <span className="ml-2 text-xs text-ink/50">due {o.dueDate}</span>}
                    </div>
                    <span className="font-medium">{formatMoney(o.totalCents, o.currency)}</span>
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
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get(`/api/wholesale/line-sheets/${sheetId}`).then(setData as never).catch(() => setData(null));
  }, [sheetId]);

  if (!data) return <p className="py-10 text-center text-sm text-ink/50">Loading…</p>;

  const total = data.items.reduce((s, it) => s + (qty[it.productId] || 0) * it.priceCents, 0);
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
      const res = await api.post<{ orderNumber: string }>("/api/wholesale/orders", { lineSheetId: sheetId, items, note: note || undefined });
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
      <button type="button" onClick={onBack} className="mb-4 text-sm text-ink/60 hover:text-ink">
        ← All line sheets
      </button>
      <h2 className="font-display text-2xl font-light">{data.sheet.title}</h2>
      {data.sheet.note && <p className="mt-1 text-sm text-ink/60">{data.sheet.note}</p>}

      <div className="mt-5 space-y-2">
        {data.items.map((it) => (
          <div key={it.productId} className="flex items-center gap-3 rounded-lg border border-ink/10 p-3">
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded bg-cream">
              {it.image && <img src={it.image} alt={it.name} className="h-full w-full object-cover" />}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">{it.name}</p>
              <p className="text-xs text-ink/55">
                {formatMoney(it.priceCents, data.currency)} · min {it.minQty}
                {it.priceCents < it.listPriceCents && (
                  <span className="ml-1 line-through">{formatMoney(it.listPriceCents, data.currency)}</span>
                )}
              </p>
            </div>
            <input
              type="number"
              min={0}
              className="input w-20 text-sm"
              placeholder="0"
              value={qty[it.productId] || ""}
              onChange={(e) => setQty({ ...qty, [it.productId]: Math.max(0, parseInt(e.target.value) || 0) })}
            />
          </div>
        ))}
      </div>

      <textarea
        className="input mt-4 w-full text-sm"
        rows={2}
        placeholder="Notes for the shop (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      <div className="mt-4 flex items-center justify-between rounded-lg bg-cream/60 p-4">
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
