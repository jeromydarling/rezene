import { Hono } from "hono";
import { all, first, run, writeAudit } from "../services/db";
import { parseBody, inviteUserSchema, updateUserSchema } from "../services/validators";
import { requireAdminRead, requireAdminOnly } from "../middleware/auth";
import { createResetToken } from "../services/auth";
import { newId } from "../utils/id";
import type { AppContext } from "../types/env";
import type { Context } from "hono";

/**
 * Team management: a shop can have many logins across three roles —
 * admin (everything, incl. team + settings), ops (day-to-day, no team/settings
 * writes), and viewer (read-only). New members are invited by email and set
 * their own password via a single-use link, so no shared passwords change
 * hands. The last remaining admin can never be locked out.
 */
export const adminUsersRoutes = new Hono<AppContext>();

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  is_active: number;
  last_login_at: string | null;
  created_at: string;
  role: string | null;
  has_password: number;
}

const SELECT_USERS = `
  SELECT u.id, u.email, u.name, u.is_active, u.last_login_at, u.created_at,
         (SELECT role_id FROM user_roles WHERE user_id = u.id ORDER BY role_id LIMIT 1) AS role,
         (u.password_hash IS NOT NULL) AS has_password
  FROM users u`;

async function activeAdminCount(c: Context<AppContext>, excludeUserId?: string): Promise<number> {
  const row = await first<{ n: number }>(
    c.var.db,
    `SELECT count(DISTINCT ur.user_id) AS n FROM user_roles ur
     JOIN users u ON u.id = ur.user_id
     WHERE ur.role_id = 'admin' AND u.is_active = 1 ${excludeUserId ? "AND ur.user_id != ?" : ""}`,
    ...(excludeUserId ? [excludeUserId] : []),
  );
  return row?.n ?? 0;
}

async function setRole(c: Context<AppContext>, userId: string, role: string): Promise<void> {
  await run(c.var.db, `DELETE FROM user_roles WHERE user_id = ?`, userId);
  await run(c.var.db, `INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)`, userId, role);
}

function inviteLink(c: Context<AppContext>, token: string, welcome: boolean): string {
  const origin = new URL(c.req.url).origin;
  const shopBase = c.var.shopSlug ? `/${c.var.shopSlug}` : "";
  const base = (c.env.APP_ENV === "development" ? origin : c.env.APP_URL || origin) + shopBase;
  return `${base}/admin/reset?token=${encodeURIComponent(token)}${welcome ? "&welcome=1" : ""}`;
}

async function emailInvite(c: Context<AppContext>, email: string, link: string): Promise<boolean> {
  const { sendBuyerEmail } = await import("../services/buyer-email");
  const { getBrandName } = await import("../services/brand");
  const brand = await getBrandName(c.env);
  const inviter = c.var.userEmail ? ` by ${c.var.userEmail}` : "";
  return sendBuyerEmail(c.env, {
    to: email.toLowerCase(),
    fromName: brand,
    subject: `You've been invited to ${brand} on Verto`,
    text: `You've been invited${inviter} to help run ${brand}.\n\nSet your password to get started (link valid for 7 days):\n${link}\n\nIf you weren't expecting this, you can ignore it.`,
  }).catch(() => false);
}

adminUsersRoutes.get("/", requireAdminRead, async (c) => {
  const rows = await all<UserRow>(c.var.db, `${SELECT_USERS} ORDER BY u.created_at`);
  return c.json(
    rows.map((r) => ({
      id: r.id,
      email: r.email,
      name: r.name,
      role: r.role ?? "ops",
      isActive: Boolean(r.is_active),
      pending: !r.has_password,
      lastLoginAt: r.last_login_at,
      createdAt: r.created_at,
      isSelf: r.id === c.var.userId,
    })),
  );
});

adminUsersRoutes.post("/", requireAdminOnly, async (c) => {
  const { email, name, role } = await parseBody(c, inviteUserSchema);
  const lower = email.toLowerCase();
  const existing = await first<{ id: string }>(c.var.db, `SELECT id FROM users WHERE email = ?`, lower);
  if (existing) return c.json({ error: "Someone with that email is already on the team." }, 409);

  const userId = newId("usr");
  // No password yet — the invite link is how they set one.
  await run(c.var.db, `INSERT INTO users (id, email, name) VALUES (?, ?, ?)`, userId, lower, name ?? null);
  await setRole(c, userId, role);
  const token = await createResetToken(c.var.db, userId, "invite");
  const link = inviteLink(c, token, true);
  const emailed = await emailInvite(c, lower, link);
  await writeAudit(c.var.db, c.var.userId, "team.invite", "user", userId);
  return c.json({ id: userId, inviteUrl: link, emailed }, 201);
});

adminUsersRoutes.patch("/:id", requireAdminOnly, async (c) => {
  const id = c.req.param("id");
  const body = await parseBody(c, updateUserSchema);
  const target = await first<UserRow>(c.var.db, `${SELECT_USERS} WHERE u.id = ?`, id);
  if (!target) return c.json({ error: "Not found" }, 404);

  // Guardrails: never orphan the shop or lock yourself out.
  const demotingFromAdmin = body.role && body.role !== "admin" && target.role === "admin";
  const deactivating = body.isActive === false && target.is_active === 1;
  if ((demotingFromAdmin || deactivating) && target.role === "admin") {
    if ((await activeAdminCount(c, id)) === 0) {
      return c.json({ error: "This is the last admin — promote someone else first." }, 409);
    }
  }
  if (deactivating && id === c.var.userId) {
    return c.json({ error: "You can't deactivate your own account." }, 409);
  }

  if (body.name !== undefined) {
    await run(c.var.db, `UPDATE users SET name = ?, updated_at = datetime('now') WHERE id = ?`, body.name, id);
  }
  if (body.isActive !== undefined) {
    await run(
      c.var.db,
      `UPDATE users SET is_active = ?, updated_at = datetime('now') WHERE id = ?`,
      body.isActive ? 1 : 0,
      id,
    );
    if (!body.isActive) await run(c.var.db, `DELETE FROM sessions WHERE user_id = ?`, id);
  }
  if (body.role) await setRole(c, id, body.role);
  await writeAudit(c.var.db, c.var.userId, "team.update", "user", id);
  return c.json({ ok: true });
});

adminUsersRoutes.post("/:id/resend-invite", requireAdminOnly, async (c) => {
  const id = c.req.param("id");
  const target = await first<UserRow>(c.var.db, `${SELECT_USERS} WHERE u.id = ?`, id);
  if (!target) return c.json({ error: "Not found" }, 404);
  const token = await createResetToken(c.var.db, id, "invite");
  const link = inviteLink(c, token, !target.has_password);
  const emailed = await emailInvite(c, target.email, link);
  return c.json({ inviteUrl: link, emailed });
});

adminUsersRoutes.delete("/:id", requireAdminOnly, async (c) => {
  const id = c.req.param("id");
  const target = await first<UserRow>(c.var.db, `${SELECT_USERS} WHERE u.id = ?`, id);
  if (!target) return c.json({ error: "Not found" }, 404);
  if (id === c.var.userId) return c.json({ error: "You can't remove your own account." }, 409);
  if (target.role === "admin" && (await activeAdminCount(c, id)) === 0) {
    return c.json({ error: "This is the last admin — promote someone else first." }, 409);
  }
  await run(c.var.db, `DELETE FROM users WHERE id = ?`, id);
  await writeAudit(c.var.db, c.var.userId, "team.remove", "user", id);
  return c.json({ ok: true });
});
