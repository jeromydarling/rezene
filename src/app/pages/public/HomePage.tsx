import { useFetch } from "../../lib/useFetch";
import { PageBlocks } from "../../components/PageBlocks";
import type { PageSection, PublicPage } from "../../../shared/types";

/**
 * The homepage is a CMS page (slug 'home') composed of block sections —
 * editable under Admin → Content → Pages like any other page. The fallback
 * below mirrors the seeded composition, so the page renders correctly even
 * before the migration ran or if the home page is ever deleted.
 */
const FALLBACK_SECTIONS: PageSection[] = [
  { type: "home_hero" },
  {
    type: "product_grid",
    eyebrow: "The Edit",
    heading: "First pieces",
    source: "featured",
    limit: 4,
    ctaLabel: "View all",
    ctaHref: "/products",
  },
  { type: "collection_strip" },
  {
    type: "image_text",
    eyebrow: "Provenance",
    heading: "Made in Casablanca, on purpose.",
    body: "We produce in small ateliers where tailoring is a living trade — pilot runs of 150 to 200 pieces, measured twice, pressed properly. Slower, and the point.",
    ctaLabel: "Inside the atelier",
    ctaHref: "/atelier",
    imageAlt: "The atelier, Casablanca",
    imageSide: "left",
  },
  {
    type: "newsletter",
    heading: "The first drop is by invitation.",
    body: "Waitlist members get first access to pre-orders and the launch pricing.",
    kind: "waitlist",
  },
];

export function HomePage() {
  const { data, loading } = useFetch<PublicPage>("/api/public/pages/home");
  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-5 py-24 text-center md:py-36">
        <div className="skeleton mx-auto mb-6 h-4 w-48" />
        <div className="skeleton mx-auto h-16 w-2/3" />
        <div className="skeleton mx-auto mt-6 h-4 w-1/2" />
      </div>
    );
  }
  const sections = data?.sections && data.sections.length > 0 ? data.sections : FALLBACK_SECTIONS;
  return <PageBlocks sections={sections} />;
}
