import type { MiddlewareHandler } from "hono";
import { getShopByDomain, getShopById, getShopBySlug, PRIMARY_SHOP_ID } from "../services/shops";
import { getShopDb } from "../services/tenant-db";
import type { AppContext } from "../types/env";

/**
 * Resolve which shop an API request belongs to and hang its database on
 * the context. Runs before the session middleware, so authentication
 * itself is tenant-scoped: a session token only exists in its own shop's
 * database — a Rezene cookie can never authenticate against another shop.
 *
 * Resolution order:
 *  1. Custom domain (Host header matches shops.custom_domain)
 *  2. X-Verto-Shop header (set by the SPA from the injected shop context)
 *  3. The primary shop (legacy clients, webhooks, platform-level calls)
 *
 * The header only *selects a tenant*, never grants access: public data is
 * public per shop, and anything privileged still requires a session that
 * exists in that shop's own database.
 */
export const tenantMiddleware: MiddlewareHandler<AppContext> = async (c, next) => {
  let shopId = PRIMARY_SHOP_ID;
  let shopSlug: string | null = null;

  const host = new URL(c.req.url).hostname;
  const bare = host.replace(/^www\./, "");
  const domainShop = (await getShopByDomain(c.env.DB, host)) ?? (bare !== host ? await getShopByDomain(c.env.DB, bare) : null);
  if (domainShop) {
    shopId = domainShop.id;
    shopSlug = domainShop.slug;
  } else {
    const header = c.req.header("x-verto-shop");
    if (header) {
      const shop = await getShopBySlug(c.env.DB, header);
      if (!shop) return c.json({ error: "Unknown shop" }, 404);
      shopId = shop.id;
      shopSlug = shop.slug;
    } else {
      // Self-activating custom domains: a merchant saved this domain in
      // their settings and Cloudflare has since issued the certificate —
      // this very request arriving over HTTPS is the proof. First visit
      // flips the registry; no one has to come back and click a button.
      const platformHost = new URL(c.env.APP_URL || "https://verto.style").hostname;
      if (host !== platformHost && !host.endsWith(".workers.dev")) {
        const pendingId = await c.env.KV.get(`pending_domain:${bare}`);
        if (pendingId) {
          const shop = await getShopById(c.env.DB, pendingId);
          if (shop) {
            await c.env.DB.prepare(`UPDATE shops SET custom_domain = ? WHERE id = ?`).bind(bare, shop.id).run();
            await c.env.KV.delete(`pending_domain:${bare}`);
            shopId = shop.id;
            shopSlug = shop.slug;
          }
        }
      }
    }
  }

  c.set("shopId", shopId);
  c.set("shopSlug", shopSlug);
  c.set("db", getShopDb(c.env, shopId, PRIMARY_SHOP_ID));
  await next();
};
