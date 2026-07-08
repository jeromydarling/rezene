import { EmailMessage } from "cloudflare:email";
import { createMimeMessage } from "mimetext";
import { first, run } from "./db";
import { getShopDb } from "./tenant-db";
import { PRIMARY_SHOP_ID } from "./shops";
import { getEmailBrand, renderBrandedEmail } from "./email-template";
import { newId, randomToken } from "../utils/id";
import type { Env } from "../types/env";

/**
 * Maker Messages — a logged, email-driven conversation between a shop and each
 * supplier. The shop works in-app; the maker just uses email. Every message
 * (both directions) is a row in the shop's `supplier_messages`, so the app is
 * the system of record even though email is the transport.
 *
 * Reply routing: each thread emails from `m-<token>@MAKER_INBOUND_DOMAIN`. A
 * `thread_addresses` row in the platform DB maps that token back to (shop,
 * supplier), so the inbound email() handler can drop a maker's reply into the
 * right thread regardless of which shop it belongs to.
 */

export function makerConfigured(env: Env): boolean {
  return Boolean(env.EMAIL && env.MAKER_INBOUND_DOMAIN);
}

function makerAddress(token: string, env: Env): string | null {
  return env.MAKER_INBOUND_DOMAIN ? `m-${token}@${env.MAKER_INBOUND_DOMAIN}` : null;
}

/** Pull a maker-reply token out of any recipient address for this Worker. */
export function parseMakerToken(recipients: string[], env: Env): string | null {
  if (!env.MAKER_INBOUND_DOMAIN) return null;
  const host = env.MAKER_INBOUND_DOMAIN.toLowerCase();
  for (const raw of recipients) {
    const addr = (raw.match(/[^<\s]+@[^>\s]+/)?.[0] ?? raw).toLowerCase();
    const m = addr.match(/^m-([a-z0-9]+)@(.+)$/i);
    if (m && m[2] === host) return m[1];
  }
  return null;
}

interface Thread {
  id: string;
  token: string;
}

/** Ensure a supplier has a thread + a registered reply token. */
export async function getOrCreateThread(
  env: Env,
  shopDb: D1Database,
  shopId: string,
  supplierId: string,
): Promise<Thread> {
  const existing = await first<Thread>(
    shopDb,
    `SELECT id, token FROM supplier_threads WHERE supplier_id = ?`,
    supplierId,
  );
  if (existing) return existing;

  const id = newId("thr");
  const token = randomToken(9);
  await run(
    shopDb,
    `INSERT INTO supplier_threads (id, supplier_id, token, last_message_at) VALUES (?, ?, ?, datetime('now'))`,
    id,
    supplierId,
    token,
  );
  // Register the routing token in the platform DB so inbound replies resolve.
  await run(
    env.DB,
    `INSERT OR IGNORE INTO thread_addresses (token, shop_id, supplier_id) VALUES (?, ?, ?)`,
    token,
    shopId,
    supplierId,
  );
  return { id, token };
}

interface PostedMessage {
  id: string;
  author_kind: string;
  author_name: string | null;
  body: string;
  via: string;
  context: string | null;
  created_at: string;
}

/** A shop sends a message to a supplier: record it, then email the maker. */
export async function postShopMessage(
  env: Env,
  shopDb: D1Database,
  shopId: string,
  opts: {
    supplierId: string;
    supplierName: string;
    supplierEmail: string | null;
    body: string;
    context?: string | null;
    fromName: string;
  },
): Promise<{ message: PostedMessage; emailed: boolean }> {
  const thread = await getOrCreateThread(env, shopDb, shopId, opts.supplierId);
  const msgId = newId("msg");
  await run(
    shopDb,
    `INSERT INTO supplier_messages (id, thread_id, supplier_id, author_kind, author_name, body, via, context)
     VALUES (?, ?, ?, 'shop', ?, ?, 'app', ?)`,
    msgId,
    thread.id,
    opts.supplierId,
    opts.fromName,
    opts.body,
    opts.context ?? null,
  );
  await run(
    shopDb,
    `UPDATE supplier_threads SET last_message_at = datetime('now') WHERE id = ?`,
    thread.id,
  );

  let emailed = false;
  const from = makerAddress(thread.token, env);
  if (makerConfigured(env) && from && opts.supplierEmail) {
    try {
      const brand = await getEmailBrand(env, shopDb);
      const html = renderBrandedEmail({
        brand,
        preheader: `Message from ${brand.name}`,
        heading: `Message from ${brand.name}`,
        bodyHtml:
          `<p style="white-space:pre-wrap;margin:0 0 12px;">${escapeHtml(opts.body)}</p>` +
          (opts.context ? `<p style="color:#6f695c;font-size:12px;margin:0;">Re: ${escapeHtml(opts.context)}</p>` : ""),
        footerNote: "Reply to this email and your response goes straight back to the team — no login needed.",
      });
      const text = `${opts.body}\n\n— ${brand.name}\n(Reply to this email to respond.)`;
      const msg = createMimeMessage();
      msg.setSender({ name: opts.fromName, addr: from });
      msg.setRecipient(opts.supplierEmail);
      msg.setSubject(opts.context ? `${opts.fromName} · ${opts.context}` : `Message from ${opts.fromName}`);
      msg.addMessage({ contentType: "text/plain", data: text });
      msg.addMessage({ contentType: "text/html", data: html });
      await env.EMAIL!.send(new EmailMessage(from, opts.supplierEmail, msg.asRaw()));
      emailed = true;
    } catch (err) {
      console.error(`[maker] send failed: ${String(err).slice(0, 200)}`);
    }
  }

  const message = await first<PostedMessage>(
    shopDb,
    `SELECT id, author_kind, author_name, body, via, context, created_at FROM supplier_messages WHERE id = ?`,
    msgId,
  );
  return { message: message!, emailed };
}

/** A maker's emailed reply, routed in by the inbound handler. */
export async function appendSupplierReply(
  env: Env,
  route: { shopId: string; supplierId: string },
  opts: { body: string; authorName: string | null; subject: string },
): Promise<void> {
  const shopDb = getShopDb(env, route.shopId, PRIMARY_SHOP_ID);
  const thread = await first<Thread>(
    shopDb,
    `SELECT id, token FROM supplier_threads WHERE supplier_id = ?`,
    route.supplierId,
  );
  if (!thread) return; // thread was deleted — drop quietly

  await run(
    shopDb,
    `INSERT INTO supplier_messages (id, thread_id, supplier_id, author_kind, author_name, body, via)
     VALUES (?, ?, ?, 'supplier', ?, ?, 'email')`,
    newId("msg"),
    thread.id,
    route.supplierId,
    opts.authorName,
    opts.body.slice(0, 8000),
  );
  await run(
    shopDb,
    `UPDATE supplier_threads SET last_message_at = datetime('now'), unread = unread + 1 WHERE id = ?`,
    thread.id,
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
