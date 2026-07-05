import { Hono, type Context } from "hono";
import { all, first, run, writeAudit } from "../services/db";
import {
  aiDraftSchema,
  collectionUpdateSchema,
  homeHeroSchema,
  journalCreateSchema,
  journalUpdateSchema,
  lookbookImageCreateSchema,
  lookbookImageUpdateSchema,
  lookbookUpdateSchema,
  pageCreateSchema,
  pageUpdateSchema,
  parseBody,
} from "../services/validators";
import { requireAdminWrite } from "../middleware/auth";
import { AnthropicNotConfiguredError, askClaude, parseModelJson } from "../services/anthropic";
import { getBrandName } from "../services/brand";
import { newId } from "../utils/id";
import type { AppContext } from "../types/env";

/**
 * CMS routes: pages, journal, collections, lookbooks — with revision
 * history. Every update snapshots the previous row into content_revisions
 * before writing, and any revision can be restored (which itself snapshots
 * the current state first, so restores are also undoable).
 */
export const adminContentRoutes = new Hono<AppContext>();

type RevisionEntity = "page" | "journal_post" | "collection" | "lookbook";
const ENTITY_TABLE: Record<RevisionEntity, string> = {
  page: "pages",
  journal_post: "journal_posts",
  collection: "collections",
  lookbook: "lookbooks",
};

async function snapshotRevision(
  db: D1Database,
  entityType: RevisionEntity,
  entityId: string,
  userId: string | null,
): Promise<void> {
  const row = await first<Record<string, unknown>>(
    db,
    `SELECT * FROM ${ENTITY_TABLE[entityType]} WHERE id = ?`,
    entityId,
  );
  if (!row) return;
  await run(
    db,
    `INSERT INTO content_revisions (id, entity_type, entity_id, snapshot_json, saved_by)
     VALUES (?, ?, ?, ?, ?)`,
    newId("rev"),
    entityType,
    entityId,
    JSON.stringify(row),
    userId,
  );
}

function revisionRoutes(entityType: RevisionEntity, restorableColumns: string[]) {
  return {
    async list(c: Context<AppContext>) {
      const rows = await all(
        c.env.DB,
        `SELECT r.id, r.created_at, u.email AS saved_by
         FROM content_revisions r LEFT JOIN users u ON u.id = r.saved_by
         WHERE r.entity_type = ? AND r.entity_id = ?
         ORDER BY r.created_at DESC LIMIT 50`,
        entityType,
        c.req.param("id"),
      );
      return c.json(rows);
    },
    async restore(c: Context<AppContext>) {
      const { id, revId } = c.req.param() as { id: string; revId: string };
      const rev = await first<{ snapshot_json: string }>(
        c.env.DB,
        `SELECT snapshot_json FROM content_revisions
         WHERE id = ? AND entity_type = ? AND entity_id = ?`,
        revId,
        entityType,
        id,
      );
      if (!rev) return c.json({ error: "Revision not found" }, 404);
      let snapshot: Record<string, unknown>;
      try {
        snapshot = JSON.parse(rev.snapshot_json) as Record<string, unknown>;
      } catch {
        return c.json({ error: "Revision snapshot is corrupt" }, 500);
      }
      // Restores are undoable: snapshot the current state first.
      await snapshotRevision(c.env.DB, entityType, id, c.var.userId);
      const sets = restorableColumns.map((col) => `${col} = ?`);
      const params = restorableColumns.map((col) => snapshot[col] ?? null);
      await run(
        c.env.DB,
        `UPDATE ${ENTITY_TABLE[entityType]} SET ${sets.join(", ")} WHERE id = ?`,
        ...params,
        id,
      );
      await writeAudit(c.env.DB, c.var.userId, `${entityType}.restore`, entityType, id, { revId });
      return c.json({ ok: true });
    },
  };
}

// ============================================================
// Pages
// ============================================================
adminContentRoutes.get("/pages", async (c) => {
  const rows = await all(
    c.env.DB,
    `SELECT id, slug, title, body_md, layout, hero_image_url, hero_eyebrow, subtitle,
            is_published, updated_at
     FROM pages ORDER BY slug`,
  );
  return c.json(rows);
});

adminContentRoutes.post("/pages", requireAdminWrite, async (c) => {
  const body = await parseBody(c, pageCreateSchema);
  const existing = await first(c.env.DB, `SELECT id FROM pages WHERE slug = ?`, body.slug);
  if (existing) return c.json({ error: "A page with that slug already exists" }, 409);
  const id = newId("pg");
  await run(
    c.env.DB,
    `INSERT INTO pages (id, slug, title, body_md, layout, hero_image_url, hero_eyebrow, subtitle, is_published)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    body.slug,
    body.title,
    body.bodyMd ?? "",
    body.layout ?? "standard",
    body.heroImageUrl ?? null,
    body.heroEyebrow ?? null,
    body.subtitle ?? null,
    body.isPublished === false ? 0 : 1,
  );
  await writeAudit(c.env.DB, c.var.userId, "page.create", "page", id, { slug: body.slug });
  return c.json({ id, slug: body.slug }, 201);
});

adminContentRoutes.patch("/pages/:id", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  const body = await parseBody(c, pageUpdateSchema);
  const existing = await first(c.env.DB, `SELECT id FROM pages WHERE id = ?`, id);
  if (!existing) return c.json({ error: "Page not found" }, 404);

  await snapshotRevision(c.env.DB, "page", id, c.var.userId);
  const fieldMap: Record<string, string> = {
    title: "title",
    layout: "layout",
    heroImageUrl: "hero_image_url",
    heroEyebrow: "hero_eyebrow",
    subtitle: "subtitle",
  };
  const sets: string[] = [`updated_at = datetime('now')`];
  const params: unknown[] = [];
  for (const [key, col] of Object.entries(fieldMap)) {
    if (key in body) {
      sets.push(`${col} = ?`);
      params.push((body as Record<string, unknown>)[key] ?? null);
    }
  }
  if (body.bodyMd !== undefined) {
    sets.push(`body_md = ?`);
    params.push(body.bodyMd ?? "");
  }
  if (body.isPublished !== undefined) {
    sets.push(`is_published = ?`);
    params.push(body.isPublished ? 1 : 0);
  }
  await run(c.env.DB, `UPDATE pages SET ${sets.join(", ")} WHERE id = ?`, ...params, id);
  await writeAudit(c.env.DB, c.var.userId, "page.update", "page", id);
  return c.json({ ok: true });
});

adminContentRoutes.delete("/pages/:id", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  // Final snapshot lands in content_revisions before the row disappears.
  await snapshotRevision(c.env.DB, "page", id, c.var.userId);
  const result = await run(c.env.DB, `DELETE FROM pages WHERE id = ?`, id);
  if (!result.meta.changes) return c.json({ error: "Page not found" }, 404);
  await writeAudit(c.env.DB, c.var.userId, "page.delete", "page", id);
  return c.json({ ok: true });
});

const pageRevisions = revisionRoutes("page", [
  "title",
  "body_md",
  "layout",
  "hero_image_url",
  "hero_eyebrow",
  "subtitle",
  "is_published",
]);
adminContentRoutes.get("/pages/:id/revisions", (c) => pageRevisions.list(c));
adminContentRoutes.post("/pages/:id/revisions/:revId/restore", requireAdminWrite, (c) =>
  pageRevisions.restore(c),
);

// ============================================================
// Homepage hero (settings-backed, no revision history — it's one row)
// ============================================================
adminContentRoutes.get("/home-hero", async (c) => {
  const row = await first<{ value: string }>(
    c.env.DB,
    `SELECT value FROM settings WHERE key = 'home_hero'`,
  );
  let hero: Record<string, unknown> = {};
  try {
    hero = row ? (JSON.parse(row.value) as Record<string, unknown>) : {};
  } catch {
    /* fall through to empty */
  }
  return c.json(hero);
});

adminContentRoutes.put("/home-hero", requireAdminWrite, async (c) => {
  const body = await parseBody(c, homeHeroSchema);
  await run(
    c.env.DB,
    `INSERT INTO settings (key, value, description)
     VALUES ('home_hero', ?, 'Homepage hero content (JSON) — edited under Admin → Content → Pages')
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    JSON.stringify(body),
  );
  await writeAudit(c.env.DB, c.var.userId, "home_hero.update", "settings", "home_hero", {
    heading: body.heading,
  });
  return c.json({ ok: true });
});

// ============================================================
// AI content drafting — a short interview becomes a ready draft
// ============================================================
const LENGTH_WORDS: Record<string, string> = {
  short: "roughly 150 words",
  medium: "roughly 350 words",
  long: "roughly 700 words",
};

adminContentRoutes.post("/ai-draft", requireAdminWrite, async (c) => {
  const body = await parseBody(c, aiDraftSchema);
  const brandName = await getBrandName(c.env);
  const tagline = await first<{ value: string }>(
    c.env.DB,
    `SELECT value FROM settings WHERE key = 'brand_tagline'`,
  );

  const kindLabel = body.kind === "journal" ? "journal (blog) post" : "site page";
  const prompt = [
    `Draft a ${kindLabel} for the brand's website.`,
    ``,
    `What it should cover: ${body.topic}`,
    body.audience ? `Who it's for: ${body.audience}` : null,
    body.tone ? `Tone: ${body.tone}` : null,
    body.keyPoints ? `Points that must be included:\n${body.keyPoints}` : null,
    `Target length: ${LENGTH_WORDS[body.length ?? "medium"]}.`,
    ``,
    `Respond with a single JSON object, nothing else:`,
    `{`,
    `  "title": "page title (plain text, no markdown)",`,
    `  "slug": "url-slug-suggestion-in-kebab-case",`,
    body.kind === "journal"
      ? `  "excerpt": "1–2 sentence summary for the journal index",`
      : `  "subtitle": "one-sentence subtitle shown under the title",`,
    `  "heroEyebrow": "a 2–4 word kicker line",`,
    `  "bodyMd": "the full body in markdown — use ## section headings; do NOT repeat the title as a heading"`,
    `}`,
  ]
    .filter((line) => line !== null)
    .join("\n");

  try {
    const result = await askClaude(c.env, {
      system:
        `You are the in-house content editor for ${brandName}` +
        (tagline?.value ? ` (“${tagline.value}”)` : "") +
        `, an independent clothing brand with a refined, editorial voice: concrete, warm, never ` +
        `salesy, no exclamation marks, no clichés like "elevate" or "timeless". Write like a good ` +
        `magazine, not an ad. You always respond with exactly one JSON object and no surrounding prose.`,
      prompt,
      maxTokens: 3000,
    });
    const draft = parseModelJson(result.text) as Record<string, unknown>;
    if (typeof draft.title !== "string" || typeof draft.bodyMd !== "string") {
      return c.json({ error: "The model returned an unusable draft — try again" }, 502);
    }
    await writeAudit(c.env.DB, c.var.userId, "content.ai_draft", body.kind, null, {
      topic: body.topic.slice(0, 200),
      tokensOut: result.tokensOut,
    });
    return c.json({
      title: draft.title,
      slug: typeof draft.slug === "string" ? draft.slug : null,
      excerpt: typeof draft.excerpt === "string" ? draft.excerpt : null,
      subtitle: typeof draft.subtitle === "string" ? draft.subtitle : null,
      heroEyebrow: typeof draft.heroEyebrow === "string" ? draft.heroEyebrow : null,
      bodyMd: draft.bodyMd,
    });
  } catch (err) {
    if (err instanceof AnthropicNotConfiguredError) {
      return c.json(
        { error: "AI drafting needs an Anthropic API key — add ANTHROPIC_API_KEY in Settings" },
        503,
      );
    }
    throw err;
  }
});

// ============================================================
// Journal
// ============================================================
adminContentRoutes.get("/journal", async (c) => {
  const rows = await all(
    c.env.DB,
    `SELECT id, slug, title, excerpt, body_md, hero_image_url, author, published_at, is_published, created_at
     FROM journal_posts ORDER BY COALESCE(published_at, created_at) DESC`,
  );
  return c.json(rows);
});

adminContentRoutes.post("/journal", requireAdminWrite, async (c) => {
  const body = await parseBody(c, journalCreateSchema);
  const existing = await first(c.env.DB, `SELECT id FROM journal_posts WHERE slug = ?`, body.slug);
  if (existing) return c.json({ error: "A post with that slug already exists" }, 409);
  const id = newId("jp");
  await run(
    c.env.DB,
    `INSERT INTO journal_posts (id, slug, title, excerpt, body_md, hero_image_url, author, published_at, is_published)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    body.slug,
    body.title,
    body.excerpt ?? null,
    body.bodyMd ?? "",
    body.heroImageUrl ?? null,
    body.author ?? null,
    body.publishedAt ?? new Date().toISOString().slice(0, 10),
    body.isPublished ? 1 : 0,
  );
  await writeAudit(c.env.DB, c.var.userId, "journal.create", "journal_post", id, {
    slug: body.slug,
  });
  return c.json({ id, slug: body.slug }, 201);
});

adminContentRoutes.patch("/journal/:id", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  const body = await parseBody(c, journalUpdateSchema);
  const existing = await first(c.env.DB, `SELECT id FROM journal_posts WHERE id = ?`, id);
  if (!existing) return c.json({ error: "Post not found" }, 404);

  await snapshotRevision(c.env.DB, "journal_post", id, c.var.userId);
  const fieldMap: Record<string, string> = {
    title: "title",
    excerpt: "excerpt",
    bodyMd: "body_md",
    heroImageUrl: "hero_image_url",
    author: "author",
    publishedAt: "published_at",
  };
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [key, col] of Object.entries(fieldMap)) {
    if (key in body) {
      sets.push(`${col} = ?`);
      params.push((body as Record<string, unknown>)[key] ?? null);
    }
  }
  if (body.isPublished !== undefined) {
    sets.push(`is_published = ?`);
    params.push(body.isPublished ? 1 : 0);
  }
  if (sets.length === 0) return c.json({ error: "No fields to update" }, 400);
  await run(c.env.DB, `UPDATE journal_posts SET ${sets.join(", ")} WHERE id = ?`, ...params, id);
  await writeAudit(c.env.DB, c.var.userId, "journal.update", "journal_post", id);
  return c.json({ ok: true });
});

adminContentRoutes.delete("/journal/:id", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  await snapshotRevision(c.env.DB, "journal_post", id, c.var.userId);
  const result = await run(c.env.DB, `DELETE FROM journal_posts WHERE id = ?`, id);
  if (!result.meta.changes) return c.json({ error: "Post not found" }, 404);
  await writeAudit(c.env.DB, c.var.userId, "journal.delete", "journal_post", id);
  return c.json({ ok: true });
});

const journalRevisions = revisionRoutes("journal_post", [
  "title",
  "excerpt",
  "body_md",
  "hero_image_url",
  "author",
  "published_at",
  "is_published",
]);
adminContentRoutes.get("/journal/:id/revisions", (c) => journalRevisions.list(c));
adminContentRoutes.post("/journal/:id/revisions/:revId/restore", requireAdminWrite, (c) =>
  journalRevisions.restore(c),
);

// ============================================================
// Collections
// ============================================================
adminContentRoutes.patch("/collections/:id", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  const body = await parseBody(c, collectionUpdateSchema);
  const existing = await first(c.env.DB, `SELECT id FROM collections WHERE id = ?`, id);
  if (!existing) return c.json({ error: "Collection not found" }, 404);

  await snapshotRevision(c.env.DB, "collection", id, c.var.userId);
  const fieldMap: Record<string, string> = {
    name: "name",
    season: "season",
    description: "description",
    editorialCopy: "editorial_copy",
    heroImageUrl: "hero_image_url",
    sortOrder: "sort_order",
  };
  const sets: string[] = [`updated_at = datetime('now')`];
  const params: unknown[] = [];
  for (const [key, col] of Object.entries(fieldMap)) {
    if (key in body) {
      sets.push(`${col} = ?`);
      params.push((body as Record<string, unknown>)[key] ?? null);
    }
  }
  if (body.isPublished !== undefined) {
    sets.push(`is_published = ?`);
    params.push(body.isPublished ? 1 : 0);
  }
  await run(c.env.DB, `UPDATE collections SET ${sets.join(", ")} WHERE id = ?`, ...params, id);
  await writeAudit(c.env.DB, c.var.userId, "collection.update", "collection", id);
  return c.json({ ok: true });
});

// ============================================================
// Lookbooks
// ============================================================
adminContentRoutes.get("/lookbooks", async (c) => {
  const books = await all<Record<string, unknown>>(
    c.env.DB,
    `SELECT id, slug, title, season, intro_copy, is_published FROM lookbooks ORDER BY created_at DESC`,
  );
  const result = [];
  for (const book of books) {
    const images = await all(
      c.env.DB,
      `SELECT li.id, li.image_url, li.caption, li.sort_order, li.product_id,
              p.name AS product_name
       FROM lookbook_images li
       LEFT JOIN products p ON p.id = li.product_id
       WHERE li.lookbook_id = ? ORDER BY li.sort_order`,
      book.id,
    );
    result.push({ ...book, images });
  }
  return c.json(result);
});

adminContentRoutes.patch("/lookbooks/:id", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  const body = await parseBody(c, lookbookUpdateSchema);
  const existing = await first(c.env.DB, `SELECT id FROM lookbooks WHERE id = ?`, id);
  if (!existing) return c.json({ error: "Lookbook not found" }, 404);

  await snapshotRevision(c.env.DB, "lookbook", id, c.var.userId);
  const sets: string[] = [];
  const params: unknown[] = [];
  if (body.title !== undefined) {
    sets.push(`title = ?`);
    params.push(body.title);
  }
  if (body.season !== undefined) {
    sets.push(`season = ?`);
    params.push(body.season);
  }
  if (body.introCopy !== undefined) {
    sets.push(`intro_copy = ?`);
    params.push(body.introCopy);
  }
  if (body.isPublished !== undefined) {
    sets.push(`is_published = ?`);
    params.push(body.isPublished ? 1 : 0);
  }
  if (sets.length === 0) return c.json({ error: "No fields to update" }, 400);
  await run(c.env.DB, `UPDATE lookbooks SET ${sets.join(", ")} WHERE id = ?`, ...params, id);
  await writeAudit(c.env.DB, c.var.userId, "lookbook.update", "lookbook", id);
  return c.json({ ok: true });
});

adminContentRoutes.post("/lookbooks/:id/images", requireAdminWrite, async (c) => {
  const lookbookId = c.req.param("id");
  const body = await parseBody(c, lookbookImageCreateSchema);
  const existing = await first(c.env.DB, `SELECT id FROM lookbooks WHERE id = ?`, lookbookId);
  if (!existing) return c.json({ error: "Lookbook not found" }, 404);
  const max = await first<{ m: number | null }>(
    c.env.DB,
    `SELECT MAX(sort_order) AS m FROM lookbook_images WHERE lookbook_id = ?`,
    lookbookId,
  );
  const id = newId("lbi");
  await run(
    c.env.DB,
    `INSERT INTO lookbook_images (id, lookbook_id, image_url, caption, sort_order) VALUES (?, ?, ?, ?, ?)`,
    id,
    lookbookId,
    body.imageUrl,
    body.caption ?? null,
    (max?.m ?? 0) + 1,
  );
  return c.json({ id }, 201);
});

adminContentRoutes.patch("/lookbooks/images/:imageId", requireAdminWrite, async (c) => {
  const imageId = c.req.param("imageId");
  const body = await parseBody(c, lookbookImageUpdateSchema);
  const sets: string[] = [];
  const params: unknown[] = [];
  if (body.caption !== undefined) {
    sets.push(`caption = ?`);
    params.push(body.caption);
  }
  if (body.sortOrder !== undefined) {
    sets.push(`sort_order = ?`);
    params.push(body.sortOrder);
  }
  if (body.productId !== undefined) {
    sets.push(`product_id = ?`);
    params.push(body.productId);
  }
  if (sets.length === 0) return c.json({ error: "No fields to update" }, 400);
  const result = await run(
    c.env.DB,
    `UPDATE lookbook_images SET ${sets.join(", ")} WHERE id = ?`,
    ...params,
    imageId,
  );
  if (!result.meta.changes) return c.json({ error: "Image not found" }, 404);
  return c.json({ ok: true });
});

adminContentRoutes.delete("/lookbooks/images/:imageId", requireAdminWrite, async (c) => {
  const result = await run(
    c.env.DB,
    `DELETE FROM lookbook_images WHERE id = ?`,
    c.req.param("imageId"),
  );
  if (!result.meta.changes) return c.json({ error: "Image not found" }, 404);
  return c.json({ ok: true });
});
