import { first, run } from "./db";
import { newId, randomToken, sha256Hex } from "../utils/id";

/**
 * Shop owner email verification. Same hashed-token shape as password resets:
 * the plaintext token is `${shopId}.${secret}` (shop ids carry no dot), only
 * the SHA-256 of the secret is stored, and verifying stamps the shop registry.
 * Verification is idempotent and additive — it proves the owner controls the
 * address without gating instant provisioning.
 *
 * Platform-scoped: every query runs against the D1 `shops` registry.
 */

/** Mint a verification token for a shop's owner email; returns the plaintext. */
export async function createEmailVerification(db: D1Database, shopId: string, email: string): Promise<string> {
  const secret = randomToken(32);
  // Supersede any earlier unused token for this shop.
  await run(db, `DELETE FROM shop_email_verifications WHERE shop_id = ? AND verified_at IS NULL`, shopId);
  await run(
    db,
    `INSERT INTO shop_email_verifications (id, shop_id, email, token_hash) VALUES (?, ?, ?, ?)`,
    newId("evf"),
    shopId,
    email.toLowerCase(),
    await sha256Hex(secret),
  );
  return `${shopId}.${secret}`;
}

export type VerifyOutcome =
  | { ok: true; already: boolean; email: string }
  | { ok: false };

/** Validate a token and stamp the shop verified. Idempotent on re-clicks. */
export async function verifyEmailToken(db: D1Database, token: string): Promise<VerifyOutcome> {
  const dot = token.indexOf(".");
  if (dot < 1) return { ok: false };
  const shopId = token.slice(0, dot);
  const secret = token.slice(dot + 1);
  if (!secret) return { ok: false };
  const row = await first<{ id: string; email: string; verified_at: string | null }>(
    db,
    `SELECT id, email, verified_at FROM shop_email_verifications WHERE shop_id = ? AND token_hash = ?`,
    shopId,
    await sha256Hex(secret),
  );
  if (!row) return { ok: false };
  if (row.verified_at) return { ok: true, already: true, email: row.email };
  await run(db, `UPDATE shop_email_verifications SET verified_at = datetime('now') WHERE id = ?`, row.id);
  await run(
    db,
    `UPDATE shops SET email_verified_at = datetime('now') WHERE id = ? AND email_verified_at IS NULL`,
    shopId,
  );
  return { ok: true, already: false, email: row.email };
}
