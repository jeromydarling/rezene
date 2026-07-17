import { Hono } from "hono";
import { z } from "zod";
import { parseBody } from "../services/validators";
import { requireAdminOnly } from "../middleware/auth";
import { DEMO_SHOP_SLUG } from "../services/shops";
import {
  PLANS,
  billingPortalUrl,
  connectOnboardingLink,
  ensureConnectAccount,
  getShopStripeState,
  planCheckoutUrl,
  syncConnectStatus,
} from "../services/stripe-connect";
import type { AppContext } from "../types/env";

/**
 * Payments & plan, per shop: Stripe Connect (Express) onboarding so the shop's
 * customer payments land in ITS bank account, and Verto plan billing. All
 * state lives on the platform shop registry; these routes only ever touch the
 * calling shop's own row. The demo shop can't connect anything.
 */
export const adminPaymentsRoutes = new Hono<AppContext>();

adminPaymentsRoutes.use("*", async (c, next) => {
  if (c.var.shopSlug === DEMO_SHOP_SLUG) return c.json({ error: "Not available on the demo shop." }, 403);
  await next();
});

adminPaymentsRoutes.get("/", async (c) => {
  const shop = await getShopStripeState(c.env, c.var.shopId);
  if (!shop) return c.json({ error: "Shop not found in the registry" }, 404);
  return c.json({
    stripeConfigured: Boolean(c.env.STRIPE_SECRET_KEY),
    connected: Boolean(shop.stripe_account_id),
    chargesEnabled: Boolean(shop.stripe_charges_enabled),
    detailsSubmitted: Boolean(shop.stripe_details_submitted),
    plan: shop.plan,
    billingStatus: shop.billing_status,
    hasBillingCustomer: Boolean(shop.stripe_customer_id),
    plans: Object.entries(PLANS).map(([key, p]) => ({
      key,
      name: p.name,
      monthlyCents: p.monthlyCents,
      feePct: p.feePct,
    })),
  });
});

/** Start (or resume) Express onboarding; returns the hosted Stripe URL. */
adminPaymentsRoutes.post("/connect", requireAdminOnly, async (c) => {
  const shop = await getShopStripeState(c.env, c.var.shopId);
  if (!shop) return c.json({ error: "Shop not found in the registry" }, 404);
  try {
    const accountId = await ensureConnectAccount(c.env, shop);
    const url = await connectOnboardingLink(c.env, accountId, shop.slug);
    return c.json({ url });
  } catch (err) {
    return c.json({ error: String(err instanceof Error ? err.message : err).slice(0, 300) }, 502);
  }
});

/** Called when the admin returns from Stripe onboarding. */
adminPaymentsRoutes.post("/sync", requireAdminOnly, async (c) => {
  try {
    const status = await syncConnectStatus(c.env, c.var.shopId);
    if (!status) return c.json({ error: "No Stripe account to sync yet." }, 400);
    return c.json(status);
  } catch (err) {
    return c.json({ error: String(err instanceof Error ? err.message : err).slice(0, 300) }, 502);
  }
});

const planSchema = z.object({ plan: z.enum(["starter", "label", "studio", "house"]) });
adminPaymentsRoutes.post("/billing/checkout", requireAdminOnly, async (c) => {
  const body = await parseBody(c, planSchema);
  const shop = await getShopStripeState(c.env, c.var.shopId);
  if (!shop) return c.json({ error: "Shop not found in the registry" }, 404);
  try {
    const url = await planCheckoutUrl(c.env, shop, body.plan, c.var.userEmail ?? null);
    return c.json({ url });
  } catch (err) {
    return c.json({ error: String(err instanceof Error ? err.message : err).slice(0, 300) }, 502);
  }
});

adminPaymentsRoutes.post("/billing/portal", requireAdminOnly, async (c) => {
  const shop = await getShopStripeState(c.env, c.var.shopId);
  if (!shop) return c.json({ error: "Shop not found in the registry" }, 404);
  try {
    const url = await billingPortalUrl(c.env, shop);
    return c.json({ url });
  } catch (err) {
    return c.json({ error: String(err instanceof Error ? err.message : err).slice(0, 400) }, 400);
  }
});
