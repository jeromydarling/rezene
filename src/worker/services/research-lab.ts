import { all, first, run } from "./db";
import { perplexityConfigured, perplexityResearch } from "./perplexity";
import { reserveResearchQuotaFor } from "./ai-quota";
import { emit } from "./activity";
import { getShopDb } from "./tenant-db";
import { PRIMARY_SHOP_ID } from "./shops";
import { newId } from "../utils/id";
import type { Env } from "../types/env";

/**
 * The R&D research engines: brand dossiers, price studies, trend briefs and
 * stockist profiles, all built on the same live-research layer (Perplexity,
 * citations always) the makers directory uses. Routes call these after
 * reserving quota; the daily watch sweep calls them with its own reservation
 * from the SAME per-shop pool.
 *
 * Everything here writes markdown + citation URLs onto the entity and stamps
 * last_researched_at. Nothing invents contacts or prices — the system
 * prompts insist findings trace to sources, and the UI shows the sources.
 */

type DB = Parameters<typeof run>[0];

const ANALYST =
  "You are a fashion-industry research analyst working for an independent designer label. " +
  "Write concise markdown with short ## sections. Every concrete claim (a price, a stockist, " +
  "a launch, a material) must be supported by your sources — say 'not found in sources' rather " +
  "than guessing, and never invent contact details or prices.";

const clip = (t: string) => t.slice(0, 40000);
const citJson = (c: string[]) => JSON.stringify(c.slice(0, 20));

export interface BrandRow {
  id: string;
  name: string;
  website: string | null;
  instagram: string | null;
  segment: string;
  positioning: string | null;
  note: string | null;
  dossier_md: string | null;
  last_researched_at: string | null;
}

/** Research (or refresh) a competitor dossier. Keeps the previous dossier as
 *  a snapshot and, on refresh, asks for an explicit "What changed" section —
 *  that's the whole point of watching a brand. */
export async function researchBrand(db: DB, env: Env, brand: BrandRow): Promise<void> {
  const context = [
    `Brand: ${brand.name}`,
    brand.website ? `Website: ${brand.website}` : null,
    brand.instagram ? `Instagram: ${brand.instagram}` : null,
    `Relationship to us: ${brand.segment === "direct" ? "direct competitor" : brand.segment === "aspirational" ? "aspirational reference" : "adjacent category"}`,
    brand.positioning ? `Our current read: ${brand.positioning}` : null,
    brand.note ? `Notes: ${brand.note}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  const refresh = brand.dossier_md
    ? `\n\nThis is a REFRESH. Our previous dossier (from ${brand.last_researched_at ?? "earlier"}) follows between the markers. After the sections above, end with a "## What changed" section comparing against it — new products, price moves, new stockists, campaigns. If nothing meaningful changed, say so in one line.\n---PREVIOUS DOSSIER---\n${brand.dossier_md.slice(0, 6000)}\n---END PREVIOUS---`
    : "";
  const research = await perplexityResearch(env, {
    system: ANALYST,
    prompt:
      `Build a competition dossier on this fashion brand:\n${context}\n\n` +
      `Sections: ## Positioning (who they sell to, in two sentences) · ## Price architecture ` +
      `(entry / core / top prices for their main categories, with actual current prices) · ` +
      `## Channels & stockists (DTC, wholesale doors, marketplaces) · ## Recent moves ` +
      `(launches, collabs, campaigns from the last year) · ## Read for an independent label ` +
      `(what to learn or avoid, three bullets max).${refresh}`,
    maxTokens: 2200,
  });
  if (brand.dossier_md) {
    await run(
      db,
      `INSERT INTO research_brand_snapshots (id, brand_id, dossier_md, citations) VALUES (?, ?, ?, ?)`,
      newId("rbsnap"),
      brand.id,
      brand.dossier_md,
      (await first<{ citations: string | null }>(db, `SELECT citations FROM research_brands WHERE id = ?`, brand.id))?.citations ?? "[]",
    );
  }
  await run(
    db,
    `UPDATE research_brands SET dossier_md = ?, citations = ?, last_researched_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
    clip(research.text),
    citJson(research.citations),
    brand.id,
  );
}

export interface PriceStudyRow {
  id: string;
  name: string;
  category: string | null;
  market: string | null;
  currency: string;
}

/** Research a price study: named comparables at real prices + a banded
 *  recommendation. Comps stay a human-curated table — the research is the
 *  raw material, not silent rows. */
export async function researchPriceStudy(db: DB, env: Env, study: PriceStudyRow): Promise<void> {
  const research = await perplexityResearch(env, {
    system: ANALYST,
    prompt:
      `Price research for an independent label deciding retail pricing.\n` +
      `Study: ${study.name}\nCategory: ${study.category ?? study.name}\n` +
      `Market: ${study.market ?? "US direct-to-consumer"}\nCurrency: ${study.currency}\n\n` +
      `Sections: ## Comparables — a markdown table of 6-12 real garments currently on sale ` +
      `(Brand | Product | Price | Fabric | Made in), prices only from sources · ` +
      `## Price bands — where the accessible, core and premium bands sit for this category ` +
      `and market, as numbers · ## Recommendation — where a small-batch independent label ` +
      `with quality fabric should price, and why, referencing the comparables.`,
    maxTokens: 2200,
  });
  await run(
    db,
    `UPDATE price_studies SET recommendation_md = ?, citations = ?, last_researched_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
    clip(research.text),
    citJson(research.citations),
    study.id,
  );
}

export interface TrendBoardRow {
  id: string;
  title: string;
  season: string | null;
  focus: string;
  brief_md: string | null;
}

export async function researchTrendBoard(db: DB, env: Env, board: TrendBoardRow): Promise<void> {
  const refresh = board.brief_md
    ? `\n\nThis is a REFRESH — end with a "## What's new" section: what moved since the brief below.\n---PREVIOUS BRIEF---\n${board.brief_md.slice(0, 5000)}\n---END PREVIOUS---`
    : "";
  const research = await perplexityResearch(env, {
    system: ANALYST,
    prompt:
      `Trend scouting brief for a small-batch independent label.\n` +
      `Board: ${board.title}\nSeason: ${board.season ?? "upcoming"}\nFocus: ${board.focus}\n\n` +
      `Sections: ## The direction (what's actually happening, not hype) · ## Who's showing it ` +
      `(designers/brands with sources) · ## Materials & making (fabrics, treatments, trims that ` +
      `carry the look — and their small-batch availability) · ## Wear it forward (how an ` +
      `independent label produces this without chasing fast fashion, three bullets).${refresh}`,
    maxTokens: 2200,
  });
  await run(
    db,
    `UPDATE trend_boards SET brief_md = ?, citations = ?, last_researched_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
    clip(research.text),
    citJson(research.citations),
    board.id,
  );
}

export interface StockistRow {
  id: string;
  name: string;
  kind: string;
  city: string | null;
  country: string | null;
  website: string | null;
}

export async function researchStockist(db: DB, env: Env, stockist: StockistRow): Promise<void> {
  const research = await perplexityResearch(env, {
    system: ANALYST,
    prompt:
      `Profile this retailer as a potential stockist for an independent designer label.\n` +
      `Retailer: ${stockist.name} (${stockist.kind})\n` +
      `Location: ${[stockist.city, stockist.country].filter(Boolean).join(", ") || "unknown"}\n` +
      `${stockist.website ? `Website: ${stockist.website}\n` : ""}\n` +
      `Sections: ## What they carry (brands and categories, with price points) · ## Their ` +
      `customer (who shops there) · ## How they buy (submission process, buying seasons, ` +
      `trade shows they attend — only what the sources support) · ## Pitch angle (why an ` +
      `independent label fits or doesn't, two bullets).`,
    maxTokens: 1800,
  });
  await run(
    db,
    `UPDATE research_stockists SET dossier_md = ?, citations = ?, last_researched_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
    clip(research.text),
    citJson(research.citations),
    stockist.id,
  );
}

/** How stale a watched item may get before the sweep refreshes it. */
const WATCH_STALE_DAYS = 7;
/** Ceiling on sweep-initiated research calls per shop per day, inside the
 *  normal quota — automation should never be able to drain the whole pool. */
const WATCH_DAILY_CAP = 3;

/**
 * Daily watch sweep (06:00 cron): refresh watched brand dossiers and trend
 * boards that have gone stale, emit an activity event per refresh so the
 * change surfaces in the feed, the derived calendar, and the daily digest.
 * Draws from the shop's normal research quota, capped extra-conservatively.
 */
export async function researchWatchSweep(env: Env): Promise<void> {
  if (!perplexityConfigured(env)) return;
  const shops = await env.DB.prepare(`SELECT id FROM shops WHERE status = 'active'`).all<{ id: string }>();
  for (const shop of shops.results) {
    try {
      await sweepShop(env, shop.id);
    } catch (err) {
      console.error(`[research-watch] sweep failed for ${shop.id}:`, err);
    }
  }
}

async function sweepShop(env: Env, shopId: string): Promise<void> {
  const db = getShopDb(env, shopId, PRIMARY_SHOP_ID);

  // Rule toggle (Automations page): no row = enabled, like every rule.
  try {
    const row = await first<{ enabled: number }>(
      db,
      `SELECT enabled FROM automation_settings WHERE rule_key = 'research-watch-refresh'`,
    );
    if (row && !row.enabled) return;
  } catch {
    /* table not migrated yet — treat as enabled and let the selects decide */
  }

  let brands: BrandRow[] = [];
  let boards: TrendBoardRow[] = [];
  try {
    brands = await all<BrandRow>(
      db,
      `SELECT id, name, website, instagram, segment, positioning, note, dossier_md, last_researched_at
       FROM research_brands
       WHERE watch = 1 AND (last_researched_at IS NULL OR last_researched_at < datetime('now', ?))
       ORDER BY last_researched_at LIMIT ${WATCH_DAILY_CAP}`,
      `-${WATCH_STALE_DAYS} days`,
    );
    boards = await all<TrendBoardRow>(
      db,
      `SELECT id, title, season, focus, brief_md FROM trend_boards
       WHERE watch = 1 AND (last_researched_at IS NULL OR last_researched_at < datetime('now', ?))
       ORDER BY last_researched_at LIMIT ${WATCH_DAILY_CAP}`,
      `-${WATCH_STALE_DAYS} days`,
    );
  } catch {
    return; // shop DB predates 0043
  }

  let budget = WATCH_DAILY_CAP;
  for (const brand of brands) {
    if (budget <= 0) break;
    if (!(await reserveResearchQuotaFor(env, shopId)).ok) return;
    budget--;
    await researchBrand(db, env, brand);
    await emit(db, {
      kind: "research.brand_refreshed",
      entityType: "research_brand",
      entityId: brand.id,
      title: `Watched brand refreshed: ${brand.name} — see what changed in R&D`,
      payload: { name: brand.name },
    });
  }
  for (const board of boards) {
    if (budget <= 0) break;
    if (!(await reserveResearchQuotaFor(env, shopId)).ok) return;
    budget--;
    await researchTrendBoard(db, env, board);
    await emit(db, {
      kind: "research.trend_refreshed",
      entityType: "trend_board",
      entityId: board.id,
      title: `Watched trend refreshed: ${board.title} — see what's new in R&D`,
      payload: { title: board.title },
    });
  }
}
