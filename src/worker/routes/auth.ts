import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import {
  createSession,
  destroySession,
  hashPassword,
  maybeBootstrapAdmin,
  SESSION_COOKIE,
  verifyPassword,
} from "../services/auth";
import { first, run, writeAudit } from "../services/db";
import { changePasswordSchema, demoAccessSchema, loginSchema, parseBody } from "../services/validators";
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
    await maybeBootstrapAdmin(c.env, c.var.db, email, password);

    const user = await first<{ id: string; password_hash: string | null; is_active: number }>(
      c.var.db,
      `SELECT id, password_hash, is_active FROM users WHERE email = ?`,
      email.toLowerCase(),
    );
    const invalid = () => c.json({ error: "Invalid email or password" }, 401);
    if (!user || !user.is_active || !user.password_hash) return invalid();
    if (!(await verifyPassword(password, user.password_hash))) return invalid();

    const { token, expiresAt } = await createSession(c.var.db, user.id, {
      ip: c.req.header("cf-connecting-ip"),
      userAgent: c.req.header("user-agent"),
    });
    await run(c.var.db, `UPDATE users SET last_login_at = datetime('now') WHERE id = ?`, user.id);
    await writeAudit(c.var.db, user.id, "auth.login", "user", user.id);

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
  if (token) await destroySession(c.var.db, token);
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

/** Rotate the signed-in user's password; revokes every other session. */
authRoutes.post("/change-password", async (c) => {
  if (!c.var.userId) return c.json({ error: "Authentication required" }, 401);
  const { currentPassword, newPassword } = await parseBody(c, changePasswordSchema);

  const user = await first<{ password_hash: string | null }>(
    c.var.db,
    `SELECT password_hash FROM users WHERE id = ?`,
    c.var.userId,
  );
  if (!user?.password_hash || !(await verifyPassword(currentPassword, user.password_hash))) {
    return c.json({ error: "Current password is incorrect" }, 401);
  }
  await run(
    c.var.db,
    `UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`,
    await hashPassword(newPassword),
    c.var.userId,
  );
  // Kill every other session — a rotated password should orphan old logins.
  await run(
    c.var.db,
    `DELETE FROM sessions WHERE user_id = ? AND id != ?`,
    c.var.userId,
    c.var.sessionId,
  );
  await writeAudit(c.var.db, c.var.userId, "auth.change_password", "user", c.var.userId);
  return c.json({ ok: true });
});

/**
 * Email gate for the public demo shop's admin. A visitor leaves their
 * email, we record the lead in the platform's own database (never the
 * demo shop's — demo viewers can read that one) and mint a session for
 * the shared read-only viewer account. Only answers on the demo shop.
 */
authRoutes.post(
  "/demo-access",
  rateLimit({ key: "demo_access", limit: 20, windowSeconds: 3600 }),
  async (c) => {
    const { DEMO_SHOP_SLUG, DEMO_VIEWER_EMAIL } = await import("../services/shops");
    if (c.var.shopSlug !== DEMO_SHOP_SLUG) return c.json({ error: "Not found" }, 404);

    const { email, name } = await parseBody(c, demoAccessSchema);

    const viewer = await first<{ id: string }>(
      c.var.db,
      `SELECT id FROM users WHERE email = ? AND is_active = 1`,
      DEMO_VIEWER_EMAIL,
    );
    if (!viewer) return c.json({ error: "Demo is not provisioned yet" }, 503);

    // The lead lands in the platform (primary) database — founder-only.
    const { newId } = await import("../utils/id");
    await run(
      c.env.DB,
      `INSERT INTO leads (id, kind, email, name, message, source_path)
       VALUES (?, 'contact', ?, ?, 'Verto demo admin access', ?)`,
      newId("lead"),
      email.toLowerCase(),
      name ?? null,
      `/${DEMO_SHOP_SLUG}/admin`,
    );
    const { sendNotification } = await import("../services/email");
    await sendNotification(c.env, {
      subject: `Verto demo: ${email} entered the demo admin`,
      text: `${name ? `${name} <${email}>` : email} opened the demo admin gate.`,
    }).catch(() => {});

    // CRM: demo visitors are warm leads — contact + timeline + edge geo.
    const { ingestEvent, geoFromRequest } = await import("../services/crm");
    await ingestEvent(c.env, {
      email,
      name: name ?? null,
      source: "demo",
      kind: "demo_visit",
      subject: "Toured the demo admin",
      geo: geoFromRequest(c.req.raw),
    });

    const { token, expiresAt } = await createSession(c.var.db, viewer.id, {
      ip: c.req.header("cf-connecting-ip"),
      userAgent: c.req.header("user-agent"),
    });
    await writeAudit(c.var.db, viewer.id, "auth.demo_access", "user", viewer.id);

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
