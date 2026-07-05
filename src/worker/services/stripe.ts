import Stripe from "stripe";
import type { Env } from "../types/env";

/**
 * Stripe client factory for Workers. Uses the fetch HTTP client (no Node
 * sockets in workerd) and SubtleCrypto for webhook signature verification.
 * Returns null when the secret key isn't configured so routes can degrade
 * to a clear 503 instead of crashing.
 */
export function getStripe(env: Env): Stripe | null {
  if (!env.STRIPE_SECRET_KEY) return null;
  return new Stripe(env.STRIPE_SECRET_KEY, {
    httpClient: Stripe.createFetchHttpClient(),
  });
}

export const webhookCryptoProvider = Stripe.createSubtleCryptoProvider();

/** Countries we ship to today. Extend as logistics come online. */
export const SHIPPING_COUNTRIES: Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[] =
  ["US", "GB", "CA", "MA", "FR", "DE", "ES", "IT", "NL", "BE", "PT", "IE", "AT", "DK", "SE"];
