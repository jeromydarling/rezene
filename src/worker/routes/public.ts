import { Hono } from "hono";
import { all, first, jsonArray, run } from "../services/db";
import { leadNotification, sendNotification } from "../services/email";
import { getSupportedLanguages, translateFields } from "../services/translate";
import { analyticsEventSchema, leadSchema, parseBody } from "../services/validators";
import { rateLimit } from "../middleware/rate-limit";
import { newId } from "../utils/id";
import type { AppContext } from "../types/env";
import type {
  BrandSettings,
  PublicCampaign,
  PublicCollection,
  PublicJournalPost,
  PublicLookbook,
  PublicPage,
  PublicProductDetail,
  PublicProductSummary,
  PublicSizeChart,
  PublicVariant,
} from "../../shared/types";

export const publicRoutes = new Hono<AppContext>();

// ---------- Verto School certifications (public, storefront badge) ----------
// Certificates live in the PLATFORM database; a shop wears the badge while a
// certified person belongs to it. Best credential first (studio > school >
// course); each carries its public verification link.
publicRoutes.get("/certifications", async (c) => {
  try {
    const rows = await all<{ id: string; scope: string; title: string; user_name: string }>(
      c.env.DB,
      `SELECT id, scope, title, user_name FROM school_certificates
       WHERE shop_id = ? AND revoked = 0
       ORDER BY CASE scope WHEN 'studio' THEN 0 WHEN 'school' THEN 1 ELSE 2 END, issued_at DESC
       LIMIT 6`,
      c.var.shopId,
    );
    return c.json(rows.map((r) => ({ id: r.id, scope: r.scope, title: r.title, holder: r.user_name })));
  } catch {
    return c.json([]);
  }
});

// ---------- Brand settings ----------
publicRoutes.get("/settings", async (c) => {
  const rows = await all<{ key: string; value: string }>(
    c.var.db,
    `SELECT key, value FROM settings
     WHERE key IN ('brand_name','brand_tagline','default_currency','home_hero','nav_menus','supported_languages','brand_logo','brand_palette','brand_typography','verto_badge')`,
  );
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const parse = <T>(value: string | undefined): T | null => {
    try {
      return value ? (JSON.parse(value) as T) : null;
    } catch {
      return null; // corrupt setting → client falls back to built-in defaults
    }
  };
  const languages = parse<string[]>(map.supported_languages);
  const settings: BrandSettings = {
    brandName: map.brand_name ?? c.env.BRAND_NAME,
    tagline: map.brand_tagline ?? "",
    currency: map.default_currency ?? "USD",
    homeHero: parse<BrandSettings["homeHero"]>(map.home_hero),
    navigation: parse<BrandSettings["navigation"]>(map.nav_menus),
    languages: Array.isArray(languages) && languages.length > 0 ? languages : ["en"],
    logo: parse<BrandSettings["logo"]>(map.brand_logo),
    palette: parse<BrandSettings["palette"]>(map.brand_palette),
    typography: parse<BrandSettings["typography"]>(map.brand_typography),
    // On unless the shop explicitly turned it off — every storefront carries
    // a quiet "Made with Verto" credit that links back with attribution.
    vertoBadge: map.verto_badge !== "off",
  };
  return c.json(settings);
});

// ---------- Marketing email unsubscribe (link in every campaign email) ----------
publicRoutes.get("/unsubscribe", async (c) => {
  const email = (c.req.query("email") ?? "").toLowerCase().slice(0, 200);
  const token = c.req.query("token") ?? "";
  if (!email || !token) return c.text("Invalid unsubscribe link.", 400);
  const { sha256Hex } = await import("../utils/id");
  const expected = (await sha256Hex(`${email}${c.env.SESSION_SECRET ?? ""}`)).slice(0, 32);
  if (token !== expected) return c.text("Invalid unsubscribe link.", 400);
  // Browser GET (no tenant header): the link itself names the shop.
  let db = c.var.db;
  const shopSlugParam = c.req.query("shop");
  if (shopSlugParam) {
    const { getShopBySlug, PRIMARY_SHOP_ID } = await import("../services/shops");
    const { getShopDb } = await import("../services/tenant-db");
    const shop = await getShopBySlug(c.env.DB, shopSlugParam);
    if (shop) db = getShopDb(c.env, shop.id, PRIMARY_SHOP_ID);
  }
  await run(
    db,
    `UPDATE leads SET unsubscribed_at = datetime('now') WHERE lower(email) = ? AND unsubscribed_at IS NULL`,
    email,
  );
  // Suppression list is the single source of truth honored by every send
  // (newsletter leads and customer broadcasts alike).
  await run(db, `INSERT OR IGNORE INTO email_suppressions (email) VALUES (?)`, email);
  return c.text("You're unsubscribed. You won't hear from us again unless you sign back up.");
});

/** True when the request carries the site's draft-preview token. */
async function previewAllowed(db: D1Database, token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const row = await first<{ value: string }>(
    db,
    `SELECT value FROM settings WHERE key = 'preview_token'`,
  );
  return Boolean(row?.value && row.value === token);
}

// ---------- Collections ----------
publicRoutes.get("/collections", async (c) => {
  const rows = await all(
    c.var.db,
    `SELECT id, slug, name, season, description, editorial_copy, hero_image_url
     FROM collections WHERE is_published = 1 ORDER BY sort_order`,
  );
  return c.json(rows.map(mapCollection));
});

publicRoutes.get("/collections/:slug", async (c) => {
  const row = await first(
    c.var.db,
    `SELECT id, slug, name, season, description, editorial_copy, hero_image_url
     FROM collections WHERE slug = ? AND is_published = 1`,
    c.req.param("slug"),
  );
  if (!row) return c.json({ error: "Collection not found" }, 404);
  const products = await queryProductSummaries(
    c.var.db,
    `WHERE p.is_published = 1 AND p.collection_id = ?`,
    [row.id],
  );
  return c.json({ ...mapCollection(row), products });
});

// ---------- Products ----------
publicRoutes.get("/products", async (c) => {
  const gender = c.req.query("gender");
  const params: unknown[] = [];
  let where = `WHERE p.is_published = 1 AND p.availability != 'archived'`;
  if (gender === "mens" || gender === "womens") {
    where += ` AND p.gender = ?`;
    params.push(gender);
  }
  return c.json(await queryProductSummaries(c.var.db, where, params));
});

publicRoutes.get("/products/:slug", async (c) => {
  const p = await first<Record<string, unknown>>(
    c.var.db,
    `SELECT p.*, c.slug AS collection_slug FROM products p
     LEFT JOIN collections c ON c.id = p.collection_id
     WHERE p.slug = ? AND p.is_published = 1`,
    c.req.param("slug"),
  );
  if (!p) return c.json({ error: "Product not found" }, 404);

  const images = await all<{ url: string; alt_text: string | null; colorway_name: string | null }>(
    c.var.db,
    `SELECT url, alt_text, colorway_name FROM product_images WHERE product_id = ? ORDER BY sort_order`,
    p.id,
  );
  const variantRows = await all<{
    id: string;
    colorway_name: string;
    size: string;
    price_cents: number | null;
    currency: string;
    on_hand: number | null;
    reserved: number | null;
  }>(
    c.var.db,
    `SELECT v.id, v.colorway_name, v.size, v.price_cents, v.currency,
            i.on_hand, i.reserved
     FROM product_variants v
     LEFT JOIN inventory_items i ON i.variant_id = v.id
     WHERE v.product_id = ? AND v.is_active = 1
     ORDER BY v.colorway_name, v.size`,
    p.id,
  );
  const variants: PublicVariant[] = variantRows.map((v) => {
    const availableQty = Math.max(0, (v.on_hand ?? 0) - (v.reserved ?? 0));
    return {
      id: v.id,
      colorwayName: v.colorway_name,
      size: v.size,
      priceCents: v.price_cents ?? (p.base_price_cents as number),
      currency: v.currency,
      inStock: availableQty > 0 || p.availability === "pre_order",
      availableQty,
    };
  });

  const reviewRows = await all<{ rating: number; title: string | null; body: string | null; author_name: string | null; created_at: string }>(
    c.var.db,
    `SELECT rating, title, body, author_name, created_at FROM product_reviews
     WHERE product_id = ? AND status = 'published' ORDER BY created_at DESC LIMIT 50`,
    p.id,
  );
  const reviewAgg = await first<{ avg: number | null; n: number }>(
    c.var.db,
    `SELECT AVG(rating) AS avg, COUNT(*) AS n FROM product_reviews WHERE product_id = ? AND status = 'published'`,
    p.id,
  );

  const related = await queryProductSummaries(
    c.var.db,
    `WHERE p.is_published = 1 AND p.id != ? AND (p.collection_id = ? OR p.gender = ?)
     ORDER BY CASE WHEN p.collection_id = ? THEN 0 ELSE 1 END, p.sort_order LIMIT 4`,
    [p.id, p.collection_id, p.gender, p.collection_id],
    /* skipDefaultOrder */ true,
  );

  const detail: PublicProductDetail = {
    campaign: await loadCampaign(c.var.db, p.id as string),
    sizeChart: p.style_id ? await loadSizeChart(c.var.db, p.style_id as string) : null,
    ...mapProductSummary({
      ...p,
      image_url: images[0]?.url ?? null,
      image_alt: images[0]?.alt_text ?? null,
    }),
    description: (p.description as string) ?? null,
    editorialStory: (p.editorial_story as string) ?? null,
    fabricComposition: (p.fabric_composition as string) ?? null,
    careSummary: (p.care_summary as string) ?? null,
    originStatement: (p.origin_statement as string) ?? null,
    fitNotes: (p.fit_notes as string) ?? null,
    shippingNote: (p.shipping_note as string) ?? null,
    preOrderNote: (p.pre_order_note as string) ?? null,
    images: images.map((i) => ({
      url: i.url,
      altText: i.alt_text,
      colorwayName: i.colorway_name,
    })),
    variants,
    related,
    reviews: reviewRows.map((r) => ({
      rating: r.rating,
      title: r.title,
      body: r.body,
      authorName: r.author_name,
      createdAt: r.created_at,
    })),
    reviewSummary: { average: reviewAgg?.avg ?? null, count: reviewAgg?.n ?? 0 },
  };
  return c.json(detail);
});

// Digital Product Passport — a public, care-label-linkable page carrying the
// material, care, and origin facts (the direction EU textile rules are heading).
// Built from fields the shop already keeps, so it's zero extra data entry.
publicRoutes.get("/passport/:slug", async (c) => {
  const p = await first<Record<string, unknown>>(
    c.var.db,
    `SELECT p.name, p.slug, p.category, p.fabric_composition, p.care_summary, p.origin_statement,
            p.subtitle, s.name AS style_name
     FROM products p LEFT JOIN styles s ON s.id = p.style_id
     WHERE p.slug = ? AND p.is_published = 1`,
    c.req.param("slug"),
  );
  if (!p) return c.json({ error: "Product not found" }, 404);
  const brand = await first<{ value: string }>(c.var.db, `SELECT value FROM settings WHERE key = 'brand_name'`);
  return c.json({
    brandName: brand?.value ?? null,
    name: p.name,
    slug: p.slug,
    category: p.category,
    subtitle: p.subtitle ?? null,
    fabricComposition: p.fabric_composition ?? null,
    careSummary: p.care_summary ?? null,
    originStatement: p.origin_statement ?? null,
  });
});

// Back-in-stock waitlist: leave an email against a sold-out product.
publicRoutes.post(
  "/products/:slug/notify-restock",
  rateLimit({ key: "restock_sub", limit: 20, windowSeconds: 3600 }),
  async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { email?: string };
    const email = (body.email ?? "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return c.json({ error: "Enter a valid email." }, 400);
    const product = await first<{ id: string }>(
      c.var.db,
      `SELECT id FROM products WHERE slug = ? AND is_published = 1`,
      c.req.param("slug"),
    );
    if (!product) return c.json({ error: "Product not found" }, 404);
    // Deduped by the partial unique index (product_id, email) where variant is null.
    await run(
      c.var.db,
      `INSERT INTO restock_subscriptions (id, product_id, email) VALUES (?, ?, ?)
       ON CONFLICT DO NOTHING`,
      newId("rs"),
      product.id,
      email,
    );
    return c.json({ ok: true });
  },
);

// ---------- Lookbook ----------
publicRoutes.get("/lookbooks", async (c) => {
  const books = await all<Record<string, unknown>>(
    c.var.db,
    `SELECT id, slug, title, season, intro_copy FROM lookbooks WHERE is_published = 1
     ORDER BY created_at DESC`,
  );
  const result: PublicLookbook[] = [];
  for (const b of books) {
    const images = await all<{
      image_url: string;
      caption: string | null;
      product_slug: string | null;
      product_name: string | null;
      product_price: number | null;
    }>(
      c.var.db,
      `SELECT li.image_url, li.caption,
              pr.slug AS product_slug, pr.name AS product_name, pr.base_price_cents AS product_price
       FROM lookbook_images li
       LEFT JOIN products pr ON pr.id = li.product_id AND pr.is_published = 1
       WHERE li.lookbook_id = ? ORDER BY li.sort_order`,
      b.id,
    );
    result.push({
      slug: b.slug as string,
      title: b.title as string,
      season: (b.season as string) ?? null,
      introCopy: (b.intro_copy as string) ?? null,
      images: images.map((i) => ({
        url: i.image_url,
        caption: i.caption,
        productSlug: i.product_slug,
        productName: i.product_name,
        productPriceCents: i.product_price,
      })),
    });
  }
  return c.json(result);
});

// ---------- Journal ----------
publicRoutes.get("/journal", async (c) => {
  const rows = await all(
    c.var.db,
    `SELECT slug, title, excerpt, hero_image_url, author, published_at
     FROM journal_posts WHERE is_published = 1 ORDER BY published_at DESC`,
  );
  return c.json(rows.map((r) => mapJournal(r, false)));
});

publicRoutes.get("/journal/:slug", async (c) => {
  const allowDraft = await previewAllowed(c.var.db, c.req.query("preview"));
  const row = await first(
    c.var.db,
    `SELECT id, slug, title, excerpt, body_md, hero_image_url, author, published_at
     FROM journal_posts WHERE slug = ? ${allowDraft ? "" : "AND is_published = 1"}`,
    c.req.param("slug"),
  );
  if (!row) return c.json({ error: "Post not found" }, 404);
  const post = mapJournal(row, true) as PublicJournalPost & { lang?: string; translated?: boolean };

  const lang = (c.req.query("lang") ?? "").toLowerCase().slice(0, 5);
  if (lang) {
    const languages = await getSupportedLanguages(c.var.db);
    if (lang !== languages[0] && languages.includes(lang)) {
      const translated = await translateFields(c.env, c.var.db, "journal_post", row.id as string, lang, {
        title: post.title,
        excerpt: post.excerpt,
        bodyMd: post.bodyMd,
      });
      if (translated) {
        post.title = translated.title ?? post.title;
        post.excerpt = translated.excerpt ?? post.excerpt;
        post.bodyMd = translated.bodyMd ?? post.bodyMd;
        post.lang = lang;
        post.translated = true;
      }
    }
  }
  return c.json(post);
});

// ---------- Static pages ----------
publicRoutes.get("/pages/:slug", async (c) => {
  const allowDraft = await previewAllowed(c.var.db, c.req.query("preview"));
  const row = await first<{
    id: string;
    slug: string;
    title: string;
    body_md: string | null;
    layout: string | null;
    hero_image_url: string | null;
    hero_eyebrow: string | null;
    subtitle: string | null;
    sections_json: string | null;
  }>(
    c.var.db,
    `SELECT id, slug, title, body_md, layout, hero_image_url, hero_eyebrow, subtitle, sections_json
     FROM pages WHERE slug = ? ${allowDraft ? "" : "AND is_published = 1"}`,
    c.req.param("slug"),
  );
  if (!row) return c.json({ error: "Page not found" }, 404);

  let sections: PublicPage["sections"] = null;
  if (row.sections_json) {
    try {
      sections = JSON.parse(row.sections_json) as PublicPage["sections"];
    } catch {
      /* malformed sections → fall back to markdown body */
    }
  }
  const page: PublicPage = {
    slug: row.slug,
    title: row.title,
    bodyMd: row.body_md,
    layout: (row.layout as PublicPage["layout"]) ?? "standard",
    heroImageUrl: row.hero_image_url,
    heroEyebrow: row.hero_eyebrow,
    subtitle: row.subtitle,
    sections,
  };

  // On-demand translation (markdown pages only; block sections stay in the
  // default language — "decent translations without full localization").
  const lang = (c.req.query("lang") ?? "").toLowerCase().slice(0, 5);
  if (lang) {
    const languages = await getSupportedLanguages(c.var.db);
    if (lang !== languages[0] && languages.includes(lang) && !sections) {
      const translated = await translateFields(c.env, c.var.db, "page", row.id, lang, {
        title: row.title,
        subtitle: row.subtitle,
        heroEyebrow: row.hero_eyebrow,
        bodyMd: row.body_md,
      });
      if (translated) {
        page.title = translated.title ?? page.title;
        page.subtitle = translated.subtitle ?? page.subtitle;
        page.heroEyebrow = translated.heroEyebrow ?? page.heroEyebrow;
        page.bodyMd = translated.bodyMd ?? page.bodyMd;
        page.lang = lang;
        page.translated = true;
      } else if (allowDraft) {
        // Preview-token holders (admins) get the failure reason inline.
        const { lastTranslateError } = await import("../services/translate");
        (page as unknown as Record<string, unknown>).translationError = lastTranslateError;
      }
    }
  }
  return c.json(page);
});

// ---------- Leads (newsletter / waitlist / wholesale / contact) ----------
publicRoutes.post(
  "/leads",
  rateLimit({ key: "leads", limit: 8, windowSeconds: 3600 }),
  async (c) => {
    const body = await parseBody(c, leadSchema);
    await run(
      c.var.db,
      `INSERT INTO leads (id, kind, email, name, company, message, product_id, source_path)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      newId("lead"),
      body.kind,
      body.email.toLowerCase(),
      body.name ?? null,
      body.company ?? null,
      body.message ?? null,
      body.productId ?? null,
      body.sourcePath ?? null,
    );
    // High-intent leads notify the founder immediately; list signups don't.
    if (body.kind === "wholesale_inquiry" || body.kind === "contact") {
      c.executionCtx.waitUntil(
        sendNotification(
          c.env,
          leadNotification({
            kind: body.kind,
            email: body.email,
            name: body.name,
            company: body.company,
            message: body.message,
          }),
        ),
      );
    }
    return c.json({ ok: true }, 201);
  },
);

// ---------- Analytics events ----------
publicRoutes.post(
  "/events",
  rateLimit({ key: "events", limit: 240, windowSeconds: 3600 }),
  async (c) => {
    const body = await parseBody(c, analyticsEventSchema);
    await run(
      c.var.db,
      `INSERT INTO analytics_events
        (id, event, session_key, entity_type, entity_id, path, referrer, country, properties_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      newId("evt"),
      body.event,
      body.sessionKey ?? null,
      body.entityType ?? null,
      body.entityId ?? null,
      body.path ?? null,
      body.referrer ?? null,
      c.req.header("cf-ipcountry") ?? null,
      body.properties ? JSON.stringify(body.properties) : null,
    );
    return c.json({ ok: true }, 201);
  },
);

// ---------- Campaign + size chart helpers ----------

export async function loadCampaign(
  db: D1Database,
  productId: string,
): Promise<PublicCampaign | null> {
  const row = await first<{
    goal_units: number;
    max_units: number | null;
    cutoff_date: string | null;
    status: string;
  }>(
    db,
    `SELECT goal_units, max_units, cutoff_date, status FROM preorder_campaigns
     WHERE product_id = ? AND status IN ('live','funded')`,
    productId,
  );
  if (!row) return null;
  const ordered = await first<{ n: number }>(
    db,
    `SELECT COALESCE(SUM(oi.quantity), 0) AS n FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     WHERE oi.product_id = ? AND oi.is_pre_order = 1
       AND o.payment_status IN ('paid','partially_refunded')`,
    productId,
  );
  return {
    goalUnits: row.goal_units,
    orderedUnits: ordered?.n ?? 0,
    maxUnits: row.max_units,
    cutoffDate: row.cutoff_date,
    status: row.status,
  };
}

/**
 * Size chart derived from the production spec: the same measurement points
 * and grading rules the factory sews to power the PDP size table. One
 * database, storefront to cutting table.
 */
async function loadSizeChart(db: D1Database, styleId: string): Promise<PublicSizeChart | null> {
  const spec = await first<{ id: string; base_size: string; size_run: string; unit: string }>(
    db,
    `SELECT id, base_size, size_run, unit FROM size_specs WHERE style_id = ? LIMIT 1`,
    styleId,
  );
  if (!spec) return null;
  const sizes = jsonArray(spec.size_run);
  const baseIdx = sizes.indexOf(spec.base_size);
  if (sizes.length === 0 || baseIdx === -1) return null;

  const points = await all<{
    code: string;
    name: string;
    base_value: number | null;
    step_value: number | null;
  }>(
    db,
    `SELECT mp.code, mp.name, mp.base_value, gr.step_value
     FROM measurement_points mp
     LEFT JOIN grading_rules gr ON gr.measurement_point_id = mp.id
     WHERE mp.size_spec_id = ? ORDER BY mp.sort_order`,
    spec.id,
  );
  if (points.length === 0) return null;

  const rows = points.map((point) => ({
    code: point.code,
    name: point.name,
    values: sizes.map((_, i) => {
      if (point.base_value == null) return null;
      if (point.step_value != null) {
        return Math.round((point.base_value + point.step_value * (i - baseIdx)) * 10) / 10;
      }
      return i === baseIdx ? point.base_value : null;
    }),
  }));
  return { unit: spec.unit, baseSize: spec.base_size, sizes, rows };
}

// ---------- Mapping helpers ----------

function mapCollection(row: Record<string, unknown>): PublicCollection {
  return {
    id: row.id as string,
    slug: row.slug as string,
    name: row.name as string,
    season: (row.season as string) ?? null,
    description: (row.description as string) ?? null,
    editorialCopy: (row.editorial_copy as string) ?? null,
    heroImageUrl: (row.hero_image_url as string) ?? null,
  };
}

function mapJournal(row: Record<string, unknown>, includeBody: boolean): PublicJournalPost {
  return {
    slug: row.slug as string,
    title: row.title as string,
    excerpt: (row.excerpt as string) ?? null,
    bodyMd: includeBody ? ((row.body_md as string) ?? null) : null,
    heroImageUrl: (row.hero_image_url as string) ?? null,
    author: (row.author as string) ?? null,
    publishedAt: (row.published_at as string) ?? null,
  };
}

function mapProductSummary(row: Record<string, unknown>): PublicProductSummary {
  return {
    id: row.id as string,
    slug: row.slug as string,
    name: row.name as string,
    subtitle: (row.subtitle as string) ?? null,
    gender: row.gender as PublicProductSummary["gender"],
    category: row.category as string,
    basePriceCents: row.base_price_cents as number,
    currency: row.currency as string,
    availability: row.availability as PublicProductSummary["availability"],
    imageUrl: (row.image_url as string) ?? null,
    imageAlt: (row.image_alt as string) ?? null,
    collectionSlug: (row.collection_slug as string) ?? null,
  };
}

async function queryProductSummaries(
  db: D1Database,
  where: string,
  params: unknown[],
  skipDefaultOrder = false,
): Promise<PublicProductSummary[]> {
  const rows = await all(
    db,
    `SELECT p.id, p.slug, p.name, p.subtitle, p.gender, p.category,
            p.base_price_cents, p.currency, p.availability,
            c.slug AS collection_slug,
            (SELECT url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.sort_order LIMIT 1) AS image_url,
            (SELECT alt_text FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.sort_order LIMIT 1) AS image_alt
     FROM products p
     LEFT JOIN collections c ON c.id = p.collection_id
     ${where} ${skipDefaultOrder ? "" : "ORDER BY p.sort_order"}`,
    ...params,
  );
  return rows.map(mapProductSummary);
}
