import { Hono } from "hono";
import { z } from "zod";
import { first, run } from "../services/db";
import { sendNotification } from "../services/email";
import { parseBody } from "../services/validators";
import { rateLimit } from "../middleware/rate-limit";
import { RESERVED_SLUGS } from "../services/shops";
import { newId } from "../utils/id";
import type { AppContext } from "../types/env";

/**
 * Verto platform routes (public): shop signup. A signup reserves the slug
 * as a pending shop and notifies the founder — provisioning/tenant scoping
 * is the next phase, so nothing is auto-created beyond the reservation.
 */
export const vertoRoutes = new Hono<AppContext>();

const signupSchema = z.object({
  shopName: z.string().min(2).max(80),
  slug: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers, and hyphens only"),
  email: z.string().email().max(200),
  plan: z.enum(["starter", "label", "studio", "house"]).optional(),
  note: z.string().max(1000).optional(),
  website: z.string().max(200).optional(),
  /** Referring shop's slug (from a share link) — both sides earn a free month. */
  ref: z.string().max(40).optional(),
});

vertoRoutes.post(
  "/signup",
  rateLimit({ key: "verto_signup", limit: 10, windowSeconds: 3600 }),
  async (c) => {
    const body = await parseBody(c, signupSchema);
    if (RESERVED_SLUGS.has(body.slug)) {
      return c.json({ error: "That address is reserved — try another" }, 409);
    }
    const existing = await first(c.env.DB, `SELECT id FROM shops WHERE slug = ?`, body.slug);
    if (existing) return c.json({ error: "That address is taken — try another" }, 409);

    // Referral: only a real, different shop counts — a bad ref never blocks signup.
    let referrer: { id: string; slug: string } | null = null;
    if (body.ref && body.ref !== body.slug) {
      referrer = await first<{ id: string; slug: string }>(
        c.env.DB,
        `SELECT id, slug FROM shops WHERE slug = ? AND status = 'active'`,
        body.ref,
      );
    }

    const id = newId("shop");
    await run(
      c.env.DB,
      `INSERT INTO shops (id, slug, name, status, owner_email, plan, note, referred_by_slug)
       VALUES (?, ?, ?, 'pending', ?, ?, ?, ?)`,
      id,
      body.slug,
      body.shopName,
      body.email.toLowerCase(),
      body.plan ?? null,
      body.note ?? null,
      referrer?.slug ?? null,
    );

    // Both sides of a referral earn a free month, held as pending credits the
    // founder applies to billing from HQ.
    if (referrer) {
      await run(
        c.env.DB,
        `INSERT INTO referral_credits (id, shop_id, side, other_shop_id) VALUES (?, ?, 'referrer', ?)`,
        newId("refc"),
        referrer.id,
        id,
      );
      await run(
        c.env.DB,
        `INSERT INTO referral_credits (id, shop_id, side, other_shop_id) VALUES (?, ?, 'referee', ?)`,
        newId("refc"),
        id,
        referrer.id,
      );
    }

    // Activation funnel: signup is milestone zero.
    const { recordActivationEvent } = await import("../services/activation");
    await recordActivationEvent(c.env.DB, id, "signup");

    // CRM: the relationship starts here — contact + timeline + edge geo.
    const { ingestEvent, geoFromRequest } = await import("../services/crm");
    await ingestEvent(c.env, {
      email: body.email,
      company: body.shopName,
      shopId: id,
      source: "signup",
      status: "trial",
      kind: "signup",
      subject: `Signed up: ${body.shopName} (/${body.slug})`,
      metadata: { slug: body.slug, plan: body.plan ?? null, note: body.note ?? null, referredBy: referrer?.slug ?? null },
      geo: geoFromRequest(c.req.raw),
    });

    // Instant onboarding: provision on the spot. If anything goes wrong the
    // reservation stays pending and the platform operator provisions it by
    // hand from Admin → Verto Shops — the signup never hard-fails past this
    // point because the slug is already reserved.
    try {
      const { provisionShop } = await import("../services/provision");
      const result = await provisionShop(
        c.env,
        { id, slug: body.slug, name: body.shopName, status: "pending", custom_domain: null },
        body.email,
        { brandImportUrl: body.website?.trim() || null },
      );
      return c.json(
        {
          ok: true,
          provisioned: true,
          slug: result.slug,
          loginUrl: result.loginUrl,
          adminEmail: result.adminEmail,
          password: result.password,
        },
        201,
      );
    } catch (err) {
      console.error(`[verto] auto-provision failed for /${body.slug}:`, err);
      await sendNotification(c.env, {
        subject: `Verto signup NEEDS PROVISIONING: ${body.shopName} (/${body.slug})`,
        text: `Auto-provisioning failed for /${body.slug} (${body.email}): ${String(err).slice(0, 300)}\nProvision manually from Admin → Verto Shops.`,
      });
      return c.json({ ok: true, provisioned: false, slug: body.slug }, 201);
    }
  },
);

/** Live slug availability check for the signup form. */
vertoRoutes.get("/slug-check", async (c) => {
  const slug = (c.req.query("slug") ?? "").toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length < 2) {
    return c.json({ available: false, reason: "invalid" });
  }
  if (RESERVED_SLUGS.has(slug)) return c.json({ available: false, reason: "reserved" });
  const existing = await first(c.env.DB, `SELECT id FROM shops WHERE slug = ?`, slug);
  return c.json({ available: !existing, reason: existing ? "taken" : null });
});

/**
 * Confirm-your-email link from the provisioning welcome mail. A GET is fine:
 * verifying only records proof of ownership, so a link-scanner prefetch that
 * confirms early is harmless (and re-clicks are idempotent). Returns a small
 * friendly HTML page rather than JSON — a human clicked it from their inbox.
 */
vertoRoutes.get("/verify-email", async (c) => {
  const token = c.req.query("token") ?? "";
  const { verifyEmailToken } = await import("../services/email-verification");
  const outcome = token ? await verifyEmailToken(c.env.DB, token) : { ok: false as const };
  const appUrl = (c.env.APP_URL || new URL(c.req.url).origin).replace(/\/$/, "");
  const ok = outcome.ok;
  const title = ok ? "Email confirmed" : "Link expired";
  const message = ok
    ? "Thanks — your email address is confirmed. You're all set."
    : "This confirmation link is invalid or has already been used. You can safely ignore it — your shop is still active.";
  const esc = (s: string) => s.replace(/[&<>"]/g, (x) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[x]!));
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} — Verto</title></head>
<body style="margin:0;background:#f6f4ef;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#2b2b2b;">
<div style="max-width:460px;margin:14vh auto;padding:36px 28px;background:#fff;border-radius:14px;border:1px solid rgba(0,0,0,.06);text-align:center;">
  <div style="font-size:34px;line-height:1;margin-bottom:14px;">${ok ? "✓" : "•"}</div>
  <h1 style="font-family:Georgia,serif;font-weight:400;font-size:22px;margin:0 0 10px;">${esc(title)}</h1>
  <p style="font-size:15px;line-height:1.6;color:#5b5b5b;margin:0 0 22px;">${esc(message)}</p>
  <a href="${esc(appUrl)}" style="display:inline-block;background:#2b2b2b;color:#fff;text-decoration:none;font-size:14px;padding:11px 22px;border-radius:8px;">Go to Verto</a>
</div>
</body></html>`;
  return c.html(html, ok ? 200 : 400);
});

/**
 * One-time bootstrap of the public demo shop. Unauthenticated by design:
 * it is fully idempotent and can only ever create the single fixed demo
 * shop with fixed content — there is no caller input to abuse.
 */
vertoRoutes.post("/demo-bootstrap", async (c) => {
  try {
    const { bootstrapDemoShop } = await import("../services/demo");
    const result = await bootstrapDemoShop(c.env);
    return c.json({ ok: true, ...result });
  } catch (err) {
    return c.json({ ok: false, error: String(err instanceof Error ? err.message : err).slice(0, 300) }, 500);
  }
});

/**
 * Public verification for Verto School certificates. The unguessable id IS
 * the credential: it resolves only if the certificate was really issued,
 * and shows exactly what was earned, by whom, and whether it still stands.
 */
vertoRoutes.get("/certified/:id", async (c) => {
  const id = c.req.param("id");
  if (!/^crt_[0-9a-f]{24}$/.test(id)) return c.json({ error: "Not found" }, 404);
  const cert = await first<{
    id: string;
    shop_slug: string;
    user_name: string;
    scope: string;
    ref: string;
    title: string;
    curriculum_version: string;
    issued_at: string;
    revoked: number;
  }>(
    c.env.DB,
    `SELECT id, shop_slug, user_name, scope, ref, title, curriculum_version, issued_at, revoked
     FROM school_certificates WHERE id = ?`,
    id,
  );
  if (!cert) return c.json({ error: "Not found" }, 404);
  return c.json({
    id: cert.id,
    holder: cert.user_name,
    shopSlug: cert.shop_slug,
    scope: cert.scope,
    ref: cert.ref,
    title: cert.title,
    curriculumVersion: cert.curriculum_version,
    issuedAt: cert.issued_at,
    valid: !cert.revoked,
  });
});

// ---- The Verto Directory (public, gated) --------------------------------------
// Private-first: listings exist the moment shops opt in, but the public page
// only serves them when DIRECTORY_PUBLIC=1 (or with the documented preview
// param, so the founder can watch the network fill in before opening it).

vertoRoutes.get("/directory", async (c) => {
  const open = c.env.DIRECTORY_PUBLIC === "1" || c.req.query("preview") === "verto-preview-2026";
  if (!open) return c.json({ open: false, listings: [] });
  try {
    const rows = await c.env.DB.prepare(
      `SELECT d.shop_id, d.craft, d.specialties, d.city, d.country, d.blurb, d.cert_count, d.cert_best,
              s.slug, s.name
         FROM directory_listings d JOIN shops s ON s.id = d.shop_id
        WHERE d.opted_in = 1 AND s.status = 'active'
        ORDER BY d.cert_count DESC, d.updated_at DESC LIMIT 200`,
    ).all<Record<string, unknown>>();
    return c.json({
      open: true,
      listings: (rows.results ?? []).map((r) => ({
        slug: r.slug,
        name: r.name,
        craft: r.craft,
        specialties: r.specialties,
        city: r.city,
        country: r.country,
        blurb: r.blurb,
        certCount: r.cert_count,
        certBest: r.cert_best,
      })),
    });
  } catch {
    return c.json({ open: true, listings: [] });
  }
});

// ---- Maker waitlist (the maker-tools front door) --------------------------------
const makerSignupSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().max(200),
  craft: z.string().max(120).optional(),
  city: z.string().max(120).optional(),
  country: z.string().max(120).optional(),
  website: z.string().max(300).optional(),
  note: z.string().max(1000).optional(),
  invitedByShop: z.string().max(60).optional(),
});

vertoRoutes.post("/maker-signup", rateLimit({ key: "maker_signup", limit: 10, windowSeconds: 3600 }), async (c) => {
  const body = await parseBody(c, makerSignupSchema);
  try {
    await c.env.DB.prepare(
      `INSERT INTO maker_waitlist (id, name, email, craft, city, country, website, note, invited_by_shop)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(email) DO UPDATE SET name = excluded.name, craft = excluded.craft,
         city = excluded.city, country = excluded.country, website = excluded.website,
         note = COALESCE(excluded.note, maker_waitlist.note)`,
    )
      .bind(
        newId("maker"),
        body.name,
        body.email.toLowerCase(),
        body.craft ?? null,
        body.city ?? null,
        body.country ?? null,
        body.website ?? null,
        body.note ?? null,
        body.invitedByShop ?? null,
      )
      .run();
  } catch {
    return c.json({ error: "Couldn't save that — try again in a moment." }, 500);
  }
  await sendNotification(c.env, {
    subject: `Maker waitlist: ${body.name}`,
    text: `${body.name} <${body.email}> — ${body.craft ?? "craft n/a"}, ${[body.city, body.country].filter(Boolean).join(", ") || "location n/a"}${body.invitedByShop ? ` (invited by ${body.invitedByShop})` : ""}\n${body.note ?? ""}`,
  }).catch(() => {});
  return c.json({ ok: true });
});
