import { Hono } from "hono";
import { sessionMiddleware, requireAdminRead } from "./middleware/auth";
import { ValidationError } from "./services/validators";
import { authRoutes } from "./routes/auth";
import { publicRoutes } from "./routes/public";
import { commerceRoutes } from "./routes/commerce";
import { stripeWebhookRoutes } from "./routes/stripe-webhooks";
import { adminDashboardRoutes } from "./routes/admin-dashboard";
import { adminStyleRoutes } from "./routes/admin-styles";
import { adminProductRoutes } from "./routes/admin-products";
import { adminSupplierRoutes } from "./routes/admin-suppliers";
import { adminProductionRoutes } from "./routes/admin-production";
import { adminTechPackRoutes } from "./routes/admin-techpacks";
import { adminCommerceRoutes } from "./routes/admin-commerce";
import { adminCostingRoutes } from "./routes/admin-costing";
import { adminAiRoutes } from "./routes/admin-ai";
import { admin3dRoutes } from "./routes/admin-3d";
import { adminFileRoutes } from "./routes/admin-files";
import { adminSettingsRoutes } from "./routes/admin-settings";
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

// Public API — no auth, rate-limited where it accepts writes.
app.route("/api/public", publicRoutes);
app.route("/api/public", commerceRoutes);

// Stripe webhooks — signature-verified, never session-gated.
app.route("/api/stripe", stripeWebhookRoutes);

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
admin.route("/tech-packs", adminTechPackRoutes);
admin.route("/commerce", adminCommerceRoutes);
admin.route("/costing", adminCostingRoutes);
admin.route("/ai", adminAiRoutes);
admin.route("/3d", admin3dRoutes);
admin.route("/files", adminFileRoutes);
admin.route("/settings", adminSettingsRoutes);
app.route("/api/admin", admin);

app.notFound((c) => c.json({ error: "Not found" }, 404));

export default {
  fetch: app.fetch,

  // Daily ops sweep (cron in wrangler.toml): flags late production tasks so
  // the dashboard and (future) notification channel pick them up.
  async scheduled(_controller: ScheduledController, env: Env, _ctx: ExecutionContext) {
    const today = new Date().toISOString().slice(0, 10);
    await env.DB.prepare(
      `UPDATE production_tasks SET risk_flag = 1
       WHERE status NOT IN ('done','cancelled') AND due_date IS NOT NULL AND due_date < ?`,
    )
      .bind(today)
      .run();
  },
} satisfies ExportedHandler<Env>;
