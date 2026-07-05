import { useFetch } from "../../lib/useFetch";
import { Markdown } from "../../components/Markdown";
import type { PublicPage } from "../../../shared/types";

/** Renders any published `pages` row (story, atelier, size guide, legal…). */
export function MarkdownPage({ slug, eyebrow }: { slug: string; eyebrow?: string }) {
  const { data, loading, error } = useFetch<PublicPage>(`/api/public/pages/${slug}`);

  return (
    <div className="mx-auto max-w-2xl px-5 py-16">
      {loading && (
        <div className="space-y-4">
          <div className="skeleton h-10 w-2/3" />
          <div className="skeleton h-4 w-full" />
          <div className="skeleton h-4 w-5/6" />
          <div className="skeleton h-4 w-4/6" />
        </div>
      )}
      {error && <p className="prose-editorial">This page is being written. Check back soon.</p>}
      {data && (
        <article>
          {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
          <h1 className="display-hero mb-8 text-4xl">{data.title}</h1>
          <Markdown text={data.bodyMd ?? ""} />
        </article>
      )}
    </div>
  );
}
