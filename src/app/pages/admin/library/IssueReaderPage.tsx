import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { ChevronLeft, ChevronRight, Pin } from "lucide-react";
import { api, ApiRequestError } from "../../../lib/api";
import { useToast } from "../../../lib/toast";
import { iaPage } from "./shared";

/** The reader: one scanned page at a time, straight from the Archive's IIIF
 *  service. Arrow keys turn pages; any page can be pinned with its citation. */

interface IssueMeta {
  iaId: string;
  title: string;
  date: string | null;
  leafCount: number;
}

export function IssueReaderPage() {
  const { iaId = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const [meta, setMeta] = useState<IssueMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const leaf = Math.max(0, parseInt(params.get("p") || "0", 10) || 0);

  useEffect(() => {
    api
      .get<IssueMeta>(`/api/admin/library/issue/${iaId}`)
      .then(setMeta)
      .catch((err) => setError(err instanceof ApiRequestError ? err.message : "Couldn't open that issue."));
  }, [iaId]);

  const go = useCallback(
    (next: number) => {
      if (!meta) return;
      const clamped = Math.min(Math.max(0, next), meta.leafCount - 1);
      setParams({ p: String(clamped) }, { replace: true });
      setLoading(true);
    },
    [meta, setParams],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(leaf + 1);
      if (e.key === "ArrowLeft") go(leaf - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, leaf]);

  const pinPage = async () => {
    if (!meta) return;
    try {
      await api.post("/api/admin/library/pins", {
        itemKey: `ia:${meta.iaId}$${leaf}`,
        room: "magazines",
        title: `${meta.title} — p. ${leaf + 1}`,
        date: meta.date,
        thumb: iaPage(meta.iaId, leaf, 300),
        image: iaPage(meta.iaId, leaf, 1200),
        url: `https://archive.org/details/${meta.iaId}`,
        credit: `${meta.title}${meta.date ? ` (${meta.date.slice(0, 10)})` : ""}, page ${leaf + 1} — Internet Archive, public domain`,
      });
      toast.success("Page pinned, citation included.");
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : "Couldn't pin the page.");
    }
  };

  if (error) {
    return (
      <div className="mx-auto max-w-2xl py-12 text-center">
        <p className="text-sm text-warmgrey">{error}</p>
        <Link to="/admin/library/magazines" className="mt-3 inline-block text-sm text-navy underline">
          Back to the magazines
        </Link>
      </div>
    );
  }
  if (!meta) return <div className="skeleton h-96 rounded-xl" />;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="sticky top-0 z-10 -mx-1 mb-3 flex flex-wrap items-center justify-between gap-2 rounded-b-lg bg-chalk/95 px-1 pb-2 pt-1 backdrop-blur">
        <div className="min-w-0">
          <Link to="/admin/library/magazines" className="text-xs text-navy underline">
            ← Magazines
          </Link>
          <p className="truncate text-sm font-medium text-ink">{meta.title}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={pinPage} className="inline-flex items-center gap-1 rounded border border-ink/15 px-2.5 py-1 text-xs text-ink/80" title="Pin this page with its citation">
            <Pin size={12} /> Pin page
          </button>
          <button onClick={() => go(leaf - 1)} disabled={leaf === 0} className="rounded border border-ink/15 p-1.5 disabled:opacity-40" aria-label="Previous page">
            <ChevronLeft size={16} />
          </button>
          <span className="text-xs tabular-nums text-warmgrey">
            {leaf + 1} / {meta.leafCount}
          </span>
          <button onClick={() => go(leaf + 1)} disabled={leaf >= meta.leafCount - 1} className="rounded border border-ink/15 p-1.5 disabled:opacity-40" aria-label="Next page">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-xl border border-ink/10 bg-white">
        {loading && <div className="absolute inset-0 flex items-center justify-center text-xs uppercase tracking-editorial text-warmgrey">Turning…</div>}
        <img
          key={leaf}
          src={iaPage(meta.iaId, leaf, 880)}
          alt={`${meta.title}, page ${leaf + 1}`}
          onLoad={() => setLoading(false)}
          onError={() => setLoading(false)}
          className="relative mx-auto w-full max-w-[880px]"
        />
      </div>

      <input
        type="range"
        min={0}
        max={meta.leafCount - 1}
        value={leaf}
        onChange={(e) => go(parseInt(e.target.value, 10))}
        className="mt-3 w-full"
        aria-label="Page"
      />
      <p className="mt-2 text-center text-[0.68rem] text-warmgrey">
        Scan served live by the Internet Archive · public domain · ← → keys turn pages
      </p>
    </div>
  );
}
