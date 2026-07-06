import { useState } from "react";
import { Link } from "react-router";
import { AlertTriangle, CheckCircle2, ExternalLink } from "lucide-react";
import { api } from "../../lib/api";
import { useFetch } from "../../lib/useFetch";
import { ErrorNote, LoadingTable, PageHeader } from "../../components/admin/ui";
import { getShopBase } from "../../lib/shop";

/**
 * Search Checkup — the SEO audit run against this shop's own content, in
 * merchant language. Everything structural (canonicals, per-page meta,
 * sitemaps, product schema, llms.txt) is automatic on Verto; this screen
 * covers the parts only the shop owner can supply — descriptions, alt
 * text, photography, verification — each with a one-tap route to the fix.
 */

interface Checkup {
  visibility: "public" | "hidden";
  verification: { google: boolean; bing: boolean };
  defaultOgImage: string | null;
  pagesMissingMeta: { slug: string; title: string }[];
  postsMissingMeta: { slug: string; title: string }[];
  productsMissingImages: { slug: string; name: string }[];
  mediaMissingAlt: number;
  publishedPages: number;
}

function CheckRow({
  ok,
  title,
  detail,
  action,
  children,
}: {
  ok: boolean;
  title: string;
  detail: string;
  action?: { label: string; to: string };
  children?: React.ReactNode;
}) {
  return (
    <div className="admin-card p-4">
      <div className="flex items-start gap-3">
        {ok ? (
          <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-palm" />
        ) : (
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-saffron" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{title}</p>
          <p className="mt-0.5 text-sm text-warmgrey">{detail}</p>
          {children}
        </div>
        {action && (
          <Link to={action.to} className="btn btn-secondary shrink-0 !px-3 !py-1.5 text-xs">
            {action.label}
          </Link>
        )}
      </div>
    </div>
  );
}

export function SearchCheckupPage() {
  const { data, loading, error, reload } = useFetch<Checkup>("/api/admin/settings/seo-checkup");
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

  const shopBase = getShopBase();

  return (
    <div className="max-w-3xl">
      <PageHeader
        eyebrow="Content"
        title="Search Checkup"
        description="How your shop looks to Google and AI assistants. The plumbing — sitemaps, per-page tags, product rich results — is automatic; these are the parts only you can supply."
      />
      {error && <ErrorNote message={error} />}
      {loading && <LoadingTable rows={5} />}
      {data && (
        <div className="space-y-3">
          {/* Visibility */}
          <CheckRow
            ok={data.visibility === "public"}
            title={data.visibility === "public" ? "Your shop is visible to search engines" : "Your shop is hidden from search engines"}
            detail={
              data.visibility === "public"
                ? "Every published page is indexable and listed in the sitemap."
                : "Every page carries a noindex tag and the shop is out of the sitemap — flip this on when you're ready to launch."
            }
          >
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={data.visibility === "public"}
                disabled={saving === "search_visibility"}
                onChange={(e) => void saveSetting("search_visibility", e.target.checked ? "public" : "hidden")}
              />
              Visible to search engines
            </label>
          </CheckRow>

          {/* Verification */}
          <CheckRow
            ok={data.verification.google}
            title={data.verification.google ? "Google Search Console is connected" : "Connect Google Search Console"}
            detail="Paste the content value from Google's HTML-tag verification method and we'll serve it on every page. Then submit your sitemap to see search performance."
          >
            <div className="mt-2 flex gap-2">
              <input
                className="input !py-1.5 text-sm"
                placeholder="google-site-verification content value"
                defaultValue=""
                onBlur={(e) => {
                  if (e.target.value.trim()) void saveSetting("site_verification_google", e.target.value.trim());
                }}
              />
            </div>
            <p className="mt-1.5 text-xs text-warmgrey">
              <a
                href="https://search.google.com/search-console"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 underline"
              >
                Open Search Console <ExternalLink size={10} />
              </a>{" "}
              · Bing works too — paste an msvalidate.01 value{" "}
              <input
                className="input !inline-block !w-40 !py-0.5 text-xs"
                placeholder="Bing token"
                onBlur={(e) => {
                  if (e.target.value.trim()) void saveSetting("site_verification_bing", e.target.value.trim());
                }}
              />
              {data.verification.bing && <span className="ml-1 text-palm">✓ set</span>}
            </p>
          </CheckRow>

          {/* Default social image */}
          <CheckRow
            ok={Boolean(data.defaultOgImage)}
            title={data.defaultOgImage ? "Default share image is set" : "Set a default share image"}
            detail="When a page has no hero image, links shared on social and in chat apps fall back to this. Upload to Files, copy its URL, paste here."
            action={{ label: "Open Files", to: "/admin/files" }}
          >
            <input
              className="input mt-2 !py-1.5 text-sm"
              placeholder="/media/… or https://…"
              defaultValue={data.defaultOgImage ?? ""}
              onBlur={(e) => void saveSetting("default_og_image", e.target.value.trim())}
            />
          </CheckRow>

          {/* Page descriptions */}
          <CheckRow
            ok={data.pagesMissingMeta.length === 0}
            title={
              data.pagesMissingMeta.length === 0
                ? "Every page has a search description"
                : `${data.pagesMissingMeta.length} page${data.pagesMissingMeta.length === 1 ? "" : "s"} missing a search description`
            }
            detail={
              data.pagesMissingMeta.length === 0
                ? `All ${data.publishedPages} published pages describe themselves to search results.`
                : "Search engines write their own (often clumsy) snippet when a page has no description. The ✨ AI draft button in the page editor writes one in your voice."
            }
            action={{ label: "Open Pages", to: "/admin/content/pages" }}
          >
            {data.pagesMissingMeta.length > 0 && (
              <p className="mt-1.5 text-xs text-warmgrey">
                {data.pagesMissingMeta.slice(0, 6).map((p) => p.title).join(" · ")}
                {data.pagesMissingMeta.length > 6 && " · …"}
              </p>
            )}
          </CheckRow>

          {/* Journal */}
          <CheckRow
            ok={data.postsMissingMeta.length === 0}
            title={
              data.postsMissingMeta.length === 0
                ? "Journal posts have excerpts"
                : `${data.postsMissingMeta.length} journal post${data.postsMissingMeta.length === 1 ? "" : "s"} missing an excerpt`
            }
            detail="Excerpts double as the search snippet and the share preview."
            action={{ label: "Open Journal", to: "/admin/content/journal" }}
          />

          {/* Product photography */}
          <CheckRow
            ok={data.productsMissingImages.length === 0}
            title={
              data.productsMissingImages.length === 0
                ? "Every live product has photography"
                : `${data.productsMissingImages.length} live product${data.productsMissingImages.length === 1 ? "" : "s"} without photography`
            }
            detail="Products with images are eligible for image search and rich results (we publish Product schema with price and availability automatically)."
            action={{ label: "Open Products", to: "/admin/products" }}
          >
            {data.productsMissingImages.length > 0 && (
              <p className="mt-1.5 text-xs text-warmgrey">
                {data.productsMissingImages.slice(0, 6).map((p) => p.name).join(" · ")}
                {data.productsMissingImages.length > 6 && " · …"}
              </p>
            )}
          </CheckRow>

          {/* Alt text */}
          <CheckRow
            ok={data.mediaMissingAlt === 0}
            title={
              data.mediaMissingAlt === 0
                ? "Public images have alt text"
                : `${data.mediaMissingAlt} public image${data.mediaMissingAlt === 1 ? "" : "s"} missing alt text`
            }
            detail="Alt text is how screen readers and image search understand your photography."
            action={{ label: "Open Files", to: "/admin/files" }}
          />

          {/* Always-on plumbing */}
          <CheckRow
            ok
            title="Sitemap, tags, and rich results are handled"
            detail="Per-page titles and descriptions, canonical URLs, social previews, Product schema, and your sitemap are generated automatically on every publish — nothing to configure."
          >
            <p className="mt-1.5 text-xs text-warmgrey">
              <a href="/sitemap.xml" target="_blank" rel="noreferrer" className="underline">
                View sitemap
              </a>{" "}
              — your shop is listed in it{shopBase ? "" : " at the domain root"}, and on your own
              domain it serves at yourdomain.com/sitemap.xml automatically.
            </p>
          </CheckRow>
        </div>
      )}
    </div>
  );
}
