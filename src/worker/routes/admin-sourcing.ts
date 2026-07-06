import { Hono } from "hono";
import { first, run, writeAudit } from "../services/db";
import { parseBody, sourcingAddSchema, sourcingSearchSchema } from "../services/validators";
import { requireAdminWrite } from "../middleware/auth";
import { newId } from "../utils/id";
import type { AppContext } from "../types/env";

/**
 * Sourcing — "find a maker". Deep web research (Perplexity) surfaces real
 * tailors / ateliers / small factories matching a brand's garment, materials,
 * location and style, returned as structured leads with citations. Adding a
 * lead creates an unverified supplier that flows into the normal Factories &
 * Suppliers → samples → PO pipeline.
 */
export const adminSourcingRoutes = new Hono<AppContext>();

adminSourcingRoutes.get("/config", async (c) => {
  const { perplexityConfigured } = await import("../services/perplexity");
  return c.json({ enabled: perplexityConfigured(c.env) });
});

// Live export/logistics intelligence for a trade lane (origin → destination),
// powered by Perplexity and cached in KV for a day (it's slow + costs money).
adminSourcingRoutes.get("/export-intel", async (c) => {
  const { perplexityConfigured, perplexityResearch } = await import("../services/perplexity");
  const origin = (c.req.query("origin") || "Morocco").trim().slice(0, 60);
  const destination = (c.req.query("destination") || "United States").trim().slice(0, 60);
  if (!perplexityConfigured(c.env)) {
    return c.json({ enabled: false });
  }
  const key = `xintel:${origin}:${destination}`.toLowerCase();
  const refresh = c.req.query("refresh") === "1";
  if (!refresh) {
    const cached = await c.env.KV.get(key);
    if (cached) return c.json({ enabled: true, cached: true, ...(JSON.parse(cached) as object) });
  }

  try {
    const research = await perplexityResearch(c.env, {
      system:
        "You are a fashion trade & logistics analyst. For shipping FINISHED APPAREL from the given origin to the given destination, give current, practical export intelligence. Respond with ONLY JSON: {\"agreement\":\"the trade agreement / tariff program that applies (or 'None')\",\"duties\":\"duty/tariff summary with concrete rates\",\"documents\":[\"required export & import documents\"],\"gotchas\":[\"non-obvious pitfalls — rules of origin (e.g. yarn-forward), quotas, certifications, de minimis thresholds, labeling\"],\"freight\":\"ballpark freight cost and transit time by air and by sea\",\"leadTime\":\"typical end-to-end logistics lead time\",\"asOf\":\"the time period this reflects\"}. Be concrete with numbers.",
      prompt: `Finished apparel export lane: ${origin} → ${destination}.`,
      maxTokens: 1300,
    });
    const { parseModelJson } = await import("../services/anthropic");
    let sections: Record<string, unknown> = {};
    try {
      const p = parseModelJson(research.text);
      if (p && typeof p === "object") sections = p as Record<string, unknown>;
    } catch {
      /* fall back to raw */
    }
    const payload = {
      origin,
      destination,
      sections,
      raw: Object.keys(sections).length ? null : research.text,
      citations: research.citations,
      updatedAt: null as string | null, // stamped by the client on display
    };
    await c.env.KV.put(key, JSON.stringify(payload), { expirationTtl: 86400 });
    return c.json({ enabled: true, cached: false, ...payload });
  } catch (err) {
    return c.json({ enabled: true, error: `Couldn't fetch export intel: ${String(err).slice(0, 160)}` }, 502);
  }
});

interface MakerLead {
  name: string;
  city?: string | null;
  country?: string | null;
  website?: string | null;
  email?: string | null;
  specialties?: string[];
  moqUnits?: number | null;
  leadTimeDays?: number | null;
  whyFit?: string | null;
}

adminSourcingRoutes.post("/search", requireAdminWrite, async (c) => {
  const { perplexityConfigured, perplexityResearch } = await import("../services/perplexity");
  if (!perplexityConfigured(c.env)) {
    return c.json({ error: "Maker sourcing isn't switched on yet.", code: "sourcing_unconfigured" }, 503);
  }
  const body = await parseBody(c, sourcingSearchSchema);
  const wants = [
    `Garment: ${body.garment}`,
    body.materials && `Materials: ${body.materials}`,
    body.moq && `Order quantity: ${body.moq}`,
    body.location && `Preferred location: ${body.location}`,
    body.style && `Aesthetic / style: ${body.style}`,
    body.notes && `Other: ${body.notes}`,
  ]
    .filter(Boolean)
    .join("\n");

  let leads: MakerLead[] = [];
  let citations: string[] = [];
  try {
    const research = await perplexityResearch(c.env, {
      system:
        "You are a fashion production sourcing scout. Find REAL, currently-operating clothing manufacturers, tailors, ateliers and small cut-and-sew studios that match the brief. Favor makers that take small/low-MOQ orders and emerging brands. Only include makers you can find evidence for. Respond with ONLY a JSON array (no prose) of up to 8 objects: {\"name\":\"\",\"city\":\"\",\"country\":\"\",\"website\":\"\",\"email\":null,\"specialties\":[\"\"],\"moqUnits\":null,\"leadTimeDays\":null,\"whyFit\":\"one sentence\"}. Use null when unknown.",
      prompt: `Find garment makers for this brief:\n${wants}`,
      maxTokens: 1800,
    });
    citations = research.citations;
    const { parseModelJson } = await import("../services/anthropic");
    const parsed = parseModelJson(research.text) as unknown;
    if (Array.isArray(parsed)) leads = parsed as MakerLead[];
    else if (parsed && typeof parsed === "object" && Array.isArray((parsed as { makers?: unknown[] }).makers)) {
      leads = (parsed as { makers: MakerLead[] }).makers;
    }
  } catch (err) {
    return c.json({ error: `Research failed: ${String(err).slice(0, 160)}` }, 502);
  }

  // Light normalization + guard.
  leads = leads
    .filter((l) => l && typeof l.name === "string" && l.name.trim())
    .slice(0, 8)
    .map((l) => ({
      name: String(l.name).slice(0, 200),
      city: l.city ?? null,
      country: l.country ?? null,
      website: l.website ?? null,
      email: l.email ?? null,
      specialties: Array.isArray(l.specialties) ? l.specialties.slice(0, 12).map((s) => String(s).slice(0, 60)) : [],
      moqUnits: typeof l.moqUnits === "number" ? l.moqUnits : null,
      leadTimeDays: typeof l.leadTimeDays === "number" ? l.leadTimeDays : null,
      whyFit: l.whyFit ? String(l.whyFit).slice(0, 400) : null,
    }));

  return c.json({ leads, citations });
});

adminSourcingRoutes.post("/add", requireAdminWrite, async (c) => {
  const body = await parseBody(c, sourcingAddSchema);
  const existing = await first<{ id: string }>(
    c.var.db,
    `SELECT id FROM suppliers WHERE lower(name) = lower(?)`,
    body.name,
  );
  if (existing) return c.json({ error: "That maker is already in your factories.", id: existing.id }, 409);

  const id = newId("sup");
  const notesParts = [
    body.whyFit,
    body.citations && body.citations.length ? `Sources:\n${body.citations.join("\n")}` : "",
  ].filter(Boolean);
  await run(
    c.var.db,
    `INSERT INTO suppliers (id, name, kind, city, country, email, website, capabilities, moq_units, lead_time_days, is_verified, notes)
     VALUES (?, ?, 'factory', ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    id,
    body.name,
    body.city ?? null,
    body.country ?? null,
    body.email ?? null,
    body.website ?? null,
    JSON.stringify(body.specialties ?? []),
    body.moqUnits ?? null,
    body.leadTimeDays ?? null,
    notesParts.join("\n\n") || "Sourced via Verto maker research — unverified lead.",
  );
  await writeAudit(c.var.db, c.var.userId, "sourcing.add_supplier", "supplier", id, { name: body.name });
  return c.json({ id }, 201);
});
