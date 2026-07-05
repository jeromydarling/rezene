import { Link } from "react-router";
import { useFetch } from "../../lib/useFetch";
import { formatMoney } from "../../lib/format";
import { EditorialImage } from "../../components/ImagePlaceholder";
import type { PublicLookbook } from "../../../shared/types";

export function LookbookPage() {
  const { data, loading } = useFetch<PublicLookbook[]>("/api/public/lookbooks");

  return (
    <div className="mx-auto max-w-5xl px-5 py-16">
      <p className="eyebrow mb-3">Lookbook</p>
      <h1 className="display-hero mb-12 text-4xl">Shot on the Atlantic</h1>
      {loading && <div className="skeleton h-96 w-full" />}
      {data?.length === 0 && (
        <p className="prose-editorial py-16 text-center">
          The first campaign is being shot. Come back after golden hour.
        </p>
      )}
      {data?.map((book) => (
        <section key={book.slug} className="mb-20">
          <div className="mb-8 max-w-xl">
            <p className="eyebrow mb-2">{book.season}</p>
            <h2 className="font-display text-3xl font-light">{book.title}</h2>
            {book.introCopy && <p className="prose-editorial mt-3">{book.introCopy}</p>}
          </div>
          <div className="space-y-10">
            {book.images.map((img, i) => (
              <figure key={i} className={i % 2 === 1 ? "md:ml-24" : "md:mr-24"}>
                <EditorialImage
                  src={img.url}
                  alt={img.caption ?? book.title}
                  label={img.caption ?? book.title}
                  aspect={i % 3 === 0 ? "aspect-[3/2]" : "aspect-[4/5]"}
                />
                <figcaption className="mt-2 flex items-baseline justify-between gap-4">
                  {img.caption && (
                    <span className="text-xs italic text-warmgrey">{img.caption}</span>
                  )}
                  {img.productSlug && (
                    <Link
                      to={`/products/${img.productSlug}`}
                      className="link-quiet whitespace-nowrap text-xs"
                    >
                      Shop {img.productName}
                      {img.productPriceCents ? ` · ${formatMoney(img.productPriceCents)}` : ""} →
                    </Link>
                  )}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
