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
}

function absolute(env: Env, url: string | null): string | null {
  if (!url) return null;
  if (/^https?:\/\//.test(url)) return url;
  return `${env.APP_URL.replace(/\/$/, "")}${url.startsWith("/") ? url : `/${url}`}`;
}

async function brandBits(env: Env): Promise<{ name: string; tagline: string }> {
  const rows = await all<{ key: string; value: string }>(
    env.DB,
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

export async function resolveRouteMeta(env: Env, pathname: string): Promise<RouteMeta> {
  const brand = await brandBits(env);
  const fallback: RouteMeta = { title: brand.name, description: brand.tagline || null, image: null };

  const pageMeta = async (slug: string): Promise<RouteMeta | null> => {
    const row = await first<{
      title: string;
      subtitle: string | null;
      meta_title: string | null;
      meta_description: string | null;
      hero_image_url: string | null;
    }>(
      env.DB,
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
        env.DB,
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
        env.DB,
        `SELECT id, name, subtitle, description FROM products WHERE slug = ? AND is_published = 1`,
        decodeURIComponent(product[1]),
      );
      if (!row) return fallback;
      const image = await first<{ url: string }>(
        env.DB,
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
        env.DB,
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
    meta.image ? `<meta property="og:image" content="${escapeHtml(meta.image)}">` : "",
    `<meta name="twitter:card" content="${meta.image ? "summary_large_image" : "summary"}">`,
  ]
    .filter(Boolean)
    .join("\n    ");
  return html
    .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
    .replace("</head>", `    ${tags}\n  </head>`);
}

export async function buildSitemap(env: Env): Promise<string> {
  const base = env.APP_URL.replace(/\/$/, "");
  const urls: { loc: string; lastmod?: string }[] = [
    { loc: "/" },
    { loc: "/products" },
    { loc: "/collections" },
    { loc: "/lookbook" },
    { loc: "/journal" },
    { loc: "/contact" },
  ];
  const pages = await all<{ slug: string; updated_at: string }>(
    env.DB,
    `SELECT slug, updated_at FROM pages WHERE is_published = 1 AND slug != 'home'`,
  );
  for (const p of pages) {
    urls.push({
      loc: ROOT_PAGE_SLUGS.has(p.slug) ? `/${p.slug}` : `/p/${p.slug}`,
      lastmod: p.updated_at?.slice(0, 10),
    });
  }
  const posts = await all<{ slug: string; published_at: string | null }>(
    env.DB,
    `SELECT slug, published_at FROM journal_posts WHERE is_published = 1`,
  );
  for (const post of posts) {
    urls.push({ loc: `/journal/${post.slug}`, lastmod: post.published_at?.slice(0, 10) });
  }
  const products = await all<{ slug: string; updated_at: string }>(
    env.DB,
    `SELECT slug, updated_at FROM products WHERE is_published = 1 AND availability != 'archived'`,
  );
  for (const product of products) {
    urls.push({ loc: `/products/${product.slug}`, lastmod: product.updated_at?.slice(0, 10) });
  }
  const collections = await all<{ slug: string; updated_at: string }>(
    env.DB,
    `SELECT slug, updated_at FROM collections WHERE is_published = 1`,
  );
  for (const col of collections) {
    urls.push({ loc: `/collections/${col.slug}`, lastmod: col.updated_at?.slice(0, 10) });
  }

  const body = urls
    .map(
      (u) =>
        `  <url><loc>${base}${escapeHtml(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}</url>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>`;
}
