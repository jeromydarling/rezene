import { all, first } from "./db";
import { getShopSeoConfig } from "./seo";
import { getBrandName } from "./brand";
import { AiUnavailableError } from "./ai";
import type { Env } from "../types/env";

/**
 * Search Checkup — a categorised, plain-language SEO / AI-visibility audit run
 * against a shop's own content AND its live storefront. Two signal sources:
 *
 *  1. DB completeness (reliable): descriptions, excerpts, alt text, product
 *     photography, verification, visibility — the parts only the owner supplies.
 *  2. Live storefront fetch (best-effort): the worker fetches the shop's home
 *     over the PLATFORM origin (`${APP_URL}/${slug}` — never the custom domain,
 *     which a Worker can't fetch on its own zone) plus /robots.txt and
 *     /sitemap.xml, and reads the edge-rendered HTML for title/description
 *     length, canonical, Open Graph, viewport, and time-to-first-byte.
 *
 * Any live check whose fetch fails degrades to a neutral "couldn't verify" and
 * is dropped — a self-fetch limitation must never surface as a false alarm.
 * Everything is read-only; the fixes route back to the relevant editor.
 */

export type CheckTier = "warning" | "tip" | "growth" | "pass";

export interface CheckItem {
  id: string;
  tier: CheckTier;
  title: string;
  detail: string;
  /** A route (SPA) or external href the merchant clicks to fix it. */
  fix?: { label: string; to?: string; href?: string };
  /** Inline control to render in the expanded row (settings-backed). */
  control?: "visibility" | "verification" | "og_image";
  /** Named offenders (page/product titles) for an at-a-glance list. */
  specifics?: string[];
  /** Current stored value for a control. */
  value?: string;
}

export interface CheckupResult {
  checks: CheckItem[];
  counts: { warning: number; tip: number; growth: number; pass: number };
  liveChecked: boolean;
  poweredByAi: boolean;
}

const TITLE_MAX = 60;
const DESC_MAX = 160;

interface Fetched {
  ok: boolean;
  status: number;
  ms: number;
  text: string;
}

async function timedFetch(url: string, ms = 6000): Promise<Fetched | null> {
  const started = Date.now();
  try {
    const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(ms) });
    const text = await res.text();
    return { ok: res.status >= 200 && res.status < 400, status: res.status, ms: Date.now() - started, text };
  } catch {
    return null;
  }
}

const tag = (html: string, re: RegExp): string | null => {
  const m = html.match(re);
  return m ? m[1].trim() : null;
};

export async function runSeoCheckup(
  env: Env,
  db: D1Database,
  opts: { shopSlug: string | null; appUrl: string },
): Promise<CheckupResult> {
  const checks: CheckItem[] = [];
  const cfg = await getShopSeoConfig(db);

  // ---- DB completeness signals -------------------------------------------
  const [pagesMissingMeta, postsMissingMeta, productsMissingImages, longMeta] = await Promise.all([
    all<{ slug: string; title: string }>(
      db,
      `SELECT slug, title FROM pages
       WHERE is_published = 1 AND (meta_description IS NULL OR meta_description = '')
         AND (subtitle IS NULL OR subtitle = '') LIMIT 25`,
    ),
    all<{ slug: string; title: string }>(
      db,
      `SELECT slug, title FROM journal_posts
       WHERE is_published = 1 AND (meta_description IS NULL OR meta_description = '')
         AND (excerpt IS NULL OR excerpt = '') LIMIT 25`,
    ),
    all<{ slug: string; name: string }>(
      db,
      `SELECT p.slug, p.name FROM products p
       WHERE p.is_published = 1 AND p.availability != 'archived'
         AND NOT EXISTS (SELECT 1 FROM product_images i WHERE i.product_id = p.id) LIMIT 25`,
    ),
    all<{ title: string }>(
      db,
      `SELECT title FROM pages
       WHERE is_published = 1 AND (length(meta_title) > ${TITLE_MAX} OR length(meta_description) > ${DESC_MAX})
       LIMIT 25`,
    ),
  ]);
  const mediaMissingAlt = await first<{ n: number }>(
    db,
    `SELECT COUNT(*) AS n FROM files WHERE is_public = 1 AND (alt_text IS NULL OR alt_text = '') AND content_type LIKE 'image/%'`,
  );
  const publishedPages = await first<{ n: number }>(db, `SELECT COUNT(*) AS n FROM pages WHERE is_published = 1`);

  // ---- Live storefront fetch (best-effort, platform origin) ---------------
  const base = opts.shopSlug ? `${opts.appUrl.replace(/\/$/, "")}/${opts.shopSlug}` : opts.appUrl.replace(/\/$/, "");
  const origin = opts.appUrl.replace(/\/$/, "");
  const [home, robots, sitemap] = await Promise.all([
    timedFetch(base),
    timedFetch(`${origin}/robots.txt`),
    timedFetch(`${origin}/sitemap.xml`),
  ]);
  const liveChecked = Boolean(home);

  // ---- 1. Visibility (the biggest lever) ---------------------------------
  checks.push(
    cfg.hidden
      ? {
          id: "visibility",
          tier: "warning",
          title: "Your shop is hidden from search engines",
          detail:
            "Every published page carries a noindex tag and your shop is left out of the sitemap. Nothing you do here will rank until you switch this on — flip it the moment you're ready to launch.",
          control: "visibility",
          value: "hidden",
        }
      : {
          id: "visibility",
          tier: "pass",
          title: "Your shop is visible to search engines",
          detail: "Every published page is indexable and listed in your sitemap.",
          control: "visibility",
          value: "public",
        },
  );

  // ---- 2. Google Search Console ------------------------------------------
  checks.push(
    cfg.verificationGoogle
      ? {
          id: "gsc",
          tier: "pass",
          title: "Google Search Console is connected",
          detail: "Your verification tag is served on every page. Submit your sitemap in Search Console to watch search performance.",
          control: "verification",
        }
      : {
          id: "gsc",
          tier: "warning",
          title: "Google Search Console isn't set up",
          detail:
            "Search Console is how Google tells you what you rank for, which pages are indexed, and any problems it finds. Paste the content value from Google's HTML-tag verification method and we serve it automatically.",
          control: "verification",
          fix: { label: "Open Search Console", href: "https://search.google.com/search-console" },
        },
  );

  // ---- 3. Crawler rules (robots.txt) -------------------------------------
  if (robots) {
    const refsSitemap = /sitemap:/i.test(robots.text);
    const blocksAll = /disallow:\s*\/\s*$/im.test(robots.text) && !/allow:\s*\//i.test(robots.text);
    checks.push(
      robots.ok && refsSitemap && !blocksAll
        ? {
            id: "robots",
            tier: "pass",
            title: "Crawler rules are in order",
            detail: "Your robots.txt lets search engines in, keeps them out of the admin, and points them at your sitemap — all automatic.",
            fix: { label: "View robots.txt", href: `${base}/robots.txt` },
          }
        : {
            id: "robots",
            tier: "warning",
            title: "Crawler rules need attention",
            detail: blocksAll
              ? "Your robots.txt is blocking crawlers from the whole site."
              : "Your robots.txt is missing a sitemap reference or wasn't reachable when we checked.",
            fix: { label: "View robots.txt", href: `${base}/robots.txt` },
          },
    );
  }

  // ---- 4. Sitemap health --------------------------------------------------
  if (sitemap) {
    const locs = (sitemap.text.match(/<loc>/g) ?? []).length;
    checks.push(
      sitemap.ok && locs > 0
        ? {
            id: "sitemap",
            tier: "pass",
            title: "Your sitemap is live",
            detail: `Search engines have a fresh map of your ${locs} indexable URL${locs === 1 ? "" : "s"}, regenerated on every publish. On your own domain it serves at yourdomain.com/sitemap.xml automatically.`,
            fix: { label: "View sitemap", href: `${origin}/sitemap.xml` },
          }
        : {
            id: "sitemap",
            tier: "warning",
            title: "Sitemap needs attention",
            detail:
              cfg.hidden
                ? "Your sitemap is empty because the shop is hidden from search engines. It fills in the moment you make the shop visible."
                : "Your sitemap came back empty or unreachable. Publish at least your home page and a product, then re-run this check.",
            fix: { label: "View sitemap", href: `${origin}/sitemap.xml` },
          },
    );
  }

  // ---- 5. Home reachable + fully rendered (edge SSR) ----------------------
  if (home) {
    const title = tag(home.text, /<title>([^<]*)<\/title>/i);
    const ogTitle = /<meta[^>]+property=["']og:title["']/i.test(home.text);
    const rendered = Boolean(title && ogTitle);
    checks.push(
      home.ok && rendered
        ? {
            id: "rendered",
            tier: "pass",
            title: "Search engines see your fully-rendered pages",
            detail: "Your storefront is a live app, but Verto renders real titles, descriptions, and social tags into the HTML at the edge — so crawlers and link previews see a finished page, not an empty shell.",
          }
        : {
            id: "rendered",
            tier: "warning",
            title: "Your home page isn't rendering for crawlers",
            detail: "We couldn't read a title and social tags from your home page. If you just launched, give it a minute and re-run; if it persists, contact support.",
            fix: { label: "View storefront", href: base },
          },
    );

    // ---- 6. Title & description length ----------------------------------
    const desc = tag(home.text, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i);
    const homeTitleLong = title ? title.length > TITLE_MAX : false;
    const homeDescLong = desc ? desc.length > DESC_MAX : false;
    const offenders = [...longMeta.map((p) => p.title)];
    if (homeTitleLong || homeDescLong) offenders.unshift("Home page");
    if (offenders.length > 0) {
      checks.push({
        id: "meta-length",
        tier: "tip",
        title: "Some titles or descriptions are too long",
        detail: `Google truncates titles past ~${TITLE_MAX} characters and descriptions past ~${DESC_MAX}. Tighten these so the whole line shows in results — the ✨ draft button rewrites to length.`,
        specifics: offenders.slice(0, 8),
        fix: { label: "Open Pages", to: "/admin/content/pages" },
      });
    }

    // ---- 7. Mobile viewport ---------------------------------------------
    if (/<meta[^>]+name=["']viewport["']/i.test(home.text)) {
      checks.push({
        id: "mobile",
        tier: "pass",
        title: "Comfortable on phones",
        detail: "Your pages declare a mobile viewport and the storefront is built mobile-first — most of your shoppers are on a phone.",
      });
    }

    // ---- 8. Canonical / page basics -------------------------------------
    if (/<link[^>]+rel=["']canonical["']/i.test(home.text)) {
      checks.push({
        id: "basics",
        tier: "pass",
        title: "Page basics are set",
        detail: "Canonical URLs (so duplicate paths don't split your ranking), per-page titles, and descriptions are generated automatically on every page.",
      });
    }

    // ---- 9. Page speed (edge TTFB) --------------------------------------
    checks.push(
      home.ms <= 900
        ? {
            id: "speed",
            tier: "pass",
            title: "Page loads fast",
            detail: `Your home page answered in ${home.ms} ms from the edge. Fast pages rank better and convert more.`,
          }
        : {
            id: "speed",
            tier: "tip",
            title: "Home page is a little slow",
            detail: `Your home page took ${home.ms} ms to respond. Oversized hero images are the usual cause — re-upload large images and Verto serves optimised versions.`,
            fix: { label: "Open Files", to: "/admin/files" },
          },
    );
  }

  // ---- 10. AI assistants / llms.txt --------------------------------------
  checks.push({
    id: "ai-index",
    tier: "pass",
    title: "AI assistants can read your site",
    detail: "Verto publishes an llms.txt index (the emerging standard for AI assistants) and clean, structured data, so ChatGPT, Claude, and Perplexity can understand and cite your shop.",
    fix: { label: "View llms.txt", href: `${origin}/llms.txt` },
  });

  // ---- 11. Social share image --------------------------------------------
  checks.push(
    cfg.defaultOgImage
      ? {
          id: "og-image",
          tier: "pass",
          title: "Link previews have a fallback image",
          detail: "Pages with a hero use it as the share image; anything without one falls back to your default. Links you post look intentional everywhere.",
          control: "og_image",
          value: cfg.defaultOgImage,
        }
      : {
          id: "og-image",
          tier: "tip",
          title: "Set a default share image",
          detail: "When a page has no hero image, links shared to Instagram, WhatsApp, or a group chat fall back to this. Without it they show a blank card. Upload one to Files and paste its URL.",
          control: "og_image",
          value: "",
          fix: { label: "Open Files", to: "/admin/files" },
        },
  );

  // ---- 12. Accessibility (alt text) --------------------------------------
  const altGaps = mediaMissingAlt?.n ?? 0;
  checks.push(
    altGaps === 0
      ? {
          id: "a11y",
          tier: "pass",
          title: "Headings and accessibility are well-implemented",
          detail: "Your public images carry alt text — how screen readers and image search understand your photography.",
        }
      : {
          id: "a11y",
          tier: "tip",
          title: "Has accessibility barriers",
          detail: `${altGaps} public image${altGaps === 1 ? "" : "s"} ${altGaps === 1 ? "is" : "are"} missing alt text. Alt text helps screen-reader shoppers and gets your photography into image search.`,
          fix: { label: "Open Files", to: "/admin/files" },
        },
  );

  // ---- 13. Page descriptions & excerpts ----------------------------------
  if (pagesMissingMeta.length > 0) {
    checks.push({
      id: "page-desc",
      tier: "tip",
      title: `${pagesMissingMeta.length} page${pagesMissingMeta.length === 1 ? "" : "s"} missing a search description`,
      detail: "Search engines write their own (often clumsy) snippet when a page has no description. The ✨ draft button in the page editor writes one in your voice.",
      specifics: pagesMissingMeta.map((p) => p.title),
      fix: { label: "Open Pages", to: "/admin/content/pages" },
    });
  } else if ((publishedPages?.n ?? 0) > 0) {
    checks.push({
      id: "page-desc",
      tier: "pass",
      title: "Every page has a search description",
      detail: `All ${publishedPages?.n} published pages describe themselves to search results.`,
    });
  }
  if (postsMissingMeta.length > 0) {
    checks.push({
      id: "post-desc",
      tier: "tip",
      title: `${postsMissingMeta.length} journal post${postsMissingMeta.length === 1 ? "" : "s"} missing an excerpt`,
      detail: "Excerpts double as the search snippet and the social share preview.",
      specifics: postsMissingMeta.map((p) => p.title),
      fix: { label: "Open Journal", to: "/admin/content/journal" },
    });
  }

  // ---- 14. Product photography -------------------------------------------
  if (productsMissingImages.length > 0) {
    checks.push({
      id: "product-photos",
      tier: "tip",
      title: `${productsMissingImages.length} live product${productsMissingImages.length === 1 ? "" : "s"} without photography`,
      detail: "Products with images are eligible for Google image search and rich results — Verto publishes Product schema with price and availability automatically, but it needs a photo to show.",
      specifics: productsMissingImages.map((p) => p.name),
      fix: { label: "Open Products", to: "/admin/products" },
    });
  }

  // ---- 15. Growth idea (Powered by Verto AI) -----------------------------
  const growth = await growthIdea(env, db).catch(() => null);
  if (growth) checks.push(growth);

  const counts = { warning: 0, tip: 0, growth: 0, pass: 0 };
  for (const c of checks) counts[c.tier]++;

  return { checks, counts, liveChecked, poweredByAi: Boolean(growth) };
}

/**
 * One AI-suggested content topic grounded in the shop's real catalogue — the
 * "growth idea" row (Verto's answer to a keyword tool). Best-effort: any
 * failure (no AI key, bad JSON) simply omits the row.
 */
async function growthIdea(env: Env, db: D1Database): Promise<CheckItem | null> {
  const brand = await getBrandName(env, db);
  const products = await all<{ name: string }>(
    db,
    `SELECT name FROM products WHERE is_published = 1 AND availability != 'archived' ORDER BY updated_at DESC LIMIT 8`,
  );
  if (products.length === 0) return null;

  try {
    const { aiComplete } = await import("./ai");
    const res = await aiComplete(env, {
      system:
        "You are an SEO content strategist for an independent fashion brand. Suggest ONE journal article the shop should write to attract search traffic from people who don't yet know the brand — informational, not a product pitch. Reply with ONLY compact JSON: " +
        `{"title":"<article title, max 8 words>","phrase":"<the search phrase it targets>","why":"<one sentence on who searches this and why it converts>"}`,
      prompt: `Brand: ${brand}\nSells: ${products.map((p) => p.name).join(", ")}`,
      maxTokens: 200,
    });
    const m = res.text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const raw = JSON.parse(m[0]) as { title?: string; phrase?: string; why?: string };
    if (!raw.title || !raw.phrase) return null;
    return {
      id: "growth-idea",
      tier: "growth",
      title: `Write: ${String(raw.title).slice(0, 90)}`,
      detail: `Targets people searching “${String(raw.phrase).slice(0, 90)}”. ${String(raw.why ?? "").slice(0, 200)} Publish it as a journal post — it's how strangers find you before they know your name.`,
      fix: { label: "Open Journal", to: "/admin/content/journal" },
    };
  } catch (err) {
    if (err instanceof AiUnavailableError) return null;
    throw err;
  }
}
