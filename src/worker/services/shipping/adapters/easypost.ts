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

const BASE = "https://api.easypost.com/v2";

// EasyPost is imperial-only: inches and ounces.
const CM_TO_IN = 1 / 2.54;
const KG_TO_OZ = 35.274;

function headers(ctx: ProviderContext) {
  return {
    authorization: `Basic ${btoa(`${ctx.credentials.apiKey ?? ""}:`)}`,
    "content-type": "application/json",
  };
}

function toEpAddress(a: ShippingAddress) {
  return {
    name: a.name ?? a.company ?? "Shipping department",
    company: a.company,
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

interface EpRate {
  id: string;
  carrier: string;
  service: string;
  rate: string;
  currency: string;
  delivery_days?: number | null;
}

interface EpShipment {
  id: string;
  rates?: EpRate[];
  messages?: { message?: string }[];
  postage_label?: { label_url?: string };
  tracking_code?: string;
  tracker?: { public_url?: string };
  selected_rate?: EpRate;
}

async function createShipment(ctx: ProviderContext, req: RateRequest): Promise<EpShipment> {
  const international = req.from.country !== req.to.country;
  const customsInfo = international
    ? {
        customs_certify: true,
        customs_signer: req.from.name ?? "Shipping department",
        contents_type: "merchandise",
        restriction_type: "none",
        customs_items: req.items.map((i) => ({
          description: i.description.slice(0, 100),
          quantity: i.quantity,
          value: centsToMajor(i.valueCents) * i.quantity,
          weight: Math.max(1, Math.round((i.weightKg ?? 0.3) * KG_TO_OZ)),
          hs_tariff_number: i.hsCode ?? "",
          origin_country: i.originCountry ?? req.from.country,
        })),
      }
    : undefined;
  return providerFetch<EpShipment>("easypost", `${BASE}/shipments`, {
    method: "POST",
    headers: headers(ctx),
    body: JSON.stringify({
      shipment: {
        from_address: toEpAddress(req.from),
        to_address: toEpAddress(req.to),
        parcel: {
          length: +(req.parcel.lengthCm * CM_TO_IN).toFixed(1),
          width: +(req.parcel.widthCm * CM_TO_IN).toFixed(1),
          height: +(req.parcel.heightCm * CM_TO_IN).toFixed(1),
          weight: +(req.parcel.weightKg * KG_TO_OZ).toFixed(1),
        },
        ...(customsInfo ? { customs_info: customsInfo } : {}),
      },
    }),
  });
}

const EP_STATUS: Record<string, ShipmentStatus> = {
  pre_transit: "label_purchased",
  in_transit: "in_transit",
  out_for_delivery: "out_for_delivery",
  delivered: "delivered",
  return_to_sender: "returned",
  failure: "exception",
  error: "exception",
  cancelled: "cancelled",
  unknown: "in_transit",
};

async function verifyHmac(secret: string, body: string, header: string | null): Promise<boolean> {
  if (!header) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const expected =
    "hmac-sha256-hex=" +
    [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (expected.length !== header.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ header.charCodeAt(i);
  return diff === 0;
}

export function easypostAdapter(ctx: ProviderContext): ShippingAdapter {
  return {
    async getRates(req: RateRequest): Promise<RateQuote[]> {
      const shipment = await createShipment(ctx, req);
      const rates = shipment.rates ?? [];
      if (rates.length === 0 && shipment.messages?.length) {
        throw new ShippingProviderError(
          "easypost",
          shipment.messages.map((m) => m.message).filter(Boolean).join("; ").slice(0, 400) ||
            "No rates returned",
        );
      }
      return rates.map((r) => ({
        provider: "easypost" as const,
        rateId: r.id,
        externalShipmentId: shipment.id,
        carrier: r.carrier,
        service: r.service,
        amountCents: toCents(r.rate),
        currency: r.currency,
        minDays: r.delivery_days ?? null,
        maxDays: r.delivery_days ?? null,
      }));
    },

    async createLabel(req: LabelRequest): Promise<LabelResult> {
      let shipmentId = req.externalShipmentId;
      let rateId = req.rateId;
      if (!shipmentId || !rateId) {
        const quotes = await this.getRates(req);
        if (quotes.length === 0) throw new ShippingProviderError("easypost", "No rates available");
        const wanted = req.service
          ? quotes.find((q) => q.service === req.service)
          : quotes.sort((a, b) => a.amountCents - b.amountCents)[0];
        const pick = wanted ?? quotes[0];
        shipmentId = pick.externalShipmentId;
        rateId = pick.rateId;
      }
      const bought = await providerFetch<EpShipment>(
        "easypost",
        `${BASE}/shipments/${shipmentId}/buy`,
        {
          method: "POST",
          headers: headers(ctx),
          body: JSON.stringify({ rate: { id: rateId } }),
        },
      );
      return {
        externalId: bought.id,
        carrier: bought.selected_rate?.carrier,
        service: bought.selected_rate?.service,
        trackingNumber: bought.tracking_code,
        trackingUrl: bought.tracker?.public_url,
        labelUrl: bought.postage_label?.label_url,
        costCents: bought.selected_rate ? toCents(bought.selected_rate.rate) : undefined,
        currency: bought.selected_rate?.currency,
        raw: bought,
      };
    },

    async parseWebhook(request: Request, bodyText: string): Promise<TrackingUpdate[]> {
      const secret = ctx.credentials.webhookSecret;
      if (secret) {
        const ok = await verifyHmac(secret, bodyText, request.headers.get("x-hmac-signature"));
        if (!ok) throw new ShippingProviderError("easypost", "Webhook HMAC verification failed");
      }
      const body = JSON.parse(bodyText) as {
        description?: string;
        result?: {
          object?: string;
          tracking_code?: string;
          status?: string;
          tracking_details?: { message?: string; datetime?: string; tracking_location?: { city?: string; country?: string } }[];
        };
      };
      const r = body.result;
      if (!r?.tracking_code || r.object !== "Tracker") return [];
      const last = r.tracking_details?.at(-1);
      return [
        {
          trackingNumber: r.tracking_code,
          status: r.status ? (EP_STATUS[r.status] ?? null) : null,
          description: last?.message ?? body.description,
          location: [last?.tracking_location?.city, last?.tracking_location?.country]
            .filter(Boolean)
            .join(", "),
          occurredAt: last?.datetime,
          raw: body,
        },
      ];
    },
  };
}
