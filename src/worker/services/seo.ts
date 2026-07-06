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
      "Storefront, CMS, production, shipping, and AI marketing in one purpose-built platform for independent fashion brands. From first sample to sold out.",
    image: "/verto/hero.jpg",
    preloadImage: "/verto/hero.jpg",
  },
  "/features": {
    title: "Features — the full tour — Verto",
    description:
      "Production calendar, tech packs, factory portals, multi-carrier shipping, landed cost, block CMS, lookbooks, AI marketing, translations, wholesale, analytics — one platform.",
    image: "/verto/atelier.jpg",
  },
  "/why": {
    title: "Why Verto exists — Verto",
    description:
      "Fashion tech forgot the people who make fashion. The problem with running an independent label on generic commerce tools — and how Verto solves it.",
    image: "/verto/wall.jpg",
    preloadImage: "/verto/wall.jpg",
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

export async function buildSitemap(env: Env): Promise<string> {
  const base = env.APP_URL.replace(/\/$/, "");
  // Shop URLs carry the shop's path prefix (single active shop today).
  const { getPrimaryShopBase } = await import("./shops");
  const shopBase = await getPrimaryShopBase(env.DB);
  const urls: { loc: string; lastmod?: string }[] = [
    { loc: "/" },
    { loc: "/why" },
    { loc: "/features" },
    { loc: "/compare" },
    { loc: "/pricing" },
    { loc: `${shopBase}/` },
    { loc: `${shopBase}/products` },
    { loc: `${shopBase}/collections` },
    { loc: `${shopBase}/lookbook` },
    { loc: `${shopBase}/journal` },
    { loc: `${shopBase}/contact` },
  ];
  // Every other live shop gets its section fronts. The demo shop is
  // deliberately absent — it's noindex'd fictional content.
  const { DEMO_SHOP_SLUG, PRIMARY_SHOP_ID } = await import("./shops");
  const otherShops = await all<{ slug: string }>(
    env.DB,
    `SELECT slug FROM shops WHERE status = 'active' AND id != ? AND slug != ?`,
    PRIMARY_SHOP_ID,
    DEMO_SHOP_SLUG,
  );
  for (const s of otherShops) {
    for (const p of ["/", "/products", "/collections", "/lookbook", "/journal"]) {
      urls.push({ loc: `/${s.slug}${p === "/" ? "" : p}` });
    }
  }
  const pages = await all<{ slug: string; updated_at: string }>(
    env.DB,
    `SELECT slug, updated_at FROM pages WHERE is_published = 1 AND slug != 'home'`,
  );
  for (const p of pages) {
    urls.push({
      loc: ROOT_PAGE_SLUGS.has(p.slug) ? `${shopBase}/${p.slug}` : `${shopBase}/p/${p.slug}`,
      lastmod: p.updated_at?.slice(0, 10),
    });
  }
  const posts = await all<{ slug: string; published_at: string | null }>(
    env.DB,
    `SELECT slug, published_at FROM journal_posts WHERE is_published = 1`,
  );
  for (const post of posts) {
    urls.push({ loc: `${shopBase}/journal/${post.slug}`, lastmod: post.published_at?.slice(0, 10) });
  }
  const products = await all<{ slug: string; updated_at: string }>(
    env.DB,
    `SELECT slug, updated_at FROM products WHERE is_published = 1 AND availability != 'archived'`,
  );
  for (const product of products) {
    urls.push({ loc: `${shopBase}/products/${product.slug}`, lastmod: product.updated_at?.slice(0, 10) });
  }
  const collections = await all<{ slug: string; updated_at: string }>(
    env.DB,
    `SELECT slug, updated_at FROM collections WHERE is_published = 1`,
  );
  for (const col of collections) {
    urls.push({ loc: `${shopBase}/collections/${col.slug}`, lastmod: col.updated_at?.slice(0, 10) });
  }

  const body = urls
    .map(
      (u) =>
        `  <url><loc>${base}${escapeHtml(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}</url>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>`;
}
