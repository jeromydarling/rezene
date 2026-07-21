import { RefreshCw } from "lucide-react";
import { useFetch } from "../../lib/useFetch";
import { ErrorNote, LoadingTable, PageHeader } from "../../components/admin/ui";
import { CheckupList, checkupSummary, type CheckupResult } from "../../components/admin/CheckupList";

/**
 * HQ Marketing SEO — the same Search Checkup, run against the Verto marketing
 * site (verto.style) itself: every public page fetched live and inspected for
 * rendering, meta length, social images, structured data, crawler rules,
 * sitemap coverage, and the llms.txt index. SuperAdmin-only (mounted under the
 * platform routes); findings point at the code that owns each surface.
 */
export function MarketingSeoPage() {
  const { data, loading, error, reload } = useFetch<CheckupResult>("/api/admin/platform/marketing-seo");

  return (
    <div className="max-w-3xl">
      <PageHeader
        eyebrow="Verto HQ"
        title="Marketing SEO"
        description="The Search Checkup, run against verto.style itself — every marketing page fetched live and audited the same way a shop's storefront is."
      />
      {error && <ErrorNote message={error} />}
      {loading && <LoadingTable rows={6} />}
      {data && (
        <>
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-sm text-warmgrey">{checkupSummary(data.counts)}</p>
            <button
              type="button"
              onClick={reload}
              className="inline-flex items-center gap-1.5 text-xs text-warmgrey transition hover:text-ink"
            >
              <RefreshCw size={13} /> Re-run
            </button>
          </div>
          <CheckupList checks={data.checks} />
          {!data.liveChecked && (
            <p className="mt-3 text-xs text-warmgrey">
              Couldn't reach the marketing site just now — re-run in a moment.
            </p>
          )}
        </>
      )}
    </div>
  );
}
