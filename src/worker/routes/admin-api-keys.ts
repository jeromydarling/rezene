import { Hono } from "hono";
import { z } from "zod";
import { parseBody } from "../services/validators";
import { requireAdminWrite } from "../middleware/auth";
import { mintApiKey, listApiKeys, revokeApiKey } from "../services/api-keys";
import type { AppContext } from "../types/env";

/**
 * API keys — the admin surface for minting personal access tokens that power
 * the developer API / native Zapier app. The plaintext token is returned ONCE
 * on creation and never again (only its hash is stored). Mint/revoke go through
 * requireAdminWrite so demo shops stay read-only.
 */
export const adminApiKeyRoutes = new Hono<AppContext>();

adminApiKeyRoutes.get("/", async (c) => {
  const rows = await listApiKeys(c.var.db);
  return c.json(
    rows.map((r) => ({
      id: r.id,
      label: r.label,
      prefix: r.prefix,
      roles: r.roles,
      createdAt: r.created_at,
      expiresAt: r.expires_at,
      lastUsedAt: r.last_used_at,
      revokedAt: r.revoked_at,
    })),
  );
});

const mintSchema = z.object({ label: z.string().max(120).optional(), expiresAt: z.string().max(40).optional().nullable() });

adminApiKeyRoutes.post("/", requireAdminWrite, async (c) => {
  if (!c.var.shopSlug) {
    return c.json({ error: "API keys are minted on a shop, not the platform." }, 400);
  }
  const body = await parseBody(c, mintSchema);
  const minted = await mintApiKey(c.var.db, c.var.shopSlug, {
    label: body.label,
    expiresAt: body.expiresAt || null,
  });
  // token is plaintext — shown once, never stored or returned again.
  return c.json({ id: minted.id, prefix: minted.prefix, token: minted.token }, 201);
});

adminApiKeyRoutes.post("/:id/revoke", requireAdminWrite, async (c) => {
  const ok = await revokeApiKey(c.var.db, c.req.param("id"));
  if (!ok) return c.json({ error: "Key not found or already revoked." }, 404);
  return c.json({ ok: true });
});
