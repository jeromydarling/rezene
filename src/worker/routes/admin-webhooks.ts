import { Hono } from "hono";
import { first, run } from "../services/db";
import { requireAdminWrite } from "../middleware/auth";
import { randomToken } from "../utils/id";
import type { AppContext } from "../types/env";

/**
 * Inbound-webhook management. A shop generates one secret token; combined with
 * their slug it forms the URL they paste into Zapier (or any tool) to feed
 * data into Verto. The token lives in settings — a shop-scoped secret, only
 * ever readable by that shop's admins. Regenerating invalidates the old URL.
 */
export const adminWebhookRoutes = new Hono<AppContext>();

const KEY = "inbound_webhook_token";

function urlFor(c: { env: { APP_URL?: string }; var: { shopSlug: string | null } }, token: string): string | null {
  const slug = c.var.shopSlug;
  if (!slug) return null;
  const base = (c.env.APP_URL || "https://verto.style").replace(/\/$/, "");
  return `${base}/api/public/hooks/${slug}/in/${token}`;
}

adminWebhookRoutes.get("/", async (c) => {
  const row = await first<{ value: string }>(c.var.db, `SELECT value FROM settings WHERE key = ?`, KEY).catch(() => null);
  const token = row?.value ?? null;
  return c.json({ enabled: Boolean(token), token, url: token ? urlFor(c, token) : null });
});

// Generate (first time) or rotate the token. Either way returns the live URL.
adminWebhookRoutes.post("/rotate", requireAdminWrite, async (c) => {
  if (!c.var.shopSlug) return c.json({ error: "Inbound webhooks are available on a shop, not the platform." }, 400);
  const token = randomToken(24);
  await run(
    c.var.db,
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    KEY,
    token,
  );
  return c.json({ enabled: true, token, url: urlFor(c, token) });
});

// Turn inbound webhooks off — the URL stops working immediately.
adminWebhookRoutes.delete("/", requireAdminWrite, async (c) => {
  await run(c.var.db, `DELETE FROM settings WHERE key = ?`, KEY);
  return c.json({ ok: true });
});
