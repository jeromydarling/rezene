import { first, run } from "./db";
import { hashPassword } from "./auth";
import { getShopDb } from "./tenant-db";
import {
  DEMO_SHOP_ID,
  DEMO_SHOP_SLUG,
  DEMO_VIEWER_EMAIL,
  DEMO_VIEWER_PASSWORD,
  PRIMARY_SHOP_ID,
} from "./shops";
import { DEMO_RICH_SEED_SQL, DEMO_SEED_SQL, DEMO_SEED_VERSION } from "../generated/demo-seed";
import { newId, randomToken } from "../utils/id";
import type { Env } from "../types/env";

/**
 * Bootstrap the public demo shop: a fake label ("Maison Atlantique") with
 * the full demo catalog — products, collections, tech packs, production
 * calendar, journal, lookbooks — so prospects see a lived-in workspace,
 * not an empty one.
 *
 * Safe to call unauthenticated and repeatedly:
 *  - creation happens once (registry hit skips it);
 *  - the "active studio" top-up seed re-applies only when its embedded
 *    version hash changes (all fixed *_demo_* ids + INSERT OR REPLACE, so a
 *    re-apply also heals anything a demo experiment might have bent);
 *  - the shared viewer login is upserted to the well-known public password
 *    (read-only role — see DEMO_VIEWER_PASSWORD).
 */
export async function bootstrapDemoShop(env: Env): Promise<{ created: boolean; slug: string }> {
  const existing = await first<{ id: string }>(
    env.DB,
    `SELECT id FROM shops WHERE slug = ?`,
    DEMO_SHOP_SLUG,
  );

  if (!existing) {
    await run(
      env.DB,
      `INSERT INTO shops (id, slug, name, status, owner_email, plan, note)
       VALUES (?, ?, ?, 'active', NULL, 'studio', 'Verto public demo shop — fake brand, seeded content')`,
      DEMO_SHOP_ID,
      DEMO_SHOP_SLUG,
      "Maison Atlantique",
    );
  }

  // First touch of the DO bootstraps the schema (and applies any migrations
  // that landed since the shop was created).
  const db = getShopDb(env, DEMO_SHOP_ID, PRIMARY_SHOP_ID);

  // Hard stop: demo seeds must NEVER touch the primary shop's bound D1.
  // (An early pre-DO seeding once bled demo orders into the real primary
  // shop — this makes that class of accident structurally impossible.)
  if ((db as unknown) === env.DB) {
    throw new Error("demo bootstrap refused: resolved to the primary shop database");
  }

  if (!existing) {
    const statements = splitStatements(DEMO_SEED_SQL);
    await db.batch(statements.map((sql) => db.prepare(sql)));

    // Settings the seed predates (the CMS/i18n/preview layers came later).
    const extras: [string, string, string][] = [
      ["preview_token", randomToken(12), "Static token that unlocks draft preview links."],
      ["supported_languages", '["en","fr"]', "Storefront languages."],
      ["brand_voice", "", "How the brand sounds — consumed by every LLM writing feature"],
    ];
    for (const [key, value, description] of extras) {
      await run(
        db,
        `INSERT OR IGNORE INTO settings (key, value, description) VALUES (?, ?, ?)`,
        key,
        value,
        description,
      );
    }
  }

  // Active-studio top-up: orders, commissions, production tasks, supplier
  // threads. Re-applied whenever the embedded seed version moves.
  const seeded = await first<{ value: string }>(
    db,
    `SELECT value FROM settings WHERE key = 'demo_seed_version'`,
  );
  let seedErrors: { i: number; msg: string; sql: string }[] = [];
  if (seeded?.value !== DEMO_SEED_VERSION) {
    const statements = splitStatements(DEMO_RICH_SEED_SQL);
    seedErrors = await applySeed(db, statements);
    // Only advance the version marker on a clean apply, so a later fix
    // re-runs the reseed instead of being skipped on a version match.
    if (seedErrors.length === 0) {
      await run(
        db,
        `INSERT OR REPLACE INTO settings (key, value, description)
         VALUES ('demo_seed_version', ?, 'Version hash of the applied demo seed — bootstrap re-applies on mismatch.')`,
        DEMO_SEED_VERSION,
      );
    }
  }

  // The shared gate account: viewer role only, so demo sessions are
  // read-only. The password is deliberately public (demo login card,
  // screenshot pipeline) — writes are blocked by role, not by secrecy.
  const viewer = await first<{ id: string }>(
    db,
    `SELECT id FROM users WHERE email = ?`,
    DEMO_VIEWER_EMAIL,
  );
  const passwordHash = await hashPassword(DEMO_VIEWER_PASSWORD);
  let userId = viewer?.id;
  if (userId) {
    await run(db, `UPDATE users SET password_hash = ? WHERE id = ?`, passwordHash, userId);
  } else {
    userId = newId("usr");
    await run(
      db,
      `INSERT INTO users (id, email, name, password_hash) VALUES (?, ?, ?, ?)`,
      userId,
      DEMO_VIEWER_EMAIL,
      "Demo viewer",
      passwordHash,
    );
  }
  await run(db, `INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, 'viewer')`, userId);

  return { created: !existing, slug: DEMO_SHOP_SLUG, seedErrors };
}

/**
 * Apply the rich seed in small chunks rather than one 200+ statement batch —
 * some DO/D1 batch implementations cap statements per call. On a chunk failure,
 * re-run its statements individually to isolate the offender, and collect the
 * errors instead of throwing so the rest of the seed still lands.
 */
async function applySeed(db: D1Database, statements: string[]): Promise<{ i: number; msg: string; sql: string }[]> {
  const errors: { i: number; msg: string; sql: string }[] = [];
  const CHUNK = 25;
  for (let start = 0; start < statements.length; start += CHUNK) {
    const chunk = statements.slice(start, start + CHUNK);
    try {
      await db.batch(chunk.map((sql) => db.prepare(sql)));
    } catch {
      // Isolate the failing statement(s) in this chunk.
      for (let j = 0; j < chunk.length; j++) {
        try {
          await db.prepare(chunk[j]).run();
        } catch (err) {
          errors.push({
            i: start + j,
            msg: String(err instanceof Error ? err.message : err).slice(0, 200),
            sql: chunk[j].slice(0, 120),
          });
        }
      }
    }
  }
  return errors;
}

/** Same statement discipline as the DO migrator (comment-stripped, ;\n split). */
function splitStatements(sql: string): string[] {
  const lines = sql.split("\n").filter((l) => !l.trim().startsWith("--"));
  return lines
    .join("\n")
    .split(/;\s*(?:\n|$)/)
    .map((s) => s.trim())
    .filter(Boolean);
}
