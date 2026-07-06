import { Hono } from "hono";
import { all, first, run, writeAudit } from "../services/db";
import { requireAdminWrite } from "../middleware/auth";
import { newId } from "../utils/id";
import { GARMENT_LIBRARY } from "../../shared/garments";
import type { AppContext } from "../types/env";

/**
 * 3D Fitting Room — saved looks. A look is a base garment + fabric + colour +
 * fit config, optionally tied to a Style. The garment library itself ships in
 * the client (src/shared/garments.ts); this only persists a shop's saved
 * configurations. Per-shop DB (c.var.db).
 */
export const adminFittingRoutes = new Hono<AppContext>();

interface LookRow {
  id: string;
  name: string;
  garment_id: string;
  fabric_id: string;
  color: string | null;
  fit_json: string;
  style_id: string | null;
  style_name: string | null;
  created_at: string;
  updated_at: string;
}

function mapLook(r: LookRow) {
  let fit: unknown = {};
  try {
    fit = JSON.parse(r.fit_json || "{}");
  } catch {
    fit = {};
  }
  return {
    id: r.id,
    name: r.name,
    garmentId: r.garment_id,
    fabricId: r.fabric_id,
    color: r.color,
    fit,
    styleId: r.style_id,
    styleName: r.style_name,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const LOOK_SELECT = `
  SELECT l.*, s.name AS style_name FROM fitting_looks l
  LEFT JOIN styles s ON s.id = l.style_id`;

adminFittingRoutes.get("/looks", async (c) => {
  try {
    const rows = await all<LookRow>(c.var.db, `${LOOK_SELECT} ORDER BY l.updated_at DESC`);
    return c.json(rows.map(mapLook));
  } catch {
    // Table not migrated on this shop DB yet — no looks to show.
    return c.json([]);
  }
});

adminFittingRoutes.post("/looks", requireAdminWrite, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    name?: string;
    garmentId?: string;
    fabricId?: string;
    color?: string;
    fit?: unknown;
    styleId?: string | null;
  };
  const garment = GARMENT_LIBRARY.find((g) => g.id === body.garmentId);
  if (!garment) return c.json({ error: "Unknown garment" }, 400);
  const name = (body.name || "").trim() || `${garment.name} look`;
  const id = newId("look");
  await run(
    c.var.db,
    `INSERT INTO fitting_looks (id, name, garment_id, fabric_id, color, fit_json, style_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    id,
    name.slice(0, 120),
    garment.id,
    (body.fabricId || garment.defaultFabric).slice(0, 60),
    typeof body.color === "string" ? body.color.slice(0, 16) : null,
    JSON.stringify(body.fit ?? {}).slice(0, 2000),
    body.styleId || null,
  );
  const row = await first<LookRow>(c.var.db, `${LOOK_SELECT} WHERE l.id = ?`, id);
  return c.json(mapLook(row!), 201);
});

adminFittingRoutes.delete("/looks/:id", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  const result = await run(c.var.db, `DELETE FROM fitting_looks WHERE id = ?`, id);
  if (!result.meta.changes) return c.json({ error: "Look not found" }, 404);
  await writeAudit(c.var.db, c.var.userId, "fitting_look.delete", "fitting_look", id, {});
  return c.json({ ok: true });
});
