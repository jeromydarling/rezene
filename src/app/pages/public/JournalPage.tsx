import { Link, useParams } from "react-router";
import { useFetch } from "../../lib/useFetch";
import { formatDate } from "../../lib/format";
import { Markdown } from "../../components/Markdown";
import { EditorialImage } from "../../components/ImagePlaceholder";
import type { PublicJournalPost } from "../../../shared/types";

export function JournalPage() {
  const { data, loading } = useFetch<PublicJournalPost[]>("/api/public/journal");
  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <p className="eyebrow mb-3">Journal</p>
      <h1 className="display-hero mb-12 text-4xl">Notes from the coast</h1>
      {loading && <div className="skeleton h-40 w-full" />}
      <div className="space-y-12">
        {data?.map((post) => (
          <article key={post.slug} className="border-b border-ink/10 pb-10">
            <p className="eyebrow mb-2">{formatDate(post.publishedAt)}</p>
            <h2 className="font-display text-2xl font-light">
              <Link to={`/journal/${post.slug}`} className="hover:text-terracotta-deep">
                {post.title}
              </Link>
            </h2>
            {post.excerpt && <p className="prose-editorial mt-2">{post.excerpt}</p>}
            <Link to={`/journal/${post.slug}`} className="link-quiet mt-4 inline-block text-sm">
              Read
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}

export function JournalPostPage() {
  const { slug } = useParams();
  const { data, loading, error } = useFetch<PublicJournalPost>(
    slug ? `/api/public/journal/${slug}` : null,
  );
  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-24 text-center">
        <p className="prose-editorial">This entry doesn't exist.</p>
        <Link to="/journal" className="link-quiet mt-4 inline-block text-sm">
          All journal entries
        </Link>
      </div>
    );
  }
  return (
    <article className="mx-auto max-w-2xl px-5 py-16">
      {loading && <div className="skeleton h-64 w-full" />}
      {data && (
        <>
          <p className="eyebrow mb-3">
            {formatDate(data.publishedAt)} · {data.author}
          </p>
          <h1 className="display-hero mb-8 text-4xl">{data.title}</h1>
          {data.heroImageUrl && (
            <EditorialImage
              src={data.heroImageUrl}
              alt={data.title}
              aspect="aspect-[3/2]"
              className="mb-8"
            />
          )}
          <Markdown text={data.bodyMd ?? ""} />
        </>
      )}
    </article>
  );
}
