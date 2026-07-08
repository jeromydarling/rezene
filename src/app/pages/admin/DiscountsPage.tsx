import { useState } from "react";
import { Percent, Tag, ExternalLink } from "lucide-react";
import { useFetch } from "../../lib/useFetch";
import { api, ApiRequestError } from "../../lib/api";
import { useToast } from "../../lib/toast";
import { formatDate } from "../../lib/format";
import { EmptyState, LoadingTable, PageHeader, SlideOver } from "../../components/admin/ui";

interface Promo {
  id: string;
  code: string;
  description: string | null;
  percent_off: number | null;
  amount_off_cents: number | null;
  currency: string | null;
  ends_at: string | null;
  is_active: number;
}

export function DiscountsPage() {
  const toast = useToast();
  const promos = useFetch<{ promotions: Promo[]; stripeReady: boolean }>(
    "/api/admin/commerce/promotions",
  );
  const tax = useFetch<{ enabled: boolean; stripeReady: boolean }>("/api/admin/commerce/tax-settings");
  const [creating, setCreating] = useState(false);

  const list = promos.data?.promotions ?? [];
  const stripeReady = promos.data?.stripeReady ?? false;

  async function toggle(p: Promo) {
    try {
      await api.patch(`/api/admin/commerce/promotions/${p.id}`, { isActive: p.is_active ? false : true });
      promos.reload();
    } catch (e) {
      toast.error("Couldn't update", e instanceof ApiRequestError ? e.message : undefined);
    }
  }

  async function setTax(enabled: boolean) {
    try {
      await api.put("/api/admin/commerce/tax-settings", { enabled });
      tax.reload();
      toast.success(
        enabled ? "Sales tax is on" : "Sales tax is off",
        enabled
          ? "Checkout will now add tax. Finish switching on Stripe Tax in your Stripe account too."
          : "Checkout won't add any tax.",
      );
    } catch (e) {
      toast.error("Couldn't update", e instanceof ApiRequestError ? e.message : undefined);
    }
  }

  const valueOf = (p: Promo) =>
    p.percent_off != null
      ? `${p.percent_off}% off`
      : p.amount_off_cents != null
        ? `${(p.amount_off_cents / 100).toLocaleString(undefined, { style: "currency", currency: p.currency || "EUR" })} off`
        : "—";

  return (
    <div>
      <PageHeader
        eyebrow="Commerce"
        title="Discounts & Tax"
        help="discounts"
        description="Make a code your customers can type at checkout, and switch sales tax on when you're ready. No spreadsheets, no Stripe dashboard digging."
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setCreating(true)}
            disabled={!stripeReady}
            title={stripeReady ? "" : "Connect Stripe first"}
          >
            New code
          </button>
        }
      />

      {!stripeReady && (
        <div className="admin-card mb-5 border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Connect your payment account in <span className="font-medium">Settings</span> to start
          offering discount codes — they're applied by Stripe as customers check out.
        </div>
      )}

      {/* Discount codes */}
      <div className="mb-8">
        {promos.loading && <LoadingTable rows={3} />}
        {!promos.loading && list.length === 0 && (
          <EmptyState
            title="No discount codes yet"
            hint="Create your first code — perfect for a launch, a newsletter welcome, or a friends-and-family sale."
          />
        )}
        {list.length > 0 && (
          <div className="admin-card overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Discount</th>
                  <th>Description</th>
                  <th>Expires</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.id} className={p.is_active ? "" : "opacity-50"}>
                    <td>
                      <span className="inline-flex items-center gap-1.5 font-mono font-medium">
                        <Tag size={13} className="text-warmgrey" />
                        {p.code}
                      </span>
                    </td>
                    <td className="font-medium">{valueOf(p)}</td>
                    <td className="max-w-xs truncate text-sm text-warmgrey">{p.description ?? "—"}</td>
                    <td className="text-xs text-warmgrey">{p.ends_at ? formatDate(p.ends_at) : "No end date"}</td>
                    <td>
                      {p.is_active ? (
                        <span className="badge badge-success">Active</span>
                      ) : (
                        <span className="badge badge-neutral">Paused</span>
                      )}
                    </td>
                    <td className="text-right">
                      <button type="button" className="link-quiet text-xs" onClick={() => void toggle(p)}>
                        {p.is_active ? "Pause" : "Resume"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sales tax */}
      <div className="admin-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="max-w-xl">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-warmgrey">
              <Percent size={15} /> Sales tax / VAT
            </h2>
            <p className="mt-2 text-sm text-ink/80">
              When this is on, checkout calculates and adds the right sales tax or VAT for each
              customer's address automatically — no rate tables to maintain.
            </p>
            <p className="mt-2 text-xs text-warmgrey">
              One-time setup: in your Stripe account, turn on{" "}
              <a
                href="https://dashboard.stripe.com/settings/tax"
                target="_blank"
                rel="noreferrer"
                className="link-quiet inline-flex items-center gap-0.5"
              >
                Stripe Tax <ExternalLink size={11} />
              </a>{" "}
              and set your business address. Then flip the switch here.
            </p>
          </div>
          <label className="flex shrink-0 cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              className="peer sr-only"
              checked={tax.data?.enabled ?? false}
              disabled={!tax.data?.stripeReady}
              onChange={(e) => void setTax(e.target.checked)}
            />
            <span className="relative h-6 w-11 rounded-full bg-ink/20 transition peer-checked:bg-navy peer-disabled:opacity-40 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5" />
            <span className="text-sm font-medium">{tax.data?.enabled ? "On" : "Off"}</span>
          </label>
        </div>
      </div>

      <LoyaltyCard />

      <SlideOver open={creating} title="New discount code" onClose={() => setCreating(false)}>
        <NewCodeForm
          onCreated={() => {
            setCreating(false);
            promos.reload();
            toast.success("Code created", "Customers can use it at checkout right away.");
          }}
        />
      </SlideOver>
    </div>
  );
}

function NewCodeForm({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState({
    code: "",
    description: "",
    kind: "percent" as "percent" | "amount",
    percentOff: "",
    amountOff: "",
    currency: "EUR",
    endsAt: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/admin/commerce/promotions", {
        code: form.code,
        description: form.description || undefined,
        kind: form.kind,
        percentOff: form.kind === "percent" ? Number(form.percentOff) : undefined,
        amountOff: form.kind === "amount" ? Number(form.amountOff) : undefined,
        currency: form.currency,
        endsAt: form.endsAt || null,
      });
      onCreated();
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : "Couldn't create the code.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 text-sm">
      <label className="block">
        <span className="label">Code customers will type</span>
        <input
          className="input font-mono uppercase"
          placeholder="WELCOME10"
          value={form.code}
          onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
        />
      </label>

      <div>
        <span className="label">Discount</span>
        <div className="flex overflow-hidden rounded-md border border-ink/15">
          {(
            [
              ["percent", "Percentage"],
              ["amount", "Fixed amount"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setForm({ ...form, kind: value })}
              className={`flex-1 px-3 py-2 text-xs uppercase tracking-wider ${
                form.kind === value ? "bg-navy text-chalk" : "bg-white text-ink/60 hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {form.kind === "percent" ? (
        <label className="block">
          <span className="label">Percent off</span>
          <div className="flex items-center gap-2">
            <input
              className="input"
              inputMode="numeric"
              placeholder="10"
              value={form.percentOff}
              onChange={(e) => setForm({ ...form, percentOff: e.target.value })}
            />
            <span className="text-warmgrey">%</span>
          </div>
        </label>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          <label className="col-span-2 block">
            <span className="label">Amount off</span>
            <input
              className="input"
              inputMode="decimal"
              placeholder="10.00"
              value={form.amountOff}
              onChange={(e) => setForm({ ...form, amountOff: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="label">Currency</span>
            <input
              className="input"
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
            />
          </label>
        </div>
      )}

      <label className="block">
        <span className="label">Description (just for you)</span>
        <input
          className="input"
          placeholder="Newsletter welcome offer"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </label>

      <label className="block">
        <span className="label">Expires (optional)</span>
        <input
          type="date"
          className="input"
          value={form.endsAt}
          onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
        />
      </label>

      {error && <p className="field-error">{error}</p>}
      <button type="button" className="btn btn-primary w-full" disabled={busy} onClick={() => void submit()}>
        {busy ? "Creating…" : "Create code"}
      </button>
    </div>
  );
}

// ---------- Loyalty & referral ----------
function LoyaltyCard() {
  const toast = useToast();
  const loyalty = useFetch<{
    enabled: boolean;
    earnPct: number;
    referralRewardCents: number;
    friendPct: number;
    stripeReady: boolean;
  }>("/api/admin/commerce/loyalty-settings");
  const [form, setForm] = useState({ enabled: false, earnPct: "5", referralReward: "10", friendPct: "10" });
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  if (loyalty.data && !loaded) {
    setForm({
      enabled: loyalty.data.enabled,
      earnPct: String(loyalty.data.earnPct || 5),
      referralReward: String((loyalty.data.referralRewardCents || 1000) / 100),
      friendPct: String(loyalty.data.friendPct || 10),
    });
    setLoaded(true);
  }

  async function save() {
    setBusy(true);
    try {
      await api.put("/api/admin/commerce/loyalty-settings", {
        enabled: form.enabled,
        earnPct: Number(form.earnPct) || 0,
        referralRewardCents: Math.round((Number(form.referralReward) || 0) * 100),
        friendPct: Number(form.friendPct) || 0,
      });
      toast.success("Loyalty saved");
      loyalty.reload();
    } catch (e) {
      toast.error("Couldn't save", e instanceof ApiRequestError ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-card mt-6 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="max-w-xl">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-warmgrey">Loyalty & referrals</h2>
          <p className="mt-2 text-sm text-ink/80">
            Reward the customers who come back. Shoppers earn store credit on every order and for
            referring friends, and redeem it as a one-time code at checkout.
          </p>
        </div>
        <label className="flex shrink-0 cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            className="peer sr-only"
            checked={form.enabled}
            disabled={!loyalty.data?.stripeReady}
            onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
          />
          <span className="relative h-6 w-11 rounded-full bg-ink/20 transition peer-checked:bg-navy peer-disabled:opacity-40 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5" />
          <span className="text-sm font-medium">{form.enabled ? "On" : "Off"}</span>
        </label>
      </div>

      {form.enabled && (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="label">Credit earned per order</span>
              <div className="flex items-center gap-1">
                <input className="input" inputMode="decimal" value={form.earnPct} onChange={(e) => setForm({ ...form, earnPct: e.target.value })} />
                <span className="text-warmgrey">%</span>
              </div>
            </label>
            <label className="block">
              <span className="label">Referrer reward</span>
              <input className="input" inputMode="decimal" placeholder="10.00" value={form.referralReward} onChange={(e) => setForm({ ...form, referralReward: e.target.value })} />
            </label>
            <label className="block">
              <span className="label">Friend's first-order discount</span>
              <div className="flex items-center gap-1">
                <input className="input" inputMode="decimal" value={form.friendPct} onChange={(e) => setForm({ ...form, friendPct: e.target.value })} />
                <span className="text-warmgrey">%</span>
              </div>
            </label>
          </div>
          {!loyalty.data?.stripeReady && (
            <p className="mt-2 text-xs text-warmgrey">Connect Stripe — credit is redeemed as a checkout code.</p>
          )}
        </>
      )}

      <button type="button" className="btn btn-secondary mt-4 !py-1.5 text-sm" disabled={busy} onClick={() => void save()}>
        {busy ? "Saving…" : "Save loyalty settings"}
      </button>
    </div>
  );
}
