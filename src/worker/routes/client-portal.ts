import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { all, first, run } from "../services/db";
import { newId, randomToken, sha256Hex } from "../utils/id";
import type { AppContext } from "../types/env";

/**
 * The client portal — where a tailor's or stylist's client sees their own
 * work: commissions and their stages, fit renders and photos, their latest
 * measurements — and approves a design. Passwordless: the studio shares a
 * one-time link (from the Client Book), clicking it mints a session. Same
 * hashed-token shape as customer accounts and admin sessions.
 *
 * Mounted at /api/public/portal, so `c.var.db` is the shop's own database.
 */
export const clientPortalRoutes = new Hono<AppContext>();

const COOKIE = "verto_client_portal";
const SESSION_DAYS = 30;

async function currentClient(c: {
  var: { db: D1Database };
}): Promise<{ id: string; name: string } | null> {
  const token = getCookie(c as never, COOKIE);
  if (!token) return null;
  const hash = await sha256Hex(token);
  try {
    const row = await first<{ id: string; name: string }>(
      (c as { var: { db: D1Database } }).var.db,
      `SELECT cl.id, cl.name FROM client_portal_sessions s
       JOIN clients cl ON cl.id = s.client_id
       WHERE s.token_hash = ? AND s.expires_at > datetime('now')`,
      hash,
    );
    return row ?? null;
  } catch {
    return null;
  }
}

// ---- Verify an invite link → mint a session ----
clientPortalRoutes.post("/verify", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { token?: string };
  const token = (body.token ?? "").trim();
  if (!token) return c.json({ error: "Missing link token." }, 400);
  const hash = await sha256Hex(token);
  const row = await first<{ id: string; client_id: string }>(
    c.var.db,
    `SELECT id, client_id FROM client_portal_tokens
     WHERE token_hash = ? AND consumed_at IS NULL AND expires_at > datetime('now')`,
    hash,
  );
  if (!row) return c.json({ error: "This link has expired — ask your studio for a fresh one." }, 400);
  await run(c.var.db, `UPDATE client_portal_tokens SET consumed_at = datetime('now') WHERE id = ?`, row.id);
  const sessionToken = randomToken(32);
  await run(
    c.var.db,
    `INSERT INTO client_portal_sessions (id, client_id, token_hash, expires_at)
     VALUES (?, ?, ?, datetime('now', '+${SESSION_DAYS} days'))`,
    newId("cpsess"),
    row.client_id,
    await sha256Hex(sessionToken),
  );
  setCookie(c, COOKIE, sessionToken, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 3600,
  });
  const client = await first<{ name: string }>(c.var.db, `SELECT name FROM clients WHERE id = ?`, row.client_id);
  return c.json({ ok: true, name: client?.name ?? "" });
});

clientPortalRoutes.post("/logout", async (c) => {
  const token = getCookie(c, COOKIE);
  if (token) {
    await run(c.var.db, `DELETE FROM client_portal_sessions WHERE token_hash = ?`, await sha256Hex(token)).catch(
      () => {},
    );
  }
  deleteCookie(c, COOKIE, { path: "/" });
  return c.json({ ok: true });
});

// ---- Everything the client may see about themselves ----
clientPortalRoutes.get("/me", async (c) => {
  const me = await currentClient(c);
  if (!me) return c.json({ error: "Not signed in" }, 401);
  const [commissions, latestMeasurement, renders, photos, brand] = await Promise.all([
    all<{
      id: string;
      title: string;
      kind: string;
      stage: string;
      due_at: string | null;
      client_approved_at: string | null;
      updated_at: string;
    }>(
      c.var.db,
      `SELECT id, title, kind, stage, due_at, client_approved_at, updated_at FROM commissions
       WHERE client_id = ? ORDER BY stage IN ('done','cancelled'), updated_at DESC`,
      me.id,
    ).catch(() => []),
    first<{ taken_at: string; measurements_json: string }>(
      c.var.db,
      `SELECT taken_at, measurements_json FROM client_measurements
       WHERE client_id = ? ORDER BY taken_at DESC LIMIT 1`,
      me.id,
    ).catch(() => null),
    all<{ file_id: string; created_at: string }>(
      c.var.db,
      `SELECT file_id, created_at FROM fitting_renders
       WHERE model_id IN (SELECT id FROM fitting_models WHERE client_id = ?)
       ORDER BY created_at DESC LIMIT 12`,
      me.id,
    ).catch(() => []),
    all<{ file_id: string; label: string }>(
      c.var.db,
      `SELECT file_id, label FROM fitting_models WHERE client_id = ? ORDER BY created_at DESC LIMIT 6`,
      me.id,
    ).catch(() => []),
    first<{ value: string }>(c.var.db, `SELECT value FROM settings WHERE key = 'brand_name'`).catch(() => null),
  ]);
  const payments = commissions.length
    ? await all<{ commission_id: string; id: string; label: string; amount_cents: number; status: string; paid_at: string | null }>(
        c.var.db,
        `SELECT commission_id, id, label, amount_cents, status, paid_at FROM commission_payments
         WHERE commission_id IN (SELECT id FROM commissions WHERE client_id = ?) AND status != 'void'
         ORDER BY created_at`,
        me.id,
      ).catch(() => [])
    : [];
  return c.json({
    name: me.name,
    studio: brand?.value ?? null,
    commissions: commissions.map((co) => ({
      id: co.id,
      title: co.title,
      kind: co.kind,
      stage: co.stage,
      dueAt: co.due_at,
      approvedAt: co.client_approved_at,
      updatedAt: co.updated_at,
      payments: payments
        .filter((pm) => pm.commission_id === co.id)
        .map((pm) => ({ id: pm.id, label: pm.label, amountCents: pm.amount_cents, status: pm.status, paidAt: pm.paid_at })),
    })),
    measurements: latestMeasurement
      ? { takenAt: latestMeasurement.taken_at, values: JSON.parse(latestMeasurement.measurements_json || "{}") }
      : null,
    renders: renders.map((r) => ({ url: `/media/${r.file_id}`, createdAt: r.created_at })),
    photos: photos.map((p) => ({ url: `/media/${p.file_id}`, label: p.label })),
  });
});

// ---- Approve a design (writes to the client's own timeline) ----
clientPortalRoutes.post("/approve", async (c) => {
  const me = await currentClient(c);
  if (!me) return c.json({ error: "Not signed in" }, 401);
  const body = (await c.req.json().catch(() => ({}))) as { commissionId?: string };
  const commission = await first<{ id: string; title: string; client_approved_at: string | null }>(
    c.var.db,
    `SELECT id, title, client_approved_at FROM commissions WHERE id = ? AND client_id = ?`,
    body.commissionId ?? "",
    me.id,
  );
  if (!commission) return c.json({ error: "Commission not found" }, 404);
  if (commission.client_approved_at) return c.json({ ok: true, approvedAt: commission.client_approved_at });
  await run(
    c.var.db,
    `UPDATE commissions SET client_approved_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
    commission.id,
  );
  await run(
    c.var.db,
    `INSERT INTO client_events (id, client_id, commission_id, kind, subject)
     VALUES (?, ?, ?, 'note', ?)`,
    newId("cev"),
    me.id,
    commission.id,
    `${me.name} approved the design for “${commission.title}” from the portal`,
  );
  return c.json({ ok: true });
});
