import { Hono } from "hono";
import { first, run } from "../services/db";
import { getShopDb } from "../services/tenant-db";
import { PRIMARY_SHOP_ID } from "../services/shops";
import { verifyLuluWebhook } from "../services/lulu";
import type { Env } from "../types/env";

/**
 * Lulu print-job status webhook. Signed with `Lulu-HMAC-SHA256` (HMAC of the
 * raw body keyed by the Lulu API secret). Each print job was created with an
 * external_id of `${shopId}:${recipientId}`, so the payload self-routes to the
 * right shop DO — no platform index needed. Updates the recipient's status +
 * tracking and rolls the order's status up to "shipped" when all copies ship.
 */
export const luluWebhookRoutes = new Hono<{ Bindings: Env }>();

luluWebhookRoutes.post("/webhook", async (c) => {
  const raw = await c.req.text();
  const sig = c.req.header("Lulu-HMAC-SHA256") || c.req.header("lulu-hmac-sha256") || "";
  const secret = c.env.LULU_CLIENT_SECRET || "";
  if (!(await verifyLuluWebhook(secret, raw, sig))) return c.json({ error: "bad signature" }, 401);

  let payload: {
    data?: { external_id?: string; id?: number | string; status?: { name?: string }; line_items?: { tracking_id?: string; tracking_urls?: string[] }[] };
  };
  try {
    payload = JSON.parse(raw);
  } catch {
    return c.json({ error: "bad json" }, 400);
  }
  const d = payload.data;
  const external = d?.external_id ?? "";
  const [shopId, recipientId] = external.split(":");
  if (!shopId || !recipientId) return c.json({ ok: true, note: "no external_id" });

  const db = getShopDb(c.env, shopId, PRIMARY_SHOP_ID);
  const rcpt = await first<{ id: string; job_id: string }>(
    db,
    `SELECT id, job_id FROM lookbook_print_recipients WHERE id = ? AND lulu_job_id = ?`,
    recipientId,
    String(d?.id ?? ""),
  ).catch(() => null);
  // Fall back to id-only match if the lulu id didn't line up.
  const recipient = rcpt ?? (await first<{ id: string; job_id: string }>(db, `SELECT id, job_id FROM lookbook_print_recipients WHERE id = ?`, recipientId).catch(() => null));
  if (!recipient) return c.json({ ok: true, note: "recipient not found" });

  const li = d?.line_items?.[0];
  await run(
    db,
    `UPDATE lookbook_print_recipients SET lulu_status = ?, tracking_id = ?, tracking_url = ? WHERE id = ?`,
    d?.status?.name ?? null,
    li?.tracking_id ?? null,
    li?.tracking_urls?.[0] ?? null,
    recipient.id,
  );

  // Roll the order up: all recipients shipped → order shipped.
  const { rollupStatus } = await import("../services/lookbook-print");
  const { all: allRows } = await import("../services/db");
  const rows = await allRows<{ lulu_status: string | null; lulu_job_id: string | null }>(
    db,
    `SELECT lulu_status, lulu_job_id FROM lookbook_print_recipients WHERE job_id = ?`,
    recipient.job_id,
  );
  const status = rollupStatus(rows);
  await run(
    db,
    `UPDATE lookbook_print_jobs SET status = CASE WHEN status IN ('submitted','shipped') THEN ? ELSE status END, updated_at = datetime('now') WHERE id = ?`,
    status,
    recipient.job_id,
  );
  return c.json({ ok: true });
});
