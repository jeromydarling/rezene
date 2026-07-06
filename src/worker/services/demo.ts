import { first, run } from "./db";
import { hashPassword } from "./auth";
import { getShopDb } from "./tenant-db";
import { DEMO_SHOP_ID, DEMO_SHOP_SLUG, DEMO_VIEWER_EMAIL, PRIMARY_SHOP_ID } from "./shops";
import { DEMO_SEED_SQL } from "../generated/demo-seed";
import { newId, randomToken } from "../utils/id";
import type { Env } from "../types/env";

/**
 * Bootstrap the public demo shop: a fake label ("Maison Atlantique") with
 * the full demo catalog — products, collections, tech packs, production
 * calendar, journal, lookbooks — so prospects see a lived-in workspace,
 * not an empty one. Idempotent: a registry hit makes it a no-op, so the
 * endpoint that calls this can stay unauthenticated (it can only ever
 * create this one fixed shop).
 */
export async function bootstrapDemoShop(env: Env): Promise<{ created: boolean; slug: string }> {
  const existing = await first<{ id: string }>(
    env.DB,
    `SELECT id FROM shops WHERE slug = ?`,
    DEMO_SHOP_SLUG,
  );
  if (existing) return { created: false, slug: DEMO_SHOP_SLUG };

  await run(
    env.DB,
    `INSERT INTO shops (id, slug, name, status, owner_email, plan, note)
     VALUES (?, ?, ?, 'active', NULL, 'studio', 'Verto public demo shop — fake brand, seeded content')`,
    DEMO_SHOP_ID,
    DEMO_SHOP_SLUG,
    "Maison Atlantique",
  );

  // First touch of the DO bootstraps the schema; then load the demo world.
  const db = getShopDb(env, DEMO_SHOP_ID, PRIMARY_SHOP_ID);
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

  // The gate account: viewer role only, so demo sessions are read-only.
  // The password is random and thrown away — sessions are minted directly
  // by the email gate, never via password login.
  const userId = newId("usr");
  await run(
    db,
    `INSERT INTO users (id, email, name, password_hash) VALUES (?, ?, ?, ?)`,
    userId,
    DEMO_VIEWER_EMAIL,
    "Demo viewer",
    await hashPassword(`${randomToken(6)}-${randomToken(6)}`),
  );
  await run(db, `INSERT INTO user_roles (user_id, role_id) VALUES (?, 'viewer')`, userId);

  return { created: true, slug: DEMO_SHOP_SLUG };
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
