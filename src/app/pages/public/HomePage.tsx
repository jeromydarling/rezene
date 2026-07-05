import { Link } from "react-router";
import { useFetch } from "../../lib/useFetch";
import { ProductCard } from "../../components/ProductCard";
import { EditorialImage } from "../../components/ImagePlaceholder";
import { NewsletterForm } from "../../components/LeadForm";
import type { PublicCollection, PublicProductSummary } from "../../../shared/types";

export function HomePage() {
  const { data: products } = useFetch<PublicProductSummary[]>("/api/public/products");
  const { data: collections } = useFetch<PublicCollection[]>("/api/public/collections");
  const featured = products?.slice(0, 4) ?? [];
  const collection = collections?.[0];

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-b from-cream to-chalk">
        <div className="mx-auto max-w-6xl px-5 py-24 text-center md:py-36">
          <p className="eyebrow mb-6">Casablanca · Atlantic Riviera · SS27</p>
          <h1 className="display-hero mx-auto max-w-3xl text-5xl md:text-7xl">
            Dressed for the last hour of light.
          </h1>
          <p className="prose-editorial mx-auto mt-6 max-w-xl text-base">
            High-waisted linen tailoring and draped resortwear, cut in the
            ateliers of Casablanca. Old-world proportions, modern ease, honest
            cloth.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link to="/products" className="btn btn-primary">
              Shop the collection
            </Link>
            <Link to="/story" className="btn btn-secondary">
              Our story
            </Link>
          </div>
        </div>
      </section>

      {/* Featured products */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="eyebrow mb-2">The Edit</p>
            <h2 className="font-display text-3xl font-light">First pieces</h2>
          </div>
          <Link to="/products" className="link-quiet text-sm">
            View all
          </Link>
        </div>
        {featured.length === 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton aspect-[4/5]" />
            ))}
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>

      {/* Collection strip */}
      {collection && (
        <section className="bg-navy text-chalk">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-20 md:grid-cols-2">
            <div>
              <p className="eyebrow mb-3 !text-chalk/50">
                {collection.season} Collection
              </p>
              <h2 className="font-display text-4xl font-light">{collection.name}</h2>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-chalk/75">
                {collection.editorialCopy ?? collection.description}
              </p>
              <Link
                to={`/collections/${collection.slug}`}
                className="btn mt-8 border-chalk/60 text-chalk hover:bg-chalk hover:text-navy"
              >
                Explore {collection.name}
              </Link>
            </div>
            <EditorialImage
              src={collection.heroImageUrl}
              alt={collection.name}
              label={`${collection.name} — campaign`}
              aspect="aspect-[4/3]"
            />
          </div>
        </section>
      )}

      {/* Atelier teaser */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-20 md:grid-cols-2">
        <EditorialImage
          src={null}
          alt="Casablanca atelier"
          label="The atelier, Casablanca"
          aspect="aspect-[4/3]"
        />
        <div>
          <p className="eyebrow mb-3">Provenance</p>
          <h2 className="font-display text-3xl font-light">
            Made in Casablanca, on purpose.
          </h2>
          <p className="prose-editorial mt-4 max-w-md">
            We produce in small ateliers where tailoring is a living trade —
            pilot runs of 150 to 200 pieces, measured twice, pressed properly.
            Slower, and the point.
          </p>
          <Link to="/atelier" className="link-quiet mt-6 inline-block text-sm">
            Inside the atelier
          </Link>
        </div>
      </section>

      {/* Newsletter band */}
      <section className="border-t border-ink/10 bg-cream">
        <div className="mx-auto max-w-xl px-5 py-16 text-center">
          <h2 className="font-display text-2xl font-light">
            The first drop is by invitation.
          </h2>
          <p className="prose-editorial mt-2 mb-6">
            Waitlist members get first access to pre-orders and the launch
            pricing.
          </p>
          <div className="mx-auto max-w-sm">
            <NewsletterForm kind="waitlist" />
          </div>
        </div>
      </section>
    </div>
  );
}
