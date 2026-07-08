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

const FONT_KEYS = ["fraunces", "georgia", "times", "inter", "helvetica", "courier"];
const PAIRING_KEYS = ["editorial", "grand", "refined", "modern", "bold", "warm", "classic", "avant"];
const CASES = ["as-is", "upper", "lower"];

/** Brand-in-a-box: a full identity proposal from a few answers. */
adminBrandRoutes.post("/generate", requireAdminWrite, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    brandName?: string;
    makes?: string;
    vibe?: string;
  };
  const brandName = (body.brandName ?? "").toString().slice(0, 120) || "an independent fashion label";
  const makes = (body.makes ?? "").toString().slice(0, 300);
  const vibe = (body.vibe ?? "").toString().slice(0, 300);
  try {
    const { aiComplete } = await import("../services/ai");
    const res = await aiComplete(c.env, {
      system:
        "You are a fashion brand art director creating a complete visual identity. Reply with ONLY a " +
        "compact JSON object, no prose:\n" +
        '{"palette":{"primary":"#RRGGBB","accent":"#RRGGBB","ink":"#RRGGBB","bg":"#RRGGBB"},' +
        '"typography":"<key>","wordmark":{"font":"<key>","case":"as-is|upper|lower","tracking":<0..0.3>,"weight":300|400|600},' +
        '"tagline":"<max 8 words>","voice":"<2 sentences on tone>"}\n' +
        `typography key ∈ [${PAIRING_KEYS.join(", ")}] (editorial=warm serif, grand=dramatic serif, refined=delicate serif, modern=grotesk, bold=heavy sans, warm=friendly serif, classic=book serif, avant=experimental).\n` +
        `wordmark.font ∈ [${FONT_KEYS.join(", ")}].\n` +
        "Palette: primary=structural/dark, accent=CTAs, ink=near-black text, bg=near-white page. Strong contrast ink-on-bg.",
      prompt: `Brand name: ${brandName}${makes ? `\nMakes: ${makes}` : ""}${vibe ? `\nVibe: ${vibe}` : ""}`,
      maxTokens: 280,
    });
    const match = res.text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("no json");
    const raw = JSON.parse(match[0]) as Record<string, unknown>;
    const pal = raw.palette as Record<string, string> | undefined;
    if (!pal || !["primary", "accent", "ink", "bg"].every((k) => HEX.test(pal[k] ?? ""))) {
      throw new Error("bad palette");
    }
    const wm = (raw.wordmark ?? {}) as Record<string, unknown>;
    const clamp = (n: unknown, lo: number, hi: number, d: number) => {
      const v = typeof n === "number" ? n : Number(n);
      return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;
    };
    const identity = {
      palette: { primary: pal.primary, accent: pal.accent, ink: pal.ink, bg: pal.bg },
      typography: { pairing: PAIRING_KEYS.includes(String(raw.typography)) ? String(raw.typography) : "editorial" },
      wordmark: {
        text: brandName,
        font: FONT_KEYS.includes(String(wm.font)) ? String(wm.font) : "fraunces",
        case: (CASES.includes(String(wm.case)) ? String(wm.case) : "as-is") as "as-is" | "upper" | "lower",
        tracking: clamp(wm.tracking, -0.05, 0.4, 0.02),
        weight: [300, 400, 600].includes(Number(wm.weight)) ? Number(wm.weight) : 400,
        monogram: false,
        divider: false,
      },
      tagline: typeof raw.tagline === "string" ? raw.tagline.slice(0, 120) : "",
      voice: typeof raw.voice === "string" ? raw.voice.slice(0, 400) : "",
    };
    return c.json(identity);
  } catch {
    return c.json({ error: "Couldn't generate an identity — try again, or build one by hand." }, 503);
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
