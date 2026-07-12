/**
 * Money is integer minor units (cents) everywhere in Verto. These are the
 * canonical, side-effect-free helpers for the arithmetic on the checkout and
 * order paths — the code most expensive to get subtly wrong. They are pure so
 * they can be unit-tested exhaustively without a database.
 *
 * Rules that hold across all of them:
 *   - inputs and outputs are integer cents;
 *   - a total can never go below zero (an over-large discount is capped);
 *   - percentage math rounds to the nearest cent (half-up via Math.round).
 */

export interface LineItem {
  unitPriceCents: number;
  quantity: number;
}

/** Sum of unit price × quantity across cart/order lines. */
export function sumLineItems(items: LineItem[]): number {
  return items.reduce((sum, i) => sum + i.unitPriceCents * i.quantity, 0);
}

export interface DiscountSpec {
  /** 0–100, applied to the subtotal. */
  percentOff?: number | null;
  /** Flat cents off. */
  amountOffCents?: number | null;
}

/**
 * The cents a discount removes from a subtotal. Percent is rounded to the
 * nearest cent; the result is clamped to [0, subtotal] so a discount can zero
 * an order but never make it negative. When both a percent and a flat amount
 * are given, the larger saving wins.
 */
export function discountCents(subtotal: number, spec: DiscountSpec): number {
  if (subtotal <= 0) return 0;
  const fromPct = spec.percentOff && spec.percentOff > 0
    ? Math.round((subtotal * Math.min(spec.percentOff, 100)) / 100)
    : 0;
  const fromAmt = spec.amountOffCents && spec.amountOffCents > 0 ? spec.amountOffCents : 0;
  return Math.min(subtotal, Math.max(fromPct, fromAmt));
}

export interface OrderTotalParts {
  subtotalCents: number;
  discountCents?: number;
  taxCents?: number;
  shippingCents?: number;
}

/**
 * The amount actually charged: subtotal − discount + tax + shipping, floored at
 * zero. Discount applies before tax/shipping are added.
 */
export function orderTotalCents(parts: OrderTotalParts): number {
  const base = parts.subtotalCents - (parts.discountCents ?? 0);
  const total = Math.max(0, base) + (parts.taxCents ?? 0) + (parts.shippingCents ?? 0);
  return Math.max(0, Math.round(total));
}

/** Store credit earned on a subtotal at a given percentage (nearest cent). */
export function loyaltyEarnCents(subtotalCents: number, pct: number): number {
  if (subtotalCents <= 0 || pct <= 0) return 0;
  return Math.round((subtotalCents * pct) / 100);
}
