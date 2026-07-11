import { Hono } from "hono";
import { all, first, run, writeAudit } from "../services/db";
import { requireAdminWrite } from "../middleware/auth";
import { newId } from "../utils/id";
import {
  MAGAZINES,
  librarySearch,
  magazineIssues,
  issueMeta,
  iaPageUrl,
} from "../services/library";
import type { AppContext } from "../types/env";

/**
 * The Timeless Library. Searches run live against the Met (CC0) and the
 * Internet Archive through the platform cache — free APIs, no keys, so
 * there is no quota to spend. Pins are per-shop (the shop's own library);
 * the "send to trend board" hand-off writes the citation with the item,
 * which is the whole method the school teaches.
 */
export const adminLibraryRoutes = new Hono<AppContext>();

const ROOMS = ["plates", "magazines", "books", "patterns"] as const;

const s = (v: unknown, max = 400): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
};

interface PinRow {
  id: string;
  item_key: string;
  room: string;
  title: string;
  creator: string | null;
  date_text: string | null;
  thumb_url: string | null;
  image_url: string | null;
  source_url: string;
  credit: string;
  note: string | null;
  created_at: string;
}

const mapPin = (r: PinRow) => ({
  id: r.id,
  itemKey: r.item_key,
  room: r.room,
  title: r.title,
  creator: r.creator,
  date: r.date_text,
  thumb: r.thumb_url,
  image: r.image_url,
  url: r.source_url,
  credit: r.credit,
  note: r.note,
  createdAt: r.created_at,
});

// ---- Overview ---------------------------------------------------------------

adminLibraryRoutes.get("/overview", async (c) => {
  let pinCounts: Record<string, number> = {};
  let recent: PinRow[] = [];
  try {
    const rows = await all<{ room: string; n: number }>(
      c.var.db,
      `SELECT room, COUNT(*) AS n FROM library_pins GROUP BY room`,
    );
    pinCounts = Object.fromEntries(rows.map((r) => [r.room, r.n]));
    recent = await all<PinRow>(c.var.db, `SELECT * FROM library_pins ORDER BY created_at DESC LIMIT 8`);
  } catch {
    /* table lands with the next migration pass; the rooms still open */
  }
  return c.json({
    rooms: ROOMS.map((room) => ({ room, pins: pinCounts[room] ?? 0 })),
    magazines: MAGAZINES.map((m) => ({ key: m.key, title: m.title, years: m.years, about: m.about })),
    recentPins: recent.map(mapPin),
  });
});

// ---- Search -----------------------------------------------------------------

adminLibraryRoutes.get("/search", async (c) => {
  const room = c.req.query("room") || "plates";
  const q = s(c.req.query("q"), 200);
  if (!q || q.length < 2) return c.json({ items: [], sources: [] });
  if (!(ROOMS as readonly string[]).includes(room)) return c.json({ error: "Unknown room." }, 400);
  const dept = parseInt(c.req.query("dept") || "", 10);
  try {
    const out = await librarySearch(c.env, room, q, { dept: Number.isFinite(dept) ? dept : undefined });
    return c.json(out);
  } catch {
    return c.json(
      { error: "The archive isn't answering right now — cached results still work; try again in a minute." },
      502,
    );
  }
});

// ---- Magazines --------------------------------------------------------------

adminLibraryRoutes.get("/magazines", (c) =>
  c.json(MAGAZINES.map((m) => ({ key: m.key, title: m.title, publisher: m.publisher, years: m.years, about: m.about }))),
);

adminLibraryRoutes.get("/magazines/:key/:year", async (c) => {
  const key = c.req.param("key");
  const year = parseInt(c.req.param("year"), 10);
  const mag = MAGAZINES.find((m) => m.key === key);
  if (!mag || !Number.isFinite(year) || year < mag.years[0] || year > mag.years[1]) {
    return c.json({ error: "No such shelf." }, 404);
  }
  try {
    return c.json({ items: await magazineIssues(c.env, key, year) });
  } catch {
    return c.json({ error: "The archive isn't answering right now — try again in a minute." }, 502);
  }
});

// ---- The reader -------------------------------------------------------------

adminLibraryRoutes.get("/issue/:iaId", async (c) => {
  const iaId = c.req.param("iaId");
  if (!/^[\w.-]+$/.test(iaId)) return c.json({ error: "Bad identifier." }, 400);
  try {
    const meta = await issueMeta(c.env, iaId);
    if (!meta) return c.json({ error: "That scan has no readable pages." }, 404);
    // The client hotlinks pages straight from the Archive's IIIF service;
    // sample URL shows the shape (replace the leaf number and width).
    return c.json({ ...meta, samplePageUrl: iaPageUrl(iaId, 0, 880) });
  } catch {
    return c.json({ error: "The archive isn't answering right now — try again in a minute." }, 502);
  }
});

// ---- Pins -------------------------------------------------------------------

adminLibraryRoutes.get("/pins", async (c) => {
  const room = c.req.query("room");
  try {
    const rows = room
      ? await all<PinRow>(c.var.db, `SELECT * FROM library_pins WHERE room = ? ORDER BY created_at DESC LIMIT 200`, room)
      : await all<PinRow>(c.var.db, `SELECT * FROM library_pins ORDER BY created_at DESC LIMIT 200`);
    return c.json(rows.map(mapPin));
  } catch {
    return c.json([]);
  }
});

adminLibraryRoutes.post("/pins", requireAdminWrite, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const itemKey = s(body.itemKey, 200);
  const title = s(body.title, 300);
  const url = s(body.url, 600);
  const credit = s(body.credit, 500);
  const room = (ROOMS as readonly string[]).includes(body.room as string) ? (body.room as string) : "plates";
  if (!itemKey || !title || !url || !credit) {
    return c.json({ error: "A pin needs the item, its source link, and its credit line." }, 400);
  }
  const id = newId("lpin");
  try {
    await run(
      c.var.db,
      `INSERT INTO library_pins (id, item_key, room, title, creator, date_text, thumb_url, image_url, source_url, credit, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(item_key) DO UPDATE SET note = COALESCE(excluded.note, library_pins.note)`,
      id,
      itemKey,
      room,
      title,
      s(body.creator, 200),
      s(body.date, 100),
      s(body.thumb, 600),
      s(body.image, 600),
      url,
      credit,
      s(body.note, 1000),
    );
  } catch {
    return c.json({ error: "Couldn't save the pin." }, 500);
  }
  await writeAudit(c.var.db, c.var.userId, "library.pin", "library_pin", id, { title });
  const row = await first<PinRow>(c.var.db, `SELECT * FROM library_pins WHERE item_key = ?`, itemKey);
  return c.json(mapPin(row!), 201);
});

adminLibraryRoutes.delete("/pins/:id", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  await run(c.var.db, `DELETE FROM library_pins WHERE id = ?`, id);
  return c.json({ ok: true });
});

// ---- Port into a new design ---------------------------------------------------
// Fetches the archive image server-side (host-allowlisted), stores it in R2 as
// a shop file, and opens a fresh Design Studio concept with the image attached
// as a FLUX reference and the citation in the brief. The archive becomes raw
// material, provenance intact.

const REF_HOSTS = ["images.metmuseum.org", "iiif.archive.org", "archive.org"];

adminLibraryRoutes.post("/to-design", requireAdminWrite, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const title = s(body.title, 200);
  const refUrl = s(body.refUrl, 600);
  const credit = s(body.credit, 500);
  const sourceUrl = s(body.sourceUrl, 600);
  if (!title || !refUrl || !credit) return c.json({ error: "Need the item, its image, and its credit." }, 400);
  let host: string;
  try {
    host = new URL(refUrl).hostname;
  } catch {
    return c.json({ error: "Bad image URL." }, 400);
  }
  if (!REF_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) {
    return c.json({ error: "Only archive sources can be ported." }, 400);
  }

  // Fetch the image at reference size.
  let bytes: ArrayBuffer;
  let contentType = "image/jpeg";
  try {
    const res = await fetch(refUrl);
    if (!res.ok) throw new Error(String(res.status));
    contentType = res.headers.get("content-type") || contentType;
    if (!contentType.startsWith("image/")) throw new Error("not an image");
    bytes = await res.arrayBuffer();
    if (bytes.byteLength > 8 * 1024 * 1024) throw new Error("too large");
  } catch {
    return c.json({ error: "Couldn't fetch that image from the archive — try again in a minute." }, 502);
  }

  // New concept, the citation in its brief. Each step is named in its error
  // so a failure in the field reads as a diagnosis, not a shrug.
  const conceptId = newId("aic");
  try {
  await run(
    c.var.db,
    `INSERT INTO ai_concepts (id, title, brief, tags, created_by) VALUES (?, ?, ?, ?, ?)`,
    conceptId,
    title,
    `Quoted from the archive: ${credit}${sourceUrl ? `\n${sourceUrl}` : ""}`,
    JSON.stringify(["archive"]),
    c.var.userId,
  );

  // The image lands in R2 as a shop file, attached as a generation reference.
  const fileId = newId("file");
  const ext = contentType.includes("png") ? "png" : "jpg";
  const r2Key = `uploads/concept/${conceptId}/${fileId}-library-reference.${ext}`;
  await c.env.FILES.put(r2Key, bytes, { httpMetadata: { contentType } });
  await run(
    c.var.db,
    `INSERT INTO files (id, r2_key, filename, content_type, size_bytes, entity_type, entity_id, is_public, uploaded_by)
     VALUES (?, ?, ?, ?, ?, 'concept', ?, 0, ?)`,
    fileId,
    r2Key,
    `library-reference.${ext}`,
    contentType,
    bytes.byteLength,
    conceptId,
    c.var.userId,
  );
  await run(
    c.var.db,
    `INSERT INTO concept_references (id, concept_id, file_id, label) VALUES (?, ?, ?, ?)`,
    newId("cref"),
    conceptId,
    fileId,
    credit.slice(0, 160),
  );
  await run(
    c.var.db,
    `INSERT INTO analytics_events (id, event, entity_type, entity_id) VALUES (?, 'concept_created', 'ai_concept', ?)`,
    newId("evt"),
    conceptId,
  );
  await writeAudit(c.var.db, c.var.userId, "library.to_design", "ai_concept", conceptId, { title });
  return c.json({ conceptId }, 201);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: `Couldn't open the concept (${msg.slice(0, 200)}).` }, 500);
  }
});

// ---- Pin → trend board (the school's method, one click) -----------------------

adminLibraryRoutes.post("/pins/:id/to-trend/:boardId", requireAdminWrite, async (c) => {
  const pin = await first<PinRow>(c.var.db, `SELECT * FROM library_pins WHERE id = ?`, c.req.param("id"));
  if (!pin) return c.json({ error: "Pin not found." }, 404);
  const board = await first<{ id: string; title: string; items: string | null }>(
    c.var.db,
    `SELECT id, title, items FROM trend_boards WHERE id = ?`,
    c.req.param("boardId"),
  );
  if (!board) return c.json({ error: "Board not found." }, 404);
  let items: { label: string; note?: string }[] = [];
  try {
    const parsed = JSON.parse(board.items || "[]");
    if (Array.isArray(parsed)) items = parsed;
  } catch {
    /* start clean */
  }
  if (items.length >= 24) return c.json({ error: "That board is full (24 directions)." }, 400);
  items.push({
    label: pin.title.slice(0, 160),
    note: `${pin.credit} · ${pin.source_url}`.slice(0, 400),
  });
  await run(
    c.var.db,
    `UPDATE trend_boards SET items = ?, updated_at = datetime('now') WHERE id = ?`,
    JSON.stringify(items),
    board.id,
  );
  await writeAudit(c.var.db, c.var.userId, "library.pin_to_board", "trend_board", board.id, { pin: pin.title });
  return c.json({ ok: true, board: board.title });
});
