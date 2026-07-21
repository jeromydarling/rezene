/**
 * Real customer testimonials for the Verto marketing site. This powers TWO
 * things from one source: a visible testimonials section on the home page and
 * the Review / AggregateRating structured data attached to the product schema.
 *
 * IMPORTANT — only ever add REAL, attributable testimonials here. Google's
 * review-snippet policy (and basic honesty) forbids marking up invented or
 * unattributed reviews; doing so risks a manual penalty and burns trust. When
 * the array is empty, the section renders nothing and no review schema is
 * emitted — everything degrades cleanly until you have the real thing.
 *
 * To activate: drop a real quote below (with a name and, ideally, a rating and
 * date), redeploy, and both the on-page section and the rich-result markup
 * light up automatically. The HQ → Marketing SEO checkup surfaces this as a
 * growth item until it's done, so it won't get forgotten.
 */

export interface Testimonial {
  /** The review text, verbatim. */
  quote: string;
  /** Who said it — required for attribution. */
  name: string;
  /** e.g. "Founder, Maison Atlantique". */
  role?: string;
  /** 1–5. Include only if the person actually gave a rating. */
  rating?: number;
  /** ISO date (YYYY-MM-DD) the review was given. */
  date?: string;
  /** Where it came from (for your own records; not published). */
  source?: string;
}

export const TESTIMONIALS: Testimonial[] = [
  // Add real, attributable testimonials here. Example shape (do not ship until real):
  // {
  //   quote: "I closed my Shopify and three apps the week I moved to Verto.",
  //   name: "Jordan Ellis",
  //   role: "Founder, Atelier North",
  //   rating: 5,
  //   date: "2026-08-01",
  //   source: "email, permission to quote",
  // },
];

export function hasTestimonials(): boolean {
  return TESTIMONIALS.length > 0;
}

/** Average rating across testimonials that carry one, or null if none do. */
export function aggregateRating(): { value: number; count: number } | null {
  const rated = TESTIMONIALS.filter((t) => typeof t.rating === "number");
  if (rated.length === 0) return null;
  const value = rated.reduce((sum, t) => sum + (t.rating as number), 0) / rated.length;
  return { value: Math.round(value * 10) / 10, count: rated.length };
}
