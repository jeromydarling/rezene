import { useState } from "react";
import { Link } from "react-router";
import { useCart } from "../../lib/cart";
import { api, ApiRequestError } from "../../lib/api";
import { formatMoney } from "../../lib/format";
import { track } from "../../lib/analytics";
import { EditorialImage } from "../../components/ImagePlaceholder";

const ESTIMATE_COUNTRIES: { code: string; label: string }[] = [
  { code: "US", label: "United States" },
  { code: "GB", label: "United Kingdom" },
  { code: "CA", label: "Canada" },
  { code: "MA", label: "Morocco" },
  { code: "FR", label: "France" },
  { code: "DE", label: "Germany" },
  { code: "ES", label: "Spain" },
  { code: "IT", label: "Italy" },
  { code: "NL", label: "Netherlands" },
  { code: "BE", label: "Belgium" },
  { code: "PT", label: "Portugal" },
  { code: "IE", label: "Ireland" },
  { code: "AT", label: "Austria" },
  { code: "DK", label: "Denmark" },
  { code: "SE", label: "Sweden" },
];

interface CartQuote {
  carrier: string;
  service: string;
  amountCents: number;
  currency: string;
  minDays: number | null;
  maxDays: number | null;
}

export function CartPage() {
  const cart = useCart();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [country, setCountry] = useState("");
  const [quotes, setQuotes] = useState<CartQuote[] | null>(null);
  const [quoting, setQuoting] = useState(false);

  async function estimate(nextCountry: string) {
    setCountry(nextCountry);
    setQuotes(null);
    if (!nextCountry) return;
    setQuoting(true);
    try {
      const res = await api.post<{ quotes: CartQuote[] }>("/api/public/shipping/quote", {
        country: nextCountry,
        items: cart.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
      });
      setQuotes(res.quotes);
    } catch {
      setQuotes([]); // estimate is a nicety — checkout still works without it
    } finally {
      setQuoting(false);
    }
  }

  async function checkout() {
    setBusy(true);
    setError(null);
    track("checkout_started");
    try {
      const res = await api.post<{ url: string }>("/api/public/checkout", {
        items: cart.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
        ...(country ? { shippingCountry: country } : {}),
      });
      window.location.href = res.url;
    } catch (err) {
      setError(
        err instanceof ApiRequestError && err.status !== 500
          ? err.message
          : "Checkout is momentarily unavailable. Please try again.",
      );
      setBusy(false);
    }
  }

  if (cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-5 py-32 text-center">
        <p className="eyebrow mb-4">Cart</p>
        <h1 className="display-hero text-4xl">Nothing here yet</h1>
        <p className="prose-editorial mt-4">The pieces are waiting.</p>
        <Link to="/products" className="btn btn-primary mt-8">
          Browse the shop
        </Link>
      </div>
    );
  }

  const currency = cart.items[0].currency;
  const hasPreOrder = cart.items.some((i) => i.isPreOrder);

  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <p className="eyebrow mb-3">Cart</p>
      <h1 className="display-hero mb-10 text-4xl">Your selection</h1>

      <div className="space-y-6">
        {cart.items.map((item) => (
          <div key={item.variantId} className="flex gap-4 border-b border-ink/10 pb-6">
            <Link to={`/products/${item.productSlug}`} className="w-24 shrink-0">
              <EditorialImage
                src={item.imageUrl}
                alt={item.productName}
                label={item.productName}
                aspect="aspect-[4/5]"
              />
            </Link>
            <div className="flex flex-1 flex-col justify-between">
              <div>
                <div className="flex items-baseline justify-between gap-4">
                  <Link
                    to={`/products/${item.productSlug}`}
                    className="font-display text-lg font-light hover:text-terracotta-deep"
                  >
                    {item.productName}
                  </Link>
                  <p className="text-sm">{formatMoney(item.priceCents * item.quantity, currency)}</p>
                </div>
                <p className="text-xs text-warmgrey">{item.variantLabel}</p>
                {item.isPreOrder && <span className="badge badge-saffron mt-1">Pre-order</span>}
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="h-7 w-7 border border-ink/20 text-sm hover:border-ink"
                    onClick={() => cart.setQuantity(item.variantId, item.quantity - 1)}
                  >
                    −
                  </button>
                  <span className="w-6 text-center text-sm">{item.quantity}</span>
                  <button
                    type="button"
                    className="h-7 w-7 border border-ink/20 text-sm hover:border-ink"
                    onClick={() => cart.setQuantity(item.variantId, item.quantity + 1)}
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  className="text-xs text-warmgrey underline hover:text-ink"
                  onClick={() => cart.remove(item.variantId)}
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 space-y-4">
        <div className="flex items-baseline justify-between">
          <p className="text-sm uppercase tracking-editorial text-warmgrey">Subtotal</p>
          <p className="font-display text-2xl font-light">
            {formatMoney(cart.subtotalCents, currency)}
          </p>
        </div>

        <div className="border-t border-ink/10 pt-4">
          <label className="mb-2 block text-xs uppercase tracking-editorial text-warmgrey">
            Estimate shipping
          </label>
          <select
            className="w-full border border-ink/20 bg-transparent px-3 py-2 text-sm"
            value={country}
            onChange={(e) => void estimate(e.target.value)}
          >
            <option value="">Select your country…</option>
            {ESTIMATE_COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
          {quoting && <p className="mt-2 text-xs text-warmgrey">Checking rates…</p>}
          {quotes && quotes.length > 0 && (
            <ul className="mt-2 space-y-1 text-sm">
              {quotes.slice(0, 4).map((q, i) => (
                <li key={i} className="flex items-baseline justify-between">
                  <span className="text-warmgrey">
                    {q.carrier} — {q.service}
                    {q.minDays != null &&
                      ` (${q.minDays}${q.maxDays && q.maxDays !== q.minDays ? `–${q.maxDays}` : ""} days)`}
                  </span>
                  <span>{q.amountCents === 0 ? "Free" : formatMoney(q.amountCents, q.currency)}</span>
                </li>
              ))}
            </ul>
          )}
          {quotes && quotes.length === 0 && !quoting && (
            <p className="mt-2 text-xs text-warmgrey">
              Rates for this destination are confirmed at checkout.
            </p>
          )}
        </div>
        {hasPreOrder && (
          <p className="bg-saffron/15 px-4 py-3 text-sm text-bark">
            Pre-order pieces are charged now and ship with the production run — in-stock pieces
            ship right away.
          </p>
        )}
        {error && <p className="field-error text-center">{error}</p>}
        <button
          type="button"
          className="btn btn-primary w-full py-3.5"
          disabled={busy}
          onClick={() => void checkout()}
        >
          {busy ? "Preparing checkout…" : "Checkout"}
        </button>
        <p className="text-center text-xs text-warmgrey">
          Shipping and any taxes are calculated at checkout.
        </p>
      </div>
    </div>
  );
}
