import { Hono } from "hono";
import { all, first, run, writeAudit } from "../services/db";
import { requireAdminWrite } from "../middleware/auth";
import { reserveResearchQuota, quotaExceededBody } from "../services/ai-quota";
import { newId } from "../utils/id";
import type { AppContext } from "../types/env";

/**
 * R&D — the shop's research workspace. Candidate makers (a bespoke
 * fulfillment directory with a lightweight pipeline) and free-form research
 * notes, including in-app Perplexity answers saved with their citations.
 * A maker promotes into Factories & Suppliers as an unverified lead — R&D
 * is the top of the sourcing funnel, not a second contact book.
 */
export const adminResearchRoutes = new Hono<AppContext>();

interface MakerRow {
  id: string;
  name: string;
  market: string | null;
  location: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  speciality: string | null;
  tech_pack: string | null;
  min_order: string | null;
  lead_time: string | null;
  price_unit: string | null;
  about: string | null;
  best_use: string | null;
  status: string;
  note: string | null;
  topic: string | null;
  supplier_id: string | null;
  created_at: string;
  updated_at: string;
}

const MAKER_STATUSES = ["researching", "contacted", "sampling", "approved", "passed"] as const;

function mapMaker(r: MakerRow) {
  return {
    id: r.id,
    name: r.name,
    market: r.market,
    location: r.location,
    website: r.website,
    email: r.email,
    phone: r.phone,
    speciality: r.speciality,
    techPack: r.tech_pack,
    minOrder: r.min_order,
    leadTime: r.lead_time,
    priceUnit: r.price_unit,
    about: r.about,
    bestUse: r.best_use,
    status: r.status,
    note: r.note,
    topic: r.topic,
    supplierId: r.supplier_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const s = (v: unknown, max = 400): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
};

const MAKER_FIELDS = [
  ["market", "market"],
  ["location", "location"],
  ["website", "website"],
  ["email", "email"],
  ["phone", "phone"],
  ["speciality", "speciality"],
  ["techPack", "tech_pack"],
  ["minOrder", "min_order"],
  ["leadTime", "lead_time"],
  ["priceUnit", "price_unit"],
  ["about", "about"],
  ["bestUse", "best_use"],
  ["note", "note"],
  ["topic", "topic"],
] as const;

adminResearchRoutes.get("/makers", async (c) => {
  try {
    const rows = await all<MakerRow>(
      c.var.db,
      `SELECT * FROM research_makers ORDER BY
         CASE status WHEN 'approved' THEN 0 WHEN 'sampling' THEN 1 WHEN 'contacted' THEN 2
                     WHEN 'researching' THEN 3 ELSE 4 END,
         name COLLATE NOCASE`,
    );
    return c.json(rows.map(mapMaker));
  } catch {
    return c.json([]); // table not migrated on this shop DB yet
  }
});

adminResearchRoutes.post("/makers", requireAdminWrite, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = s(body.name, 160);
  if (!name) return c.json({ error: "The maker needs a name." }, 400);
  const id = newId("rmaker");
  const cols = MAKER_FIELDS.map(([, col]) => col);
  const vals = MAKER_FIELDS.map(([key]) => s(body[key], key === "about" || key === "bestUse" || key === "note" ? 4000 : 400));
  await run(
    c.var.db,
    `INSERT INTO research_makers (id, name, ${cols.join(", ")})
     VALUES (?, ?, ${cols.map(() => "?").join(", ")})`,
    id,
    name,
    ...vals,
  );
  await writeAudit(c.var.db, c.var.userId, "research.add_maker", "research_maker", id, { name });
  const row = await first<MakerRow>(c.var.db, `SELECT * FROM research_makers WHERE id = ?`, id);
  return c.json(mapMaker(row!), 201);
});

/** Bulk import (the CSV importer posts parsed rows). Forgiving by design:
 *  rows without a name are skipped and reported, never fatal. */
adminResearchRoutes.post("/makers/import", requireAdminWrite, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { rows?: Record<string, unknown>[]; topic?: string };
  const rows = Array.isArray(body.rows) ? body.rows.slice(0, 500) : [];
  if (!rows.length) return c.json({ error: "No rows to import." }, 400);
  const topic = s(body.topic, 120);
  let imported = 0;
  let skipped = 0;
  for (const raw of rows) {
    const name = s(raw.name, 160);
    if (!name) {
      skipped++;
      continue;
    }
    const id = newId("rmaker");
    const cols = MAKER_FIELDS.map(([, col]) => col);
    const vals = MAKER_FIELDS.map(([key, col]) =>
      col === "topic" ? (s(raw.topic, 120) ?? topic) : s(raw[key], key === "about" || key === "bestUse" || key === "note" ? 4000 : 400),
    );
    await run(
      c.var.db,
      `INSERT INTO research_makers (id, name, ${cols.join(", ")})
       VALUES (?, ?, ${cols.map(() => "?").join(", ")})`,
      id,
      name,
      ...vals,
    );
    imported++;
  }
  await writeAudit(c.var.db, c.var.userId, "research.import_makers", "research_maker", "bulk", { imported, skipped });
  return c.json({ imported, skipped });
});

adminResearchRoutes.patch("/makers/:id", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (typeof body.name === "string" && body.name.trim()) {
    sets.push("name = ?");
    vals.push(body.name.trim().slice(0, 160));
  }
  for (const [key, col] of MAKER_FIELDS) {
    if (key in body) {
      sets.push(`${col} = ?`);
      vals.push(s(body[key], key === "about" || key === "bestUse" || key === "note" ? 4000 : 400));
    }
  }
  if (typeof body.status === "string" && (MAKER_STATUSES as readonly string[]).includes(body.status)) {
    sets.push("status = ?");
    vals.push(body.status);
  }
  if (!sets.length) return c.json({ error: "Nothing to update." }, 400);
  sets.push("updated_at = datetime('now')");
  await run(c.var.db, `UPDATE research_makers SET ${sets.join(", ")} WHERE id = ?`, ...vals, id);
  const row = await first<MakerRow>(c.var.db, `SELECT * FROM research_makers WHERE id = ?`, id);
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json(mapMaker(row));
});

adminResearchRoutes.delete("/makers/:id", requireAdminWrite, async (c) => {
  await run(c.var.db, `DELETE FROM research_makers WHERE id = ?`, c.req.param("id"));
  return c.json({ ok: true });
});

/** Promote a researched maker into Factories & Suppliers as an unverified
 *  lead (the same shape "Find a Maker" creates) — plus the factory detail
 *  row when we have a speciality. MOQ/lead-time parse only when they are
 *  cleanly numeric; the true research phrasing always survives in notes. */
adminResearchRoutes.post("/makers/:id/promote", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  const row = await first<MakerRow>(c.var.db, `SELECT * FROM research_makers WHERE id = ?`, id);
  if (!row) return c.json({ error: "Not found" }, 404);
  if (row.supplier_id) return c.json({ error: "Already promoted.", supplierId: row.supplier_id }, 409);
  const supplierId = newId("sup");
  const moq = /^\s*(\d+)\s*(piece|pc|unit)?s?\s*$/i.exec(row.min_order ?? "");
  const weeks = /^\s*(\d+)\s*[–-]?\s*(\d+)?\s*(wk|week)/i.exec(row.lead_time ?? "");
  const leadDays = weeks ? Number(weeks[2] ?? weeks[1]) * 7 : null;
  const notesParts = [
    row.about,
    row.best_use ? `Best use: ${row.best_use}` : null,
    row.tech_pack ? `Tech pack: ${row.tech_pack}` : null,
    row.min_order ? `Min order (research): ${row.min_order}` : null,
    row.lead_time ? `Lead time (research): ${row.lead_time}` : null,
    row.price_unit ? `Est. price/unit (research): ${row.price_unit}` : null,
    row.note,
    "Promoted from R&D research — unverified lead.",
  ].filter(Boolean);
  await run(
    c.var.db,
    `INSERT INTO suppliers (id, name, kind, city, email, phone, website, capabilities, moq_units, lead_time_days, is_verified, notes)
     VALUES (?, ?, 'factory', ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    supplierId,
    row.name,
    row.location,
    row.email && row.email.includes("@") ? row.email : null,
    row.phone,
    row.website,
    JSON.stringify(row.speciality ? [row.speciality] : []),
    moq ? Number(moq[1]) : null,
    leadDays,
    notesParts.join("\n\n"),
  );
  if (row.speciality) {
    await run(
      c.var.db,
      `INSERT INTO factories (id, supplier_id, specialty, min_order_units) VALUES (?, ?, ?, ?)`,
      newId("fact"),
      supplierId,
      row.speciality,
      moq ? Number(moq[1]) : null,
    );
  }
  await run(
    c.var.db,
    `UPDATE research_makers SET supplier_id = ?, updated_at = datetime('now') WHERE id = ?`,
    supplierId,
    id,
  );
  await writeAudit(c.var.db, c.var.userId, "research.promote_maker", "supplier", supplierId, { name: row.name });
  return c.json({ supplierId });
});

// ---- Notes -----------------------------------------------------------------

interface NoteRow {
  id: string;
  title: string;
  body_md: string;
  topic: string | null;
  tags: string | null;
  source_url: string | null;
  kind: string;
  citations: string | null;
  pinned: number;
  created_at: string;
  updated_at: string;
}

function mapNote(r: NoteRow) {
  let tags: string[] = [];
  let citations: string[] = [];
  try {
    tags = JSON.parse(r.tags || "[]");
  } catch {
    tags = [];
  }
  try {
    citations = JSON.parse(r.citations || "[]");
  } catch {
    citations = [];
  }
  return {
    id: r.id,
    title: r.title,
    bodyMd: r.body_md,
    topic: r.topic,
    tags,
    sourceUrl: r.source_url,
    kind: r.kind,
    citations,
    pinned: Boolean(r.pinned),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const cleanTags = (v: unknown): string =>
  JSON.stringify(
    (Array.isArray(v) ? v : [])
      .filter((t): t is string => typeof t === "string" && Boolean(t.trim()))
      .map((t) => t.trim().slice(0, 40))
      .slice(0, 12),
  );

adminResearchRoutes.get("/notes", async (c) => {
  try {
    const rows = await all<NoteRow>(
      c.var.db,
      `SELECT * FROM research_notes ORDER BY pinned DESC, updated_at DESC LIMIT 500`,
    );
    return c.json(rows.map(mapNote));
  } catch {
    return c.json([]);
  }
});

adminResearchRoutes.post("/notes", requireAdminWrite, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const title = s(body.title, 200);
  if (!title) return c.json({ error: "The note needs a title." }, 400);
  const id = newId("rnote");
  await run(
    c.var.db,
    `INSERT INTO research_notes (id, title, body_md, topic, tags, source_url, kind)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    id,
    title,
    typeof body.bodyMd === "string" ? body.bodyMd.slice(0, 40000) : "",
    s(body.topic, 120),
    cleanTags(body.tags),
    s(body.sourceUrl, 500),
    body.kind === "import" ? "import" : "note",
  );
  await writeAudit(c.var.db, c.var.userId, "research.add_note", "research_note", id, { title });
  const row = await first<NoteRow>(c.var.db, `SELECT * FROM research_notes WHERE id = ?`, id);
  return c.json(mapNote(row!), 201);
});

/** Bulk note import (CSV importer, notes mode). */
adminResearchRoutes.post("/notes/import", requireAdminWrite, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { rows?: Record<string, unknown>[]; topic?: string };
  const rows = Array.isArray(body.rows) ? body.rows.slice(0, 500) : [];
  if (!rows.length) return c.json({ error: "No rows to import." }, 400);
  const topic = s(body.topic, 120);
  let imported = 0;
  let skipped = 0;
  for (const raw of rows) {
    const title = s(raw.title, 200);
    if (!title) {
      skipped++;
      continue;
    }
    await run(
      c.var.db,
      `INSERT INTO research_notes (id, title, body_md, topic, tags, source_url, kind)
       VALUES (?, ?, ?, ?, ?, ?, 'import')`,
      newId("rnote"),
      title,
      typeof raw.bodyMd === "string" ? raw.bodyMd.slice(0, 40000) : "",
      s(raw.topic, 120) ?? topic,
      cleanTags(typeof raw.tags === "string" ? raw.tags.split(/[;|]/) : raw.tags),
      s(raw.sourceUrl, 500),
    );
    imported++;
  }
  await writeAudit(c.var.db, c.var.userId, "research.import_notes", "research_note", "bulk", { imported, skipped });
  return c.json({ imported, skipped });
});

adminResearchRoutes.patch("/notes/:id", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (typeof body.title === "string" && body.title.trim()) {
    sets.push("title = ?");
    vals.push(body.title.trim().slice(0, 200));
  }
  if (typeof body.bodyMd === "string") {
    sets.push("body_md = ?");
    vals.push(body.bodyMd.slice(0, 40000));
  }
  if ("topic" in body) {
    sets.push("topic = ?");
    vals.push(s(body.topic, 120));
  }
  if ("tags" in body) {
    sets.push("tags = ?");
    vals.push(cleanTags(body.tags));
  }
  if ("sourceUrl" in body) {
    sets.push("source_url = ?");
    vals.push(s(body.sourceUrl, 500));
  }
  if (typeof body.pinned === "boolean") {
    sets.push("pinned = ?");
    vals.push(body.pinned ? 1 : 0);
  }
  if (!sets.length) return c.json({ error: "Nothing to update." }, 400);
  sets.push("updated_at = datetime('now')");
  await run(c.var.db, `UPDATE research_notes SET ${sets.join(", ")} WHERE id = ?`, ...vals, id);
  const row = await first<NoteRow>(c.var.db, `SELECT * FROM research_notes WHERE id = ?`, id);
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json(mapNote(row));
});

adminResearchRoutes.delete("/notes/:id", requireAdminWrite, async (c) => {
  await run(c.var.db, `DELETE FROM research_notes WHERE id = ?`, c.req.param("id"));
  return c.json({ ok: true });
});

// ---- Ask (Perplexity) ------------------------------------------------------

adminResearchRoutes.get("/config", async (c) => {
  const { perplexityConfigured } = await import("../services/perplexity");
  return c.json({ enabled: perplexityConfigured(c.env) });
});

/** Ask a research question from inside R&D. The differentiator vs. a raw
 *  Perplexity tab: every answer is SAVED as a note with its citations, so
 *  the research trail becomes an asset instead of an evaporating chat. */
adminResearchRoutes.post("/ask", requireAdminWrite, async (c) => {
  const { perplexityConfigured, perplexityResearch } = await import("../services/perplexity");
  if (!perplexityConfigured(c.env)) {
    return c.json(
      { error: "Live research isn't configured yet. Your notes and makers work without it." },
      503,
    );
  }
  const body = (await c.req.json().catch(() => ({}))) as { prompt?: string; topic?: string };
  const prompt = (body.prompt || "").trim().slice(0, 1200);
  if (!prompt) return c.json({ error: "Ask a research question first." }, 400);
  const quota = await reserveResearchQuota(c);
  if (!quota.ok) return c.json(quotaExceededBody(quota), 429);
  const topic = s(body.topic, 120);
  try {
    const research = await perplexityResearch(c.env, {
      system:
        "You are a fashion-industry research analyst helping an independent brand or atelier. " +
        "Answer with specific, verifiable facts: named companies, locations, contact channels, " +
        "minimums, lead times, and prices where the sources support them. Use plain markdown " +
        "with short sections. Flag anything uncertain as uncertain — never invent contacts.",
      prompt,
      maxTokens: 2000,
    });
    const id = newId("rnote");
    await run(
      c.var.db,
      `INSERT INTO research_notes (id, title, body_md, topic, tags, citations, kind)
       VALUES (?, ?, ?, ?, '[]', ?, 'search')`,
      id,
      prompt.slice(0, 200),
      research.text.slice(0, 40000),
      topic,
      JSON.stringify(research.citations.slice(0, 20)),
    );
    await writeAudit(c.var.db, c.var.userId, "research.ask", "research_note", id, {});
    const row = await first<NoteRow>(c.var.db, `SELECT * FROM research_notes WHERE id = ?`, id);
    return c.json(mapNote(row!), 201);
  } catch {
    return c.json({ error: "Research didn't come back — try again in a moment." }, 502);
  }
});
