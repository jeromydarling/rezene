import { Hono } from "hono";
import type { AppContext } from "../types/env";

/**
 * Knowledge Base admin overlay. The canonical book ships in-repo (src/app/kb);
 * this exposes a platform-level overlay of edits/additions on top. Phase 1
 * returns an empty overlay so the reader loads cleanly; editing + the AI
 * chapter drafter are added on top of the kb_overrides table.
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
    // Table not migrated yet (Phase 4) — the in-repo book stands alone.
    return c.json({ articles: [] });
  }
});
