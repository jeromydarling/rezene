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

const BASE = "https://panel.sendcloud.sc/api/v2";

function headers(ctx: ProviderContext) {
  return {
    authorization: `Basic ${btoa(`${ctx.credentials.publicKey ?? ""}:${ctx.credentials.secretKey ?? ""}`)}`,
    "content-type": "application/json",
  };
}

interface ScMethod {
  id: number;
  name: string;
  carrier?: string;
  min_weight?: string;
  max_weight?: string;
  countries?: { iso_2?: string; price?: number }[];
}

/** Sendcloud prices its methods in EUR. */
export function sendcloudAdapter(ctx: ProviderContext): ShippingAdapter {
  return {
    async getRates(req: RateRequest): Promise<RateQuote[]> {
      const data = await providerFetch<{ shipping_methods?: ScMethod[] }>(
        "sendcloud",
        `${BASE}/shipping_methods?to_country=${encodeURIComponent(req.to.country)}&from_country=${encodeURIComponent(req.from.country)}`,
        { headers: headers(ctx) },
      );
      const weight = req.parcel.weightKg;
      return (data.shipping_methods ?? [])
        .map((m): RateQuote | null => {
          const min = parseFloat(m.min_weight ?? "0");
          const max = parseFloat(m.max_weight ?? "1000");
          if (Number.isFinite(min) && weight < min) return null;
          if (Number.isFinite(max) && weight > max) return null;
          const entry = m.countries?.find(
            (c) => c.iso_2?.toUpperCase() === req.to.country.toUpperCase(),
          );
          if (!entry || entry.price == null || entry.price <= 0) return null;
          return {
            provider: "sendcloud" as const,
            rateId: String(m.id),
            carrier: m.carrier ?? "Sendcloud",
            service: m.name,
            amountCents: toCents(entry.price),
            currency: "EUR",
          };
        })
        .filter((q): q is RateQuote => q !== null)
        .sort((a, b) => a.amountCents - b.amountCents)
        .slice(0, 20);
    },

    async createLabel(req: LabelRequest): Promise<LabelResult> {
      if (!req.rateId) {
        throw new ShippingProviderError(
          "sendcloud",
          "Pick a Sendcloud shipping method (rate) before buying a label",
        );
      }
      const international = req.from.country !== req.to.country;
      const data = await providerFetch<{
        parcel?: {
          id?: number;
          tracking_number?: string;
          tracking_url?: string;
          label?: { label_printer?: string; normal_printer?: string[] };
        };
      }>("sendcloud", `${BASE}/parcels`, {
        method: "POST",
        headers: headers(ctx),
        body: JSON.stringify({
          parcel: {
            name: req.to.name ?? "Recipient",
            company_name: req.to.company ?? "",
            address: req.to.line1 ?? "",
            address_2: req.to.line2 ?? "",
            house_number: "",
            city: req.to.city ?? "",
            postal_code: req.to.postalCode ?? "",
            country: req.to.country,
            telephone: req.to.phone ?? "",
            email: req.to.email ?? "",
            weight: String(req.parcel.weightKg),
            request_label: true,
            shipment: { id: Number(req.rateId) },
            total_order_value: String(
              centsToMajor(req.items.reduce((s, i) => s + i.valueCents * i.quantity, 0)),
            ),
            total_order_value_currency: req.currency,
            ...(international
              ? {
                  customs_shipment_type: 2, // commercial goods
                  parcel_items: req.items.map((i) => ({
                    description: i.description.slice(0, 100),
                    quantity: i.quantity,
                    weight: String(Math.max(0.05, i.weightKg ?? 0.3)),
                    value: String(centsToMajor(i.valueCents)),
                    hs_code: i.hsCode ?? "",
                    origin_country: i.originCountry ?? req.from.country,
                  })),
                }
              : {}),
          },
        }),
        timeoutMs: 25_000,
      });
      const parcel = data.parcel;
      if (!parcel?.id) throw new ShippingProviderError("sendcloud", "Sendcloud returned no parcel");

      // Label downloads require API auth — fetch now and hand back bytes.
      let labelPdfBase64: string | undefined;
      const labelUrl = parcel.label?.label_printer ?? parcel.label?.normal_printer?.[0];
      if (labelUrl) {
        try {
          const res = await fetch(labelUrl, {
            headers: { authorization: headers(ctx).authorization },
            signal: AbortSignal.timeout(15_000),
          });
          if (res.ok) {
            const buf = new Uint8Array(await res.arrayBuffer());
            let bin = "";
            for (const b of buf) bin += String.fromCharCode(b);
            labelPdfBase64 = btoa(bin);
          }
        } catch {
          // Label stays retrievable from the Sendcloud panel; not fatal.
        }
      }
      return {
        externalId: String(parcel.id),
        carrier: "Sendcloud",
        trackingNumber: parcel.tracking_number,
        trackingUrl: parcel.tracking_url,
        labelPdfBase64,
        raw: { id: parcel.id },
      };
    },

    async parseWebhook(_request: Request, bodyText: string): Promise<TrackingUpdate[]> {
      const body = JSON.parse(bodyText) as {
        action?: string;
        parcel?: {
          tracking_number?: string;
          status?: { id?: number; message?: string };
          carrier?: { code?: string };
        };
      };
      if (body.action !== "parcel_status_changed" || !body.parcel?.tracking_number) return [];
      const message = (body.parcel.status?.message ?? "").toLowerCase();
      let status: ShipmentStatus | null = null;
      if (message.includes("delivered")) status = "delivered";
      else if (message.includes("out for delivery") || message.includes("driver"))
        status = "out_for_delivery";
      else if (message.includes("transit") || message.includes("sorting") || message.includes("shipped"))
        status = "in_transit";
      else if (message.includes("return")) status = "returned";
      else if (message.includes("error") || message.includes("not delivered")) status = "exception";
      return [
        {
          trackingNumber: body.parcel.tracking_number,
          status,
          description: body.parcel.status?.message,
          raw: body,
        },
      ];
    },
  };
}
