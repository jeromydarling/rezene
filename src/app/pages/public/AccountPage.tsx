import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Heart, MapPin, Package, LogOut } from "lucide-react";
import { api, ApiRequestError } from "../../lib/api";
import { useCart, type CartItem } from "../../lib/cart";
import { useToast } from "../../lib/toast";
import { formatMoney } from "../../lib/format";

interface OrderRow {
  id: string;
  orderNumber: string;
  totalCents: number;
  currency: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  isPreOrder: number;
  placedAt: string | null;
  createdAt: string;
  itemCount: number;
}
type Tab = "orders" | "wishlist" | "addresses";

const fmtDate = (s: string | null) =>
  s ? new Date(s.replace(" ", "T") + "Z").toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "";

export function AccountPage() {
  const toast = useToast();
  const [me, setMe] = useState<{ email: string; name: string | null } | null>(null);
  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState<Tab>("orders");

  const loadMe = useCallback(async () => {
    try {
      setMe(await api.get<{ email: string; name: string | null }>("/api/public/account/me"));
    } catch {
      setMe(null);
    } finally {
      setChecking(false);
    }
  }, []);

  // Verify a magic-link token if present, then load the session.
  useEffect(() => {
    const url = new URL(window.location.href);
    const token = url.searchParams.get("token");
    if (token) {
      api
        .post("/api/public/account/verify", { token })
        .then(() => {
          url.searchParams.delete("token");
          window.history.replaceState({}, "", url.toString());
          toast.success("You're in", "Welcome back.");
        })
        .catch((e) => toast.error("Couldn't sign in", e instanceof ApiRequestError ? e.message : undefined))
        .finally(() => void loadMe());
    } else {
      void loadMe();
    }
  }, [loadMe, toast]);

  async function signOut() {
    await api.post("/api/public/account/logout");
    setMe(null);
  }

  if (checking) {
    return <div className="mx-auto max-w-3xl px-5 py-24 text-center text-sm text-ink/50">Loading…</div>;
  }

  if (!me) return <SignIn />;

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <p className="text-[0.65rem] uppercase tracking-editorial text-ink/50">Your account</p>
          <h1 className="font-display text-3xl font-light">{me.name || me.email}</h1>
        </div>
        <button type="button" onClick={() => void signOut()} className="inline-flex items-center gap-1.5 text-xs text-ink/60 hover:text-ink">
          <LogOut size={14} /> Sign out
        </button>
      </div>

      <div className="mb-6 flex gap-1 border-b border-ink/10">
        {(
          [
            ["orders", "Orders", Package],
            ["wishlist", "Wishlist", Heart],
            ["addresses", "Addresses", MapPin],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`-mb-px flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm transition ${
              tab === key ? "border-ink text-ink" : "border-transparent text-ink/50 hover:text-ink"
            }`}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {tab === "orders" && <Orders />}
      {tab === "wishlist" && <Wishlist />}
      {tab === "addresses" && <Addresses />}
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
      await api.post("/api/public/account/request-link", { email: email.trim() });
      setSent(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-5 py-20">
      <p className="text-center text-[0.65rem] uppercase tracking-editorial text-ink/50">Account</p>
      <h1 className="mt-1 text-center font-display text-3xl font-light">Sign in</h1>
      {sent ? (
        <div className="mt-8 rounded-lg border border-ink/10 bg-cream/50 p-6 text-center">
          <p className="text-sm text-ink/80">
            If <span className="font-medium">{email}</span> has an account, a secure sign-in link is on its
            way. It works once and expires in 30 minutes.
          </p>
          <button
            type="button"
            className="mt-4 text-xs text-ink/60 underline hover:text-ink"
            onClick={() => setSent(false)}
          >
            Use a different email
          </button>
        </div>
      ) : (
        <div className="mt-8 space-y-3">
          <p className="text-center text-sm text-ink/70">
            No password needed — we'll email you a secure link to sign in and see your orders.
          </p>
          <input
            type="email"
            className="input w-full"
            placeholder="you@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void submit()}
          />
          <button type="button" className="btn btn-primary w-full" disabled={busy} onClick={() => void submit()}>
            {busy ? "Sending…" : "Email me a link"}
          </button>
          <p className="text-center text-xs text-ink/45">
            New here? Your account is created automatically with your first order.
          </p>
        </div>
      )}
    </div>
  );
}

function Orders() {
  const navigate = useNavigate();
  const cart = useCart();
  const toast = useToast();
  const [orders, setOrders] = useState<OrderRow[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ orders: OrderRow[] }>("/api/public/account/orders").then((d) => setOrders(d.orders)).catch(() => setOrders([]));
  }, []);

  async function reorder(id: string) {
    try {
      const { items, dropped } = await api.get<{ items: CartItem[]; dropped: number }>(
        `/api/public/account/orders/${id}/reorder`,
      );
      if (items.length === 0) {
        toast.error("Nothing to add", "These pieces are no longer available.");
        return;
      }
      items.forEach((i) => cart.add(i, 1));
      toast.success("Added to your bag", dropped > 0 ? `${dropped} piece(s) are no longer available.` : "Ready when you are.");
      navigate("/cart");
    } catch (e) {
      toast.error("Couldn't reorder", e instanceof ApiRequestError ? e.message : undefined);
    }
  }

  if (!orders) return <p className="py-8 text-sm text-ink/50">Loading…</p>;
  if (orders.length === 0)
    return (
      <div className="rounded-lg border border-dashed border-ink/15 py-12 text-center">
        <p className="text-sm text-ink/60">No orders yet.</p>
        <Link to="/products" className="mt-2 inline-block text-sm text-terracotta hover:underline">
          Start shopping →
        </Link>
      </div>
    );

  return (
    <div className="space-y-3">
      {orders.map((o) => (
        <div key={o.id} className="rounded-lg border border-ink/10">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
            onClick={() => setOpen(open === o.id ? null : o.id)}
          >
            <div>
              <p className="font-mono text-sm font-medium">{o.orderNumber}</p>
              <p className="text-xs text-ink/50">
                {fmtDate(o.placedAt || o.createdAt)} · {o.itemCount} item{o.itemCount === 1 ? "" : "s"}
                {o.isPreOrder ? " · pre-order" : ""}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium">{formatMoney(o.totalCents, o.currency)}</p>
              <span className="text-[0.65rem] uppercase tracking-wide text-ink/50">{o.fulfillmentStatus}</span>
            </div>
          </button>
          {open === o.id && <OrderDetail id={o.id} onReorder={() => void reorder(o.id)} />}
        </div>
      ))}
    </div>
  );
}

interface OrderItemWithId {
  id: string;
  variantId: string | null;
  description: string;
  quantity: number;
  unitPriceCents: number;
  currency: string;
}
interface OrderDetailData {
  items: { description: string; quantity: number; unitPriceCents: number; currency: string }[];
  itemsWithIds: OrderItemWithId[];
  shipments: { carrier: string | null; service: string | null; trackingNumber: string | null; trackingUrl: string | null; status: string }[];
  returns: { id: string; status: string; createdAt: string; refundAmountCents: number | null; currency: string | null }[];
  returnable: boolean;
}

const RETURN_REASONS = [
  ["size", "Wrong size / fit"],
  ["quality", "Quality issue"],
  ["changed_mind", "Changed my mind"],
  ["faulty", "Arrived faulty"],
  ["other", "Other"],
] as const;

function OrderDetail({ id, onReorder }: { id: string; onReorder: () => void }) {
  const toast = useToast();
  const [data, setData] = useState<OrderDetailData | null>(null);
  const [returning, setReturning] = useState(false);

  const load = useCallback(() => {
    api
      .get<OrderDetailData>(`/api/public/account/orders/${id}`)
      .then(setData)
      .catch(() => setData({ items: [], itemsWithIds: [], shipments: [], returns: [], returnable: false }));
  }, [id]);
  useEffect(load, [load]);

  if (!data) return <div className="border-t border-ink/10 px-4 py-3 text-xs text-ink/40">Loading…</div>;

  const activeReturn = data.returns.find((r) => r.status !== "rejected" && r.status !== "cancelled");

  return (
    <div className="space-y-3 border-t border-ink/10 px-4 py-3">
      <ul className="space-y-1">
        {data.items.map((it, i) => (
          <li key={i} className="flex justify-between text-sm">
            <span className="text-ink/80">
              {it.quantity} × {it.description}
            </span>
            <span className="text-ink/60">{formatMoney(it.unitPriceCents * it.quantity, it.currency)}</span>
          </li>
        ))}
      </ul>

      {data.shipments.length > 0 && (
        <div className="rounded bg-cream/60 p-3">
          <p className="mb-1 text-[0.65rem] uppercase tracking-wide text-ink/50">Tracking</p>
          {data.shipments.map((s, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="text-ink/80">
                {s.carrier || "Carrier"} {s.service ? `· ${s.service}` : ""} — {s.status.replace(/_/g, " ")}
              </span>
              {s.trackingUrl ? (
                <a href={s.trackingUrl} target="_blank" rel="noreferrer" className="text-terracotta hover:underline">
                  Track →
                </a>
              ) : s.trackingNumber ? (
                <span className="font-mono text-xs text-ink/60">{s.trackingNumber}</span>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {activeReturn && (
        <div className="rounded bg-cream/60 p-3 text-sm">
          <span className="text-ink/70">Return </span>
          <span className="font-medium">{activeReturn.status}</span>
          {activeReturn.status === "refunded" && activeReturn.refundAmountCents != null && (
            <> — {formatMoney(activeReturn.refundAmountCents, activeReturn.currency || "EUR")} refunded</>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-secondary !py-1.5 text-xs" onClick={onReorder}>
          Reorder these
        </button>
        {data.returnable && !activeReturn && !returning && (
          <button type="button" className="btn btn-secondary !py-1.5 text-xs" onClick={() => setReturning(true)}>
            Start a return
          </button>
        )}
      </div>

      {returning && (
        <ReturnForm
          items={data.itemsWithIds}
          onCancel={() => setReturning(false)}
          onDone={() => {
            setReturning(false);
            toast.success("Return requested", "We'll review it and email you.");
            load();
          }}
          orderId={id}
        />
      )}
    </div>
  );
}

function ReturnForm({
  items,
  orderId,
  onCancel,
  onDone,
}: {
  items: OrderItemWithId[];
  orderId: string;
  onCancel: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [reason, setReason] = useState<string>("size");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const toggle = (it: OrderItemWithId) =>
    setPicked((p) => {
      const next = { ...p };
      if (next[it.id]) delete next[it.id];
      else next[it.id] = it.quantity;
      return next;
    });

  async function submit() {
    const chosen = Object.entries(picked).map(([orderItemId, quantity]) => ({ orderItemId, quantity }));
    if (chosen.length === 0) {
      toast.error("Pick at least one item");
      return;
    }
    setBusy(true);
    try {
      await api.post(`/api/public/account/orders/${orderId}/returns`, { reason, note: note || undefined, items: chosen });
      onDone();
    } catch (e) {
      toast.error("Couldn't start the return", e instanceof ApiRequestError ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-ink/10 bg-white p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-ink/50">What are you sending back?</p>
      <ul className="space-y-1">
        {items.map((it) => (
          <li key={it.id}>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={Boolean(picked[it.id])} onChange={() => toggle(it)} />
              <span className="flex-1">{it.description}</span>
              <span className="text-ink/50">{formatMoney(it.unitPriceCents, it.currency)}</span>
            </label>
          </li>
        ))}
      </ul>
      <div>
        <label className="mb-1 block text-xs text-ink/50">Reason</label>
        <select className="input w-full text-sm" value={reason} onChange={(e) => setReason(e.target.value)}>
          {RETURN_REASONS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>
      <textarea
        className="input w-full text-sm"
        rows={2}
        placeholder="Anything we should know? (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="flex gap-2">
        <button type="button" className="btn btn-primary flex-1 !py-1.5 text-sm" disabled={busy} onClick={() => void submit()}>
          {busy ? "Sending…" : "Request return"}
        </button>
        <button type="button" className="btn btn-secondary !py-1.5 text-sm" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function Wishlist() {
  const [items, setItems] = useState<
    { productId: string; slug: string; name: string; priceCents: number; currency: string; imageUrl: string | null }[] | null
  >(null);

  const load = useCallback(() => {
    api.get<{ items: never[] }>("/api/public/account/wishlist").then((d) => setItems(d.items)).catch(() => setItems([]));
  }, []);
  useEffect(load, [load]);

  async function remove(productId: string) {
    await api.delete(`/api/public/account/wishlist/${productId}`);
    load();
  }

  if (!items) return <p className="py-8 text-sm text-ink/50">Loading…</p>;
  if (items.length === 0)
    return (
      <div className="rounded-lg border border-dashed border-ink/15 py-12 text-center">
        <p className="text-sm text-ink/60">Your wishlist is empty.</p>
        <Link to="/products" className="mt-2 inline-block text-sm text-terracotta hover:underline">
          Find something to love →
        </Link>
      </div>
    );

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {items.map((it) => (
        <div key={it.productId} className="group">
          <Link to={`/products/${it.slug}`} className="block aspect-[3/4] overflow-hidden rounded bg-cream">
            {it.imageUrl && <img src={it.imageUrl} alt={it.name} className="h-full w-full object-cover" />}
          </Link>
          <div className="mt-1.5 flex items-start justify-between gap-2">
            <div>
              <Link to={`/products/${it.slug}`} className="text-sm hover:underline">
                {it.name}
              </Link>
              <p className="text-xs text-ink/55">{formatMoney(it.priceCents, it.currency)}</p>
            </div>
            <button type="button" className="text-ink/40 hover:text-terracotta" onClick={() => void remove(it.productId)} aria-label="Remove">
              <Heart size={16} fill="currentColor" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function Addresses() {
  const [items, setItems] = useState<
    | {
        id: string;
        name: string | null;
        line1: string | null;
        line2: string | null;
        city: string | null;
        region: string | null;
        postalCode: string | null;
        country: string | null;
        isDefault: number;
      }[]
    | null
  >(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", line1: "", line2: "", city: "", region: "", postalCode: "", country: "" });

  const load = useCallback(() => {
    api.get<{ addresses: never[] }>("/api/public/account/addresses").then((d) => setItems(d.addresses)).catch(() => setItems([]));
  }, []);
  useEffect(load, [load]);

  async function save() {
    await api.post("/api/public/account/addresses", form);
    setForm({ name: "", line1: "", line2: "", city: "", region: "", postalCode: "", country: "" });
    setAdding(false);
    load();
  }
  async function remove(id: string) {
    await api.delete(`/api/public/account/addresses/${id}`);
    load();
  }

  if (!items) return <p className="py-8 text-sm text-ink/50">Loading…</p>;

  return (
    <div className="space-y-4">
      {items.length === 0 && !adding && (
        <p className="rounded-lg border border-dashed border-ink/15 py-8 text-center text-sm text-ink/60">
          No saved addresses yet.
        </p>
      )}
      {items.map((a) => (
        <div key={a.id} className="flex items-start justify-between rounded-lg border border-ink/10 p-4 text-sm">
          <div>
            <p className="font-medium">{a.name || "Address"}</p>
            <p className="text-ink/60">
              {[a.line1, a.line2, a.city, a.region, a.postalCode, a.country].filter(Boolean).join(", ")}
            </p>
          </div>
          <button type="button" className="text-xs text-ink/50 hover:text-terracotta" onClick={() => void remove(a.id)}>
            Remove
          </button>
        </div>
      ))}

      {adding ? (
        <div className="space-y-2 rounded-lg border border-ink/10 p-4">
          {(
            [
              ["name", "Full name"],
              ["line1", "Address"],
              ["line2", "Apartment, suite (optional)"],
              ["city", "City"],
              ["region", "State / region"],
              ["postalCode", "Postal code"],
              ["country", "Country"],
            ] as const
          ).map(([key, label]) => (
            <input
              key={key}
              className="input w-full text-sm"
              placeholder={label}
              value={(form as Record<string, string>)[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            />
          ))}
          <div className="flex gap-2 pt-1">
            <button type="button" className="btn btn-primary flex-1 !py-1.5 text-sm" onClick={() => void save()}>
              Save address
            </button>
            <button type="button" className="btn btn-secondary !py-1.5 text-sm" onClick={() => setAdding(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn btn-secondary !py-1.5 text-sm" onClick={() => setAdding(true)}>
          + Add an address
        </button>
      )}
    </div>
  );
}
