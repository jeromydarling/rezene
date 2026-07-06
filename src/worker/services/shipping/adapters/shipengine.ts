import {
  providerFetch,
  centsToMajor,
  toCents,
  ShippingProviderError,
  type LabelRequest,
  type LabelResult,
  type ProviderContext,
  type RateQuote,
  type RateRequest,
  type ShipmentStatus,
  type ShippingAdapter,
  type ShippingAddress,
  type TrackingUpdate,
} from "../types";

const BASE = "https://api.shipengine.com/v1";

function headers(ctx: ProviderContext) {
  return { "api-key": ctx.credentials.apiKey ?? "", "content-type": "application/json" };
}

function toSeAddress(a: ShippingAddress) {
  return {
    name: a.name ?? a.company ?? "Shipping department",
    company_name: a.company ?? undefined,
    address_line1: a.line1 ?? "",
    address_line2: a.line2 ?? undefined,
    city_locality: a.city ?? "",
    state_province: a.state ?? "",
    postal_code: a.postalCode ?? "",
    country_code: a.country,
    phone: a.phone ?? "0000000000",
  };
}

function buildShipment(req: RateRequest) {
  const international = req.from.country !== req.to.country;
  return {
    ship_from: toSeAddress(req.from),
    ship_to: toSeAddress(req.to),
    packages: [
      {
        weight: { value: req.parcel.weightKg, unit: "kilogram" },
        dimensions: {
          length: req.parcel.lengthCm,
          width: req.parcel.widthCm,
          height: req.parcel.heightCm,
          unit: "centimeter",
        },
      },
    ],
    ...(international
      ? {
          customs: {
            contents: "merchandise",
            non_delivery: "return_to_sender",
            customs_items: req.items.map((i) => ({
              description: i.description.slice(0, 100),
              quantity: i.quantity,
              value: { amount: centsToMajor(i.valueCents), currency: i.currency.toLowerCase() },
              harmonized_tariff_code: i.hsCode ?? undefined,
              country_of_origin: i.originCountry ?? req.from.country,
            })),
          },
        }
      : {}),
  };
}

interface SeRate {
  rate_id: string;
  carrier_friendly_name?: string;
  carrier_code?: string;
  service_type?: string;
  service_code?: string;
  shipping_amount?: { amount?: number; currency?: string };
  delivery_days?: number | null;
}

const SE_STATUS: Record<string, ShipmentStatus> = {
  AC: "label_purchased", // accepted
  IT: "in_transit",
  DE: "delivered",
  EX: "exception",
  AT: "exception", // delivery attempt failed
  NY: "label_purchased", // not yet in system
  UN: "in_transit",
};

export function shipengineAdapter(ctx: ProviderContext): ShippingAdapter {
  return {
    async getRates(req: RateRequest): Promise<RateQuote[]> {
      // ShipEngine quotes only against explicitly listed connected carriers.
      const carriers = await providerFetch<{ carriers?: { carrier_id: string }[] }>(
        "shipengine",
        `${BASE}/carriers`,
        { headers: headers(ctx) },
      );
      const carrierIds = (carriers.carriers ?? []).map((c) => c.carrier_id);
      if (carrierIds.length === 0) {
        throw new ShippingProviderError(
          "shipengine",
          "No carriers connected to this ShipEngine account",
        );
      }
      const data = await providerFetch<{
        rate_response?: { rates?: SeRate[]; errors?: { message?: string }[] };
      }>("shipengine", `${BASE}/rates`, {
        method: "POST",
        headers: headers(ctx),
        body: JSON.stringify({
          rate_options: { carrier_ids: carrierIds },
          shipment: buildShipment(req),
        }),
      });
      const rates = data.rate_response?.rates ?? [];
      if (rates.length === 0 && data.rate_response?.errors?.length) {
        throw new ShippingProviderError(
          "shipengine",
          data.rate_response.errors.map((e) => e.message).filter(Boolean).join("; ").slice(0, 400),
        );
      }
      return rates.map((r) => ({
        provider: "shipengine" as const,
        rateId: r.rate_id,
        carrier: r.carrier_friendly_name ?? r.carrier_code ?? "Carrier",
        service: r.service_type ?? r.service_code ?? "Standard",
        amountCents: toCents(r.shipping_amount?.amount ?? 0),
        currency: (r.shipping_amount?.currency ?? req.currency).toUpperCase(),
        minDays: r.delivery_days ?? null,
        maxDays: r.delivery_days ?? null,
      }));
    },

    async createLabel(req: LabelRequest): Promise<LabelResult> {
      let rateId = req.rateId;
      if (!rateId) {
        const quotes = await this.getRates(req);
        if (quotes.length === 0)
          throw new ShippingProviderError("shipengine", "No rates available");
        const wanted = req.service
          ? quotes.find((q) => q.service === req.service)
          : quotes.sort((a, b) => a.amountCents - b.amountCents)[0];
        rateId = (wanted ?? quotes[0]).rateId;
      }
      const label = await providerFetch<{
        label_id?: string;
        tracking_number?: string;
        carrier_code?: string;
        service_code?: string;
        shipment_cost?: { amount?: number; currency?: string };
        label_download?: { pdf?: string; href?: string };
      }>("shipengine", `${BASE}/labels/rates/${rateId}`, {
        method: "POST",
        headers: headers(ctx),
        body: JSON.stringify({ label_format: "pdf" }),
      });
      return {
        externalId: label.label_id,
        carrier: label.carrier_code,
        service: label.service_code,
        trackingNumber: label.tracking_number,
        labelUrl: label.label_download?.pdf ?? label.label_download?.href,
        costCents: label.shipment_cost?.amount ? toCents(label.shipment_cost.amount) : undefined,
        currency: label.shipment_cost?.currency?.toUpperCase(),
        raw: label,
      };
    },

    async parseWebhook(_request: Request, bodyText: string): Promise<TrackingUpdate[]> {
      const body = JSON.parse(bodyText) as {
        resource_type?: string;
        data?: {
          tracking_number?: string;
          status_code?: string;
          status_description?: string;
          carrier_status_description?: string;
          occurred_at?: string;
          city_locality?: string;
          country_code?: string;
        };
      };
      const d = body.data;
      if (!d?.tracking_number) return [];
      return [
        {
          trackingNumber: d.tracking_number,
          status: d.status_code ? (SE_STATUS[d.status_code.toUpperCase()] ?? null) : null,
          description: d.status_description ?? d.carrier_status_description,
          location: [d.city_locality, d.country_code].filter(Boolean).join(", "),
          occurredAt: d.occurred_at,
          raw: body,
        },
      ];
    },
  };
}
