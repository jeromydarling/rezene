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

    const id = newId("shop");
    await run(
      c.env.DB,
      `INSERT INTO shops (id, slug, name, status, owner_email, plan, note)
       VALUES (?, ?, ?, 'pending', ?, ?, ?)`,
      id,
      body.slug,
      body.shopName,
      body.email.toLowerCase(),
      body.plan ?? null,
      body.note ?? null,
    );
    await sendNotification(c.env, {
      subject: `Verto signup: ${body.shopName} (/${body.slug})`,
      text: [
        `New shop reservation on Verto:`,
        ``,
        `  Shop:  ${body.shopName}`,
        `  Slug:  /${body.slug}`,
        `  Email: ${body.email}`,
        body.plan ? `  Plan:  ${body.plan}` : null,
        body.note ? `  Note:  ${body.note}` : null,
        ``,
        `Status is 'pending' in the shops table — provision when ready.`,
      ]
        .filter((line) => line !== null)
        .join("\n"),
    });
    return c.json({ ok: true, slug: body.slug }, 201);
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
