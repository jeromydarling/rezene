import type { KbArticle } from "../types";

export const marketing: KbArticle[] = [
  {
    slug: "campaigns",
    title: "Campaigns & the marketing suite",
    summary: "Turn one brief into a multi-channel kit — social, email, press, ads — in your voice.",
    part: "marketing",
    moduleRoute: "/admin/marketing",
    keywords: "marketing campaign social email press ads content calendar graphics brand voice",
    screenshot: "/kb/shots/marketing.png",
    updated: "2026-07-06",
    body: `# Campaigns & the marketing suite

**Marketing → Campaigns** turns a single brief into a full multi-channel kit — social posts, email, blog, press, and ads — written by LLM in **your brand voice**.

## How it works

1. Start a campaign with a product or theme and a goal.
2. Verto drafts the kit across channels.
3. **Everything is a draft you own** — edit, schedule, and mark posted. Nothing auto-publishes.

## The rest of the suite

- **Graphics studio** — brand-styled images for posts and ads.
- **Content calendar** — plan what goes out when.
- **Email** — send to your subscribers from Verto.

> [!NOTE]
> LLM drafts are a starting point, not a send button. You always review before anything reaches a customer.`,
  },
  {
    slug: "promo-video",
    title: "The Promo Video studio",
    summary: "Compose a cinematic promo from your products — free preview, pay on delivery.",
    part: "marketing",
    moduleRoute: "/admin/marketing/video",
    keywords: "video promo render preview export format landscape vertical square charge",
    screenshot: "/kb/shots/video.png",
    updated: "2026-07-06",
    body: `# The Promo Video studio

**Marketing → Promo Video** composes a cinematic promo from your own products.

## Build & preview

Edit the on-screen lines (or let LLM draft them) and watch the finished film play in real time in the preview. **What you preview is exactly what renders** — there are no surprises between the two.

## Export & billing

When you love it, choose your formats (landscape / vertical / square) and export. The heavy render runs off-app and delivers a finished file.

> [!SUCCESS]
> You're only charged **once the finished video is delivered**. A render that fails is never billed. The live preview is always free.`,
  },
  {
    slug: "cms",
    title: "Pages, journal & the CMS",
    summary: "Build storefront pages from typed content blocks; run a journal and lookbooks.",
    part: "marketing",
    moduleRoute: "/admin/content/pages",
    keywords: "cms page journal blog lookbook block hero content editor publish schedule media",
    updated: "2026-07-06",
    body: `# Pages, journal & the CMS

Your storefront's editorial side lives under **Marketing & Content**.

## Pages as blocks

Build pages from **typed content blocks** — heroes, feature rows, galleries, quotes — stacked and reordered. Start from a template or a blank page. Save a **draft preview link** to share before publishing, or **schedule** a page to go live later.

## Journal & lookbooks

Run a **journal** (your blog) and **lookbooks** the same way. A **media library** with alt text keeps images organised and accessible.

## LLM help

An interview-style assistant can draft page copy in your brand voice, and inline LLM can rewrite a selected passage — all editable before you publish.`,
  },
  {
    slug: "seo",
    title: "Getting found: SEO & LLM search",
    summary: "Score and fix findability — titles, schema, sitemaps, and an llms.txt for LLM.",
    part: "marketing",
    moduleRoute: "/admin/content/search",
    keywords: "seo search checkup sitemap schema meta google llms ai discovery structured data",
    screenshot: "/kb/shots/seo.png",
    updated: "2026-07-06",
    body: `# Getting found: SEO & LLM search

**Marketing & Content → Search Checkup** scores how findable your store is and fixes the gaps.

## What it checks

- Page **titles and descriptions** (with LLM suggestions)
- **Product schema** (structured data) so search engines understand your listings
- **Sitemaps** — every published product and collection is included automatically
- An **llms.txt** so LLM assistants can read your catalog

## Custom domains

On your own domain, SEO output (sitemaps, schema, meta) is served for that domain too. See [Connect a custom domain](/admin/support/kb/domain).

> [!TIP]
> A product with lots of views but few sales (see [Analytics](/admin/support/kb/analytics)) often just needs a clearer title and description — Search Checkup is where you fix that.`,
  },
];
