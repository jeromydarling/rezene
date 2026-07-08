import { Hono } from "hono";
import { all, first, run, writeAudit } from "../services/db";
import { requireAdminWrite } from "../middleware/auth";
import { newId } from "../utils/id";
import type { AppContext } from "../types/env";

/**
 * Multi-location inventory. The default location's stock is inventory_items
 * (what the storefront fulfils from); other locations track their stock in
 * location_stock. Transfers move units between locations and are logged.
 */
export const adminLocationsRoutes = new Hono<AppContext>();

async function defaultLocationId(db: D1Database): Promise<string> {
  const row = await first<{ id: string }>(db, `SELECT id FROM locations WHERE is_default = 1 LIMIT 1`);
  return row?.id ?? "loc_main";
}

adminLocationsRoutes.get("/", async (c) => {
  const rows = await all(
    c.var.db,
    `SELECT l.id, l.name, l.kind, l.is_default AS isDefault,
            CASE WHEN l.is_default = 1
              THEN (SELECT COALESCE(SUM(on_hand),0) FROM inventory_items)
              ELSE (SELECT COALESCE(SUM(on_hand),0) FROM location_stock ls WHERE ls.location_id = l.id)
            END AS units
     FROM locations l ORDER BY l.is_default DESC, l.name`,
  );
  return c.json({ locations: rows });
});

adminLocationsRoutes.post("/", requireAdminWrite, async (c) => {
  const b = (await c.req.json().catch(() => ({}))) as { name?: string; kind?: string };
  const name = (b.name ?? "").trim();
  if (!name) return c.json({ error: "Name the location." }, 400);
  const kind = ["studio", "warehouse", "shopfront"].includes(b.kind ?? "") ? b.kind! : "studio";
  const id = newId("loc");
  await run(c.var.db, `INSERT INTO locations (id, name, kind) VALUES (?, ?, ?)`, id, name.slice(0, 80), kind);
  await writeAudit(c.var.db, c.var.userId, "location.create", "location", id, { name, kind });
  return c.json({ id }, 201);
});

adminLocationsRoutes.delete("/:id", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  const loc = await first<{ is_default: number }>(c.var.db, `SELECT is_default FROM locations WHERE id = ?`, id);
  if (!loc) return c.json({ error: "Location not found" }, 404);
  if (loc.is_default) return c.json({ error: "You can't remove the default location." }, 400);
  const stock = await first<{ n: number }>(
    c.var.db,
    `SELECT COALESCE(SUM(on_hand),0) AS n FROM location_stock WHERE location_id = ?`,
    id,
  );
  if ((stock?.n ?? 0) > 0) return c.json({ error: "Move its stock out before removing it." }, 400);
  await run(c.var.db, `DELETE FROM locations WHERE id = ?`, id);
  return c.json({ ok: true });
});

// Per-location stock for one variant (default from inventory_items, rest from location_stock).
adminLocationsRoutes.get("/stock/:variantId", async (c) => {
  const variantId = c.req.param("variantId");
  const def = await defaultLocationId(c.var.db);
  const locations = await all<{ id: string; name: string; is_default: number }>(
    c.var.db,
    `SELECT id, name, is_default FROM locations ORDER BY is_default DESC, name`,
  );
  const defRow = await first<{ on_hand: number }>(
    c.var.db,
    `SELECT on_hand FROM inventory_items WHERE variant_id = ?`,
    variantId,
  );
  const locRows = await all<{ location_id: string; on_hand: number }>(
    c.var.db,
    `SELECT location_id, on_hand FROM location_stock WHERE variant_id = ?`,
    variantId,
  );
  const byLoc = new Map(locRows.map((r) => [r.location_id, r.on_hand]));
  const stock = locations.map((l) => ({
    locationId: l.id,
    name: l.name,
    isDefault: Boolean(l.is_default),
    onHand: l.id === def ? defRow?.on_hand ?? 0 : byLoc.get(l.id) ?? 0,
  }));
  return c.json({ stock });
});

// Move units between two locations.
adminLocationsRoutes.post("/transfer", requireAdminWrite, async (c) => {
  const b = (await c.req.json().catch(() => ({}))) as {
    variantId?: string;
    fromLocationId?: string;
    toLocationId?: string;
    quantity?: number;
    note?: string;
  };
  const qty = Math.round(Number(b.quantity) || 0);
  if (!b.variantId || !b.fromLocationId || !b.toLocationId)
    return c.json({ error: "Pick a piece and both locations." }, 400);
  if (b.fromLocationId === b.toLocationId) return c.json({ error: "Choose two different locations." }, 400);
  if (qty <= 0) return c.json({ error: "Transfer at least one unit." }, 400);

  const def = await defaultLocationId(c.var.db);

  const readStock = async (loc: string): Promise<number> => {
    if (loc === def) {
      const r = await first<{ on_hand: number }>(c.var.db, `SELECT on_hand FROM inventory_items WHERE variant_id = ?`, b.variantId);
      return r?.on_hand ?? 0;
    }
    const r = await first<{ on_hand: number }>(c.var.db, `SELECT on_hand FROM location_stock WHERE variant_id = ? AND location_id = ?`, b.variantId, loc);
    return r?.on_hand ?? 0;
  };
  const applyStock = async (loc: string, delta: number): Promise<void> => {
    if (loc === def) {
      await run(c.var.db, `UPDATE inventory_items SET on_hand = MAX(0, on_hand + ?), updated_at = datetime('now') WHERE variant_id = ?`, delta, b.variantId);
    } else {
      await run(
        c.var.db,
        `INSERT INTO location_stock (id, variant_id, location_id, on_hand) VALUES (?, ?, ?, MAX(0, ?))
         ON CONFLICT(variant_id, location_id) DO UPDATE SET on_hand = MAX(0, on_hand + ?), updated_at = datetime('now')`,
        newId("ls"),
        b.variantId,
        loc,
        Math.max(0, delta),
        delta,
      );
    }
  };

  if ((await readStock(b.fromLocationId)) < qty)
    return c.json({ error: "Not enough stock at the source location." }, 400);

  await applyStock(b.fromLocationId, -qty);
  await applyStock(b.toLocationId, qty);
  await run(
    c.var.db,
    `INSERT INTO stock_transfers (id, variant_id, from_location_id, to_location_id, quantity, note, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    newId("xfer"),
    b.variantId,
    b.fromLocationId,
    b.toLocationId,
    qty,
    (b.note ?? "").slice(0, 300) || null,
    c.var.userId,
  );
  await writeAudit(c.var.db, c.var.userId, "stock.transfer", "product_variant", b.variantId, {
    from: b.fromLocationId,
    to: b.toLocationId,
    qty,
  });
  return c.json({ ok: true });
});
