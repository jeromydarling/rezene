import { all, first, run } from "./db";
import { newId } from "../utils/id";
import type {
  LookbookLayout,
  LookbookProduct,
  LookbookRecord,
  LookbookRenderModel,
  LookbookSpec,
} from "../../shared/lookbook";

/**
 * Lookbook composition. A lookbook stores an ordered set of product ids +
 * layout choices (spec_json); everything else is resolved live from the
 * products table, so the magazine always reflects current price/story/imagery.
 * A missing/unpublished product simply drops out of the render (best effort) —
 * the lookbook never breaks because a piece was archived.
 */

const LAYOUT_CYCLE: LookbookLayout[] = ["hero", "editorial", "clean"];

function parseSpec(json: string | null | undefined): LookbookSpec {
  try {
    const p = json ? (JSON.parse(json) as Partial<LookbookSpec>) : {};
    const spreads = Array.isArray(p.spreads) ? p.spreads : [];
    return {
      spreads: spreads
        .filter((s) => s && typeof s.productId === "string")
        .map((s) => ({
          productId: s.productId,
          layout: (["hero", "editorial", "clean"] as const).includes(s.layout as LookbookLayout)
            ? (s.layout as LookbookLayout)
            : "clean",
          caption: typeof s.caption === "string" ? s.caption.slice(0, 400) : "",
        })),
    };
  } catch {
    return { spreads: [] };
  }
}

function rowToRecord(row: Record<string, unknown>): LookbookRecord {
  return {
    id: row.id as string,
    title: row.title as string,
    subtitle: (row.subtitle as string) ?? null,
    intro: (row.intro as string) ?? null,
    template: (row.template as string) ?? "lookbook",
    spec: parseSpec(row.spec_json as string),
    status: (row.status as string) ?? "draft",
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

/** Products that can appear in a lookbook: published + sellable, with their lead image. */
export async function availableProducts(db: D1Database): Promise<LookbookProduct[]> {
  const rows = await all<{
    id: string;
    name: string;
    subtitle: string | null;
    editorial_story: string | null;
    fabric_composition: string | null;
    origin_statement: string | null;
    base_price_cents: number;
    currency: string | null;
    image_url: string | null;
    image_alt: string | null;
  }>(
    db,
    `SELECT p.id, p.name, p.subtitle, p.editorial_story, p.fabric_composition,
            p.origin_statement, p.base_price_cents, p.currency,
            (SELECT url FROM product_images WHERE product_id = p.id ORDER BY sort_order LIMIT 1) AS image_url,
            (SELECT alt_text FROM product_images WHERE product_id = p.id ORDER BY sort_order LIMIT 1) AS image_alt
       FROM products p
      WHERE p.is_published = 1 AND p.availability IN ('available','pre_order','sold_out')
      ORDER BY p.sort_order, p.created_at`,
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    subtitle: r.subtitle,
    editorialStory: r.editorial_story,
    fabric: r.fabric_composition,
    origin: r.origin_statement,
    priceCents: r.base_price_cents,
    currency: r.currency ?? "USD",
    imageUrl: r.image_url,
    imageAlt: r.image_alt,
  }));
}

/** A starter spec from the shop's own catalogue: pieces with imagery first, layouts rotated. */
export function autoComposeSpec(products: LookbookProduct[], limit = 12): LookbookSpec {
  const withImages = products.filter((p) => p.imageUrl);
  const chosen = (withImages.length ? withImages : products).slice(0, limit);
  return {
    spreads: chosen.map((p, i) => ({
      productId: p.id,
      // Open on a hero, then rotate editorial/clean for rhythm.
      layout: i === 0 ? "hero" : LAYOUT_CYCLE[(i % 2) + 1],
      caption: "",
    })),
  };
}

export async function listLookbooks(db: D1Database): Promise<LookbookRecord[]> {
  const rows = await all(db, `SELECT * FROM print_lookbooks ORDER BY updated_at DESC`);
  return rows.map(rowToRecord);
}

export async function getLookbook(db: D1Database, id: string): Promise<LookbookRecord | null> {
  const row = await first(db, `SELECT * FROM print_lookbooks WHERE id = ?`, id);
  return row ? rowToRecord(row) : null;
}

export async function createLookbook(
  db: D1Database,
  input: { title?: string; subtitle?: string; intro?: string },
): Promise<LookbookRecord> {
  const id = newId("lookbook");
  const products = await availableProducts(db);
  const spec = autoComposeSpec(products);
  const title = input.title?.trim() || "New Lookbook";
  await run(
    db,
    `INSERT INTO print_lookbooks (id, title, subtitle, intro, template, spec_json)
     VALUES (?, ?, ?, ?, 'lookbook', ?)`,
    id,
    title,
    input.subtitle ?? null,
    input.intro ?? null,
    JSON.stringify(spec),
  );
  const created = await getLookbook(db, id);
  if (!created) throw new Error("Lookbook create failed");
  return created;
}

export async function updateLookbook(
  db: D1Database,
  id: string,
  patch: { title?: string; subtitle?: string | null; intro?: string | null; template?: string; spec?: LookbookSpec },
): Promise<LookbookRecord | null> {
  const sets: string[] = [`updated_at = datetime('now')`];
  const params: unknown[] = [];
  if (patch.title !== undefined) (sets.push("title = ?"), params.push(patch.title));
  if (patch.subtitle !== undefined) (sets.push("subtitle = ?"), params.push(patch.subtitle));
  if (patch.intro !== undefined) (sets.push("intro = ?"), params.push(patch.intro));
  if (patch.template !== undefined) (sets.push("template = ?"), params.push(patch.template));
  if (patch.spec !== undefined) (sets.push("spec_json = ?"), params.push(JSON.stringify(patch.spec)));
  const result = await run(db, `UPDATE print_lookbooks SET ${sets.join(", ")} WHERE id = ?`, ...params, id);
  if (!result.meta.changes) return null;
  return getLookbook(db, id);
}

export async function deleteLookbook(db: D1Database, id: string): Promise<boolean> {
  const result = await run(db, `DELETE FROM print_lookbooks WHERE id = ?`, id);
  return Boolean(result.meta.changes);
}

/** Resolve a lookbook into everything the print composer needs. */
export async function resolveRenderModel(db: D1Database, id: string): Promise<LookbookRenderModel | null> {
  const lookbook = await getLookbook(db, id);
  if (!lookbook) return null;
  const catalog = await availableProducts(db);
  const byId = new Map(catalog.map((p) => [p.id, p]));
  const spreads = lookbook.spec.spreads
    .map((s) => {
      const product = byId.get(s.productId);
      return product ? { product, layout: s.layout, caption: s.caption ?? "" } : null;
    })
    .filter((s): s is { product: LookbookProduct; layout: LookbookLayout; caption: string } => s !== null);
  return { lookbook, spreads, catalog };
}
