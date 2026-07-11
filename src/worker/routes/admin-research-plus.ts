import { Hono } from "hono";
import { all, first, run, writeAudit } from "../services/db";
import { requireAdminWrite } from "../middleware/auth";
import { reserveResearchQuota, quotaExceededBody, peekResearchQuota } from "../services/ai-quota";
import { newId } from "../utils/id";
import { emit } from "../services/activity";
import { softDelete } from "../services/tombstone";
import type { AppContext } from "../types/env";

/**
 * R&D beyond sourcing: brand dossiers (competition research), price studies
 * (comps + bands that flow into Costing & Margins), trend & fabric scouting
 * (briefs that hand off to the Design Studio), and stockist research (the
 * wholesale pipeline). Mounted alongside admin-research.ts under the same
 * /api/admin/research prefix — together they make R&D its own studio.
 *
 * Live research always lands WITH citations and draws from the shared
 * per-shop daily quota. Everything degrades to a plain notebook when
 * Perplexity isn't configured.
 */
export const adminResearchPlusRoutes = new Hono<AppContext>();

const s = (v: unknown, max = 400): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
};

const cents = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
};

const parseArr = (v: string | null): string[] => {
  try {
    const a = JSON.parse(v || "[]");
    return Array.isArray(a) ? a.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
};

// ---- Overview (the R&D home) -----------------------------------------------

adminResearchPlusRoutes.get("/overview", async (c) => {
  const db = c.var.db;
  const count = async (table: string): Promise<number> => {
    try {
      const row = await first<{ n: number }>(db, `SELECT COUNT(*) AS n FROM ${table}`);
      return row?.n ?? 0;
    } catch {
      return 0; // table not migrated on this shop DB yet
    }
  };
  const [makers, notes, brands, studies, boards, stockists] = await Promise.all([
    count("research_makers"),
    count("research_notes"),
    count("research_brands"),
    count("price_studies"),
    count("trend_boards"),
    count("research_stockists"),
  ]);
  let watched: { kind: string; id: string; name: string; lastResearchedAt: string | null }[] = [];
  try {
    const wb = await all<{ id: string; name: string; last_researched_at: string | null }>(
      db,
      `SELECT id, name, last_researched_at FROM research_brands WHERE watch = 1 ORDER BY name LIMIT 20`,
    );
    const wt = await all<{ id: string; title: string; last_researched_at: string | null }>(
      db,
      `SELECT id, title, last_researched_at FROM trend_boards WHERE watch = 1 ORDER BY title LIMIT 20`,
    );
    watched = [
      ...wb.map((b) => ({ kind: "brand", id: b.id, name: b.name, lastResearchedAt: b.last_researched_at })),
      ...wt.map((t) => ({ kind: "trend", id: t.id, name: t.title, lastResearchedAt: t.last_researched_at })),
    ];
  } catch {
    watched = [];
  }
  let recent: { kind: string; title: string; createdAt: string }[] = [];
  try {
    recent = (
      await all<{ kind: string; title: string; created_at: string }>(
        db,
        `SELECT kind, title, created_at FROM activity_events
         WHERE kind LIKE 'research.%' ORDER BY created_at DESC LIMIT 8`,
      )
    ).map((r) => ({ kind: r.kind, title: r.title, createdAt: r.created_at }));
  } catch {
    recent = [];
  }
  const { perplexityConfigured } = await import("../services/perplexity");
  const quota = await peekResearchQuota(c.env, c.var.shopId);
  return c.json({
    counts: { makers, notes, brands, priceStudies: studies, trendBoards: boards, stockists },
    watched,
    recent,
    research: { enabled: perplexityConfigured(c.env), used: quota.used, limit: quota.limit },
  });
});

// ---- Brand dossiers ---------------------------------------------------------

interface BrandRow {
  id: string;
  name: string;
  website: string | null;
  instagram: string | null;
  segment: string;
  positioning: string | null;
  price_floor_cents: number | null;
  price_ceiling_cents: number | null;
  currency: string;
  channels: string | null;
  dossier_md: string | null;
  citations: string | null;
  note: string | null;
  watch: number;
  last_researched_at: string | null;
  created_at: string;
  updated_at: string;
}

const SEGMENTS = ["direct", "aspirational", "adjacent"] as const;

function mapBrand(r: BrandRow, snapshots = 0) {
  return {
    id: r.id,
    name: r.name,
    website: r.website,
    instagram: r.instagram,
    segment: r.segment,
    positioning: r.positioning,
    priceFloorCents: r.price_floor_cents,
    priceCeilingCents: r.price_ceiling_cents,
    currency: r.currency,
    channels: parseArr(r.channels),
    dossierMd: r.dossier_md,
    citations: parseArr(r.citations),
    note: r.note,
    watch: Boolean(r.watch),
    lastResearchedAt: r.last_researched_at,
    snapshots,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

adminResearchPlusRoutes.get("/brands", async (c) => {
  try {
    const rows = await all<BrandRow & { snapshot_count: number }>(
      c.var.db,
      `SELECT b.*, (SELECT COUNT(*) FROM research_brand_snapshots s WHERE s.brand_id = b.id) AS snapshot_count
       FROM research_brands b
       ORDER BY b.watch DESC, b.name COLLATE NOCASE`,
    );
    return c.json(rows.map((r) => mapBrand(r, r.snapshot_count)));
  } catch {
    return c.json([]);
  }
});

adminResearchPlusRoutes.post("/brands", requireAdminWrite, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = s(body.name, 160);
  if (!name) return c.json({ error: "The brand needs a name." }, 400);
  const id = newId("rbrand");
  await run(
    c.var.db,
    `INSERT INTO research_brands (id, name, website, instagram, segment, positioning, note)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    id,
    name,
    s(body.website, 400),
    s(body.instagram, 120),
    (SEGMENTS as readonly string[]).includes(body.segment as string) ? (body.segment as string) : "direct",
    s(body.positioning, 400),
    s(body.note, 4000),
  );
  await writeAudit(c.var.db, c.var.userId, "research.add_brand", "research_brand", id, { name });
  const row = await first<BrandRow>(c.var.db, `SELECT * FROM research_brands WHERE id = ?`, id);
  return c.json(mapBrand(row!), 201);
});

adminResearchPlusRoutes.patch("/brands/:id", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (typeof body.name === "string" && body.name.trim()) {
    sets.push("name = ?");
    vals.push(body.name.trim().slice(0, 160));
  }
  for (const [key, col, max] of [
    ["website", "website", 400],
    ["instagram", "instagram", 120],
    ["positioning", "positioning", 400],
    ["note", "note", 4000],
  ] as const) {
    if (key in body) {
      sets.push(`${col} = ?`);
      vals.push(s(body[key], max));
    }
  }
  if ((SEGMENTS as readonly string[]).includes(body.segment as string)) {
    sets.push("segment = ?");
    vals.push(body.segment);
  }
  for (const [key, col] of [
    ["priceFloorCents", "price_floor_cents"],
    ["priceCeilingCents", "price_ceiling_cents"],
  ] as const) {
    if (key in body) {
      sets.push(`${col} = ?`);
      vals.push(cents(body[key]));
    }
  }
  if (Array.isArray(body.channels)) {
    sets.push("channels = ?");
    vals.push(JSON.stringify(body.channels.filter((x): x is string => typeof x === "string").slice(0, 8)));
  }
  if (typeof body.watch === "boolean") {
    sets.push("watch = ?");
    vals.push(body.watch ? 1 : 0);
  }
  if (!sets.length) return c.json({ error: "Nothing to update." }, 400);
  sets.push("updated_at = datetime('now')");
  await run(c.var.db, `UPDATE research_brands SET ${sets.join(", ")} WHERE id = ?`, ...vals, id);
  const row = await first<BrandRow>(c.var.db, `SELECT * FROM research_brands WHERE id = ?`, id);
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json(mapBrand(row));
});

adminResearchPlusRoutes.delete("/brands/:id", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  const row = await first<{ name: string }>(c.var.db, `SELECT name FROM research_brands WHERE id = ?`, id);
  const undoId = row ? await softDelete(c.var.db, "research_brands", id, `Deleted dossier “${row.name}”`) : null;
  if (!undoId) await run(c.var.db, `DELETE FROM research_brands WHERE id = ?`, id);
  return c.json({ ok: true, undoId });
});

adminResearchPlusRoutes.post("/brands/:id/research", requireAdminWrite, async (c) => {
  const { perplexityConfigured } = await import("../services/perplexity");
  if (!perplexityConfigured(c.env)) {
    return c.json({ error: "Live research isn't configured yet — the dossier still works as a notebook." }, 503);
  }
  const id = c.req.param("id");
  const row = await first<BrandRow>(c.var.db, `SELECT * FROM research_brands WHERE id = ?`, id);
  if (!row) return c.json({ error: "Not found" }, 404);
  const quota = await reserveResearchQuota(c);
  if (!quota.ok) return c.json(quotaExceededBody(quota), 429);
  try {
    const { researchBrand } = await import("../services/research-lab");
    await researchBrand(c.var.db, c.env, row);
    await writeAudit(c.var.db, c.var.userId, "research.brand_dossier", "research_brand", id, { name: row.name });
    const fresh = await first<BrandRow & { snapshot_count: number }>(
      c.var.db,
      `SELECT b.*, (SELECT COUNT(*) FROM research_brand_snapshots s WHERE s.brand_id = b.id) AS snapshot_count
       FROM research_brands b WHERE b.id = ?`,
      id,
    );
    return c.json(mapBrand(fresh!, fresh!.snapshot_count));
  } catch {
    return c.json({ error: "Research didn't come back — try again in a moment." }, 502);
  }
});

adminResearchPlusRoutes.get("/brands/:id/snapshots", async (c) => {
  const rows = await all<{ id: string; dossier_md: string; citations: string | null; created_at: string }>(
    c.var.db,
    `SELECT id, dossier_md, citations, created_at FROM research_brand_snapshots
     WHERE brand_id = ? ORDER BY created_at DESC LIMIT 20`,
    c.req.param("id"),
  );
  return c.json(rows.map((r) => ({ id: r.id, dossierMd: r.dossier_md, citations: parseArr(r.citations), createdAt: r.created_at })));
});

// ---- Price studies ----------------------------------------------------------

interface StudyRow {
  id: string;
  name: string;
  category: string | null;
  market: string | null;
  style_id: string | null;
  currency: string;
  band_low_cents: number | null;
  band_mid_cents: number | null;
  band_high_cents: number | null;
  recommendation_md: string | null;
  citations: string | null;
  status: string;
  last_researched_at: string | null;
  created_at: string;
  updated_at: string;
}

interface CompRow {
  id: string;
  study_id: string;
  brand: string;
  product: string | null;
  price_cents: number | null;
  currency: string;
  url: string | null;
  fabric: string | null;
  origin: string | null;
  note: string | null;
}

function mapStudy(r: StudyRow, comps: CompRow[]) {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    market: r.market,
    styleId: r.style_id,
    currency: r.currency,
    bandLowCents: r.band_low_cents,
    bandMidCents: r.band_mid_cents,
    bandHighCents: r.band_high_cents,
    recommendationMd: r.recommendation_md,
    citations: parseArr(r.citations),
    status: r.status,
    lastResearchedAt: r.last_researched_at,
    comps: comps.map((cp) => ({
      id: cp.id,
      brand: cp.brand,
      product: cp.product,
      priceCents: cp.price_cents,
      currency: cp.currency,
      url: cp.url,
      fabric: cp.fabric,
      origin: cp.origin,
      note: cp.note,
    })),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

adminResearchPlusRoutes.get("/pricing", async (c) => {
  try {
    const studies = await all<StudyRow>(
      c.var.db,
      `SELECT * FROM price_studies ORDER BY status ASC, updated_at DESC LIMIT 100`,
    );
    const comps = await all<CompRow>(
      c.var.db,
      `SELECT * FROM price_study_comps ORDER BY price_cents`,
    );
    const byStudy = new Map<string, CompRow[]>();
    for (const cp of comps) {
      const list = byStudy.get(cp.study_id) ?? [];
      list.push(cp);
      byStudy.set(cp.study_id, list);
    }
    return c.json(studies.map((st) => mapStudy(st, byStudy.get(st.id) ?? [])));
  } catch {
    return c.json([]);
  }
});

adminResearchPlusRoutes.post("/pricing", requireAdminWrite, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = s(body.name, 200);
  if (!name) return c.json({ error: "The study needs a name — usually the garment category." }, 400);
  const id = newId("pstudy");
  await run(
    c.var.db,
    `INSERT INTO price_studies (id, name, category, market, style_id, currency)
     VALUES (?, ?, ?, ?, ?, ?)`,
    id,
    name,
    s(body.category, 160),
    s(body.market, 160),
    s(body.styleId, 60),
    s(body.currency, 3)?.toUpperCase() ?? "USD",
  );
  await writeAudit(c.var.db, c.var.userId, "research.add_price_study", "price_study", id, { name });
  const row = await first<StudyRow>(c.var.db, `SELECT * FROM price_studies WHERE id = ?`, id);
  return c.json(mapStudy(row!, []), 201);
});

adminResearchPlusRoutes.patch("/pricing/:id", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (typeof body.name === "string" && body.name.trim()) {
    sets.push("name = ?");
    vals.push(body.name.trim().slice(0, 200));
  }
  for (const [key, col, max] of [
    ["category", "category", 160],
    ["market", "market", 160],
    ["styleId", "style_id", 60],
  ] as const) {
    if (key in body) {
      sets.push(`${col} = ?`);
      vals.push(s(body[key], max));
    }
  }
  for (const [key, col] of [
    ["bandLowCents", "band_low_cents"],
    ["bandMidCents", "band_mid_cents"],
    ["bandHighCents", "band_high_cents"],
  ] as const) {
    if (key in body) {
      sets.push(`${col} = ?`);
      vals.push(cents(body[key]));
    }
  }
  if (body.status === "open" || body.status === "decided") {
    sets.push("status = ?");
    vals.push(body.status);
  }
  if (!sets.length) return c.json({ error: "Nothing to update." }, 400);
  sets.push("updated_at = datetime('now')");
  await run(c.var.db, `UPDATE price_studies SET ${sets.join(", ")} WHERE id = ?`, ...vals, id);
  const row = await first<StudyRow>(c.var.db, `SELECT * FROM price_studies WHERE id = ?`, id);
  if (!row) return c.json({ error: "Not found" }, 404);
  const comps = await all<CompRow>(c.var.db, `SELECT * FROM price_study_comps WHERE study_id = ? ORDER BY price_cents`, id);
  return c.json(mapStudy(row, comps));
});

adminResearchPlusRoutes.delete("/pricing/:id", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  const row = await first<{ name: string }>(c.var.db, `SELECT name FROM price_studies WHERE id = ?`, id);
  const undoId = row ? await softDelete(c.var.db, "price_studies", id, `Deleted price study “${row.name}”`) : null;
  if (!undoId) await run(c.var.db, `DELETE FROM price_studies WHERE id = ?`, id);
  await run(c.var.db, `DELETE FROM price_study_comps WHERE study_id = ?`, id);
  return c.json({ ok: true, undoId });
});

adminResearchPlusRoutes.post("/pricing/:id/comps", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const brand = s(body.brand, 160);
  if (!brand) return c.json({ error: "The comparable needs a brand." }, 400);
  const compId = newId("pcomp");
  await run(
    c.var.db,
    `INSERT INTO price_study_comps (id, study_id, brand, product, price_cents, currency, url, fabric, origin, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    compId,
    id,
    brand,
    s(body.product, 240),
    cents(body.priceCents),
    s(body.currency, 3)?.toUpperCase() ?? "USD",
    s(body.url, 500),
    s(body.fabric, 160),
    s(body.origin, 120),
    s(body.note, 500),
  );
  await run(c.var.db, `UPDATE price_studies SET updated_at = datetime('now') WHERE id = ?`, id);
  return c.json({ id: compId }, 201);
});

adminResearchPlusRoutes.patch("/pricing/comps/:cid", requireAdminWrite, async (c) => {
  const cid = c.req.param("cid");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [key, col, max] of [
    ["brand", "brand", 160],
    ["product", "product", 240],
    ["url", "url", 500],
    ["fabric", "fabric", 160],
    ["origin", "origin", 120],
    ["note", "note", 500],
  ] as const) {
    if (key in body) {
      sets.push(`${col} = ?`);
      vals.push(s(body[key], max));
    }
  }
  if ("priceCents" in body) {
    sets.push("price_cents = ?");
    vals.push(cents(body.priceCents));
  }
  if (!sets.length) return c.json({ error: "Nothing to update." }, 400);
  await run(c.var.db, `UPDATE price_study_comps SET ${sets.join(", ")} WHERE id = ?`, ...vals, cid);
  return c.json({ ok: true });
});

adminResearchPlusRoutes.delete("/pricing/comps/:cid", requireAdminWrite, async (c) => {
  await run(c.var.db, `DELETE FROM price_study_comps WHERE id = ?`, c.req.param("cid"));
  return c.json({ ok: true });
});

adminResearchPlusRoutes.post("/pricing/:id/research", requireAdminWrite, async (c) => {
  const { perplexityConfigured } = await import("../services/perplexity");
  if (!perplexityConfigured(c.env)) {
    return c.json({ error: "Live research isn't configured yet — the comps table still works by hand." }, 503);
  }
  const id = c.req.param("id");
  const row = await first<StudyRow>(c.var.db, `SELECT * FROM price_studies WHERE id = ?`, id);
  if (!row) return c.json({ error: "Not found" }, 404);
  const quota = await reserveResearchQuota(c);
  if (!quota.ok) return c.json(quotaExceededBody(quota), 429);
  try {
    const { researchPriceStudy } = await import("../services/research-lab");
    await researchPriceStudy(c.var.db, c.env, row);
    await writeAudit(c.var.db, c.var.userId, "research.price_study", "price_study", id, { name: row.name });
    const fresh = await first<StudyRow>(c.var.db, `SELECT * FROM price_studies WHERE id = ?`, id);
    const comps = await all<CompRow>(c.var.db, `SELECT * FROM price_study_comps WHERE study_id = ? ORDER BY price_cents`, id);
    return c.json(mapStudy(fresh!, comps));
  } catch {
    return c.json({ error: "Research didn't come back — try again in a moment." }, 502);
  }
});

/** The handoff that makes a price study more than reading: push the decided
 *  target retail into the style's cost sheet (creating a starter sheet when
 *  the style has none), where margins take over. */
adminResearchPlusRoutes.post("/pricing/:id/apply-retail", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const styleId = s(body.styleId, 60);
  const retail = cents(body.cents);
  if (!styleId || !retail) return c.json({ error: "Pick a style and a target retail first." }, 400);
  const study = await first<StudyRow>(c.var.db, `SELECT * FROM price_studies WHERE id = ?`, id);
  if (!study) return c.json({ error: "Not found" }, 404);
  const style = await first<{ id: string; name: string }>(c.var.db, `SELECT id, name FROM styles WHERE id = ?`, styleId);
  if (!style) return c.json({ error: "That style doesn't exist." }, 404);

  let sheet = await first<{ id: string }>(
    c.var.db,
    `SELECT id FROM cost_sheets WHERE style_id = ? ORDER BY updated_at DESC LIMIT 1`,
    styleId,
  );
  if (sheet) {
    await run(
      c.var.db,
      `UPDATE cost_sheets SET target_retail_cents = ?, updated_at = datetime('now') WHERE id = ?`,
      retail,
      sheet.id,
    );
  } else {
    const sheetId = newId("cst");
    await run(
      c.var.db,
      `INSERT INTO cost_sheets (id, style_id, name, currency, target_retail_cents, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      sheetId,
      styleId,
      `${style.name} — costing`,
      study.currency,
      retail,
      `Target retail set from price study “${study.name}” — fill in the costs to see the margin.`,
    );
    sheet = { id: sheetId };
  }
  await run(
    c.var.db,
    `UPDATE price_studies SET status = 'decided', style_id = COALESCE(style_id, ?), updated_at = datetime('now') WHERE id = ?`,
    styleId,
    id,
  );
  await writeAudit(c.var.db, c.var.userId, "research.apply_retail", "cost_sheet", sheet.id, { studyId: id, retail });
  await emit(c.var.db, {
    kind: "research.retail_applied",
    entityType: "cost_sheet",
    entityId: sheet.id,
    title: `Target retail for ${style.name} set from the “${study.name}” price study`,
    payload: { styleId, retail, studyId: id },
  });
  return c.json({ costSheetId: sheet.id });
});

// ---- Trend boards -----------------------------------------------------------

interface BoardRow {
  id: string;
  title: string;
  season: string | null;
  focus: string;
  brief_md: string | null;
  citations: string | null;
  items: string | null;
  status: string;
  concept_id: string | null;
  watch: number;
  last_researched_at: string | null;
  created_at: string;
  updated_at: string;
}

const FOCUSES = ["silhouettes", "fabrics", "colors", "details", "market"] as const;
const BOARD_STATUSES = ["exploring", "adopted", "passed"] as const;

function mapBoard(r: BoardRow) {
  let items: { label: string; note?: string }[] = [];
  try {
    const a = JSON.parse(r.items || "[]");
    if (Array.isArray(a)) items = a.filter((x) => x && typeof x.label === "string");
  } catch {
    items = [];
  }
  return {
    id: r.id,
    title: r.title,
    season: r.season,
    focus: r.focus,
    briefMd: r.brief_md,
    citations: parseArr(r.citations),
    items,
    status: r.status,
    conceptId: r.concept_id,
    watch: Boolean(r.watch),
    lastResearchedAt: r.last_researched_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const cleanItems = (v: unknown): string =>
  JSON.stringify(
    (Array.isArray(v) ? v : [])
      .filter((x): x is { label: string; note?: unknown } => Boolean(x) && typeof (x as { label?: unknown }).label === "string" && Boolean((x as { label: string }).label.trim()))
      .map((x) => ({ label: x.label.trim().slice(0, 160), note: typeof x.note === "string" ? x.note.trim().slice(0, 400) : undefined }))
      .slice(0, 24),
  );

adminResearchPlusRoutes.get("/trends", async (c) => {
  try {
    const rows = await all<BoardRow>(
      c.var.db,
      `SELECT * FROM trend_boards ORDER BY
         CASE status WHEN 'exploring' THEN 0 WHEN 'adopted' THEN 1 ELSE 2 END, updated_at DESC LIMIT 100`,
    );
    return c.json(rows.map(mapBoard));
  } catch {
    return c.json([]);
  }
});

adminResearchPlusRoutes.post("/trends", requireAdminWrite, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const title = s(body.title, 200);
  if (!title) return c.json({ error: "The board needs a title." }, 400);
  const id = newId("tboard");
  await run(
    c.var.db,
    `INSERT INTO trend_boards (id, title, season, focus, items) VALUES (?, ?, ?, ?, ?)`,
    id,
    title,
    s(body.season, 40),
    (FOCUSES as readonly string[]).includes(body.focus as string) ? (body.focus as string) : "silhouettes",
    cleanItems(body.items),
  );
  await writeAudit(c.var.db, c.var.userId, "research.add_trend_board", "trend_board", id, { title });
  const row = await first<BoardRow>(c.var.db, `SELECT * FROM trend_boards WHERE id = ?`, id);
  return c.json(mapBoard(row!), 201);
});

adminResearchPlusRoutes.patch("/trends/:id", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (typeof body.title === "string" && body.title.trim()) {
    sets.push("title = ?");
    vals.push(body.title.trim().slice(0, 200));
  }
  if ("season" in body) {
    sets.push("season = ?");
    vals.push(s(body.season, 40));
  }
  if ((FOCUSES as readonly string[]).includes(body.focus as string)) {
    sets.push("focus = ?");
    vals.push(body.focus);
  }
  if ((BOARD_STATUSES as readonly string[]).includes(body.status as string)) {
    sets.push("status = ?");
    vals.push(body.status);
  }
  if ("items" in body) {
    sets.push("items = ?");
    vals.push(cleanItems(body.items));
  }
  if (typeof body.watch === "boolean") {
    sets.push("watch = ?");
    vals.push(body.watch ? 1 : 0);
  }
  if (typeof body.briefMd === "string") {
    sets.push("brief_md = ?");
    vals.push(body.briefMd.slice(0, 40000));
  }
  if (!sets.length) return c.json({ error: "Nothing to update." }, 400);
  sets.push("updated_at = datetime('now')");
  await run(c.var.db, `UPDATE trend_boards SET ${sets.join(", ")} WHERE id = ?`, ...vals, id);
  const row = await first<BoardRow>(c.var.db, `SELECT * FROM trend_boards WHERE id = ?`, id);
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json(mapBoard(row));
});

adminResearchPlusRoutes.delete("/trends/:id", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  const row = await first<{ title: string }>(c.var.db, `SELECT title FROM trend_boards WHERE id = ?`, id);
  const undoId = row ? await softDelete(c.var.db, "trend_boards", id, `Deleted trend board “${row.title}”`) : null;
  if (!undoId) await run(c.var.db, `DELETE FROM trend_boards WHERE id = ?`, id);
  return c.json({ ok: true, undoId });
});

adminResearchPlusRoutes.post("/trends/:id/research", requireAdminWrite, async (c) => {
  const { perplexityConfigured } = await import("../services/perplexity");
  if (!perplexityConfigured(c.env)) {
    return c.json({ error: "Live research isn't configured yet — the board still works as a notebook." }, 503);
  }
  const id = c.req.param("id");
  const row = await first<BoardRow>(c.var.db, `SELECT * FROM trend_boards WHERE id = ?`, id);
  if (!row) return c.json({ error: "Not found" }, 404);
  const quota = await reserveResearchQuota(c);
  if (!quota.ok) return c.json(quotaExceededBody(quota), 429);
  try {
    const { researchTrendBoard } = await import("../services/research-lab");
    await researchTrendBoard(c.var.db, c.env, row);
    await writeAudit(c.var.db, c.var.userId, "research.trend_brief", "trend_board", id, { title: row.title });
    const fresh = await first<BoardRow>(c.var.db, `SELECT * FROM trend_boards WHERE id = ?`, id);
    return c.json(mapBoard(fresh!));
  } catch {
    return c.json({ error: "Research didn't come back — try again in a moment." }, 502);
  }
});

/** Adopt a direction: the board becomes a Design Studio concept, brief
 *  attached, ready to generate from. */
adminResearchPlusRoutes.post("/trends/:id/to-design-studio", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  const row = await first<BoardRow>(c.var.db, `SELECT * FROM trend_boards WHERE id = ?`, id);
  if (!row) return c.json({ error: "Not found" }, 404);
  if (row.concept_id) return c.json({ error: "Already in the Design Studio.", conceptId: row.concept_id }, 409);
  const board = mapBoard(row);
  const briefParts = [
    row.season ? `Season: ${row.season}.` : null,
    `Focus: ${row.focus}.`,
    board.items.length ? `Directions: ${board.items.map((i) => i.label).join("; ")}.` : null,
    row.brief_md ? `\n${row.brief_md.slice(0, 3000)}` : null,
  ].filter(Boolean);
  const conceptId = newId("con");
  await run(
    c.var.db,
    `INSERT INTO ai_concepts (id, title, brief, status, tags, created_by)
     VALUES (?, ?, ?, 'exploring', ?, ?)`,
    conceptId,
    row.title.slice(0, 160),
    briefParts.join("\n").slice(0, 8000),
    JSON.stringify([row.season, row.focus, "trend-board"].filter(Boolean)),
    c.var.userId,
  );
  await run(
    c.var.db,
    `UPDATE trend_boards SET concept_id = ?, status = 'adopted', updated_at = datetime('now') WHERE id = ?`,
    conceptId,
    id,
  );
  await writeAudit(c.var.db, c.var.userId, "research.trend_adopted", "ai_concept", conceptId, { boardId: id });
  await emit(c.var.db, {
    kind: "research.trend_adopted",
    entityType: "ai_concept",
    entityId: conceptId,
    title: `Trend board “${row.title}” moved into the Design Studio`,
    payload: { boardId: id, conceptId },
  });
  return c.json({ conceptId });
});

// ---- Stockists --------------------------------------------------------------

interface StockistRowFull {
  id: string;
  name: string;
  kind: string;
  city: string | null;
  country: string | null;
  website: string | null;
  instagram: string | null;
  email: string | null;
  phone: string | null;
  brands_carried: string | null;
  price_point: string | null;
  fit_note: string | null;
  dossier_md: string | null;
  citations: string | null;
  status: string;
  last_researched_at: string | null;
  created_at: string;
  updated_at: string;
}

const STOCKIST_KINDS = ["boutique", "department", "online", "showroom", "fair", "popup"] as const;
const STOCKIST_STATUSES = ["researching", "shortlist", "pitched", "in_talks", "stocked", "passed"] as const;

function mapStockist(r: StockistRowFull) {
  return {
    id: r.id,
    name: r.name,
    kind: r.kind,
    city: r.city,
    country: r.country,
    website: r.website,
    instagram: r.instagram,
    email: r.email,
    phone: r.phone,
    brandsCarried: r.brands_carried,
    pricePoint: r.price_point,
    fitNote: r.fit_note,
    dossierMd: r.dossier_md,
    citations: parseArr(r.citations),
    status: r.status,
    lastResearchedAt: r.last_researched_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const STOCKIST_FIELDS = [
  ["city", "city", 120],
  ["country", "country", 120],
  ["website", "website", 400],
  ["instagram", "instagram", 120],
  ["email", "email", 200],
  ["phone", "phone", 60],
  ["brandsCarried", "brands_carried", 1000],
  ["pricePoint", "price_point", 120],
  ["fitNote", "fit_note", 2000],
] as const;

adminResearchPlusRoutes.get("/stockists", async (c) => {
  try {
    const rows = await all<StockistRowFull>(
      c.var.db,
      `SELECT * FROM research_stockists ORDER BY
         CASE status WHEN 'stocked' THEN 0 WHEN 'in_talks' THEN 1 WHEN 'pitched' THEN 2
                     WHEN 'shortlist' THEN 3 WHEN 'researching' THEN 4 ELSE 5 END,
         name COLLATE NOCASE`,
    );
    return c.json(rows.map(mapStockist));
  } catch {
    return c.json([]);
  }
});

adminResearchPlusRoutes.post("/stockists", requireAdminWrite, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = s(body.name, 160);
  if (!name) return c.json({ error: "The stockist needs a name." }, 400);
  const id = newId("rstock");
  const cols = STOCKIST_FIELDS.map(([, col]) => col);
  const vals = STOCKIST_FIELDS.map(([key, , max]) => s(body[key], max));
  await run(
    c.var.db,
    `INSERT INTO research_stockists (id, name, kind, ${cols.join(", ")})
     VALUES (?, ?, ?, ${cols.map(() => "?").join(", ")})`,
    id,
    name,
    (STOCKIST_KINDS as readonly string[]).includes(body.kind as string) ? (body.kind as string) : "boutique",
    ...vals,
  );
  await writeAudit(c.var.db, c.var.userId, "research.add_stockist", "research_stockist", id, { name });
  const row = await first<StockistRowFull>(c.var.db, `SELECT * FROM research_stockists WHERE id = ?`, id);
  return c.json(mapStockist(row!), 201);
});

adminResearchPlusRoutes.patch("/stockists/:id", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (typeof body.name === "string" && body.name.trim()) {
    sets.push("name = ?");
    vals.push(body.name.trim().slice(0, 160));
  }
  if ((STOCKIST_KINDS as readonly string[]).includes(body.kind as string)) {
    sets.push("kind = ?");
    vals.push(body.kind);
  }
  for (const [key, col, max] of STOCKIST_FIELDS) {
    if (key in body) {
      sets.push(`${col} = ?`);
      vals.push(s(body[key], max));
    }
  }
  if ((STOCKIST_STATUSES as readonly string[]).includes(body.status as string)) {
    sets.push("status = ?");
    vals.push(body.status);
    if (body.status === "stocked") {
      await emit(c.var.db, {
        kind: "research.stockist_stocked",
        entityType: "research_stockist",
        entityId: id,
        title: `A stockist moved to “stocked” in R&D — a wholesale door opened`,
        payload: {},
      });
    }
  }
  if (!sets.length) return c.json({ error: "Nothing to update." }, 400);
  sets.push("updated_at = datetime('now')");
  await run(c.var.db, `UPDATE research_stockists SET ${sets.join(", ")} WHERE id = ?`, ...vals, id);
  const row = await first<StockistRowFull>(c.var.db, `SELECT * FROM research_stockists WHERE id = ?`, id);
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json(mapStockist(row));
});

adminResearchPlusRoutes.delete("/stockists/:id", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  const row = await first<{ name: string }>(c.var.db, `SELECT name FROM research_stockists WHERE id = ?`, id);
  const undoId = row ? await softDelete(c.var.db, "research_stockists", id, `Deleted stockist “${row.name}”`) : null;
  if (!undoId) await run(c.var.db, `DELETE FROM research_stockists WHERE id = ?`, id);
  return c.json({ ok: true, undoId });
});

adminResearchPlusRoutes.post("/stockists/:id/research", requireAdminWrite, async (c) => {
  const { perplexityConfigured } = await import("../services/perplexity");
  if (!perplexityConfigured(c.env)) {
    return c.json({ error: "Live research isn't configured yet — the pipeline still works by hand." }, 503);
  }
  const id = c.req.param("id");
  const row = await first<StockistRowFull>(c.var.db, `SELECT * FROM research_stockists WHERE id = ?`, id);
  if (!row) return c.json({ error: "Not found" }, 404);
  const quota = await reserveResearchQuota(c);
  if (!quota.ok) return c.json(quotaExceededBody(quota), 429);
  try {
    const { researchStockist } = await import("../services/research-lab");
    await researchStockist(c.var.db, c.env, row);
    await writeAudit(c.var.db, c.var.userId, "research.stockist_profile", "research_stockist", id, { name: row.name });
    const fresh = await first<StockistRowFull>(c.var.db, `SELECT * FROM research_stockists WHERE id = ?`, id);
    return c.json(mapStockist(fresh!));
  } catch {
    return c.json({ error: "Research didn't come back — try again in a moment." }, 502);
  }
});
