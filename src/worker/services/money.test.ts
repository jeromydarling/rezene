import { describe, it, expect } from "vitest";
import { sumLineItems, discountCents, orderTotalCents, loyaltyEarnCents } from "./money";

describe("sumLineItems", () => {
  it("multiplies price by quantity and sums", () => {
    expect(sumLineItems([{ unitPriceCents: 2500, quantity: 2 }, { unitPriceCents: 1000, quantity: 1 }])).toBe(6000);
  });
  it("is zero for an empty cart", () => {
    expect(sumLineItems([])).toBe(0);
  });
});

describe("discountCents", () => {
  it("rounds a percentage to the nearest cent", () => {
    // 33% of 1000c = 330c
    expect(discountCents(1000, { percentOff: 33 })).toBe(330);
    // 10% of 1995c = 199.5 -> 200
    expect(discountCents(1995, { percentOff: 10 })).toBe(200);
  });
  it("caps the discount at the subtotal (never negative order)", () => {
    expect(discountCents(1000, { amountOffCents: 5000 })).toBe(1000);
    expect(discountCents(1000, { percentOff: 200 })).toBe(1000);
  });
  it("takes the larger of percent vs flat amount", () => {
    expect(discountCents(1000, { percentOff: 10, amountOffCents: 250 })).toBe(250);
    expect(discountCents(1000, { percentOff: 40, amountOffCents: 250 })).toBe(400);
  });
  it("is zero on a zero or negative subtotal", () => {
    expect(discountCents(0, { percentOff: 50 })).toBe(0);
  });
});

describe("orderTotalCents", () => {
  it("applies discount before adding tax and shipping", () => {
    expect(orderTotalCents({ subtotalCents: 10000, discountCents: 2000, taxCents: 800, shippingCents: 500 })).toBe(9300);
  });
  it("never charges below zero even if a discount exceeds the subtotal", () => {
    expect(orderTotalCents({ subtotalCents: 1000, discountCents: 5000 })).toBe(0);
  });
  it("adds tax/shipping on top of a zeroed subtotal", () => {
    // subtotal fully discounted, but shipping still applies
    expect(orderTotalCents({ subtotalCents: 1000, discountCents: 1000, shippingCents: 500 })).toBe(500);
  });
  it("defaults optional parts to zero", () => {
    expect(orderTotalCents({ subtotalCents: 4200 })).toBe(4200);
  });
});

describe("loyaltyEarnCents", () => {
  it("earns a rounded percentage of the subtotal", () => {
    expect(loyaltyEarnCents(2500, 5)).toBe(125);
    expect(loyaltyEarnCents(1995, 5)).toBe(100); // 99.75 -> 100
  });
  it("earns nothing on zero subtotal or zero rate", () => {
    expect(loyaltyEarnCents(0, 5)).toBe(0);
    expect(loyaltyEarnCents(5000, 0)).toBe(0);
  });
});
