import { Hono } from "hono";
import { z } from "zod";
import { all, run } from "../services/db";
import { parseBody } from "../services/validators";
import { requireAdminWrite } from "../middleware/auth";
import { AUTOMATION_RULES, recentActivity } from "../services/activity";
import type { AppContext } from "../types/env";

/**
 * Automations — the settings surface for the built-in rules and a window
 * onto the event spine. Rules are enabled by default (they only ever create
 * tasks and drafts); a toggle here writes an explicit row.
 */
export const adminAutomationRoutes = new Hono<AppContext>();

adminAutomationRoutes.get("/", async (c) => {
  let overrides = new Map<string, boolean>();
  try {
    const rows = await all<{ rule_key: string; enabled: number }>(
      c.var.db,
      `SELECT rule_key, enabled FROM automation_settings`,
    );
    overrides = new Map(rows.map((r) => [r.rule_key, Boolean(r.enabled)]));
  } catch {
    /* table not provisioned yet — defaults apply */
  }
  return c.json(
    AUTOMATION_RULES.map((r) => ({
      key: r.key,
      title: r.title,
      description: r.description,
      enabled: overrides.get(r.key) ?? true,
    })),
  );
});

const toggleSchema = z.object({ enabled: z.boolean() });

adminAutomationRoutes.patch("/:key", requireAdminWrite, async (c) => {
  const key = c.req.param("key");
  if (!AUTOMATION_RULES.some((r) => r.key === key)) {
    return c.json({ error: "Unknown automation rule" }, 404);
  }
  const body = await parseBody(c, toggleSchema);
  await run(
    c.var.db,
    `INSERT INTO automation_settings (rule_key, enabled, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(rule_key) DO UPDATE SET enabled = excluded.enabled, updated_at = datetime('now')`,
    key,
    body.enabled ? 1 : 0,
  );
  return c.json({ ok: true });
});

adminAutomationRoutes.get("/activity", async (c) => {
  const rows = await recentActivity(c.var.db, 50);
  return c.json(
    rows.map((r) => ({
      id: r.id as string,
      kind: r.kind as string,
      title: r.title as string,
      createdAt: r.created_at as string,
    })),
  );
});
