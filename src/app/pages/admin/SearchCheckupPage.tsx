import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { api } from "../../lib/api";
import { useFetch } from "../../lib/useFetch";
import { ErrorNote, LoadingTable, PageHeader } from "../../components/admin/ui";
import { CheckupList, checkupSummary, type CheckupResult } from "../../components/admin/CheckupList";

/**
 * Search Checkup — a categorised SEO / AI-visibility audit run against the
 * shop's own content AND its live storefront (see services/seo-checkup.ts).
 * Findings sort worst-first (Warnings → Tips → Growth → Passing) and expand
 * for detail plus a one-tap fix. Structural plumbing (sitemaps, per-page tags,
 * product schema, llms.txt) is automatic on Verto and shows as passing.
 */
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
            <p className="text-sm text-warmgrey">{checkupSummary(data.counts)}</p>
            <button
              type="button"
              onClick={reload}
              className="inline-flex items-center gap-1.5 text-xs text-warmgrey transition hover:text-ink"
            >
              <RefreshCw size={13} /> Re-run
            </button>
          </div>
          <CheckupList checks={data.checks} saving={saving} onSave={saveSetting} />
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
