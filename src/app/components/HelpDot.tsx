import { Link } from "react-router";
import { findArticle } from "../kb";

/**
 * Contextual help affordance. Drop next to any title or control:
 *   <HelpDot slug="products" />            → links to the Products chapter
 *   <HelpDot slug="variants" anchor="skus" text="How SKUs work" />
 *
 * Shows a small "?" that reveals a tooltip (the chapter summary) on hover/focus
 * and deep-links into the Knowledge Base. The summary is pulled from the KB so
 * there's a single source of truth.
 */
export function HelpDot({
  slug,
  anchor,
  text,
}: {
  slug: string;
  anchor?: string;
  text?: string;
}) {
  const article = findArticle(slug);
  const href = `/admin/support/kb/${slug}${anchor ? `#${anchor}` : ""}`;
  const tip = text ?? article?.summary ?? "Open the guide";

  return (
    <span className="group relative inline-flex align-middle">
      <Link
        to={href}
        aria-label={`Help: ${article?.title ?? slug}`}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-warmgrey/40 text-[0.6rem] font-semibold leading-none text-warmgrey transition hover:border-navy hover:bg-navy hover:text-chalk focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/40"
      >
        ?
      </Link>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-6 z-30 w-56 -translate-x-1/2 rounded-lg border border-ink/10 bg-white p-2.5 text-left text-xs leading-snug text-ink/80 opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {article && (
          <span className="mb-0.5 block font-semibold text-ink">{article.title}</span>
        )}
        {tip}
        <span className="mt-1 block font-medium text-navy">Open guide →</span>
      </span>
    </span>
  );
}
