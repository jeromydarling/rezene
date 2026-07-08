import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { all, first, run } from "../services/db";
import { sendBuyerEmail } from "../services/buyer-email";
import { getEmailBrand, renderBrandedEmail } from "../services/email-template";
import { rateLimit } from "../middleware/rate-limit";
import { newId, randomToken, sha256Hex } from "../utils/id";
import type { AppContext } from "../types/env";

/**
 * Storefront customer accounts — passwordless. A shopper asks for a link, we
 * email a one-time token, and clicking it mints a session cookie. From there
 * they can see orders + tracking, reorder in a tap, save addresses, and keep a
 * wishlist. Guest checkout is untouched; this is an optional, friendlier layer.
 *
 * Mounted at /api/public/account, so `c.var.db` is the shop's own database.
 */
export const accountRoutes = new Hono<AppContext>();

const COOKIE = "verto_customer";
const SESSION_DAYS = 60;
const LINK_MINUTES = 30;

async function currentCustomer(c: { req: Request; var: { db: D1Database } } & any) {
  const token = getCookie(c, COOKIE);
  if (!token) return null;
  const hash = await sha256Hex(token);
  const row = await first<{ customer_id: string; email: string; name: string | null }>(
    c.var.db,
    `SELECT s.customer_id, cu.email, cu.name
     FROM customer_sessions s JOIN customers cu ON cu.id = s.customer_id
     WHERE s.token_hash = ? AND s.expires_at > datetime('now')`,
    hash,
  );
  return row ?? null;
}

async function shopBaseUrl(c: any): Promise<string> {
  const origin = new URL(c.req.url).origin;
  const { getPrimaryShopBase } = await import("../services/shops");
  const shopBase = c.var.shopSlug ? `/${c.var.shopSlug}` : await getPrimaryShopBase(c.env.DB);
  const base = (c.env.APP_ENV === "development" ? origin : c.env.APP_URL || origin) + shopBase;
  return base;
}

// ---- Sign in: email a one-time link ----
accountRoutes.post(
  "/request-link",
  rateLimit({ key: "account_link", limit: 8, windowSeconds: 3600 }),
  async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { email?: string };
    const email = (body.email ?? "").trim().toLowerCase();
    // Always answer the same way — never reveal whether an email has an account.
    const ok = c.json({ ok: true });
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return ok;

    const customer = await first<{ id: string }>(
      c.var.db,
      `SELECT id FROM customers WHERE lower(email) = ?`,
      email,
    );
    // Accounts are for people who've bought (or been added). No row → no email,
    // but we still return ok so the response can't be used to probe for accounts.
    if (!customer) return ok;

    const token = randomToken(24);
    const hash = await sha256Hex(token);
    await run(
      c.var.db,
      `INSERT INTO customer_login_tokens (id, email, token_hash, expires_at)
       VALUES (?, ?, ?, datetime('now', '+${LINK_MINUTES} minutes'))`,
      newId("clt"),
      email,
      hash,
    );

    const link = `${await shopBaseUrl(c)}/account?token=${encodeURIComponent(token)}`;
    try {
      const brand = await getEmailBrand(c.env, c.var.db);
      const html = renderBrandedEmail({
        brand,
        preheader: `Your sign-in link for ${brand.name}`,
        heading: "Your sign-in link",
        bodyHtml:
          `<p style="margin:0 0 16px;">Tap the button below to sign in. It works once and expires in ${LINK_MINUTES} minutes.</p>` +
          `<p style="margin:0 0 20px;"><a href="${link}" style="display:inline-block;background:#1c2b3a;color:#fff;padding:12px 22px;border-radius:6px;text-decoration:none;">Sign in</a></p>` +
          `<p style="color:#6f695c;font-size:12px;margin:0;">If you didn't ask for this, you can ignore this email.</p>`,
        footerNote: "You're receiving this because someone entered this address to sign in.",
      });
      await sendBuyerEmail(c.env, {
        to: email,
        subject: `Sign in to ${brand.name}`,
        text: `Sign in to ${brand.name}:\n\n${link}\n\nThis link works once and expires in ${LINK_MINUTES} minutes. If you didn't ask for it, ignore this email.`,
        html,
      });
    } catch (err) {
      console.error("[account] link email failed:", String(err).slice(0, 160));
    }
    return ok;
  },
);

// ---- Verify a link → mint a session ----
accountRoutes.post("/verify", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { token?: string };
  const token = (body.token ?? "").trim();
  if (!token) return c.json({ error: "Missing link token." }, 400);
  const hash = await sha256Hex(token);
  const row = await first<{ id: string; email: string }>(
    c.var.db,
    `SELECT id, email FROM customer_login_tokens
     WHERE token_hash = ? AND consumed_at IS NULL AND expires_at > datetime('now')`,
    hash,
  );
  if (!row) return c.json({ error: "This link has expired — please request a new one." }, 400);
  await run(c.var.db, `UPDATE customer_login_tokens SET consumed_at = datetime('now') WHERE id = ?`, row.id);

  const customer = await first<{ id: string; name: string | null }>(
    c.var.db,
    `SELECT id, name FROM customers WHERE lower(email) = ?`,
    row.email.toLowerCase(),
  );
  if (!customer) return c.json({ error: "Account not found." }, 404);

  const sessionToken = randomToken(32);
  await run(
    c.var.db,
    `INSERT INTO customer_sessions (id, customer_id, token_hash, expires_at)
     VALUES (?, ?, ?, datetime('now', '+${SESSION_DAYS} days'))`,
    newId("csess"),
    customer.id,
    await sha256Hex(sessionToken),
  );
  setCookie(c, COOKIE, sessionToken, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 3600,
  });
  return c.json({ ok: true, name: customer.name });
});

accountRoutes.post("/logout", async (c) => {
  const token = getCookie(c, COOKIE);
  if (token) await run(c.var.db, `DELETE FROM customer_sessions WHERE token_hash = ?`, await sha256Hex(token));
  deleteCookie(c, COOKIE, { path: "/" });
  return c.json({ ok: true });
});

accountRoutes.get("/me", async (c) => {
  const me = await currentCustomer(c);
  if (!me) return c.json({ error: "Not signed in" }, 401);
  return c.json({ email: me.email, name: me.name });
});

// ---- Orders + tracking ----
accountRoutes.get("/orders", async (c) => {
  const me = await currentCustomer(c);
  if (!me) return c.json({ error: "Not signed in" }, 401);
  const rows = await all(
    c.var.db,
    `SELECT o.id, o.order_number AS orderNumber, o.total_cents AS totalCents, o.currency,
            o.payment_status AS paymentStatus, o.fulfillment_status AS fulfillmentStatus,
            o.is_pre_order AS isPreOrder, o.placed_at AS placedAt, o.created_at AS createdAt,
            (SELECT COALESCE(SUM(quantity),0) FROM order_items i WHERE i.order_id = o.id) AS itemCount
     FROM orders o
     WHERE (o.customer_id = ? OR lower(o.email) = ?) AND o.payment_status != 'pending'
     ORDER BY o.created_at DESC LIMIT 100`,
    me.customer_id,
    me.email.toLowerCase(),
  );
  return c.json({ orders: rows });
});

accountRoutes.get("/orders/:id", async (c) => {
  const me = await currentCustomer(c);
  if (!me) return c.json({ error: "Not signed in" }, 401);
  const order = await first<Record<string, unknown>>(
    c.var.db,
    `SELECT id, order_number, total_cents, subtotal_cents, shipping_cents, tax_cents, discount_cents,
            currency, payment_status, fulfillment_status, is_pre_order, shipping_address_json,
            placed_at, created_at
     FROM orders WHERE id = ? AND (customer_id = ? OR lower(email) = ?)`,
    c.req.param("id"),
    me.customer_id,
    me.email.toLowerCase(),
  );
  if (!order) return c.json({ error: "Order not found" }, 404);
  const items = await all(
    c.var.db,
    `SELECT description, quantity, unit_price_cents AS unitPriceCents, currency FROM order_items WHERE order_id = ?`,
    order.id,
  );
  const shipments = await all(
    c.var.db,
    `SELECT carrier, service, tracking_number AS trackingNumber, tracking_url AS trackingUrl, status
     FROM order_shipments WHERE order_id = ? ORDER BY created_at DESC`,
    order.id,
  );
  const itemsWithIds = await all(
    c.var.db,
    `SELECT id, variant_id AS variantId, description, quantity, unit_price_cents AS unitPriceCents, currency
     FROM order_items WHERE order_id = ?`,
    order.id,
  );
  const returns = await all(
    c.var.db,
    `SELECT id, status, created_at AS createdAt, refund_amount_cents AS refundAmountCents, currency
     FROM returns WHERE order_id = ? ORDER BY created_at DESC`,
    order.id,
  );
  const returnable = order.payment_status === "paid" || order.payment_status === "partially_refunded";
  return c.json({ order, items, itemsWithIds, shipments, returns, returnable });
});

// Start a return against a paid order — the shop reviews it from admin.
accountRoutes.post("/orders/:id/returns", async (c) => {
  const me = await currentCustomer(c);
  if (!me) return c.json({ error: "Not signed in" }, 401);
  const order = await first<{ id: string; currency: string; payment_status: string }>(
    c.var.db,
    `SELECT id, currency, payment_status FROM orders WHERE id = ? AND (customer_id = ? OR lower(email) = ?)`,
    c.req.param("id"),
    me.customer_id,
    me.email.toLowerCase(),
  );
  if (!order) return c.json({ error: "Order not found" }, 404);
  if (order.payment_status !== "paid" && order.payment_status !== "partially_refunded")
    return c.json({ error: "Only paid orders can be returned." }, 400);

  const body = (await c.req.json().catch(() => ({}))) as {
    reason?: string;
    note?: string;
    items?: { orderItemId: string; quantity: number }[];
  };
  const picks = (body.items ?? []).filter((i) => i.orderItemId && i.quantity > 0);
  if (picks.length === 0) return c.json({ error: "Choose at least one item to return." }, 400);

  const returnId = newId("ret");
  let total = 0;
  const rows: [string, string, string, string, number, number, string][] = [];
  for (const p of picks) {
    const oi = await first<{ id: string; variant_id: string | null; description: string; quantity: number; unit_price_cents: number; currency: string }>(
      c.var.db,
      `SELECT id, variant_id, description, quantity, unit_price_cents, currency FROM order_items WHERE id = ? AND order_id = ?`,
      p.orderItemId,
      order.id,
    );
    if (!oi) continue;
    const qty = Math.min(p.quantity, oi.quantity);
    total += oi.unit_price_cents * qty;
    rows.push([newId("ri"), returnId, oi.id, oi.variant_id ?? "", qty, oi.unit_price_cents, oi.currency]);
  }
  if (rows.length === 0) return c.json({ error: "Those items aren't on this order." }, 400);

  await run(
    c.var.db,
    `INSERT INTO returns (id, order_id, customer_id, status, reason, customer_note, refund_amount_cents, currency)
     VALUES (?, ?, ?, 'requested', ?, ?, ?, ?)`,
    returnId,
    order.id,
    me.customer_id,
    body.reason ?? null,
    body.note ?? null,
    total,
    order.currency,
  );
  for (const r of rows) {
    await run(
      c.var.db,
      `INSERT INTO return_items (id, return_id, order_item_id, variant_id, description, quantity, unit_price_cents, currency)
       VALUES (?, ?, ?, ?, (SELECT description FROM order_items WHERE id = ?), ?, ?, ?)`,
      r[0],
      r[1],
      r[2],
      r[3] || null,
      r[2],
      r[4],
      r[5],
      r[6],
    );
  }
  return c.json({ id: returnId }, 201);
});

// ---- Reorder: hand the SPA the still-buyable lines to drop in the cart ----
accountRoutes.get("/orders/:id/reorder", async (c) => {
  const me = await currentCustomer(c);
  if (!me) return c.json({ error: "Not signed in" }, 401);
  const order = await first<{ id: string }>(
    c.var.db,
    `SELECT id FROM orders WHERE id = ? AND (customer_id = ? OR lower(email) = ?)`,
    c.req.param("id"),
    me.customer_id,
    me.email.toLowerCase(),
  );
  if (!order) return c.json({ error: "Order not found" }, 404);
  const rows = await all<Record<string, unknown>>(
    c.var.db,
    `SELECT v.id AS variantId, p.slug AS productSlug, p.name AS productName,
            (v.colorway_name || ' / ' || v.size) AS variantLabel,
            COALESCE(v.price_cents, p.base_price_cents) AS priceCents,
            v.currency AS currency,
            (SELECT url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.sort_order LIMIT 1) AS imageUrl,
            v.is_active AS isActive, p.is_published AS isPublished
     FROM order_items oi
     JOIN product_variants v ON v.id = oi.variant_id
     JOIN products p ON p.id = v.product_id
     WHERE oi.order_id = ?`,
    order.id,
  );
  const items = rows
    .filter((r) => r.isActive && r.isPublished)
    .map((r) => ({
      variantId: r.variantId as string,
      productSlug: r.productSlug as string,
      productName: r.productName as string,
      variantLabel: r.variantLabel as string,
      priceCents: r.priceCents as number,
      currency: r.currency as string,
      isPreOrder: false,
      imageUrl: (r.imageUrl as string) ?? null,
    }));
  return c.json({ items, dropped: rows.length - items.length });
});

// ---- Saved addresses ----
accountRoutes.get("/addresses", async (c) => {
  const me = await currentCustomer(c);
  if (!me) return c.json({ error: "Not signed in" }, 401);
  const rows = await all(
    c.var.db,
    `SELECT id, name, line1, line2, city, region, postal_code AS postalCode, country, phone, is_default AS isDefault
     FROM customer_addresses WHERE customer_id = ? ORDER BY is_default DESC, created_at DESC`,
    me.customer_id,
  );
  return c.json({ addresses: rows });
});

accountRoutes.post("/addresses", async (c) => {
  const me = await currentCustomer(c);
  if (!me) return c.json({ error: "Not signed in" }, 401);
  const b = (await c.req.json().catch(() => ({}))) as Record<string, string | boolean>;
  const id = newId("addr");
  if (b.isDefault) await run(c.var.db, `UPDATE customer_addresses SET is_default = 0 WHERE customer_id = ?`, me.customer_id);
  await run(
    c.var.db,
    `INSERT INTO customer_addresses (id, customer_id, name, line1, line2, city, region, postal_code, country, phone, is_default)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    me.customer_id,
    (b.name as string) ?? null,
    (b.line1 as string) ?? null,
    (b.line2 as string) ?? null,
    (b.city as string) ?? null,
    (b.region as string) ?? null,
    (b.postalCode as string) ?? null,
    (b.country as string) ?? null,
    (b.phone as string) ?? null,
    b.isDefault ? 1 : 0,
  );
  return c.json({ id }, 201);
});

accountRoutes.delete("/addresses/:id", async (c) => {
  const me = await currentCustomer(c);
  if (!me) return c.json({ error: "Not signed in" }, 401);
  await run(c.var.db, `DELETE FROM customer_addresses WHERE id = ? AND customer_id = ?`, c.req.param("id"), me.customer_id);
  return c.json({ ok: true });
});

// ---- Wishlist ----
accountRoutes.get("/wishlist", async (c) => {
  const me = await currentCustomer(c);
  if (!me) return c.json({ error: "Not signed in" }, 401);
  const rows = await all(
    c.var.db,
    `SELECT w.product_id AS productId, p.slug, p.name, p.base_price_cents AS priceCents, p.currency,
            (SELECT url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.sort_order LIMIT 1) AS imageUrl
     FROM wishlist_items w JOIN products p ON p.id = w.product_id
     WHERE w.customer_id = ? AND p.is_published = 1
     ORDER BY w.created_at DESC`,
    me.customer_id,
  );
  return c.json({ items: rows });
});

accountRoutes.post("/wishlist", async (c) => {
  const me = await currentCustomer(c);
  if (!me) return c.json({ error: "Not signed in" }, 401);
  const b = (await c.req.json().catch(() => ({}))) as { productId?: string };
  if (!b.productId) return c.json({ error: "productId required" }, 400);
  await run(
    c.var.db,
    `INSERT OR IGNORE INTO wishlist_items (id, customer_id, product_id) VALUES (?, ?, ?)`,
    newId("wl"),
    me.customer_id,
    b.productId,
  );
  return c.json({ ok: true });
});

accountRoutes.delete("/wishlist/:productId", async (c) => {
  const me = await currentCustomer(c);
  if (!me) return c.json({ error: "Not signed in" }, 401);
  await run(
    c.var.db,
    `DELETE FROM wishlist_items WHERE customer_id = ? AND product_id = ?`,
    me.customer_id,
    c.req.param("productId"),
  );
  return c.json({ ok: true });
});
