import { all } from "./db";
import type { ActivityEvent, EmitOpts } from "./activity";

/**
 * Outbound webhook fan-out — delivers spine events to external subscribers
 * (Zapier REST Hooks, Make, your own endpoint) registered in
 * `webhook_subscriptions`. Called from `emit()` after the built-in automations
 * and shop workflows run.
 *
 * v1 delivers via `ctx.waitUntil(fetch)` — fire-and-forget, off the request
 * path. The production upgrade is Cloudflare Queues (retries + backoff + DLQ),
 * but Queues needs an account binding that isn't enabled yet, so this keeps to
 * the documented MVP fallback. Each delivery is signed (HMAC-SHA256, Standard-
 * Webhooks style) so the subscriber can verify authenticity.
 */

const enc = new TextEncoder();

async function signHmacSha256(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function deliverToSubscriptions(db: D1Database, ev: ActivityEvent, opts?: EmitOpts): Promise<void> {
  // Delivery needs a network path off the request; without ctx we skip (the
  // event is still on the spine for polling triggers to pick up).
  if (!opts?.ctx) return;
  let subs: { id: string; target_url: string; secret: string }[];
  try {
    subs = await all<{ id: string; target_url: string; secret: string }>(
      db,
      `SELECT id, target_url, secret FROM webhook_subscriptions WHERE event = ?`,
      ev.kind,
    );
  } catch {
    return; // table not provisioned on this shop DB yet
  }
  if (!subs.length) return;

  const body = JSON.stringify({
    id: crypto.randomUUID(),
    event: ev.kind,
    title: ev.title,
    payload: ev.payload ?? {},
    at: new Date().toISOString(),
  });

  for (const sub of subs) {
    opts.ctx.waitUntil(
      (async () => {
        try {
          const signature = await signHmacSha256(sub.secret, body);
          await fetch(sub.target_url, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-verto-event": ev.kind,
              "x-verto-signature": `sha256=${signature}`,
            },
            body,
          });
        } catch (err) {
          console.log("webhook delivery failed", sub.id, String(err).slice(0, 120));
        }
      })(),
    );
  }
}
