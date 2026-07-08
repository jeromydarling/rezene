/**
 * Brand Studio backend — two AI assists on top of the plain settings PATCH the
 * studio uses to save. The logo/palette themselves are persisted as the
 * `brand_logo` / `brand_palette` settings blobs (see admin-settings); this route
 * only provides:
 *   • POST /palette-suggest — an LLM proposes a four-colour system from the
 *     brand name + vibe, returned as strict hex.
 *   • POST /emblem — Flux generates a pictorial mark, stored to R2 like any
 *     other generated image, returned as a /media URL.
 */
import { Hono } from "hono";
import { run } from "../services/db";
import { newId } from "../utils/id";
import { requireAdminWrite } from "../middleware/auth";
import type { AppContext } from "../types/env";

export const adminBrandRoutes = new Hono<AppContext>();

const HEX = /^#[0-9a-f]{6}$/i;

adminBrandRoutes.post("/palette-suggest", requireAdminWrite, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { brandName?: string; vibe?: string };
  const brandName = (body.brandName ?? "").toString().slice(0, 120) || "an independent fashion label";
  const vibe = (body.vibe ?? "").toString().slice(0, 300);
  try {
    const { aiComplete } = await import("../services/ai");
    const res = await aiComplete(c.env, {
      system:
        "You are a fashion brand art director. Propose a tasteful four-colour brand palette. " +
        "Reply with ONLY a compact JSON object, no prose: " +
        `{"primary":"#RRGGBB","accent":"#RRGGBB","ink":"#RRGGBB","bg":"#RRGGBB"}. ` +
        "primary = structural/dark UI, accent = calls-to-action, ink = body text (very dark), " +
        "bg = page background (near-white, warm or cool to suit the brand). Ensure strong contrast " +
        "between ink and bg, and between text and primary.",
      prompt: `Brand: ${brandName}${vibe ? `\nVibe: ${vibe}` : ""}`,
      maxTokens: 120,
    });
    const match = res.text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("no json");
    const raw = JSON.parse(match[0]) as Record<string, string>;
    const palette = { primary: raw.primary, accent: raw.accent, ink: raw.ink, bg: raw.bg };
    if (!Object.values(palette).every((v) => typeof v === "string" && HEX.test(v))) {
      throw new Error("bad hex");
    }
    return c.json(palette);
  } catch {
    return c.json({ error: "Couldn't suggest a palette — pick colours by hand or try a preset." }, 503);
  }
});

adminBrandRoutes.post("/emblem", requireAdminWrite, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { brandName?: string; prompt?: string };
  const brandName = (body.brandName ?? "the brand").toString().slice(0, 120);
  const extra = (body.prompt ?? "").toString().slice(0, 300);
  const prompt =
    `A minimal, elegant vector-style logo emblem for a fashion label called "${brandName}". ` +
    `${extra ? extra + ". " : ""}Single centered mark, flat monochrome, clean geometric or ` +
    `monogram form, generous negative space, on a plain solid white background, no text, no lettering, ` +
    `no photography — a crisp brand icon suitable for a logo.`;
  try {
    const { generateFluxImage, randomSeed } = await import("../services/flux");
    const { bytes, model } = await generateFluxImage(c.env, { prompt, seed: randomSeed() });
    const fileId = newId("file");
    const key = `uploads/brand/emblem/${fileId}.jpg`;
    await c.env.FILES.put(key, bytes, { httpMetadata: { contentType: "image/jpeg" } });
    await run(
      c.var.db,
      `INSERT INTO files (id, r2_key, filename, content_type, size_bytes, entity_type, entity_id, is_public, uploaded_by)
       VALUES (?, ?, ?, 'image/jpeg', ?, 'brand', 'emblem', 1, ?)`,
      fileId,
      key,
      `emblem-${fileId}.jpg`,
      bytes.length,
      c.var.userId,
    );
    return c.json({ url: `/media/${fileId}`, fileId, model }, 201);
  } catch (err) {
    const { FluxUnavailableError } = await import("../services/flux");
    const msg = err instanceof FluxUnavailableError ? err.message : "Emblem generation failed. Try again.";
    return c.json({ error: msg }, 503);
  }
});
