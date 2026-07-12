import { Hono } from "hono";
import { z } from "zod";
import { requireAdminWrite } from "../middleware/auth";
import { parseBody } from "../services/validators";
import { getActivationState, recordActivationMilestones, writePersisted } from "../services/activation";
import { writeAudit } from "../services/db";
import type { AppContext } from "../types/env";

/**
 * The "Get Selling Fast" activation guide. Read returns the live, derived
 * state; the two writes persist the only bits we can't infer (dismissal and
 * the "I shared my link" confirmation).
 */
export const adminOnboardingRoutes = new Hono<AppContext>();

adminOnboardingRoutes.get("/", async (c) => {
  const state = await getActivationState(c.var.db, c.env);
  // Derive-and-log the funnel to the platform DB, off the response path.
  c.executionCtx.waitUntil(recordActivationMilestones(c.env.DB, c.var.shopId, state));
  return c.json(state);
});

const patchSchema = z.object({
  dismissed: z.boolean().optional(),
  sharedClicked: z.boolean().optional(),
  celebrated: z.boolean().optional(),
});

adminOnboardingRoutes.patch("/", requireAdminWrite, async (c) => {
  const body = await parseBody(c, patchSchema);
  const patch: Record<string, unknown> = {};
  if (body.dismissed !== undefined) patch.dismissed = body.dismissed;
  if (body.sharedClicked !== undefined) patch.sharedClicked = body.sharedClicked;
  if (body.celebrated) patch.celebratedAt = new Date().toISOString();
  const persisted = await writePersisted(c.var.db, patch);
  await writeAudit(c.var.db, c.var.userId, "onboarding.update", "onboarding", null, body);
  return c.json({ ok: true, persisted });
});
