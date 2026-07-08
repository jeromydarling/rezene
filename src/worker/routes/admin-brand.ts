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

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&#x27;/gi, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

/** Import an existing brand from a live website — logo, colours, fonts, name. */
adminBrandRoutes.post("/import-url", requireAdminWrite, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { url?: string };
  let target = (body.url ?? "").toString().trim();
  if (!target) return c.json({ error: "Enter your website address." }, 400);
  if (!/^https?:\/\//i.test(target)) target = "https://" + target;
  let u: URL;
  try {
    u = new URL(target);
  } catch {
    return c.json({ error: "That doesn't look like a valid web address." }, 400);
  }
  const host = u.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "::1" ||
    host.endsWith(".internal") ||
    host.endsWith(".local") ||
    /^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(host)
  ) {
    return c.json({ error: "That address isn't allowed." }, 400);
  }

  let html = "";
  try {
    const res = await fetch(u.toString(), {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; VertoBrandImport/1.0)", Accept: "text/html" },
      redirect: "follow",
    });
    if (!res.ok) return c.json({ error: `Couldn't reach that site (${res.status}).` }, 502);
    html = (await res.text()).slice(0, 600_000);
  } catch {
    return c.json({ error: "Couldn't reach that site — check the address." }, 502);
  }

  const abs = (href: string | null | undefined): string | null => {
    if (!href) return null;
    try {
      return new URL(href, u).toString();
    } catch {
      return null;
    }
  };
  const first = (patterns: RegExp[]): string | null => {
    for (const re of patterns) {
      const m = html.match(re);
      if (m?.[1]) return decodeEntities(m[1]);
    }
    return null;
  };

  const name = first([
    /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i,
    /<title[^>]*>([^<]+)<\/title>/i,
  ]);
  const tagline = first([
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
  ]);
  const themeColor = html.match(/<meta[^>]+name=["']theme-color["'][^>]+content=["'](#[0-9a-fA-F]{3,6})["']/i)?.[1] ?? null;

  // Logo candidates, best-first: a header <img> with "logo", then icons, then OG.
  const linkHref = (rel: string): string | null => {
    const tag = html.match(new RegExp(`<link[^>]+rel=["'][^"']*${rel}[^"']*["'][^>]*>`, "i"))?.[0];
    return abs(tag?.match(/href=["']([^"']+)["']/i)?.[1]);
  };
  const imgLogo = (() => {
    for (const tag of html.match(/<img[^>]+>/gi) ?? []) {
      if (/logo/i.test(tag)) {
        const a = abs(tag.match(/\bsrc=["']([^"']+)["']/i)?.[1]);
        if (a) return a;
      }
    }
    return null;
  })();
  const candidates = [
    imgLogo,
    linkHref("apple-touch-icon"),
    linkHref("icon"),
    abs(html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1]),
  ].filter((x): x is string => Boolean(x));

  // Fonts → nearest type pairing.
  const fontBlob = (
    (html.match(/family=([A-Za-z+ ]+)/g) ?? []).join(" ") +
    " " +
    (html.match(/font-family:\s*([^;"'}]+)/gi) ?? []).join(" ")
  ).toLowerCase();
  const pairing = /playfair/.test(fontBlob)
    ? "grand"
    : /cormorant/.test(fontBlob)
      ? "refined"
      : /space grotesk/.test(fontBlob)
        ? "modern"
        : /archivo/.test(fontBlob)
          ? "bold"
          : /dm serif|dm sans/.test(fontBlob)
            ? "warm"
            : /libre baskerville/.test(fontBlob)
              ? "classic"
              : /syne/.test(fontBlob)
                ? "avant"
                : "editorial";

  // Download the best usable logo into R2 so the client can read it same-origin
  // (needed for canvas palette extraction) and it's stable.
  let logoUrl: string | null = null;
  for (const cand of candidates.slice(0, 5)) {
    try {
      const r = await fetch(cand, { redirect: "follow" });
      if (!r.ok) continue;
      const ct = r.headers.get("content-type") || "";
      if (!ct.startsWith("image/")) continue;
      const bytes = new Uint8Array(await r.arrayBuffer());
      if (bytes.length < 80 || bytes.length > 3_000_000) continue;
      const ext = ct.includes("svg") ? "svg" : ct.includes("webp") ? "webp" : ct.includes("jpeg") ? "jpg" : ct.includes("x-icon") || ct.includes("vnd.microsoft.icon") ? "ico" : "png";
      const fileId = newId("file");
      const key = `uploads/brand/import/${fileId}.${ext}`;
      await c.env.FILES.put(key, bytes, { httpMetadata: { contentType: ct } });
      await run(
        c.var.db,
        `INSERT INTO files (id, r2_key, filename, content_type, size_bytes, entity_type, entity_id, is_public, uploaded_by)
         VALUES (?, ?, ?, ?, ?, 'brand', 'import', 1, ?)`,
        fileId,
        key,
        `imported-logo.${ext}`,
        ct,
        bytes.length,
        c.var.userId,
      );
      logoUrl = `/media/${fileId}`;
      break;
    } catch {
      /* try the next candidate */
    }
  }

  return c.json({ name, tagline, themeColor, logoUrl, pairing });
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
