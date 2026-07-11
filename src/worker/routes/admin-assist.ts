import { Hono } from "hono";
import { aiComplete, AiUnavailableError } from "../services/ai";
import { askClaude, AnthropicNotConfiguredError, parseModelJson } from "../services/anthropic";
import { reserveCompanionQuota, companionQuotaExceededBody } from "../services/ai-quota";
import type { AppContext } from "../types/env";

/**
 * The Interpreter: two assists for the conversations a studio actually has.
 *
 * DECODE — paste any message (a client's tangled three-paragraph worry, a
 * maker's reply in another language, a fabric mill's jargon) and get back
 * what it says, what they actually need, the trade terms explained, and a
 * reply drafted twice: in your language to review, in theirs to send.
 *
 * MEASURE FROM PHOTOS — front (+ optional side) photo plus the client's
 * height → an AI-estimated dress-measure set. Honestly framed: it is a
 * STARTING POINT the tape must confirm at the fitting; estimates land as a
 * draft with the caveat attached, never silently as truth. Vision runs on
 * the shop's Anthropic key; without one, the feature explains itself and
 * bows out.
 */
export const adminAssistRoutes = new Hono<AppContext>();

const KINDS = ["client", "maker", "fabric"] as const;

adminAssistRoutes.post("/decode", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const text = typeof body.text === "string" ? body.text.trim().slice(0, 6000) : "";
  if (text.length < 10) return c.json({ error: "Paste the message first." }, 400);
  const kind = (KINDS as readonly string[]).includes(body.kind as string) ? (body.kind as string) : "client";
  const notes = typeof body.notes === "string" ? body.notes.slice(0, 500) : "";

  const quota = await reserveCompanionQuota(c);
  if (!quota.ok) return c.json(companionQuotaExceededBody(quota), 429);

  const who =
    kind === "client"
      ? "a client of the studio (a person commissioning or buying custom clothing — possibly vague, emotional, or unfamiliar with garment terms)"
      : kind === "maker"
        ? "a garment maker / factory / contractor (possibly writing in another language, using production and piece-rate jargon)"
        : "a fabric supplier or mill (possibly writing in another language, using textile trade jargon: GSM, MOQ, greige, lab dips)";

  const system = `You are the Verto Interpreter, helping the owner of an independent fashion studio handle a message from ${who}.
Respond with ONLY a JSON object, no prose around it:
{
  "language": "the language the message is written in",
  "translation": "faithful English translation (or the original if already English)",
  "reading": "2-4 plain sentences: what this person actually needs or is really asking, including anything implied but unsaid, and what the risk is if it's mishandled",
  "terms": [{"term": "...", "meaning": "plain-words meaning"}],
  "reply": "a warm, professional reply in English the owner can review — concrete, kind, specific; asks for exactly the missing details if any; never overpromises",
  "replyTranslated": "the same reply in the sender's language (omit or empty if the message was in English)"
}
Rules: never invent prices, dates or commitments the owner didn't state; if the message needs a decision only the owner can make, the reply should buy time gracefully and the reading should name the decision. Keep terms[] short — only jargon that actually appears.`;

  try {
    const { text: raw, provider } = await aiComplete(c.env, {
      system,
      prompt: `${notes ? `Owner's note for context: ${notes}\n\n` : ""}The message:\n\n${text}`,
      maxTokens: 1400,
    });
    const parsed = parseModelJson(raw) as Record<string, unknown> | null;
    if (!parsed || typeof parsed !== "object" || typeof parsed.reply !== "string") {
      return c.json({ error: "The interpreter garbled that one — try again." }, 502);
    }
    return c.json({
      language: typeof parsed.language === "string" ? parsed.language : "unknown",
      translation: typeof parsed.translation === "string" ? parsed.translation : "",
      reading: typeof parsed.reading === "string" ? parsed.reading : "",
      terms: Array.isArray(parsed.terms)
        ? (parsed.terms as { term?: string; meaning?: string }[])
            .filter((t) => t && typeof t.term === "string" && typeof t.meaning === "string")
            .slice(0, 8)
        : [],
      reply: parsed.reply,
      replyTranslated: typeof parsed.replyTranslated === "string" ? parsed.replyTranslated : "",
      provider,
    });
  } catch (err) {
    if (err instanceof AiUnavailableError) {
      return c.json({ error: "No AI provider is configured on this deployment yet." }, 503);
    }
    return c.json({ error: "The interpreter lost the thread — try again." }, 500);
  }
});

// ---- measurements from photos --------------------------------------------------

const MEASURE_KEYS = [
  "chestCm",
  "waistCm",
  "hipsCm",
  "neckCm",
  "shoulderToShoulderCm",
  "shoulderToWristCm",
  "bicepsCm",
  "wristCm",
  "seatCm",
  "inseamCm",
  "waistToFloorCm",
] as const;

function dataUrlToImage(v: unknown): { base64: string; mediaType: string } | null {
  if (typeof v !== "string") return null;
  const m = v.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return null;
  if (m[2].length > 4_500_000) return null; // ~3MB decoded — plenty for a phone photo
  return { mediaType: m[1], base64: m[2] };
}

adminAssistRoutes.post("/measure-photos", async (c) => {
  if (!c.env.ANTHROPIC_API_KEY) {
    return c.json(
      { error: "Photo measuring needs the shop's Anthropic key (Settings → AI). The tape measure still works beautifully." },
      503,
    );
  }
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const front = dataUrlToImage(body.front);
  const side = dataUrlToImage(body.side);
  const heightCm = typeof body.heightCm === "number" ? body.heightCm : parseFloat(String(body.heightCm));
  if (!front) return c.json({ error: "A front photo is required (JPEG/PNG, under ~3MB)." }, 400);
  if (!Number.isFinite(heightCm) || heightCm < 100 || heightCm > 230) {
    return c.json({ error: "The client's height (in cm) calibrates the estimate — it's required." }, 400);
  }

  const quota = await reserveCompanionQuota(c);
  if (!quota.ok) return c.json(companionQuotaExceededBody(quota), 429);

  const system = `You estimate body measurements for a made-to-measure clothing studio from photographs. The person's stated height is your scale reference. Be honest about uncertainty: these are starting estimates a fitter will verify with a tape — round to the nearest centimeter, and if a measurement genuinely cannot be judged from the photos (covered by loose clothing, cropped out), return null for it rather than guessing wildly.
Respond with ONLY JSON:
{"measurements": {${MEASURE_KEYS.map((k) => `"${k}": number|null`).join(", ")}}, "confidence": "low|medium", "caveats": "one sentence on what most limits this estimate (clothing, pose, angle)"}`;

  try {
    const result = await askClaude(c.env, {
      system,
      prompt: `Stated height: ${heightCm} cm. ${side ? "Two photos: front, then side." : "One photo: front only (expect lower confidence on depth-dependent girths)."} Estimate the measurement set.`,
      images: side ? [front, side] : [front],
      maxTokens: 700,
    });
    const parsed = parseModelJson(result.text) as Record<string, unknown> | null;
    const rawMeas = (parsed?.measurements ?? {}) as Record<string, unknown>;
    const measurements: Record<string, number> = {};
    for (const k of MEASURE_KEYS) {
      const v = rawMeas[k];
      if (typeof v === "number" && v > 10 && v < 250) measurements[k] = Math.round(v * 10) / 10;
    }
    measurements.heightCm = heightCm;
    if (Object.keys(measurements).length < 4) {
      return c.json({ error: "Couldn't read enough from those photos — try better light, fitted clothing, and the full body in frame." }, 422);
    }
    return c.json({
      measurements,
      confidence: parsed?.confidence === "medium" ? "medium" : "low",
      caveats: typeof parsed?.caveats === "string" ? parsed.caveats : "",
    });
  } catch (err) {
    if (err instanceof AnthropicNotConfiguredError) {
      return c.json({ error: "Photo measuring needs the shop's Anthropic key." }, 503);
    }
    return c.json({ error: "Couldn't estimate from those photos — try again." }, 500);
  }
});
