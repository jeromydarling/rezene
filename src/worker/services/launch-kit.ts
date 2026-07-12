import { first, run } from "./db";
import { newId } from "../utils/id";
import { AiUnavailableError } from "./ai";
import { generateAssets, type CampaignRow } from "../routes/admin-marketing";
import type { Env } from "../types/env";

/**
 * New-product launch kit — the first marketing automation. When a product is
 * published, draft a launch campaign (Instagram caption, launch email, SEO
 * article) into the existing marketing draft surface, where the shop edits,
 * schedules, and sends it. Nothing auto-publishes; every piece is a draft.
 *
 * Runs off the request path (via executionCtx.waitUntil) because it makes an
 * LLM call — the publish save stays instant. Idempotent per product: a second
 * publish of the same product won't spawn a duplicate launch campaign.
 */

const LAUNCH_CHANNELS = ["instagram", "email", "blog"] as const;

interface LaunchProduct {
  productId: string;
  name: string;
}

export async function draftLaunchKit(env: Env, db: D1Database, product: LaunchProduct): Promise<void> {
  try {
    // Don't spam: one launch campaign per product, even across re-publishes.
    const existing = await first<{ id: string }>(
      db,
      `SELECT id FROM marketing_campaigns WHERE product_id = ? AND objective = 'launch' LIMIT 1`,
      product.productId,
    );
    if (existing) return;

    const campaignId = newId("mkc");
    const today = new Date().toISOString().slice(0, 10);
    const name = `${product.name} — launch`.slice(0, 200);
    await run(
      db,
      `INSERT INTO marketing_campaigns (id, name, objective, subject, key_message, product_id, status, starts_on)
       VALUES (?, ?, 'launch', ?, ?, ?, 'draft', ?)`,
      campaignId,
      name,
      `Launching ${product.name}`.slice(0, 300),
      `Introduce ${product.name} to the people who've been waiting for it.`.slice(0, 500),
      product.productId,
      today,
    );

    const campaign: CampaignRow = {
      id: campaignId,
      name,
      objective: "launch",
      subject: `Launching ${product.name}`,
      key_message: `Introduce ${product.name} to the people who've been waiting for it.`,
      audience: null,
      product_id: product.productId,
      collection_id: null,
      starts_on: today,
      ends_on: null,
    };

    let drafted = 0;
    try {
      const assets = await generateAssets(env, db, campaign, [...LAUNCH_CHANNELS]);
      for (let i = 0; i < assets.length; i++) {
        const a = assets[i];
        await run(
          db,
          `INSERT INTO marketing_assets (id, campaign_id, channel, kind, title, content, meta_json, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          newId("mka"),
          campaignId,
          a.channel,
          a.kind,
          a.title,
          a.content,
          a.meta ? JSON.stringify(a.meta).slice(0, 8000) : null,
          i,
        );
        drafted++;
      }
    } catch (err) {
      // No AI provider (or a bad response) — leave the campaign as an empty
      // draft the shop can fill with one click on the Marketing page. Never
      // let a marketing automation break the publish it reacted to.
      if (!(err instanceof AiUnavailableError)) {
        console.log("launch-kit generation failed", String(err).slice(0, 200));
      }
    }

    // Feed signal so the shop notices the kit is waiting (no rule listens for
    // this kind — it's activity-feed only).
    await run(
      db,
      `INSERT INTO activity_events (id, kind, entity_type, entity_id, title, payload)
       VALUES (?, 'marketing.launch_kit_drafted', 'marketing_campaign', ?, ?, ?)`,
      newId("act"),
      campaignId,
      drafted > 0
        ? `Launch kit drafted for ${product.name} — ${drafted} piece${drafted === 1 ? "" : "s"} to review in Marketing`
        : `Launch campaign started for ${product.name} — open Marketing to generate the kit`,
      JSON.stringify({ campaignId, productId: product.productId, drafted }),
    );
  } catch (err) {
    console.log("launch-kit failed", String(err).slice(0, 200));
  }
}
