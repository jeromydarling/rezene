import { EmailMessage } from "cloudflare:email";
import { createMimeMessage } from "mimetext";
import { getBrandName } from "./brand";
import { renderBrandedEmail, itemsTableHtml, type EmailBrand } from "./email-template";
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

/** The shop's preferred Reply-To, from its settings ('' / unset → none). */
export async function shopReplyTo(db: D1Database): Promise<string | null> {
  try {
    const row = await db
      .prepare(`SELECT value FROM settings WHERE key = 'reply_to_email'`)
      .first<{ value: string }>();
    const v = row?.value?.trim();
    return v && v.includes("@") ? v : null;
  } catch {
    return null;
  }
}

export async function sendBuyerEmail(
  env: Env,
  opts: {
    to: string;
    subject: string;
    text: string;
    html?: string;
    fromName?: string;
    /** Explicit Reply-To (platform sends use MARKETING_REPLY_TO). */
    replyTo?: string;
    /** Shop database — when given (and no explicit replyTo), the shop's
     *  reply_to_email setting becomes the Reply-To, so replies reach a real
     *  inbox even though the From address is no-reply. */
    db?: D1Database;
  },
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
    const replyTo = opts.replyTo?.trim() || (opts.db ? await shopReplyTo(opts.db) : null);
    if (replyTo) msg.setHeader("Reply-To", replyTo);
    // multipart/alternative: text first, HTML second (clients prefer the last
    // part they can render), so styled inboxes get the branded version and
    // everything else falls back cleanly to plain text.
    msg.addMessage({ contentType: "text/plain", data: opts.text });
    if (opts.html) msg.addMessage({ contentType: "text/html", data: opts.html });
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
  /** Optional brand identity → a styled HTML version alongside the text. */
  brand?: EmailBrand;
}): { subject: string; text: string; html?: string } {
  const hasPreOrder = opts.items.some((i) => i.isPreOrder);
  const total = `${(opts.totalCents / 100).toFixed(2)} ${opts.currency}`;
  const lines = opts.items
    .map((i) => `  ${i.quantity} × ${i.description}${i.isPreOrder ? "  (pre-order)" : ""}`)
    .join("\n");
  const closing = hasPreOrder
    ? "Your pre-order pieces are allocated against our next production run and ship once they clear quality control — we'll keep you posted at every stage."
    : "We're preparing your order for dispatch and will confirm the moment it ships.";

  const result: { subject: string; text: string; html?: string } = {
    subject: `${opts.brandName} — order ${opts.orderNumber} confirmed`,
    text: `Thank you — your order is confirmed.

Order:  ${opts.orderNumber}
Total:  ${total}

${lines}

${closing}

— ${opts.brandName}`,
  };

  if (opts.brand) {
    const rows = [
      ...opts.items.map((i) => ({
        label: `${i.quantity} × ${i.description}${i.isPreOrder ? " · pre-order" : ""}`,
      })),
      { label: "Order", right: opts.orderNumber, muted: true },
      { label: "Total", right: total },
    ];
    result.html = renderBrandedEmail({
      brand: opts.brand,
      preheader: `Order ${opts.orderNumber} confirmed`,
      heading: "Thank you — your order is confirmed.",
      bodyHtml: itemsTableHtml(rows, opts.brand.palette.ink),
      footerNote: closing,
    });
  }
  return result;
}
