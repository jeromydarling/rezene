import type { Env } from "../types/env";

/**
 * Lulu Print API adapter — platform-brokered print-on-demand for branded
 * lookbooks. Verto holds ONE Lulu account (client key/secret); it prints and
 * drop-ships each copy straight to the shop's recipient, bills Verto wholesale,
 * and Verto marks it up (LULU_MARKUP_PCT) and charges the shop. A no-op until
 * LULU_CLIENT_KEY / LULU_CLIENT_SECRET are set, so unconfigured deploys degrade
 * cleanly (same posture as Stripe / Perplexity).
 *
 * Auth: OAuth2 client-credentials (OpenID Connect) → short-lived bearer token.
 * Everything is against the sandbox host until LULU_ENV = "production".
 *
 * NOTE (confirm at go-live): the exact `pod_package_id` for a full-colour
 * saddle-stitch magazine must be verified against Lulu's live product/package
 * reference or a cost-calc probe before real orders — the SKU grammar below is
 * correct but the specific string is a best guess. It's overridable per call.
 */

export interface LuluAddress {
  name: string;
  street1: string;
  street2?: string;
  city: string;
  state_code?: string;
  postcode: string;
  country_code: string; // ISO-2
  phone_number: string;
  email?: string;
}

export type LuluShippingLevel =
  | "MAIL"
  | "PRIORITY_MAIL"
  | "GROUND_HD"
  | "GROUND_BUS"
  | "GROUND"
  | "EXPEDITED"
  | "EXPRESS";

export const LULU_SHIPPING_LEVELS: { id: LuluShippingLevel; label: string }[] = [
  { id: "MAIL", label: "Mail (cheapest, no tracking)" },
  { id: "PRIORITY_MAIL", label: "Priority mail" },
  { id: "GROUND", label: "Ground" },
  { id: "EXPEDITED", label: "Expedited" },
  { id: "EXPRESS", label: "Express (fastest)" },
];

/**
 * Full-colour saddle-stitch magazine at US Letter (8.5×11). SKU grammar:
 * Trim(0850X1100) + Color(FC) + Quality(STD) + Bind(SS) + Paper(060) +
 * PPI(UW) + Finish(444) + Linen(M) + Foil(NG). CONFIRM against the live API.
 */
export const MAGAZINE_POD_PACKAGE_ID = "0850X1100FCSTDSS060UW444MNG";

export function luluConfigured(env: Env): boolean {
  return Boolean(env.LULU_CLIENT_KEY && env.LULU_CLIENT_SECRET);
}

function isProd(env: Env): boolean {
  return (env.LULU_ENV ?? "sandbox").toLowerCase() === "production";
}
export function luluApiBase(env: Env): string {
  return isProd(env) ? "https://api.lulu.com" : "https://api.sandbox.lulu.com";
}
function luluAuthUrl(env: Env): string {
  return `${luluApiBase(env)}/auth/realms/glasstree/protocol/openid-connect/token`;
}

/** Verto's markup over Lulu wholesale, as a fraction (0.35 = 35%). */
export function luluMarkup(env: Env): number {
  const pct = Number(env.LULU_MARKUP_PCT);
  return Number.isFinite(pct) && pct >= 0 ? pct / 100 : 0.35;
}

/** Apply the platform markup to a wholesale cost, in integer cents. */
export function applyMarkup(costCents: number, markup: number): number {
  return Math.round(costCents * (1 + markup));
}

/**
 * Saddle-stitch page count for a lookbook: cover + opener + N spreads + back,
 * rounded up to a multiple of 4 (Lulu pads otherwise) and clamped to 4–48
 * (the saddle-stitch range; longer books need perfect binding).
 */
export function magazinePageCount(spreadCount: number): number {
  const raw = Math.max(0, spreadCount) + 3;
  const rounded = Math.ceil(raw / 4) * 4;
  return Math.min(48, Math.max(4, rounded));
}

/** Decimal money string ("12.34") → integer cents. */
function toCents(v: unknown): number {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

// Cache the bearer token for the isolate's life (tokens last ~1h).
let tokenCache: { token: string; expiresAt: number } | null = null;

export async function getAccessToken(env: Env): Promise<string> {
  if (!luluConfigured(env)) throw new LuluNotConfiguredError();
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 60_000) return tokenCache.token;
  const basic = btoa(`${env.LULU_CLIENT_KEY}:${env.LULU_CLIENT_SECRET}`);
  const res = await fetch(luluAuthUrl(env), {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "content-type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Lulu auth ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error("Lulu auth returned no token");
  tokenCache = { token: data.access_token, expiresAt: now + (data.expires_in ?? 3600) * 1000 };
  return data.access_token;
}

async function luluFetch(env: Env, path: string, init: RequestInit): Promise<Response> {
  const token = await getAccessToken(env);
  return fetch(`${luluApiBase(env)}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/json", ...(init.headers ?? {}) },
  });
}

export interface LuluCost {
  printCostCents: number;
  shippingCostCents: number;
  taxCents: number;
  totalCents: number;
  currency: string;
}

/**
 * Get Lulu's wholesale quote (print + shipping + tax) BEFORE committing — the
 * authoritative number for pricing. One line item (the lookbook) × quantity.
 */
export async function calculatePrintCost(
  env: Env,
  opts: {
    pageCount: number;
    quantity: number;
    shippingAddress: LuluAddress;
    shippingLevel: LuluShippingLevel;
    podPackageId?: string;
  },
): Promise<LuluCost> {
  const res = await luluFetch(env, "/print-job-cost-calculations/", {
    method: "POST",
    body: JSON.stringify({
      line_items: [
        {
          pod_package_id: opts.podPackageId ?? MAGAZINE_POD_PACKAGE_ID,
          page_count: opts.pageCount,
          quantity: opts.quantity,
        },
      ],
      shipping_address: opts.shippingAddress,
      shipping_level: opts.shippingLevel,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Lulu cost-calc ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    total_cost_incl_tax?: string;
    total_tax?: string;
    currency?: string;
    shipping_cost?: { total_cost_incl_tax?: string; total_cost_excl_tax?: string };
    line_item_costs?: { total_cost_incl_tax?: string; total_cost_excl_tax?: string }[];
  };
  const printCostCents = toCents(
    data.line_item_costs?.reduce((s, l) => s + (parseFloat(l.total_cost_incl_tax ?? l.total_cost_excl_tax ?? "0") || 0), 0),
  );
  const shippingCostCents = toCents(data.shipping_cost?.total_cost_incl_tax ?? data.shipping_cost?.total_cost_excl_tax);
  const taxCents = toCents(data.total_tax);
  const totalCents = toCents(data.total_cost_incl_tax) || printCostCents + shippingCostCents + taxCents;
  return { printCostCents, shippingCostCents, taxCents, totalCents, currency: data.currency ?? "USD" };
}

export interface LuluJob {
  id: string;
  status: string;
  trackingUrls: string[];
  trackingId: string | null;
}

/** Create a print job — Lulu prints and drop-ships to `shippingAddress`. */
export async function createPrintJob(
  env: Env,
  opts: {
    title: string;
    interiorUrl: string;
    coverUrl: string;
    pageCount: number;
    quantity: number;
    shippingAddress: LuluAddress;
    shippingLevel: LuluShippingLevel;
    externalId?: string;
    podPackageId?: string;
  },
): Promise<LuluJob> {
  const res = await luluFetch(env, "/print-jobs/", {
    method: "POST",
    body: JSON.stringify({
      external_id: opts.externalId,
      contact_email: opts.shippingAddress.email,
      line_items: [
        {
          title: opts.title.slice(0, 255),
          quantity: opts.quantity,
          pod_package_id: opts.podPackageId ?? MAGAZINE_POD_PACKAGE_ID,
          printable_normalization: {
            interior: { source_url: opts.interiorUrl },
            cover: { source_url: opts.coverUrl },
          },
        },
      ],
      shipping_address: opts.shippingAddress,
      shipping_level: opts.shippingLevel,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Lulu print-job ${res.status}: ${body.slice(0, 300)}`);
  }
  return parseJob(await res.json());
}

export async function getPrintJob(env: Env, id: string): Promise<LuluJob> {
  const res = await luluFetch(env, `/print-jobs/${encodeURIComponent(id)}/`, { method: "GET" });
  if (!res.ok) throw new Error(`Lulu get-job ${res.status}`);
  return parseJob(await res.json());
}

function parseJob(data: unknown): LuluJob {
  const d = (data ?? {}) as {
    id?: number | string;
    status?: { name?: string } | string;
    line_items?: { tracking_urls?: string[]; tracking_id?: string }[];
  };
  const status = typeof d.status === "string" ? d.status : (d.status?.name ?? "UNKNOWN");
  const li = d.line_items?.[0];
  return {
    id: String(d.id ?? ""),
    status,
    trackingUrls: li?.tracking_urls ?? [],
    trackingId: li?.tracking_id ?? null,
  };
}

/**
 * Verify a Lulu webhook: the `Lulu-HMAC-SHA256` header is a hex HMAC-SHA256 of
 * the raw request body keyed by the API secret. Returns false on any mismatch
 * or missing config — never throws.
 */
export async function verifyLuluWebhook(secret: string, rawBody: string, signature: string): Promise<boolean> {
  try {
    if (!secret || !signature) return false;
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
    const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
    const a = hex.toLowerCase();
    const b = signature.trim().toLowerCase().replace(/^sha256=/, "");
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  } catch {
    return false;
  }
}

export class LuluNotConfiguredError extends Error {
  constructor() {
    super("Lulu print-on-demand is not configured (set LULU_CLIENT_KEY / LULU_CLIENT_SECRET).");
  }
}

/** Test seam: clear the cached token (used by unit tests). */
export function _resetLuluTokenCache(): void {
  tokenCache = null;
}
