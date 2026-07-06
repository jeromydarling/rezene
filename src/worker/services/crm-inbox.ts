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
  try {
    const parsed = await PostalMime.parse(message.raw);
    subject = parsed.subject ?? subject;
    text = (parsed.text ?? "").trim();
    if (!text && parsed.html) {
      text = parsed.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    }
  } catch (err) {
    console.error("[inbox] parse failed:", String(err).slice(0, 200));
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
