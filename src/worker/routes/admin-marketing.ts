import { Hono } from "hono";
import { z } from "zod";
import { all, first, run, writeAudit } from "../services/db";
import { parseBody } from "../services/validators";
import { requireAdminWrite } from "../middleware/auth";
import { aiComplete, AiUnavailableError } from "../services/ai";
import { parseModelJson } from "../services/anthropic";
import { getBrandName } from "../services/brand";
import { buyerEmailConfigured, sendBuyerEmail } from "../services/buyer-email";
import { newId, sha256Hex } from "../utils/id";
import type { AppContext, Env } from "../types/env";

/**
 * Marketing suite: campaigns fan out into multi-channel content kits
 * (social, email, blog, press, ads) written by AI in the brand's voice —
 * using the shop's Anthropic key when present, Workers AI Llama otherwise.
 * Everything is a draft the merchant edits, schedules, and marks posted;
 * nothing auto-publishes anywhere.
 */
export const adminMarketingRoutes = new Hono<AppContext>();

// ---------- Channel catalog (drives generation prompts and the UI) ----------

export interface ChannelDef {
  channel: string;
  label: string;
  kind: string;
  guidance: string;
}

const CHANNELS: ChannelDef[] = [
  {
    channel: "instagram",
    label: "Instagram post",
    kind: "caption",
    guidance:
      `"title": a 4-6 word hook, "content": an Instagram caption (≤150 words, line breaks welcome, no hashtags inside), ` +
      `"meta": {"hashtags": [18-24 specific, niche hashtags without #]}`,
  },
  {
    channel: "story",
    label: "Instagram/TikTok story",
    kind: "script",
    guidance:
      `"title": story concept name, "content": a 3-frame story storyboard — for each frame: what's on screen + the text overlay (≤10 words per overlay)`,
  },
  {
    channel: "tiktok",
    label: "TikTok / Reel script",
    kind: "script",
    guidance:
      `"title": the first-second hook line, "content": a 30-second video script: HOOK (0-3s), 3 BEATS with what to film and say, CTA — formatted with those labels`,
  },
  {
    channel: "pinterest",
    label: "Pinterest pin",
    kind: "caption",
    guidance: `"title": pin title (≤100 chars, keyword-forward), "content": pin description (≤450 chars, searchable phrasing)`,
  },
  {
    channel: "x",
    label: "X (Twitter) post",
    kind: "caption",
    guidance: `"title": null, "content": a single post ≤270 characters, no hashtags unless truly natural`,
  },
  {
    channel: "facebook",
    label: "Facebook post",
    kind: "caption",
    guidance: `"title": null, "content": a Facebook post (~80-120 words, one clear link call-to-action)`,
  },
  {
    channel: "email",
    label: "Email to subscribers",
    kind: "email",
    guidance:
      `"title": the best subject line (≤55 chars), "content": a plain-text email (~150 words: personal opener, one idea, one CTA link placeholder {{SHOP_URL}}), ` +
      `"meta": {"altSubjects": [2 alternative subject lines]}`,
  },
  {
    channel: "blog",
    label: "Blog / journal draft",
    kind: "article",
    guidance:
      `"title": article title, "content": a ~450-word markdown article with ## sections supporting the campaign editorially (not an ad), ` +
      `"meta": {"keywords": [4-6 SEO phrases], "slug": "kebab-case-slug"}`,
  },
  {
    channel: "press",
    label: "Press release",
    kind: "press_release",
    guidance:
      `"title": press release headline, "content": a proper press release in markdown — dateline, 3-4 short paragraphs (news first, quote from the founder, availability), ` +
      `"# # #" ending, and a boilerplate "About" paragraph with a [contact email] placeholder`,
  },
  {
    channel: "ad_google",
    label: "Google ads",
    kind: "ad_set",
    guidance:
      `"title": null, "content": one sentence describing the targeting angle, ` +
      `"meta": {"headlines": [5 headlines, EACH ≤30 characters], "descriptions": [3 descriptions, EACH ≤90 characters]}`,
  },
  {
    channel: "ad_meta",
    label: "Meta (IG/FB) ads",
    kind: "ad_set",
    guidance:
      `"title": null, "content": one sentence describing the creative angle, ` +
      `"meta": {"variants": [3 objects: {"primaryText": ≤125 chars, "headline": ≤40 chars, "description": ≤30 chars}]}`,
  },
];

const CHANNEL_SLUGS = CHANNELS.map((c) => c.channel);

adminMarketingRoutes.get("/channels", (c) =>
  c.json(CHANNELS.map(({ channel, label }) => ({ channel, label }))),
);

// ---------- Campaign CRUD ----------

const campaignSchema = z.object({
  name: z.string().min(1).max(150),
  objective: z.enum(["launch", "drop", "sale", "seasonal", "evergreen", "press"]).optional(),
  subject: z.string().max(2000).nullable().optional(),
  keyMessage: z.string().max(500).nullable().optional(),
  audience: z.string().max(500).nullable().optional(),
  productId: z.string().max(80).nullable().optional(),
  collectionId: z.string().max(80).nullable().optional(),
  startsOn: z.string().max(30).nullable().optional(),
  endsOn: z.string().max(30).nullable().optional(),
  status: z.enum(["draft", "active", "done", "archived"]).optional(),
});

adminMarketingRoutes.get("/campaigns", async (c) => {
  const rows = await all(
    c.env.DB,
    `SELECT mc.*, p.name AS product_name, col.name AS collection_name,
       (SELECT COUNT(*) FROM marketing_assets a WHERE a.campaign_id = mc.id) AS asset_count,
       (SELECT COUNT(*) FROM marketing_assets a WHERE a.campaign_id = mc.id AND a.posted_at IS NOT NULL) AS posted_count,
       (SELECT MIN(a.scheduled_for) FROM marketing_assets a
          WHERE a.campaign_id = mc.id AND a.posted_at IS NULL AND a.scheduled_for >= date('now')) AS next_scheduled
     FROM marketing_campaigns mc
     LEFT JOIN products p ON p.id = mc.product_id
     LEFT JOIN collections col ON col.id = mc.collection_id
     ORDER BY mc.created_at DESC`,
  );
  return c.json(rows);
});

adminMarketingRoutes.post("/campaigns", requireAdminWrite, async (c) => {
  const body = await parseBody(c, campaignSchema);
  const id = newId("mkc");
  await run(
    c.env.DB,
    `INSERT INTO marketing_campaigns (id, name, objective, subject, key_message, audience, product_id, collection_id, starts_on, ends_on)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    body.name,
    body.objective ?? "launch",
    body.subject ?? null,
    body.keyMessage ?? null,
    body.audience ?? null,
    body.productId ?? null,
    body.collectionId ?? null,
    body.startsOn ?? null,
    body.endsOn ?? null,
  );
  await writeAudit(c.env.DB, c.var.userId, "marketing.campaign.create", "marketing_campaign", id, {
    name: body.name,
  });
  return c.json({ id }, 201);
});

adminMarketingRoutes.get("/campaigns/:id", async (c) => {
  const campaign = await first(
    c.env.DB,
    `SELECT mc.*, p.name AS product_name, col.name AS collection_name
     FROM marketing_campaigns mc
     LEFT JOIN products p ON p.id = mc.product_id
     LEFT JOIN collections col ON col.id = mc.collection_id
     WHERE mc.id = ?`,
    c.req.param("id"),
  );
  if (!campaign) return c.json({ error: "Campaign not found" }, 404);
  const assets = await all(
    c.env.DB,
    `SELECT * FROM marketing_assets WHERE campaign_id = ? ORDER BY sort_order, created_at`,
    c.req.param("id"),
  );
  return c.json({ ...campaign, assets });
});

adminMarketingRoutes.patch("/campaigns/:id", requireAdminWrite, async (c) => {
  const body = await parseBody(c, campaignSchema.partial());
  const fieldMap: Record<string, string> = {
    name: "name",
    objective: "objective",
    subject: "subject",
    keyMessage: "key_message",
    audience: "audience",
    productId: "product_id",
    collectionId: "collection_id",
    startsOn: "starts_on",
    endsOn: "ends_on",
    status: "status",
  };
  const sets: string[] = [`updated_at = datetime('now')`];
  const params: unknown[] = [];
  for (const [key, col] of Object.entries(fieldMap)) {
    if (key in body) {
      sets.push(`${col} = ?`);
      params.push((body as Record<string, unknown>)[key] ?? null);
    }
  }
  await run(
    c.env.DB,
    `UPDATE marketing_campaigns SET ${sets.join(", ")} WHERE id = ?`,
    ...params,
    c.req.param("id"),
  );
  return c.json({ ok: true });
});

adminMarketingRoutes.delete("/campaigns/:id", requireAdminWrite, async (c) => {
  const result = await run(
    c.env.DB,
    `DELETE FROM marketing_campaigns WHERE id = ?`,
    c.req.param("id"),
  );
  if (!result.meta.changes) return c.json({ error: "Campaign not found" }, 404);
  await writeAudit(c.env.DB, c.var.userId, "marketing.campaign.delete", "marketing_campaign", c.req.param("id"));
  return c.json({ ok: true });
});

// ---------- Kit generation ----------

interface CampaignRow {
  id: string;
  name: string;
  objective: string;
  subject: string | null;
  key_message: string | null;
  audience: string | null;
  product_id: string | null;
  collection_id: string | null;
  starts_on: string | null;
  ends_on: string | null;
}

async function campaignContext(env: Env, campaign: CampaignRow): Promise<string> {
  const brandName = await getBrandName(env);
  const settings = await all<{ key: string; value: string }>(
    env.DB,
    `SELECT key, value FROM settings WHERE key IN ('brand_tagline','brand_voice')`,
  );
  const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));
  const lines = [
    `Brand: ${brandName}${map.brand_tagline ? ` — ${map.brand_tagline}` : ""}`,
    map.brand_voice ? `Brand voice (follow closely):\n${map.brand_voice}` : null,
    `Campaign: ${campaign.name} (objective: ${campaign.objective})`,
    campaign.subject ? `What it's about: ${campaign.subject}` : null,
    campaign.key_message ? `The one message every asset must land: ${campaign.key_message}` : null,
    campaign.audience ? `Audience: ${campaign.audience}` : null,
    campaign.starts_on ? `Runs: ${campaign.starts_on}${campaign.ends_on ? ` → ${campaign.ends_on}` : ""}` : null,
  ];

  if (campaign.product_id) {
    const product = await first<{
      name: string;
      subtitle: string | null;
      description: string | null;
      fabric_composition: string | null;
      origin_statement: string | null;
      base_price_cents: number;
      currency: string;
      slug: string;
    }>(
      env.DB,
      `SELECT name, subtitle, description, fabric_composition, origin_statement, base_price_cents, currency, slug
       FROM products WHERE id = ?`,
      campaign.product_id,
    );
    if (product) {
      lines.push(
        `Featured product: ${product.name}${product.subtitle ? ` — ${product.subtitle}` : ""}`,
        product.description ? `Product description: ${product.description.slice(0, 500)}` : null,
        product.fabric_composition ? `Fabric: ${product.fabric_composition}` : null,
        product.origin_statement ? `Origin: ${product.origin_statement}` : null,
        `Price: ${(product.base_price_cents / 100).toFixed(0)} ${product.currency}`,
        `Product URL path: /products/${product.slug}`,
      );
    }
  }
  if (campaign.collection_id) {
    const collection = await first<{ name: string; season: string | null; editorial_copy: string | null; slug: string }>(
      env.DB,
      `SELECT name, season, editorial_copy, slug FROM collections WHERE id = ?`,
      campaign.collection_id,
    );
    if (collection) {
      lines.push(
        `Featured collection: ${collection.name}${collection.season ? ` (${collection.season})` : ""}`,
        collection.editorial_copy ? `Collection copy: ${collection.editorial_copy.slice(0, 400)}` : null,
        `Collection URL path: /collections/${collection.slug}`,
      );
    }
  }
  return lines.filter(Boolean).join("\n");
}

const SYSTEM_MARKETER =
  `You are a sharp, tasteful marketing writer for an independent clothing brand. ` +
  `You write like a person, not a brand robot: concrete, warm, zero clichés ("elevate", "timeless", ` +
  `"must-have" are banned), sparing with exclamation marks, honest about the product. ` +
  `You always respond with exactly one JSON value and no surrounding prose.`;

async function generateAssets(
  env: Env,
  campaign: CampaignRow,
  channels: string[],
): Promise<{ channel: string; kind: string; title: string | null; content: string; meta: unknown }[]> {
  const context = await campaignContext(env, campaign);
  const specs = channels
    .map((slug) => {
      const def = CHANNELS.find((ch) => ch.channel === slug)!;
      return `- "${def.channel}": ${def.guidance}`;
    })
    .join("\n");
  const prompt =
    `${context}\n\n` +
    `Write the campaign content for these channels. Return a JSON array with one object per channel:\n` +
    `[{"channel": "...", "title": string|null, "content": "...", "meta": {…} or null}, …]\n\n` +
    `Channel requirements:\n${specs}\n\n` +
    `Every asset must carry the campaign's key message in that channel's native format. No markdown code fences.`;

  const attempt = async () => {
    const completion = await aiComplete(env, {
      system: SYSTEM_MARKETER,
      prompt,
      maxTokens: 6000,
    });
    const parsed = parseModelJson(completion.text);
    if (!Array.isArray(parsed)) throw new Error("Expected a JSON array");
    return parsed as { channel?: string; title?: string | null; content?: string; meta?: unknown }[];
  };

  let items;
  try {
    items = await attempt();
  } catch (err) {
    if (err instanceof AiUnavailableError) throw err;
    items = await attempt(); // one retry on malformed JSON
  }
  return items
    .filter((item) => item.channel && CHANNEL_SLUGS.includes(item.channel) && item.content)
    .map((item) => ({
      channel: item.channel!,
      kind: CHANNELS.find((ch) => ch.channel === item.channel)!.kind,
      title: typeof item.title === "string" ? item.title : null,
      content: String(item.content),
      meta: item.meta ?? null,
    }));
}

const generateSchema = z.object({
  channels: z.array(z.enum(CHANNEL_SLUGS as [string, ...string[]])).min(1).max(11),
});

adminMarketingRoutes.post("/campaigns/:id/generate", requireAdminWrite, async (c) => {
  const body = await parseBody(c, generateSchema);
  const campaign = await first<CampaignRow>(
    c.env.DB,
    `SELECT * FROM marketing_campaigns WHERE id = ?`,
    c.req.param("id"),
  );
  if (!campaign) return c.json({ error: "Campaign not found" }, 404);

  let assets;
  try {
    assets = await generateAssets(c.env, campaign, body.channels);
  } catch (err) {
    if (err instanceof AiUnavailableError) return c.json({ error: err.message }, 503);
    return c.json({ error: "Generation produced unusable output — try again" }, 502);
  }
  if (assets.length === 0) {
    return c.json({ error: "Generation produced nothing usable — try again" }, 502);
  }

  // Replace prior unposted assets for the regenerated channels only.
  const placeholders = assets.map(() => "?").join(",");
  await run(
    c.env.DB,
    `DELETE FROM marketing_assets
     WHERE campaign_id = ? AND posted_at IS NULL AND channel IN (${placeholders})`,
    campaign.id,
    ...assets.map((a) => a.channel),
  );
  for (const [i, asset] of assets.entries()) {
    await run(
      c.env.DB,
      `INSERT INTO marketing_assets (id, campaign_id, channel, kind, title, content, meta_json, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      newId("mka"),
      campaign.id,
      asset.channel,
      asset.kind,
      asset.title,
      asset.content,
      asset.meta ? JSON.stringify(asset.meta).slice(0, 8000) : null,
      i,
    );
  }
  await writeAudit(c.env.DB, c.var.userId, "marketing.kit.generate", "marketing_campaign", campaign.id, {
    channels: body.channels,
  });
  return c.json({ created: assets.length });
});

// ---------- Assets ----------

const assetUpdateSchema = z.object({
  title: z.string().max(300).nullable().optional(),
  content: z.string().max(20000).optional(),
  scheduledFor: z.string().max(30).nullable().optional(),
  posted: z.boolean().optional(),
});

adminMarketingRoutes.patch("/assets/:id", requireAdminWrite, async (c) => {
  const body = await parseBody(c, assetUpdateSchema);
  const sets: string[] = [`updated_at = datetime('now')`];
  const params: unknown[] = [];
  if (body.title !== undefined) (sets.push("title = ?"), params.push(body.title));
  if (body.content !== undefined) (sets.push("content = ?"), params.push(body.content));
  if (body.scheduledFor !== undefined) (sets.push("scheduled_for = ?"), params.push(body.scheduledFor));
  if (body.posted !== undefined)
    (sets.push("posted_at = ?"), params.push(body.posted ? new Date().toISOString() : null));
  const result = await run(
    c.env.DB,
    `UPDATE marketing_assets SET ${sets.join(", ")} WHERE id = ?`,
    ...params,
    c.req.param("id"),
  );
  if (!result.meta.changes) return c.json({ error: "Asset not found" }, 404);
  return c.json({ ok: true });
});

adminMarketingRoutes.delete("/assets/:id", requireAdminWrite, async (c) => {
  const result = await run(c.env.DB, `DELETE FROM marketing_assets WHERE id = ?`, c.req.param("id"));
  if (!result.meta.changes) return c.json({ error: "Asset not found" }, 404);
  return c.json({ ok: true });
});

adminMarketingRoutes.post("/assets/:id/regenerate", requireAdminWrite, async (c) => {
  const asset = await first<{ id: string; campaign_id: string; channel: string }>(
    c.env.DB,
    `SELECT id, campaign_id, channel FROM marketing_assets WHERE id = ?`,
    c.req.param("id"),
  );
  if (!asset) return c.json({ error: "Asset not found" }, 404);
  const campaign = await first<CampaignRow>(
    c.env.DB,
    `SELECT * FROM marketing_campaigns WHERE id = ?`,
    asset.campaign_id,
  );
  if (!campaign) return c.json({ error: "Campaign not found" }, 404);
  try {
    const [generated] = await generateAssets(c.env, campaign, [asset.channel]);
    if (!generated) return c.json({ error: "Generation produced nothing — try again" }, 502);
    await run(
      c.env.DB,
      `UPDATE marketing_assets SET title = ?, content = ?, meta_json = ?, updated_at = datetime('now')
       WHERE id = ?`,
      generated.title,
      generated.content,
      generated.meta ? JSON.stringify(generated.meta).slice(0, 8000) : null,
      asset.id,
    );
    return c.json({ ok: true });
  } catch (err) {
    if (err instanceof AiUnavailableError) return c.json({ error: err.message }, 503);
    return c.json({ error: "Generation produced unusable output — try again" }, 502);
  }
});

// ---------- Calendar (upcoming scheduled assets across campaigns) ----------

adminMarketingRoutes.get("/calendar", async (c) => {
  const rows = await all(
    c.env.DB,
    `SELECT a.id, a.channel, a.title, a.scheduled_for, a.posted_at,
            mc.id AS campaign_id, mc.name AS campaign_name
     FROM marketing_assets a
     JOIN marketing_campaigns mc ON mc.id = a.campaign_id
     WHERE a.scheduled_for IS NOT NULL
     ORDER BY a.scheduled_for ASC LIMIT 100`,
  );
  return c.json(rows);
});

// ---------- Content ideas (SEO topic generator → draft journal posts) ----------

adminMarketingRoutes.post("/content-ideas", requireAdminWrite, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { theme?: string };
  const brandName = await getBrandName(c.env);
  const settings = await all<{ key: string; value: string }>(
    c.env.DB,
    `SELECT key, value FROM settings WHERE key IN ('brand_tagline','brand_voice')`,
  );
  const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));
  const products = await all<{ name: string; category: string }>(
    c.env.DB,
    `SELECT name, category FROM products WHERE is_published = 1 LIMIT 12`,
  );
  try {
    const completion = await aiComplete(c.env, {
      system: SYSTEM_MARKETER,
      prompt:
        `Brand: ${brandName}${map.brand_tagline ? ` — ${map.brand_tagline}` : ""}\n` +
        (map.brand_voice ? `Voice: ${map.brand_voice}\n` : "") +
        `Products: ${products.map((p) => `${p.name} (${p.category})`).join(", ") || "clothing"}\n` +
        (body.theme ? `Theme to lean into: ${body.theme}\n` : "") +
        `\nSuggest 8 blog/journal article ideas that could realistically rank in search AND fit this brand's editorial voice. ` +
        `Mix evergreen (care guides, materials, fit) with brand-building (process, place, people). Return JSON:\n` +
        `[{"title": "...", "slug": "kebab-case", "angle": "1 sentence on the take", "keywords": ["3-5 phrases"]}]`,
      maxTokens: 2000,
    });
    const ideas = parseModelJson(completion.text);
    if (!Array.isArray(ideas)) throw new Error("bad shape");
    return c.json({ ideas: ideas.slice(0, 10), provider: completion.provider });
  } catch (err) {
    if (err instanceof AiUnavailableError) return c.json({ error: err.message }, 503);
    return c.json({ error: "Idea generation failed — try again" }, 502);
  }
});

// ---------- Email sends ----------

function audienceWhere(audience: string): { where: string; params: string[] } {
  if (audience === "newsletter") return { where: `kind = ?`, params: ["newsletter"] };
  if (audience === "waitlist") return { where: `kind = ?`, params: ["waitlist"] };
  return { where: `kind IN (?, ?, ?)`, params: ["newsletter", "waitlist", "drop_notification"] };
}

adminMarketingRoutes.get("/email-audience", async (c) => {
  const counts = await all<{ kind: string; n: number }>(
    c.env.DB,
    `SELECT kind, COUNT(DISTINCT email) AS n FROM leads
     WHERE unsubscribed_at IS NULL AND kind IN ('newsletter','waitlist','drop_notification')
     GROUP BY kind`,
  );
  return c.json({
    configured: buyerEmailConfigured(c.env),
    counts: Object.fromEntries(counts.map((r) => [r.kind, r.n])),
  });
});

const sendSchema = z.object({
  assetId: z.string().min(1),
  audience: z.enum(["newsletter", "waitlist", "all"]),
});

adminMarketingRoutes.post("/campaigns/:id/send-email", requireAdminWrite, async (c) => {
  if (!buyerEmailConfigured(c.env)) {
    return c.json(
      { error: "Email sending isn't configured yet (BUYER_EMAIL_FROM + onboarded domain)" },
      503,
    );
  }
  const body = await parseBody(c, sendSchema);
  const asset = await first<{ id: string; title: string | null; content: string; campaign_id: string }>(
    c.env.DB,
    `SELECT id, title, content, campaign_id FROM marketing_assets WHERE id = ? AND campaign_id = ?`,
    body.assetId,
    c.req.param("id"),
  );
  if (!asset) return c.json({ error: "Asset not found on this campaign" }, 404);
  if (!asset.title) return c.json({ error: "The email needs a subject line (asset title)" }, 400);

  const { where, params } = audienceWhere(body.audience);
  const recipients = await all<{ email: string }>(
    c.env.DB,
    `SELECT DISTINCT email FROM leads WHERE unsubscribed_at IS NULL AND ${where} LIMIT 500`,
    ...params,
  );
  if (recipients.length === 0) return c.json({ error: "No subscribers in that audience yet" }, 409);

  const appUrl = (c.env.APP_URL || new URL(c.req.url).origin).replace(/\/$/, "");
  const secret = c.env.SESSION_SECRET ?? "";
  const bodyText = asset.content.replaceAll("{{SHOP_URL}}", `${appUrl}/products`);

  const sendId = newId("mks");
  await run(
    c.env.DB,
    `INSERT INTO marketing_sends (id, campaign_id, asset_id, subject, audience, recipient_count)
     VALUES (?, ?, ?, ?, ?, ?)`,
    sendId,
    asset.campaign_id,
    asset.id,
    asset.title,
    body.audience,
    recipients.length,
  );
  await run(
    c.env.DB,
    `UPDATE marketing_assets SET posted_at = ?, updated_at = datetime('now') WHERE id = ?`,
    new Date().toISOString(),
    asset.id,
  );
  await writeAudit(c.env.DB, c.var.userId, "marketing.email.send", "marketing_send", sendId, {
    audience: body.audience,
    recipients: recipients.length,
  });

  // Fan the sends out after responding — 500 sequential sends would block.
  const env = c.env;
  c.executionCtx.waitUntil(
    (async () => {
      for (const r of recipients) {
        const token = (await sha256Hex(`${r.email.toLowerCase()}${secret}`)).slice(0, 32);
        const unsubscribe = `${appUrl}/api/public/unsubscribe?email=${encodeURIComponent(r.email)}&token=${token}`;
        await sendBuyerEmail(env, {
          to: r.email,
          subject: asset.title!,
          text: `${bodyText}\n\n—\nYou're receiving this because you joined the list at ${appUrl}.\nUnsubscribe: ${unsubscribe}`,
        });
      }
    })(),
  );
  return c.json({ ok: true, recipients: recipients.length });
});

// ---------- Sends history ----------
adminMarketingRoutes.get("/sends", async (c) => {
  const rows = await all(
    c.env.DB,
    `SELECT ms.*, mc.name AS campaign_name FROM marketing_sends ms
     LEFT JOIN marketing_campaigns mc ON mc.id = ms.campaign_id
     ORDER BY ms.sent_at DESC LIMIT 50`,
  );
  return c.json(rows);
});
