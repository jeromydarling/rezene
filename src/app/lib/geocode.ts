/**
 * Forward geocoding for the map surfaces: maker/supplier records carry text
 * locations ("Casablanca, Morocco"), not coordinates. Results cache in
 * localStorage forever (place names don't move) so each location geocodes
 * once per browser, and failures cache too (as null) so we never hammer the
 * API with the same unresolvable string.
 */
import { MAPBOX_TOKEN } from "./mapboxToken";

export type LngLat = [number, number];

const memCache = new Map<string, LngLat | null>();

function cacheKey(q: string): string {
  return `geo:${q.toLowerCase().trim()}`;
}

function readCache(q: string): LngLat | null | undefined {
  if (memCache.has(q)) return memCache.get(q);
  try {
    const raw = localStorage.getItem(cacheKey(q));
    if (raw === null) return undefined;
    const v = JSON.parse(raw) as LngLat | null;
    memCache.set(q, v);
    return v;
  } catch {
    return undefined;
  }
}

function writeCache(q: string, v: LngLat | null): void {
  memCache.set(q, v);
  try {
    localStorage.setItem(cacheKey(q), JSON.stringify(v));
  } catch {
    /* storage full — memory cache still works */
  }
}

export async function geocode(query: string): Promise<LngLat | null> {
  const q = query.trim();
  if (!q) return null;
  const hit = readCache(q);
  if (hit !== undefined) return hit;
  try {
    const url = `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(q)}&limit=1&access_token=${MAPBOX_TOKEN}`;
    const res = await fetch(url);
    if (!res.ok) return null; // don't cache transient failures
    const data = (await res.json()) as { features?: { geometry?: { coordinates?: number[] } }[] };
    const co = data.features?.[0]?.geometry?.coordinates;
    const v: LngLat | null = co && co.length >= 2 ? [co[0], co[1]] : null;
    writeCache(q, v);
    return v;
  } catch {
    return null;
  }
}

/** Geocode a batch (gently: 4 at a time). Returns query -> LngLat|null. */
export async function geocodeAll(queries: string[]): Promise<Map<string, LngLat | null>> {
  const unique = [...new Set(queries.map((q) => q.trim()).filter(Boolean))];
  const out = new Map<string, LngLat | null>();
  const batch = 4;
  for (let i = 0; i < unique.length; i += batch) {
    const slice = unique.slice(i, i + batch);
    const results = await Promise.all(slice.map((q) => geocode(q)));
    slice.forEach((q, j) => out.set(q, results[j]));
  }
  return out;
}
