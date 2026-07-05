import { Hono } from "hono";
import { all, first, run, writeAudit } from "../services/db";
import {
  colorwayCreateSchema,
  parseBody,
  skuCreateSchema,
  styleCreateSchema,
  styleUpdateSchema,
} from "../services/validators";
import { requireAdminWrite } from "../middleware/auth";
import { newId } from "../utils/id";
import type { AppContext } from "../types/env";
import type { AdminColorway, AdminSku, AdminStyle } from "../../shared/types";

export const adminStyleRoutes = new Hono<AppContext>();

const STYLE_SELECT = `
  SELECT s.*, c.name AS collection_name,
    (SELECT COUNT(*) FROM skus k WHERE k.style_id = s.id) AS sku_count,
    EXISTS (SELECT 1 FROM tech_packs tp WHERE tp.style_id = s.id) AS has_tech_pack
  FROM styles s
  LEFT JOIN collections c ON c.id = s.collection_id`;

function mapStyle(row: Record<string, unknown>): AdminStyle {
  return {
    id: row.id as string,
    styleCode: row.style_code as string,
    name: row.name as string,
    category: row.category as string,
    gender: row.gender as string,
    season: (row.season as string) ?? null,
    collectionId: (row.collection_id as string) ?? null,
    collectionName: (row.collection_name as string) ?? null,
    status: row.status as string,
    description: (row.description as string) ?? null,
    fitNotes: (row.fit_notes as string) ?? null,
    fabricSummary: (row.fabric_summary as string) ?? null,
    targetCostCents: (row.target_cost_cents as number) ?? null,
    targetRetailCents: (row.target_retail_cents as number) ?? null,
    currency: row.currency as string,
    skuCount: (row.sku_count as number) ?? 0,
    hasTechPack: Boolean(row.has_tech_pack),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

adminStyleRoutes.get("/", async (c) => {
  const status = c.req.query("status");
  const params: unknown[] = [];
  let where = "";
  if (status) {
    where = `WHERE s.status = ?`;
    params.push(status);
  }
  const rows = await all(c.var.db, `${STYLE_SELECT} ${where} ORDER BY s.style_code`, ...params);
  return c.json(rows.map(mapStyle));
});

adminStyleRoutes.get("/:id", async (c) => {
  const row = await first(c.var.db, `${STYLE_SELECT} WHERE s.id = ?`, c.req.param("id"));
  if (!row) return c.json({ error: "Style not found" }, 404);

  const colorways = await all<Record<string, unknown>>(
    c.var.db,
    `SELECT id, style_id, name, color_code, is_primary FROM colorways WHERE style_id = ? ORDER BY sort_order`,
    row.id,
  );
  const skus = await all<Record<string, unknown>>(
    c.var.db,
    `SELECT k.id, k.sku_code, k.style_id, k.size, k.status, cw.name AS colorway_name
     FROM skus k LEFT JOIN colorways cw ON cw.id = k.colorway_id
     WHERE k.style_id = ? ORDER BY k.sku_code`,
    row.id,
  );
  return c.json({
    ...mapStyle(row),
    colorways: colorways.map(mapColorway),
    skus: skus.map((k) => mapSku(k, row.name as string)),
  });
});

adminStyleRoutes.post("/", requireAdminWrite, async (c) => {
  const body = await parseBody(c, styleCreateSchema);
  const id = newId("sty");
  await run(
    c.var.db,
    `INSERT INTO styles (id, style_code, name, category, gender, season, collection_id, status,
       description, fit_notes, fabric_summary, target_cost_cents, target_retail_cents)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    body.styleCode,
    body.name,
    body.category,
    body.gender,
    body.season ?? null,
    body.collectionId ?? null,
    body.status ?? "concept",
    body.description ?? null,
    body.fitNotes ?? null,
    body.fabricSummary ?? null,
    body.targetCostCents ?? null,
    body.targetRetailCents ?? null,
  );
  await writeAudit(c.var.db, c.var.userId, "style.create", "style", id, { name: body.name });
  const row = await first(c.var.db, `${STYLE_SELECT} WHERE s.id = ?`, id);
  return c.json(mapStyle(row!), 201);
});

adminStyleRoutes.patch("/:id", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  const body = await parseBody(c, styleUpdateSchema);
  const existing = await first(c.var.db, `SELECT id FROM styles WHERE id = ?`, id);
  if (!existing) return c.json({ error: "Style not found" }, 404);

  const sets: string[] = [];
  const params: unknown[] = [];
  const fieldMap: Record<string, string> = {
    styleCode: "style_code",
    name: "name",
    category: "category",
    gender: "gender",
    season: "season",
    collectionId: "collection_id",
    status: "status",
    description: "description",
    fitNotes: "fit_notes",
    fabricSummary: "fabric_summary",
    targetCostCents: "target_cost_cents",
    targetRetailCents: "target_retail_cents",
  };
  for (const [key, col] of Object.entries(fieldMap)) {
    if (key in body) {
      sets.push(`${col} = ?`);
      params.push((body as Record<string, unknown>)[key] ?? null);
    }
  }
  if (sets.length === 0) return c.json({ error: "No fields to update" }, 400);
  sets.push(`updated_at = datetime('now')`);
  await run(c.var.db, `UPDATE styles SET ${sets.join(", ")} WHERE id = ?`, ...params, id);
  await writeAudit(c.var.db, c.var.userId, "style.update", "style", id, body);
  const row = await first(c.var.db, `${STYLE_SELECT} WHERE s.id = ?`, id);
  return c.json(mapStyle(row!));
});

adminStyleRoutes.post("/:id/colorways", requireAdminWrite, async (c) => {
  const styleId = c.req.param("id");
  const body = await parseBody(c, colorwayCreateSchema);
  const style = await first(c.var.db, `SELECT id FROM styles WHERE id = ?`, styleId);
  if (!style) return c.json({ error: "Style not found" }, 404);
  const id = newId("cw");
  await run(
    c.var.db,
    `INSERT INTO colorways (id, style_id, name, color_code, is_primary) VALUES (?, ?, ?, ?, ?)`,
    id,
    styleId,
    body.name,
    body.colorCode ?? null,
    body.isPrimary ? 1 : 0,
  );
  return c.json({ id }, 201);
});

// SKU master (flat list across styles)
adminStyleRoutes.get("/skus/all", async (c) => {
  const rows = await all<Record<string, unknown>>(
    c.var.db,
    `SELECT k.id, k.sku_code, k.style_id, k.size, k.status,
            cw.name AS colorway_name, s.name AS style_name
     FROM skus k
     JOIN styles s ON s.id = k.style_id
     LEFT JOIN colorways cw ON cw.id = k.colorway_id
     ORDER BY k.sku_code`,
  );
  return c.json(rows.map((k) => mapSku(k, k.style_name as string)));
});

adminStyleRoutes.post("/skus", requireAdminWrite, async (c) => {
  const body = await parseBody(c, skuCreateSchema);
  const style = await first(c.var.db, `SELECT id FROM styles WHERE id = ?`, body.styleId);
  if (!style) return c.json({ error: "Style not found" }, 404);
  const id = newId("sku");
  await run(
    c.var.db,
    `INSERT INTO skus (id, sku_code, style_id, colorway_id, size) VALUES (?, ?, ?, ?, ?)`,
    id,
    body.skuCode,
    body.styleId,
    body.colorwayId ?? null,
    body.size,
  );
  await writeAudit(c.var.db, c.var.userId, "sku.create", "sku", id, { skuCode: body.skuCode });
  return c.json({ id }, 201);
});

function mapColorway(row: Record<string, unknown>): AdminColorway {
  return {
    id: row.id as string,
    styleId: row.style_id as string,
    name: row.name as string,
    colorCode: (row.color_code as string) ?? null,
    isPrimary: Boolean(row.is_primary),
  };
}

function mapSku(row: Record<string, unknown>, styleName: string): AdminSku {
  return {
    id: row.id as string,
    skuCode: row.sku_code as string,
    styleId: row.style_id as string,
    styleName,
    colorwayName: (row.colorway_name as string) ?? null,
    size: row.size as string,
    status: row.status as string,
  };
}
