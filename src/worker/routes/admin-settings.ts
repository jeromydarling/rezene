import { Hono } from "hono";
import { all, run, writeAudit } from "../services/db";
import { parseBody, settingsUpdateSchema } from "../services/validators";
import { requireAdminOnly } from "../middleware/auth";
import type { AppContext } from "../types/env";

export const adminSettingsRoutes = new Hono<AppContext>();

adminSettingsRoutes.get("/", async (c) => {
  const rows = await all<{ key: string; value: string; description: string | null }>(
    c.env.DB,
    `SELECT key, value, description FROM settings ORDER BY key`,
  );
  const integrations = await all(
    c.env.DB,
    `SELECT provider, status, note, last_verified_at FROM integration_credentials_metadata`,
  );
  // Live secret presence (booleans only — never values).
  const secretStatus = {
    stripe: Boolean(c.env.STRIPE_SECRET_KEY),
    stripeWebhook: Boolean(c.env.STRIPE_WEBHOOK_SECRET),
    anthropic: Boolean(c.env.ANTHROPIC_API_KEY),
  };
  return c.json({ settings: rows, integrations, secretStatus });
});

adminSettingsRoutes.patch("/", requireAdminOnly, async (c) => {
  const body = await parseBody(c, settingsUpdateSchema);
  const editable = new Set([
    "brand_name",
    "brand_slug",
    "brand_tagline",
    "default_currency",
    "production_home",
  ]);
  const updates = Object.entries(body).filter(([k]) => editable.has(k));
  if (updates.length === 0) return c.json({ error: "No editable settings provided" }, 400);
  for (const [key, value] of updates) {
    await run(
      c.env.DB,
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      key,
      value,
    );
  }
  await writeAudit(c.env.DB, c.var.userId, "settings.update", "settings", null, Object.fromEntries(updates));
  return c.json({ ok: true });
});

// ---------- Audit log ----------
adminSettingsRoutes.get("/audit", requireAdminOnly, async (c) => {
  const rows = await all(
    c.env.DB,
    `SELECT a.id, a.action, a.entity_type, a.entity_id, a.detail, a.created_at, u.email AS user_email
     FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id
     ORDER BY a.created_at DESC LIMIT 200`,
  );
  return c.json(rows);
});
