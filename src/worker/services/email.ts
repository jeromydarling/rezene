import { EmailMessage } from "cloudflare:email";
import { createMimeMessage } from "mimetext";
import type { Env } from "../types/env";

/**
 * Outbound email via Cloudflare Email Service (send_email binding "EMAIL").
 *
 * Constraint worth knowing: Email Service sends FROM a domain onboarded to
 * Email Service and TO verified destination addresses in the account. That
 * makes it ideal for operational notifications to the founder/team (orders,
 * leads, daily digest) — which is exactly what this service does. Sending
 * arbitrary customer email (order confirmations to any address) needs a
 * transactional provider and stays a documented integration point.
 *
 * Every send is guarded: missing binding or unset NOTIFY_* vars mean a
 * silent no-op (logged), never a thrown error into the request path.
 */

export function emailConfigured(env: Env): boolean {
  return Boolean(env.EMAIL && env.NOTIFY_EMAIL_FROM && env.NOTIFY_EMAIL_TO);
}

export async function sendNotification(
  env: Env,
  opts: { subject: string; text: string },
): Promise<boolean> {
  if (!emailConfigured(env)) {
    console.log(`[email] skipped (not configured): ${opts.subject}`);
    return false;
  }
  try {
    const msg = createMimeMessage();
    msg.setSender({ name: env.BRAND_NAME, addr: env.NOTIFY_EMAIL_FROM });
    msg.setRecipient(env.NOTIFY_EMAIL_TO);
    msg.setSubject(opts.subject);
    msg.addMessage({ contentType: "text/plain", data: opts.text });
    await env.EMAIL!.send(
      new EmailMessage(env.NOTIFY_EMAIL_FROM, env.NOTIFY_EMAIL_TO, msg.asRaw()),
    );
    return true;
  } catch (err) {
    // Notifications must never break checkout/webhook/cron paths.
    console.error(`[email] send failed: ${String(err)}`);
    return false;
  }
}

// ---------- Notification composers ----------

export function orderPaidNotification(order: {
  orderNumber: string;
  email: string | null;
  totalCents: number;
  currency: string;
  isPreOrder: boolean;
  country: string | null;
  items: { description: string; quantity: number }[];
}): { subject: string; text: string } {
  const lines = order.items.map((i) => `  ${i.quantity} × ${i.description}`).join("\n");
  return {
    subject: `Order ${order.orderNumber} — ${(order.totalCents / 100).toFixed(2)} ${order.currency}${order.isPreOrder ? " (pre-order)" : ""}`,
    text: `A new order just came through Stripe.

Order:    ${order.orderNumber}
Customer: ${order.email ?? "unknown"}
Country:  ${order.country ?? "unknown"}
Total:    ${(order.totalCents / 100).toFixed(2)} ${order.currency}
Type:     ${order.isPreOrder ? "Pre-order (allocated against production)" : "In-stock sale"}

Items:
${lines}

Open the order in the admin: /admin/orders`,
  };
}

export function leadNotification(lead: {
  kind: string;
  email: string;
  name?: string | null;
  company?: string | null;
  message?: string | null;
}): { subject: string; text: string } {
  return {
    subject: `New ${lead.kind.replaceAll("_", " ")} lead: ${lead.email}`,
    text: `A new lead landed on the public site.

Kind:    ${lead.kind}
Email:   ${lead.email}
Name:    ${lead.name ?? "—"}
Company: ${lead.company ?? "—"}

Message:
${lead.message ?? "—"}

All leads: /admin/customers (Recent leads)`,
  };
}

export function dailyDigestNotification(digest: {
  lateTasks: { title: string; dueDate: string | null }[];
  lowStock: { name: string; available: number }[];
  pendingFactoryResponses: number;
  abandonedCheckouts: { orderNumber: string; totalCents: number; currency: string }[];
  openSamples: number;
}): { subject: string; text: string } {
  const parts: string[] = [];
  if (digest.lateTasks.length) {
    parts.push(
      `LATE PRODUCTION TASKS (${digest.lateTasks.length})\n` +
        digest.lateTasks.map((t) => `  • ${t.title} (due ${t.dueDate ?? "?"})`).join("\n"),
    );
  }
  if (digest.lowStock.length) {
    parts.push(
      `LOW STOCK (${digest.lowStock.length})\n` +
        digest.lowStock.map((s) => `  • ${s.name}: ${s.available} available`).join("\n"),
    );
  }
  if (digest.abandonedCheckouts.length) {
    parts.push(
      `ABANDONED CHECKOUTS (${digest.abandonedCheckouts.length}, older than 24h)\n` +
        digest.abandonedCheckouts
          .map(
            (o) => `  • ${o.orderNumber} — ${(o.totalCents / 100).toFixed(2)} ${o.currency}`,
          )
          .join("\n"),
    );
  }
  if (digest.pendingFactoryResponses > 0) {
    parts.push(`FACTORY FOLLOW-UPS AWAITING RESPONSE: ${digest.pendingFactoryResponses}`);
  }
  if (digest.openSamples > 0) {
    parts.push(`OPEN SAMPLES IN PIPELINE: ${digest.openSamples}`);
  }
  const body = parts.length ? parts.join("\n\n") : "All quiet — nothing needs attention today.";
  return {
    subject: `Daily ops digest — ${parts.length ? `${parts.length} area(s) need attention` : "all clear"}`,
    text: `${body}\n\nDashboard: /admin`,
  };
}
