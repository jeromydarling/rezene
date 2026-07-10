import { Hono } from "hono";
import { sessionMiddleware, requireAdminRead } from "./middleware/auth";
import { ValidationError } from "./services/validators";
import { authRoutes } from "./routes/auth";
import { publicRoutes } from "./routes/public";
import { commerceRoutes } from "./routes/commerce";
import { accountRoutes } from "./routes/account";
import { wholesalePortalRoutes } from "./routes/wholesale-portal";
import { stripeWebhookRoutes } from "./routes/stripe-webhooks";
import { shippingWebhookRoutes } from "./routes/shipping-webhooks";
import { renderCallbackRoutes } from "./routes/render-callbacks";
import { factoryRoutes } from "./routes/factory";
import { lineSheetRoutes } from "./routes/linesheet";
import { adminDashboardRoutes } from "./routes/admin-dashboard";
import { adminStyleRoutes } from "./routes/admin-styles";
import { adminProductRoutes } from "./routes/admin-products";
import { adminSupplierRoutes } from "./routes/admin-suppliers";
import { adminProductionRoutes } from "./routes/admin-production";
import { adminTechPackRoutes } from "./routes/admin-techpacks";
import { adminTechPackAiRoutes } from "./routes/admin-techpack-ai";
import { adminCommerceRoutes } from "./routes/admin-commerce";
import { adminReturnsRoutes } from "./routes/admin-returns";
import { adminReviewsRoutes } from "./routes/admin-reviews";
import { adminExportRoutes } from "./routes/admin-export";
import { adminCashflowRoutes } from "./routes/admin-cashflow";
import { adminLocationsRoutes } from "./routes/admin-locations";
import { adminCostingRoutes } from "./routes/admin-costing";
import { adminAiRoutes } from "./routes/admin-ai";
import { admin3dRoutes } from "./routes/admin-3d";
import { adminFittingRoutes } from "./routes/admin-fitting";
import { adminClientRoutes } from "./routes/admin-clients";
import { adminCommissionRoutes } from "./routes/admin-commissions";
import { clientPortalRoutes } from "./routes/client-portal";
import { publicBookingRoutes, adminBookingRoutes } from "./routes/booking";
import { adminFileRoutes } from "./routes/admin-files";
import { adminSettingsRoutes } from "./routes/admin-settings";
import { adminBrandRoutes } from "./routes/admin-brand";
import { adminMessagesRoutes } from "./routes/admin-messages";
import { adminShippingRoutes } from "./routes/admin-shipping";
import { adminAnalyticsRoutes } from "./routes/admin-analytics";
import { adminContentRoutes } from "./routes/admin-content";
import { adminWholesaleRoutes } from "./routes/admin-wholesale";
import { adminMarketingRoutes } from "./routes/admin-marketing";
import { adminImportRoutes } from "./routes/admin-import";
import { adminPlatformRoutes } from "./routes/admin-platform";
import { adminCrmRoutes } from "./routes/admin-crm";
import { adminUsersRoutes } from "./routes/admin-users";
import { adminBrainRoutes } from "./routes/admin-brain";
import { adminFeedbackRoutes } from "./routes/admin-feedback";
import { adminKbRoutes } from "./routes/admin-kb";
import { adminSourcingRoutes } from "./routes/admin-sourcing";
import { adminDomainRoutes } from "./routes/admin-domain";
import { tenantMiddleware } from "./middleware/tenant";
import { getShopDb } from "./services/tenant-db";
import type { AppContext, Env } from "./types/env";

// Per-shop SQLite databases (Durable Object class must be exported here).
export { ShopDatabase } from "./do/shop-database";

const app = new Hono<AppContext>();

// Order matters: the tenant is resolved first so authentication itself is
// scoped to the shop's own database.
app.use("*", tenantMiddleware);
app.use("*", sessionMiddleware);

app.onError((err, c) => {
  if (err instanceof ValidationError) {
    return c.json({ error: "Validation failed", details: err.details }, 400);
  }
  console.error(`[api] ${c.req.method} ${c.req.path}:`, err);
  // Never leak stack traces or internals to clients.
  const message = c.env.APP_ENV === "development" ? String(err) : "Internal error";
  return c.json({ error: message }, 500);
});

app.get("/api/health", (c) =>
  c.json({ ok: true, brand: c.env.BRAND_NAME, env: c.env.APP_ENV }),
);

// Public media: streams R2 objects flagged is_public (storefront imagery
// uploaded through the CMS). File ids are unique per upload → immutable cache.
// Served per tenant: /media/:id uses the request's resolved shop (custom
// domain or header, defaulting to the primary shop for legacy URLs), and
// /:shop/media/:id addresses a shop explicitly (what new uploads emit).
async function serveMedia(c: Context<AppContext>, db: D1Database, fileId: string) {
  const row = await db
    .prepare(`SELECT r2_key, content_type FROM files WHERE id = ? AND is_public = 1`)
    .bind(fileId)
    .first<{ r2_key: string; content_type: string | null }>();
  if (!row) return c.json({ error: "Not found" }, 404);
  const object = await c.env.FILES.get(row.r2_key);
  if (!object) return c.json({ error: "Not found" }, 404);
  return new Response(object.body as ReadableStream, {
    headers: {
      "content-type": row.content_type ?? "application/octet-stream",
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
app.get("/media/:fileId", (c) => serveMedia(c, c.var.db, c.req.param("fileId")));
app.get("/:shopSlug/media/:fileId", async (c) => {
  const { getShopBySlug } = await import("./services/shops");
  const shop = await getShopBySlug(c.env.DB, c.req.param("shopSlug"));
  if (!shop) return c.json({ error: "Not found" }, 404);
  const { PRIMARY_SHOP_ID } = await import("./services/shops");
  return serveMedia(c, getShopDb(c.env, shop.id, PRIMARY_SHOP_ID), c.req.param("fileId"));
});

// --- Edge SEO ------------------------------------------------------------
// All document traffic runs worker-first (wrangler.toml): the platform
// root serves Verto's marketing site, /<shop-slug> (or a CNAME'd custom
// domain) serves that shop's storefront — same SPA shell, with the shop
// context and per-route SEO meta injected at the edge. Legacy Rezene-era
// paths 301 to the shop-prefixed equivalents.
import { buildProductLd, buildSitemap, buildStructuredData, getShopSeoConfig, injectMeta, injectShopContext, injectVerification, resolveRouteMeta, VERTO_META } from "./services/seo";
import { DEMO_SHOP_SLUG, getPrimaryShopBase, PRIMARY_SHOP_ID, resolveShop } from "./services/shops";
import type { Context } from "hono";

/** Storefront/app paths that existed before the shop prefix (for 301s). */
const LEGACY_SHOP_PREFIXES = [
  "/products",
  "/collections",
  "/journal",
  "/lookbook",
  "/story",
  "/atelier",
  "/contact",
  "/cart",
  "/checkout",
  "/p/",
  "/size-guide",
  "/shipping-returns",
  "/stockists",
  "/factory/",
  "/linesheet/",
  "/admin",
];

async function serveDocument(c: Context<AppContext>): Promise<Response> {
  const url = new URL(c.req.url);

  // API/media misses stay JSON 404s — the SPA shell would mask real errors.
  // Exception: /media/placeholder/* is the seed catalog's static demo
  // photography, shipped as assets rather than R2 uploads.
  if (
    url.pathname.startsWith("/api/") ||
    (url.pathname.startsWith("/media/") && !url.pathname.startsWith("/media/placeholder/"))
  ) {
    return c.json({ error: "Not found" }, 404);
  }

  // Static files (hashed bundles, favicons) pass straight to the asset layer.
  // A missing file must be a real 404, not the SPA shell: a stale browser
  // asking for a replaced bundle would get HTML-as-JavaScript and render
  // nothing at all.
  if (/\.[a-z0-9]+$/i.test(url.pathname) && !url.pathname.endsWith(".html")) {
    const asset = (await c.env.ASSETS.fetch(c.req.raw)) as unknown as Response;
    if ((asset.headers.get("content-type") ?? "").includes("text/html")) {
      return c.text("Not found", 404);
    }
    return asset;
  }

  const { shop, strippedPath, basePath } = await resolveShop(c.env, url);

  // No shop matched: either a Verto platform page, a legacy shop path
  // (redirect into the flagship shop), or an unknown slug (Verto 404 shell).
  if (!shop) {
    if (
      LEGACY_SHOP_PREFIXES.some(
        (prefix) => url.pathname === prefix.replace(/\/$/, "") || url.pathname.startsWith(prefix.endsWith("/") ? prefix : `${prefix}/`),
      )
    ) {
      const base = await getPrimaryShopBase(c.env.DB);
      if (base) return c.redirect(`${base}${url.pathname}${url.search}`, 301);
    }
  }

  const shell = await c.env.ASSETS.fetch(new Request(`${url.origin}/index.html`));
  if (!shell.ok) return shell as unknown as Response;
  // Shops on their own domain canonicalize to that domain, not verto.style.
  const onCustomDomain = Boolean(shop && shop.custom_domain === url.hostname);
  const canonicalBase = (onCustomDomain ? url.origin : c.env.APP_URL || url.origin).replace(/\/$/, "");
  const shopDb = shop ? getShopDb(c.env, shop.id, PRIMARY_SHOP_ID) : null;
  const meta = shop
    ? await resolveRouteMeta(c.env, shopDb!, strippedPath)
    : VERTO_META[url.pathname] ?? VERTO_META["/"];
  // The demo shop is a fictional label — keep its boilerplate out of the index.
  if (shop && shop.slug === DEMO_SHOP_SLUG) meta.noindex = true;
  // Shop-level SEO settings: visibility, default social image, verification.
  const seoCfg = shopDb ? await getShopSeoConfig(shopDb).catch(() => null) : null;
  if (seoCfg?.hidden) meta.noindex = true;
  if (seoCfg?.defaultOgImage && !meta.image) meta.image = seoCfg.defaultOgImage;
  const canonicalUrl = `${canonicalBase}${basePath}${strippedPath === "/" && shop ? "" : shop ? strippedPath : url.pathname}`;
  let html = injectMeta(await shell.text(), meta, canonicalUrl);
  if (seoCfg) html = injectVerification(html, seoCfg);
  // Identity schema on home documents only (platform root / shop home).
  if ((shop && strippedPath === "/") || (!shop && url.pathname === "/")) {
    html = html.replace(
      "</head>",
      `    ${buildStructuredData(c.env, shop ? { slug: shop.slug, name: shop.name, basePath } : null, meta)}\n  </head>`,
    );
  }
  // Product rich results on shop product pages.
  const productMatch = shop && strippedPath.match(/^\/products\/([^/]+)$/);
  if (productMatch && shopDb) {
    const ld = await buildProductLd(c.env, shopDb, decodeURIComponent(productMatch[1]), canonicalUrl).catch(() => null);
    if (ld) html = html.replace("</head>", `    ${ld}\n  </head>`);
  }
  html = injectShopContext(html, shop ? { slug: shop.slug, name: shop.name, basePath } : null);
  // The shell must never be stale: it pins the hashed bundle URL, and a
  // cached copy that outlives a deploy points at assets that no longer
  // exist — the whole app goes blank. no-cache = always revalidate.
  return c.html(html, 200, { "cache-control": "no-cache" });
}

// Host-aware: a custom-domain shop gets ITS sitemap at its own root; the
// platform host gets the full platform sitemap. KV-cached — the platform
// version reads every shop's database.
app.get("/sitemap.xml", async (c) => {
  const url = new URL(c.req.url);
  const cacheKey = `sitemap:${url.hostname}`;
  const cached = await c.env.KV.get(cacheKey);
  if (cached) {
    return c.text(cached, 200, { "content-type": "application/xml", "cache-control": "public, max-age=3600" });
  }
  const { getShopByDomain } = await import("./services/shops");
  const domainShop = await getShopByDomain(c.env.DB, url.hostname);
  const { buildShopSitemap } = await import("./services/seo");
  const xml = domainShop ? await buildShopSitemap(c.env, domainShop) : await buildSitemap(c.env);
  await c.env.KV.put(cacheKey, xml, { expirationTtl: 3600 });
  return c.text(xml, 200, { "content-type": "application/xml", "cache-control": "public, max-age=3600" });
});
app.get("/robots.txt", (c) => {
  const url = new URL(c.req.url);
  // The sitemap reference must live on the SAME host — a custom-domain shop
  // points crawlers at its own sitemap, not the platform's.
  return c.text(
    `User-agent: *\nAllow: /\nDisallow: /*/admin\nDisallow: /admin\nSitemap: ${url.origin}/sitemap.xml\n`,
  );
});

// llms.txt — the linked index AI assistants read first (llmstxt.org).
// Host-aware: a custom-domain shop serves its own.
app.get("/llms.txt", async (c) => {
  const url = new URL(c.req.url);
  const { getShopByDomain } = await import("./services/shops");
  const domainShop = await getShopByDomain(c.env.DB, url.hostname);
  if (domainShop) {
    const { buildShopLlms } = await import("./services/seo");
    return c.text(await buildShopLlms(c.env, domainShop), 200, {
      "cache-control": "public, max-age=3600",
    });
  }
  const base = (c.env.APP_URL || url.origin).replace(/\/$/, "");
  const body = [
    `# Verto`,
    ``,
    `> Verto is the operating system for independent clothing labels: storefront, CMS, production (tech packs, samples, factory portals), multi-carrier shipping with customs paperwork, landed-cost and duties tooling, wholesale line sheets, pre-orders, and an LLM marketing suite — one platform, one database, from first sample to sold out. Shops live at verto.style/<shop-name> or on their own domain.`,
    ``,
    `## Pages`,
    ``,
    `- [Why Verto exists](${base}/why): the problem with fashion tech's two worlds — storefront builders and enterprise ERPs — and the missing middle Verto serves`,
    `- [Features — the full tour](${base}/features): all twelve modules with miniature interface previews`,
    `- [Compare](${base}/compare): honest capability matrix vs. Shopify, retail ERP/PLM suites, and the spreadsheet patchwork`,
    `- [Pricing](${base}/pricing): plans from $19/mo (annual) with a declining application fee; every plan includes the full platform`,
    `- [Open your shop](${base}/signup): instant provisioning — a live shop with admin credentials in seconds`,
    ``,
    `## Demo`,
    ``,
    `- [Maison Atlantique demo storefront](${base}/maison): a fictional label running the full platform`,
    `- [Demo admin tour](${base}/maison/admin): read-only walkthrough of the operating system behind a shop (email-gated)`,
    ``,
  ].join("\n");
  return c.text(body, 200, { "cache-control": "public, max-age=3600" });
});

// Public API — no auth, rate-limited where it accepts writes.
app.route("/api/public", publicRoutes);
app.route("/api/public", commerceRoutes);
app.route("/api/public/account", accountRoutes);
app.route("/api/public/portal", clientPortalRoutes);
app.route("/api/public/booking", publicBookingRoutes);
app.route("/api/wholesale", wholesalePortalRoutes);

// Verto platform — shop signup + slug availability (public).
import { vertoRoutes } from "./routes/verto";
app.route("/api/verto", vertoRoutes);

// Stripe webhooks — signature-verified, never session-gated.
app.route("/api/stripe", stripeWebhookRoutes);

// Carrier tracking webhooks — secret-token path, never session-gated.
app.route("/api/shipping", shippingWebhookRoutes);

// Promo-video render callbacks — RENDER_CALLBACK_SECRET-gated, from GitHub Actions.
app.route("/api/render", renderCallbackRoutes);

// Factory portal — token-scoped, unauthenticated by design.
app.route("/api/factory", factoryRoutes);

// Wholesale line sheets — token-scoped, unauthenticated by design.
app.route("/api/linesheet", lineSheetRoutes);

// Auth
app.route("/api/auth", authRoutes);

// Admin API — every route requires at least read-level RBAC; writes are
// gated per-route with requireAdminWrite/requireAdminOnly.
const admin = new Hono<AppContext>();
admin.use("*", requireAdminRead);
admin.route("/dashboard", adminDashboardRoutes);
admin.route("/styles", adminStyleRoutes);
admin.route("/products", adminProductRoutes);
admin.route("/suppliers", adminSupplierRoutes);
admin.route("/production", adminProductionRoutes);
admin.route("/tech-packs", adminTechPackAiRoutes);
admin.route("/tech-packs", adminTechPackRoutes);
admin.route("/commerce", adminCommerceRoutes);
admin.route("/returns", adminReturnsRoutes);
admin.route("/reviews", adminReviewsRoutes);
admin.route("/export", adminExportRoutes);
admin.route("/cashflow", adminCashflowRoutes);
admin.route("/locations", adminLocationsRoutes);
admin.route("/costing", adminCostingRoutes);
admin.route("/ai", adminAiRoutes);
admin.route("/3d", admin3dRoutes);
admin.route("/fitting", adminFittingRoutes);
admin.route("/clients", adminClientRoutes);
admin.route("/commissions", adminCommissionRoutes);
admin.route("/bookings", adminBookingRoutes);
admin.route("/files", adminFileRoutes);
admin.route("/settings", adminSettingsRoutes);
admin.route("/brand", adminBrandRoutes);
admin.route("/messages", adminMessagesRoutes);
admin.route("/shipping", adminShippingRoutes);
admin.route("/analytics", adminAnalyticsRoutes);
admin.route("/content", adminContentRoutes);
admin.route("/wholesale", adminWholesaleRoutes);
admin.route("/marketing", adminMarketingRoutes);
admin.route("/platform", adminPlatformRoutes);
admin.route("/crm", adminCrmRoutes);
admin.route("/users", adminUsersRoutes);
admin.route("/feedback", adminFeedbackRoutes);
admin.route("/sourcing", adminSourcingRoutes);
admin.route("/domain", adminDomainRoutes);
admin.route("/import", adminImportRoutes);
admin.route("/kb", adminKbRoutes);
admin.route("/brain", adminBrainRoutes);
app.route("/api/admin", admin);

// Everything else that's a GET is a document: Verto pages, shop
// storefronts, legacy redirects, unknown slugs (SPA 404).
app.get("*", serveDocument);

app.notFound((c) => c.json({ error: "Not found" }, 404));

export default {
  fetch: app.fetch,

  /**
   * Crons (wrangler.toml):
   *  - hourly (:30): publish scheduled pages/journal posts that are due
   *  - daily (06:00): ops sweep — late tasks, abandoned checkouts, digest
   */
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    if (controller.cron === "30 * * * *") {
      ctx.waitUntil(publishDueContent(env));
    } else {
      // Daily also runs the publisher — belt and braces if the hourly missed.
      ctx.waitUntil(
        publishDueContent(env)
          .then(() => runDailyOpsSweep(env))
          .then(async () => {
            // CRM: shop-activity health + milestones, then silence → tasks.
            const { crmHealthSweep } = await import("./services/crm-activity");
            await crmHealthSweep(env).catch((err) => console.error("[crm] health sweep failed:", err));
            const { crmFollowupSweep } = await import("./services/crm");
            await crmFollowupSweep(env).catch((err) => console.error("[crm] sweep failed:", err));
          }),
      );
    }
  },

  /**
   * Cloudflare Email Routing → shared inbox: mail to the routed address
   * lands on the sender's CRM timeline, opens a reply task, and forwards
   * to the founder's real inbox (see services/crm-inbox.ts for setup).
   */
  async email(message: ForwardableEmailMessage, env: Env, _ctx: ExecutionContext) {
    const { handleInboundEmail } = await import("./services/crm-inbox");
    await handleInboundEmail(message, env);
  },
} satisfies ExportedHandler<Env>;

/** Flip due scheduled drafts live (publish_at in the past) — every shop. */
async function publishDueContent(env: Env): Promise<void> {
  const shops = await env.DB.prepare(
    `SELECT id FROM shops WHERE status = 'active'`,
  ).all<{ id: string }>();
  for (const shop of shops.results) {
    try {
      await publishDueForShop(getShopDb(env, shop.id, PRIMARY_SHOP_ID));
    } catch (err) {
      console.error(`[cron] publish-due failed for ${shop.id}:`, err);
    }
  }
}

async function publishDueForShop(db: D1Database): Promise<void> {
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  await db.prepare(
    `UPDATE pages SET is_published = 1, publish_at = NULL, updated_at = datetime('now')
     WHERE is_published = 0 AND publish_at IS NOT NULL AND publish_at <= ?`,
  )
    .bind(now)
    .run();
  await db.prepare(
    `UPDATE journal_posts SET is_published = 1, publish_at = NULL,
       published_at = COALESCE(published_at, date('now'))
     WHERE is_published = 0 AND publish_at IS NOT NULL AND publish_at <= ?`,
  )
    .bind(now)
    .run();
}

async function runDailyOpsSweep(env: Env): Promise<void> {
  const { dailyDigestNotification, sendNotification } = await import("./services/email");
  const today = new Date().toISOString().slice(0, 10);
  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  // 1. Late tasks → risk flag.
  await env.DB.prepare(
    `UPDATE production_tasks SET risk_flag = 1
     WHERE status NOT IN ('done','cancelled') AND due_date IS NOT NULL AND due_date < ?`,
  )
    .bind(today)
    .run();

  // 2. Abandoned checkouts: pending Stripe sessions older than 24h, not yet
  //    swept. Recorded as analytics events (idempotent via the sweep flag in
  //    shipping_address_json remaining untouched — we key off analytics).
  const abandoned = await env.DB.prepare(
    `SELECT o.id, o.order_number, o.total_cents, o.currency FROM orders o
     WHERE o.payment_status = 'pending' AND o.stripe_checkout_session_id IS NOT NULL
       AND o.created_at < ?
       AND NOT EXISTS (
         SELECT 1 FROM analytics_events e
         WHERE e.event = 'checkout_abandoned' AND e.entity_id = o.id
       )`,
  )
    .bind(dayAgo)
    .all<{ id: string; order_number: string; total_cents: number; currency: string }>();
  for (const order of abandoned.results) {
    await env.DB.prepare(
      `INSERT INTO analytics_events (id, event, entity_type, entity_id)
       VALUES (?, 'checkout_abandoned', 'order', ?)`,
    )
      .bind(`evt_${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`, order.id)
      .run();
  }

  // 3. Digest.
  const lateTasks = await env.DB.prepare(
    `SELECT title, due_date FROM production_tasks
     WHERE status NOT IN ('done','cancelled') AND due_date IS NOT NULL AND due_date < ?
     ORDER BY due_date LIMIT 10`,
  )
    .bind(today)
    .all<{ title: string; due_date: string | null }>();
  const lowStock = await env.DB.prepare(
    `SELECT p.name || ' ' || v.colorway_name || '/' || v.size AS name,
            (i.on_hand - i.reserved) AS available
     FROM inventory_items i
     JOIN product_variants v ON v.id = i.variant_id
     JOIN products p ON p.id = v.product_id
     WHERE (i.on_hand - i.reserved) <= i.low_stock_threshold AND (i.on_hand + i.incoming) > 0
     ORDER BY available LIMIT 10`,
  ).all<{ name: string; available: number }>();
  const pendingFactory = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM supplier_interactions WHERE needs_response = 1`,
  ).first<{ n: number }>();
  const openSamples = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM samples WHERE status NOT IN ('approved','rejected')`,
  ).first<{ n: number }>();

  await sendNotification(
    env,
    dailyDigestNotification({
      lateTasks: lateTasks.results.map((t) => ({ title: t.title, dueDate: t.due_date })),
      lowStock: lowStock.results,
      pendingFactoryResponses: pendingFactory?.n ?? 0,
      abandonedCheckouts: abandoned.results.map((o) => ({
        orderNumber: o.order_number,
        totalCents: o.total_cents,
        currency: o.currency,
      })),
      openSamples: openSamples?.n ?? 0,
    }),
  );
}
