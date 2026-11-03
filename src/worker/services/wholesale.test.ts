import { describe, expect, it } from "vitest";
import { parsePriceTiers, resolveWholesaleUnitPrice } from "./wholesale";

describe("parsePriceTiers", () => {
  it("parses, sorts, and sanitises", () => {
    const tiers = parsePriceTiers(JSON.stringify([
      { minQty: 24, priceCents: 3600 },
      { minQty: 12, priceCents: 4000 },
      { minQty: 1, priceCents: 1 }, // minQty must be > 1 — dropped
      { minQty: 6, priceCents: -5 }, // negative price — dropped
    ]));
    expect(tiers).toEqual([
      { minQty: 12, priceCents: 4000 },
      { minQty: 24, priceCents: 3600 },
    ]);
  });

  it("returns no tiers for null, garbage, or non-arrays", () => {
    expect(parsePriceTiers(null)).toEqual([]);
    expect(parsePriceTiers("not json")).toEqual([]);
    expect(parsePriceTiers('{"minQty":12}')).toEqual([]);
  });
});

describe("resolveWholesaleUnitPrice", () => {
  const tiers = [
    { minQty: 12, priceCents: 4000 },
    { minQty: 24, priceCents: 3600 },
  ];

  it("base price minus trade discount below the first tier", () => {
    expect(resolveWholesaleUnitPrice({ baseCents: 5000, tiers, qty: 6, discountPct: 10 })).toBe(4500);
  });

  it("picks the deepest tier the quantity reaches, then applies the discount", () => {
    expect(resolveWholesaleUnitPrice({ baseCents: 5000, tiers, qty: 12, discountPct: 0 })).toBe(4000);
    expect(resolveWholesaleUnitPrice({ baseCents: 5000, tiers, qty: 23, discountPct: 0 })).toBe(4000);
    expect(resolveWholesaleUnitPrice({ baseCents: 5000, tiers, qty: 24, discountPct: 10 })).toBe(3240);
  });

  it("a per-buyer override wins over everything and ignores the discount", () => {
    expect(
      resolveWholesaleUnitPrice({ baseCents: 5000, tiers, qty: 100, discountPct: 50, overrideCents: 4200 }),
    ).toBe(4200);
  });

  it("clamps absurd discounts and handles no tiers", () => {
    expect(resolveWholesaleUnitPrice({ baseCents: 1000, qty: 1, discountPct: 500 })).toBe(100); // capped at 90%
    expect(resolveWholesaleUnitPrice({ baseCents: 1000, qty: 1, discountPct: -20 })).toBe(1000);
  });
});
