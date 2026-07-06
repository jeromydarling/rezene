import { all, first, run } from "./db";
import { newId } from "../utils/id";
import type { Env } from "../types/env";

/**
 * Verto HQ CRM — the platform's own relationships, kept human:
 *  - the timeline writes itself (signups, demo visits, provisioning),
 *  - geo comes free from the edge (request.cf) so the founder sees who's
 *    where and what time it is for them before hitting send,
 *  - a daily sweep turns silence into follow-up tasks so nobody is
 *    forgotten. All tables live in the primary D1 only.
 */

export interface EdgeGeo {
  country?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
}

/** Pull location from a request's cf object (undefined in local dev). */
export function geoFromRequest(req: Request): EdgeGeo {
  const cf = (req as { cf?: Record<string, unknown> }).cf;
  if (!cf) return {};
  const num = (v: unknown) => {
    const n = typeof v === "string" ? Number.parseFloat(v) : (v as number);
    return Number.isFinite(n) ? n : undefined;
  };
  return {
    country: typeof cf.country === "string" ? cf.country : undefined,
    city: typeof cf.city === "string" ? cf.city : undefined,
    latitude: num(cf.latitude),
    longitude: num(cf.longitude),
    timezone: typeof cf.timezone === "string" ? cf.timezone : undefined,
  };
}

export async function upsertContact(
  env: Env,
  input: {
    email: string;
    name?: string | null;
    company?: string | null;
    shopId?: string | null;
    source?: "signup" | "demo" | "lead" | "manual";
    status?: string;
    geo?: EdgeGeo;
  },
): Promise<string> {
  const email = input.email.toLowerCase();
  const existing = await first<{ id: string }>(
    env.DB,
    `SELECT id FROM crm_contacts WHERE email = ?`,
    email,
  );
  if (existing) {
    // Fill blanks, never overwrite what a human wrote.
    await run(
      env.DB,
      `UPDATE crm_contacts SET
         name = COALESCE(name, ?), company = COALESCE(company, ?),
         shop_id = COALESCE(shop_id, ?),
         country = COALESCE(country, ?), city = COALESCE(city, ?),
         latitude = COALESCE(latitude, ?), longitude = COALESCE(longitude, ?),
         timezone = COALESCE(timezone, ?),
         status = CASE WHEN status = 'lead' AND ? IS NOT NULL THEN ? ELSE status END,
         updated_at = datetime('now')
       WHERE id = ?`,
      input.name ?? null,
      input.company ?? null,
      input.shopId ?? null,
      input.geo?.country ?? null,
      input.geo?.city ?? null,
      input.geo?.latitude ?? null,
      input.geo?.longitude ?? null,
      input.geo?.timezone ?? null,
      input.status ?? null,
      input.status ?? null,
      existing.id,
    );
    return existing.id;
  }
  const id = newId("ct");
  await run(
    env.DB,
    `INSERT INTO crm_contacts (id, email, name, company, shop_id, source, status, country, city, latitude, longitude, timezone)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    email,
    input.name ?? null,
    input.company ?? null,
    input.shopId ?? null,
    input.source ?? "manual",
    input.status ?? "lead",
    input.geo?.country ?? null,
    input.geo?.city ?? null,
    input.geo?.latitude ?? null,
    input.geo?.longitude ?? null,
    input.geo?.timezone ?? null,
  );
  return id;
}

export async function logInteraction(
  env: Env,
  contactId: string,
  kind: string,
  opts: { subject?: string; bodyMd?: string; metadata?: unknown; createdBy?: string } = {},
): Promise<void> {
  await run(
    env.DB,
    `INSERT INTO crm_interactions (id, contact_id, kind, subject, body_md, metadata, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    newId("ix"),
    contactId,
    kind,
    opts.subject ?? null,
    opts.bodyMd ?? null,
    opts.metadata ? JSON.stringify(opts.metadata) : null,
    opts.createdBy ?? null,
  );
  await run(
    env.DB,
    `UPDATE crm_contacts SET last_touch_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
    contactId,
  );
}

/** Best-effort ingestion — CRM bookkeeping must never break a signup. */
export async function ingestEvent(
  env: Env,
  event: {
    email: string;
    name?: string | null;
    company?: string | null;
    shopId?: string | null;
    source: "signup" | "demo" | "lead";
    status?: string;
    kind: string;
    subject: string;
    metadata?: unknown;
    geo?: EdgeGeo;
  },
): Promise<void> {
  try {
    const id = await upsertContact(env, event);
    await logInteraction(env, id, event.kind, { subject: event.subject, metadata: event.metadata });
  } catch {
    // Table may not exist yet mid-deploy; the reconcile sweep catches up.
  }
}

/**
 * Pull anyone the CRM doesn't know yet out of the registry and lead pile.
 * Idempotent (email-unique); runs on demand from the CRM screens.
 */
export async function reconcileContacts(env: Env): Promise<void> {
  const shops = await all<{ id: string; name: string; owner_email: string | null; status: string }>(
    env.DB,
    `SELECT id, name, owner_email, status FROM shops WHERE owner_email IS NOT NULL`,
  );
  for (const shop of shops) {
    await upsertContact(env, {
      email: shop.owner_email!,
      company: shop.name,
      shopId: shop.id,
      source: "signup",
      status: shop.status === "active" ? "trial" : undefined,
    });
  }
  const leads = await all<{ email: string; name: string | null; message: string | null }>(
    env.DB,
    `SELECT email, name, message FROM leads ORDER BY created_at ASC`,
  );
  for (const lead of leads) {
    await upsertContact(env, {
      email: lead.email,
      name: lead.name,
      source: lead.message?.includes("demo admin") ? "demo" : "lead",
    });
  }
}

/**
 * The daily human-nudge sweep: silence becomes a task.
 *  - fresh signup, no touch in 3 days → "check in"
 *  - demo visitor who never signed up after 2 days → "follow up"
 *  - any contact whose promised next_followup_at has passed → task
 * auto_key dedups so each nudge fires once per contact.
 */
export async function crmFollowupSweep(env: Env): Promise<void> {
  const insert = async (contactId: string, title: string, autoKey: string) => {
    await run(
      env.DB,
      `INSERT OR IGNORE INTO crm_tasks (id, contact_id, title, due_at, auto_key)
       VALUES (?, ?, ?, datetime('now'), ?)`,
      newId("tk"),
      contactId,
      title,
      autoKey,
    );
  };
  const staleSignups = await all<{ id: string; name: string | null; email: string }>(
    env.DB,
    `SELECT id, name, email FROM crm_contacts
     WHERE source = 'signup' AND status IN ('lead','trial')
       AND created_at < datetime('now', '-3 days')
       AND (last_touch_at IS NULL OR last_touch_at < datetime('now', '-3 days'))`,
  );
  for (const c of staleSignups) {
    await insert(c.id, `Check in with ${c.name ?? c.email} — new shop, quiet for 3 days`, "signup_checkin");
  }
  const coldDemos = await all<{ id: string; name: string | null; email: string }>(
    env.DB,
    `SELECT id, name, email FROM crm_contacts
     WHERE source = 'demo' AND shop_id IS NULL
       AND created_at < datetime('now', '-2 days')
       AND (last_touch_at IS NULL OR last_touch_at < datetime('now', '-2 days'))`,
  );
  for (const c of coldDemos) {
    await insert(c.id, `Follow up with ${c.name ?? c.email} — toured the demo, hasn't opened a shop`, "demo_followup");
  }
  const promised = await all<{ id: string; name: string | null; email: string }>(
    env.DB,
    `SELECT id, name, email FROM crm_contacts
     WHERE next_followup_at IS NOT NULL AND next_followup_at <= datetime('now')`,
  );
  for (const c of promised) {
    await insert(c.id, `You promised to follow up with ${c.name ?? c.email}`, `promise_${Date.now()}`);
    await run(env.DB, `UPDATE crm_contacts SET next_followup_at = NULL WHERE id = ?`, c.id);
  }
}
