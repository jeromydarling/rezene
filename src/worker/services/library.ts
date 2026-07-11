/**
 * The Timeless Library's source layer: live search against the Met's Open
 * Access API (CC0, keyless) and the Internet Archive (public-domain scans),
 * cached in platform D1 so the library builds itself as it is used. No bulk
 * import, no keys, no cost — the first request for a query pays the source
 * round-trip; everyone after reads the cache.
 *
 * Sources and their contracts (verified live):
 *  - Met search:   collectionapi.metmuseum.org/public/collection/v1/search
 *                  (quirk: the `q` parameter must come LAST or it returns 0)
 *    Met object:   …/v1/objects/{id} → isPublicDomain, primaryImageSmall
 *                  (images.metmuseum.org allows hotlinking for CC0 objects)
 *  - IA search:    archive.org/advancedsearch.php (JSON)
 *    IA metadata:  archive.org/metadata/{id} → imagecount
 *    IA pages:     iiif.archive.org/iiif/{id}${leaf}/full/{w},/0/default.jpg
 *    IA thumbs:    archive.org/services/img/{id}
 *
 * Everything degrades cleanly: a source that doesn't answer returns a clear
 * message, and cached results keep serving.
 */
import type { Env } from "../types/env";

export interface LibraryItem {
  key: string; // '<source>:<id>'
  source: "met" | "ia";
  kind: "plate" | "issue" | "book";
  title: string;
  creator: string | null;
  date: string | null;
  thumb: string | null; // small image for grids
  image: string | null; // large image for the drawer / pinning
  url: string; // the item's page at the source
  credit: string; // ready-to-quote citation line
}

const SEARCH_TTL_DAYS = 14;

// ---- platform-D1 cache ------------------------------------------------------

async function readSearchCache(env: Env, key: string): Promise<LibraryItem[] | null> {
  try {
    const row = await env.DB.prepare(
      `SELECT results FROM library_cache_searches
       WHERE key = ? AND cached_at > datetime('now', ?)`,
    )
      .bind(key, `-${SEARCH_TTL_DAYS} days`)
      .first<{ results: string }>();
    if (!row) return null;
    const parsed = JSON.parse(row.results) as LibraryItem[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function writeSearchCache(env: Env, key: string, items: LibraryItem[]): Promise<void> {
  try {
    await env.DB.prepare(
      `INSERT INTO library_cache_searches (key, results, cached_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET results = excluded.results, cached_at = datetime('now')`,
    )
      .bind(key, JSON.stringify(items))
      .run();
  } catch {
    /* cache is an optimization, never a failure */
  }
}

const fetchJson = async <T>(url: string): Promise<T> => {
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`source ${res.status}`);
  return (await res.json()) as T;
};

// ---- The Met ---------------------------------------------------------------

interface MetObject {
  objectID: number;
  isPublicDomain: boolean;
  primaryImageSmall?: string;
  primaryImage?: string;
  title?: string;
  objectDate?: string;
  artistDisplayName?: string;
  objectURL?: string;
  medium?: string;
  department?: string;
}

async function searchMet(env: Env, q: string, limit = 24, dept?: number): Promise<LibraryItem[]> {
  const cacheKey = `v1|plates|met${dept ? `-d${dept}` : ""}|${q.toLowerCase()}`;
  const cached = await readSearchCache(env, cacheKey);
  if (cached) return cached;

  // `q` must be the last query parameter — the Met API returns 0 otherwise.
  const search = await fetchJson<{ total: number; objectIDs: number[] | null }>(
    `https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true${dept ? `&departmentId=${dept}` : ""}&q=${encodeURIComponent(q)}`,
  );
  const ids = (search.objectIDs || []).slice(0, 60);
  const items: LibraryItem[] = [];

  // Object lookups run a few at a time until `limit` public-domain hits.
  const POOL = 8;
  let cursor = 0;
  const worker = async () => {
    while (cursor < ids.length && items.length < limit) {
      const id = ids[cursor++];
      try {
        const o = await fetchJson<MetObject>(
          `https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`,
        );
        if (!o.isPublicDomain || !o.primaryImageSmall) continue;
        if (items.length >= limit) return;
        items.push({
          key: `met:${o.objectID}`,
          source: "met",
          kind: "plate",
          title: o.title || "Untitled",
          creator: o.artistDisplayName || null,
          date: o.objectDate || null,
          thumb: o.primaryImageSmall,
          image: o.primaryImage || o.primaryImageSmall,
          url: o.objectURL || `https://www.metmuseum.org/art/collection/search/${o.objectID}`,
          credit: `${o.title || "Untitled"}${o.objectDate ? ` (${o.objectDate})` : ""} — The Metropolitan Museum of Art, Open Access (CC0)`,
        });
      } catch {
        /* one bad object never sinks the search */
      }
    }
  };
  await Promise.all(Array.from({ length: POOL }, worker));
  await writeSearchCache(env, cacheKey, items);
  return items;
}

// ---- The Internet Archive ----------------------------------------------------

interface IADoc {
  identifier: string;
  title?: string | string[];
  creator?: string | string[];
  date?: string;
  year?: string | number;
}

const iaStr = (v: string | string[] | undefined): string | null =>
  Array.isArray(v) ? v[0] || null : v || null;

const iaThumb = (id: string): string => `https://archive.org/services/img/${id}`;

export const iaPageUrl = (id: string, leaf: number, width = 880): string =>
  `https://iiif.archive.org/iiif/${encodeURIComponent(id)}$${leaf}/full/${width},/0/default.jpg`;

async function searchIABooks(env: Env, q: string, limit = 24): Promise<LibraryItem[]> {
  const cacheKey = `v1|books|ia|${q.toLowerCase()}`;
  const cached = await readSearchCache(env, cacheKey);
  if (cached) return cached;

  // Pre-1931 texts only: the library's public-domain line, enforced in the query.
  const query = `(${q}) AND mediatype:texts AND year:[1800 TO 1930] AND -collection:inlibrary`;
  const data = await fetchJson<{ response: { docs: IADoc[] } }>(
    `https://archive.org/advancedsearch.php?q=${encodeURIComponent(query)}&fl[]=identifier&fl[]=title&fl[]=creator&fl[]=year&rows=${limit}&sort[]=downloads+desc&output=json`,
  );
  const items: LibraryItem[] = (data.response?.docs || []).map((d) => ({
    key: `ia:${d.identifier}`,
    source: "ia",
    kind: "book",
    title: iaStr(d.title) || d.identifier,
    creator: iaStr(d.creator),
    date: d.year ? String(d.year) : null,
    thumb: iaThumb(d.identifier),
    image: iaThumb(d.identifier),
    url: `https://archive.org/details/${d.identifier}`,
    credit: `${iaStr(d.title) || d.identifier}${d.year ? ` (${d.year})` : ""} — Internet Archive, public domain`,
  }));
  await writeSearchCache(env, cacheKey, items);
  return items;
}

// ---- Magazines --------------------------------------------------------------

export interface MagazineCollection {
  key: string;
  title: string;
  publisher: string;
  years: [number, number];
  about: string;
  /** IA query for one year of issues. */
  yearQuery: (year: number) => string;
}

export const MAGAZINES: MagazineCollection[] = [
  {
    key: "vogue",
    title: "Vogue",
    publisher: "Condé Nast",
    years: [1892, 1929],
    about:
      "1,371 issues, from the very first (December 1892) through 1929 — the golden age covers, the plates, the advertisements, all of it.",
    yearQuery: (year) => `identifier:sim_vogue_${year}*`,
  },
  {
    key: "harpers",
    title: "Harper's Bazar",
    publisher: "Harper & Brothers / Hearst",
    years: [1867, 1929],
    about:
      "2,305 issues from 1867 — America's first fashion magazine, six decades of silhouettes in one searchable run.",
    yearQuery: (year) => `collection:pub_harpers-bazaar AND date:[${year}-01-01 TO ${year}-12-31]`,
  },
];

export async function magazineIssues(env: Env, key: string, year: number): Promise<LibraryItem[]> {
  const mag = MAGAZINES.find((m) => m.key === key);
  if (!mag) return [];
  const cacheKey = `v1|magazines|${key}|${year}`;
  const cached = await readSearchCache(env, cacheKey);
  if (cached) return cached;

  const data = await fetchJson<{ response: { docs: IADoc[] } }>(
    `https://archive.org/advancedsearch.php?q=${encodeURIComponent(mag.yearQuery(year))}&fl[]=identifier&fl[]=title&fl[]=date&rows=80&sort[]=date+asc&output=json`,
  );
  const items: LibraryItem[] = (data.response?.docs || []).map((d) => ({
    key: `ia:${d.identifier}`,
    source: "ia",
    kind: "issue",
    title: iaStr(d.title) || d.identifier,
    creator: mag.title,
    date: d.date ? d.date.slice(0, 10) : String(year),
    thumb: iaThumb(d.identifier),
    image: iaThumb(d.identifier),
    url: `https://archive.org/details/${d.identifier}`,
    credit: `${mag.title}, ${d.date ? d.date.slice(0, 10) : year} — Internet Archive, public domain`,
  }));
  await writeSearchCache(env, cacheKey, items);
  return items;
}

// ---- Issue metadata (the reader's bounds) ------------------------------------

export interface IssueMeta {
  iaId: string;
  title: string;
  date: string | null;
  leafCount: number;
}

export async function issueMeta(env: Env, iaId: string): Promise<IssueMeta | null> {
  try {
    const row = await env.DB.prepare(`SELECT * FROM library_cache_issues WHERE ia_id = ?`)
      .bind(iaId)
      .first<{ ia_id: string; title: string | null; date_text: string | null; leaf_count: number | null }>();
    if (row?.leaf_count) {
      return { iaId, title: row.title || iaId, date: row.date_text, leafCount: row.leaf_count };
    }
  } catch {
    /* fall through to live fetch */
  }

  const meta = await fetchJson<{
    metadata?: { title?: string | string[]; date?: string; imagecount?: string | number };
  }>(`https://archive.org/metadata/${encodeURIComponent(iaId)}`);
  const md = meta.metadata || {};
  const leafCount = Number(md.imagecount) || 0;
  if (!leafCount) return null;
  const out: IssueMeta = {
    iaId,
    title: iaStr(md.title) || iaId,
    date: md.date || null,
    leafCount,
  };
  try {
    await env.DB.prepare(
      `INSERT INTO library_cache_issues (ia_id, title, date_text, leaf_count, cached_at)
       VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT(ia_id) DO UPDATE SET title = excluded.title, date_text = excluded.date_text,
         leaf_count = excluded.leaf_count, cached_at = datetime('now')`,
    )
      .bind(iaId, out.title, out.date, out.leafCount)
      .run();
  } catch {
    /* cache only */
  }
  return out;
}

// ---- Room search dispatch -----------------------------------------------------

export async function librarySearch(
  env: Env,
  room: string,
  q: string,
  opts: { dept?: number } = {},
): Promise<{ items: LibraryItem[]; sources: string[] }> {
  if (room === "books" || room === "patterns") {
    // Patterns room searches the same text archive with a drafting bias.
    const query = room === "patterns" ? `${q} AND (subject:(dressmaking) OR subject:(tailoring) OR pattern OR drafting)` : q;
    return { items: await searchIABooks(env, query), sources: ["Internet Archive"] };
  }
  // Plates: the Met is the primary source; IA images could join later.
  return { items: await searchMet(env, q, 24, opts.dept), sources: ["The Met (CC0)"] };
}
