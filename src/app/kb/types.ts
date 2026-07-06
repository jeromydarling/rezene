/**
 * Knowledge Base content model. The canonical book lives in-repo (these types
 * + the content under kb/content) so a new feature ships its chapter in the
 * same change. A platform-level admin overlay (kb_overrides) can edit or add
 * articles on top at runtime — see the /api/admin/kb routes.
 */

export interface KbArticle {
  /** URL slug, unique across the whole book. */
  slug: string;
  title: string;
  /** One sentence — powers help-dot tooltips, search, and chapter cards. */
  summary: string;
  /** Part slug this article belongs to (see KB_PARTS). */
  part: string;
  /** The admin route this chapter documents, for an "Open the module" link. */
  moduleRoute?: string;
  /** Extra search terms beyond the title/body. */
  keywords?: string;
  /** Markdown body (docs-grade: headings, images, links, callouts, tables). */
  body: string;
  /** Hero screenshot path (e.g. /kb/shots/products.png). Hidden if missing. */
  screenshot?: string;
  /** ISO date the chapter was last meaningfully revised. */
  updated?: string;
  /** True for articles created via the admin overlay (not in-repo). */
  custom?: boolean;
}

export interface KbPart {
  slug: string;
  title: string;
  /** One-line description shown on the part card / TOC section. */
  description: string;
  /** Emoji or short glyph for the TOC. */
  icon?: string;
}

/** A resolved heading for the "On this page" rail. */
export interface KbHeading {
  id: string;
  text: string;
  level: number;
}
