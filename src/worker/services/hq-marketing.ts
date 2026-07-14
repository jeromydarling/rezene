import { EmailMessage } from "cloudflare:email";
import { createMimeMessage } from "mimetext";
import { all, first, run } from "./db";
import { newId, sha256Hex } from "../utils/id";
import { renderBrandedEmail, type EmailBrand } from "./email-template";
import { DEFAULT_PALETTE } from "../../shared/brand-identity";
import type { Env } from "../types/env";

/**
 * Verto HQ marketing — platform-level email to Verto's own audience (shops,
 * demo leads, makers waitlist). Everything sends through the same Cloudflare
 * Email Sending binding as transactional mail, but via a D1-backed queue
 * drained at a controlled rate by cron, so quotas and warm-up are enforced in
 * one place. Suppression (unsubscribes) is checked at queue time AND send
 * time. Compliance is built in: every message carries List-Unsubscribe +
 * List-Unsubscribe-Post (RFC 8058 one-click), a visible unsubscribe link, and
 * the sender's postal address when MARKETING_POSTAL_ADDRESS is set.
 */

// ---------- Sending identity & pacing ----------

export function marketingEmailFrom(env: Env): string | null {
  return env.MARKETING_EMAIL_FROM?.trim() || env.BUYER_EMAIL_FROM?.trim() || null;
}

export function marketingConfigured(env: Env): boolean {
  return Boolean(env.EMAIL && marketingEmailFrom(env));
}

/**
 * Sends per drain tick. The drain cron runs every 5 minutes (wrangler.toml),
 * so the default ceiling is 12×BATCH/hr — deliberately gentle for a fresh
 * sending domain. Raise via MARKETING_BATCH_PER_TICK once the domain is warm.
 */
export function batchPerTick(env: Env): number {
  const n = Number(env.MARKETING_BATCH_PER_TICK ?? "10");
  return Number.isFinite(n) && n > 0 ? Math.min(n, 50) : 10;
}

// ---------- Segments ----------

export interface Recipient {
  email: string;
  name: string | null;
  contactId: string | null;
}

export const SEGMENTS: { key: string; label: string; description: string }[] = [
  { key: "all", label: "Everyone", description: "Every contact and waitlist signup we know (minus unsubscribes)." },
  { key: "active_shops", label: "Active shops", description: "Contacts linked to a shop, active or champion." },
  { key: "leads", label: "Leads", description: "Contacts who never opened a shop — demo leads and hand-added prospects." },
  { key: "at_risk", label: "At risk / churned", description: "Shops that went quiet — win-back territory." },
  { key: "makers_waitlist", label: "Makers waitlist", description: "Makers who asked to join the directory." },
];

export async function resolveSegment(env: Env, key: string): Promise<Recipient[]> {
  const contacts = async (where: string): Promise<Recipient[]> =>
    (
      await all<{ email: string; name: string | null; id: string }>(
        env.DB,
        `SELECT email, name, id FROM crm_contacts WHERE ${where}
           AND email NOT IN (SELECT email FROM hq_marketing_suppression)
         ORDER BY created_at`,
      )
    ).map((r) => ({ email: r.email.toLowerCase(), name: r.name, contactId: r.id }));

  switch (key) {
    case "active_shops":
      return contacts(`shop_id IS NOT NULL AND status IN ('active','champion','trial')`);
    case "leads":
      return contacts(`shop_id IS NULL AND status = 'lead'`);
    case "at_risk":
      return contacts(`status IN ('churn_risk','churned')`);
    case "makers_waitlist":
      return (
        await all<{ email: string; name: string | null }>(
          env.DB,
          `SELECT email, name FROM maker_waitlist
            WHERE email NOT IN (SELECT email FROM hq_marketing_suppression)
            ORDER BY created_at`,
        )
      ).map((r) => ({ email: r.email.toLowerCase(), name: r.name, contactId: null }));
    case "all": {
      const a = await contacts(`1=1`);
      const seen = new Set(a.map((r) => r.email));
      const w = await resolveSegment(env, "makers_waitlist");
      return [...a, ...w.filter((r) => !seen.has(r.email))];
    }
    default:
      return [];
  }
}

// ---------- Unsubscribe (HMAC token — no table, can't be forged) ----------

export async function unsubscribeToken(env: Env, email: string): Promise<string> {
  return (await sha256Hex(`unsub:${email.toLowerCase()}:${env.SESSION_SECRET ?? ""}`)).slice(0, 32);
}

export async function verifyUnsubscribeToken(env: Env, email: string, token: string): Promise<boolean> {
  return Boolean(token) && (await unsubscribeToken(env, email)) === token;
}

export async function suppress(env: Env, email: string, reason: string, source?: string): Promise<void> {
  await run(
    env.DB,
    `INSERT OR IGNORE INTO hq_marketing_suppression (email, reason, source) VALUES (?, ?, ?)`,
    email.toLowerCase(),
    reason,
    source ?? null,
  );
  // Anything still queued for this address is off — unsubscribe always wins.
  await run(
    env.DB,
    `UPDATE hq_marketing_sends SET status = 'suppressed' WHERE email = ? AND status = 'queued'`,
    email.toLowerCase(),
  );
}

// ---------- Rendering (markdown master → branded HTML + plain text) ----------

const VERTO_BRAND: EmailBrand = { name: "Verto", logoUrl: null, palette: DEFAULT_PALETTE };

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Tiny markdown subset for email bodies: headings, bold, links, lists, paragraphs. */
export function emailMarkdownToHtml(md: string): string {
  const inline = (t: string) =>
    esc(t)
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, `<a href="$2" style="color:#b16a52">$1</a>`);
  const blocks = md.replace(/\r\n?/g, "\n").split(/\n{2,}/);
  return blocks
    .map((b) => {
      const t = b.trim();
      if (!t) return "";
      if (t.startsWith("## ")) return `<h2 style="font-size:18px;margin:20px 0 8px">${inline(t.slice(3))}</h2>`;
      if (t.startsWith("# ")) return `<h2 style="font-size:20px;margin:20px 0 8px">${inline(t.slice(2))}</h2>`;
      if (/^[-*] /m.test(t)) {
        const items = t.split("\n").filter((l) => /^[-*] /.test(l.trim()));
        return `<ul style="margin:8px 0;padding-left:20px">${items.map((l) => `<li style="margin:4px 0">${inline(l.trim().slice(2))}</li>`).join("")}</ul>`;
      }
      return `<p style="margin:12px 0;line-height:1.6">${t.split("\n").map(inline).join("<br/>")}</p>`;
    })
    .join("\n");
}

function stripToText(md: string): string {
  return md
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, "$1 ($2)")
    .replace(/^#+\s*/gm, "");
}

/** First-name personalisation: {{name}} → first name or a warm fallback. */
function personalize(md: string, name: string | null): string {
  const first = name?.trim().split(/\s+/)[0];
  return md.replaceAll("{{name}}", first || "there");
}

// ---------- Queue & drain ----------

export async function queueBroadcast(env: Env, broadcastId: string): Promise<{ queued: number }> {
  const bc = await first<{ id: string; segment: string; subject: string; body_md: string; status: string }>(
    env.DB,
    `SELECT id, segment, subject, body_md, status FROM hq_marketing_broadcasts WHERE id = ?`,
    broadcastId,
  );
  if (!bc) throw new Error("broadcast not found");
  if (bc.status !== "draft") throw new Error(`broadcast is ${bc.status}, not draft`);

  const recipients = await resolveSegment(env, bc.segment);
  for (const r of recipients) {
    await run(
      env.DB,
      `INSERT OR IGNORE INTO hq_marketing_sends (id, broadcast_id, email, contact_id, subject, body_md)
       VALUES (?, ?, ?, ?, ?, ?)`,
      newId("send"),
      bc.id,
      r.email,
      r.contactId,
      bc.subject,
      personalize(bc.body_md, r.name),
    );
  }
  await run(
    env.DB,
    `UPDATE hq_marketing_broadcasts SET status = 'sending', recipient_count = ?, queued_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
    recipients.length,
    bc.id,
  );
  return { queued: recipients.length };
}

const MAX_ATTEMPTS = 3;

/**
 * Error taxonomy for Email Sending failures (codes from the Workers API docs):
 *  - permanent: bad message or a recipient Cloudflare's own suppression list
 *    rejects — retrying can never succeed, fail the row immediately.
 *  - account throttle: E_RATE_LIMIT_EXCEEDED / E_DAILY_LIMIT_EXCEEDED — it's
 *    the account, not the message. Abort the whole tick, push the batch back
 *    an hour, and do NOT burn per-row attempts.
 *  - everything else: transient (delivery blip, internal error) — backoff.
 */
function classifySendError(err: unknown): "permanent" | "throttle" | "transient" {
  const s = String(err);
  if (/E_RATE_LIMIT_EXCEEDED|E_DAILY_LIMIT_EXCEEDED/.test(s)) return "throttle";
  if (/E_VALIDATION|E_FIELD_MISSING|E_TOO_MANY|E_CONTENT_TOO_LARGE|E_SENDER|E_RECIPIENT|E_HEADER/.test(s)) return "permanent";
  return "transient";
}

/**
 * Drain due queued sends at the configured pace. Called from the 5-minute
 * cron. Rows are claimed atomically (status flip via UPDATE…RETURNING) before
 * any network call, so an overlapping tick can't double-send; a tick that
 * dies mid-claim is recovered by the stale-claim sweep at the top.
 */
export async function drainMarketingQueue(env: Env): Promise<{ sent: number; failed: number; skipped: number }> {
  if (!marketingConfigured(env)) return { sent: 0, failed: 0, skipped: 0 };

  // Crash recovery: anything claimed >15 min ago (max cron duration) goes back.
  await run(
    env.DB,
    `UPDATE hq_marketing_sends SET status = 'queued' WHERE status = 'sending' AND due_at <= datetime('now', '-15 minutes')`,
  );

  const batch = await all<{
    id: string;
    broadcast_id: string | null;
    email: string;
    contact_id: string | null;
    subject: string;
    body_md: string;
    attempts: number;
  }>(
    env.DB,
    `UPDATE hq_marketing_sends SET status = 'sending'
      WHERE id IN (
        SELECT id FROM hq_marketing_sends
         WHERE status = 'queued' AND due_at <= datetime('now')
         ORDER BY due_at LIMIT ?
      )
      RETURNING id, broadcast_id, email, contact_id, subject, body_md, attempts`,
    batchPerTick(env),
  );

  let sent = 0,
    failed = 0,
    skipped = 0;
  for (let i = 0; i < batch.length; i++) {
    const row = batch[i];
    // Suppression re-check at send time: an unsubscribe after queueing wins.
    const sup = await first<{ email: string }>(
      env.DB,
      `SELECT email FROM hq_marketing_suppression WHERE email = ?`,
      row.email,
    );
    if (sup) {
      await run(env.DB, `UPDATE hq_marketing_sends SET status = 'suppressed' WHERE id = ?`, row.id);
      skipped++;
      continue;
    }
    try {
      await sendMarketingEmail(env, { to: row.email, subject: row.subject, bodyMd: row.body_md });
      await run(env.DB, `UPDATE hq_marketing_sends SET status = 'sent', sent_at = datetime('now') WHERE id = ?`, row.id);
      if (row.contact_id) {
        const { logInteraction } = await import("./crm");
        await logInteraction(env, row.contact_id, "email_out", { subject: row.subject }).catch(() => {});
      }
      sent++;
    } catch (err) {
      const kind = classifySendError(err);
      if (kind === "throttle") {
        // Account-level: release this row AND the unsent remainder untouched
        // (attempts unchanged), everything waits an hour. Stop the tick.
        const remaining = batch.slice(i).map((r) => r.id);
        for (const id of remaining) {
          await run(
            env.DB,
            `UPDATE hq_marketing_sends SET status = 'queued', due_at = datetime('now', '+1 hour'), last_error = ? WHERE id = ?`,
            String(err).slice(0, 300),
            id,
          );
        }
        console.warn(`[marketing] account throttled — parked ${remaining.length} sends for 1h`);
        break;
      }
      const attempts = row.attempts + 1;
      if (kind === "permanent" || attempts >= MAX_ATTEMPTS) {
        await run(
          env.DB,
          `UPDATE hq_marketing_sends SET status = 'failed', attempts = ?, last_error = ? WHERE id = ?`,
          attempts,
          String(err).slice(0, 300),
          row.id,
        );
        failed++;
      } else {
        // Transient: back off 15/30 min and retry.
        await run(
          env.DB,
          `UPDATE hq_marketing_sends SET status = 'queued', attempts = ?, last_error = ?, due_at = datetime('now', ?) WHERE id = ?`,
          attempts,
          String(err).slice(0, 300),
          `+${attempts * 15} minutes`,
          row.id,
        );
      }
    }
  }

  // Roll finished broadcasts to 'sent' and refresh counters.
  const active = await all<{ id: string }>(
    env.DB,
    `SELECT id FROM hq_marketing_broadcasts WHERE status = 'sending'`,
  );
  for (const bc of active) {
    await run(
      env.DB,
      `UPDATE hq_marketing_broadcasts SET
         sent_count = (SELECT COUNT(*) FROM hq_marketing_sends WHERE broadcast_id = ? AND status = 'sent'),
         failed_count = (SELECT COUNT(*) FROM hq_marketing_sends WHERE broadcast_id = ? AND status IN ('failed','suppressed')),
         updated_at = datetime('now')
       WHERE id = ?`,
      bc.id,
      bc.id,
      bc.id,
    );
    const pending = await first<{ n: number }>(
      env.DB,
      `SELECT COUNT(*) AS n FROM hq_marketing_sends WHERE broadcast_id = ? AND status = 'queued'`,
      bc.id,
    );
    if (!pending || pending.n === 0) {
      await run(
        env.DB,
        `UPDATE hq_marketing_broadcasts SET status = 'sent', completed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
        bc.id,
      );
    }
  }
  return { sent, failed, skipped };
}

/** Immediate single send for previews — the founder testing their own draft. */
export async function queueTestSend(env: Env, opts: { to: string; subject: string; bodyMd: string }): Promise<void> {
  if (!marketingConfigured(env)) throw new Error("Email sending isn't configured yet.");
  await sendMarketingEmail(env, { to: opts.to, subject: opts.subject, bodyMd: personalize(opts.bodyMd, null) });
}

/** One marketing email through the EMAIL binding, with compliance headers + footer. */
async function sendMarketingEmail(env: Env, opts: { to: string; subject: string; bodyMd: string }): Promise<void> {
  const from = marketingEmailFrom(env)!;
  const base = (env.APP_URL || "https://verto.style").replace(/\/$/, "");
  const token = await unsubscribeToken(env, opts.to);
  const unsubUrl = `${base}/api/public/marketing/unsubscribe?e=${encodeURIComponent(opts.to)}&t=${token}`;

  const postal = env.MARKETING_POSTAL_ADDRESS?.trim();
  const footerBits = [
    `You're receiving this because you have a Verto account or asked to hear from us.`,
    `<a href="${unsubUrl}" style="color:#8a8f98">Unsubscribe</a>`,
    postal ? esc(postal) : null,
  ].filter(Boolean);

  // footerNote is injected as raw HTML by the shell, so the link renders.
  const html = renderBrandedEmail({
    brand: VERTO_BRAND,
    preheader: opts.subject,
    heading: opts.subject,
    bodyHtml: emailMarkdownToHtml(opts.bodyMd),
    footerNote: footerBits.join(" &middot; "),
  });
  const text = `${stripToText(opts.bodyMd)}\n\n—\nUnsubscribe: ${unsubUrl}${postal ? `\n${postal}` : ""}`;

  const msg = createMimeMessage();
  msg.setSender({ name: "Verto", addr: from });
  msg.setRecipient(opts.to);
  msg.setSubject(opts.subject);
  // RFC 8058 one-click unsubscribe — required by Gmail/Yahoo bulk-sender rules.
  msg.setHeader("List-Unsubscribe", `<${unsubUrl}>`);
  msg.setHeader("List-Unsubscribe-Post", "List-Unsubscribe=One-Click");
  msg.addMessage({ contentType: "text/plain", data: text });
  msg.addMessage({ contentType: "text/html", data: html });
  await env.EMAIL!.send(new EmailMessage(from, opts.to, msg.asRaw()));
}

// ---------- AI drafting ----------

const DRAFT_SYSTEM = `You write email for Verto, a fashion-tech platform for independent designers, tailors, and boutique owners. Voice: warm, plain-language, editorial — like a well-read friend in the atelier, never corporate, never hypey. Short paragraphs. No emoji. British-adjacent restraint.

Return STRICT JSON: {"subject": "...", "preheader": "...", "body_md": "..."} — body_md is markdown (paragraphs, **bold**, [links](https://...), - lists). Use {{name}} once near the top as the recipient's first name. Keep it under 250 words unless asked otherwise. Never invent product facts, prices, or dates that weren't given.`;

export async function draftBroadcast(
  env: Env,
  opts: { brief: string; segmentKey: string; userId?: string },
): Promise<{ subject: string; preheader: string; body_md: string }> {
  const seg = SEGMENTS.find((s) => s.key === opts.segmentKey);
  const { askClaude } = await import("./anthropic");
  const res = await askClaude(env, {
    system: DRAFT_SYSTEM,
    prompt: `Audience segment: ${seg ? `${seg.label} — ${seg.description}` : opts.segmentKey}

Brief from the founder:
${opts.brief}`,
    maxTokens: 1200,
    usage: { shopId: null, operation: "hq_marketing_draft" },
  });
  const m = res.text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("draft came back unstructured — try again");
  const parsed = JSON.parse(m[0]) as { subject?: string; preheader?: string; body_md?: string };
  if (!parsed.subject || !parsed.body_md) throw new Error("draft missing subject or body");
  return { subject: parsed.subject, preheader: parsed.preheader ?? "", body_md: parsed.body_md };
}
