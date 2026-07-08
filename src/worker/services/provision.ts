import { first, run } from "./db";
import { hashPassword } from "./auth";
import { sendBuyerEmail } from "./buyer-email";
import { sendNotification } from "./email";
import { getShopDb } from "./tenant-db";
import { PRIMARY_SHOP_ID, type Shop } from "./shops";
import { newId, randomToken } from "../utils/id";
import type { Env } from "../types/env";

/**
 * Turn a pending signup into a live shop:
 *  1. touch the shop's Durable Object database (first query bootstraps the
 *     full schema from the embedded migrations),
 *  2. seed the neutral baseline (roles, settings, homepage, legal drafts),
 *  3. create the owner's admin account with a generated password,
 *  4. flip the registry row to active (the slug starts routing instantly),
 *  5. email the owner their credentials (best effort — the credentials are
 *     also returned once to the platform admin who provisioned).
 */

export interface ProvisionResult {
  slug: string;
  adminEmail: string;
  /** Shown exactly once; only the hash is stored. */
  password: string;
  loginUrl: string;
}

function generatePassword(): string {
  // 3 chunks of hex, readable enough to retype once, rotated at first login.
  return `${randomToken(3)}-${randomToken(3)}-${randomToken(3)}`;
}

export async function provisionShop(
  env: Env,
  shop: Shop,
  ownerEmail: string,
  opts?: { brandImportUrl?: string | null },
): Promise<ProvisionResult> {
  const db = getShopDb(env, shop.id, PRIMARY_SHOP_ID);

  // Idempotency: a shop with users is already provisioned.
  const existingUsers = await first<{ n: number }>(db, `SELECT COUNT(*) AS n FROM users`);
  if ((existingUsers?.n ?? 0) > 0) {
    throw new Error("Shop already has users — refusing to re-provision");
  }

  // Roles (normally seeded by the demo migration, which shops don't get).
  await run(
    db,
    `INSERT OR IGNORE INTO roles (id, name, description) VALUES
       ('admin', 'Admin', 'Full access including settings and user management'),
       ('ops', 'Operations', 'Read/write on catalog, production, commerce, content'),
       ('viewer', 'Viewer', 'Read-only access to the admin')`,
  );

  // Baseline settings.
  const settings: [string, string, string][] = [
    ["brand_name", shop.name, "Brand display name"],
    ["brand_slug", shop.slug, "URL-safe brand identifier"],
    ["brand_tagline", "", "One-line tagline shown across the storefront"],
    ["default_currency", "USD", "Default checkout/display currency"],
    ["preview_token", randomToken(16), "Secret token for draft preview links"],
    ["brand_voice", "", "How the brand sounds — consumed by every LLM writing feature"],
    ["supported_languages", JSON.stringify(["en"]), "Storefront languages, first entry is the default"],
    [
      "home_hero",
      JSON.stringify({
        eyebrow: "New label",
        heading: shop.name,
        subheading: "Write your one-line story in Content → Pages → Homepage hero.",
        primaryCtaLabel: "Shop",
        primaryCtaHref: "/products",
        secondaryCtaLabel: null,
        secondaryCtaHref: null,
        imageUrl: null,
      }),
      "Homepage hero content (JSON) — edited under Admin → Content → Pages",
    ],
  ];
  // If they gave a current website at signup, queue a one-click brand import
  // that's waiting in the Brand Studio the first time they open it.
  if (opts?.brandImportUrl) {
    settings.push(["brand_import_url", opts.brandImportUrl, "Website queued for brand import (onboarding)"]);
  }
  for (const [key, value, description] of settings) {
    await run(
      db,
      `INSERT INTO settings (key, value, description) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      key,
      value,
      description,
    );
  }

  // Homepage as blocks + legal/shipping drafts to fill in (or site-start).
  await run(
    db,
    `INSERT OR IGNORE INTO pages (id, slug, title, body_md, layout, is_published, sections_json) VALUES
       (?, 'home', 'Homepage', '', 'standard', 1,
        '[{"type":"home_hero"},{"type":"product_grid","eyebrow":"New","heading":"The pieces","source":"featured","limit":4},{"type":"newsletter","heading":"Follow along.","body":"Occasional letters — new work, no noise.","kind":"newsletter"}]')`,
    newId("pg"),
  );
  for (const [slug, title] of [
    ["shipping-returns", "Shipping & Returns"],
    ["privacy", "Privacy"],
    ["terms", "Terms"],
  ]) {
    await run(
      db,
      `INSERT OR IGNORE INTO pages (id, slug, title, body_md, layout, is_published) VALUES (?, ?, ?, ?, 'standard', 0)`,
      newId("pg"),
      slug,
      title,
      `_Draft — write this before launch (the ✨ LLM drafting can rough it in)._`,
    );
  }

  // Owner admin account.
  const password = generatePassword();
  const userId = newId("usr");
  await run(
    db,
    `INSERT INTO users (id, email, name, password_hash) VALUES (?, ?, ?, ?)`,
    userId,
    ownerEmail.toLowerCase(),
    shop.name,
    await hashPassword(password),
  );
  await run(db, `INSERT INTO user_roles (user_id, role_id) VALUES (?, 'admin')`, userId);

  // Activate: the slug starts routing the moment this lands.
  await run(
    env.DB,
    `UPDATE shops SET status = 'active', updated_at = datetime('now') WHERE id = ?`,
    shop.id,
  );

  const appUrl = env.APP_URL.replace(/\/$/, "");
  const loginUrl = `${appUrl}/${shop.slug}/admin`;

  // Credentials to the owner (best effort), heads-up to the founder.
  await sendBuyerEmail(env, {
    to: ownerEmail,
    fromName: "Verto",
    subject: `Your shop is live: ${shop.name} on Verto`,
    text: [
      `Welcome to Verto — your shop is provisioned.`,
      ``,
      `  Storefront: ${appUrl}/${shop.slug}`,
      `  Admin:      ${loginUrl}`,
      `  Email:      ${ownerEmail.toLowerCase()}`,
      `  Password:   ${password}`,
      ``,
      `Change the password after your first login (Settings → password).`,
      `Start with Content → Pages → “Site starter” — eight questions and`,
      `your story, FAQ, press page, and first post are drafted for you.`,
    ].join("\n"),
  });
  await sendNotification(env, {
    subject: `Verto: provisioned ${shop.name} (/${shop.slug})`,
    text: `Shop /${shop.slug} is active. Owner: ${ownerEmail}.`,
  });

  // CRM timeline: the shop went live.
  const { ingestEvent } = await import("./crm");
  await ingestEvent(env, {
    email: ownerEmail,
    company: shop.name,
    shopId: shop.id,
    source: "signup",
    status: "trial",
    kind: "provision",
    subject: `Shop provisioned: ${shop.name} (/${shop.slug})`,
    metadata: { slug: shop.slug },
  });

  return { slug: shop.slug, adminEmail: ownerEmail.toLowerCase(), password, loginUrl };
}
