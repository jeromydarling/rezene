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

/** MyDHL API (DHL Express) — carrier-direct rates, labels + customs (PLT). */

function base(ctx: ProviderContext): string {
  return ctx.config.sandbox
    ? "https://express.api.dhl.com/mydhlapi/test"
    : "https://express.api.dhl.com/mydhlapi";
}

function headers(ctx: ProviderContext) {
  return {
    authorization: `Basic ${btoa(`${ctx.credentials.apiKey ?? ""}:${ctx.credentials.apiSecret ?? ""}`)}`,
    "content-type": "application/json",
  };
}

/** Next calendar day, ISO date — DHL rejects same-day/past shipping dates. */
function plannedDate(): string {
  return new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10);
}

const DHL_STATUS: Record<string, ShipmentStatus> = {
  "pre-transit": "label_purchased",
  transit: "in_transit",
  delivered: "delivered",
  failure: "exception",
  unknown: "in_transit",
};

export function dhlAdapter(ctx: ProviderContext): ShippingAdapter {
  return {
    async getRates(req: RateRequest): Promise<RateQuote[]> {
      const params = new URLSearchParams({
        accountNumber: ctx.credentials.accountNumber ?? "",
        originCountryCode: req.from.country,
        originCityName: req.from.city ?? "",
        destinationCountryCode: req.to.country,
        destinationCityName: req.to.city ?? "",
        weight: String(req.parcel.weightKg),
        length: String(req.parcel.lengthCm),
        width: String(req.parcel.widthCm),
        height: String(req.parcel.heightCm),
        plannedShippingDate: plannedDate(),
        isCustomsDeclarable: String(req.from.country !== req.to.country),
        unitOfMeasurement: "metric",
      });
      if (req.from.postalCode) params.set("originPostalCode", req.from.postalCode);
      if (req.to.postalCode) params.set("destinationPostalCode", req.to.postalCode);

      const data = await providerFetch<{
        products?: {
          productName?: string;
          productCode?: string;
          totalPrice?: { price?: number; priceCurrency?: string; currencyType?: string }[];
          deliveryCapabilities?: { totalTransitDays?: string | number };
        }[];
      }>("dhl_express", `${base(ctx)}/rates?${params}`, { headers: headers(ctx) });

      return (data.products ?? [])
        .map((p) => {
          // BILLC = billing-currency price; fall back to the first price entry.
          const price =
            p.totalPrice?.find((t) => t.currencyType === "BILLC" && (t.price ?? 0) > 0) ??
            p.totalPrice?.find((t) => (t.price ?? 0) > 0);
          if (!price?.price) return null;
          const transit = Number(p.deliveryCapabilities?.totalTransitDays ?? NaN);
          return {
            provider: "dhl_express" as const,
            rateId: p.productCode,
            carrier: "DHL Express",
            service: p.productName ?? p.productCode ?? "Express",
            amountCents: toCents(price.price),
            currency: price.priceCurrency ?? req.currency,
            minDays: Number.isFinite(transit) ? transit : null,
            maxDays: Number.isFinite(transit) ? transit : null,
          };
        })
        .filter((q): q is NonNullable<typeof q> => q !== null);
    },

    async createLabel(req: LabelRequest): Promise<LabelResult> {
      const productCode = req.rateId ?? req.service ?? "P";
      const international = req.from.country !== req.to.country;
      const toParty = (a: typeof req.from) => ({
        postalAddress: {
          postalCode: a.postalCode ?? "",
          cityName: a.city ?? "",
          countryCode: a.country,
          addressLine1: a.line1 ?? "-",
          ...(a.line2 ? { addressLine2: a.line2 } : {}),
        },
        contactInformation: {
          fullName: a.name ?? a.company ?? "Shipping department",
          companyName: a.company ?? a.name ?? "Private",
          phone: a.phone ?? "0000000000",
          ...(a.email ? { email: a.email } : {}),
        },
      });
      const declaredValue = centsToMajor(
        req.items.reduce((sum, i) => sum + i.valueCents * i.quantity, 0),
      );

      const body = {
        plannedShippingDateAndTime: `${plannedDate()}T10:00:00 GMT+00:00`,
        pickup: { isRequested: false },
        productCode,
        accounts: [{ typeCode: "shipper", number: ctx.credentials.accountNumber ?? "" }],
        customerDetails: {
          shipperDetails: toParty(req.from),
          receiverDetails: toParty(req.to),
        },
        content: {
          packages: [
            {
              weight: req.parcel.weightKg,
              dimensions: {
                length: req.parcel.lengthCm,
                width: req.parcel.widthCm,
                height: req.parcel.heightCm,
              },
            },
          ],
          isCustomsDeclarable: international,
          declaredValue,
          declaredValueCurrency: req.currency,
          description: "Apparel",
          incoterm: "DAP",
          unitOfMeasurement: "metric",
          ...(international
            ? {
                exportDeclaration: {
                  lineItems: req.items.map((i, idx) => ({
                    number: idx + 1,
                    description: i.description.slice(0, 70),
                    price: centsToMajor(i.valueCents),
                    quantity: { value: i.quantity, unitOfMeasurement: "PCS" },
                    ...(i.hsCode
                      ? { commodityCodes: [{ typeCode: "outbound", value: i.hsCode }] }
                      : {}),
                    exportReasonType: "permanent",
                    manufacturerCountry: i.originCountry ?? req.from.country,
                    weight: { netValue: i.weightKg ?? 0.3, grossValue: i.weightKg ?? 0.3 },
                  })),
                  invoice: { number: `INV-${Date.now()}`, date: plannedDate() },
                },
              }
            : {}),
        },
        outputImageProperties: {
          encodingFormat: "pdf",
          imageOptions: [
            { typeCode: "label" },
            ...(international
              ? [{ typeCode: "invoice", isRequested: true, invoiceType: "commercial" }]
              : []),
          ],
        },
      };

      const data = await providerFetch<{
        shipmentTrackingNumber?: string;
        trackingUrl?: string;
        documents?: { imageFormat?: string; content?: string; typeCode?: string }[];
      }>("dhl_express", `${base(ctx)}/shipments`, {
        method: "POST",
        headers: headers(ctx),
        body: JSON.stringify(body),
        timeoutMs: 25_000,
      });
      if (!data.shipmentTrackingNumber) {
        throw new ShippingProviderError("dhl_express", "DHL did not return a tracking number");
      }
      const label = data.documents?.find((d) => d.typeCode === "label") ?? data.documents?.[0];
      return {
        externalId: data.shipmentTrackingNumber,
        carrier: "DHL Express",
        service: productCode,
        trackingNumber: data.shipmentTrackingNumber,
        trackingUrl:
          data.trackingUrl ??
          `https://www.dhl.com/track?tracking-id=${data.shipmentTrackingNumber}`,
        labelPdfBase64: label?.content,
        raw: { shipmentTrackingNumber: data.shipmentTrackingNumber },
      };
    },

    async parseWebhook(_request: Request, bodyText: string): Promise<TrackingUpdate[]> {
      // DHL Shipment Tracking Unified (push) format: { shipments: [ ... ] }.
      const body = JSON.parse(bodyText) as {
        shipments?: {
          id?: string;
          trackingNumber?: string;
          status?: {
            statusCode?: string;
            status?: string;
            description?: string;
            timestamp?: string;
            location?: { address?: { addressLocality?: string; countryCode?: string } };
          };
        }[];
      };
      return (body.shipments ?? [])
        .map((s): TrackingUpdate | null => {
          const trackingNumber = s.trackingNumber ?? s.id;
          if (!trackingNumber) return null;
          const code = (s.status?.statusCode ?? "").toLowerCase();
          return {
            trackingNumber,
            status: DHL_STATUS[code] ?? null,
            description: s.status?.description ?? s.status?.status,
            location: [
              s.status?.location?.address?.addressLocality,
              s.status?.location?.address?.countryCode,
            ]
              .filter(Boolean)
              .join(", "),
            occurredAt: s.status?.timestamp,
            raw: s,
          };
        })
        .filter((u): u is TrackingUpdate => u !== null);
    },
  };
}
