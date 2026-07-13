import type { MiddlewareHandler } from "hono";
import { verifyApiKey } from "../services/api-keys";
import type { AppContext } from "../types/env";

/**
 * Bearer-token auth for the developer API (`/api/v1/*`) — the machine path the
 * native Zapier app (and any external tool) uses. Reads `Authorization: Bearer
 * <PAT>`, verifies it, and overrides the tenant context set by the global
 * tenant middleware: the PAT itself names the shop (slug baked in), so no
 * `x-verto-shop` header is needed. On success it populates the same context
 * variables a cookie session would (`db`, `shopId`, `shopSlug`, `userId`,
 * `roles`), so downstream handlers and role guards work unchanged.
 *
 * Concept borrowed from Hono's `bearerAuth`; kept hand-rolled here because our
 * token carries the tenant slug and needs a per-shop DB lookup, which the
 * built-in's static/array modes don't cover.
 */
export const apiKeyAuth: MiddlewareHandler<AppContext> = async (c, next) => {
  const header = c.req.header("Authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!m) {
    return c.json({ error: "Missing bearer token. Send Authorization: Bearer <your Verto API key>." }, 401);
  }
  const ctx = await verifyApiKey(c.env, m[1].trim());
  if (!ctx) return c.json({ error: "Invalid or revoked API key." }, 401);

  c.set("db", ctx.db);
  c.set("shopId", ctx.shopId);
  c.set("shopSlug", ctx.shopSlug);
  c.set("userId", `apikey:${ctx.keyId}`);
  c.set("userEmail", null);
  c.set("roles", ctx.roles);
  c.set("sessionId", null);
  await next();
};
