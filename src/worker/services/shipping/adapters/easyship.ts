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
  type TrackingUpdate,
} from "../types";

const BASE = "https://public-api.easyship.com/2024-09";

function headers(ctx: ProviderContext) {
  return {
    authorization: `Bearer ${ctx.credentials.accessToken ?? ""}`,
    "content-type": "application/json",
  };
}

function addressBlock(a: { country: string; postalCode?: string; city?: string; state?: string; line1?: string }) {
  return {
    country_alpha2: a.country,
    postal_code: a.postalCode ?? "",
    city: a.city ?? "",
    state: a.state ?? "",
    line_1: a.line1 ?? "",
  };
}

function parcelBlock(req: RateRequest) {
  return [
    {
      box: {
        length: req.parcel.lengthCm,
        width: req.parcel.widthCm,
        height: req.parcel.heightCm,
        weight: req.parcel.weightKg,
      },
      items: req.items.map((i) => ({
        description: i.description.slice(0, 100),
        quantity: i.quantity,
        actual_weight: Math.max(0.05, i.weightKg ?? 0.3),
        declared_currency: i.currency,
        declared_customs_value: centsToMajor(i.valueCents),
        hs_code: i.hsCode ?? undefined,
        origin_country_alpha2: i.originCountry ?? req.from.country,
      })),
    },
  ];
}

interface EsRate {
  courier_id?: string;
  courier_name?: string;
  courier_service?: { id?: string; name?: string };
  total_charge?: number;
  currency?: string;
  min_delivery_time?: number;
  max_delivery_time?: number;
}

const ES_STATUS: Record<string, ShipmentStatus> = {
  in_transit_to_customer: "in_transit",
  out_for_delivery: "out_for_delivery",
  delivered: "delivered",
  exception: "exception",
  failed_delivery_attempt: "exception",
  return_to_sender: "returned",
  label_created: "label_purchased",
};

export function easyshipAdapter(ctx: ProviderContext): ShippingAdapter {
  return {
    async getRates(req: RateRequest): Promise<RateQuote[]> {
      const data = await providerFetch<{ rates?: EsRate[]; error?: { message?: string } }>(
        "easyship",
        `${BASE}/rates`,
        {
          method: "POST",
          headers: headers(ctx),
          body: JSON.stringify({
            origin_address: addressBlock(req.from),
            destination_address: addressBlock(req.to),
            incoterms: "DDU",
            insurance: { is_insured: false },
            courier_selection: { apply_shipping_rules: true },
            shipping_settings: { units: { weight: "kg", dimensions: "cm" } },
            parcels: parcelBlock(req),
          }),
        },
      );
      if (data.error?.message) throw new ShippingProviderError("easyship", data.error.message);
      return (data.rates ?? [])
        .map((r): RateQuote | null => {
          if (r.total_charge == null) return null;
          return {
            provider: "easyship" as const,
            rateId: r.courier_service?.id ?? r.courier_id,
            carrier: r.courier_name ?? "Courier",
            service: r.courier_service?.name ?? r.courier_name ?? "Standard",
            amountCents: toCents(r.total_charge),
            currency: r.currency ?? req.currency,
            minDays: r.min_delivery_time ?? null,
            maxDays: r.max_delivery_time ?? null,
          };
        })
        .filter((q): q is RateQuote => q !== null);
    },

    async createLabel(req: LabelRequest): Promise<LabelResult> {
      const data = await providerFetch<{
        shipment?: {
          easyship_shipment_id?: string;
          courier?: { name?: string };
          trackings?: { tracking_number?: string; tracking_page_url?: string }[];
          shipping_documents?: { url?: string; category?: string }[];
          rates?: EsRate[];
        };
        error?: { message?: string };
      }>("easyship", `${BASE}/shipments`, {
        method: "POST",
        headers: headers(ctx),
        body: JSON.stringify({
          buy_label: true,
          origin_address: addressBlock(req.from),
          destination_address: {
            ...addressBlock(req.to),
            contact_name: req.to.name ?? "Recipient",
            contact_phone: req.to.phone ?? "",
            contact_email: req.to.email ?? "",
          },
          incoterms: "DDU",
          insurance: { is_insured: false },
          courier_selection: req.rateId
            ? { selected_courier_id: req.rateId, allow_courier_fallback: false }
            : { apply_shipping_rules: true },
          shipping_settings: {
            units: { weight: "kg", dimensions: "cm" },
            label_options: { format: "pdf" },
          },
          parcels: parcelBlock(req),
        }),
        timeoutMs: 25_000,
      });
      if (data.error?.message) throw new ShippingProviderError("easyship", data.error.message);
      const s = data.shipment;
      if (!s?.easyship_shipment_id)
        throw new ShippingProviderError("easyship", "Easyship returned no shipment");
      const tracking = s.trackings?.[0];
      const labelDoc =
        s.shipping_documents?.find((d) => d.category === "label") ?? s.shipping_documents?.[0];
      return {
        externalId: s.easyship_shipment_id,
        carrier: s.courier?.name,
        trackingNumber: tracking?.tracking_number,
        trackingUrl: tracking?.tracking_page_url,
        labelUrl: labelDoc?.url,
        raw: { easyship_shipment_id: s.easyship_shipment_id },
      };
    },

    async parseWebhook(_request: Request, bodyText: string): Promise<TrackingUpdate[]> {
      const body = JSON.parse(bodyText) as {
        event_type?: string;
        resource?: {
          tracking_number?: string;
          tracking_status?: string;
          status?: string;
          easyship_shipment_id?: string;
        };
      };
      const r = body.resource;
      const trackingNumber = r?.tracking_number;
      if (!trackingNumber) return [];
      const raw = (r?.tracking_status ?? r?.status ?? "").toLowerCase();
      return [
        {
          trackingNumber,
          status: ES_STATUS[raw] ?? null,
          description: r?.tracking_status ?? r?.status,
          raw: body,
        },
      ];
    },
  };
}
