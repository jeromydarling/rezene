import { Hono, type Context } from "hono";
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

// Two shapes: legacy /webhooks/:provider/:token (primary shop) and
// /webhooks/s/:shop/:provider/:token (any shop — what new configs emit).
async function shopDbForWebhook(c: Context<AppContext>): Promise<D1Database | null> {
  const slug = c.req.param("shop");
  if (!slug) return c.env.DB;
  const { getShopBySlug, PRIMARY_SHOP_ID } = await import("../services/shops");
  const { getShopDb } = await import("../services/tenant-db");
  const shop = await getShopBySlug(c.env.DB, slug);
  return shop ? getShopDb(c.env, shop.id, PRIMARY_SHOP_ID) : null;
}

shippingWebhookRoutes.post("/webhooks/s/:shop/:provider/:token", handleTrackingWebhook);
shippingWebhookRoutes.post("/webhooks/:provider/:token", handleTrackingWebhook);

async function handleTrackingWebhook(c: Context<AppContext>): Promise<Response> {
  const provider = c.req.param("provider") ?? "";
  const token = c.req.param("token") ?? "";
  const db = await shopDbForWebhook(c);
  if (!db) return c.json({ error: "Not found" }, 404);
  const row = await getProviderConfig(db, provider);
  if (!row?.webhook_token || !constantTimeEqual(row.webhook_token, token)) {
    return c.json({ error: "Not found" }, 404);
  }
  const adapter = makeAdapter(db, row);
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
      db,
      `SELECT id, order_id, status FROM order_shipments WHERE tracking_number = ? AND provider = ?`,
      update.trackingNumber,
      provider,
    );
    if (!shipment) continue;

    await run(
      db,
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
        db,
        `UPDATE order_shipments SET status = ?, updated_at = datetime('now') WHERE id = ?`,
        update.status,
        shipment.id,
      );
      if (["in_transit", "out_for_delivery", "delivered"].includes(update.status)) {
        // Delivered only when every shipment on the order has arrived.
        let fulfillment = update.status === "delivered" ? "delivered" : "shipped";
        if (fulfillment === "delivered") {
          const open = await all(
            db,
            `SELECT id FROM order_shipments
             WHERE order_id = ? AND id != ? AND status NOT IN ('delivered','cancelled','returned')`,
            shipment.order_id,
            shipment.id,
          );
          if (open.length > 0) fulfillment = "shipped";
        }
        // Prior order state gates the customer email so each transition mails once.
        const ord = await first<{ fulfillment_status: string }>(
          db,
          `SELECT fulfillment_status FROM orders WHERE id = ?`,
          shipment.order_id,
        );
        const prior = ord?.fulfillment_status ?? "";
        await run(
          db,
          `UPDATE orders SET fulfillment_status = ?, updated_at = datetime('now')
           WHERE id = ? AND fulfillment_status != 'cancelled'`,
          fulfillment,
          shipment.order_id,
        );
        if (prior !== "cancelled") {
          const kind =
            fulfillment === "delivered" && prior !== "delivered"
              ? "delivered"
              : fulfillment === "shipped" && !["shipped", "delivered"].includes(prior)
                ? "shipped"
                : null;
          if (kind) {
            const { notifyShipmentStatus } = await import("../services/transactional-emails");
            const slug = c.req.param("shop") ?? null;
            // Off the response path — carriers want a fast 2xx.
            c.executionCtx.waitUntil(
              notifyShipmentStatus(c.env, db, { orderId: shipment.order_id, kind, shopSlug: slug }),
            );
          }
        }
      }
    }
  }
  return c.json({ received: true });
}
