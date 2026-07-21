# Verto marketing-site growth backlog

Standing SEO / discovery levers for verto.style that are **scaffolded and ready
to switch on** — captured here so they don't get lost. The HQ **Marketing SEO**
checkup (Verto HQ → Marketing SEO) surfaces the ones with a detectable state as
"growth" items until they're done, then flips them to passing.

## Ready to activate

### 1. Review stars (Review / AggregateRating rich results)
- **Status:** scaffolded, waiting on a real testimonial.
- **To activate:** add a real, attributable quote to `src/shared/testimonials.ts`
  (name required; rating + date ideal), then deploy. A testimonials section
  appears on the home page **and** Review/AggregateRating schema is emitted from
  the same source — Google can then show star ratings in results.
- **Guardrail:** never add invented or unattributed reviews. Google's
  review-snippet policy forbids it and it burns trust; the array stays empty and
  emits nothing until it's real.
- **Surfaced in:** HQ → Marketing SEO ("Add a testimonial to earn review stars").

### 2. Top FAQ questions → their own indexable pages
- **Status:** foundation in place. Every FAQ item has a stable slug
  (`faqSlug()` in `src/shared/faq.ts`) and is deep-linkable today at
  `/faq#<slug>`. The FAQ already ships FAQPage structured data.
- **To activate (when there's search demand):** pick the questions that actually
  pull search traffic (from Google Search Console once it's connected, or the
  Search Checkup's own signals) and promote each to a standalone route — e.g.
  `/faq/<slug>` — reusing the shared `FAQ` data so there's no duplication.
  Add them to `VERTO_META`, the sitemap, and cross-link from the FAQ index.
- **Why wait:** only worth the pages that answer real queries; building all of
  them upfront is thin-content risk. Let demand pick the winners.

## When the inputs exist
- **Google Search Console** connected → use real query data to (a) choose which
  FAQ questions become pages and (b) prioritise new marketing content.
- **Customer quotes with permission** → testimonials (above) and, later, a small
  wall-of-love / case-study page.

## Not doing (yet)
- Fabricated reviews or FAQ pages for questions nobody asks — both are penalised
  by search engines and neither serves a real reader.
