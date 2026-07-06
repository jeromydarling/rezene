import { Hono } from "hono";
import { all, first, run, writeAudit } from "../services/db";
import { requireAdminWrite } from "../middleware/auth";
import { newId } from "../utils/id";
import { GARMENT_LIBRARY, SIZE_STEPS } from "../../shared/garments";
import { FABRIC_LIBRARY } from "../../shared/fabrics";
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

/**
 * Design → spec. A Design2GarmentCode-style loop on our own clean stack: the
 * LLM reads a plain-language description and answers a fixed, multiple-choice
 * design vocabulary (garment + proportions + fabric + colour). We validate and
 * clamp everything to known values, so the model can only ever pick from the
 * catalogue — never freehand invalid output. The client applies the spec to
 * both the 3D preview and the real FreeSewing pattern.
 */
adminFittingRoutes.post("/design", requireAdminWrite, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { prompt?: string };
  const prompt = (body.prompt || "").trim();
  if (!prompt) return c.json({ error: "Describe the garment you want." }, 400);

  const garments = GARMENT_LIBRARY.map((g) => `${g.id} (${g.name}, ${g.category})`).join("; ");
  const fabrics = FABRIC_LIBRARY.map((f) => `${f.id} (${f.name})`).join("; ");
  const system =
    `You translate a plain-language garment description into a structured design spec for a stylized fitting studio. ` +
    `Pick the closest base garment and set its proportions using ONLY the given options. ` +
    `Respond with ONLY JSON: {"garmentId": one of [${GARMENT_LIBRARY.map((g) => g.id).join(", ")}], ` +
    `"size": one of [XS,S,M,L,XL,XXL] (default M), ` +
    `"ease": number (0.82 slim, 1.0 regular, 1.18 relaxed, 1.42 oversized), ` +
    `"length": number 0.85-1.2 (1.0 standard, lower=cropped, higher=longer), ` +
    `"sleeve": number 0-1.3 (0 sleeveless, 0.5 short, 1.0 long; ignored if the garment has no sleeves), ` +
    `"fabricId": one of the fabric ids, "color": a hex colour like "#3b5b7a", ` +
    `"rationale": one short sentence explaining the choices}. ` +
    `Base garments: ${garments}. Fabrics: ${fabrics}.`;

  try {
    const { aiComplete } = await import("../services/ai");
    const { parseModelJson } = await import("../services/anthropic");
    const out = await aiComplete(c.env, { system, prompt, maxTokens: 500 });
    const p = (parseModelJson(out.text) ?? {}) as Record<string, unknown>;

    const g = GARMENT_LIBRARY.find((x) => x.id === p.garmentId) ?? GARMENT_LIBRARY[0];
    const size = (SIZE_STEPS as readonly string[]).includes(p.size as string) ? (p.size as string) : "M";
    const clamp = (n: unknown, lo: number, hi: number, d: number) => {
      const v = Number(n);
      return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;
    };
    const fabricId = FABRIC_LIBRARY.find((f) => f.id === p.fabricId)?.id ?? g.defaultFabric;
    const color =
      typeof p.color === "string" && /^#[0-9a-fA-F]{6}$/.test(p.color) ? p.color : undefined;

    return c.json({
      garmentId: g.id,
      fit: {
        size,
        ease: clamp(p.ease, 0.7, 1.5, 1.0),
        length: clamp(p.length, 0.8, 1.2, 1.0),
        sleeve: clamp(p.sleeve, 0, 1.3, 1.0),
      },
      fabricId,
      color,
      rationale: typeof p.rationale === "string" ? p.rationale.slice(0, 240) : "",
    });
  } catch {
    return c.json({ error: "Couldn't interpret that — try describing it a bit differently." }, 502);
  }
});

adminFittingRoutes.delete("/looks/:id", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  const result = await run(c.var.db, `DELETE FROM fitting_looks WHERE id = ?`, id);
  if (!result.meta.changes) return c.json({ error: "Look not found" }, 404);
  await writeAudit(c.var.db, c.var.userId, "fitting_look.delete", "fitting_look", id, {});
  return c.json({ ok: true });
});
