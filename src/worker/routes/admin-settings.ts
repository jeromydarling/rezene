import { Hono } from "hono";
import { all, first, run, writeAudit } from "../services/db";
import { parseBody, settingsUpdateSchema } from "../services/validators";
import { requireAdminOnly } from "../middleware/auth";
import type { AppContext } from "../types/env";

export const adminSettingsRoutes = new Hono<AppContext>();

adminSettingsRoutes.get("/", async (c) => {
  const rows = await all<{ key: string; value: string; description: string | null }>(
    c.var.db,
    `SELECT key, value, description FROM settings ORDER BY key`,
  );
  const integrations = await all(
    c.var.db,
    `SELECT provider, status, note, last_verified_at FROM integration_credentials_metadata`,
  );
  // Live secret presence (booleans only — never values).
  const secretStatus = {
    stripe: Boolean(c.env.STRIPE_SECRET_KEY),
    stripeWebhook: Boolean(c.env.STRIPE_WEBHOOK_SECRET),
    anthropic: Boolean(c.env.ANTHROPIC_API_KEY),
  };
  return c.json({ settings: rows, integrations, secretStatus });
});

adminSettingsRoutes.patch("/", requireAdminOnly, async (c) => {
  const body = await parseBody(c, settingsUpdateSchema);
  const editable = new Set([
    "brand_name",
    "brand_slug",
    "brand_tagline",
    "default_currency",
    "production_home",
    // Search & sharing (managed from the Search Checkup screen)
    "search_visibility",
    "default_og_image",
    "site_verification_google",
    "site_verification_bing",
  ]);
  const updates = Object.entries(body).filter(([k]) => editable.has(k));
  if (updates.length === 0) return c.json({ error: "No editable settings provided" }, 400);
  for (const [key, value] of updates) {
    await run(
      c.var.db,
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      key,
      value,
    );
  }
  await writeAudit(c.var.db, c.var.userId, "settings.update", "settings", null, Object.fromEntries(updates));
  return c.json({ ok: true });
});

// ---------- Audit log ----------
adminSettingsRoutes.get("/audit", requireAdminOnly, async (c) => {
  const rows = await all(
    c.var.db,
    `SELECT a.id, a.action, a.entity_type, a.entity_id, a.detail, a.created_at, u.email AS user_email
     FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id
     ORDER BY a.created_at DESC LIMIT 200`,
  );
  return c.json(rows);
});

// ---------- Search Checkup ----------
// The audit, run against THIS shop's own content — merchant language,
// green checks, and a one-tap route to each fix. Read-level access so the
// whole team (and demo viewers) can see it; fixes go through their own
// write-gated endpoints.
adminSettingsRoutes.get("/seo-checkup", async (c) => {
  const db = c.var.db;
  const { getShopSeoConfig } = await import("../services/seo");
  const cfg = await getShopSeoConfig(db);

  const pagesMissingMeta = await all<{ slug: string; title: string }>(
    db,
    `SELECT slug, title FROM pages
     WHERE is_published = 1 AND (meta_description IS NULL OR meta_description = '')
       AND (subtitle IS NULL OR subtitle = '') LIMIT 25`,
  );
  const postsMissingMeta = await all<{ slug: string; title: string }>(
    db,
    `SELECT slug, title FROM journal_posts
     WHERE is_published = 1 AND (meta_description IS NULL OR meta_description = '')
       AND (excerpt IS NULL OR excerpt = '') LIMIT 25`,
  );
  const productsMissingImages = await all<{ slug: string; name: string }>(
    db,
    `SELECT p.slug, p.name FROM products p
     WHERE p.is_published = 1 AND p.availability != 'archived'
       AND NOT EXISTS (SELECT 1 FROM product_images i WHERE i.product_id = p.id) LIMIT 25`,
  );
  const mediaMissingAlt = await first<{ n: number }>(
    db,
    `SELECT COUNT(*) AS n FROM files
     WHERE is_public = 1 AND (alt_text IS NULL OR alt_text = '')
       AND content_type LIKE 'image/%'`,
  );
  const publishedPages = await first<{ n: number }>(
    db,
    `SELECT COUNT(*) AS n FROM pages WHERE is_published = 1`,
  );

  return c.json({
    visibility: cfg.hidden ? "hidden" : "public",
    verification: { google: Boolean(cfg.verificationGoogle), bing: Boolean(cfg.verificationBing) },
    defaultOgImage: cfg.defaultOgImage,
    pagesMissingMeta,
    postsMissingMeta,
    productsMissingImages,
    mediaMissingAlt: mediaMissingAlt?.n ?? 0,
    publishedPages: publishedPages?.n ?? 0,
  });
});
