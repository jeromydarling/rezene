import { Link } from "react-router";
import { useFetch } from "../lib/useFetch";
import { useBrand } from "../lib/brand";
import { Markdown } from "./Markdown";
import { ProductCard } from "./ProductCard";
import { EditorialImage } from "./ImagePlaceholder";
import { NewsletterForm } from "./LeadForm";
import type {
  HomeHero,
  PageSection,
  PublicCollection,
  PublicProductSummary,
} from "../../shared/types";

/**
 * Public renderer for CMS block sections. Each block type maps to the same
 * visual system the hardcoded site used, so composed pages are
 * indistinguishable from hand-built ones. Unknown/malformed blocks render
 * nothing — a bad block never takes the page down.
 */

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const strOr = (v: unknown, fallback: string): string => str(v) || fallback;

function SmartLink({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  return href.startsWith("/") ? (
    <Link to={href} className={className}>
      {children}
    </Link>
  ) : (
    <a href={href} className={className}>
      {children}
    </a>
  );
}

// ---------- home_hero: renders the settings-backed homepage hero ----------
const DEFAULT_HERO: HomeHero = { heading: "" };

function HomeHeroBlock() {
  const brand = useBrand();
  const hero = brand.homeHero ?? DEFAULT_HERO;
  if (!hero.heading) return null;
  const withImage = Boolean(hero.imageUrl);
  return (
    <section className={withImage ? "relative bg-navy" : "bg-gradient-to-b from-cream to-chalk"}>
      {withImage && (
        <>
          <img src={hero.imageUrl!} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-ink/45" />
        </>
      )}
      <div className="relative mx-auto max-w-6xl px-5 py-24 text-center md:py-36">
        {hero.eyebrow && (
          <p className={`eyebrow mb-6 ${withImage ? "!text-chalk/70" : ""}`}>{hero.eyebrow}</p>
        )}
        <h1 className={`display-hero mx-auto max-w-3xl text-5xl md:text-7xl ${withImage ? "!text-chalk" : ""}`}>
          {hero.heading}
        </h1>
        {hero.subheading && (
          <p className={`prose-editorial mx-auto mt-6 max-w-xl text-base ${withImage ? "!text-chalk/85" : ""}`}>
            {hero.subheading}
          </p>
        )}
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          {hero.primaryCtaLabel && hero.primaryCtaHref && (
            <SmartLink href={hero.primaryCtaHref} className="btn btn-primary">
              {hero.primaryCtaLabel}
            </SmartLink>
          )}
          {hero.secondaryCtaLabel && hero.secondaryCtaHref && (
            <SmartLink href={hero.secondaryCtaHref} className="btn btn-secondary">
              {hero.secondaryCtaLabel}
            </SmartLink>
          )}
        </div>
      </div>
    </section>
  );
}

// ---------- hero: standalone hero for landing pages ----------
function HeroBlock({ section }: { section: PageSection }) {
  const imageUrl = str(section.imageUrl);
  return (
    <section className={imageUrl ? "relative bg-navy text-chalk" : "bg-gradient-to-b from-cream to-chalk"}>
      {imageUrl && (
        <>
          <img src={imageUrl} alt={str(section.imageAlt)} className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-ink/50" />
        </>
      )}
      <div className="relative mx-auto max-w-4xl px-5 py-24 text-center md:py-32">
        {str(section.eyebrow) && (
          <p className={`eyebrow mb-4 ${imageUrl ? "!text-chalk/70" : ""}`}>{str(section.eyebrow)}</p>
        )}
        {str(section.heading) && (
          <h2 className={`display-hero text-4xl md:text-6xl ${imageUrl ? "!text-chalk" : ""}`}>
            {str(section.heading)}
          </h2>
        )}
        {str(section.subheading) && (
          <p className={`prose-editorial mx-auto mt-5 max-w-xl ${imageUrl ? "!text-chalk/85" : ""}`}>
            {str(section.subheading)}
          </p>
        )}
        {str(section.ctaLabel) && str(section.ctaHref) && (
          <div className="mt-8">
            <SmartLink href={str(section.ctaHref)} className="btn btn-primary">
              {str(section.ctaLabel)}
            </SmartLink>
          </div>
        )}
      </div>
    </section>
  );
}

// ---------- product_grid ----------
function ProductGridBlock({ section }: { section: PageSection }) {
  const source = strOr(section.source, "featured");
  const collectionSlug = str(section.collectionSlug);
  const limit = typeof section.limit === "number" ? section.limit : 4;
  const { data: products } = useFetch<PublicProductSummary[]>(
    source === "featured" ? "/api/public/products" : null,
  );
  const { data: collection } = useFetch<PublicCollection & { products: PublicProductSummary[] }>(
    source === "collection" && collectionSlug ? `/api/public/collections/${collectionSlug}` : null,
  );
  const items = (source === "collection" ? collection?.products : products)?.slice(0, limit) ?? [];

  return (
    <section className="mx-auto max-w-6xl px-5 py-16">
      {(str(section.eyebrow) || str(section.heading)) && (
        <div className="mb-8 flex items-end justify-between">
          <div>
            {str(section.eyebrow) && <p className="eyebrow mb-2">{str(section.eyebrow)}</p>}
            {str(section.heading) && (
              <h2 className="font-display text-3xl font-light">{str(section.heading)}</h2>
            )}
          </div>
          {str(section.ctaLabel) && str(section.ctaHref) && (
            <SmartLink href={str(section.ctaHref)} className="link-quiet text-sm">
              {str(section.ctaLabel)}
            </SmartLink>
          )}
        </div>
      )}
      {items.length === 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: Math.min(limit, 4) }).map((_, i) => (
            <div key={i} className="skeleton aspect-[4/5]" />
          ))}
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </section>
  );
}

// ---------- collection_strip ----------
function CollectionStripBlock({ section }: { section: PageSection }) {
  const { data: collections } = useFetch<PublicCollection[]>("/api/public/collections");
  const slug = str(section.collectionSlug);
  const collection = (slug ? collections?.find((c) => c.slug === slug) : collections?.[0]) ?? null;
  if (!collection) return null;
  return (
    <section className="bg-navy text-chalk">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-20 md:grid-cols-2">
        <div>
          <p className="eyebrow mb-3 !text-chalk/50">{collection.season} Collection</p>
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
  );
}

// ---------- image_text ----------
function ImageTextBlock({ section }: { section: PageSection }) {
  const imageSide = strOr(section.imageSide, "left");
  const dark = Boolean(section.dark);
  const image = (
    <EditorialImage
      src={str(section.imageUrl) || null}
      alt={strOr(section.imageAlt, str(section.heading))}
      label={strOr(section.imageAlt, str(section.heading))}
      aspect="aspect-[4/3]"
    />
  );
  const text = (
    <div>
      {str(section.eyebrow) && (
        <p className={`eyebrow mb-3 ${dark ? "!text-chalk/50" : ""}`}>{str(section.eyebrow)}</p>
      )}
      {str(section.heading) && (
        <h2 className="font-display text-3xl font-light">{str(section.heading)}</h2>
      )}
      {str(section.body) && (
        <div className={`mt-4 max-w-md ${dark ? "text-sm leading-relaxed text-chalk/75" : ""}`}>
          <Markdown text={str(section.body)} headingBase={2} />
        </div>
      )}
      {str(section.ctaLabel) && str(section.ctaHref) && (
        <SmartLink href={str(section.ctaHref)} className="link-quiet mt-6 inline-block text-sm">
          {str(section.ctaLabel)}
        </SmartLink>
      )}
    </div>
  );
  return (
    <section className={dark ? "bg-navy text-chalk" : ""}>
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-20 md:grid-cols-2">
        {imageSide === "left" ? (
          <>
            {image}
            {text}
          </>
        ) : (
          <>
            {text}
            {image}
          </>
        )}
      </div>
    </section>
  );
}

// ---------- gallery ----------
interface GalleryImage {
  url?: string;
  alt?: string;
  caption?: string;
}

function GalleryBlock({ section }: { section: PageSection }) {
  const images = (Array.isArray(section.images) ? section.images : []) as GalleryImage[];
  if (images.length === 0) return null;
  const columns = typeof section.columns === "number" && section.columns >= 2 && section.columns <= 4 ? section.columns : 3;
  const colClass = columns === 2 ? "sm:grid-cols-2" : columns === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-3";
  return (
    <section className="mx-auto max-w-6xl px-5 py-16">
      <div className={`grid gap-5 ${colClass}`}>
        {images.map((image, i) => (
          <figure key={i}>
            <EditorialImage
              src={image.url ?? null}
              alt={image.alt ?? image.caption ?? ""}
              label={image.caption ?? `Image ${i + 1}`}
              aspect="aspect-[4/5]"
            />
            {image.caption && (
              <figcaption className="mt-2 text-xs text-warmgrey">{image.caption}</figcaption>
            )}
          </figure>
        ))}
      </div>
    </section>
  );
}

// ---------- quote ----------
function QuoteBlock({ section }: { section: PageSection }) {
  if (!str(section.text)) return null;
  return (
    <section className="mx-auto max-w-3xl px-5 py-16 text-center">
      <blockquote className="font-display text-2xl font-light leading-relaxed md:text-3xl">
        “{str(section.text)}”
      </blockquote>
      {str(section.attribution) && (
        <p className="eyebrow mt-6">{str(section.attribution)}</p>
      )}
    </section>
  );
}

// ---------- faq ----------
interface FaqItem {
  q?: string;
  a?: string;
}

function FaqBlock({ section }: { section: PageSection }) {
  const items = (Array.isArray(section.items) ? section.items : []) as FaqItem[];
  if (items.length === 0) return null;
  return (
    <section className="mx-auto max-w-2xl px-5 py-12">
      {str(section.heading) && (
        <h2 className="mb-8 font-display text-3xl font-light">{str(section.heading)}</h2>
      )}
      <div className="divide-y divide-ink/10 border-y border-ink/10">
        {items.map((item, i) => (
          <details key={i} className="group py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left font-medium">
              {item.q ?? ""}
              <span className="text-warmgrey transition-transform group-open:rotate-45">+</span>
            </summary>
            <div className="pt-3 text-sm">
              <Markdown text={item.a ?? ""} />
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

// ---------- cta_band ----------
function CtaBandBlock({ section }: { section: PageSection }) {
  const dark = section.dark !== false;
  return (
    <section className={dark ? "bg-navy text-chalk" : "border-y border-ink/10 bg-cream"}>
      <div className="mx-auto max-w-2xl px-5 py-16 text-center">
        {str(section.heading) && (
          <h2 className="font-display text-2xl font-light md:text-3xl">{str(section.heading)}</h2>
        )}
        {str(section.body) && (
          <p className={`prose-editorial mt-3 ${dark ? "!text-chalk/75" : ""}`}>{str(section.body)}</p>
        )}
        {str(section.ctaLabel) && str(section.ctaHref) && (
          <div className="mt-8">
            <SmartLink
              href={str(section.ctaHref)}
              className={dark ? "btn border-chalk/60 text-chalk hover:bg-chalk hover:text-navy" : "btn btn-primary"}
            >
              {str(section.ctaLabel)}
            </SmartLink>
          </div>
        )}
      </div>
    </section>
  );
}

// ---------- newsletter ----------
function NewsletterBlock({ section }: { section: PageSection }) {
  const kind = strOr(section.kind, "newsletter") as "newsletter" | "waitlist";
  return (
    <section className="border-t border-ink/10 bg-cream">
      <div className="mx-auto max-w-xl px-5 py-16 text-center">
        {str(section.heading) && (
          <h2 className="font-display text-2xl font-light">{str(section.heading)}</h2>
        )}
        {str(section.body) && <p className="prose-editorial mt-2 mb-6">{str(section.body)}</p>}
        <div className="mx-auto max-w-sm">
          <NewsletterForm kind={kind} />
        </div>
      </div>
    </section>
  );
}

// ---------- prose ----------
function ProseBlock({ section }: { section: PageSection }) {
  if (!str(section.markdown)) return null;
  return (
    <section className="mx-auto max-w-2xl px-5 py-12">
      <Markdown text={str(section.markdown)} headingBase={2} />
    </section>
  );
}

const RENDERERS: Record<string, (props: { section: PageSection }) => React.ReactNode> = {
  home_hero: () => <HomeHeroBlock />,
  hero: HeroBlock,
  prose: ProseBlock,
  image_text: ImageTextBlock,
  product_grid: ProductGridBlock,
  collection_strip: CollectionStripBlock,
  gallery: GalleryBlock,
  quote: QuoteBlock,
  faq: FaqBlock,
  cta_band: CtaBandBlock,
  newsletter: NewsletterBlock,
};

export function PageBlocks({ sections }: { sections: PageSection[] }) {
  return (
    <>
      {sections.map((section, i) => {
        const Renderer = RENDERERS[section.type];
        return Renderer ? <Renderer key={i} section={section} /> : null;
      })}
    </>
  );
}
