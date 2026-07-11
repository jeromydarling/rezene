import { all, first } from "./db";
import type { Env } from "../types/env";

/**
 * Edge SEO: the storefront is a client-rendered SPA, so crawlers and link
 * unfurlers would otherwise see one generic index.html for every URL.
 * Document routes run worker-first (wrangler.toml), and this module
 * resolves per-route meta (title, description, OG image) from D1 and
 * injects it into the served HTML. Also emits sitemap.xml / robots.txt.
 */

export interface RouteMeta {
  title: string;
  description: string | null;
  image: string | null;
  /** noindex for utility pages (cart etc.) */
  noindex?: boolean;
  /** LCP hint: preload this image from the document head. */
  preloadImage?: string;
}

/** Platform (Verto) marketing pages served at the domain root. */
export const VERTO_META: Record<string, RouteMeta> = {
  "/": {
    title: "Verto — The operating system for independent clothing labels",
    description:
      "Storefront, CMS, production, shipping, and LLM marketing in one purpose-built platform for independent fashion brands. From first sample to sold out.",
    image: "/verto/hero.jpg",
    preloadImage: "/verto/hero.jpg",
  },
  "/features": {
    title: "Features — the full tour — Verto",
    description:
      "Production calendar, tech packs, factory portals, multi-carrier shipping, landed cost, block CMS, lookbooks, LLM marketing, translations, wholesale, analytics — one platform.",
    image: "/verto/atelier.jpg",
  },
  "/why": {
    title: "Why Verto exists — Verto",
    description:
      "Fashion tech forgot the people who make fashion. The problem with running an independent label on generic commerce tools — and how Verto solves it.",
    image: "/verto/wall.jpg",
    preloadImage: "/verto/wall.jpg",
  },
  "/stories": {
    title: "Four stories: zero to paying clients overnight — Verto",
    description:
      "A stylist goes from signup to a paid $425 deposit in a day. A designer's pre-orders fund production. A founder prices her season on evidence, not vibes. A four-year-old label switches in one afternoon. What actually happens when you press create my shop.",
    image: "/verto/dusk.jpg",
  },
  "/compare": {
    title: "Verto vs. Shopify, fashion ERPs & the spreadsheet patchwork — Verto",
    description:
      "An honest, capability-by-capability comparison of Verto against Shopify plus apps, retail ERP/PLM suites, and the DIY spreadsheet stack.",
    image: "/verto/hero.jpg",
  },
  "/pricing": {
    title: "Pricing — Verto",
    description:
      "Plans for every stage of a label — from pre-launch side project to multi-collection house. Start free for 14 days.",
    image: "/verto/dusk.jpg",
  },
  "/signup": {
    title: "Open your shop — Verto",
    description: "Reserve your shop address and be first in when we onboard new labels.",
    image: "/verto/dusk.jpg",
  },
};

/** Inject the resolved shop (or null for the platform site) into the shell. */
export function injectShopContext(
  html: string,
  shop: { slug: string; name: string; basePath: string } | null,
): string {
  const payload = JSON.stringify({ shop }).replaceAll("<", "\\u003c");
  return html.replace("</head>", `    <script>window.__VERTO__=${payload}</script>\n  </head>`);
}

function absolute(env: Env, url: string | null): string | null {
  if (!url) return null;
  if (/^https?:\/\//.test(url)) return url;
  return `${env.APP_URL.replace(/\/$/, "")}${url.startsWith("/") ? url : `/${url}`}`;
}

async function brandBits(env: Env, db: D1Database): Promise<{ name: string; tagline: string }> {
  const rows = await all<{ key: string; value: string }>(
    db,
    `SELECT key, value FROM settings WHERE key IN ('brand_name','brand_tagline')`,
  );
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return { name: map.brand_name ?? env.BRAND_NAME, tagline: map.brand_tagline ?? "" };
}

const STATIC_META: Record<string, { title: string; description?: string; noindex?: boolean }> = {
  "/products": { title: "Shop" },
  "/collections": { title: "Collections" },
  "/lookbook": { title: "Lookbook" },
  "/journal": { title: "Journal" },
  "/contact": { title: "Contact" },
  "/cart": { title: "Cart", noindex: true },
};

/** Built-in page slugs served at the root (not /p/…). */
const ROOT_PAGE_SLUGS = new Set([
  "story",
  "atelier",
  "size-guide",
  "shipping-returns",
  "stockists",
  "privacy",
  "terms",
]);

export async function resolveRouteMeta(
  env: Env,
  db: D1Database,
  pathname: string,
): Promise<RouteMeta> {
  const brand = await brandBits(env, db);
  const fallback: RouteMeta = { title: brand.name, description: brand.tagline || null, image: null };

  const pageMeta = async (slug: string): Promise<RouteMeta | null> => {
    const row = await first<{
      title: string;
      subtitle: string | null;
      meta_title: string | null;
      meta_description: string | null;
      hero_image_url: string | null;
    }>(
      db,
      `SELECT title, subtitle, meta_title, meta_description, hero_image_url
       FROM pages WHERE slug = ? AND is_published = 1`,
      slug,
    );
    if (!row) return null;
    return {
      title: row.meta_title ?? `${row.title} — ${brand.name}`,
      description: row.meta_description ?? row.subtitle ?? brand.tagline ?? null,
      image: absolute(env, row.hero_image_url),
    };
  };

  try {
    if (pathname === "/") {
      const home = await pageMeta("home");
      return {
        title: brand.tagline ? `${brand.name} — ${brand.tagline}` : brand.name,
        description: home?.description ?? brand.tagline ?? null,
        image: home?.image ?? null,
      };
    }

    const staticEntry = STATIC_META[pathname];
    if (staticEntry) {
      return {
        title: `${staticEntry.title} — ${brand.name}`,
        description: staticEntry.description ?? brand.tagline ?? null,
        image: null,
        noindex: staticEntry.noindex,
      };
    }

    const rootSlug = pathname.slice(1);
    if (ROOT_PAGE_SLUGS.has(rootSlug)) {
      return (await pageMeta(rootSlug)) ?? fallback;
    }

    const p = pathname.match(/^\/p\/([^/]+)$/);
    if (p) return (await pageMeta(decodeURIComponent(p[1]))) ?? fallback;

    const journal = pathname.match(/^\/journal\/([^/]+)$/);
    if (journal) {
      const row = await first<{
        title: string;
        excerpt: string | null;
        meta_title: string | null;
        meta_description: string | null;
        hero_image_url: string | null;
      }>(
        db,
        `SELECT title, excerpt, meta_title, meta_description, hero_image_url
         FROM journal_posts WHERE slug = ? AND is_published = 1`,
        decodeURIComponent(journal[1]),
      );
      if (!row) return fallback;
      return {
        title: row.meta_title ?? `${row.title} — ${brand.name}`,
        description: row.meta_description ?? row.excerpt ?? null,
        image: absolute(env, row.hero_image_url),
      };
    }

    const product = pathname.match(/^\/products\/([^/]+)$/);
    if (product) {
      const row = await first<{
        id: string;
        name: string;
        subtitle: string | null;
        description: string | null;
      }>(
        db,
        `SELECT id, name, subtitle, description FROM products WHERE slug = ? AND is_published = 1`,
        decodeURIComponent(product[1]),
      );
      if (!row) return fallback;
      const image = await first<{ url: string }>(
        db,
        `SELECT url FROM product_images WHERE product_id = ? ORDER BY sort_order LIMIT 1`,
        row.id,
      );
      return {
        title: `${row.name} — ${brand.name}`,
        description: row.subtitle ?? row.description?.slice(0, 200) ?? null,
        image: absolute(env, image?.url ?? null),
      };
    }

    const collection = pathname.match(/^\/collections\/([^/]+)$/);
    if (collection) {
      const row = await first<{ name: string; description: string | null; hero_image_url: string | null }>(
        db,
        `SELECT name, description, hero_image_url FROM collections WHERE slug = ? AND is_published = 1`,
        decodeURIComponent(collection[1]),
      );
      if (!row) return fallback;
      return {
        title: `${row.name} — ${brand.name}`,
        description: row.description,
        image: absolute(env, row.hero_image_url),
      };
    }
  } catch (err) {
    console.error("[seo] meta resolution failed:", err);
  }
  return fallback;
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Replace <title> and inject meta/OG tags into the SPA shell. */
export function injectMeta(html: string, meta: RouteMeta, canonicalUrl: string): string {
  const title = escapeHtml(meta.title);
  // Relative og/preload images become absolute against the canonical origin.
  const origin = canonicalUrl.match(/^https?:\/\/[^/]+/)?.[0] ?? "";
  const abs = (url: string) => (/^https?:\/\//.test(url) ? url : `${origin}${url}`);
  const tags = [
    meta.description ? `<meta name="description" content="${escapeHtml(meta.description)}">` : "",
    meta.noindex ? `<meta name="robots" content="noindex">` : "",
    `<link rel="canonical" href="${escapeHtml(canonicalUrl)}">`,
    `<meta property="og:title" content="${title}">`,
    meta.description
      ? `<meta property="og:description" content="${escapeHtml(meta.description)}">`
      : "",
    `<meta property="og:type" content="website">`,
    `<meta property="og:url" content="${escapeHtml(canonicalUrl)}">`,
    meta.image ? `<meta property="og:image" content="${escapeHtml(abs(meta.image))}">` : "",
    `<meta name="twitter:card" content="${meta.image ? "summary_large_image" : "summary"}">`,
    meta.preloadImage
      ? `<link rel="preload" as="image" href="${escapeHtml(abs(meta.preloadImage))}" fetchpriority="high">`
      : "",
  ]
    .filter(Boolean)
    .join("\n    ");
  return html
    .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
    // The shell's static description would otherwise duplicate the injected one.
    .replace(/\s*<meta\s+name="description"[\s\S]*?\/?>/, "")
    .replace("</head>", `    ${tags}\n  </head>`);
}

/**
 * Organization + WebSite JSON-LD for the platform root; Organization for a
 * shop's home page. Injected only on home documents — one authoritative
 * statement of identity, not schema wallpaper on every route.
 */
export function buildStructuredData(
  env: Env,
  shop: { slug: string; name: string; basePath: string } | null,
  meta: RouteMeta,
): string {
  const base = env.APP_URL.replace(/\/$/, "");
  const ld = shop
    ? [
        {
          "@context": "https://schema.org",
          "@type": "Organization",
          name: shop.name,
          url: `${base}${shop.basePath || ""}`,
          description: meta.description ?? undefined,
        },
      ]
    : [
        {
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Verto",
          url: base,
          logo: `${base}/verto/hero.jpg`,
          description: meta.description ?? undefined,
        },
        {
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Verto",
          url: base,
        },
      ];
  const json = JSON.stringify(ld.length === 1 ? ld[0] : ld).replaceAll("<", "\\u003c");
  return `<script type="application/ld+json">${json}</script>`;
}

// ---------- Per-shop SEO configuration (settings-driven) ----------
export interface ShopSeoConfig {
  /** 'hidden' shops noindex everything and vanish from sitemaps. */
  hidden: boolean;
  defaultOgImage: string | null;
  verificationGoogle: string | null;
  verificationBing: string | null;
}

export async function getShopSeoConfig(db: D1Database): Promise<ShopSeoConfig> {
  const rows = await all<{ key: string; value: string }>(
    db,
    `SELECT key, value FROM settings WHERE key IN
     ('search_visibility','default_og_image','site_verification_google','site_verification_bing')`,
  );
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    hidden: map.search_visibility === "hidden",
    defaultOgImage: map.default_og_image || null,
    verificationGoogle: map.site_verification_google || null,
    verificationBing: map.site_verification_bing || null,
  };
}

/** Search-console ownership proofs, injected on every shop document. */
export function injectVerification(html: string, cfg: ShopSeoConfig): string {
  const tags = [
    cfg.verificationGoogle
      ? `<meta name="google-site-verification" content="${escapeHtml(cfg.verificationGoogle)}">`
      : "",
    cfg.verificationBing
      ? `<meta name="msvalidate.01" content="${escapeHtml(cfg.verificationBing)}">`
      : "",
  ]
    .filter(Boolean)
    .join("\n    ");
  if (!tags) return html;
  return html.replace("</head>", `    ${tags}\n  </head>`);
}

// ---------- Product rich results ----------
/** Product/Offer JSON-LD for a shop's product page — rich-result eligibility. */
export async function buildProductLd(
  env: Env,
  db: D1Database,
  productSlug: string,
  canonicalUrl: string,
): Promise<string | null> {
  const row = await first<{
    id: string;
    name: string;
    subtitle: string | null;
    description: string | null;
    base_price_cents: number;
    currency: string;
    availability: string;
  }>(
    db,
    `SELECT id, name, subtitle, description, base_price_cents, currency, availability
     FROM products WHERE slug = ? AND is_published = 1`,
    productSlug,
  );
  if (!row) return null;
  const image = await first<{ url: string }>(
    db,
    `SELECT url FROM product_images WHERE product_id = ? ORDER BY sort_order LIMIT 1`,
    row.id,
  );
  const schemaAvailability =
    row.availability === "sold_out"
      ? "https://schema.org/OutOfStock"
      : row.availability === "pre_order"
        ? "https://schema.org/PreOrder"
        : "https://schema.org/InStock";
  const ld = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: row.name,
    description: row.subtitle ?? row.description?.slice(0, 300) ?? undefined,
    image: image ? [absolute(env, image.url)] : undefined,
    url: canonicalUrl,
    offers: {
      "@type": "Offer",
      url: canonicalUrl,
      priceCurrency: row.currency,
      price: (row.base_price_cents / 100).toFixed(2),
      availability: schemaAvailability,
    },
  };
  return `<script type="application/ld+json">${JSON.stringify(ld).replaceAll("<", "\\u003c")}</script>`;
}

// ---------- Sitemaps ----------
interface SitemapUrl {
  loc: string;
  lastmod?: string;
}

/** Every indexable URL for one shop, prefixed with its base path ('' on a custom domain). */
export async function buildShopUrls(db: D1Database, basePath: string): Promise<SitemapUrl[]> {
  const urls: SitemapUrl[] = [
    { loc: `${basePath}/` },
    { loc: `${basePath}/products` },
    { loc: `${basePath}/collections` },
    { loc: `${basePath}/lookbook` },
    { loc: `${basePath}/journal` },
    { loc: `${basePath}/contact` },
  ];
  const pages = await all<{ slug: string; updated_at: string }>(
    db,
    `SELECT slug, updated_at FROM pages WHERE is_published = 1 AND slug != 'home'`,
  );
  for (const p of pages) {
    urls.push({
      loc: ROOT_PAGE_SLUGS.has(p.slug) ? `${basePath}/${p.slug}` : `${basePath}/p/${p.slug}`,
      lastmod: p.updated_at?.slice(0, 10),
    });
  }
  const posts = await all<{ slug: string; published_at: string | null }>(
    db,
    `SELECT slug, published_at FROM journal_posts WHERE is_published = 1`,
  );
  for (const post of posts) {
    urls.push({ loc: `${basePath}/journal/${post.slug}`, lastmod: post.published_at?.slice(0, 10) });
  }
  const products = await all<{ slug: string; updated_at: string }>(
    db,
    `SELECT slug, updated_at FROM products WHERE is_published = 1 AND availability != 'archived'`,
  );
  for (const product of products) {
    urls.push({ loc: `${basePath}/products/${product.slug}`, lastmod: product.updated_at?.slice(0, 10) });
  }
  const collections = await all<{ slug: string; updated_at: string }>(
    db,
    `SELECT slug, updated_at FROM collections WHERE is_published = 1`,
  );
  for (const col of collections) {
    urls.push({ loc: `${basePath}/collections/${col.slug}`, lastmod: col.updated_at?.slice(0, 10) });
  }
  return urls;
}

function renderSitemap(base: string, urls: SitemapUrl[]): string {
  const body = urls
    .map(
      (u) =>
        `  <url><loc>${base}${escapeHtml(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}</url>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>`;
}

/**
 * The platform sitemap: marketing pages plus the FULL contents of every
 * active shop (pages, posts, products, collections — each read from that
 * shop's own database). Excludes the demo shop and any shop whose owner
 * flipped "search engine visibility" off.
 */
export async function buildSitemap(env: Env): Promise<string> {
  const base = env.APP_URL.replace(/\/$/, "");
  const urls: SitemapUrl[] = [
    { loc: "/" },
    { loc: "/why" },
    { loc: "/stories" },
    { loc: "/features" },
    { loc: "/compare" },
    { loc: "/pricing" },
  ];
  const { DEMO_SHOP_SLUG } = await import("./shops");
  const { getShopDb } = await import("./tenant-db");
  const { PRIMARY_SHOP_ID } = await import("./shops");
  const shops = await all<{ id: string; slug: string; custom_domain: string | null }>(
    env.DB,
    `SELECT id, slug, custom_domain FROM shops WHERE status = 'active' AND slug != ?`,
    DEMO_SHOP_SLUG,
  );
  for (const shop of shops) {
    try {
      const db = getShopDb(env, shop.id, PRIMARY_SHOP_ID);
      const cfg = await getShopSeoConfig(db);
      if (cfg.hidden) continue;
      // Shops on their own domain are indexed there, not under verto.style.
      if (shop.custom_domain) continue;
      urls.push(...(await buildShopUrls(db, `/${shop.slug}`)));
    } catch (err) {
      console.error(`[seo] sitemap skip /${shop.slug}:`, String(err).slice(0, 120));
    }
  }
  return renderSitemap(base, urls);
}

/** A custom-domain shop's own sitemap, rooted at its domain. */
export async function buildShopSitemap(
  env: Env,
  shop: { id: string; custom_domain: string | null },
): Promise<string> {
  const { getShopDb } = await import("./tenant-db");
  const { PRIMARY_SHOP_ID } = await import("./shops");
  const db = getShopDb(env, shop.id, PRIMARY_SHOP_ID);
  const cfg = await getShopSeoConfig(db);
  const urls = cfg.hidden ? [] : await buildShopUrls(db, "");
  return renderSitemap(`https://${shop.custom_domain}`, urls);
}

/** A shop's own llms.txt (served on its custom domain). */
export async function buildShopLlms(
  env: Env,
  shop: { id: string; name: string; custom_domain: string | null },
): Promise<string> {
  const { getShopDb } = await import("./tenant-db");
  const { PRIMARY_SHOP_ID } = await import("./shops");
  const db = getShopDb(env, shop.id, PRIMARY_SHOP_ID);
  const brand = await brandBits(env, db);
  const base = `https://${shop.custom_domain}`;
  const lines = [
    `# ${brand.name}`,
    ``,
    `> ${brand.tagline || `${brand.name} — an independent clothing label.`}`,
    ``,
    `## Pages`,
    ``,
    `- [Shop](${base}/products): the current pieces`,
    `- [Collections](${base}/collections)`,
    `- [Lookbook](${base}/lookbook)`,
    `- [Journal](${base}/journal)`,
    `- [Contact](${base}/contact)`,
  ];
  const pages = await all<{ slug: string; title: string }>(
    db,
    `SELECT slug, title FROM pages WHERE is_published = 1 AND slug != 'home' LIMIT 20`,
  );
  for (const p of pages) {
    const path = ROOT_PAGE_SLUGS.has(p.slug) ? `/${p.slug}` : `/p/${p.slug}`;
    lines.push(`- [${p.title}](${base}${path})`);
  }
  lines.push("", `Powered by [Verto](${env.APP_URL}).`, "");
  return lines.join("\n");
}
