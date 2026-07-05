import { Hono } from "hono";
import { z } from "zod";
import { all, first, run } from "../services/db";
import { getBrandName } from "../services/brand";
import { sendNotification } from "../services/email";
import { parseBody } from "../services/validators";
import { rateLimit } from "../middleware/rate-limit";
import { loadTechPackDetail } from "./admin-techpacks";
import { newId, sha256Hex } from "../utils/id";
import type { AppContext, Env } from "../types/env";

/**
 * Factory portal: unauthenticated, token-scoped access to a single tech
 * pack. The link always renders the CURRENT pack state — the factory can
 * never be looking at a stale emailed copy. Factories can comment and
 * approve the spec without an account. Tokens are stored hashed; revoking
 * a share kills the link instantly.
 */
export const factoryRoutes = new Hono<AppContext>();

interface ShareRow {
  id: string;
  tech_pack_id: string;
  supplier_id: string | null;
  label: string | null;
  language: "en" | "fr";
  status: string;
  approved_at: string | null;
  approved_by_name: string | null;
  approval_note: string | null;
}

async function resolveShare(env: Env, token: string): Promise<ShareRow | null> {
  if (!token || token.length < 20 || token.length > 100) return null;
  const share = await first<ShareRow>(
    env.DB,
    `SELECT id, tech_pack_id, supplier_id, label, language, status,
            approved_at, approved_by_name, approval_note
     FROM tech_pack_shares WHERE token_hash = ?`,
    await sha256Hex(token),
  );
  if (!share || share.status !== "active") return null;
  return share;
}

factoryRoutes.get(
  "/:token",
  rateLimit({ key: "factory-view", limit: 120, windowSeconds: 3600 }),
  async (c) => {
    const share = await resolveShare(c.env, c.req.param("token"));
    if (!share) return c.json({ error: "This link is invalid or has been revoked." }, 404);

    const brandName = await getBrandName(c.env);
    const pack = await loadTechPackDetail(c.var.db, share.tech_pack_id, brandName);
    if (!pack) return c.json({ error: "Tech pack not found" }, 404);

    const comments = await all(
      c.var.db,
      `SELECT id, author, author_kind, body, created_at FROM tech_pack_comments
       WHERE tech_pack_id = ? AND resolved = 0 ORDER BY created_at`,
      share.tech_pack_id,
    );
    const supplier = share.supplier_id
      ? await first<{ name: string }>(
          c.var.db,
          `SELECT name FROM suppliers WHERE id = ?`,
          share.supplier_id,
        )
      : null;

    await run(
      c.var.db,
      `UPDATE tech_pack_shares SET last_viewed_at = datetime('now'), view_count = view_count + 1
       WHERE id = ?`,
      share.id,
    );

    return c.json({
      brandName,
      label: share.label,
      supplierName: supplier?.name ?? null,
      language: share.language,
      approvedAt: share.approved_at,
      approvedByName: share.approved_by_name,
      approvalNote: share.approval_note,
      pack,
      comments,
    });
  },
);

const factoryCommentSchema = z.object({
  authorName: z.string().min(1).max(120),
  body: z.string().min(1).max(4000),
});

factoryRoutes.post(
  "/:token/comments",
  rateLimit({ key: "factory-comment", limit: 30, windowSeconds: 3600 }),
  async (c) => {
    const share = await resolveShare(c.env, c.req.param("token"));
    if (!share) return c.json({ error: "This link is invalid or has been revoked." }, 404);
    const body = await parseBody(c, factoryCommentSchema);
    await run(
      c.var.db,
      `INSERT INTO tech_pack_comments (id, tech_pack_id, author, author_kind, body, share_id)
       VALUES (?, ?, ?, 'factory', ?, ?)`,
      newId("tpc"),
      share.tech_pack_id,
      body.authorName,
      body.body,
      share.id,
    );
    c.executionCtx.waitUntil(
      sendNotification(c.env, {
        subject: `Factory comment on tech pack (${share.label ?? "share"})`,
        text: `${body.authorName} commented on a shared tech pack:\n\n"${body.body}"\n\nOpen the tech pack in the admin to reply.`,
      }),
    );
    return c.json({ ok: true }, 201);
  },
);

const factoryApproveSchema = z.object({
  name: z.string().min(1).max(120),
  note: z.string().max(2000).optional(),
});

factoryRoutes.post(
  "/:token/approve",
  rateLimit({ key: "factory-approve", limit: 10, windowSeconds: 3600 }),
  async (c) => {
    const share = await resolveShare(c.env, c.req.param("token"));
    if (!share) return c.json({ error: "This link is invalid or has been revoked." }, 404);
    if (share.approved_at) return c.json({ error: "Already approved" }, 409);
    const body = await parseBody(c, factoryApproveSchema);

    await run(
      c.var.db,
      `UPDATE tech_pack_shares SET approved_at = datetime('now'), approved_by_name = ?, approval_note = ?
       WHERE id = ?`,
      body.name,
      body.note ?? null,
      share.id,
    );
    await run(
      c.var.db,
      `INSERT INTO analytics_events (id, event, entity_type, entity_id, properties_json)
       VALUES (?, 'tech_pack_factory_approved', 'tech_pack', ?, ?)`,
      newId("evt"),
      share.tech_pack_id,
      JSON.stringify({ shareId: share.id, by: body.name }),
    );
    c.executionCtx.waitUntil(
      sendNotification(c.env, {
        subject: `Factory APPROVED spec (${share.label ?? "share"})`,
        text: `${body.name} approved the shared tech pack.${body.note ? `\n\nNote: "${body.note}"` : ""}\n\nNext step: sample or production PO.`,
      }),
    );
    return c.json({ ok: true, approvedAt: new Date().toISOString() });
  },
);
