import { Hono } from "hono";
import { all, first, run, writeAudit } from "../services/db";
import { parseBody, settingsUpdateSchema } from "../services/validators";
import { requireAdminOnly, requireAdminWrite } from "../middleware/auth";
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
    // Visual identity (managed from the Brand Studio) — JSON blobs.
    "brand_logo",
    "brand_palette",
    "brand_typography",
    "brand_import_url",
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

// ---- The Verto Directory listing -----------------------------------------------
// The listing itself lives at the platform (0048) so the directory can be
// assembled across shops; each shop edits its own row from here. Default is
// NOT listed — the directory is opt-in, always.

adminSettingsRoutes.get("/directory", async (c) => {
  try {
    const row = await c.env.DB.prepare(`SELECT * FROM directory_listings WHERE shop_id = ?`)
      .bind(c.var.shopId)
      .first<Record<string, unknown>>();
    return c.json({
      optedIn: row ? Boolean(row.opted_in) : false,
      craft: (row?.craft as string) ?? "label",
      specialties: (row?.specialties as string) ?? "",
      city: (row?.city as string) ?? "",
      country: (row?.country as string) ?? "",
      blurb: (row?.blurb as string) ?? "",
      certCount: Number(row?.cert_count ?? 0),
    });
  } catch {
    return c.json({ optedIn: false, craft: "label", specialties: "", city: "", country: "", blurb: "", certCount: 0 });
  }
});

adminSettingsRoutes.put("/directory", requireAdminWrite, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const CRAFTS = ["label", "tailor", "seamstress", "stylist", "boutique"];
  const craft = CRAFTS.includes(body.craft as string) ? (body.craft as string) : "label";

  // Snapshot the shop's Verto School standing into the listing — the badge
  // is the directory's trust layer.
  let certCount = 0;
  let certBest: string | null = null;
  try {
    const certs = await c.env.DB.prepare(
      `SELECT scope, COUNT(*) AS n FROM school_certificates WHERE shop_id = ? AND revoked = 0 GROUP BY scope`,
    )
      .bind(c.var.shopId)
      .all<{ scope: string; n: number }>();
    for (const r of certs.results ?? []) {
      certCount += Number(r.n);
      if (r.scope === "studio" || (r.scope === "school" && certBest !== "studio") || (certBest === null)) certBest = r.scope;
    }
  } catch {
    /* no certificates table drama — the listing still saves */
  }

  await c.env.DB.prepare(
    `INSERT INTO directory_listings (shop_id, opted_in, craft, specialties, city, country, blurb, cert_count, cert_best, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(shop_id) DO UPDATE SET opted_in = excluded.opted_in, craft = excluded.craft,
       specialties = excluded.specialties, city = excluded.city, country = excluded.country,
       blurb = excluded.blurb, cert_count = excluded.cert_count, cert_best = excluded.cert_best,
       updated_at = datetime('now')`,
  )
    .bind(
      c.var.shopId,
      body.optedIn === true ? 1 : 0,
      craft,
      clean(body.specialties, 300),
      clean(body.city, 120),
      clean(body.country, 120),
      clean(body.blurb, 600),
      certCount,
      certBest,
    )
    .run();
  await writeAudit(c.var.db, c.var.userId, "settings.directory", "directory_listing", c.var.shopId, {
    optedIn: body.optedIn === true,
  });
  return c.json({ ok: true, certCount });
});
