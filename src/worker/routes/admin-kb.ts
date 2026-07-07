import { Hono } from "hono";
import { requireSuperAdmin } from "../middleware/auth";
import { KB_PARTS } from "../../shared/kb-parts";
import type { AppContext } from "../types/env";

/**
 * Knowledge Base admin overlay. The canonical book ships in-repo (src/app/kb);
 * this exposes a platform-level overlay of edits/additions on top, plus an LLM
 * chapter drafter. Reads are open to any admin; writes are SuperAdmin-only
 * because the handbook is platform-wide (shared by every shop). Overrides live
 * in the bound platform DB (c.env.DB), like support tickets.
 */
export const adminKbRoutes = new Hono<AppContext>();

adminKbRoutes.get("/overrides", async (c) => {
  try {
    const rows = await c.env.DB.prepare(
      `SELECT slug, title, summary, part, module_route AS moduleRoute, body,
              screenshot, keywords, is_custom AS custom, updated_at AS updated
       FROM kb_overrides`,
    ).all();
    const articles = (rows.results ?? []).map((r) => ({
      ...r,
      custom: Boolean((r as { custom?: number }).custom),
    }));
    return c.json({ articles });
  } catch {
    // Table not migrated yet — the in-repo book stands alone.
    return c.json({ articles: [] });
  }
});

// Upsert an override: edit an in-repo chapter, or create a brand-new one.
adminKbRoutes.put("/overrides/:slug", requireSuperAdmin, async (c) => {
  const slug = c.req.param("slug").toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (!slug) return c.json({ error: "Bad slug" }, 400);
  const body = (await c.req.json().catch(() => ({}))) as {
    title?: string;
    summary?: string;
    part?: string;
    moduleRoute?: string;
    body?: string;
    keywords?: string;
    isCustom?: boolean;
  };
  const part = body.part && KB_PARTS.some((p) => p.slug === body.part) ? body.part : (body.part ?? null);
  await c.env.DB.prepare(
    `INSERT INTO kb_overrides (slug, title, summary, part, module_route, body, keywords, is_custom, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(slug) DO UPDATE SET
       title = excluded.title, summary = excluded.summary, part = excluded.part,
       module_route = excluded.module_route, body = excluded.body,
       keywords = excluded.keywords, updated_at = datetime('now')`,
  )
    .bind(
      slug,
      body.title ?? null,
      body.summary ?? null,
      part,
      body.moduleRoute ?? null,
      body.body ?? null,
      body.keywords ?? null,
      body.isCustom ? 1 : 0,
    )
    .run();
  return c.json({ ok: true, slug });
});

// Revert an override (in-repo chapter shows through again; custom chapter is removed).
adminKbRoutes.delete("/overrides/:slug", requireSuperAdmin, async (c) => {
  await c.env.DB.prepare(`DELETE FROM kb_overrides WHERE slug = ?`).bind(c.req.param("slug")).run();
  return c.json({ ok: true });
});

/**
 * Draft a chapter from a feature description. This is the "new feature → new
 * chapter" mechanism: describe what shipped and get a ready-to-edit chapter in
 * the handbook's house style. Returns the draft for review; nothing is saved
 * until the editor hits Save.
 */
adminKbRoutes.post("/draft", requireSuperAdmin, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    feature?: string;
    part?: string;
    moduleRoute?: string;
  };
  if (!body.feature?.trim()) return c.json({ error: "Describe the feature to document." }, 400);
  const { aiComplete } = await import("../services/ai");
  const partList = KB_PARTS.map((p) => `${p.slug} (${p.title})`).join(", ");
  try {
    const out = await aiComplete(c.env, {
      system:
        `You write chapters for Verto's product handbook — a warm, authoritative, plain-English field guide for independent fashion founders (Cloudflare-docs level, but human). Given a feature description, write ONE chapter. Respond with ONLY JSON: {"slug":"kebab-case-unique","title":"","summary":"one sentence","part":"one of: ${partList}","body":"Markdown: a # H1 title, then ## sections, short paragraphs, bullet lists, and > [!TIP]/[!NOTE]/[!WARNING] callouts where useful. Explain what it's for, the concept, and step-by-step how-tos. No screenshots."}. Keep the body focused and genuinely useful.`,
      prompt: `Feature to document: ${body.feature}${body.moduleRoute ? `\nModule route: ${body.moduleRoute}` : ""}${body.part ? `\nSuggested part: ${body.part}` : ""}`,
      maxTokens: 1600,
    });
    const { parseModelJson } = await import("../services/anthropic");
    let draft: Record<string, unknown> = {};
    try {
      const p = parseModelJson(out.text);
      if (p && typeof p === "object") draft = p as Record<string, unknown>;
    } catch {
      return c.json({ error: "The draft didn't come back cleanly — try again." }, 502);
    }
    return c.json({
      slug: String(draft.slug ?? "").toLowerCase().replace(/[^a-z0-9-]/g, "") || undefined,
      title: draft.title ?? "",
      summary: draft.summary ?? "",
      part: draft.part ?? body.part ?? "getting-started",
      moduleRoute: body.moduleRoute ?? null,
      body: draft.body ?? "",
    });
  } catch (err) {
    return c.json({ error: `Couldn't draft the chapter: ${String(err).slice(0, 160)}` }, 502);
  }
});
