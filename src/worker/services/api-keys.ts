import { all, first, run } from "./db";
import { randomToken, sha256Hex } from "../utils/id";
import { getShopBySlug, PRIMARY_SHOP_ID } from "./shops";
import { getShopDb } from "./tenant-db";
import type { Env } from "../types/env";

/**
 * Personal access tokens (PATs) — the developer API's machine auth. Same
 * hashed-secret shape as the sessions table: only sha256Hex(secret) is stored,
 * the plaintext is shown once at creation.
 *
 * Token format: `vrto_<shopSlug>_<keyId>.<secret>`. The slug is baked in so a
 * bearer resolves the tenant with no `x-verto-shop` header (the same trick the
 * inbound webhook uses with its path slug), and scopes the call to exactly one
 * shop's database. Shop slugs are hyphenated (never underscored) and key ids
 * are hex, so splitting `<slug>_<keyId>` on the underscore is unambiguous.
 */

export interface ApiKeyContext {
  db: D1Database;
  shopId: string;
  shopSlug: string;
  keyId: string;
  roles: string[];
}

export interface MintedKey {
  id: string;
  token: string; // plaintext, shown once
  prefix: string;
}

const TOKEN_PREFIX = "vrto_";

/** Mint a PAT for a shop. `db` is that shop's database; `slug` bakes into the token. */
export async function mintApiKey(
  db: D1Database,
  slug: string,
  opts: { label?: string; roles?: string; expiresAt?: string | null },
): Promise<MintedKey> {
  const keyId = randomToken(6); // 12 hex chars, no underscore
  const secret = randomToken(24);
  const prefix = `${TOKEN_PREFIX}${slug}_${keyId}`;
  const token = `${prefix}.${secret}`;
  await run(
    db,
    `INSERT INTO api_keys (id, label, prefix, token_hash, roles, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    keyId,
    (opts.label ?? "").slice(0, 120),
    prefix,
    await sha256Hex(secret),
    opts.roles ?? "integration",
    opts.expiresAt ?? null,
  );
  return { id: keyId, token, prefix };
}

/** Parse + verify a bearer token, returning the resolved shop context or null. */
export async function verifyApiKey(env: Env, token: string): Promise<ApiKeyContext | null> {
  if (!token.startsWith(TOKEN_PREFIX)) return null;
  const dot = token.indexOf(".");
  if (dot < 0) return null;
  const left = token.slice(TOKEN_PREFIX.length, dot); // "<slug>_<keyId>"
  const secret = token.slice(dot + 1);
  const us = left.lastIndexOf("_");
  if (us < 0 || !secret) return null;
  const slug = left.slice(0, us);
  const keyId = left.slice(us + 1);
  if (!slug || !keyId) return null;

  const shop = await getShopBySlug(env.DB, slug);
  if (!shop) return null;
  const db = getShopDb(env, shop.id, PRIMARY_SHOP_ID);

  const row = await first<{ token_hash: string; roles: string; expires_at: string | null; revoked_at: string | null }>(
    db,
    `SELECT token_hash, roles, expires_at, revoked_at FROM api_keys WHERE id = ?`,
    keyId,
  ).catch(() => null);
  if (!row || row.revoked_at) return null;
  if (row.expires_at && Date.parse(row.expires_at + "Z") < Date.now()) return null;
  const presented = await sha256Hex(secret);
  // Length-checked equality (hashes are fixed length; still avoid early-exit shortcuts).
  if (presented.length !== row.token_hash.length || presented !== row.token_hash) return null;

  await run(db, `UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?`, keyId).catch(() => {});
  return { db, shopId: shop.id, shopSlug: shop.slug, keyId, roles: row.roles.split(",").map((r) => r.trim()).filter(Boolean) };
}

export async function listApiKeys(db: D1Database) {
  return all<{ id: string; label: string; prefix: string; roles: string; created_at: string; expires_at: string | null; last_used_at: string | null; revoked_at: string | null }>(
    db,
    `SELECT id, label, prefix, roles, created_at, expires_at, last_used_at, revoked_at
     FROM api_keys ORDER BY revoked_at IS NOT NULL, created_at DESC`,
  ).catch(() => []);
}

export async function revokeApiKey(db: D1Database, id: string): Promise<boolean> {
  const res = await run(db, `UPDATE api_keys SET revoked_at = datetime('now') WHERE id = ? AND revoked_at IS NULL`, id);
  return Boolean(res.meta.changes);
}
