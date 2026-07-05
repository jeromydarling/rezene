import { first, run } from "./db";
import { newId, randomToken, sha256Hex } from "../utils/id";
import type { Env } from "../types/env";
import type { SessionUser } from "../../shared/types";

/**
 * Application auth: PBKDF2 password hashing + opaque session tokens stored
 * hashed in D1. For production internal routes, fronting /admin with
 * Cloudflare Access is recommended (see README) — this app-level auth and
 * RBAC still applies underneath it.
 */

const PBKDF2_ITERATIONS = 100_000;
const SESSION_TTL_HOURS = 24 * 14;

export const SESSION_COOKIE = "ma_session";

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await deriveBits(password, salt);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toHex(salt)}$${toHex(new Uint8Array(bits))}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const salt = fromHex(parts[2]);
  const expected = parts[3];
  const bits = await deriveBits(password, salt, Number(parts[1]));
  return timingSafeEqualHex(toHex(new Uint8Array(bits)), expected);
}

async function deriveBits(
  password: string,
  salt: Uint8Array,
  iterations = PBKDF2_ITERATIONS,
): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    key,
    256,
  );
}

function toHex(buf: Uint8Array): string {
  return [...buf].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ---------- Sessions ----------

export async function createSession(
  db: D1Database,
  userId: string,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<{ token: string; expiresAt: string }> {
  const id = newId("ses");
  const secret = randomToken(32);
  const token = `${id}.${secret}`;
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 3600 * 1000).toISOString();
  await run(
    db,
    `INSERT INTO sessions (id, user_id, token_hash, expires_at, ip, user_agent)
     VALUES (?, ?, ?, ?, ?, ?)`,
    id,
    userId,
    await sha256Hex(secret),
    expiresAt,
    meta.ip ?? null,
    meta.userAgent ?? null,
  );
  return { token, expiresAt };
}

export async function destroySession(db: D1Database, token: string): Promise<void> {
  const [id] = token.split(".");
  if (id) await run(db, `DELETE FROM sessions WHERE id = ?`, id);
}

export async function resolveSession(
  db: D1Database,
  token: string | undefined,
): Promise<(SessionUser & { sessionId: string }) | null> {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const id = token.slice(0, dot);
  const secret = token.slice(dot + 1);
  const row = await first<{
    id: string;
    user_id: string;
    token_hash: string;
    expires_at: string;
    email: string;
    name: string | null;
    is_active: number;
  }>(
    db,
    `SELECT s.id, s.user_id, s.token_hash, s.expires_at, u.email, u.name, u.is_active
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.id = ?`,
    id,
  );
  if (!row || !row.is_active) return null;
  if (row.expires_at < new Date().toISOString()) return null;
  if (row.token_hash !== (await sha256Hex(secret))) return null;

  const roles = await db
    .prepare(`SELECT role_id FROM user_roles WHERE user_id = ?`)
    .bind(row.user_id)
    .all<{ role_id: string }>();
  return {
    id: row.user_id,
    email: row.email,
    name: row.name,
    roles: roles.results.map((r) => r.role_id),
    sessionId: row.id,
  };
}

/**
 * First-run bootstrap: if no user exists and the submitted credentials match
 * ADMIN_EMAIL / ADMIN_INITIAL_PASSWORD, create that user with the admin role.
 * The initial password should be rotated immediately after first login.
 */
export async function maybeBootstrapAdmin(
  env: Env,
  email: string,
  password: string,
): Promise<boolean> {
  // Secrets pasted into dashboards routinely pick up trailing whitespace or
  // a newline — trim both sides of the comparison. Whitespace at the edges
  // of a credential is never intentional.
  const adminEmail = env.ADMIN_EMAIL?.trim();
  const adminPassword = env.ADMIN_INITIAL_PASSWORD?.trim();
  if (!adminEmail || !adminPassword) return false;
  if (email.trim().toLowerCase() !== adminEmail.toLowerCase()) return false;
  if (password.trim() !== adminPassword) return false;

  const existing = await first<{ n: number }>(env.DB, `SELECT count(*) AS n FROM users`);
  if (existing && existing.n > 0) return false;

  const userId = newId("usr");
  await run(
    env.DB,
    `INSERT INTO users (id, email, name, password_hash) VALUES (?, ?, ?, ?)`,
    userId,
    adminEmail.toLowerCase(),
    "Founder",
    await hashPassword(adminPassword),
  );
  await run(env.DB, `INSERT INTO user_roles (user_id, role_id) VALUES (?, 'admin')`, userId);
  return true;
}
