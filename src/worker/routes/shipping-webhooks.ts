import { Hono } from "hono";
import { all, first, run } from "../services/db";
import { getProviderConfig, makeAdapter, type ShipmentStatus } from "../services/shipping";
import { newId } from "../utils/id";
import type { AppContext } from "../types/env";

/**
 * Inbound carrier tracking webhooks: /api/shipping/webhooks/:provider/:token
 *
 * The token is a per-provider secret path segment generated when the
 * provider is connected (shown on the admin Shipping page — paste the full
 * URL into the carrier dashboard). Providers with real signing (EasyPost
 * HMAC) verify on top of the token inside their adapter's parseWebhook.
 *
 * Carriers expect fast 2xx responses (Shippo: within 3s), so handlers do
 * minimal work and always acknowledge unmatched tracking numbers.
 */
export const shippingWebhookRoutes = new Hono<AppContext>();

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Progression rank so late-arriving events never downgrade a shipment. */
const STATUS_RANK: Record<ShipmentStatus, number> = {
  created: 0,
  label_purchased: 1,
  in_transit: 2,
  out_for_delivery: 3,
  delivered: 4,
  exception: 2, // can occur mid-transit; never overrides delivered
  returned: 4,
  cancelled: 4,
};

shippingWebhookRoutes.post("/webhooks/:provider/:token", async (c) => {
  const provider = c.req.param("provider");
  const token = c.req.param("token");
  const row = await getProviderConfig(c.env.DB, provider);
  if (!row?.webhook_token || !constantTimeEqual(row.webhook_token, token)) {
    return c.json({ error: "Not found" }, 404);
  }
  const adapter = makeAdapter(c.env.DB, row);
  if (!adapter.parseWebhook) return c.json({ error: "Not found" }, 404);

  const bodyText = await c.req.text();
  let updates;
  try {
    updates = await adapter.parseWebhook(c.req.raw, bodyText);
  } catch (err) {
    // Signature failures are a hard reject; malformed bodies are acknowledged
    // so the carrier doesn't retry garbage forever.
    const message = err instanceof Error ? err.message : String(err);
    if (message.toLowerCase().includes("verification")) {
      return c.json({ error: "Signature verification failed" }, 401);
    }
    console.error(`[shipping-webhook] ${provider}: ${message}`);
    return c.json({ received: true, parsed: false });
  }

  for (const update of updates) {
    const shipment = await first<{ id: string; order_id: string; status: ShipmentStatus }>(
      c.env.DB,
      `SELECT id, order_id, status FROM order_shipments WHERE tracking_number = ? AND provider = ?`,
      update.trackingNumber,
      provider,
    );
    if (!shipment) continue;

    await run(
      c.env.DB,
      `INSERT INTO shipment_events (id, shipment_id, provider, status, description, location, occurred_at, raw_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      newId("sev"),
      shipment.id,
      provider,
      update.status,
      update.description?.slice(0, 500) ?? null,
      update.location?.slice(0, 200) ?? null,
      update.occurredAt ?? null,
      update.raw ? JSON.stringify(update.raw).slice(0, 4000) : null,
    );

    if (update.status && STATUS_RANK[update.status] >= STATUS_RANK[shipment.status]) {
      await run(
        c.env.DB,
        `UPDATE order_shipments SET status = ?, updated_at = datetime('now') WHERE id = ?`,
        update.status,
        shipment.id,
      );
      if (["in_transit", "out_for_delivery", "delivered"].includes(update.status)) {
        // Delivered only when every shipment on the order has arrived.
        let fulfillment = update.status === "delivered" ? "delivered" : "shipped";
        if (fulfillment === "delivered") {
          const open = await all(
            c.env.DB,
            `SELECT id FROM order_shipments
             WHERE order_id = ? AND id != ? AND status NOT IN ('delivered','cancelled','returned')`,
            shipment.order_id,
            shipment.id,
          );
          if (open.length > 0) fulfillment = "shipped";
        }
        await run(
          c.env.DB,
          `UPDATE orders SET fulfillment_status = ?, updated_at = datetime('now')
           WHERE id = ? AND fulfillment_status != 'cancelled'`,
          fulfillment,
          shipment.order_id,
        );
      }
    }
  }
  return c.json({ received: true });
});
