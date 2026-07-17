import type Stripe from "stripe";
import { first, run } from "./db";
import { getStripe } from "./stripe";
import type { Env } from "../types/env";

/**
 * Stripe Connect (Express) + Verto plan billing, on the platform shop
 * registry. Money model — DESTINATION CHARGES:
 *   - Checkout sessions stay on the platform account (so the existing webhook,
 *     discount, and tax wiring is untouched).
 *   - Each payment carries transfer_data.destination → the shop's Express
 *     account, minus an application fee: the shop's plan fee (as marketed on
 *     /pricing) PLUS card processing (platform pays Stripe's fees under this
 *     model, so processing is part of the application fee — the Shopify shape).
 *   - Refunds reverse the transfer so the shop's balance is clawed back.
 * Shops without a connected account keep charging on the platform account
 * exactly as before — connecting is an upgrade, never a breaking change.
 */

export interface ShopStripeState {
  id: string;
  slug: string;
  name: string;
  owner_email: string | null;
  plan: string | null;
  stripe_account_id: string | null;
  stripe_charges_enabled: number;
  stripe_details_submitted: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  billing_status: string | null;
}

/** Verto plans — prices and per-plan transaction fee, mirroring /pricing. */
export const PLANS: Record<string, { name: string; monthlyCents: number; feePct: number }> = {
  starter: { name: "Starter", monthlyCents: 2900, feePct: 1.5 },
  label: { name: "Label", monthlyCents: 7900, feePct: 1.0 },
  studio: { name: "Studio", monthlyCents: 17900, feePct: 0.75 },
  house: { name: "House", monthlyCents: 39900, feePct: 0.5 },
};

export async function getShopStripeState(env: Env, shopId: string): Promise<ShopStripeState | null> {
  return first<ShopStripeState>(
    env.DB,
    `SELECT id, slug, name, owner_email, plan, stripe_account_id, stripe_charges_enabled,
            stripe_details_submitted, stripe_customer_id, stripe_subscription_id, billing_status
       FROM shops WHERE id = ?`,
    shopId,
  );
}

/**
 * The application fee on a shop sale: plan fee + card processing. Processing
 * defaults to 2.9% + 30¢ (configurable) because the platform pays Stripe's
 * fees under destination charges — shops see one honest combined rate.
 */
export function platformFeeCents(env: Env, planKey: string | null, amountCents: number): number {
  const plan = PLANS[planKey ?? ""] ?? PLANS.starter;
  const procPct = Number(env.VERTO_PROCESSING_FEE_PCT ?? "2.9");
  const procFixed = Number(env.VERTO_PROCESSING_FEE_FIXED_CENTS ?? "30");
  const pct = (Number.isFinite(procPct) ? procPct : 2.9) + plan.feePct;
  const fixed = Number.isFinite(procFixed) ? procFixed : 30;
  const fee = Math.round((amountCents * pct) / 100) + fixed;
  // Never let the fee eat the whole charge (tiny orders).
  return Math.min(fee, Math.max(0, amountCents - 1));
}

/** Create the shop's Express account if it doesn't exist yet; returns the id. */
export async function ensureConnectAccount(env: Env, shop: ShopStripeState): Promise<string> {
  if (shop.stripe_account_id) return shop.stripe_account_id;
  const stripe = getStripe(env);
  if (!stripe) throw new Error("Stripe isn't configured on the platform.");
  const account = await stripe.accounts.create({
    type: "express",
    email: shop.owner_email ?? undefined,
    metadata: { shop_id: shop.id, shop_slug: shop.slug },
    capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
    business_profile: { name: shop.name },
  });
  await run(env.DB, `UPDATE shops SET stripe_account_id = ? WHERE id = ?`, account.id, shop.id);
  return account.id;
}

/** Hosted onboarding link; Stripe collects identity, bank, everything. */
export async function connectOnboardingLink(env: Env, accountId: string, shopSlug: string): Promise<string> {
  const stripe = getStripe(env);
  if (!stripe) throw new Error("Stripe isn't configured on the platform.");
  const base = (env.APP_URL || "https://verto.style").replace(/\/$/, "");
  const link = await stripe.accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    return_url: `${base}/${shopSlug}/admin/settings?stripe=return`,
    refresh_url: `${base}/${shopSlug}/admin/settings?stripe=refresh`,
  });
  return link.url;
}

/**
 * Pull live account state into the registry. Fires the 'payments' activation
 * milestone the first time charges flip on.
 */
export async function syncConnectStatus(env: Env, shopId: string): Promise<{ chargesEnabled: boolean; detailsSubmitted: boolean } | null> {
  const shop = await getShopStripeState(env, shopId);
  if (!shop?.stripe_account_id) return null;
  const stripe = getStripe(env);
  if (!stripe) return null;
  const account = await stripe.accounts.retrieve(shop.stripe_account_id);
  const chargesEnabled = Boolean(account.charges_enabled);
  const detailsSubmitted = Boolean(account.details_submitted);
  const wasEnabled = Boolean(shop.stripe_charges_enabled);
  await run(
    env.DB,
    `UPDATE shops SET stripe_charges_enabled = ?, stripe_details_submitted = ? WHERE id = ?`,
    chargesEnabled ? 1 : 0,
    detailsSubmitted ? 1 : 0,
    shopId,
  );
  if (chargesEnabled && !wasEnabled) {
    const { recordActivationEvent } = await import("./activation");
    await recordActivationEvent(env.DB, shopId, "payments").catch(() => {});
  }
  return { chargesEnabled, detailsSubmitted };
}

/**
 * Find-or-create the Stripe Price for a plan, keyed by lookup_key so repeated
 * calls are idempotent and the founder can re-price from the Stripe dashboard
 * (create a new price with the same lookup_key and it wins).
 */
export async function ensurePlanPrice(stripe: Stripe, planKey: string): Promise<string> {
  const plan = PLANS[planKey];
  if (!plan) throw new Error("Unknown plan");
  const lookupKey = `verto_${planKey}_monthly`;
  const existing = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
  if (existing.data[0]) return existing.data[0].id;
  const product = await stripe.products.create({
    name: `Verto ${plan.name}`,
    metadata: { verto_plan: planKey },
  });
  const price = await stripe.prices.create({
    product: product.id,
    currency: "usd",
    unit_amount: plan.monthlyCents,
    recurring: { interval: "month" },
    lookup_key: lookupKey,
  });
  return price.id;
}

/** Subscription checkout for a Verto plan; webhook lands plan + status. */
export async function planCheckoutUrl(
  env: Env,
  shop: ShopStripeState,
  planKey: string,
  userEmail: string | null,
): Promise<string> {
  const stripe = getStripe(env);
  if (!stripe) throw new Error("Stripe isn't configured on the platform.");
  const priceId = await ensurePlanPrice(stripe, planKey);
  const base = (env.APP_URL || "https://verto.style").replace(/\/$/, "");
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    ...(shop.stripe_customer_id
      ? { customer: shop.stripe_customer_id }
      : { customer_email: userEmail ?? shop.owner_email ?? undefined }),
    subscription_data: { metadata: { shop_id: shop.id, verto_plan: planKey } },
    metadata: { kind: "verto_plan", shop_id: shop.id, verto_plan: planKey },
    allow_promotion_codes: true,
    success_url: `${base}/${shop.slug}/admin/settings?billing=success`,
    cancel_url: `${base}/${shop.slug}/admin/settings?billing=cancelled`,
  });
  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return session.url;
}

/** Billing portal for managing/cancelling the plan. */
export async function billingPortalUrl(env: Env, shop: ShopStripeState): Promise<string> {
  const stripe = getStripe(env);
  if (!stripe) throw new Error("Stripe isn't configured on the platform.");
  if (!shop.stripe_customer_id) throw new Error("No billing customer yet — choose a plan first.");
  const base = (env.APP_URL || "https://verto.style").replace(/\/$/, "");
  const session = await stripe.billingPortal.sessions.create({
    customer: shop.stripe_customer_id,
    return_url: `${base}/${shop.slug}/admin/settings`,
  });
  return session.url;
}

/** Webhook side: apply a subscription event to the registry. */
export async function applySubscriptionEvent(env: Env, sub: Stripe.Subscription): Promise<void> {
  const shopId = sub.metadata?.shop_id;
  if (!shopId) return;
  const planKey = sub.metadata?.verto_plan ?? null;
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null;
  const active = sub.status === "active" || sub.status === "trialing";
  await run(
    env.DB,
    `UPDATE shops SET
       stripe_customer_id = COALESCE(?, stripe_customer_id),
       stripe_subscription_id = ?,
       billing_status = ?,
       plan = CASE WHEN ? THEN COALESCE(?, plan) ELSE plan END
     WHERE id = ?`,
    customerId,
    sub.id,
    sub.status,
    active ? 1 : 0,
    planKey,
    shopId,
  );
}
