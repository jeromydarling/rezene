import { NavLink } from "react-router";

/**
 * The R&D studio's own navigation — R&D is a suite of rooms (overview,
 * makers, brands, pricing, trends, stockists), not one long page. Every
 * research surface shares the same promises: live answers always carry
 * their sources, and everything still works as a notebook when live
 * research isn't configured.
 */

export const RESEARCH_TABS = [
  { to: "/admin/research", label: "Overview", end: true },
  { to: "/admin/research/makers", label: "Makers & notes" },
  { to: "/admin/research/brands", label: "Brands" },
  { to: "/admin/research/pricing", label: "Pricing" },
  { to: "/admin/research/trends", label: "Trends" },
  { to: "/admin/research/stockists", label: "Stockists" },
  { to: "/admin/research/strategy", label: "Strategy" },
] as const;

export function ResearchNav() {
  return (
    <nav className="mb-4 flex flex-wrap gap-1.5">
      {RESEARCH_TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={"end" in t && t.end}
          className={({ isActive }) =>
            `rounded-full px-3 py-1 text-sm ${isActive ? "bg-navy text-white" : "bg-ink/5 text-ink/70 hover:bg-ink/10"}`
          }
        >
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}

/** Integer cents → "$1,240" (whole units; research prices don't need cents). */
export function money(cents: number | null | undefined, currency = "USD"): string {
  if (cents === null || cents === undefined) return "—";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: cents % 100 ? 2 : 0,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(0)} ${currency}`;
  }
}

/** "120", "$120", "120.50" → integer cents; empty/garbage → null. */
export function parseMoney(v: string): number | null {
  const t = v.replace(/[^0-9.]/g, "");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

/** Human staleness: "today", "3 days ago", "never". */
export function sinceLabel(iso: string | null | undefined): string {
  if (!iso) return "never";
  const then = new Date(iso.includes("T") ? iso : `${iso.replace(" ", "T")}Z`).getTime();
  if (!Number.isFinite(then)) return "recently";
  const days = Math.floor((Date.now() - then) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "a month ago" : `${months} months ago`;
}

export function Sources({ urls }: { urls: string[] }) {
  if (!urls.length) return null;
  return (
    <div className="mt-2 space-y-0.5">
      <p className="text-xs font-medium text-warmgrey">Sources</p>
      {urls.map((u, i) => (
        <a key={i} href={u} target="_blank" rel="noreferrer" className="block truncate text-xs text-navy underline">
          {u}
        </a>
      ))}
    </div>
  );
}

/** The standard research-action button: one state machine everywhere. */
export function ResearchButton({
  busy,
  refreshed,
  enabled,
  onClick,
  label = "Research",
  refreshLabel = "Refresh research",
}: {
  busy: boolean;
  refreshed: boolean;
  enabled: boolean | undefined;
  onClick: () => void;
  label?: string;
  refreshLabel?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy || enabled === false}
      title={enabled === false ? "Live research isn't configured on this environment" : undefined}
      className="rounded bg-navy px-3 py-1.5 text-sm text-white disabled:opacity-50"
    >
      {busy ? "Researching…" : refreshed ? refreshLabel : label}
    </button>
  );
}

/** Watch pill: opted-in items refresh themselves weekly via the automations
 *  sweep, and what changed lands in the activity feed and digest. */
export function WatchToggle({ watch, onToggle }: { watch: boolean; onToggle: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onToggle(!watch)}
      className={`rounded-full px-2.5 py-0.5 text-xs ${watch ? "bg-terracotta/15 text-terracotta" : "bg-ink/5 text-ink/50 hover:bg-ink/10"}`}
      title="Watched items re-research themselves about once a week; changes land in your activity feed and daily digest."
    >
      {watch ? "● Watching" : "Watch"}
    </button>
  );
}
