import { first } from "./db";
import type { Env } from "../types/env";

/**
 * Brand name resolution for Worker-side rendering (tech pack exports,
 * email sender names). Settings table wins; the wrangler.toml var is
 * only the fallback for a fresh database.
 */
export async function getBrandName(env: Env, db: D1Database = env.DB): Promise<string> {
  try {
    const row = await first<{ value: string }>(
      db,
      `SELECT value FROM settings WHERE key = 'brand_name'`,
    );
    const value = row?.value?.trim();
    if (value) return value;
  } catch {
    // Fall through to the env fallback.
  }
  return env.BRAND_NAME;
}

/**
 * The brand's logo image URL for server-rendered documents (line sheets,
 * factory portal, …), or null when the shop uses a typeset wordmark (those
 * surfaces keep showing the name as text). Returns the stored `/media/<id>`
 * path, which resolves against the shop's own origin on the rendered page.
 */
export async function getBrandLogoUrl(db: D1Database): Promise<string | null> {
  try {
    const row = await first<{ value: string }>(
      db,
      `SELECT value FROM settings WHERE key = 'brand_logo'`,
    );
    if (!row?.value) return null;
    const logo = JSON.parse(row.value) as { kind?: string; imageUrl?: string | null };
    return logo.kind === "image" && logo.imageUrl ? logo.imageUrl : null;
  } catch {
    return null;
  }
}
