import { useLocation } from "react-router";
import { useFetch } from "../../lib/useFetch";
import { langParam, useLang } from "../../lib/lang";
import { Markdown } from "../../components/Markdown";
import { PageBlocks } from "../../components/PageBlocks";
import type { PublicPage } from "../../../shared/types";

/**
 * Renders any published `pages` row in its chosen layout:
 *  - standard: narrow editorial prose (the classic)
 *  - hero: full-bleed image (or navy band) header with title overlay
 *  - wide: broad centered editorial with optional image under the title
 * Pages composed of block sections render those instead of the body.
 */
export function MarkdownPage({ slug, eyebrow }: { slug: string; eyebrow?: string }) {
  const { lang, defaultLang } = useLang();
  const preview = new URLSearchParams(useLocation().search).get("preview");
  const params = [
    langParam(lang, defaultLang),
    preview ? `preview=${encodeURIComponent(preview)}` : "",
  ]
    .filter(Boolean)
    .join("&");
  const { data, loading, error } = useFetch<PublicPage>(
    `/api/public/pages/${slug}${params ? `?${params}` : ""}`,
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-5 py-16">
        <div className="skeleton h-10 w-2/3" />
        <div className="skeleton h-4 w-full" />
        <div className="skeleton h-4 w-5/6" />
        <div className="skeleton h-4 w-4/6" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16">
        <p className="prose-editorial">This page is being written. Check back soon.</p>
      </div>
    );
  }

  const kicker = data.heroEyebrow ?? eyebrow;
  const hasSections = Boolean(data.sections && data.sections.length > 0);
  const body = hasSections ? (
    <PageBlocks sections={data.sections!} />
  ) : (
    <div className="mx-auto max-w-2xl px-5 py-16">
      <Markdown text={data.bodyMd ?? ""} headingBase={2} />
    </div>
  );

  if (data.layout === "hero") {
    return (
      <article>
        <header className="relative bg-navy text-chalk">
          {data.heroImageUrl && (
            <>
              <img
                src={data.heroImageUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-ink/50" />
            </>
          )}
          <div className="relative mx-auto max-w-4xl px-5 py-28 text-center md:py-40">
            {kicker && <p className="eyebrow mb-4 !text-chalk/70">{kicker}</p>}
            <h1 className="display-hero text-4xl !text-chalk md:text-6xl">{data.title}</h1>
            {data.subtitle && (
              <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-chalk/80">
                {data.subtitle}
              </p>
            )}
          </div>
        </header>
        {body}
      </article>
    );
  }

  if (data.layout === "wide") {
    return (
      <article className={hasSections ? "" : "mx-auto max-w-4xl px-5 py-16"}>
        <header className={`text-center ${hasSections ? "mx-auto max-w-4xl px-5 pt-16 pb-4" : "mb-10"}`}>
          {kicker && <p className="eyebrow mb-3">{kicker}</p>}
          <h1 className="display-hero text-4xl md:text-5xl">{data.title}</h1>
          {data.subtitle && (
            <p className="prose-editorial mx-auto mt-4 max-w-2xl">{data.subtitle}</p>
          )}
        </header>
        {data.heroImageUrl && !hasSections && (
          <img
            src={data.heroImageUrl}
            alt=""
            className="mb-12 aspect-[21/9] w-full object-cover"
          />
        )}
        {hasSections ? (
          <PageBlocks sections={data.sections!} />
        ) : (
          <div className="mx-auto max-w-3xl">
            <Markdown text={data.bodyMd ?? ""} headingBase={2} />
          </div>
        )}
      </article>
    );
  }

  // standard
  if (hasSections) {
    return (
      <article>
        <header className="mx-auto max-w-2xl px-5 pt-16 pb-4">
          {kicker && <p className="eyebrow mb-3">{kicker}</p>}
          <h1 className="display-hero mb-3 text-4xl">{data.title}</h1>
          {data.subtitle && <p className="prose-editorial text-warmgrey">{data.subtitle}</p>}
        </header>
        <PageBlocks sections={data.sections!} />
      </article>
    );
  }
  return (
    <div className="mx-auto max-w-2xl px-5 py-16">
      <article>
        {kicker && <p className="eyebrow mb-3">{kicker}</p>}
        <h1 className="display-hero mb-3 text-4xl">{data.title}</h1>
        {data.subtitle && <p className="prose-editorial mb-8 text-warmgrey">{data.subtitle}</p>}
        {!data.subtitle && <div className="mb-8" />}
        {data.heroImageUrl && (
          <img src={data.heroImageUrl} alt="" className="mb-8 w-full object-cover" />
        )}
        <Markdown text={data.bodyMd ?? ""} headingBase={2} />
      </article>
    </div>
  );
}
