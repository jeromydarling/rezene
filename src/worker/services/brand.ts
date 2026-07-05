import { first } from "./db";
import type { Env } from "../types/env";

/**
 * Brand name resolution for Worker-side rendering (tech pack exports,
 * email sender names). Settings table wins; the wrangler.toml var is
 * only the fallback for a fresh database.
 */
export async function getBrandName(env: Env): Promise<string> {
  try {
    const row = await first<{ value: string }>(
      env.DB,
      `SELECT value FROM settings WHERE key = 'brand_name'`,
    );
    const value = row?.value?.trim();
    if (value) return value;
  } catch {
    // Fall through to the env fallback.
  }
  return env.BRAND_NAME;
}
