import { Hono } from "hono";
import { all, first, run, writeAudit } from "../services/db";
import {
  costSheetCreateSchema,
  costSheetUpdateSchema,
  dutyRuleUpdateSchema,
  parseBody,
  scenarioCreateSchema,
} from "../services/validators";
import { requireAdminWrite } from "../middleware/auth";
import { newId } from "../utils/id";
import type { AppContext } from "../types/env";
import type { AdminCostSheet, AdminDutyRule, AdminLandedCostScenario } from "../../shared/types";

export const adminCostingRoutes = new Hono<AppContext>();

function totalCost(row: Record<string, unknown>): number {
  const keys = [
    "fabric_cost_cents",
    "trim_cost_cents",
    "cut_sew_make_cents",
    "sample_allocation_cents",
    "packaging_cents",
    "freight_cents",
    "insurance_cents",
    "duty_cents",
    "payment_processing_cents",
    "returns_reserve_cents",
  ];
  return keys.reduce((sum, k) => sum + ((row[k] as number) ?? 0), 0);
}

function mapScenario(row: Record<string, unknown>): AdminLandedCostScenario {
  return {
    id: row.id as string,
    name: row.name as string,
    destinationRegion: row.destination_region as string,
    dutyRateUsed: row.duty_rate_used as number,
    landedCostCents: (row.landed_cost_cents as number) ?? null,
    retailPriceCents: (row.retail_price_cents as number) ?? null,
    grossMarginPct: (row.gross_margin_pct as number) ?? null,
    notes: (row.notes as string) ?? null,
  };
}

adminCostingRoutes.get("/cost-sheets", async (c) => {
  const rows = await all<Record<string, unknown>>(
    c.var.db,
    `SELECT cs.*, s.name AS style_name FROM cost_sheets cs
     JOIN styles s ON s.id = cs.style_id ORDER BY cs.updated_at DESC`,
  );
  const sheets: AdminCostSheet[] = [];
  for (const row of rows) {
    const scenarios = await all<Record<string, unknown>>(
      c.var.db,
      `SELECT * FROM landed_cost_scenarios WHERE cost_sheet_id = ? ORDER BY name`,
      row.id,
    );
    const total = totalCost(row);
    const retail = (row.actual_retail_cents as number) ?? (row.target_retail_cents as number);
    sheets.push({
      id: row.id as string,
      styleId: row.style_id as string,
      styleName: row.style_name as string,
      name: row.name as string,
      currency: row.currency as string,
      fabricCostCents: row.fabric_cost_cents as number,
      trimCostCents: row.trim_cost_cents as number,
      cutSewMakeCents: row.cut_sew_make_cents as number,
      sampleAllocationCents: row.sample_allocation_cents as number,
      packagingCents: row.packaging_cents as number,
      freightCents: row.freight_cents as number,
      insuranceCents: row.insurance_cents as number,
      dutyCents: row.duty_cents as number,
      paymentProcessingCents: row.payment_processing_cents as number,
      returnsReserveCents: row.returns_reserve_cents as number,
      targetRetailCents: (row.target_retail_cents as number) ?? null,
      actualRetailCents: (row.actual_retail_cents as number) ?? null,
      totalCostCents: total,
      grossMarginPct: retail ? Math.round((1 - total / retail) * 1000) / 10 : null,
      scenarios: scenarios.map(mapScenario),
    });
  }
  return c.json(sheets);
});

adminCostingRoutes.post("/cost-sheets", requireAdminWrite, async (c) => {
  const body = await parseBody(c, costSheetCreateSchema);
  const style = await first<{ id: string; name: string }>(
    c.var.db,
    `SELECT id, name FROM styles WHERE id = ?`,
    body.styleId,
  );
  if (!style) return c.json({ error: "Style not found" }, 404);
  const id = newId("cost");
  await run(
    c.var.db,
    `INSERT INTO cost_sheets (id, style_id, name, wholesale_price_cents) VALUES (?, ?, ?, ?)`,
    id,
    style.id,
    body.name ?? `${style.name} costing`,
    body.wholesalePriceCents ?? null,
  );
  await writeAudit(c.var.db, c.var.userId, "cost_sheet.create", "cost_sheet", id, {
    styleId: style.id,
  });
  return c.json({ id }, 201);
});

/**
 * Destination scenarios: duty is charged on production cost + freight to
 * that market, so the scenario carries its own freight/insurance and the
 * sheet's freight/insurance/duty columns are excluded from the base.
 */
adminCostingRoutes.post("/cost-sheets/:id/scenarios", requireAdminWrite, async (c) => {
  const sheetId = c.req.param("id");
  const body = await parseBody(c, scenarioCreateSchema);
  const sheet = await first<Record<string, unknown>>(
    c.var.db,
    `SELECT * FROM cost_sheets WHERE id = ?`,
    sheetId,
  );
  if (!sheet) return c.json({ error: "Cost sheet not found" }, 404);

  const baseProductionCents =
    ((sheet.fabric_cost_cents as number) ?? 0) +
    ((sheet.trim_cost_cents as number) ?? 0) +
    ((sheet.cut_sew_make_cents as number) ?? 0) +
    ((sheet.sample_allocation_cents as number) ?? 0) +
    ((sheet.packaging_cents as number) ?? 0) +
    ((sheet.payment_processing_cents as number) ?? 0) +
    ((sheet.returns_reserve_cents as number) ?? 0);
  const rate = body.dutyRatePct / 100;
  const freight = body.freightCents ?? 0;
  const insurance = body.insuranceCents ?? 0;
  const duty = Math.round((baseProductionCents + freight) * rate);
  const landed = baseProductionCents + freight + insurance + duty;
  const retail = body.retailPriceCents ?? null;
  const margin = retail ? Math.round((1 - landed / retail) * 1000) / 10 : null;

  const id = newId("lcs");
  await run(
    c.var.db,
    `INSERT INTO landed_cost_scenarios
       (id, cost_sheet_id, name, destination_region, duty_rate_used, freight_cents,
        insurance_cents, landed_cost_cents, retail_price_cents, gross_margin_pct, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    sheetId,
    body.name,
    body.destinationRegion,
    rate,
    freight,
    insurance,
    landed,
    retail,
    margin,
    body.notes ?? null,
  );
  await writeAudit(c.var.db, c.var.userId, "landed_scenario.create", "cost_sheet", sheetId, {
    name: body.name,
    region: body.destinationRegion,
  });
  return c.json({ id, landedCostCents: landed, grossMarginPct: margin }, 201);
});

adminCostingRoutes.delete("/scenarios/:id", requireAdminWrite, async (c) => {
  const result = await run(
    c.var.db,
    `DELETE FROM landed_cost_scenarios WHERE id = ?`,
    c.req.param("id"),
  );
  if (!result.meta.changes) return c.json({ error: "Scenario not found" }, 404);
  return c.json({ ok: true });
});

adminCostingRoutes.patch("/cost-sheets/:id", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  const body = await parseBody(c, costSheetUpdateSchema);
  const existing = await first(c.var.db, `SELECT id FROM cost_sheets WHERE id = ?`, id);
  if (!existing) return c.json({ error: "Cost sheet not found" }, 404);

  const fieldMap: Record<string, string> = {
    name: "name",
    fabricCostCents: "fabric_cost_cents",
    trimCostCents: "trim_cost_cents",
    cutSewMakeCents: "cut_sew_make_cents",
    sampleAllocationCents: "sample_allocation_cents",
    packagingCents: "packaging_cents",
    freightCents: "freight_cents",
    insuranceCents: "insurance_cents",
    dutyCents: "duty_cents",
    paymentProcessingCents: "payment_processing_cents",
    returnsReserveCents: "returns_reserve_cents",
    targetRetailCents: "target_retail_cents",
    actualRetailCents: "actual_retail_cents",
    notes: "notes",
  };
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [key, col] of Object.entries(fieldMap)) {
    if (key in body) {
      sets.push(`${col} = ?`);
      params.push((body as Record<string, unknown>)[key] ?? null);
    }
  }
  if (sets.length === 0) return c.json({ error: "No fields to update" }, 400);
  sets.push(`updated_at = datetime('now')`);
  await run(c.var.db, `UPDATE cost_sheets SET ${sets.join(", ")} WHERE id = ?`, ...params, id);
  await writeAudit(c.var.db, c.var.userId, "cost_sheet.update", "cost_sheet", id, body);
  return c.json({ ok: true });
});

adminCostingRoutes.get("/duty-rules", async (c) => {
  const rows = await all<Record<string, unknown>>(
    c.var.db,
    `SELECT * FROM duty_rules ORDER BY destination_region, is_preferential DESC`,
  );
  const rules: AdminDutyRule[] = rows.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    destinationRegion: r.destination_region as string,
    originCountry: r.origin_country as string,
    hsCategory: (r.hs_category as string) ?? null,
    qualifiesCondition: (r.qualifies_condition as string) ?? null,
    dutyRateMin: r.duty_rate_min as number,
    dutyRateMax: r.duty_rate_max as number,
    isPreferential: Boolean(r.is_preferential),
    isActive: Boolean(r.is_active),
    disclaimer: r.disclaimer as string,
  }));
  return c.json(rules);
});

adminCostingRoutes.patch("/duty-rules/:id", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  const body = await parseBody(c, dutyRuleUpdateSchema);
  const existing = await first(c.var.db, `SELECT id FROM duty_rules WHERE id = ?`, id);
  if (!existing) return c.json({ error: "Duty rule not found" }, 404);
  const sets: string[] = [];
  const params: unknown[] = [];
  if (body.name !== undefined) {
    sets.push(`name = ?`);
    params.push(body.name);
  }
  if (body.qualifiesCondition !== undefined) {
    sets.push(`qualifies_condition = ?`);
    params.push(body.qualifiesCondition);
  }
  if (body.dutyRateMin !== undefined) {
    sets.push(`duty_rate_min = ?`);
    params.push(body.dutyRateMin);
  }
  if (body.dutyRateMax !== undefined) {
    sets.push(`duty_rate_max = ?`);
    params.push(body.dutyRateMax);
  }
  if (body.isActive !== undefined) {
    sets.push(`is_active = ?`);
    params.push(body.isActive ? 1 : 0);
  }
  if (sets.length === 0) return c.json({ error: "No fields to update" }, 400);
  sets.push(`updated_at = datetime('now')`);
  await run(c.var.db, `UPDATE duty_rules SET ${sets.join(", ")} WHERE id = ?`, ...params, id);
  await writeAudit(c.var.db, c.var.userId, "duty_rule.update", "duty_rule", id, body);
  return c.json({ ok: true });
});

adminCostingRoutes.get("/margin-targets", async (c) => {
  const rows = await all(
    c.var.db,
    `SELECT id, channel, category, target_gross_margin_pct, floor_gross_margin_pct, notes FROM margin_targets`,
  );
  return c.json(rows);
});

/**
 * Landed-cost estimator: given a base cost and destination, apply the active
 * duty rules for that region and return per-rule estimates.
 * ESTIMATES ONLY — surfaced with the rule's disclaimer, never legal advice.
 */
adminCostingRoutes.get("/estimate", async (c) => {
  const region = c.req.query("region") ?? "EU";
  const baseCents = parseInt(c.req.query("baseCents") ?? "0", 10);
  const freightCents = parseInt(c.req.query("freightCents") ?? "0", 10);
  if (!Number.isFinite(baseCents) || baseCents <= 0) {
    return c.json({ error: "baseCents must be a positive integer" }, 400);
  }
  const rules = await all<Record<string, unknown>>(
    c.var.db,
    `SELECT * FROM duty_rules WHERE destination_region = ? AND is_active = 1`,
    region,
  );
  const estimates = rules.map((r) => {
    const dutiable = baseCents + freightCents;
    const min = Math.round(dutiable * (r.duty_rate_min as number));
    const max = Math.round(dutiable * (r.duty_rate_max as number));
    return {
      ruleId: r.id,
      ruleName: r.name,
      qualifiesCondition: r.qualifies_condition,
      dutyMinCents: min,
      dutyMaxCents: max,
      landedMinCents: dutiable + min,
      landedMaxCents: dutiable + max,
      disclaimer: r.disclaimer,
    };
  });
  return c.json({ region, baseCents, freightCents, estimates });
});
