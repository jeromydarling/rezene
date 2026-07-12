import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { PageHeader } from "../../../components/admin/ui";
import { api } from "../../../lib/api";
import { useFetch } from "../../../lib/useFetch";
import { useToast } from "../../../lib/toast";
import { ResearchNav, sinceLabel } from "./shared";

/**
 * The R&D studio's front door: what you're researching, what's being
 * watched for you, and what came back recently — with one ask box that
 * saves straight into notes. The rooms (makers, brands, pricing, trends,
 * stockists) hang off the shared sub-nav.
 */

interface Overview {
  counts: {
    makers: number;
    notes: number;
    brands: number;
    priceStudies: number;
    trendBoards: number;
    stockists: number;
    strategy: number;
  };
  watched: { kind: string; id: string; name: string; lastResearchedAt: string | null }[];
  recent: { kind: string; title: string; createdAt: string }[];
  research: { enabled: boolean; used: number; limit: number };
}

const ROOMS: {
  key: keyof Overview["counts"];
  to: string;
  title: string;
  blurb: string;
}[] = [
  {
    key: "makers",
    to: "/admin/research/makers",
    title: "Makers & notes",
    blurb: "Candidate makers with a pipeline, plus every finding you've saved — cited answers included.",
  },
  {
    key: "brands",
    to: "/admin/research/brands",
    title: "Brand dossiers",
    blurb: "Who else sells to your customer — positioning, price architecture, channels. Watch the ones that matter.",
  },
  {
    key: "priceStudies",
    to: "/admin/research/pricing",
    title: "Price studies",
    blurb: "Real comparables at real prices, a band, and a decision that pushes into Costing & Margins.",
  },
  {
    key: "trendBoards",
    to: "/admin/research/trends",
    title: "Trend boards",
    blurb: "Season scouting — silhouettes, fabrics, colors. Adopted directions open in the Design Studio.",
  },
  {
    key: "stockists",
    to: "/admin/research/stockists",
    title: "Stockists",
    blurb: "The doors that could carry the label, researched and pitched, from shortlist to stocked.",
  },
  {
    key: "strategy",
    to: "/admin/research/strategy",
    title: "Business strategy",
    blurb: "Work with a strategy advisor to build SWOTs, business plans, OKRs, and competitive maps — then put the next steps on your calendar.",
  },
];

const COUNT_LABEL: Record<string, [string, string]> = {
  makers: ["maker", "makers"],
  brands: ["dossier", "dossiers"],
  priceStudies: ["study", "studies"],
  trendBoards: ["board", "boards"],
  stockists: ["stockist", "stockists"],
  strategy: ["document", "documents"],
};

export function ResearchHomePage() {
  const toast = useToast();
  const navigate = useNavigate();
  const overview = useFetch<Overview>("/api/admin/research/overview");
  const [askPrompt, setAskPrompt] = useState("");
  const [asking, setAsking] = useState(false);

  const ask = async () => {
    if (!askPrompt.trim()) return;
    setAsking(true);
    try {
      await api.post("/api/admin/research/ask", { prompt: askPrompt.trim() });
      toast.success("Answer saved to your notes, citations included.");
      setAskPrompt("");
      navigate("/admin/research/makers");
    } catch {
      /* handled by api layer */
    } finally {
      setAsking(false);
    }
  };

  const o = overview.data;

  return (
    <div>
      <PageHeader
        title="R&D"
        eyebrow="Production"
        description="Your research studio — makers, competitors, prices, trends, and the doors that could carry the label. Live answers always arrive with their sources."
        help="rd-research"
      />
      <ResearchNav />

      {/* Ask box */}
      <div className="mb-4 rounded-xl border border-ink/10 bg-white p-3">
        <div className="flex flex-wrap items-end gap-2">
          <label className="w-full text-xs text-warmgrey sm:w-auto sm:min-w-0 sm:flex-1">
            Ask anything — the answer lands in your notes with its sources
            <input
              value={askPrompt}
              onChange={(e) => setAskPrompt(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && ask()}
              placeholder="e.g. What do contemporary linen shirts retail for in US boutiques right now?"
              className="mt-0.5 block w-full rounded border border-ink/15 px-2 py-1.5 text-sm"
            />
          </label>
          <button
            onClick={ask}
            disabled={asking || o?.research.enabled === false}
            className="rounded bg-navy px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            {asking ? "Researching…" : "Research"}
          </button>
        </div>
        {o && (
          <p className="mt-1 text-xs text-warmgrey">
            {o.research.enabled
              ? `${o.research.used} of ${o.research.limit} research calls used today — the same allowance covers every room and the watch refreshes.`
              : "Live research isn't configured on this environment — every room still works as a notebook."}
          </p>
        )}
      </div>

      {/* Rooms */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ROOMS.map((room) => {
          const n = o?.counts[room.key] ?? 0;
          const [one, many] = COUNT_LABEL[room.key];
          return (
            <Link
              key={room.key}
              to={room.to}
              className="rounded-xl border border-ink/10 bg-white p-4 transition hover:border-navy/40 hover:shadow-sm"
            >
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-display text-base text-ink">{room.title}</h3>
                <span className="text-xs text-warmgrey">
                  {overview.loading ? "…" : `${n} ${n === 1 ? one : many}`}
                </span>
              </div>
              <p className="mt-1 text-sm text-warmgrey">{room.blurb}</p>
            </Link>
          );
        })}
        {o && o.counts.notes > 0 && (
          <div className="rounded-xl border border-dashed border-ink/15 p-4 text-sm text-warmgrey">
            {o.counts.notes} research {o.counts.notes === 1 ? "note" : "notes"} saved so far — every
            live answer keeps its citations, so the trail is an asset, not an evaporating chat.
          </div>
        )}
      </div>

      {/* Watched + recent */}
      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-ink/10 bg-white p-4">
          <h3 className="font-display text-base text-ink">Watching for you</h3>
          {o?.watched.length ? (
            <ul className="mt-2 space-y-1.5">
              {o.watched.map((w) => (
                <li key={w.id} className="flex items-center justify-between gap-2 text-sm">
                  <Link
                    to={w.kind === "brand" ? "/admin/research/brands" : "/admin/research/trends"}
                    className="min-w-0 truncate text-ink hover:underline"
                  >
                    {w.name}
                  </Link>
                  <span className="shrink-0 text-xs text-warmgrey">
                    {w.kind === "brand" ? "brand" : "trend"} · refreshed {sinceLabel(w.lastResearchedAt)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-warmgrey">
              Nothing on watch yet. Flip “Watch” on a brand dossier or trend board and Verto
              re-researches it about once a week — what changed lands in your activity feed and
              daily digest.
            </p>
          )}
        </div>
        <div className="rounded-xl border border-ink/10 bg-white p-4">
          <h3 className="font-display text-base text-ink">Recently in R&D</h3>
          {o?.recent.length ? (
            <ul className="mt-2 space-y-1.5">
              {o.recent.map((r, i) => (
                <li key={i} className="text-sm text-ink/80">
                  {r.title}
                  <span className="ml-2 text-xs text-warmgrey">{sinceLabel(r.createdAt)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-warmgrey">
              Research activity shows up here — promotions to suppliers, refreshed dossiers,
              adopted trends, retail prices pushed into costing.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
