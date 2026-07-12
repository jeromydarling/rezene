import type { KbArticle, KbPart } from "./types";
import { gettingStarted } from "./content/gettingStarted";
import { howTo } from "./content/howTo";
import { catalog } from "./content/catalog";
import { design } from "./content/design";
import { clients } from "./content/clients";
import { sourcing } from "./content/sourcing";
import { rdStudio } from "./content/rdStudio";
import { strategy } from "./content/strategy";
import { finance } from "./content/finance";
import { marketing } from "./content/marketing";
import { commerceAccount } from "./content/commerceAccount";
import { commerceNew } from "./content/commerceNew";
import { school } from "./content/school";
import { library } from "./content/library";
import { companion } from "./content/companion";
import { interpreter } from "./content/interpreter";
import { directory } from "./content/directory";
import { drafting } from "./content/drafting";

export type { KbArticle, KbPart, KbHeading } from "./types";

/** Parts in reading order — the book's table of contents. */
export const KB_PARTS: KbPart[] = [
  { slug: "getting-started", title: "Getting started", description: "What Verto is and how to find your way around.", icon: "🧭" },
  { slug: "how-to", title: "How-to guides", description: "Step-by-step walkthroughs of whole journeys — from first sketch to a maker's inbox.", icon: "🗺️" },
  { slug: "catalog", title: "Catalog & inventory", description: "Products, variants, stock, collections, and bulk import.", icon: "🏷️" },
  { slug: "design", title: "Design & development", description: "Styles, tech packs, the LLM Design Studio, and 3D.", icon: "✏️" },
  { slug: "clients", title: "Clients & commissions", description: "The Client Book, made-to-measure commissions, the client portal, deposits and booking.", icon: "🧵" },
  { slug: "sourcing", title: "Sourcing & production", description: "Makers, materials, samples, purchase orders, the board.", icon: "🏭" },
  { slug: "finance", title: "Costing & finance", description: "Cost sheets, duties & landed cost, shipping, analytics.", icon: "📊" },
  { slug: "marketing", title: "Marketing & content", description: "Campaigns, promo video, your CMS, and SEO.", icon: "📣" },
  { slug: "commerce", title: "Selling", description: "Orders, customers, pre-orders, and wholesale.", icon: "🛍️" },
  { slug: "account", title: "Account & platform", description: "Team, custom domain, settings, and help.", icon: "⚙️" },
];

/** The in-repo canonical book, in reading order. */
export const KB_ARTICLES: KbArticle[] = [
  ...gettingStarted,
  ...howTo,
  ...catalog,
  ...design,
  ...clients,
  ...sourcing,
  ...rdStudio,
  ...strategy,
  ...finance,
  ...marketing,
  ...commerceAccount,
  ...commerceNew,
  ...school,
  ...library,
  ...companion,
  ...interpreter,
  ...directory,
  ...drafting,
];

const BASE_ORDER = new Map(KB_ARTICLES.map((a, i) => [a.slug, i]));

/**
 * Merge the in-repo book with the platform admin overlay. Overrides patch an
 * existing article by slug; custom rows are appended to their part. Returns a
 * fresh ordered array (in-repo order first, custom articles after within part).
 */
export function mergeArticles(
  overlay: Partial<KbArticle>[] | null | undefined,
): KbArticle[] {
  if (!overlay || overlay.length === 0) return KB_ARTICLES;
  const bySlug = new Map(KB_ARTICLES.map((a) => [a.slug, { ...a }]));
  for (const o of overlay) {
    if (!o.slug) continue;
    const existing = bySlug.get(o.slug);
    if (existing) {
      bySlug.set(o.slug, { ...existing, ...clean(o), slug: existing.slug });
    } else if (o.title && o.body && o.part) {
      bySlug.set(o.slug, {
        slug: o.slug,
        title: o.title,
        summary: o.summary ?? "",
        part: o.part,
        body: o.body,
        moduleRoute: o.moduleRoute,
        keywords: o.keywords,
        screenshot: o.screenshot,
        updated: o.updated,
        custom: true,
      });
    }
  }
  return [...bySlug.values()].sort(
    (a, b) => (BASE_ORDER.get(a.slug) ?? 1e6) - (BASE_ORDER.get(b.slug) ?? 1e6),
  );
}

function clean<T extends object>(o: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(o)) {
    if (v !== undefined && v !== null && v !== "") (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

export function articlesByPart(articles: KbArticle[]): Map<string, KbArticle[]> {
  const map = new Map<string, KbArticle[]>();
  for (const p of KB_PARTS) map.set(p.slug, []);
  for (const a of articles) {
    if (!map.has(a.part)) map.set(a.part, []);
    map.get(a.part)!.push(a);
  }
  return map;
}

/** Article lookup for help-dots (uses the in-repo book; overlay applied in the reader). */
export function findArticle(slug: string): KbArticle | undefined {
  return KB_ARTICLES.find((a) => a.slug === slug);
}
