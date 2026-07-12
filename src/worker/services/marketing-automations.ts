import { first, run } from "./db";
import { newId } from "../utils/id";
import { AiUnavailableError } from "./ai";
import { generateAssets, type CampaignRow } from "../routes/admin-marketing";
import type { Env } from "../types/env";

/**
 * Marketing automations — rules that, on a shop event, draft a marketing
 * campaign into the existing draft surface (marketing_campaigns +
 * marketing_assets). Everything lands as an editable draft on the Marketing
 * page: nothing posts or sends on its own. Each runs off the request path (via
 * executionCtx.waitUntil) because it makes an LLM call, and degrades cleanly
 * when no AI provider is configured (the campaign is still started for one-tap
 * generation).
 */

interface CampaignSpec {
  name: string;
  objective: "launch" | "drop" | "sale" | "seasonal" | "evergreen" | "press";
  channels: string[];
  productId?: string | null;
  subject?: string;
  keyMessage?: string;
  /** Skip if any campaign already exists for this product+objective (e.g. launch — once ever). */
  oncePerProduct?: boolean;
  /** Skip if a non-archived campaign with this exact name still has an unposted draft. */
  oncePerName?: boolean;
  /** Auto-approve: schedule the drafts onto the content calendar instead of leaving them un-dated. */
  autoApprove?: boolean;
  feedEntity: { type: string; id: string };
  feedNoun: string;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const futureDate = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

async function draftCampaign(env: Env, db: D1Database, spec: CampaignSpec): Promise<void> {
  try {
    if (spec.oncePerProduct && spec.productId) {
      const existing = await first<{ id: string }>(
        db,
        `SELECT id FROM marketing_campaigns WHERE product_id = ? AND objective = ? LIMIT 1`,
        spec.productId,
        spec.objective,
      );
      if (existing) return;
    }
    if (spec.oncePerName) {
      const existing = await first<{ id: string }>(
        db,
        `SELECT c.id FROM marketing_campaigns c
         WHERE c.name = ? AND c.status != 'archived'
           AND EXISTS (SELECT 1 FROM marketing_assets a WHERE a.campaign_id = c.id AND a.posted_at IS NULL)
         LIMIT 1`,
        spec.name,
      );
      if (existing) return;
    }

    const campaignId = newId("mkc");
    const today = new Date().toISOString().slice(0, 10);
    const name = spec.name.slice(0, 200);
    await run(
      db,
      `INSERT INTO marketing_campaigns (id, name, objective, subject, key_message, product_id, status, starts_on)
       VALUES (?, ?, ?, ?, ?, ?, 'draft', ?)`,
      campaignId,
      name,
      spec.objective,
      (spec.subject ?? name).slice(0, 300),
      (spec.keyMessage ?? "").slice(0, 1500) || null,
      spec.productId ?? null,
      today,
    );

    const campaign: CampaignRow = {
      id: campaignId,
      name,
      objective: spec.objective,
      subject: spec.subject ?? name,
      key_message: spec.keyMessage ?? null,
      audience: null,
      product_id: spec.productId ?? null,
      collection_id: null,
      starts_on: today,
      ends_on: null,
    };

    let drafted = 0;
    try {
      const assets = await generateAssets(env, db, campaign, spec.channels);
      for (let i = 0; i < assets.length; i++) {
        const a = assets[i];
        // Auto-approve schedules each piece a few days apart on the content
        // calendar; otherwise it's an un-dated draft the shop schedules itself.
        const scheduledFor = spec.autoApprove ? futureDate(2 + i * 2) : null;
        await run(
          db,
          `INSERT INTO marketing_assets (id, campaign_id, channel, kind, title, content, meta_json, scheduled_for, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          newId("mka"),
          campaignId,
          a.channel,
          a.kind,
          a.title,
          a.content,
          a.meta ? JSON.stringify(a.meta).slice(0, 8000) : null,
          scheduledFor,
          i,
        );
        drafted++;
      }
      if (spec.autoApprove && drafted > 0) {
        await run(db, `UPDATE marketing_campaigns SET status = 'active', updated_at = datetime('now') WHERE id = ?`, campaignId);
      }
    } catch (err) {
      // No AI provider (or a bad response) — leave the campaign as an empty
      // draft the shop can fill with one click. Never let a marketing
      // automation break the write it reacted to.
      if (!(err instanceof AiUnavailableError)) {
        console.log("marketing-automation generation failed", spec.feedNoun, String(err).slice(0, 200));
      }
    }

    await run(
      db,
      `INSERT INTO activity_events (id, kind, entity_type, entity_id, title, payload)
       VALUES (?, 'marketing.draft_ready', ?, ?, ?, ?)`,
      newId("act"),
      spec.feedEntity.type,
      spec.feedEntity.id,
      drafted > 0
        ? spec.autoApprove
          ? `${cap(spec.feedNoun)} scheduled — ${drafted} piece${drafted === 1 ? "" : "s"} on your content calendar`
          : `${cap(spec.feedNoun)} drafted — ${drafted} piece${drafted === 1 ? "" : "s"} to review in Marketing`
        : `${cap(spec.feedNoun)} started — open Marketing to generate it`,
      JSON.stringify({ campaignId, drafted }),
    );
  } catch (err) {
    console.log("marketing-automation failed", spec.feedNoun, String(err).slice(0, 200));
  }
}

// --- The specific automations ------------------------------------------------

export async function draftLaunchKit(
  env: Env,
  db: D1Database,
  p: { productId: string; name: string; autoApprove?: boolean },
): Promise<void> {
  await draftCampaign(env, db, {
    name: `${p.name} — launch`,
    objective: "launch",
    channels: ["instagram", "email", "blog"],
    productId: p.productId,
    subject: `Launching ${p.name}`,
    keyMessage: `Introduce ${p.name} to the people who've been waiting for it.`,
    oncePerProduct: true,
    autoApprove: p.autoApprove,
    feedEntity: { type: "marketing_campaign", id: p.productId },
    feedNoun: "launch kit",
  });
}

export async function draftStockPost(
  env: Env,
  db: D1Database,
  p: { productId: string; name: string; mode: "low" | "restocked" | "soldout"; autoApprove?: boolean },
): Promise<void> {
  const variant =
    p.mode === "low"
      ? {
          suffix: "selling fast",
          objective: "drop" as const,
          keyMessage: `${p.name} is running low. Write a tasteful, honest urgency post — mention limited stock plainly, no fake scarcity or countdown-clock pressure.`,
          noun: "low-stock post",
        }
      : p.mode === "restocked"
        ? {
            suffix: "back in stock",
            objective: "drop" as const,
            keyMessage: `${p.name} is back in stock. Tell the people who waited — warm, a little celebratory, with a clear "shop it now".`,
            noun: "back-in-stock post",
          }
        : {
            suffix: "sold out",
            objective: "press" as const,
            keyMessage: `${p.name} has sold out. Write a gracious sold-out note that reads as quiet success — thank the customers, and point to the waitlist or the next drop.`,
            noun: "sold-out post",
          };
  await draftCampaign(env, db, {
    name: `${p.name} — ${variant.suffix}`,
    objective: variant.objective,
    channels: ["instagram"],
    productId: p.productId,
    subject: `${p.name} — ${variant.suffix}`,
    keyMessage: variant.keyMessage,
    oncePerName: true,
    autoApprove: p.autoApprove,
    feedEntity: { type: "product", id: p.productId },
    feedNoun: variant.noun,
  });
}

export async function draftTrendAngle(
  env: Env,
  db: D1Database,
  p: { conceptId: string; trendTitle: string; brief?: string | null; autoApprove?: boolean },
): Promise<void> {
  await draftCampaign(env, db, {
    name: `${p.trendTitle} — season direction`,
    objective: "seasonal",
    channels: ["instagram", "blog"],
    subject: `${p.trendTitle}`,
    keyMessage:
      `We've adopted a season direction: "${p.trendTitle}".` +
      (p.brief ? ` The brief:\n${p.brief.slice(0, 1200)}` : "") +
      ` Write a campaign angle that introduces this direction to our audience — a point of view, not a trend report.`,
    oncePerName: true,
    autoApprove: p.autoApprove,
    feedEntity: { type: "ai_concept", id: p.conceptId },
    feedNoun: "season-direction angle",
  });
}

export async function draftReviewRepost(
  env: Env,
  db: D1Database,
  p: { productId: string | null; productName: string; rating: number; author: string; body: string; autoApprove?: boolean },
): Promise<void> {
  await draftCampaign(env, db, {
    name: `Review spotlight — ${p.productName}`.slice(0, 180),
    objective: "evergreen",
    channels: ["instagram"],
    productId: p.productId,
    subject: `Customer review — ${p.productName}`,
    keyMessage:
      `A customer left a ${p.rating}-star review for ${p.productName}. Turn it into a tasteful repost: quote the review honestly, credit the customer by first name (${p.author || "the customer"}), keep our voice.` +
      `\n\nThe review:\n"${p.body.slice(0, 600)}"`,
    oncePerName: true,
    autoApprove: p.autoApprove,
    feedEntity: { type: "product", id: p.productId ?? "review" },
    feedNoun: "review repost",
  });
}
