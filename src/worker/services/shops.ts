import { first } from "./db";
import type { Env } from "../types/env";

/**
 * Shop resolution for path-based tenancy: the platform root (verto.style)
 * is Verto's marketing site; each shop lives at /<slug>, or at its own
 * domain once a CNAME is mapped to `shops.custom_domain`.
 *
 * NOTE: shop *data* is still single-tenant (Rezene) — this layer gives the
 * platform its URL structure, registry, and signup so tenant scoping can
 * land next without another URL migration.
 */

export interface Shop {
  id: string;
  slug: string;
  name: string;
  status: string;
  custom_domain: string | null;
}

/** The flagship shop, which lives on the bound D1 (all others get a DO). */
export const PRIMARY_SHOP_ID = "shop_rezene";

/**
 * The public demo shop (fake brand, seeded catalog). Its storefront is the
 * marketing site's "live demo" and its admin sits behind an email gate that
 * opens a read-only viewer session.
 */
export const DEMO_SHOP_SLUG = "maison";
export const DEMO_SHOP_ID = "shop_demo_maison";
export const DEMO_VIEWER_EMAIL = "demo-viewer@verto.style";

/**
 * The demo login is deliberately public: the account is viewer-role only
 * (every write path is blocked by requireAdminWrite), so a well-known
 * password costs nothing and means anything that needs to look at the demo
 * — screenshot pipelines, docs, curious prospects — can sign in without
 * secrets. Printed on the demo sign-in card.
 */
export const DEMO_VIEWER_PASSWORD = "maison-demo";

/** Slugs that can never become shops (platform + app routes). */
export const RESERVED_SLUGS = new Set([
  "api",
  "media",
  "assets",
  "admin",
  "pricing",
  "features",
  "signup",
  "login",
  "why",
  "compare",
  "verto",
  "shop",
  "shops",
  "app",
  "www",
  "docs",
  "help",
  "support",
  "blog",
  "about",
  "legal",
  "terms",
  "privacy",
  "sitemap.xml",
  "robots.txt",
  "favicon.ico",
]);

export async function getShopBySlug(db: D1Database, slug: string): Promise<Shop | null> {
  if (!slug || RESERVED_SLUGS.has(slug)) return null;
  return first<Shop>(
    db,
    `SELECT id, slug, name, status, custom_domain FROM shops WHERE slug = ? AND status = 'active'`,
    slug.toLowerCase(),
  );
}

export async function getShopById(db: D1Database, id: string): Promise<Shop | null> {
  return first<Shop>(
    db,
    `SELECT id, slug, name, status, custom_domain FROM shops WHERE id = ? AND status = 'active'`,
    id,
  );
}

export async function getShopByDomain(db: D1Database, host: string): Promise<Shop | null> {
  return first<Shop>(
    db,
    `SELECT id, slug, name, status, custom_domain FROM shops
     WHERE custom_domain = ? AND status = 'active'`,
    host.toLowerCase(),
  );
}

export interface ShopContext {
  shop: Shop | null;
  /** Path with the shop prefix removed ('/rezene/products' → '/products'). */
  strippedPath: string;
  /** '' for custom domains, '/<slug>' for path-based access. */
  basePath: string;
}

/** Resolve the shop for a request: custom domain first, then /<slug> path. */
export async function resolveShop(env: Env, url: URL): Promise<ShopContext> {
  const platformHost = safeHost(env.APP_URL);
  if (url.hostname !== platformHost && !url.hostname.endsWith(".workers.dev") && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    const shop = await getShopByDomain(env.DB, url.hostname);
    if (shop) return { shop, strippedPath: url.pathname, basePath: "" };
  }
  const segment = url.pathname.split("/")[1] ?? "";
  const shop = await getShopBySlug(env.DB, segment);
  if (shop) {
    const strippedPath = url.pathname.slice(segment.length + 1) || "/";
    return { shop, strippedPath, basePath: `/${shop.slug}` };
  }
  return { shop: null, strippedPath: url.pathname, basePath: "" };
}

function safeHost(appUrl: string): string {
  try {
    return new URL(appUrl).hostname;
  } catch {
    return "";
  }
}

/**
 * The platform's flagship shop — used to build absolute URLs from
 * single-tenant code paths (checkout redirects, share links) until tenant
 * scoping lands. There is exactly one active shop today.
 */
export async function getPrimaryShopBase(db: D1Database): Promise<string> {
  const shop = await first<{ slug: string }>(
    db,
    `SELECT slug FROM shops WHERE status = 'active' ORDER BY created_at LIMIT 1`,
  );
  return shop ? `/${shop.slug}` : "";
}
