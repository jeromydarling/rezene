import { Hono } from "hono";
import { all, first, run, writeAudit } from "../services/db";
import { inventoryAdjustSchema, parseBody, productUpdateSchema } from "../services/validators";
import { requireAdminWrite } from "../middleware/auth";
import { newId } from "../utils/id";
import type { AppContext } from "../types/env";
import type { AdminInventoryRow, AdminProduct } from "../../shared/types";

export const adminProductRoutes = new Hono<AppContext>();

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
  const rows = await all(c.env.DB, `${PRODUCT_SELECT} ORDER BY p.sort_order`);
  return c.json(rows.map(mapProduct));
});

adminProductRoutes.get("/:id", async (c) => {
  const row = await first<Record<string, unknown>>(
    c.env.DB,
    `${PRODUCT_SELECT} WHERE p.id = ?`,
    c.req.param("id"),
  );
  if (!row) return c.json({ error: "Product not found" }, 404);
  const variants = await all<Record<string, unknown>>(
    c.env.DB,
    `SELECT v.*, i.on_hand, i.reserved, i.incoming FROM product_variants v
     LEFT JOIN inventory_items i ON i.variant_id = v.id
     WHERE v.product_id = ? ORDER BY v.colorway_name, v.size`,
    row.id,
  );
  const images = await all<Record<string, unknown>>(
    c.env.DB,
    `SELECT id, url, alt_text, colorway_name, sort_order FROM product_images
     WHERE product_id = ? ORDER BY sort_order`,
    row.id,
  );
  const mappings = await all<Record<string, unknown>>(
    c.env.DB,
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
  const existing = await first(c.env.DB, `SELECT id FROM products WHERE id = ?`, id);
  if (!existing) return c.json({ error: "Product not found" }, 404);

  const sets: string[] = [];
  const params: unknown[] = [];
  const fieldMap: Record<string, string> = {
    name: "name",
    subtitle: "subtitle",
    description: "description",
    editorialStory: "editorial_story",
    basePriceCents: "base_price_cents",
    availability: "availability",
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
  if ("isPublished" in body) {
    sets.push(`is_published = ?`);
    params.push(body.isPublished ? 1 : 0);
  }
  if (sets.length === 0) return c.json({ error: "No fields to update" }, 400);
  sets.push(`updated_at = datetime('now')`);
  await run(c.env.DB, `UPDATE products SET ${sets.join(", ")} WHERE id = ?`, ...params, id);
  await writeAudit(c.env.DB, c.var.userId, "product.update", "product", id, body);
  const row = await first(c.env.DB, `${PRODUCT_SELECT} WHERE p.id = ?`, id);
  return c.json(mapProduct(row!));
});

// ---------- Collections ----------
adminProductRoutes.get("/collections/all", async (c) => {
  const rows = await all(
    c.env.DB,
    `SELECT c.id, c.slug, c.name, c.season, c.is_published, c.sort_order,
       (SELECT COUNT(*) FROM products p WHERE p.collection_id = c.id) AS product_count,
       (SELECT COUNT(*) FROM styles s WHERE s.collection_id = c.id) AS style_count
     FROM collections c ORDER BY c.sort_order`,
  );
  return c.json(rows);
});

adminProductRoutes.get("/collections/detail", async (c) => {
  const rows = await all(c.env.DB, `SELECT * FROM collections ORDER BY sort_order`);
  return c.json(rows);
});

// ---------- Inventory ----------
adminProductRoutes.get("/inventory/all", async (c) => {
  const rows = await all<Record<string, unknown>>(
    c.env.DB,
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
    c.env.DB,
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

  await c.env.DB.batch([
    c.env.DB.prepare(
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
    c.env.DB.prepare(
      `INSERT INTO inventory_movements (id, inventory_item_id, kind, quantity, reference_type, note, created_by)
       VALUES (?, ?, ?, ?, 'manual', ?, ?)`,
    ).bind(newId("mov"), item.id, body.kind, q, body.note ?? null, c.var.userId),
  ]);
  await writeAudit(c.env.DB, c.var.userId, "inventory.adjust", "inventory_item", item.id, body);
  return c.json({ ok: true, onHand: newOnHand, reserved: newReserved, incoming: newIncoming });
});
