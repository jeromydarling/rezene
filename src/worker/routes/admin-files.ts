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
    createdAt: row.created_at as string,
  };
}

adminFileRoutes.get("/", async (c) => {
  const entityType = c.req.query("entityType");
  const entityId = c.req.query("entityId");
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
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = await all(
    c.env.DB,
    `SELECT * FROM files ${where} ORDER BY created_at DESC LIMIT 500`,
    ...params,
  );
  return c.json(rows.map(mapFile));
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

  const id = newId("file");
  const safeName = file.name.replaceAll(/[^\w.\-]/g, "_").slice(0, 120) || "upload.bin";
  const r2Key = `uploads/${entityType}/${entityId ?? "unassigned"}/${id}-${safeName}`;

  await c.env.FILES.put(r2Key, file.stream(), {
    httpMetadata: { contentType: file.type || "application/octet-stream" },
  });
  await run(
    c.env.DB,
    `INSERT INTO files (id, r2_key, filename, content_type, size_bytes, entity_type, entity_id, uploaded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    r2Key,
    file.name.slice(0, 200),
    file.type || null,
    file.size,
    entityType,
    entityId,
    c.var.userId,
  );
  await writeAudit(c.env.DB, c.var.userId, "file.upload", "file", id, {
    filename: file.name,
    entityType,
    entityId,
  });
  const row = await first(c.env.DB, `SELECT * FROM files WHERE id = ?`, id);
  return c.json(mapFile(row!), 201);
});

/**
 * Stream a private file through the Worker (session-gated download).
 * For high-traffic public assets, set is_public and serve via
 * R2_PUBLIC_BASE_URL instead.
 */
adminFileRoutes.get("/:id/download", async (c) => {
  const row = await first<{ r2_key: string; filename: string; content_type: string | null }>(
    c.env.DB,
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
    c.env.DB,
    `SELECT r2_key FROM files WHERE id = ?`,
    id,
  );
  if (!row) return c.json({ error: "File not found" }, 404);
  await c.env.FILES.delete(row.r2_key);
  await run(c.env.DB, `DELETE FROM files WHERE id = ?`, id);
  await writeAudit(c.env.DB, c.var.userId, "file.delete", "file", id, { r2Key: row.r2_key });
  return c.json({ ok: true });
});
