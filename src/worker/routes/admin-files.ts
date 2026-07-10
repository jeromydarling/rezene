import { Hono } from "hono";
import { all, first, run, writeAudit } from "../services/db";
import { requireAdminWrite } from "../middleware/auth";
import { newId } from "../utils/id";
import type { AppContext } from "../types/env";
import type { AdminFile } from "../../shared/types";

export const adminFileRoutes = new Hono<AppContext>();

const ENTITY_TYPES = new Set([
  "style",
  "tech_pack",
  "sample",
  "factory",
  "production_order",
  "concept",
  "3d_project",
  "journal",
  "product",
  "general",
  "brand",
  "emblem",
  "import",
  "fitting_model",
  "client",
  "fitting_render",
]);

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

function mapFile(row: Record<string, unknown>): AdminFile {
  return {
    id: row.id as string,
    r2Key: row.r2_key as string,
    filename: row.filename as string,
    contentType: (row.content_type as string) ?? null,
    sizeBytes: (row.size_bytes as number) ?? null,
    entityType: (row.entity_type as string) ?? null,
    entityId: (row.entity_id as string) ?? null,
    isPublic: Boolean(row.is_public),
    altText: (row.alt_text as string) ?? null,
    createdAt: row.created_at as string,
  };
}

adminFileRoutes.get("/", async (c) => {
  const entityType = c.req.query("entityType");
  const entityId = c.req.query("entityId");
  const q = c.req.query("q");
  const params: unknown[] = [];
  const conditions: string[] = [];
  if (entityType) {
    conditions.push(`entity_type = ?`);
    params.push(entityType);
  }
  if (entityId) {
    conditions.push(`entity_id = ?`);
    params.push(entityId);
  }
  if (c.req.query("publicImages") === "1") {
    conditions.push(`is_public = 1 AND content_type LIKE 'image/%'`);
  }
  if (q) {
    conditions.push(`(filename LIKE ? OR alt_text LIKE ?)`);
    params.push(`%${q}%`, `%${q}%`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = await all(
    c.var.db,
    `SELECT * FROM files ${where} ORDER BY created_at DESC LIMIT 500`,
    ...params,
  );
  return c.json(rows.map(mapFile));
});

/** Update file metadata (currently: alt text for the media library). */
adminFileRoutes.patch("/:id", requireAdminWrite, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    altText?: string | null;
    filename?: string;
  };
  const sets: string[] = [];
  const params: unknown[] = [];
  if (body.altText !== undefined) {
    sets.push(`alt_text = ?`);
    params.push(body.altText ? String(body.altText).slice(0, 300) : null);
  }
  if (body.filename !== undefined) {
    const name = String(body.filename).trim().slice(0, 255);
    if (!name) return c.json({ error: "Filename can't be empty" }, 400);
    sets.push(`filename = ?`);
    params.push(name);
  }
  if (sets.length === 0) return c.json({ error: "Nothing to update" }, 400);
  const result = await run(
    c.var.db,
    `UPDATE files SET ${sets.join(", ")} WHERE id = ?`,
    ...params,
    c.req.param("id"),
  );
  if (!result.meta.changes) return c.json({ error: "File not found" }, 404);
  return c.json({ ok: true });
});

/** Vision-generated alt text for an uploaded image. */
adminFileRoutes.post("/:id/ai-alt", requireAdminWrite, async (c) => {
  const row = await first<{ id: string; r2_key: string; content_type: string | null; size_bytes: number | null }>(
    c.var.db,
    `SELECT id, r2_key, content_type, size_bytes FROM files WHERE id = ?`,
    c.req.param("id"),
  );
  if (!row) return c.json({ error: "File not found" }, 404);
  if (!row.content_type?.startsWith("image/") || row.content_type === "image/svg+xml") {
    return c.json({ error: "Alt text generation only works on raster images" }, 400);
  }
  if ((row.size_bytes ?? 0) > 4 * 1024 * 1024) {
    return c.json({ error: "Image too large for alt text generation (4MB max)" }, 413);
  }
  const object = await c.env.FILES.get(row.r2_key);
  if (!object) return c.json({ error: "Object missing from storage" }, 404);
  const bytes = new Uint8Array(await object.arrayBuffer());
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  try {
    const { askClaude } = await import("../services/anthropic");
    const result = await askClaude(c.env, {
      system:
        "You write alt text for e-commerce imagery. Respond with one plain sentence, " +
        "under 125 characters, describing what is visually in the image. No quotes, no preamble.",
      prompt: "Write alt text for this image.",
      image: { base64: btoa(binary), mediaType: row.content_type },
      maxTokens: 100,
    });
    const altText = result.text.trim().replace(/^"|"$/g, "").slice(0, 300);
    if (!altText) return c.json({ error: "The model returned nothing — try again" }, 502);
    await run(c.var.db, `UPDATE files SET alt_text = ? WHERE id = ?`, altText, row.id);
    return c.json({ altText });
  } catch (err) {
    const { AnthropicNotConfiguredError } = await import("../services/anthropic");
    if (err instanceof AnthropicNotConfiguredError) {
      return c.json({ error: "Alt text generation needs an Anthropic API key" }, 503);
    }
    throw err;
  }
});

/**
 * Multipart upload → R2. Metadata lands in D1; the object key is namespaced
 * by entity so buckets stay browsable: uploads/<entityType>/<entityId>/<id>-<name>
 */
adminFileRoutes.post("/upload", requireAdminWrite, async (c) => {
  const form = await c.req.formData().catch(() => null);
  if (!form) return c.json({ error: "Expected multipart/form-data" }, 400);
  const file = form.get("file");
  if (!(file instanceof File)) return c.json({ error: "Missing 'file' field" }, 400);
  if (file.size > MAX_UPLOAD_BYTES) {
    return c.json({ error: `File exceeds ${MAX_UPLOAD_BYTES / 1024 / 1024}MB limit` }, 413);
  }
  const entityTypeRaw = form.get("entityType");
  const entityType =
    typeof entityTypeRaw === "string" && ENTITY_TYPES.has(entityTypeRaw)
      ? entityTypeRaw
      : "general";
  const entityIdRaw = form.get("entityId");
  const entityId = typeof entityIdRaw === "string" && entityIdRaw ? entityIdRaw.slice(0, 80) : null;
  const isPublicRaw = form.get("isPublic");
  // Public files are served (cached, unauthenticated) at /media/:id — for
  // storefront imagery. Everything else stays session-gated.
  const isPublic = isPublicRaw === "1" || isPublicRaw === "true";

  const id = newId("file");
  const safeName = file.name.replaceAll(/[^\w.\-]/g, "_").slice(0, 120) || "upload.bin";
  const r2Key = `uploads/${entityType}/${entityId ?? "unassigned"}/${id}-${safeName}`;

  await c.env.FILES.put(r2Key, file.stream(), {
    httpMetadata: { contentType: file.type || "application/octet-stream" },
  });
  await run(
    c.var.db,
    `INSERT INTO files (id, r2_key, filename, content_type, size_bytes, entity_type, entity_id, is_public, uploaded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    r2Key,
    file.name.slice(0, 200),
    file.type || null,
    file.size,
    entityType,
    entityId,
    isPublic ? 1 : 0,
    c.var.userId,
  );
  await writeAudit(c.var.db, c.var.userId, "file.upload", "file", id, {
    filename: file.name,
    entityType,
    entityId,
  });
  const row = await first(c.var.db, `SELECT * FROM files WHERE id = ?`, id);
  return c.json(mapFile(row!), 201);
});

/**
 * Stream a private file through the Worker (session-gated download).
 * For high-traffic public assets, set is_public and serve via
 * R2_PUBLIC_BASE_URL instead.
 */
adminFileRoutes.get("/:id/download", async (c) => {
  const row = await first<{ r2_key: string; filename: string; content_type: string | null }>(
    c.var.db,
    `SELECT r2_key, filename, content_type FROM files WHERE id = ?`,
    c.req.param("id"),
  );
  if (!row) return c.json({ error: "File not found" }, 404);
  const object = await c.env.FILES.get(row.r2_key);
  if (!object) return c.json({ error: "Object missing from storage" }, 404);
  return new Response(object.body as ReadableStream, {
    headers: {
      "content-type": row.content_type ?? "application/octet-stream",
      "content-disposition": `inline; filename="${row.filename.replaceAll('"', "")}"`,
      "cache-control": "private, max-age=60",
    },
  });
});

adminFileRoutes.delete("/:id", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  const row = await first<{ r2_key: string }>(
    c.var.db,
    `SELECT r2_key FROM files WHERE id = ?`,
    id,
  );
  if (!row) return c.json({ error: "File not found" }, 404);
  await c.env.FILES.delete(row.r2_key);
  await run(c.var.db, `DELETE FROM files WHERE id = ?`, id);
  await writeAudit(c.var.db, c.var.userId, "file.delete", "file", id, { r2Key: row.r2_key });
  return c.json({ ok: true });
});
