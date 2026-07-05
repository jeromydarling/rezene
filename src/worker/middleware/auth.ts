import type { MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";
import { resolveSession, SESSION_COOKIE } from "../services/auth";
import type { AppContext } from "../types/env";

/** Populate c.var with the session user (or nulls). Never rejects. */
export const sessionMiddleware: MiddlewareHandler<AppContext> = async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE);
  const user = await resolveSession(c.var.db, token);
  c.set("userId", user?.id ?? null);
  c.set("userEmail", user?.email ?? null);
  c.set("roles", user?.roles ?? []);
  c.set("sessionId", user?.sessionId ?? null);
  await next();
};

/** Gate: any authenticated user with one of the given roles. */
export function requireRole(...allowed: string[]): MiddlewareHandler<AppContext> {
  return async (c, next) => {
    if (!c.var.userId) return c.json({ error: "Authentication required" }, 401);
    const roles = c.var.roles;
    if (!roles.some((r) => allowed.includes(r))) {
      return c.json({ error: "Insufficient permissions" }, 403);
    }
    await next();
  };
}

/** Admin modules: admin + ops can write, viewer can read. */
export const requireAdminRead = requireRole("admin", "ops", "viewer");
export const requireAdminWrite = requireRole("admin", "ops");
export const requireAdminOnly = requireRole("admin");
