import { Hono } from "hono";
import { sessionMiddleware, requireAdminRead } from "./middleware/auth";
import { ValidationError } from "./services/validators";
import { authRoutes } from "./routes/auth";
import { publicRoutes } from "./routes/public";
import { commerceRoutes } from "./routes/commerce";
import { stripeWebhookRoutes } from "./routes/stripe-webhooks";
import { shippingWebhookRoutes } from "./routes/shipping-webhooks";
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
import { adminCostingRoutes } from "./routes/admin-costing";
import { adminAiRoutes } from "./routes/admin-ai";
import { admin3dRoutes } from "./routes/admin-3d";
import { adminFileRoutes } from "./routes/admin-files";
import { adminSettingsRoutes } from "./routes/admin-settings";
import { adminShippingRoutes } from "./routes/admin-shipping";
import { adminAnalyticsRoutes } from "./routes/admin-analytics";
import { adminContentRoutes } from "./routes/admin-content";
import { adminWholesaleRoutes } from "./routes/admin-wholesale";
import { adminMarketingRoutes } from "./routes/admin-marketing";
import { adminImportRoutes } from "./routes/admin-import";
import type { AppContext, Env } from "./types/env";

const app = new Hono<AppContext>();

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
app.get("/media/:fileId", async (c) => {
  const row = await c.env.DB.prepare(
    `SELECT r2_key, content_type FROM files WHERE id = ? AND is_public = 1`,
  )
    .bind(c.req.param("fileId"))
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
});

// --- Edge SEO ------------------------------------------------------------
// Document routes run worker-first (wrangler.toml): serve the SPA shell
// with per-route <title>/meta/OG tags injected so crawlers and link
// unfurlers see real content. Client-side routing takes over after load.
import { buildSitemap, injectMeta, resolveRouteMeta } from "./services/seo";
import type { Context } from "hono";

async function serveDocument(c: Context<AppContext>): Promise<Response> {
  const url = new URL(c.req.url);
  const shell = await c.env.ASSETS.fetch(new Request(`${url.origin}/index.html`));
  if (!shell.ok) return shell as unknown as Response;
  const meta = await resolveRouteMeta(c.env, url.pathname);
  const canonicalBase = (c.env.APP_URL || url.origin).replace(/\/$/, "");
  const html = injectMeta(await shell.text(), meta, `${canonicalBase}${url.pathname}`);
  return c.html(html, 200, { "cache-control": "public, max-age=60" });
}

const DOCUMENT_ROUTES = [
  "/",
  "/p/:slug",
  "/journal",
  "/journal/:slug",
  "/products",
  "/products/:slug",
  "/collections",
  "/collections/:slug",
  "/story",
  "/atelier",
  "/lookbook",
  "/contact",
  "/cart",
  "/size-guide",
  "/shipping-returns",
  "/stockists",
  "/privacy",
  "/terms",
];
for (const route of DOCUMENT_ROUTES) app.get(route, serveDocument);

app.get("/sitemap.xml", async (c) =>
  c.text(await buildSitemap(c.env), 200, {
    "content-type": "application/xml",
    "cache-control": "public, max-age=3600",
  }),
);
app.get("/robots.txt", (c) => {
  const base = (c.env.APP_URL || new URL(c.req.url).origin).replace(/\/$/, "");
  return c.text(`User-agent: *\nAllow: /\nDisallow: /admin\nSitemap: ${base}/sitemap.xml\n`);
});

// Public API — no auth, rate-limited where it accepts writes.
app.route("/api/public", publicRoutes);
app.route("/api/public", commerceRoutes);

// Stripe webhooks — signature-verified, never session-gated.
app.route("/api/stripe", stripeWebhookRoutes);

// Carrier tracking webhooks — secret-token path, never session-gated.
app.route("/api/shipping", shippingWebhookRoutes);

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
admin.route("/costing", adminCostingRoutes);
admin.route("/ai", adminAiRoutes);
admin.route("/3d", admin3dRoutes);
admin.route("/files", adminFileRoutes);
admin.route("/settings", adminSettingsRoutes);
admin.route("/shipping", adminShippingRoutes);
admin.route("/analytics", adminAnalyticsRoutes);
admin.route("/content", adminContentRoutes);
admin.route("/wholesale", adminWholesaleRoutes);
admin.route("/marketing", adminMarketingRoutes);
admin.route("/import", adminImportRoutes);
app.route("/api/admin", admin);

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
      ctx.waitUntil(publishDueContent(env).then(() => runDailyOpsSweep(env)));
    }
  },
} satisfies ExportedHandler<Env>;

/** Flip due scheduled drafts live (publish_at in the past). */
async function publishDueContent(env: Env): Promise<void> {
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  await env.DB.prepare(
    `UPDATE pages SET is_published = 1, publish_at = NULL, updated_at = datetime('now')
     WHERE is_published = 0 AND publish_at IS NOT NULL AND publish_at <= ?`,
  )
    .bind(now)
    .run();
  await env.DB.prepare(
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
