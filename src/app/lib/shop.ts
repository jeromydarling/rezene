/**
 * Shop context injected by the worker at the edge (window.__VERTO__):
 * null on the platform's own pages (verto.style root), a shop object on
 * /<slug> or a CNAME'd shop domain. The SPA boots the marketing app or the
 * shop app accordingly, and admin screens use basePath when composing
 * absolute URLs (share links, view-live, previews).
 */

export interface VertoShop {
  slug: string;
  name: string;
  /** '' on custom domains, '/<slug>' on path-based access. */
  basePath: string;
}

declare global {
  interface Window {
    __VERTO__?: { shop: VertoShop | null };
  }
}

const CLIENT_RESERVED = new Set([
  "",
  "pricing",
  "features",
  "signup",
  "login",
  "why",
  "compare",
  "api",
  "assets",
  "media",
  "admin",
]);

export function getShop(): VertoShop | null {
  if (typeof window === "undefined") return null;
  if (window.__VERTO__) return window.__VERTO__.shop;
  // Dev fallback (vite dev server serves the shell without edge injection):
  // treat a plausible first path segment as the shop slug.
  const segment = window.location.pathname.split("/")[1] ?? "";
  if (!CLIENT_RESERVED.has(segment) && /^[a-z0-9-]{2,}$/.test(segment)) {
    return { slug: segment, name: segment, basePath: `/${segment}` };
  }
  return null;
}

/** Prefix for building absolute shop URLs ('' on the platform site). */
export function getShopBase(): string {
  return getShop()?.basePath ?? "";
}
