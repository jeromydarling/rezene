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

const BASE = "https://api.goshippo.com";

function headers(ctx: ProviderContext) {
  return {
    authorization: `ShippoToken ${ctx.credentials.apiToken ?? ""}`,
    "content-type": "application/json",
  };
}

function toShippoAddress(a: ShippingAddress) {
  return {
    name: a.name ?? a.company ?? "Shipping department",
    company: a.company ?? "",
    street1: a.line1 ?? "",
    street2: a.line2 ?? "",
    city: a.city ?? "",
    state: a.state ?? "",
    zip: a.postalCode ?? "",
    country: a.country,
    phone: a.phone ?? "",
    email: a.email ?? "",
  };
}

interface ShippoRate {
  object_id: string;
  amount: string;
  currency: string;
  provider: string;
  servicelevel?: { name?: string };
  estimated_days?: number | null;
}

interface ShippoShipment {
  object_id: string;
  rates?: ShippoRate[];
  messages?: { text?: string }[];
}

async function createShipment(ctx: ProviderContext, req: RateRequest): Promise<ShippoShipment> {
  const international = req.from.country !== req.to.country;
  let customsDeclaration: string | undefined;
  if (international) {
    const declaration = await providerFetch<{ object_id: string }>(
      "shippo",
      `${BASE}/customs/declarations/`,
      {
        method: "POST",
        headers: headers(ctx),
        body: JSON.stringify({
          contents_type: "MERCHANDISE",
          non_delivery_option: "RETURN",
          certify: true,
          certify_signer: req.from.name ?? "Shipping department",
          items: req.items.map((i) => ({
            description: i.description.slice(0, 100),
            quantity: i.quantity,
            net_weight: String(Math.max(0.05, i.weightKg ?? 0.3)),
            mass_unit: "kg",
            value_amount: String(centsToMajor(i.valueCents)),
            value_currency: i.currency,
            origin_country: i.originCountry ?? req.from.country,
            tariff_number: i.hsCode ?? "",
          })),
        }),
      },
    );
    customsDeclaration = declaration.object_id;
  }
  return providerFetch<ShippoShipment>("shippo", `${BASE}/shipments/`, {
    method: "POST",
    headers: headers(ctx),
    body: JSON.stringify({
      address_from: toShippoAddress(req.from),
      address_to: toShippoAddress(req.to),
      parcels: [
        {
          length: String(req.parcel.lengthCm),
          width: String(req.parcel.widthCm),
          height: String(req.parcel.heightCm),
          distance_unit: "cm",
          weight: String(req.parcel.weightKg),
          mass_unit: "kg",
        },
      ],
      ...(customsDeclaration ? { customs_declaration: customsDeclaration } : {}),
      async: false,
    }),
  });
}

const SHIPPO_STATUS: Record<string, ShipmentStatus> = {
  PRE_TRANSIT: "label_purchased",
  TRANSIT: "in_transit",
  DELIVERED: "delivered",
  RETURNED: "returned",
  FAILURE: "exception",
  UNKNOWN: "in_transit",
};

export function shippoAdapter(ctx: ProviderContext): ShippingAdapter {
  return {
    async getRates(req: RateRequest): Promise<RateQuote[]> {
      const shipment = await createShipment(ctx, req);
      const rates = shipment.rates ?? [];
      if (rates.length === 0 && shipment.messages?.length) {
        throw new ShippingProviderError(
          "shippo",
          shipment.messages.map((m) => m.text).filter(Boolean).join("; ").slice(0, 400) ||
            "No rates returned",
        );
      }
      return rates.map((r) => ({
        provider: "shippo" as const,
        rateId: r.object_id,
        externalShipmentId: shipment.object_id,
        carrier: r.provider,
        service: r.servicelevel?.name ?? "Standard",
        amountCents: toCents(r.amount),
        currency: r.currency,
        minDays: r.estimated_days ?? null,
        maxDays: r.estimated_days ?? null,
      }));
    },

    async createLabel(req: LabelRequest): Promise<LabelResult> {
      // Rate ids expire with their shipment; re-quote if the caller lost it.
      let rateId = req.rateId;
      if (!rateId) {
        const quotes = await this.getRates(req);
        if (quotes.length === 0) throw new ShippingProviderError("shippo", "No rates available");
        const wanted = req.service
          ? quotes.find((q) => q.service === req.service)
          : quotes.sort((a, b) => a.amountCents - b.amountCents)[0];
        rateId = (wanted ?? quotes[0]).rateId;
      }
      const tx = await providerFetch<{
        object_id: string;
        status: string;
        label_url?: string;
        tracking_number?: string;
        tracking_url_provider?: string;
        messages?: { text?: string }[];
        rate?: { provider?: string; servicelevel?: { name?: string }; amount?: string; currency?: string };
      }>("shippo", `${BASE}/transactions/`, {
        method: "POST",
        headers: headers(ctx),
        body: JSON.stringify({ rate: rateId, label_file_type: "PDF_4x6", async: false }),
      });
      if (tx.status !== "SUCCESS") {
        throw new ShippingProviderError(
          "shippo",
          tx.messages?.map((m) => m.text).filter(Boolean).join("; ").slice(0, 400) ||
            `Label purchase failed (status ${tx.status})`,
        );
      }
      return {
        externalId: tx.object_id,
        carrier: tx.rate?.provider,
        service: tx.rate?.servicelevel?.name,
        trackingNumber: tx.tracking_number,
        trackingUrl: tx.tracking_url_provider,
        labelUrl: tx.label_url,
        costCents: tx.rate?.amount ? toCents(tx.rate.amount) : undefined,
        currency: tx.rate?.currency,
        raw: tx,
      };
    },

    async parseWebhook(_request: Request, bodyText: string): Promise<TrackingUpdate[]> {
      const body = JSON.parse(bodyText) as {
        event?: string;
        data?: {
          tracking_number?: string;
          tracking_status?: {
            status?: string;
            status_details?: string;
            status_date?: string;
            location?: { city?: string; country?: string };
          };
        };
      };
      if (body.event !== "track_updated" || !body.data?.tracking_number) return [];
      const ts = body.data.tracking_status;
      return [
        {
          trackingNumber: body.data.tracking_number,
          status: ts?.status ? (SHIPPO_STATUS[ts.status] ?? null) : null,
          description: ts?.status_details,
          location: [ts?.location?.city, ts?.location?.country].filter(Boolean).join(", "),
          occurredAt: ts?.status_date,
          raw: body,
        },
      ];
    },
  };
}
