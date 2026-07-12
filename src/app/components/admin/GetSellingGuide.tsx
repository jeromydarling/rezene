import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { api } from "../../lib/api";
import { useToast } from "../../lib/toast";
import { getShopBase, isDemoShop } from "../../lib/shop";
import { HelpDot } from "../HelpDot";

/** Mirror of the worker's ActivationStep / ActivationState. */
interface Step {
  id: string;
  title: string;
  why: string;
  href: string;
  cta: string;
  done: boolean;
  optional?: boolean;
  detail?: string;
}
interface ActivationState {
  steps: Step[];
  percent: number;
  open: boolean;
  persisted: { dismissed: boolean; sharedClicked: boolean; celebratedAt: string | null };
}

/** A quiet SVG progress ring — reads at a glance without a chart library. */
function Ring({ percent }: { percent: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const filled = (percent / 100) * c;
  return (
    <svg viewBox="0 0 64 64" className="h-16 w-16 shrink-0 -rotate-90">
      <circle cx="32" cy="32" r={r} fill="none" stroke="currentColor" strokeWidth="5" className="text-ink/10" />
      <circle
        cx="32"
        cy="32"
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${c}`}
        className={percent >= 100 ? "text-emerald-600" : "text-terracotta"}
      />
    </svg>
  );
}

function CheckIcon({ done }: { done: boolean }) {
  return done ? (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
      <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor">
        <path
          fillRule="evenodd"
          d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.3 3.3 6.8-6.8a1 1 0 0 1 1.4 0Z"
          clipRule="evenodd"
        />
      </svg>
    </span>
  ) : (
    <span className="h-6 w-6 shrink-0 rounded-full border-2 border-dashed border-ink/25" />
  );
}

/**
 * "Get Selling Fast" — the activation guide on the dashboard home. It reads
 * live, derived state, so a step ticks the instant the merchant actually does
 * it (adds a priced product, connects Stripe, publishes). Once the shop can
 * take a real order it celebrates once, then quietly steps aside.
 */
export function GetSellingGuide() {
  const toast = useToast();
  const [state, setState] = useState<ActivationState | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [hidden, setHidden] = useState(false);

  const load = useCallback(() => {
    api
      .get<ActivationState>("/api/admin/onboarding")
      .then(setState)
      .catch(() => setHidden(true));
  }, []);

  useEffect(() => {
    if (isDemoShop()) {
      setHidden(true);
      return;
    }
    load();
  }, [load]);

  // First time the shop is fully open, celebrate — once.
  useEffect(() => {
    if (state?.open && !state.persisted.celebratedAt) {
      toast.success("You're open for business", "Your shop can take real orders now. Go get that first sale.");
      api.patch("/api/admin/onboarding", { celebrated: true }).catch(() => {});
    }
  }, [state, toast]);

  if (hidden || !state) return null;

  // A dismissed guide only stays hidden while the shop is genuinely open.
  // If something regresses (last product archived, say) it comes back.
  if (state.persisted.dismissed && state.open) return null;

  const done = state.steps.filter((s) => s.done).length;
  const total = state.steps.length;
  const next = state.steps.find((s) => !s.done);

  async function markShared() {
    const base = getShopBase();
    const url = `${window.location.origin}${base || ""}`;
    try {
      await navigator.clipboard?.writeText(url);
      toast.success("Shop link copied", url);
    } catch {
      /* clipboard blocked — the toast below still confirms */
    }
    await api.patch("/api/admin/onboarding", { sharedClicked: true }).catch(() => {});
    load();
  }

  async function dismiss() {
    setHidden(true);
    await api.patch("/api/admin/onboarding", { dismissed: true }).catch(() => {});
  }

  return (
    <div className="mb-8 overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-sm">
      {/* Header — progress ring, headline, next action */}
      <div className="flex flex-wrap items-center gap-4 border-b border-ink/8 bg-gradient-to-r from-terracotta/5 to-transparent px-5 py-4">
        <div className="relative">
          <Ring percent={state.percent} />
          <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold tabular-nums text-ink">
            {state.percent}%
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[0.66rem] font-medium uppercase tracking-editorial text-terracotta">
            Get selling fast
            <HelpDot slug="get-selling-fast" />
          </p>
          <h2 className="font-display text-xl font-light text-ink">
            {state.open ? "You're open for business 🎉" : "Let's open your shop"}
          </h2>
          <p className="mt-0.5 text-sm text-warmgrey">
            {state.open
              ? "Everything a sale needs is in place. Keep going to make your first one."
              : next
                ? `${done} of ${total} done — next up: ${next.title.toLowerCase()}.`
                : `${done} of ${total} done.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="rounded-full border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink/70 transition hover:bg-ink/5"
          >
            {collapsed ? "Show steps" : "Hide steps"}
          </button>
          <button
            onClick={dismiss}
            title="Dismiss (comes back if your shop needs setup again)"
            className="rounded-full p-1.5 text-ink/40 transition hover:bg-ink/5 hover:text-ink"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
              <path d="M6.3 6.3a1 1 0 0 1 1.4 0L10 8.6l2.3-2.3a1 1 0 1 1 1.4 1.4L11.4 10l2.3 2.3a1 1 0 0 1-1.4 1.4L10 11.4l-2.3 2.3a1 1 0 0 1-1.4-1.4L8.6 10 6.3 7.7a1 1 0 0 1 0-1.4Z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Steps */}
      {!collapsed && (
        <ol className="divide-y divide-ink/8">
          {state.steps.map((step) => (
            <li key={step.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
              <CheckIcon done={step.done} />
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium ${step.done ? "text-ink/50 line-through decoration-ink/20" : "text-ink"}`}>
                  {step.title}
                  {step.optional && <span className="ml-2 text-[0.62rem] uppercase tracking-editorial text-warmgrey">optional</span>}
                </p>
                <p className="text-xs text-warmgrey">{step.detail ?? step.why}</p>
              </div>
              {!step.done &&
                (step.id === "share" ? (
                  <button
                    onClick={markShared}
                    className="shrink-0 rounded-full bg-navy px-4 py-1.5 text-xs font-medium text-chalk transition hover:bg-ink"
                  >
                    {step.cta}
                  </button>
                ) : (
                  <Link
                    to={step.href}
                    className="shrink-0 rounded-full bg-navy px-4 py-1.5 text-xs font-medium text-chalk transition hover:bg-ink"
                  >
                    {step.cta}
                  </Link>
                ))}
              {step.done && step.id !== "brand" && (
                <Link to={step.href} className="shrink-0 text-xs font-medium text-terracotta hover:underline">
                  Review
                </Link>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
