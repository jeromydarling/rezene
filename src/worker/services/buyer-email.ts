import { EmailMessage } from "cloudflare:email";
import { createMimeMessage } from "mimetext";
import { getBrandName } from "./brand";
import type { Env } from "../types/env";

/**
 * Buyer-facing transactional email via Cloudflare Email Service — the same
 * EMAIL binding as founder notifications. Sending to arbitrary recipients
 * requires a sending domain onboarded to Email Sending (until then the
 * account can only reach its verified destination addresses), so buyer
 * email is gated on its own var: set BUYER_EMAIL_FROM to an address on the
 * onboarded domain once that's done. Until then every send is a logged
 * no-op, and failures never break the webhook path.
 */
export function buyerEmailConfigured(env: Env): boolean {
  return Boolean(env.EMAIL && env.BUYER_EMAIL_FROM);
}

export async function sendBuyerEmail(
  env: Env,
  opts: { to: string; subject: string; text: string; fromName?: string },
): Promise<boolean> {
  if (!buyerEmailConfigured(env)) {
    console.log(`[buyer-email] skipped (not configured): ${opts.subject}`);
    return false;
  }
  try {
    const msg = createMimeMessage();
    msg.setSender({ name: opts.fromName ?? (await getBrandName(env)), addr: env.BUYER_EMAIL_FROM });
    msg.setRecipient(opts.to);
    msg.setSubject(opts.subject);
    msg.addMessage({ contentType: "text/plain", data: opts.text });
    await env.EMAIL!.send(new EmailMessage(env.BUYER_EMAIL_FROM, opts.to, msg.asRaw()));
    return true;
  } catch (err) {
    console.error(`[buyer-email] send failed: ${String(err)}`);
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
