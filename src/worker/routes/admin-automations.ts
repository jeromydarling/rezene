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
  const enabledMap = new Map<string, boolean>();
  const autoMap = new Map<string, boolean>();
  try {
    const rows = await all<{ rule_key: string; enabled: number; auto_approve: number }>(
      c.var.db,
      `SELECT rule_key, enabled, auto_approve FROM automation_settings`,
    );
    for (const r of rows) {
      enabledMap.set(r.rule_key, Boolean(r.enabled));
      autoMap.set(r.rule_key, Boolean(r.auto_approve));
    }
  } catch {
    /* table/column not provisioned yet — defaults apply */
  }
  return c.json(
    AUTOMATION_RULES.map((r) => ({
      key: r.key,
      title: r.title,
      description: r.description,
      enabled: enabledMap.get(r.key) ?? true,
      supportsAutoApprove: Boolean(r.supportsAutoApprove),
      autoApproveNote: r.autoApproveNote ?? null,
      autoApprove: autoMap.get(r.key) ?? false,
    })),
  );
});

const toggleSchema = z.object({ enabled: z.boolean().optional(), autoApprove: z.boolean().optional() });

adminAutomationRoutes.patch("/:key", requireAdminWrite, async (c) => {
  const key = c.req.param("key");
  const rule = AUTOMATION_RULES.find((r) => r.key === key);
  if (!rule) return c.json({ error: "Unknown automation rule" }, 404);
  const body = await parseBody(c, toggleSchema);
  if (body.enabled === undefined && body.autoApprove === undefined) {
    return c.json({ error: "Nothing to update" }, 400);
  }
  // Ensure a row exists, then patch only the provided fields.
  await run(
    c.var.db,
    `INSERT INTO automation_settings (rule_key, enabled, auto_approve, updated_at)
     VALUES (?, 1, 0, datetime('now'))
     ON CONFLICT(rule_key) DO NOTHING`,
    key,
  );
  if (body.enabled !== undefined) {
    await run(
      c.var.db,
      `UPDATE automation_settings SET enabled = ?, updated_at = datetime('now') WHERE rule_key = ?`,
      body.enabled ? 1 : 0,
      key,
    );
  }
  if (body.autoApprove !== undefined) {
    // Auto-approve only meaningful for rules that produce a sendable draft.
    const value = rule.supportsAutoApprove && body.autoApprove ? 1 : 0;
    await run(
      c.var.db,
      `UPDATE automation_settings SET auto_approve = ?, updated_at = datetime('now') WHERE rule_key = ?`,
      value,
      key,
    );
  }
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
