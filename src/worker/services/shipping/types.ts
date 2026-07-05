/**
 * Core contracts for the pluggable shipping layer.
 *
 * Every provider (carrier-direct or aggregator) is an adapter behind the
 * same three operations: quote rates, buy a label, parse a tracking
 * webhook. Providers that can't do one of them simply omit it — the admin
 * UI reads capabilities from the catalog, not from the adapter shape.
 */

export type ProviderSlug =
  | "manual"
  | "dhl_express"
  | "shippo"
  | "easypost"
  | "shipengine"
  | "sendcloud"
  | "easyship";

export type ShipmentStatus =
  | "created"
  | "label_purchased"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "exception"
  | "returned"
  | "cancelled";

export interface ShippingAddress {
  name?: string;
  company?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  /** ISO-3166 alpha-2, required everywhere. */
  country: string;
  phone?: string;
  email?: string;
}

/** Metric everywhere; adapters convert to their provider's units. */
export interface ParcelSpec {
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  weightKg: number;
}

export interface ShipmentItem {
  description: string;
  quantity: number;
  /** Unit value in minor units. */
  valueCents: number;
  currency: string;
  hsCode?: string;
  originCountry?: string;
  weightKg?: number;
}

export interface RateRequest {
  from: ShippingAddress;
  to: ShippingAddress;
  parcel: ParcelSpec;
  items: ShipmentItem[];
  currency: string;
  subtotalCents: number;
}

export interface RateQuote {
  provider: ProviderSlug;
  /** Provider rate id — pass back to createLabel to buy this exact rate. */
  rateId?: string;
  /** Some providers scope rate ids to a shipment object (EasyPost, Shippo). */
  externalShipmentId?: string;
  carrier: string;
  service: string;
  amountCents: number;
  currency: string;
  minDays?: number | null;
  maxDays?: number | null;
}

export interface LabelRequest extends RateRequest {
  rateId?: string;
  externalShipmentId?: string;
  service?: string;
}

export interface LabelResult {
  externalId?: string;
  carrier?: string;
  service?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  /** Direct URL when the provider hosts the label. */
  labelUrl?: string;
  /** Base64 PDF when the provider returns bytes — the route stores it in R2. */
  labelPdfBase64?: string;
  costCents?: number;
  currency?: string;
  raw?: unknown;
}

export interface TrackingUpdate {
  trackingNumber: string;
  status: ShipmentStatus | null;
  description?: string;
  location?: string;
  occurredAt?: string;
  raw?: unknown;
}

export interface ProviderContext {
  credentials: Record<string, string>;
  config: Record<string, unknown>;
  db: D1Database;
}

export interface ShippingAdapter {
  getRates(req: RateRequest): Promise<RateQuote[]>;
  createLabel?(req: LabelRequest): Promise<LabelResult>;
  /** Parse an inbound tracking webhook; may verify signatures. */
  parseWebhook?(request: Request, bodyText: string): Promise<TrackingUpdate[]>;
}

/** Provider errors carry the upstream message so admins can act on it. */
export class ShippingProviderError extends Error {
  constructor(
    public provider: ProviderSlug,
    message: string,
  ) {
    super(message);
  }
}

/** JSON fetch with a hard timeout — a slow carrier must never stall checkout. */
export async function providerFetch<T>(
  provider: ProviderSlug,
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  const { timeoutMs = 12_000, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(url, { ...rest, signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    const reason = err instanceof Error && err.name === "TimeoutError" ? "timed out" : String(err);
    throw new ShippingProviderError(provider, `Request to ${new URL(url).host} ${reason}`);
  }
  const text = await res.text();
  if (!res.ok) {
    throw new ShippingProviderError(
      provider,
      `${res.status} from ${new URL(url).host}: ${text.slice(0, 400)}`,
    );
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ShippingProviderError(provider, `Non-JSON response from ${new URL(url).host}`);
  }
}

export function toCents(amount: string | number | null | undefined): number {
  const n = typeof amount === "string" ? parseFloat(amount) : (amount ?? 0);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export function centsToMajor(cents: number): number {
  return Math.round(cents) / 100;
}
