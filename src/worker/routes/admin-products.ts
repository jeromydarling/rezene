import { Hono } from "hono";
import { all, first, run, writeAudit } from "../services/db";
import { emit } from "../services/activity";
import {
  collectionCreateSchema,
  imageReorderSchema,
  inventoryAdjustSchema,
  parseBody,
  productCreateSchema,
  productImageSchema,
  productUpdateSchema,
  variantCreateSchema,
  variantUpdateSchema,
} from "../services/validators";
import { requireAdminWrite } from "../middleware/auth";
import { newId } from "../utils/id";
import type { AppContext } from "../types/env";
import type { AdminInventoryRow, AdminProduct } from "../../shared/types";

export const adminProductRoutes = new Hono<AppContext>();

/** URL-safe slug from a name; caller ensures uniqueness. */
function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80) || "item";
}

async function uniqueSlug(db: AppContext["Variables"]["db"], table: string, base: string, ignoreId?: string): Promise<string> {
  let slug = base;
  for (let n = 2; n < 200; n++) {
    const clash = await first<{ id: string }>(
      db,
      `SELECT id FROM ${table} WHERE slug = ?${ignoreId ? " AND id != ?" : ""}`,
      ...(ignoreId ? [slug, ignoreId] : [slug]),
    );
    if (!clash) return slug;
    slug = `${base}-${n}`;
  }
  return `${base}-${Date.now()}`;
}

const PRODUCT_SELECT = `
  SELECT p.*,
    (SELECT COUNT(*) FROM product_variants v WHERE v.product_id = p.id) AS variant_count,
    (SELECT COALESCE(SUM(i.on_hand), 0) FROM inventory_items i
       JOIN product_variants v ON v.id = i.variant_id WHERE v.product_id = p.id) AS total_on_hand
  FROM products p`;

function mapProduct(row: Record<string, unknown>): AdminProduct {
  return {
    id: row.id as string,
    slug: row.slug as string,
    name: row.name as string,
    styleId: (row.style_id as string) ?? null,
    collectionId: (row.collection_id as string) ?? null,
    gender: row.gender as string,
    category: row.category as string,
    basePriceCents: row.base_price_cents as number,
    currency: row.currency as string,
    availability: row.availability as string,
    isPublished: Boolean(row.is_published),
    variantCount: (row.variant_count as number) ?? 0,
    totalOnHand: (row.total_on_hand as number) ?? 0,
    updatedAt: row.updated_at as string,
  };
}

adminProductRoutes.get("/", async (c) => {
  const rows = await all(c.var.db, `${PRODUCT_SELECT} ORDER BY p.sort_order`);
  return c.json(rows.map(mapProduct));
});

adminProductRoutes.post("/", requireAdminWrite, async (c) => {
  const body = await parseBody(c, productCreateSchema);
  const id = newId("prod");
  const slug = await uniqueSlug(c.var.db, "products", body.slug || slugify(body.name));
  const next = await first<{ n: number }>(c.var.db, `SELECT COALESCE(MAX(sort_order), 0) + 1 AS n FROM products`);
  await run(
    c.var.db,
    `INSERT INTO products (id, slug, name, gender, category, collection_id, base_price_cents, currency, description, availability, is_published, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', 0, ?)`,
    id,
    slug,
    body.name,
    body.gender,
    body.category,
    body.collectionId || null,
    body.basePriceCents,
    body.currency,
    body.description ?? null,
    next?.n ?? 1,
  );
  await writeAudit(c.var.db, c.var.userId, "product.create", "product", id, { name: body.name });
  return c.json({ id, slug }, 201);
});

adminProductRoutes.get("/:id", async (c) => {
  const row = await first<Record<string, unknown>>(
    c.var.db,
    `${PRODUCT_SELECT} WHERE p.id = ?`,
    c.req.param("id"),
  );
  if (!row) return c.json({ error: "Product not found" }, 404);
  const variants = await all<Record<string, unknown>>(
    c.var.db,
    `SELECT v.*, i.id AS inventory_item_id, i.on_hand, i.reserved, i.incoming FROM product_variants v
     LEFT JOIN inventory_items i ON i.variant_id = v.id
     WHERE v.product_id = ? ORDER BY v.colorway_name, v.size`,
    row.id,
  );
  const images = await all<Record<string, unknown>>(
    c.var.db,
    `SELECT id, url, alt_text, colorway_name, sort_order FROM product_images
     WHERE product_id = ? ORDER BY sort_order`,
    row.id,
  );
  const mappings = await all<Record<string, unknown>>(
    c.var.db,
    `SELECT id, variant_id, stripe_product_id, stripe_price_id, currency, synced_at
     FROM stripe_product_mappings WHERE product_id = ?`,
    row.id,
  );
  return c.json({
    ...mapProduct(row),
    description: row.description,
    editorialStory: row.editorial_story,
    fitNotes: row.fit_notes,
    shippingNote: row.shipping_note,
    preOrderNote: row.pre_order_note,
    variants,
    images,
    stripeMappings: mappings,
  });
});

adminProductRoutes.patch("/:id", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  const body = await parseBody(c, productUpdateSchema);
  const existing = await first<{ id: string; is_published: number; name: string }>(
    c.var.db,
    `SELECT id, is_published, name FROM products WHERE id = ?`,
    id,
  );
  if (!existing) return c.json({ error: "Product not found" }, 404);

  const sets: string[] = [];
  const params: unknown[] = [];
  const fieldMap: Record<string, string> = {
    name: "name",
    subtitle: "subtitle",
    description: "description",
    editorialStory: "editorial_story",
    gender: "gender",
    category: "category",
    collectionId: "collection_id",
    basePriceCents: "base_price_cents",
    compareAtPriceCents: "compare_at_price_cents",
    currency: "currency",
    availability: "availability",
    fabricComposition: "fabric_composition",
    careSummary: "care_summary",
    originStatement: "origin_statement",
    preOrderNote: "pre_order_note",
    shippingNote: "shipping_note",
    fitNotes: "fit_notes",
  };
  for (const [key, col] of Object.entries(fieldMap)) {
    if (key in body) {
      sets.push(`${col} = ?`);
      params.push((body as Record<string, unknown>)[key] ?? null);
    }
  }
  if ("slug" in body && body.slug) {
    sets.push(`slug = ?`);
    params.push(await uniqueSlug(c.var.db, "products", body.slug, id));
  }
  if ("isPublished" in body) {
    sets.push(`is_published = ?`);
    params.push(body.isPublished ? 1 : 0);
  }
  if (sets.length === 0) return c.json({ error: "No fields to update" }, 400);
  sets.push(`updated_at = datetime('now')`);
  await run(c.var.db, `UPDATE products SET ${sets.join(", ")} WHERE id = ?`, ...params, id);
  await writeAudit(c.var.db, c.var.userId, "product.update", "product", id, body);

  // First publish (false → true) fires the launch-kit automation. Pass env/ctx
  // so the rule can draft marketing content off the request path.
  if ("isPublished" in body && body.isPublished && !existing.is_published) {
    await emit(
      c.var.db,
      {
        kind: "product.published",
        entityType: "product",
        entityId: id,
        title: `Published ${existing.name}`,
        payload: { productId: id, name: existing.name },
      },
      { env: c.env, ctx: c.executionCtx },
    );
  }

  const row = await first(c.var.db, `${PRODUCT_SELECT} WHERE p.id = ?`, id);
  return c.json(mapProduct(row!));
});

adminProductRoutes.delete("/:id", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  const existing = await first(c.var.db, `SELECT id FROM products WHERE id = ?`, id);
  if (!existing) return c.json({ error: "Product not found" }, 404);
  // Variants + images cascade; inventory_items cascade off variants.
  await run(c.var.db, `DELETE FROM products WHERE id = ?`, id);
  await writeAudit(c.var.db, c.var.userId, "product.delete", "product", id);
  return c.json({ ok: true });
});

// ---------- Product images ----------
adminProductRoutes.post("/:id/images", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  const body = await parseBody(c, productImageSchema);
  if (!(await first(c.var.db, `SELECT id FROM products WHERE id = ?`, id))) {
    return c.json({ error: "Product not found" }, 404);
  }
  const next = await first<{ n: number }>(
    c.var.db,
    `SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM product_images WHERE product_id = ?`,
    id,
  );
  const imageId = newId("img");
  await run(
    c.var.db,
    `INSERT INTO product_images (id, product_id, url, alt_text, colorway_name, sort_order)
     VALUES (?, ?, ?, ?, ?, ?)`,
    imageId,
    id,
    body.url,
    body.altText ?? null,
    body.colorwayName ?? null,
    next?.n ?? 0,
  );
  return c.json({ id: imageId }, 201);
});

adminProductRoutes.delete("/:id/images/:imageId", requireAdminWrite, async (c) => {
  await run(
    c.var.db,
    `DELETE FROM product_images WHERE id = ? AND product_id = ?`,
    c.req.param("imageId"),
    c.req.param("id"),
  );
  return c.json({ ok: true });
});

adminProductRoutes.post("/:id/images/reorder", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  const { order } = await parseBody(c, imageReorderSchema);
  await c.var.db.batch(
    order.map((imageId, i) =>
      c.var.db
        .prepare(`UPDATE product_images SET sort_order = ? WHERE id = ? AND product_id = ?`)
        .bind(i, imageId, id),
    ),
  );
  return c.json({ ok: true });
});

// ---------- Variants (sellable SKUs) + their inventory row ----------
adminProductRoutes.post("/:id/variants", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  const body = await parseBody(c, variantCreateSchema);
  if (!(await first(c.var.db, `SELECT id FROM products WHERE id = ?`, id))) {
    return c.json({ error: "Product not found" }, 404);
  }
  const dupe = await first(
    c.var.db,
    `SELECT id FROM product_variants WHERE product_id = ? AND colorway_name = ? AND size = ?`,
    id,
    body.colorwayName,
    body.size,
  );
  if (dupe) return c.json({ error: "That colour + size already exists." }, 409);

  const variantId = newId("var");
  const invId = newId("inv");
  await c.var.db.batch([
    c.var.db
      .prepare(
        `INSERT INTO product_variants (id, product_id, colorway_name, size, sku_code, price_cents, is_active)
         VALUES (?, ?, ?, ?, ?, ?, 1)`,
      )
      .bind(variantId, id, body.colorwayName, body.size, body.skuCode ?? null, body.priceCents ?? null),
    c.var.db
      .prepare(`INSERT INTO inventory_items (id, variant_id, on_hand) VALUES (?, ?, ?)`)
      .bind(invId, variantId, body.onHand ?? 0),
  ]);
  await writeAudit(c.var.db, c.var.userId, "variant.create", "product", id, { variantId });
  return c.json({ id: variantId }, 201);
});

adminProductRoutes.patch("/:id/variants/:variantId", requireAdminWrite, async (c) => {
  const body = await parseBody(c, variantUpdateSchema);
  const sets: string[] = [];
  const params: unknown[] = [];
  const map: Record<string, string> = {
    colorwayName: "colorway_name",
    size: "size",
    skuCode: "sku_code",
    priceCents: "price_cents",
  };
  for (const [key, col] of Object.entries(map)) {
    if (key in body) {
      sets.push(`${col} = ?`);
      params.push((body as Record<string, unknown>)[key] ?? null);
    }
  }
  if ("isActive" in body) {
    sets.push(`is_active = ?`);
    params.push(body.isActive ? 1 : 0);
  }
  if (sets.length === 0) return c.json({ error: "No fields to update" }, 400);
  await run(
    c.var.db,
    `UPDATE product_variants SET ${sets.join(", ")} WHERE id = ? AND product_id = ?`,
    ...params,
    c.req.param("variantId"),
    c.req.param("id"),
  );
  return c.json({ ok: true });
});

adminProductRoutes.delete("/:id/variants/:variantId", requireAdminWrite, async (c) => {
  await run(
    c.var.db,
    `DELETE FROM product_variants WHERE id = ? AND product_id = ?`,
    c.req.param("variantId"),
    c.req.param("id"),
  );
  return c.json({ ok: true });
});

// ---------- Collections ----------
adminProductRoutes.post("/collections", requireAdminWrite, async (c) => {
  const body = await parseBody(c, collectionCreateSchema);
  const id = newId("col");
  const slug = await uniqueSlug(c.var.db, "collections", body.slug || slugify(body.name));
  const next = await first<{ n: number }>(c.var.db, `SELECT COALESCE(MAX(sort_order), 0) + 1 AS n FROM collections`);
  await run(
    c.var.db,
    `INSERT INTO collections (id, slug, name, season, description, sort_order, is_published)
     VALUES (?, ?, ?, ?, ?, ?, 0)`,
    id,
    slug,
    body.name,
    body.season ?? null,
    body.description ?? null,
    next?.n ?? 1,
  );
  await writeAudit(c.var.db, c.var.userId, "collection.create", "collection", id, { name: body.name });
  return c.json({ id, slug }, 201);
});

adminProductRoutes.delete("/collections/:id", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  if (!(await first(c.var.db, `SELECT id FROM collections WHERE id = ?`, id))) {
    return c.json({ error: "Collection not found" }, 404);
  }
  // Products/styles reference collection_id with ON DELETE SET NULL.
  await run(c.var.db, `DELETE FROM collections WHERE id = ?`, id);
  await writeAudit(c.var.db, c.var.userId, "collection.delete", "collection", id);
  return c.json({ ok: true });
});

adminProductRoutes.get("/collections/all", async (c) => {
  const rows = await all(
    c.var.db,
    `SELECT c.id, c.slug, c.name, c.season, c.is_published, c.sort_order,
       (SELECT COUNT(*) FROM products p WHERE p.collection_id = c.id) AS product_count,
       (SELECT COUNT(*) FROM styles s WHERE s.collection_id = c.id) AS style_count
     FROM collections c ORDER BY c.sort_order`,
  );
  return c.json(rows);
});

adminProductRoutes.get("/collections/detail", async (c) => {
  const rows = await all(c.var.db, `SELECT * FROM collections ORDER BY sort_order`);
  return c.json(rows);
});

// ---------- Inventory ----------
adminProductRoutes.get("/inventory/all", async (c) => {
  const rows = await all<Record<string, unknown>>(
    c.var.db,
    `SELECT i.id AS inventory_item_id, i.variant_id, i.on_hand, i.reserved, i.incoming,
            i.pre_order_allocated, i.low_stock_threshold,
            v.colorway_name, v.size, p.name AS product_name, k.sku_code
     FROM inventory_items i
     JOIN product_variants v ON v.id = i.variant_id
     JOIN products p ON p.id = v.product_id
     LEFT JOIN skus k ON k.id = v.sku_id
     ORDER BY p.sort_order, v.colorway_name, v.size`,
  );
  const inventory: AdminInventoryRow[] = rows.map((r) => {
    const onHand = r.on_hand as number;
    const reserved = r.reserved as number;
    return {
      inventoryItemId: r.inventory_item_id as string,
      variantId: r.variant_id as string,
      productName: r.product_name as string,
      colorwayName: r.colorway_name as string,
      size: r.size as string,
      skuCode: (r.sku_code as string) ?? null,
      onHand,
      reserved,
      incoming: r.incoming as number,
      preOrderAllocated: r.pre_order_allocated as number,
      lowStockThreshold: r.low_stock_threshold as number,
      isLow: onHand - reserved <= (r.low_stock_threshold as number),
    };
  });
  return c.json(inventory);
});

adminProductRoutes.post("/inventory/adjust", requireAdminWrite, async (c) => {
  const body = await parseBody(c, inventoryAdjustSchema);
  const item = await first<{ id: string; on_hand: number; reserved: number; incoming: number }>(
    c.var.db,
    `SELECT id, on_hand, reserved, incoming FROM inventory_items WHERE id = ?`,
    body.inventoryItemId,
  );
  if (!item) return c.json({ error: "Inventory item not found" }, 404);

  // Apply movement semantics to the right counters.
  let onHandDelta = 0;
  let reservedDelta = 0;
  let incomingDelta = 0;
  const q = body.quantity;
  switch (body.kind) {
    case "receive":
      onHandDelta = Math.abs(q);
      incomingDelta = -Math.abs(q);
      break;
    case "sell":
      onHandDelta = -Math.abs(q);
      reservedDelta = -Math.min(Math.abs(q), item.reserved);
      break;
    case "reserve":
      reservedDelta = Math.abs(q);
      break;
    case "release":
      reservedDelta = -Math.abs(q);
      break;
    case "return":
      onHandDelta = Math.abs(q);
      break;
    case "damage":
      onHandDelta = -Math.abs(q);
      break;
    case "adjust":
      onHandDelta = q;
      break;
    case "preorder_allocate":
      break;
  }
  const newOnHand = Math.max(0, item.on_hand + onHandDelta);
  const newReserved = Math.max(0, item.reserved + reservedDelta);
  const newIncoming = Math.max(0, item.incoming + incomingDelta);

  await c.var.db.batch([
    c.var.db.prepare(
      `UPDATE inventory_items SET on_hand = ?, reserved = ?, incoming = ?,
         pre_order_allocated = pre_order_allocated + ?, updated_at = datetime('now')
       WHERE id = ?`,
    ).bind(
      newOnHand,
      newReserved,
      newIncoming,
      body.kind === "preorder_allocate" ? q : 0,
      item.id,
    ),
    c.var.db.prepare(
      `INSERT INTO inventory_movements (id, inventory_item_id, kind, quantity, reference_type, note, created_by)
       VALUES (?, ?, ?, ?, 'manual', ?, ?)`,
    ).bind(newId("mov"), item.id, body.kind, q, body.note ?? null, c.var.userId),
  ]);
  await writeAudit(c.var.db, c.var.userId, "inventory.adjust", "inventory_item", item.id, body);

  // Back-in-stock: if this variant just went from zero to available, email the
  // waitlist for its product. Best-effort — never blocks the inventory write.
  if (item.on_hand === 0 && newOnHand > 0) {
    try {
      const prod = await first<{ product_id: string }>(
        c.var.db,
        `SELECT v.product_id FROM inventory_items i JOIN product_variants v ON v.id = i.variant_id WHERE i.id = ?`,
        item.id,
      );
      if (prod?.product_id) {
        const { notifyRestock } = await import("../services/restock");
        const origin = new URL(c.req.url).origin;
        const { getPrimaryShopBase } = await import("../services/shops");
        const shopBase = c.var.shopSlug ? `/${c.var.shopSlug}` : await getPrimaryShopBase(c.env.DB);
        const base = (c.env.APP_ENV === "development" ? origin : c.env.APP_URL || origin) + shopBase;
        c.executionCtx.waitUntil(notifyRestock(c.env, c.var.db, prod.product_id, base));
      }
    } catch (err) {
      console.error("[inventory] restock notify skipped:", String(err).slice(0, 160));
    }
  }
  return c.json({ ok: true, onHand: newOnHand, reserved: newReserved, incoming: newIncoming });
});
