import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { all, first, run } from "../services/db";
import { sendBuyerEmail } from "../services/buyer-email";
import { getEmailBrand, renderBrandedEmail } from "../services/email-template";
import { rateLimit } from "../middleware/rate-limit";
import { newId, randomToken, sha256Hex } from "../utils/id";
import type { AppContext } from "../types/env";

/**
 * Wholesale buyer portal (passwordless). A boutique buyer applies, the shop
 * approves and sets their terms, then the buyer signs in with an emailed link
 * and orders from the shop's line sheets at their own pricing. Mounted at
 * /api/wholesale, so c.var.db is the shop's database.
 */
export const wholesalePortalRoutes = new Hono<AppContext>();

const COOKIE = "verto_wholesale";
const SESSION_DAYS = 45;
const LINK_MINUTES = 30;

async function currentBuyer(c: any) {
  const token = getCookie(c, COOKIE);
  if (!token) return null;
  const row = await first<{
    account_id: string;
    email: string;
    company: string | null;
    discount_pct: number;
    terms_days: number;
    status: string;
  }>(
    c.var.db,
    `SELECT s.account_id, a.email, a.company, a.discount_pct, a.terms_days, a.status
     FROM wholesale_sessions s JOIN wholesale_accounts a ON a.id = s.account_id
     WHERE s.token_hash = ? AND s.expires_at > datetime('now')`,
    await sha256Hex(token),
  );
  return row && row.status === "approved" ? row : null;
}

async function shopBaseUrl(c: any): Promise<string> {
  const origin = new URL(c.req.url).origin;
  const { getPrimaryShopBase } = await import("../services/shops");
  const shopBase = c.var.shopSlug ? `/${c.var.shopSlug}` : await getPrimaryShopBase(c.env.DB);
  return (c.env.APP_ENV === "development" ? origin : c.env.APP_URL || origin) + shopBase;
}

// ---- Apply ----
wholesalePortalRoutes.post(
  "/apply",
  rateLimit({ key: "wholesale_apply", limit: 6, windowSeconds: 3600 }),
  async (c) => {
    const b = (await c.req.json().catch(() => ({}))) as { email?: string; company?: string; contactName?: string };
    const email = (b.email ?? "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return c.json({ error: "Enter a valid email." }, 400);
    const existing = await first<{ id: string; status: string }>(
      c.var.db,
      `SELECT id, status FROM wholesale_accounts WHERE email = ?`,
      email,
    );
    if (existing) return c.json({ ok: true, status: existing.status });
    await run(
      c.var.db,
      `INSERT INTO wholesale_accounts (id, email, company, contact_name) VALUES (?, ?, ?, ?)`,
      newId("wa"),
      email,
      (b.company ?? "").slice(0, 160) || null,
      (b.contactName ?? "").slice(0, 120) || null,
    );
    return c.json({ ok: true, status: "pending" });
  },
);

// ---- Sign in ----
wholesalePortalRoutes.post(
  "/request-link",
  rateLimit({ key: "wholesale_link", limit: 8, windowSeconds: 3600 }),
  async (c) => {
    const b = (await c.req.json().catch(() => ({}))) as { email?: string };
    const email = (b.email ?? "").trim().toLowerCase();
    const ok = c.json({ ok: true });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return ok;
    const account = await first<{ id: string; status: string }>(
      c.var.db,
      `SELECT id, status FROM wholesale_accounts WHERE email = ?`,
      email,
    );
    if (!account || account.status !== "approved") return ok;

    const token = randomToken(24);
    await run(
      c.var.db,
      `INSERT INTO wholesale_login_tokens (id, email, token_hash, expires_at)
       VALUES (?, ?, ?, datetime('now', '+${LINK_MINUTES} minutes'))`,
      newId("wlt"),
      email,
      await sha256Hex(token),
    );
    const link = `${await shopBaseUrl(c)}/wholesale?token=${encodeURIComponent(token)}`;
    try {
      const brand = await getEmailBrand(c.env, c.var.db);
      const html = renderBrandedEmail({
        brand,
        preheader: `Your wholesale sign-in link for ${brand.name}`,
        heading: "Your wholesale sign-in link",
        bodyHtml:
          `<p style="margin:0 0 16px;">Tap to sign in to the wholesale portal. Works once, expires in ${LINK_MINUTES} minutes.</p>` +
          `<p style="margin:0 0 20px;"><a href="${link}" style="display:inline-block;background:#1c2b3a;color:#fff;padding:12px 22px;border-radius:6px;text-decoration:none;">Sign in</a></p>`,
        footerNote: "You're receiving this because someone entered this address to sign in to wholesale.",
      });
      await sendBuyerEmail(c.env, {
        to: email,
        subject: `Sign in to ${brand.name} wholesale`,
        text: `Sign in to the wholesale portal:\n\n${link}\n\nWorks once, expires in ${LINK_MINUTES} minutes.`,
        html,
      });
    } catch (err) {
      console.error("[wholesale] link email failed:", String(err).slice(0, 160));
    }
    return ok;
  },
);

wholesalePortalRoutes.post("/verify", async (c) => {
  const b = (await c.req.json().catch(() => ({}))) as { token?: string };
  const token = (b.token ?? "").trim();
  if (!token) return c.json({ error: "Missing token." }, 400);
  const row = await first<{ id: string; email: string }>(
    c.var.db,
    `SELECT id, email FROM wholesale_login_tokens
     WHERE token_hash = ? AND consumed_at IS NULL AND expires_at > datetime('now')`,
    await sha256Hex(token),
  );
  if (!row) return c.json({ error: "This link expired — request a new one." }, 400);
  await run(c.var.db, `UPDATE wholesale_login_tokens SET consumed_at = datetime('now') WHERE id = ?`, row.id);
  const account = await first<{ id: string }>(
    c.var.db,
    `SELECT id FROM wholesale_accounts WHERE email = ? AND status = 'approved'`,
    row.email.toLowerCase(),
  );
  if (!account) return c.json({ error: "Account not active." }, 403);
  const sessionToken = randomToken(32);
  await run(
    c.var.db,
    `INSERT INTO wholesale_sessions (id, account_id, token_hash, expires_at)
     VALUES (?, ?, ?, datetime('now', '+${SESSION_DAYS} days'))`,
    newId("wsess"),
    account.id,
    await sha256Hex(sessionToken),
  );
  setCookie(c, COOKIE, sessionToken, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 3600,
  });
  return c.json({ ok: true });
});

wholesalePortalRoutes.post("/logout", async (c) => {
  const token = getCookie(c, COOKIE);
  if (token) await run(c.var.db, `DELETE FROM wholesale_sessions WHERE token_hash = ?`, await sha256Hex(token));
  deleteCookie(c, COOKIE, { path: "/" });
  return c.json({ ok: true });
});

wholesalePortalRoutes.get("/me", async (c) => {
  const me = await currentBuyer(c);
  if (!me) return c.json({ error: "Not signed in" }, 401);
  return c.json({ email: me.email, company: me.company, discountPct: me.discount_pct, termsDays: me.terms_days });
});

// ---- Catalogue ----
wholesalePortalRoutes.get("/line-sheets", async (c) => {
  const me = await currentBuyer(c);
  if (!me) return c.json({ error: "Not signed in" }, 401);
  const rows = await all(
    c.var.db,
    `SELECT id, title, season, currency, note FROM line_sheets WHERE status = 'active' ORDER BY created_at DESC`,
  );
  return c.json({ lineSheets: rows });
});

wholesalePortalRoutes.get("/line-sheets/:id", async (c) => {
  const me = await currentBuyer(c);
  if (!me) return c.json({ error: "Not signed in" }, 401);
  const sheet = await first<{ id: string; title: string; season: string | null; currency: string; note: string | null }>(
    c.var.db,
    `SELECT id, title, season, currency, note FROM line_sheets WHERE id = ? AND status = 'active'`,
    c.req.param("id"),
  );
  if (!sheet) return c.json({ error: "Line sheet not found" }, 404);
  const rows = await all<{ product_id: string; wholesale_price_cents: number; min_qty: number; name: string; slug: string; image: string | null }>(
    c.var.db,
    `SELECT i.product_id, i.wholesale_price_cents, i.min_qty, p.name, p.slug,
            (SELECT url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.sort_order LIMIT 1) AS image
     FROM line_sheet_items i JOIN products p ON p.id = i.product_id
     WHERE i.line_sheet_id = ? AND p.is_published = 1
     ORDER BY i.sort_order`,
    sheet.id,
  );
  const factor = 1 - Math.max(0, Math.min(90, me.discount_pct)) / 100;
  const items = rows.map((r) => ({
    productId: r.product_id,
    name: r.name,
    slug: r.slug,
    image: r.image,
    minQty: r.min_qty,
    priceCents: Math.round(r.wholesale_price_cents * factor),
    listPriceCents: r.wholesale_price_cents,
  }));
  return c.json({ sheet, items, currency: sheet.currency, discountPct: me.discount_pct });
});

// ---- Place an order ----
wholesalePortalRoutes.post("/orders", async (c) => {
  const me = await currentBuyer(c);
  if (!me) return c.json({ error: "Not signed in" }, 401);
  const b = (await c.req.json().catch(() => ({}))) as {
    lineSheetId?: string;
    note?: string;
    items?: { productId: string; quantity: number }[];
  };
  if (!b.lineSheetId) return c.json({ error: "Missing line sheet." }, 400);
  const sheet = await first<{ id: string; currency: string }>(
    c.var.db,
    `SELECT id, currency FROM line_sheets WHERE id = ? AND status = 'active'`,
    b.lineSheetId,
  );
  if (!sheet) return c.json({ error: "Line sheet not found" }, 404);
  const picks = (b.items ?? []).filter((i) => i.productId && i.quantity > 0);
  if (picks.length === 0) return c.json({ error: "Add at least one style." }, 400);

  const factor = 1 - Math.max(0, Math.min(90, me.discount_pct)) / 100;
  const resolved: { productId: string; name: string; qty: number; unit: number }[] = [];
  for (const p of picks) {
    const row = await first<{ wholesale_price_cents: number; min_qty: number; name: string }>(
      c.var.db,
      `SELECT i.wholesale_price_cents, i.min_qty, pr.name
       FROM line_sheet_items i JOIN products pr ON pr.id = i.product_id
       WHERE i.line_sheet_id = ? AND i.product_id = ?`,
      sheet.id,
      p.productId,
    );
    if (!row) continue;
    if (p.quantity < row.min_qty)
      return c.json({ error: `${row.name} has a minimum of ${row.min_qty}.` }, 400);
    resolved.push({ productId: p.productId, name: row.name, qty: p.quantity, unit: Math.round(row.wholesale_price_cents * factor) });
  }
  if (resolved.length === 0) return c.json({ error: "Those styles aren't on this sheet." }, 400);

  const total = resolved.reduce((s, r) => s + r.qty * r.unit, 0);
  const orderId = newId("wo");
  const orderNumber = `WS-${Date.now().toString(36).toUpperCase().slice(-6)}`;
  await run(
    c.var.db,
    `INSERT INTO wholesale_orders (id, account_id, line_sheet_id, order_number, status, currency, total_cents, note)
     VALUES (?, ?, ?, ?, 'submitted', ?, ?, ?)`,
    orderId,
    me.account_id,
    sheet.id,
    orderNumber,
    sheet.currency,
    total,
    (b.note ?? "").slice(0, 2000) || null,
  );
  for (const r of resolved) {
    await run(
      c.var.db,
      `INSERT INTO wholesale_order_items (id, order_id, product_id, description, quantity, unit_price_cents, currency)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      newId("woi"),
      orderId,
      r.productId,
      r.name,
      r.qty,
      r.unit,
      sheet.currency,
    );
  }
  return c.json({ orderNumber, total }, 201);
});

wholesalePortalRoutes.get("/orders", async (c) => {
  const me = await currentBuyer(c);
  if (!me) return c.json({ error: "Not signed in" }, 401);
  const rows = await all(
    c.var.db,
    `SELECT id, order_number AS orderNumber, status, total_cents AS totalCents, currency,
            due_date AS dueDate, created_at AS createdAt
     FROM wholesale_orders WHERE account_id = ? ORDER BY created_at DESC`,
    me.account_id,
  );
  return c.json({ orders: rows });
});
