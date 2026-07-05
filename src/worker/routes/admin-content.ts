import { Hono, type Context } from "hono";
import { all, first, run, writeAudit } from "../services/db";
import {
  aiDraftSchema,
  aiMetaSchema,
  aiRewriteSchema,
  brandVoiceSchema,
  collectionUpdateSchema,
  homeHeroSchema,
  journalCreateSchema,
  journalUpdateSchema,
  lookbookImageCreateSchema,
  lookbookImageUpdateSchema,
  lookbookUpdateSchema,
  navMenusSchema,
  pageCreateSchema,
  pageUpdateSchema,
  parseBody,
  siteStarterSchema,
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
            sections_json, publish_at, meta_title, meta_description,
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
    `INSERT INTO pages (id, slug, title, body_md, layout, hero_image_url, hero_eyebrow, subtitle,
                        sections_json, publish_at, meta_title, meta_description, is_published)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    body.slug,
    body.title,
    body.bodyMd ?? "",
    body.layout ?? "standard",
    body.heroImageUrl ?? null,
    body.heroEyebrow ?? null,
    body.subtitle ?? null,
    body.sections ? JSON.stringify(body.sections) : null,
    body.publishAt ?? null,
    body.metaTitle ?? null,
    body.metaDescription ?? null,
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
    publishAt: "publish_at",
    metaTitle: "meta_title",
    metaDescription: "meta_description",
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
  if (body.sections !== undefined) {
    sets.push(`sections_json = ?`);
    params.push(body.sections ? JSON.stringify(body.sections) : null);
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
  "sections_json",
  "publish_at",
  "meta_title",
  "meta_description",
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
// Draft preview token (share links for unpublished content)
// ============================================================
adminContentRoutes.get("/preview-token", async (c) => {
  const row = await first<{ value: string }>(
    c.env.DB,
    `SELECT value FROM settings WHERE key = 'preview_token'`,
  );
  return c.json({ token: row?.value ?? null });
});

// ============================================================
// Navigation (header/footer menus, settings-backed)
// ============================================================
adminContentRoutes.get("/navigation", async (c) => {
  const row = await first<{ value: string }>(
    c.env.DB,
    `SELECT value FROM settings WHERE key = 'nav_menus'`,
  );
  try {
    return c.json(row ? JSON.parse(row.value) : { header: [], footer: [] });
  } catch {
    return c.json({ header: [], footer: [] });
  }
});

adminContentRoutes.put("/navigation", requireAdminWrite, async (c) => {
  const body = await parseBody(c, navMenusSchema);
  await run(
    c.env.DB,
    `INSERT INTO settings (key, value, description)
     VALUES ('nav_menus', ?, 'Header/footer navigation (JSON) — edited under Admin → Content → Pages')
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    JSON.stringify(body),
  );
  await writeAudit(c.env.DB, c.var.userId, "navigation.update", "settings", "nav_menus", {
    headerCount: body.header.length,
    footerCount: body.footer.length,
  });
  return c.json({ ok: true });
});

// ============================================================
// Brand voice (consumed by every AI writing feature)
// ============================================================
async function loadBrandVoice(db: D1Database): Promise<string> {
  const row = await first<{ value: string }>(
    db,
    `SELECT value FROM settings WHERE key = 'brand_voice'`,
  );
  return row?.value?.trim() ?? "";
}

adminContentRoutes.get("/brand-voice", async (c) => {
  return c.json({ voice: await loadBrandVoice(c.env.DB) });
});

adminContentRoutes.put("/brand-voice", requireAdminWrite, async (c) => {
  const body = await parseBody(c, brandVoiceSchema);
  await run(
    c.env.DB,
    `INSERT INTO settings (key, value, description)
     VALUES ('brand_voice', ?, 'How the brand sounds — consumed by every AI writing feature')
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    body.voice,
  );
  await writeAudit(c.env.DB, c.var.userId, "brand_voice.update", "settings", "brand_voice");
  return c.json({ ok: true });
});

/**
 * Shared system prompt for every AI writing feature: brand identity plus
 * the shop's configurable voice. A shop that hasn't written a voice yet
 * gets a sane editorial default.
 */
async function writingSystem(env: Parameters<typeof getBrandName>[0]): Promise<string> {
  const brandName = await getBrandName(env);
  const tagline = await first<{ value: string }>(
    env.DB,
    `SELECT value FROM settings WHERE key = 'brand_tagline'`,
  );
  const voice = await loadBrandVoice(env.DB);
  return (
    `You are the in-house content editor for ${brandName}` +
    (tagline?.value ? ` (“${tagline.value}”)` : "") +
    `, an independent clothing brand. ` +
    (voice
      ? `The brand voice, defined by the owner — follow it closely:\n${voice}\n`
      : `Write in a refined, editorial voice: concrete, warm, never salesy, no exclamation ` +
        `marks, no clichés like "elevate" or "timeless". Write like a good magazine, not an ad. `)
  );
}

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
        (await writingSystem(c.env)) +
        `You always respond with exactly one JSON object and no surrounding prose.`,
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
// AI rewrite — selection-level editing inside the markdown editor
// ============================================================
adminContentRoutes.post("/ai-rewrite", requireAdminWrite, async (c) => {
  const body = await parseBody(c, aiRewriteSchema);
  try {
    const result = await askClaude(c.env, {
      system:
        (await writingSystem(c.env)) +
        `You rewrite the text you are given. Preserve markdown formatting. ` +
        `Output ONLY the rewritten text — no preamble, no explanation, no code fences.`,
      prompt: `Instruction: ${body.instruction}\n\nText to rewrite:\n${body.text}`,
      maxTokens: 4000,
    });
    const text = result.text.replace(/^```(?:markdown)?\n?|```$/g, "").trim();
    if (!text) return c.json({ error: "The model returned nothing — try again" }, 502);
    return c.json({ text });
  } catch (err) {
    if (err instanceof AnthropicNotConfiguredError) {
      return c.json({ error: "AI editing needs an Anthropic API key" }, 503);
    }
    throw err;
  }
});

// ============================================================
// AI meta — SEO title/description from the content
// ============================================================
adminContentRoutes.post("/ai-meta", requireAdminWrite, async (c) => {
  const body = await parseBody(c, aiMetaSchema);
  try {
    const result = await askClaude(c.env, {
      system:
        (await writingSystem(c.env)) +
        `You write search-optimized metadata. Respond with exactly one JSON object.`,
      prompt:
        `Write SEO metadata for this content.\n\nTitle: ${body.title}\n\nContent:\n${body.body.slice(0, 6000)}\n\n` +
        `Return JSON: {"metaTitle": "≤60 chars, compelling, includes the natural topic keyword", ` +
        `"metaDescription": "≤155 chars, specific and inviting, no clickbait"}`,
      maxTokens: 400,
    });
    const parsed = parseModelJson(result.text) as { metaTitle?: string; metaDescription?: string };
    if (!parsed.metaTitle && !parsed.metaDescription) {
      return c.json({ error: "The model returned unusable metadata — try again" }, 502);
    }
    return c.json({
      metaTitle: parsed.metaTitle ?? null,
      metaDescription: parsed.metaDescription ?? null,
    });
  } catch (err) {
    if (err instanceof AnthropicNotConfiguredError) {
      return c.json({ error: "AI metadata needs an Anthropic API key" }, 503);
    }
    throw err;
  }
});

// ============================================================
// AI site starter — one interview roughs in the whole site as drafts
// ============================================================
adminContentRoutes.post("/ai-site-starter", requireAdminWrite, async (c) => {
  const body = await parseBody(c, siteStarterSchema);
  const brandName = await getBrandName(c.env);

  const prompt = [
    `A new independent clothing brand called "${brandName}" is setting up its website. The owner answered:`,
    ``,
    `What they make: ${body.whatYouMake}`,
    body.whereMade ? `Where it's made: ${body.whereMade}` : null,
    body.audience ? `Who it's for: ${body.audience}` : null,
    body.pricePosture ? `Price posture: ${body.pricePosture}` : null,
    body.differentiator ? `What makes them different: ${body.differentiator}` : null,
    body.toneWords ? `Tone words they chose: ${body.toneWords}` : null,
    body.extras ? `Anything else: ${body.extras}` : null,
    ``,
    `Generate the starter content for their site. Respond with exactly one JSON object:`,
    `{`,
    `  "brandVoice": "3-5 sentences describing how this brand writes, plus 3-5 words/phrases it never uses",`,
    `  "homeHero": {"eyebrow": "2-5 word kicker", "heading": "≤10 word hero heading", "subheading": "1-2 sentences", "primaryCtaLabel": "...", "primaryCtaHref": "/products", "secondaryCtaLabel": "...", "secondaryCtaHref": "/story"},`,
    `  "pages": [`,
    `    {"slug": "story", "title": "...", "heroEyebrow": "...", "subtitle": "...", "bodyMd": "the brand story, ~350 words of markdown with ## headings", "metaDescription": "≤155 chars"},`,
    `    {"slug": "faq", "title": "...", "heroEyebrow": "...", "subtitle": "...", "bodyMd": "8-10 realistic Q&As as ## question / answer markdown", "metaDescription": "≤155 chars"},`,
    `    {"slug": "press", "title": "...", "heroEyebrow": "...", "subtitle": "...", "bodyMd": "a press/about page for journalists: facts, founding, materials, contacts placeholder, ~250 words", "metaDescription": "≤155 chars"}`,
    `  ],`,
    `  "journalPost": {"slug": "kebab-slug", "title": "...", "excerpt": "1-2 sentences", "bodyMd": "a first journal post introducing the brand, ~400 words markdown"}`,
    `}`,
  ]
    .filter((line) => line !== null)
    .join("\n");

  let bundle: {
    brandVoice?: string;
    homeHero?: Record<string, unknown>;
    pages?: { slug?: string; title?: string; heroEyebrow?: string; subtitle?: string; bodyMd?: string; metaDescription?: string }[];
    journalPost?: { slug?: string; title?: string; excerpt?: string; bodyMd?: string };
  };
  try {
    const result = await askClaude(c.env, {
      system:
        (await writingSystem(c.env)) +
        `You respond with exactly one JSON object and no surrounding prose.`,
      prompt,
      maxTokens: 8000,
    });
    bundle = parseModelJson(result.text) as typeof bundle;
  } catch (err) {
    if (err instanceof AnthropicNotConfiguredError) {
      return c.json({ error: "The site starter needs an Anthropic API key" }, 503);
    }
    throw err;
  }

  // Apply as drafts. Never touch a published page; never auto-apply the
  // hero (it has no draft state) — it's returned for explicit apply.
  const results: { item: string; status: "created" | "updated" | "skipped"; note?: string }[] = [];

  if (typeof bundle.brandVoice === "string" && bundle.brandVoice.trim()) {
    await run(
      c.env.DB,
      `INSERT INTO settings (key, value, description)
       VALUES ('brand_voice', ?, 'How the brand sounds — consumed by every AI writing feature')
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      bundle.brandVoice.trim(),
    );
    results.push({ item: "Brand voice", status: "updated" });
  }

  for (const page of bundle.pages ?? []) {
    if (!page.slug || !page.title || !page.bodyMd) continue;
    const slug = page.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const existing = await first<{ id: string; is_published: number }>(
      c.env.DB,
      `SELECT id, is_published FROM pages WHERE slug = ?`,
      slug,
    );
    if (existing && existing.is_published) {
      results.push({ item: `Page: ${slug}`, status: "skipped", note: "already published — left untouched" });
      continue;
    }
    if (existing) {
      await snapshotRevision(c.env.DB, "page", existing.id, c.var.userId);
      await run(
        c.env.DB,
        `UPDATE pages SET title = ?, body_md = ?, hero_eyebrow = ?, subtitle = ?, meta_description = ?,
           updated_at = datetime('now') WHERE id = ?`,
        page.title,
        page.bodyMd,
        page.heroEyebrow ?? null,
        page.subtitle ?? null,
        page.metaDescription ?? null,
        existing.id,
      );
      results.push({ item: `Page: ${slug}`, status: "updated", note: "existing draft refreshed" });
    } else {
      await run(
        c.env.DB,
        `INSERT INTO pages (id, slug, title, body_md, hero_eyebrow, subtitle, meta_description, is_published)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
        newId("pg"),
        slug,
        page.title,
        page.bodyMd,
        page.heroEyebrow ?? null,
        page.subtitle ?? null,
        page.metaDescription ?? null,
      );
      results.push({ item: `Page: ${slug}`, status: "created" });
    }
  }

  const post = bundle.journalPost;
  if (post?.slug && post.title && post.bodyMd) {
    const slug = post.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const existing = await first(c.env.DB, `SELECT id FROM journal_posts WHERE slug = ?`, slug);
    if (existing) {
      results.push({ item: `Journal: ${slug}`, status: "skipped", note: "slug already exists" });
    } else {
      await run(
        c.env.DB,
        `INSERT INTO journal_posts (id, slug, title, excerpt, body_md, is_published)
         VALUES (?, ?, ?, ?, ?, 0)`,
        newId("jp"),
        slug,
        post.title,
        post.excerpt ?? null,
        post.bodyMd,
      );
      results.push({ item: `Journal: ${slug}`, status: "created" });
    }
  }

  await writeAudit(c.env.DB, c.var.userId, "content.ai_site_starter", "settings", null, {
    results: results.map((r) => `${r.item}:${r.status}`),
  });
  return c.json({ results, homeHero: bundle.homeHero ?? null });
});

// ============================================================
// Journal
// ============================================================
adminContentRoutes.get("/journal", async (c) => {
  const rows = await all(
    c.env.DB,
    `SELECT id, slug, title, excerpt, body_md, hero_image_url, author, published_at,
            publish_at, meta_title, meta_description, is_published, created_at
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
    publishAt: "publish_at",
    metaTitle: "meta_title",
    metaDescription: "meta_description",
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
  "publish_at",
  "meta_title",
  "meta_description",
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
