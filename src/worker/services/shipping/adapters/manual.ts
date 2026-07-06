import { all } from "../../db";
import type { ProviderContext, RateQuote, RateRequest, ShippingAdapter } from "../types";

/**
 * Manual rate table: zones + flat rates from D1, no external calls.
 * A zone with an empty country list is the "rest of world" catch-all;
 * an explicit country match always beats the catch-all.
 */
export function manualAdapter(ctx: ProviderContext): ShippingAdapter {
  return {
    async getRates(req: RateRequest): Promise<RateQuote[]> {
      const zones = await all<{ id: string; countries_json: string; sort_order: number }>(
        ctx.db,
        `SELECT id, countries_json, sort_order FROM shipping_zones WHERE is_active = 1 ORDER BY sort_order`,
      );
      const country = req.to.country.toUpperCase();
      let matched: string | null = null;
      let fallback: string | null = null;
      for (const zone of zones) {
        let countries: string[] = [];
        try {
          countries = JSON.parse(zone.countries_json) as string[];
        } catch {
          /* treat unparseable as catch-all */
        }
        if (countries.length === 0) {
          fallback = fallback ?? zone.id;
        } else if (countries.map((c) => c.toUpperCase()).includes(country)) {
          matched = zone.id;
          break;
        }
      }
      const zoneId = matched ?? fallback;
      if (!zoneId) return [];

      const rates = await all<{
        name: string;
        amount_cents: number;
        currency: string;
        free_over_cents: number | null;
        min_transit_days: number | null;
        max_transit_days: number | null;
      }>(
        ctx.db,
        `SELECT name, amount_cents, currency, free_over_cents, min_transit_days, max_transit_days
         FROM shipping_rates WHERE zone_id = ? AND is_active = 1 ORDER BY sort_order`,
        zoneId,
      );
      return rates.map((r) => {
        const free = r.free_over_cents != null && req.subtotalCents >= r.free_over_cents;
        return {
          provider: "manual" as const,
          carrier: "Standard post",
          service: free ? `${r.name} (free)` : r.name,
          amountCents: free ? 0 : r.amount_cents,
          currency: r.currency,
          minDays: r.min_transit_days,
          maxDays: r.max_transit_days,
        };
      });
    },
  };
}
