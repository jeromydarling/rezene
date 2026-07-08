import PostalMime from "postal-mime";
import { first, run } from "./db";
import { logInteraction, upsertContact } from "./crm";
import { newId } from "../utils/id";
import type { Env } from "../types/env";

/**
 * The shared inbox: Cloudflare Email Routing delivers mail for the
 * support/hello address straight into the Worker. Every message lands on
 * the sender's CRM timeline (creating the contact if needed), spawns a
 * "reply" task so it can't be forgotten, and is forwarded on to the
 * founder's real inbox — the CRM is a copy that never loses the thread,
 * not a cage you have to answer from.
 *
 * One-time setup in the Cloudflare dashboard (verto.style zone):
 *   Email → Email Routing → enable, add destination address, then route
 *   e.g. hello@verto.style → Send to Worker → rezene.
 */
export async function handleInboundEmail(
  message: ForwardableEmailMessage,
  env: Env,
): Promise<void> {
  const from = message.from.toLowerCase();
  let subject = message.headers.get("subject") ?? "(no subject)";
  let text = "";
  let fromName: string | null = null;
  const recipients: string[] = [message.to];
  try {
    const parsed = await PostalMime.parse(message.raw);
    subject = parsed.subject ?? subject;
    text = (parsed.text ?? "").trim();
    if (!text && parsed.html) {
      text = parsed.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    }
    fromName = parsed.from?.name || null;
    for (const t of parsed.to ?? []) if (t.address) recipients.push(t.address);
  } catch (err) {
    console.error("[inbox] parse failed:", String(err).slice(0, 200));
  }

  // Maker Messages: a reply to a threaded m-<token>@… address routes into that
  // shop's supplier conversation, not the founder's shared inbox.
  try {
    const { parseMakerToken, appendSupplierReply } = await import("./supplier-messaging");
    const token = parseMakerToken(recipients, env);
    if (token) {
      const route = await first<{ shop_id: string }>(
        env.DB,
        `SELECT shop_id FROM thread_addresses WHERE token = ?`,
        token,
      );
      if (route) {
        await appendSupplierReply(env, route.shop_id, token, {
          body: stripQuoted(text),
          authorName: fromName ?? from,
          subject,
        });
        // Also drop the raw mail in the shop owner's real inbox so it isn't
        // trapped in the app — the app is a copy, not a cage.
        const owner = await first<{ owner_email: string | null }>(
          env.DB,
          `SELECT owner_email FROM shops WHERE id = ?`,
          route.shop_id,
        );
        if (owner?.owner_email) await message.forward(owner.owner_email).catch(() => {});
        return;
      }
    }
  } catch (err) {
    console.error("[inbox] maker routing failed:", String(err).slice(0, 200));
  }

  try {
    const contactId = await upsertContact(env, { email: from, source: "lead" });
    await logInteraction(env, contactId, "email_in", {
      subject,
      bodyMd: text.slice(0, 4000) || "(no text body)",
      metadata: { to: message.to },
    });
    const who = await first<{ name: string | null }>(
      env.DB,
      `SELECT name FROM crm_contacts WHERE id = ?`,
      contactId,
    );
    await run(
      env.DB,
      `INSERT OR IGNORE INTO crm_tasks (id, contact_id, title, due_at, auto_key)
       VALUES (?, ?, ?, datetime('now'), ?)`,
      newId("tk"),
      contactId,
      `Reply to ${who?.name ?? from}: "${subject.slice(0, 80)}"`,
      `reply_${Date.now()}`,
    );
  } catch (err) {
    // CRM bookkeeping must never bounce real mail.
    console.error("[inbox] CRM logging failed:", String(err).slice(0, 200));
  }

  // Always pass the message through to the founder's verified inbox.
  if (env.NOTIFY_EMAIL_TO) {
    try {
      await message.forward(env.NOTIFY_EMAIL_TO);
    } catch (err) {
      console.error("[inbox] forward failed:", String(err).slice(0, 200));
    }
  }
}

/** Trim the quoted history/signature off an email reply — keep the fresh part. */
function stripQuoted(text: string): string {
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    if (/^>/.test(line)) break;
    if (/^On .+ wrote:$/.test(line.trim())) break;
    if (/^-{2,}\s*Original Message\s*-{2,}/i.test(line.trim())) break;
    if (/^_{5,}$/.test(line.trim())) break; // Outlook divider
    out.push(line);
  }
  return out.join("\n").trim() || text.trim();
}
