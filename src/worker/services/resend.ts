import { getBrandName } from "./brand";
import type { Env } from "../types/env";

/**
 * Buyer-facing transactional email via Resend. Cloudflare Email Service
 * only delivers to verified destinations (fine for founder notifications),
 * so customer email goes through Resend. Guarded no-op until
 * RESEND_API_KEY (secret) and RESEND_FROM (var, verified-domain address)
 * are configured. Failures never break the webhook path.
 */
export function resendConfigured(env: Env): boolean {
  return Boolean(env.RESEND_API_KEY && env.RESEND_FROM);
}

export async function sendBuyerEmail(
  env: Env,
  opts: { to: string; subject: string; text: string },
): Promise<boolean> {
  if (!resendConfigured(env)) {
    console.log(`[resend] skipped (not configured): ${opts.subject}`);
    return false;
  }
  try {
    const brand = await getBrandName(env);
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `${brand} <${env.RESEND_FROM}>`,
        to: [opts.to],
        subject: opts.subject,
        text: opts.text,
      }),
    });
    if (!res.ok) {
      console.error(`[resend] send failed ${res.status}: ${(await res.text()).slice(0, 300)}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[resend] send failed: ${String(err)}`);
    return false;
  }
}

export function orderConfirmationEmail(opts: {
  brandName: string;
  orderNumber: string;
  totalCents: number;
  currency: string;
  items: { description: string; quantity: number; isPreOrder: boolean }[];
}): { subject: string; text: string } {
  const hasPreOrder = opts.items.some((i) => i.isPreOrder);
  const lines = opts.items
    .map((i) => `  ${i.quantity} × ${i.description}${i.isPreOrder ? "  (pre-order)" : ""}`)
    .join("\n");
  return {
    subject: `${opts.brandName} — order ${opts.orderNumber} confirmed`,
    text: `Thank you — your order is confirmed.

Order:  ${opts.orderNumber}
Total:  ${(opts.totalCents / 100).toFixed(2)} ${opts.currency}

${lines}
${
  hasPreOrder
    ? `
Your pre-order pieces will be cut in our Casablanca production run and ship once they clear quality control. We'll keep you posted at every stage.`
    : `
We're preparing your order for dispatch and will confirm when it ships.`
}

— ${opts.brandName}`,
  };
}
