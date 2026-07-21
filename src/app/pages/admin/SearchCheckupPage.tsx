import { useState } from "react";
import { Link } from "react-router";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Lightbulb,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import { api } from "../../lib/api";
import { useFetch } from "../../lib/useFetch";
import { ErrorNote, LoadingTable, PageHeader } from "../../components/admin/ui";

/**
 * Search Checkup — a categorised SEO / AI-visibility audit run against the
 * shop's own content AND its live storefront (see services/seo-checkup.ts).
 * Findings sort worst-first (Warnings → Tips → Growth → Passing) and expand
 * for detail plus a one-tap fix. Structural plumbing (sitemaps, per-page tags,
 * product schema, llms.txt) is automatic on Verto and shows as passing.
 */

type Tier = "warning" | "tip" | "growth" | "pass";

interface CheckItem {
  id: string;
  tier: Tier;
  title: string;
  detail: string;
  fix?: { label: string; to?: string; href?: string };
  control?: "visibility" | "verification" | "og_image";
  specifics?: string[];
  value?: string;
}

interface CheckupResult {
  checks: CheckItem[];
  counts: { warning: number; tip: number; growth: number; pass: number };
  liveChecked: boolean;
  poweredByAi: boolean;
}

const TIER_ORDER: Record<Tier, number> = { warning: 0, tip: 1, growth: 2, pass: 3 };

const TIER_ICON: Record<Tier, { Icon: typeof AlertTriangle; color: string; bg: string }> = {
  warning: { Icon: AlertTriangle, color: "text-saffron", bg: "bg-saffron/10" },
  tip: { Icon: Lightbulb, color: "text-blue-500", bg: "bg-blue-500/10" },
  growth: { Icon: TrendingUp, color: "text-purple-500", bg: "bg-purple-500/10" },
  pass: { Icon: CheckCircle2, color: "text-palm", bg: "bg-palm/10" },
};

export function SearchCheckupPage() {
  const { data, loading, error, reload } = useFetch<CheckupResult>("/api/admin/settings/seo-checkup");
  const [saving, setSaving] = useState<string | null>(null);

  async function saveSetting(key: string, value: string) {
    setSaving(key);
    try {
      await api.patch("/api/admin/settings", { [key]: value });
      reload();
    } finally {
      setSaving(null);
    }
  }

  const checks = data ? [...data.checks].sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier]) : [];
  const c = data?.counts;
  const summary = c
    ? [
        c.warning > 0 ? `${c.warning} to fix` : null,
        c.tip > 0 ? `${c.tip} quick win${c.tip === 1 ? "" : "s"}` : null,
        c.growth > 0 ? `${c.growth} growth idea${c.growth === 1 ? "" : "s"}` : null,
        `${c.pass} passing`,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  return (
    <div className="max-w-3xl">
      <PageHeader
        eyebrow="Content"
        title="Search Checkup"
        help="seo"
        description="How your shop looks to Google and AI assistants — checked against your live storefront. The plumbing is automatic; these are the parts that move the needle."
      />
      {error && <ErrorNote message={error} />}
      {loading && <LoadingTable rows={6} />}
      {data && (
        <>
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-sm text-warmgrey">{summary}</p>
            <button
              type="button"
              onClick={reload}
              className="inline-flex items-center gap-1.5 text-xs text-warmgrey transition hover:text-ink"
            >
              <RefreshCw size={13} /> Re-run
            </button>
          </div>
          <div className="admin-card divide-y divide-black/5 overflow-hidden !p-0">
            {checks.map((check) => (
              <CheckRow key={check.id} check={check} saving={saving} onSave={saveSetting} />
            ))}
          </div>
          {!data.liveChecked && (
            <p className="mt-3 text-xs text-warmgrey">
              Some live checks couldn't reach your storefront just now — re-run in a moment for the full picture.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function CheckRow({
  check,
  saving,
  onSave,
}: {
  check: CheckItem;
  saving: string | null;
  onSave: (key: string, value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const { Icon, color, bg } = TIER_ICON[check.tier];
  const muted = check.tier === "pass";

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-black/[0.015]"
      >
        <span className={`flex size-8 shrink-0 items-center justify-center rounded-full ${bg}`}>
          <Icon size={16} className={color} />
        </span>
        <span className={`min-w-0 flex-1 text-sm font-medium ${muted ? "text-warmgrey" : "text-ink"}`}>
          {check.title}
          {check.tier === "growth" && (
            <span className="ml-2 align-middle text-[0.7rem] font-normal uppercase tracking-wider text-purple-500">
              Powered by Verto AI
            </span>
          )}
        </span>
        <ChevronRight
          size={16}
          className={`shrink-0 text-warmgrey transition-transform ${open ? "rotate-90" : ""}`}
        />
      </button>
      {open && (
        <div className="px-4 pb-4 pl-[3.75rem]">
          <p className="text-sm leading-relaxed text-warmgrey">{check.detail}</p>

          {check.specifics && check.specifics.length > 0 && (
            <p className="mt-2 text-xs text-warmgrey">
              {check.specifics.slice(0, 8).join(" · ")}
              {check.specifics.length > 8 && " · …"}
            </p>
          )}

          {check.control === "visibility" && (
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={check.value === "public"}
                disabled={saving === "search_visibility"}
                onChange={(e) => onSave("search_visibility", e.target.checked ? "public" : "hidden")}
              />
              Visible to search engines
            </label>
          )}

          {check.control === "verification" && (
            <div className="mt-3 space-y-2">
              <input
                className="input !py-1.5 text-sm"
                placeholder="google-site-verification content value"
                onBlur={(e) => {
                  if (e.target.value.trim()) onSave("site_verification_google", e.target.value.trim());
                }}
              />
              <input
                className="input !py-1.5 text-sm"
                placeholder="Bing msvalidate.01 value (optional)"
                onBlur={(e) => {
                  if (e.target.value.trim()) onSave("site_verification_bing", e.target.value.trim());
                }}
              />
            </div>
          )}

          {check.control === "og_image" && (
            <input
              className="input mt-3 !py-1.5 text-sm"
              placeholder="/media/… or https://…"
              defaultValue={check.value ?? ""}
              onBlur={(e) => onSave("default_og_image", e.target.value.trim())}
            />
          )}

          {check.fix && (
            <div className="mt-3">
              {check.fix.to ? (
                <Link to={check.fix.to} className="btn btn-secondary !px-3 !py-1.5 text-xs">
                  {check.fix.label}
                </Link>
              ) : (
                <a
                  href={check.fix.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium underline"
                >
                  {check.fix.label} <ExternalLink size={11} />
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
