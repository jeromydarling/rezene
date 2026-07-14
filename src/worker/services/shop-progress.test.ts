import { describe, it, expect } from "vitest";
import { buildShopProgress, type ShopInput, type EventInput } from "./shop-progress";

// Fixed "now" so day math is deterministic.
const NOW = Date.parse("2026-07-14T00:00:00Z");

const shops: ShopInput[] = [
  { id: "a", name: "Stalled Studio", slug: "stalled", status: "active", plan: null, created_at: "2026-06-24 12:00:00" },
  { id: "b", name: "New Studio", slug: "new", status: "active", plan: null, created_at: "2026-07-13 12:00:00" },
  { id: "c", name: "Open Studio", slug: "open", status: "active", plan: null, created_at: "2026-05-01 12:00:00" },
  { id: "d", name: "Progressing Studio", slug: "prog", status: "active", plan: null, created_at: "2026-07-04 12:00:00" },
];

const events: EventInput[] = [
  // a: only brand, 20 days ago → stalled, next = product
  { shop_id: "a", event: "brand", created_at: "2026-06-24 12:00:00" },
  // c: fully open
  { shop_id: "c", event: "brand", created_at: "2026-05-01 12:00:00" },
  { shop_id: "c", event: "product", created_at: "2026-05-02 12:00:00" },
  { shop_id: "c", event: "payments", created_at: "2026-05-03 12:00:00" },
  { shop_id: "c", event: "fulfillment", created_at: "2026-05-03 12:00:00" },
  { shop_id: "c", event: "publish", created_at: "2026-05-04 12:00:00" },
  { shop_id: "c", event: "share", created_at: "2026-05-05 12:00:00" },
  { shop_id: "c", event: "open", created_at: "2026-05-05 12:00:00" },
  // d: brand + product, most recent 5 days ago → in progress, next = payments
  { shop_id: "d", event: "brand", created_at: "2026-07-04 12:00:00" },
  { shop_id: "d", event: "product", created_at: "2026-07-09 12:00:00" },
  // b: no events
];

describe("buildShopProgress", () => {
  const report = buildShopProgress(shops, events, NOW);
  const byId = Object.fromEntries(report.shops.map((s) => [s.shopId, s]));

  it("classifies each shop's state from its milestones and recency", () => {
    expect(byId.a.state).toBe("stalled"); // 19 days, no progress
    expect(byId.b.state).toBe("new"); // <3 days old
    expect(byId.c.state).toBe("open"); // has the 'open' milestone
    expect(byId.d.state).toBe("in_progress"); // last milestone 4 days ago
  });

  it("names the next blocking step (first milestone not crossed)", () => {
    expect(byId.a.nextStep?.id).toBe("product"); // brand done, product next
    expect(byId.b.nextStep?.id).toBe("brand"); // nothing done
    expect(byId.d.nextStep?.id).toBe("payments"); // brand+product done
    expect(byId.c.open).toBe(true);
  });

  it("summarises the fleet and sorts stalled-first, open-last", () => {
    expect(report.summary).toMatchObject({ total: 4, open: 1, stalled: 1, new: 1, inProgress: 1 });
    expect(report.shops[0].shopId).toBe("a"); // stalled first
    expect(report.shops[report.shops.length - 1].shopId).toBe("c"); // open last
  });

  it("reports how long a stalled shop has been stuck", () => {
    expect(byId.a.stalledDays).toBeGreaterThanOrEqual(14);
    expect(byId.a.signupDays).toBeGreaterThanOrEqual(14);
  });
});
