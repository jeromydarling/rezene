import { Hono } from "hono";
import { z } from "zod";
import { first, run } from "../services/db";
import { parseBody } from "../services/validators";
import { requireAdminOnly } from "../middleware/auth";
import type { AppContext } from "../types/env";

/**
 * Shop-facing custom-domain setup. A merchant enters their domain, gets
 * dead-simple CNAME instructions, and can check that DNS is pointing correctly.
 * Final activation (adding the custom hostname) is the operator's step; a
 * request notifies them. The requested domain lives in the shop's own settings.
 */
export const adminDomainRoutes = new Hono<AppContext>();

const DOMAIN_KEY = "custom_domain_request";
const DOMAIN_RE = /^([a-z0-9-]+\.)+[a-z]{2,}$/i;

function target(c: { env: AppContext["Bindings"] }): string {
  return (c.env.CUSTOM_DOMAIN_TARGET || new URL(c.env.APP_URL || "https://verto.style").host).replace(/^https?:\/\//, "");
}

adminDomainRoutes.get("/", async (c) => {
  const row = await first<{ value: string }>(c.var.db, `SELECT value FROM settings WHERE key = ?`, DOMAIN_KEY);
  const appUrl = (c.env.APP_URL || "https://verto.style").replace(/\/$/, "");
  const base = c.var.shopSlug ? `/${c.var.shopSlug}` : "";
  return c.json({
    slug: c.var.shopSlug,
    currentUrl: `${appUrl}${base}`,
    domain: row?.value ?? null,
    target: target(c),
  });
});

const saveSchema = z.object({ domain: z.string().max(255) });

adminDomainRoutes.put("/", requireAdminOnly, async (c) => {
  const { domain } = await parseBody(c, saveSchema);
  const clean = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");
  if (clean && !DOMAIN_RE.test(clean)) return c.json({ error: "That doesn't look like a domain (e.g. yourlabel.com)." }, 400);
  await run(
    c.var.db,
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    DOMAIN_KEY,
    clean,
  );
  // Let the platform operator know so they can finish activation.
  if (clean) {
    const brand = await first<{ value: string }>(c.var.db, `SELECT value FROM settings WHERE key = 'brand_name'`);
    const { sendNotification } = await import("../services/email");
    await sendNotification(c.env, {
      subject: `Domain request: ${clean}`,
      text: `${brand?.value ?? c.var.shopSlug ?? "A shop"} wants to connect ${clean}. Add it as a custom hostname and set the shop's custom_domain in the registry.`,
    }).catch(() => {});
  }
  return c.json({ ok: true, domain: clean });
});

// Live DNS check via DNS-over-HTTPS — tells the merchant if their CNAME points
// at us yet. Purely informational; propagation can lag.
adminDomainRoutes.get("/check", async (c) => {
  const domain = (c.req.query("domain") || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!domain || !DOMAIN_RE.test(domain)) return c.json({ error: "Enter a valid domain first." }, 400);
  const want = target(c).toLowerCase();
  try {
    const lookups = await Promise.all(
      [domain, `www.${domain}`].map(async (name) => {
        const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=CNAME`, {
          headers: { accept: "application/dns-json" },
        });
        const data = (await res.json()) as { Answer?: { data?: string }[] };
        const records = (data.Answer ?? []).map((a) => (a.data ?? "").replace(/\.$/, "").toLowerCase());
        return { name, records, ok: records.some((r) => r === want || r.endsWith(`.${want}`) || r === `${want}.`) };
      }),
    );
    const ok = lookups.some((l) => l.ok);
    return c.json({ ok, target: want, lookups });
  } catch {
    return c.json({ error: "Couldn't check DNS right now — try again in a moment." }, 502);
  }
});
