import { all } from "./db";
import { getShopDb } from "./tenant-db";
import { PRIMARY_SHOP_ID } from "./shops";
import type { Env } from "../types/env";

/**
 * Fleet activity pulse — a live "is everything moving?" feed across every shop.
 * The activity spine (activity_events) lives in each shop's own Durable Object,
 * so HQ can't read it in one query; instead we fan out over active shops, pull
 * each one's most recent events, merge, and take the newest overall. Read-only
 * and on-demand — it never touches the write-hot emit() path. Best-effort per
 * shop: one DO hiccup drops that shop from the feed, not the whole page.
 *
 * At the current fleet size (tens of shops) a per-request fan-out is fine; if
 * the fleet grows large this should become a mirror-on-write into a platform
 * table. The response says how many shops were scanned so the cap is visible.
 */

export interface FleetActivityItem {
  shopId: string;
  shopName: string;
  kind: string;
  title: string;
  entityType: string | null;
  entityId: string | null;
  createdAt: string;
}

/** Which event kinds are worth showing in the pulse — the business-meaningful ones. */
const NOTABLE = new Set([
  "product.published",
  "order.paid",
  "deposit.paid",
  "commission.stage_changed",
  "review.created",
  "client.created",
  "sample.approved",
  "po.status.confirmed",
  "po.status.received",
  "inventory.sold_out",
  "inventory.restocked",
  "research.maker_promoted",
  "research.trend_adopted",
]);

export async function fleetActivity(
  env: Env,
  opts?: { limit?: number; perShop?: number; maxShops?: number },
): Promise<{ items: FleetActivityItem[]; shopsScanned: number }> {
  const limit = Math.min(200, Math.max(1, opts?.limit ?? 100));
  const perShop = Math.min(50, Math.max(1, opts?.perShop ?? 20));
  const maxShops = Math.min(500, Math.max(1, opts?.maxShops ?? 200));

  const shops = await all<{ id: string; name: string }>(
    env.DB,
    `SELECT id, name FROM shops WHERE status = 'active' ORDER BY created_at DESC LIMIT ?`,
    maxShops,
  );

  const items: FleetActivityItem[] = [];
  for (const shop of shops) {
    try {
      const db = getShopDb(env, shop.id, PRIMARY_SHOP_ID);
      const rows = await all<{ kind: string; title: string; entity_type: string | null; entity_id: string | null; created_at: string }>(
        db,
        `SELECT kind, title, entity_type, entity_id, created_at
           FROM activity_events ORDER BY created_at DESC LIMIT ?`,
        perShop,
      );
      for (const r of rows) {
        if (!NOTABLE.has(r.kind)) continue;
        items.push({
          shopId: shop.id,
          shopName: shop.name,
          kind: r.kind,
          title: r.title,
          entityType: r.entity_type,
          entityId: r.entity_id,
          createdAt: r.created_at,
        });
      }
    } catch {
      /* one shop's DO hiccup drops it from the feed, not the page */
    }
  }

  items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  return { items: items.slice(0, limit), shopsScanned: shops.length };
}
