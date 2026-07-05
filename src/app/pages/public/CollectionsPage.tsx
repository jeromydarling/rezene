import { Link, useParams } from "react-router";
import { useFetch } from "../../lib/useFetch";
import { EditorialImage } from "../../components/ImagePlaceholder";
import { ProductCard } from "../../components/ProductCard";
import type { PublicCollection, PublicProductSummary } from "../../../shared/types";

export function CollectionsPage() {
  const { data, loading } = useFetch<PublicCollection[]>("/api/public/collections");
  return (
    <div className="mx-auto max-w-6xl px-5 py-16">
      <p className="eyebrow mb-3">Collections</p>
      <h1 className="display-hero mb-10 text-4xl">Two seasons of the Atlantic year</h1>
      {loading && <div className="skeleton h-64 w-full" />}
      <div className="grid gap-8 md:grid-cols-2">
        {data?.map((col) => (
          <Link key={col.id} to={`/collections/${col.slug}`} className="group block">
            <EditorialImage
              src={col.heroImageUrl}
              alt={col.name}
              label={`${col.name} — ${col.season ?? ""}`}
              aspect="aspect-[3/2]"
            />
            <div className="mt-4">
              <p className="eyebrow">{col.season}</p>
              <h2 className="font-display text-2xl font-light group-hover:text-terracotta-deep">
                {col.name}
              </h2>
              <p className="prose-editorial mt-1">{col.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function CollectionDetailPage() {
  const { slug } = useParams();
  const { data, loading, error } = useFetch<PublicCollection & { products: PublicProductSummary[] }>(
    slug ? `/api/public/collections/${slug}` : null,
  );
  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-24 text-center">
        <p className="prose-editorial">Collection not found.</p>
        <Link to="/collections" className="link-quiet mt-4 inline-block text-sm">
          All collections
        </Link>
      </div>
    );
  }
  return (
    <div>
      <section className="bg-cream">
        <div className="mx-auto max-w-4xl px-5 py-20 text-center">
          {loading ? (
            <div className="skeleton mx-auto h-12 w-1/2" />
          ) : (
            <>
              <p className="eyebrow mb-4">{data?.season} Collection</p>
              <h1 className="display-hero text-5xl">{data?.name}</h1>
              <p className="prose-editorial mx-auto mt-6 max-w-xl">{data?.editorialCopy}</p>
            </>
          )}
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-5 py-14">
        {data && data.products.length === 0 ? (
          <p className="prose-editorial py-10 text-center">
            Pieces from this collection are still in the atelier. Join the waitlist for first access.
          </p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {data?.products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
