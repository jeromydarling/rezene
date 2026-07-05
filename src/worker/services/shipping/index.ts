import { all, first } from "../db";
import { manualAdapter } from "./adapters/manual";
import { dhlAdapter } from "./adapters/dhl";
import { shippoAdapter } from "./adapters/shippo";
import { easypostAdapter } from "./adapters/easypost";
import { shipengineAdapter } from "./adapters/shipengine";
import { sendcloudAdapter } from "./adapters/sendcloud";
import { easyshipAdapter } from "./adapters/easyship";
import type {
  ParcelSpec,
  ProviderContext,
  ProviderSlug,
  RateQuote,
  RateRequest,
  ShipmentItem,
  ShippingAdapter,
  ShippingAddress,
} from "./types";

export * from "./types";
export { PROVIDER_CATALOG, catalogEntry } from "./catalog";

const FACTORIES: Record<ProviderSlug, (ctx: ProviderContext) => ShippingAdapter> = {
  manual: manualAdapter,
  dhl_express: dhlAdapter,
  shippo: shippoAdapter,
  easypost: easypostAdapter,
  shipengine: shipengineAdapter,
  sendcloud: sendcloudAdapter,
  easyship: easyshipAdapter,
};

export interface ProviderConfigRow {
  id: string;
  provider: ProviderSlug;
  is_enabled: number;
  use_at_checkout: number;
  credentials_json: string;
  config_json: string;
  webhook_token: string | null;
  last_verified_at: string | null;
  last_verify_error: string | null;
}

export function makeAdapter(db: D1Database, row: ProviderConfigRow): ShippingAdapter {
  const ctx: ProviderContext = {
    credentials: safeJson(row.credentials_json) as Record<string, string>,
    config: safeJson(row.config_json) as Record<string, unknown>,
    db,
  };
  return FACTORIES[row.provider](ctx);
}

function safeJson(value: string | null): unknown {
  try {
    return value ? JSON.parse(value) : {};
  } catch {
    return {};
  }
}

export async function getProviderConfig(
  db: D1Database,
  provider: string,
): Promise<ProviderConfigRow | null> {
  return first<ProviderConfigRow>(
    db,
    `SELECT * FROM shipping_provider_configs WHERE provider = ?`,
    provider,
  );
}

export async function getEnabledProviders(
  db: D1Database,
  { checkoutOnly = false } = {},
): Promise<ProviderConfigRow[]> {
  return all<ProviderConfigRow>(
    db,
    `SELECT * FROM shipping_provider_configs WHERE is_enabled = 1
     ${checkoutOnly ? "AND use_at_checkout = 1" : ""}`,
  );
}

// ---------- Origin / parcel defaults (settings table) ----------

const DEFAULT_ORIGIN: ShippingAddress = { country: "MA", city: "Casablanca" };
const DEFAULT_PARCEL: ParcelSpec = { lengthCm: 35, widthCm: 27, heightCm: 6, weightKg: 0.8 };
const DEFAULT_PER_ITEM_KG = 0.4;

async function settingJson<T>(db: D1Database, key: string): Promise<T | null> {
  const row = await first<{ value: string }>(db, `SELECT value FROM settings WHERE key = ?`, key);
  if (!row) return null;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return null;
  }
}

export async function getOriginAddress(db: D1Database): Promise<ShippingAddress> {
  const stored = await settingJson<Partial<ShippingAddress>>(db, "shipping_origin");
  return { ...DEFAULT_ORIGIN, ...(stored ?? {}) };
}

export async function getDefaultParcel(db: D1Database): Promise<ParcelSpec> {
  const stored = await settingJson<Partial<ParcelSpec>>(db, "shipping_default_parcel");
  return { ...DEFAULT_PARCEL, ...(stored ?? {}) };
}

export async function getPerItemWeightKg(db: D1Database): Promise<number> {
  const stored = await settingJson<number>(db, "shipping_per_item_weight_kg");
  return typeof stored === "number" && stored > 0 ? stored : DEFAULT_PER_ITEM_KG;
}

/**
 * Assemble a rate request from cart/order lines. Weight is a heuristic —
 * parcel base weight + a configurable per-item weight — until per-product
 * weights exist in the catalog.
 */
export async function buildRateRequest(
  db: D1Database,
  args: {
    to: ShippingAddress;
    items: ShipmentItem[];
    currency: string;
    subtotalCents: number;
  },
): Promise<RateRequest> {
  const [from, parcel, perItemKg] = await Promise.all([
    getOriginAddress(db),
    getDefaultParcel(db),
    getPerItemWeightKg(db),
  ]);
  const units = args.items.reduce((sum, i) => sum + i.quantity, 0);
  return {
    from,
    to: args.to,
    parcel: { ...parcel, weightKg: +(parcel.weightKg + Math.max(0, units - 1) * perItemKg).toFixed(2) },
    items: args.items.map((i) => ({ ...i, weightKg: i.weightKg ?? perItemKg })),
    currency: args.currency,
    subtotalCents: args.subtotalCents,
  };
}

export interface QuoteOutcome {
  quotes: RateQuote[];
  errors: { provider: ProviderSlug; message: string }[];
}

/**
 * Fan a rate request out to every enabled provider. Each provider gets a
 * hard time budget so one slow carrier can't stall checkout; failures are
 * collected, never thrown — a shop with three providers configured should
 * still see rates when one of them is down.
 */
export async function quoteEnabledProviders(
  db: D1Database,
  req: RateRequest,
  { checkoutOnly = false, timeoutMs = 10_000 } = {},
): Promise<QuoteOutcome> {
  const rows = await getEnabledProviders(db, { checkoutOnly });
  const outcomes = await Promise.all(
    rows.map(async (row): Promise<{ quotes?: RateQuote[]; error?: { provider: ProviderSlug; message: string } }> => {
      try {
        const quotes = await Promise.race([
          makeAdapter(db, row).getRates(req),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("timed out")), timeoutMs),
          ),
        ]);
        return { quotes };
      } catch (err) {
        return {
          error: { provider: row.provider, message: err instanceof Error ? err.message : String(err) },
        };
      }
    }),
  );
  const quotes = outcomes
    .flatMap((o) => o.quotes ?? [])
    .sort((a, b) => a.amountCents - b.amountCents);
  const errors = outcomes.flatMap((o) => (o.error ? [o.error] : []));
  return { quotes, errors };
}
