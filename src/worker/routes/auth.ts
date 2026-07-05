import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import {
  createSession,
  destroySession,
  maybeBootstrapAdmin,
  SESSION_COOKIE,
  verifyPassword,
} from "../services/auth";
import { first, run, writeAudit } from "../services/db";
import { loginSchema, parseBody } from "../services/validators";
import { rateLimit } from "../middleware/rate-limit";
import type { AppContext } from "../types/env";

export const authRoutes = new Hono<AppContext>();

authRoutes.post(
  "/login",
  rateLimit({ key: "login", limit: 10, windowSeconds: 300 }),
  async (c) => {
    const { email, password } = await parseBody(c, loginSchema);

    // First-run bootstrap: creates the founder admin account if the users
    // table is empty and credentials match ADMIN_EMAIL/ADMIN_INITIAL_PASSWORD.
    await maybeBootstrapAdmin(c.env, email, password);

    const user = await first<{ id: string; password_hash: string | null; is_active: number }>(
      c.env.DB,
      `SELECT id, password_hash, is_active FROM users WHERE email = ?`,
      email.toLowerCase(),
    );
    const invalid = () => c.json({ error: "Invalid email or password" }, 401);
    if (!user || !user.is_active || !user.password_hash) return invalid();
    if (!(await verifyPassword(password, user.password_hash))) return invalid();

    const { token, expiresAt } = await createSession(c.env.DB, user.id, {
      ip: c.req.header("cf-connecting-ip"),
      userAgent: c.req.header("user-agent"),
    });
    await run(c.env.DB, `UPDATE users SET last_login_at = datetime('now') WHERE id = ?`, user.id);
    await writeAudit(c.env.DB, user.id, "auth.login", "user", user.id);

    setCookie(c, SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "Lax",
      secure: c.env.APP_ENV !== "development",
      path: "/",
      expires: new Date(expiresAt),
    });
    return c.json({ ok: true });
  },
);

authRoutes.post("/logout", async (c) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) await destroySession(c.env.DB, token);
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
  return c.json({ ok: true });
});

authRoutes.get("/me", (c) => {
  if (!c.var.userId) return c.json({ error: "Not authenticated" }, 401);
  return c.json({
    id: c.var.userId,
    email: c.var.userEmail,
    roles: c.var.roles,
  });
});
