import { Hono } from "hono";
import { all, first, run } from "../services/db";
import { leadNotification, sendNotification } from "../services/email";
import { analyticsEventSchema, leadSchema, parseBody } from "../services/validators";
import { rateLimit } from "../middleware/rate-limit";
import { newId } from "../utils/id";
import type { AppContext } from "../types/env";
import type {
  BrandSettings,
  PublicCollection,
  PublicJournalPost,
  PublicLookbook,
  PublicPage,
  PublicProductDetail,
  PublicProductSummary,
  PublicVariant,
} from "../../shared/types";

export const publicRoutes = new Hono<AppContext>();

// ---------- Brand settings ----------
publicRoutes.get("/settings", async (c) => {
  const rows = await all<{ key: string; value: string }>(
    c.env.DB,
    `SELECT key, value FROM settings WHERE key IN ('brand_name','brand_tagline','default_currency')`,
  );
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const settings: BrandSettings = {
    brandName: map.brand_name ?? c.env.BRAND_NAME,
    tagline: map.brand_tagline ?? "",
    currency: map.default_currency ?? "USD",
  };
  return c.json(settings);
});

// ---------- Collections ----------
publicRoutes.get("/collections", async (c) => {
  const rows = await all(
    c.env.DB,
    `SELECT id, slug, name, season, description, editorial_copy, hero_image_url
     FROM collections WHERE is_published = 1 ORDER BY sort_order`,
  );
  return c.json(rows.map(mapCollection));
});

publicRoutes.get("/collections/:slug", async (c) => {
  const row = await first(
    c.env.DB,
    `SELECT id, slug, name, season, description, editorial_copy, hero_image_url
     FROM collections WHERE slug = ? AND is_published = 1`,
    c.req.param("slug"),
  );
  if (!row) return c.json({ error: "Collection not found" }, 404);
  const products = await queryProductSummaries(
    c.env.DB,
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
  return c.json(await queryProductSummaries(c.env.DB, where, params));
});

publicRoutes.get("/products/:slug", async (c) => {
  const p = await first<Record<string, unknown>>(
    c.env.DB,
    `SELECT p.*, c.slug AS collection_slug FROM products p
     LEFT JOIN collections c ON c.id = p.collection_id
     WHERE p.slug = ? AND p.is_published = 1`,
    c.req.param("slug"),
  );
  if (!p) return c.json({ error: "Product not found" }, 404);

  const images = await all<{ url: string; alt_text: string | null; colorway_name: string | null }>(
    c.env.DB,
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
    c.env.DB,
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

  const related = await queryProductSummaries(
    c.env.DB,
    `WHERE p.is_published = 1 AND p.id != ? AND (p.collection_id = ? OR p.gender = ?)
     ORDER BY CASE WHEN p.collection_id = ? THEN 0 ELSE 1 END, p.sort_order LIMIT 4`,
    [p.id, p.collection_id, p.gender, p.collection_id],
    /* skipDefaultOrder */ true,
  );

  const detail: PublicProductDetail = {
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
  };
  return c.json(detail);
});

// ---------- Lookbook ----------
publicRoutes.get("/lookbooks", async (c) => {
  const books = await all<Record<string, unknown>>(
    c.env.DB,
    `SELECT id, slug, title, season, intro_copy FROM lookbooks WHERE is_published = 1
     ORDER BY created_at DESC`,
  );
  const result: PublicLookbook[] = [];
  for (const b of books) {
    const images = await all<{ image_url: string; caption: string | null }>(
      c.env.DB,
      `SELECT image_url, caption FROM lookbook_images WHERE lookbook_id = ? ORDER BY sort_order`,
      b.id,
    );
    result.push({
      slug: b.slug as string,
      title: b.title as string,
      season: (b.season as string) ?? null,
      introCopy: (b.intro_copy as string) ?? null,
      images: images.map((i) => ({ url: i.image_url, caption: i.caption })),
    });
  }
  return c.json(result);
});

// ---------- Journal ----------
publicRoutes.get("/journal", async (c) => {
  const rows = await all(
    c.env.DB,
    `SELECT slug, title, excerpt, hero_image_url, author, published_at
     FROM journal_posts WHERE is_published = 1 ORDER BY published_at DESC`,
  );
  return c.json(rows.map((r) => mapJournal(r, false)));
});

publicRoutes.get("/journal/:slug", async (c) => {
  const row = await first(
    c.env.DB,
    `SELECT slug, title, excerpt, body_md, hero_image_url, author, published_at
     FROM journal_posts WHERE slug = ? AND is_published = 1`,
    c.req.param("slug"),
  );
  if (!row) return c.json({ error: "Post not found" }, 404);
  return c.json(mapJournal(row, true));
});

// ---------- Static pages ----------
publicRoutes.get("/pages/:slug", async (c) => {
  const row = await first<{ slug: string; title: string; body_md: string | null }>(
    c.env.DB,
    `SELECT slug, title, body_md FROM pages WHERE slug = ? AND is_published = 1`,
    c.req.param("slug"),
  );
  if (!row) return c.json({ error: "Page not found" }, 404);
  const page: PublicPage = { slug: row.slug, title: row.title, bodyMd: row.body_md };
  return c.json(page);
});

// ---------- Leads (newsletter / waitlist / wholesale / contact) ----------
publicRoutes.post(
  "/leads",
  rateLimit({ key: "leads", limit: 8, windowSeconds: 3600 }),
  async (c) => {
    const body = await parseBody(c, leadSchema);
    await run(
      c.env.DB,
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
      c.env.DB,
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
