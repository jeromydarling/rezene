import { all, first, run } from "./db";
import { newId } from "../utils/id";
import { aiComplete, AiUnavailableError } from "./ai";
import { parseModelJson } from "./anthropic";
import type { Env } from "../types/env";

/**
 * Client-message outbox — the editable draft surface for client-facing
 * automations (a welcome note, "your fitting's ready", a deposit thank-you).
 * A message is drafted (AI, grounded in the client + commission + the brand's
 * voice), the shop edits it on the Client Book or the Approvals inbox, then
 * approves it to send: email via the branded shell, or "portal" to publish it
 * on the client's portal page. Nothing reaches a client until it's sent.
 *
 * Degrades exactly like every other AI feature: `aiComplete` uses the shop's
 * Anthropic key when set and falls back to Workers AI Llama otherwise. If no
 * provider exists at all we still file a plain draft from a written fallback,
 * so the outbox never breaks the write it reacted to.
 */

export type ClientMessageTrigger =
  | "client-created-welcome"
  | "commission-stage-notify"
  | "deposit-paid-thanks"
  | "manual";

export interface ClientMessageRow {
  id: string;
  client_id: string;
  commission_id: string | null;
  trigger: string | null;
  channel: string;
  subject: string | null;
  body_md: string;
  status: string;
  provider: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DraftClientMessageSpec {
  clientId: string;
  commissionId?: string | null;
  trigger: ClientMessageTrigger;
  /** How the shop intends to reach the client. Email needs an address; portal always works. */
  channel?: "email" | "portal";
  /** One-line description of the moment, fed to the model. */
  situation: string;
  /** Extra facts for the model (stage label, amount, piece name) — never invented. */
  facts?: string[];
  /** Auto-approve: skip the review gate and send/publish immediately. */
  autoApprove?: boolean;
  /** Skip if an un-sent draft with this trigger already exists for this client (+commission). */
  oncePer?: boolean;
}

interface Grounding {
  clientName: string;
  clientEmail: string | null;
  brandName: string;
  voice: string | null;
  commissionTitle: string | null;
}

async function loadGrounding(env: Env, db: D1Database, spec: DraftClientMessageSpec): Promise<Grounding | null> {
  const client = await first<{ name: string; email: string | null }>(
    db,
    `SELECT name, email FROM clients WHERE id = ?`,
    spec.clientId,
  );
  if (!client) return null;
  const settings = await all<{ key: string; value: string }>(
    db,
    `SELECT key, value FROM settings WHERE key IN ('brand_name','brand_voice')`,
  ).catch(() => [] as { key: string; value: string }[]);
  const map = Object.fromEntries(settings.map((r) => [r.key, r.value]));
  let commissionTitle: string | null = null;
  if (spec.commissionId) {
    const co = await first<{ title: string }>(db, `SELECT title FROM commissions WHERE id = ?`, spec.commissionId).catch(
      () => null,
    );
    commissionTitle = co?.title ?? null;
  }
  return {
    clientName: client.name,
    clientEmail: client.email,
    brandName: map.brand_name?.trim() || env.BRAND_NAME || "the studio",
    voice: map.brand_voice?.trim() || null,
    commissionTitle,
  };
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name.trim();

/** A written fallback when no AI provider is configured — still a real, editable draft. */
function fallbackMessage(g: Grounding, spec: DraftClientMessageSpec): { subject: string; body: string } {
  const who = firstName(g.clientName);
  const piece = g.commissionTitle ? ` on ${g.commissionTitle}` : "";
  switch (spec.trigger) {
    case "client-created-welcome":
      return {
        subject: `Welcome to ${g.brandName}`,
        body: `Hi ${who},\n\nWe're so glad to have you. We'll keep you close at every step of the work we do together — measurements, fittings, and the finished piece.\n\nAnything you need, just reply.\n\n— ${g.brandName}`,
      };
    case "commission-stage-notify":
      return {
        subject: `An update${piece}`,
        body: `Hi ${who},\n\nA quick update${piece}: ${spec.situation}\n\nWe'll be in touch with the next step.\n\n— ${g.brandName}`,
      };
    case "deposit-paid-thanks":
      return {
        subject: `Thank you`,
        body: `Hi ${who},\n\nThank you — we've received your payment${piece}. Everything's in motion, and we'll keep you posted.\n\n— ${g.brandName}`,
      };
    default:
      return { subject: `A note from ${g.brandName}`, body: `Hi ${who},\n\n${spec.situation}\n\n— ${g.brandName}` };
  }
}

async function generateMessage(
  env: Env,
  g: Grounding,
  spec: DraftClientMessageSpec,
): Promise<{ subject: string; body: string; provider: string }> {
  const system = `You write short, warm, personal messages FROM a small independent fashion studio TO one of its clients — a real person the studio makes clothes for. This is one-to-one correspondence, not marketing: no hype, no emojis, no exclamation-mark salesiness. Sound like a thoughtful maker writing a quick, genuine note. Keep it to 2–4 short sentences. Address the client by their first name. Sign off with the studio's name.${
    g.voice ? `\n\nThe studio's brand voice (follow it):\n${g.voice.slice(0, 800)}` : ""
  }

Return ONLY a JSON object: {"subject": "short email subject", "body": "the message body as plain text with line breaks"}. Do not invent facts, dates, prices, or promises beyond what you're given.`;
  const prompt = `Studio: ${g.brandName}
Client's name: ${g.clientName}${g.commissionTitle ? `\nTheir project: ${g.commissionTitle}` : ""}
The moment: ${spec.situation}${spec.facts && spec.facts.length ? `\nFacts you may use (do not add others):\n- ${spec.facts.slice(0, 8).join("\n- ")}` : ""}

Write the message.`;
  const completion = await aiComplete(env, { system, prompt, maxTokens: 700 });
  const parsed = parseModelJson(completion.text) as Record<string, unknown>;
  const subject = typeof parsed.subject === "string" ? parsed.subject.trim().slice(0, 200) : "";
  const body = typeof parsed.body === "string" ? parsed.body.trim().slice(0, 4000) : "";
  if (!body) throw new Error("Empty client message");
  return { subject: subject || `A note from ${g.brandName}`, body, provider: completion.provider };
}

/**
 * Draft a client-facing message into the outbox. Returns the new row id, or
 * null if it was skipped (no client, or a matching un-sent draft already
 * exists). Never throws — a failed draft must not break the caller's write.
 */
export async function draftClientMessage(
  env: Env,
  db: D1Database,
  spec: DraftClientMessageSpec,
): Promise<string | null> {
  try {
    const g = await loadGrounding(env, db, spec);
    if (!g) return null;

    // Default channel: email if we have an address, else the portal.
    const channel = spec.channel ?? (g.clientEmail ? "email" : "portal");

    if (spec.oncePer) {
      const dup = await first<{ id: string }>(
        db,
        `SELECT id FROM client_messages
         WHERE client_id = ? AND trigger = ? AND status = 'draft'
           AND (? IS NULL OR commission_id = ?)
         LIMIT 1`,
        spec.clientId,
        spec.trigger,
        spec.commissionId ?? null,
        spec.commissionId ?? null,
      );
      if (dup) return null;
    }

    let subject: string;
    let body: string;
    let provider: string | null = null;
    try {
      const gen = await generateMessage(env, g, spec);
      subject = gen.subject;
      body = gen.body;
      provider = gen.provider;
    } catch (err) {
      if (!(err instanceof AiUnavailableError)) {
        console.log("client-message generation failed, using fallback", spec.trigger, String(err).slice(0, 160));
      }
      const fb = fallbackMessage(g, spec);
      subject = fb.subject;
      body = fb.body;
    }

    const id = newId("cmsg");
    await run(
      db,
      `INSERT INTO client_messages (id, client_id, commission_id, trigger, channel, subject, body_md, status, provider)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?)`,
      id,
      spec.clientId,
      spec.commissionId ?? null,
      spec.trigger,
      channel,
      subject,
      body,
      provider,
    );

    if (spec.autoApprove) {
      // Auto-approve gives the client automations real teeth: send the email /
      // publish to the portal straight away, no review gate.
      await sendClientMessage(env, db, id);
    } else {
      await run(
        db,
        `INSERT INTO activity_events (id, kind, entity_type, entity_id, title, payload)
         VALUES (?, 'client.message_drafted', 'client', ?, ?, ?)`,
        newId("act"),
        spec.clientId,
        `Message drafted for ${g.clientName} — review it in the Client Book`,
        JSON.stringify({ messageId: id, trigger: spec.trigger }),
      );
    }
    return id;
  } catch (err) {
    console.log("draftClientMessage failed", spec.trigger, String(err).slice(0, 160));
    return null;
  }
}

/**
 * Send (or publish) a drafted message. Email goes through the branded shell;
 * "portal" simply marks it sent so it surfaces on the client's portal page.
 * Idempotent: a message already sent is a no-op. Returns whether an email
 * actually left (false for portal, or when buyer email isn't configured).
 */
export async function sendClientMessage(
  env: Env,
  db: D1Database,
  messageId: string,
): Promise<{ ok: boolean; emailed: boolean; error?: string }> {
  const msg = await first<ClientMessageRow>(db, `SELECT * FROM client_messages WHERE id = ?`, messageId);
  if (!msg) return { ok: false, emailed: false, error: "Message not found" };
  if (msg.status === "sent") return { ok: true, emailed: false };

  const client = await first<{ name: string; email: string | null }>(
    db,
    `SELECT name, email FROM clients WHERE id = ?`,
    msg.client_id,
  );
  if (!client) return { ok: false, emailed: false, error: "Client not found" };

  let emailed = false;
  if (msg.channel === "email") {
    if (!client.email) {
      return { ok: false, emailed: false, error: "This client has no email — switch the message to the portal, or add one." };
    }
    try {
      const { buyerEmailConfigured, sendBuyerEmail } = await import("./buyer-email");
      const { getEmailBrand, renderBrandedEmail } = await import("./email-template");
      const brand = await getEmailBrand(env, db);
      const paragraphs = msg.body_md
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean);
      const esc = (s: string) =>
        s.replace(/[&<>]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[ch]!)).replace(/\n/g, "<br>");
      const bodyHtml = paragraphs
        .map((p) => `<p style="margin:0 0 14px;">${esc(p)}</p>`)
        .join("");
      const html = renderBrandedEmail({
        brand,
        preheader: msg.subject ?? `A note from ${brand.name}`,
        heading: msg.subject ?? `A note from ${brand.name}`,
        bodyHtml,
        footerNote: `Sent by ${brand.name}.`,
      });
      const configured = buyerEmailConfigured(env);
      await sendBuyerEmail(env, {
        to: client.email,
        db,
        subject: msg.subject ?? `A note from ${brand.name}`,
        text: msg.body_md,
        html,
      });
      emailed = configured;
    } catch (err) {
      console.error("[client-messages] email send failed:", String(err).slice(0, 160));
      return { ok: false, emailed: false, error: "Couldn't send the email — try again." };
    }
  }

  await run(
    db,
    `UPDATE client_messages SET status = 'sent', sent_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
    messageId,
  );
  // Land it on the client's timeline so the page tells one continuous story.
  await run(
    db,
    `INSERT INTO client_events (id, client_id, commission_id, kind, subject, body_md, event_at)
     VALUES (?, ?, ?, 'note', ?, ?, datetime('now'))`,
    newId("cev"),
    msg.client_id,
    msg.commission_id,
    msg.channel === "portal" ? `Posted to portal: ${msg.subject ?? "a message"}` : `Sent: ${msg.subject ?? "a message"}`,
    msg.body_md,
  ).catch(() => {});
  await run(
    db,
    `INSERT INTO activity_events (id, kind, entity_type, entity_id, title, payload)
     VALUES (?, 'client.message_sent', 'client', ?, ?, ?)`,
    newId("act"),
    msg.client_id,
    msg.channel === "portal"
      ? `Posted a message to ${client.name}'s portal`
      : `Sent a message to ${client.name}`,
    JSON.stringify({ messageId, channel: msg.channel }),
  ).catch(() => {});
  return { ok: true, emailed };
}

// --- The specific client automations -----------------------------------------

/** Stages worth telling the client about, with the situation copy for each. */
const CLIENT_STAGE_MOMENTS: Record<string, string> = {
  design: "their design has been approved and we're moving ahead",
  fabric: "we've sourced the fabric for their piece and cutting is next",
  fitting: "their piece is ready for a fitting — time to book a time to come in",
  delivery: "their piece is finished and ready to collect or be delivered",
};

export function clientStageIsNotifiable(stage: string): boolean {
  return stage in CLIENT_STAGE_MOMENTS;
}

export async function draftClientWelcome(
  env: Env,
  db: D1Database,
  p: { clientId: string; autoApprove?: boolean },
): Promise<void> {
  await draftClientMessage(env, db, {
    clientId: p.clientId,
    trigger: "client-created-welcome",
    situation: "This client has just been added to the studio's book — write a warm, brief welcome that sets the tone for working together.",
    autoApprove: p.autoApprove,
    oncePer: true,
  });
}

export async function draftStageNotify(
  env: Env,
  db: D1Database,
  p: { clientId: string; commissionId?: string | null; stage: string; stageLabel?: string; autoApprove?: boolean },
): Promise<void> {
  const moment = CLIENT_STAGE_MOMENTS[p.stage];
  if (!moment) return;
  await draftClientMessage(env, db, {
    clientId: p.clientId,
    commissionId: p.commissionId ?? null,
    trigger: "commission-stage-notify",
    situation: `Let the client know ${moment}.`,
    facts: p.stageLabel ? [`Current stage: ${p.stageLabel}`] : undefined,
    autoApprove: p.autoApprove,
    oncePer: true,
  });
}

export async function draftDepositThanks(
  env: Env,
  db: D1Database,
  p: { clientId: string; commissionId?: string | null; label: string; amountCents: number; autoApprove?: boolean },
): Promise<void> {
  const amount = `$${(p.amountCents / 100).toFixed(2)}`;
  await draftClientMessage(env, db, {
    clientId: p.clientId,
    commissionId: p.commissionId ?? null,
    trigger: "deposit-paid-thanks",
    situation: `We've just received a payment from the client (${p.label}). Thank them warmly and reassure them the work is in motion.`,
    facts: [`Payment: ${p.label}`, `Amount received: ${amount}`],
    autoApprove: p.autoApprove,
  });
}
