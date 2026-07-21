import { Hono } from "hono";
import { z } from "zod";
import { all, first, run, writeAudit } from "../services/db";
import { parseBody } from "../services/validators";
import { requireAdminOnly, requireAdminWrite } from "../middleware/auth";
import { newId, randomToken } from "../utils/id";
import {
  PROVIDER_CATALOG,
  catalogEntry,
  buildRateRequest,
  getDefaultParcel,
  getOriginAddress,
  getPerItemWeightKg,
  getProviderConfig,
  makeAdapter,
  quoteEnabledProviders,
  ShippingProviderError,
  type LabelResult,
  type ProviderConfigRow,
  type ShippingAddress,
} from "../services/shipping";
import type { AppContext } from "../types/env";

export const adminShippingRoutes = new Hono<AppContext>();

const PROVIDER_SLUGS = PROVIDER_CATALOG.map((p) => p.provider);

function parseJsonRecord(value: string | null): Record<string, unknown> {
  try {
    return value ? (JSON.parse(value) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

// ---------- Overview: catalog merged with connection state ----------
adminShippingRoutes.get("/", async (c) => {
  const rows = await all<ProviderConfigRow>(c.var.db, `SELECT * FROM shipping_provider_configs`);
  const byProvider = new Map(rows.map((r) => [r.provider, r]));
  const providers = PROVIDER_CATALOG.map((entry) => {
    const row = byProvider.get(entry.provider);
    const credentials = row ? parseJsonRecord(row.credentials_json) : {};
    return {
      ...entry,
      isEnabled: Boolean(row?.is_enabled),
      useAtCheckout: Boolean(row?.use_at_checkout),
      // Presence booleans only — secret values never leave the worker.
      credentialsSet: Object.fromEntries(
        entry.credentialFields.map((f) => [f.key, Boolean((credentials[f.key] as string)?.length)]),
      ),
      config: row ? parseJsonRecord(row.config_json) : {},
      lastVerifiedAt: row?.last_verified_at ?? null,
      lastVerifyError: row?.last_verify_error ?? null,
      webhookPath:
        entry.supportsWebhooks && row?.webhook_token
          ? c.var.shopSlug
            ? `/api/shipping/webhooks/s/${c.var.shopSlug}/${entry.provider}/${row.webhook_token}`
            : `/api/shipping/webhooks/${entry.provider}/${row.webhook_token}`
          : null,
    };
  });
  const [origin, parcel, perItemWeightKg] = await Promise.all([
    getOriginAddress(c.var.db),
    getDefaultParcel(c.var.db),
    getPerItemWeightKg(c.var.db),
  ]);
  return c.json({ providers, origin, parcel, perItemWeightKg });
});

// ---------- Origin address + parcel defaults ----------
const originSchema = z.object({
  origin: z.object({
    name: z.string().max(120).optional(),
    company: z.string().max(120).optional(),
    line1: z.string().max(200).optional(),
    line2: z.string().max(200).optional(),
    city: z.string().max(120).optional(),
    state: z.string().max(120).optional(),
    postalCode: z.string().max(20).optional(),
    country: z.string().length(2),
    phone: z.string().max(30).optional(),
    email: z.string().email().optional(),
  }),
  parcel: z.object({
    lengthCm: z.number().positive().max(300),
    widthCm: z.number().positive().max(300),
    heightCm: z.number().positive().max(300),
    weightKg: z.number().positive().max(70),
  }),
  perItemWeightKg: z.number().positive().max(20),
});

adminShippingRoutes.put("/origin", requireAdminWrite, async (c) => {
  const body = await parseBody(c, originSchema);
  const entries: [string, string, string][] = [
    ["shipping_origin", JSON.stringify(body.origin), "Ship-from address for rate quotes and labels"],
    ["shipping_default_parcel", JSON.stringify(body.parcel), "Default parcel dimensions/weight"],
    ["shipping_per_item_weight_kg", JSON.stringify(body.perItemWeightKg), "Added weight per cart unit"],
  ];
  for (const [key, value, description] of entries) {
    await run(
      c.var.db,
      `INSERT INTO settings (key, value, description) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      key,
      value,
      description,
    );
  }
  await writeAudit(c.var.db, c.var.userId, "shipping.origin.update", "settings", null, body);
  return c.json({ ok: true });
});

// ---------- Provider connect / configure ----------
const providerUpdateSchema = z.object({
  credentials: z.record(z.string(), z.string().max(500)).optional(),
  config: z.record(z.string(), z.union([z.string().max(500), z.boolean()])).optional(),
  isEnabled: z.boolean().optional(),
  useAtCheckout: z.boolean().optional(),
});

adminShippingRoutes.put("/providers/:provider", requireAdminOnly, async (c) => {
  const provider = c.req.param("provider");
  const entry = catalogEntry(provider);
  if (!entry) return c.json({ error: "Unknown provider" }, 404);
  const body = await parseBody(c, providerUpdateSchema);

  const existing = await getProviderConfig(c.var.db, provider);
  const credentials = existing ? parseJsonRecord(existing.credentials_json) : {};
  // Merge: only provided keys change; empty string clears a stored secret.
  const allowedCredKeys = new Set(entry.credentialFields.map((f) => f.key));
  for (const [key, value] of Object.entries(body.credentials ?? {})) {
    if (!allowedCredKeys.has(key)) continue;
    if (value === "") delete credentials[key];
    else credentials[key] = value;
  }
  const config = existing ? parseJsonRecord(existing.config_json) : {};
  for (const [key, value] of Object.entries(body.config ?? {})) config[key] = value;

  const isEnabled = body.isEnabled ?? Boolean(existing?.is_enabled);
  const useAtCheckout = body.useAtCheckout ?? Boolean(existing?.use_at_checkout);
  const webhookToken = existing?.webhook_token ?? randomToken(24);

  await run(
    c.var.db,
    `INSERT INTO shipping_provider_configs
       (id, provider, is_enabled, use_at_checkout, credentials_json, config_json, webhook_token)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(provider) DO UPDATE SET
       is_enabled = excluded.is_enabled,
       use_at_checkout = excluded.use_at_checkout,
       credentials_json = excluded.credentials_json,
       config_json = excluded.config_json,
       webhook_token = COALESCE(shipping_provider_configs.webhook_token, excluded.webhook_token),
       updated_at = datetime('now')`,
    existing?.id ?? newId("spc"),
    provider,
    isEnabled ? 1 : 0,
    useAtCheckout ? 1 : 0,
    JSON.stringify(credentials),
    JSON.stringify(config),
    webhookToken,
  );
  // Audit which credential keys changed — never their values.
  await writeAudit(c.var.db, c.var.userId, "shipping.provider.update", "shipping_provider", provider, {
    credentialKeys: Object.keys(body.credentials ?? {}),
    config: body.config,
    isEnabled,
    useAtCheckout,
  });
  return c.json({ ok: true });
});

/** Live credential check: quote a canned parcel and store the outcome. */
adminShippingRoutes.post("/providers/:provider/test", requireAdminOnly, async (c) => {
  const provider = c.req.param("provider");
  const row = await getProviderConfig(c.var.db, provider);
  if (!row) return c.json({ error: "Provider not configured yet — save credentials first" }, 404);

  const body = (await c.req.json().catch(() => ({}))) as { country?: string };
  const to: ShippingAddress = {
    country: (body.country ?? "US").toUpperCase().slice(0, 2),
    city: body.country === "GB" ? "London" : "New York",
    postalCode: body.country === "GB" ? "SW1A 1AA" : "10001",
    line1: "1 Test Street",
    name: "Test Recipient",
  };
  const req = await buildRateRequest(c.var.db, {
    to,
    items: [{ description: "Linen shirt", quantity: 1, valueCents: 15000, currency: "USD", hsCode: "620520" }],
    currency: "USD",
    subtotalCents: 15000,
  });
  try {
    const quotes = await makeAdapter(c.var.db, row).getRates(req);
    await run(
      c.var.db,
      `UPDATE shipping_provider_configs
       SET last_verified_at = datetime('now'), last_verify_error = NULL, updated_at = datetime('now')
       WHERE provider = ?`,
      provider,
    );
    return c.json({ ok: true, quotes: quotes.slice(0, 8) });
  } catch (err) {
    const message =
      err instanceof ShippingProviderError ? err.message : "Connection failed — check credentials";
    await run(
      c.var.db,
      `UPDATE shipping_provider_configs
       SET last_verify_error = ?, updated_at = datetime('now') WHERE provider = ?`,
      message.slice(0, 500),
      provider,
    );
    return c.json({ ok: false, error: message }, 502);
  }
});

// ---------- Manual zones & rates ----------
adminShippingRoutes.get("/zones", async (c) => {
  const zones = await all(
    c.var.db,
    `SELECT id, name, countries_json, sort_order, is_active FROM shipping_zones ORDER BY sort_order`,
  );
  const rates = await all(
    c.var.db,
    `SELECT id, zone_id, name, amount_cents, currency, free_over_cents,
            min_transit_days, max_transit_days, sort_order, is_active
     FROM shipping_rates ORDER BY sort_order`,
  );
  return c.json({ zones, rates });
});

const countryList = z
  .array(z.string().length(2))
  .max(120)
  .transform((arr) => arr.map((s) => s.toUpperCase()));
const zoneSchema = z.object({
  name: z.string().min(1).max(80),
  countries: countryList,
  sortOrder: z.number().int().min(0).max(999).optional(),
});

adminShippingRoutes.post("/zones", requireAdminWrite, async (c) => {
  const body = await parseBody(c, zoneSchema);
  const id = newId("zone");
  await run(
    c.var.db,
    `INSERT INTO shipping_zones (id, name, countries_json, sort_order) VALUES (?, ?, ?, ?)`,
    id,
    body.name,
    JSON.stringify(body.countries),
    body.sortOrder ?? 0,
  );
  return c.json({ id }, 201);
});

adminShippingRoutes.patch("/zones/:id", requireAdminWrite, async (c) => {
  const body = await parseBody(c, zoneSchema.partial().extend({ isActive: z.boolean().optional() }));
  const sets: string[] = [];
  const params: unknown[] = [];
  if (body.name !== undefined) (sets.push("name = ?"), params.push(body.name));
  if (body.countries !== undefined)
    (sets.push("countries_json = ?"), params.push(JSON.stringify(body.countries)));
  if (body.sortOrder !== undefined) (sets.push("sort_order = ?"), params.push(body.sortOrder));
  if (body.isActive !== undefined) (sets.push("is_active = ?"), params.push(body.isActive ? 1 : 0));
  if (sets.length === 0) return c.json({ error: "Nothing to update" }, 400);
  await run(c.var.db, `UPDATE shipping_zones SET ${sets.join(", ")} WHERE id = ?`, ...params, c.req.param("id"));
  return c.json({ ok: true });
});

adminShippingRoutes.delete("/zones/:id", requireAdminWrite, async (c) => {
  await run(c.var.db, `DELETE FROM shipping_zones WHERE id = ?`, c.req.param("id"));
  return c.json({ ok: true });
});

const rateSchema = z.object({
  zoneId: z.string().min(1),
  name: z.string().min(1).max(80),
  amountCents: z.number().int().min(0).max(10_000_000),
  currency: z.string().length(3).transform((s) => s.toUpperCase()),
  freeOverCents: z.number().int().min(0).max(100_000_000).nullable().optional(),
  minTransitDays: z.number().int().min(0).max(90).nullable().optional(),
  maxTransitDays: z.number().int().min(0).max(120).nullable().optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
});

adminShippingRoutes.post("/rates", requireAdminWrite, async (c) => {
  const body = await parseBody(c, rateSchema);
  const zone = await first(c.var.db, `SELECT id FROM shipping_zones WHERE id = ?`, body.zoneId);
  if (!zone) return c.json({ error: "Zone not found" }, 404);
  const id = newId("rate");
  await run(
    c.var.db,
    `INSERT INTO shipping_rates
       (id, zone_id, name, amount_cents, currency, free_over_cents, min_transit_days, max_transit_days, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    body.zoneId,
    body.name,
    body.amountCents,
    body.currency,
    body.freeOverCents ?? null,
    body.minTransitDays ?? null,
    body.maxTransitDays ?? null,
    body.sortOrder ?? 0,
  );
  return c.json({ id }, 201);
});

adminShippingRoutes.patch("/rates/:id", requireAdminWrite, async (c) => {
  const body = await parseBody(
    c,
    rateSchema.omit({ zoneId: true }).partial().extend({ isActive: z.boolean().optional() }),
  );
  const fieldMap: Record<string, string> = {
    name: "name",
    amountCents: "amount_cents",
    currency: "currency",
    freeOverCents: "free_over_cents",
    minTransitDays: "min_transit_days",
    maxTransitDays: "max_transit_days",
    sortOrder: "sort_order",
  };
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [key, col] of Object.entries(fieldMap)) {
    if (key in body) {
      sets.push(`${col} = ?`);
      params.push((body as Record<string, unknown>)[key] ?? null);
    }
  }
  if (body.isActive !== undefined) (sets.push("is_active = ?"), params.push(body.isActive ? 1 : 0));
  if (sets.length === 0) return c.json({ error: "Nothing to update" }, 400);
  await run(c.var.db, `UPDATE shipping_rates SET ${sets.join(", ")} WHERE id = ?`, ...params, c.req.param("id"));
  return c.json({ ok: true });
});

adminShippingRoutes.delete("/rates/:id", requireAdminWrite, async (c) => {
  await run(c.var.db, `DELETE FROM shipping_rates WHERE id = ?`, c.req.param("id"));
  return c.json({ ok: true });
});

// ---------- Per-order fulfillment ----------

interface OrderRow {
  id: string;
  currency: string;
  subtotal_cents: number;
  shipping_country: string | null;
  shipping_address_json: string | null;
  email: string | null;
}

async function orderRateRequest(db: D1Database, order: OrderRow) {
  const address = parseJsonRecord(order.shipping_address_json) as {
    name?: string;
    address?: {
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      postal_code?: string;
      country?: string;
    };
  };
  const country = address.address?.country ?? order.shipping_country;
  if (!country) return null;
  const to: ShippingAddress = {
    name: address.name,
    line1: address.address?.line1,
    line2: address.address?.line2,
    city: address.address?.city,
    state: address.address?.state,
    postalCode: address.address?.postal_code,
    country,
    email: order.email ?? undefined,
  };
  const items = await all<{ description: string; quantity: number; unit_price_cents: number; currency: string }>(
    db,
    `SELECT description, quantity, unit_price_cents, currency FROM order_items WHERE order_id = ?`,
    order.id,
  );
  return buildRateRequest(db, {
    to,
    items: items.map((i) => ({
      description: i.description,
      quantity: i.quantity,
      valueCents: i.unit_price_cents,
      currency: i.currency,
      // Chapter 61/62 generic apparel code; per-product HS codes can override later.
      hsCode: "620520",
      originCountry: undefined,
    })),
    currency: order.currency,
    subtotalCents: order.subtotal_cents,
  });
}

adminShippingRoutes.get("/orders/:orderId/rates", async (c) => {
  const order = await first<OrderRow>(
    c.var.db,
    `SELECT id, currency, subtotal_cents, shipping_country, shipping_address_json, email
     FROM orders WHERE id = ?`,
    c.req.param("orderId"),
  );
  if (!order) return c.json({ error: "Order not found" }, 404);
  const req = await orderRateRequest(c.var.db, order);
  if (!req) return c.json({ error: "Order has no shipping address yet" }, 409);
  const outcome = await quoteEnabledProviders(c.var.db, req, { timeoutMs: 20_000 });
  return c.json(outcome);
});

adminShippingRoutes.get("/orders/:orderId/shipments", async (c) => {
  const shipments = await all(
    c.var.db,
    `SELECT id, provider, carrier, service, tracking_number, tracking_url, label_url,
            cost_cents, currency, status, created_at, updated_at
     FROM order_shipments WHERE order_id = ? ORDER BY created_at DESC`,
    c.req.param("orderId"),
  );
  const events =
    shipments.length > 0
      ? await all(
          c.var.db,
          `SELECT shipment_id, status, description, location, occurred_at, created_at
           FROM shipment_events
           WHERE shipment_id IN (${shipments.map(() => "?").join(",")})
           ORDER BY created_at DESC LIMIT 100`,
          ...shipments.map((s) => s.id as string),
        )
      : [];
  return c.json({ shipments, events });
});

const shipmentCreateSchema = z.object({
  provider: z.enum(PROVIDER_SLUGS as [string, ...string[]]),
  // Buying via a provider:
  rateId: z.string().max(200).optional(),
  externalShipmentId: z.string().max(200).optional(),
  service: z.string().max(120).optional(),
  // Manual mark-shipped:
  carrier: z.string().max(120).optional(),
  trackingNumber: z.string().max(120).optional(),
  trackingUrl: z.string().url().max(500).optional(),
});

adminShippingRoutes.post("/orders/:orderId/shipments", requireAdminWrite, async (c) => {
  const orderId = c.req.param("orderId");
  const body = await parseBody(c, shipmentCreateSchema);
  const order = await first<OrderRow & { fulfillment_status: string }>(
    c.var.db,
    `SELECT id, currency, subtotal_cents, shipping_country, shipping_address_json, email, fulfillment_status
     FROM orders WHERE id = ?`,
    orderId,
  );
  if (!order) return c.json({ error: "Order not found" }, 404);

  const id = newId("oship");
  let result: LabelResult;
  let status = "created";

  if (body.provider === "manual" || (body.trackingNumber && !body.rateId)) {
    // Manual fulfillment: record carrier + tracking, mark shipped.
    result = {
      carrier: body.carrier ?? "Manual",
      service: body.service,
      trackingNumber: body.trackingNumber,
      trackingUrl: body.trackingUrl,
    };
    status = body.trackingNumber ? "in_transit" : "created";
  } else {
    const row = await getProviderConfig(c.var.db, body.provider);
    if (!row || !row.is_enabled) return c.json({ error: "Provider is not enabled" }, 409);
    const adapter = makeAdapter(c.var.db, row);
    if (!adapter.createLabel) return c.json({ error: "Provider cannot buy labels" }, 409);
    const req = await orderRateRequest(c.var.db, order);
    if (!req) return c.json({ error: "Order has no shipping address yet" }, 409);
    try {
      result = await adapter.createLabel({
        ...req,
        rateId: body.rateId,
        externalShipmentId: body.externalShipmentId,
        service: body.service,
      });
    } catch (err) {
      const message =
        err instanceof ShippingProviderError ? err.message : "Label purchase failed";
      return c.json({ error: message }, 502);
    }
    status = "label_purchased";
  }

  // Provider returned raw label bytes → persist to R2, serve via admin route.
  let labelUrl = result.labelUrl ?? null;
  let labelR2Key: string | null = null;
  if (!labelUrl && result.labelPdfBase64) {
    labelR2Key = `shipping-labels/${id}.pdf`;
    const bytes = Uint8Array.from(atob(result.labelPdfBase64), (ch) => ch.charCodeAt(0));
    await c.env.FILES.put(labelR2Key, bytes, { httpMetadata: { contentType: "application/pdf" } });
    labelUrl = `/api/admin/shipping/shipments/${id}/label`;
  }

  await run(
    c.var.db,
    `INSERT INTO order_shipments
       (id, order_id, provider, carrier, service, external_id, tracking_number, tracking_url,
        label_url, label_r2_key, cost_cents, currency, status, raw_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    orderId,
    body.provider,
    result.carrier ?? body.carrier ?? null,
    result.service ?? body.service ?? null,
    result.externalId ?? null,
    result.trackingNumber ?? null,
    result.trackingUrl ?? null,
    labelUrl,
    labelR2Key,
    result.costCents ?? null,
    result.currency ?? order.currency,
    status,
    result.raw ? JSON.stringify(result.raw).slice(0, 4000) : null,
  );

  // Fulfillment: label bought → processing; tracking already moving → shipped.
  const nextFulfillment = status === "in_transit" ? "shipped" : "processing";
  const wasOpen = !["shipped", "delivered", "cancelled"].includes(order.fulfillment_status);
  if (wasOpen) {
    await run(
      c.var.db,
      `UPDATE orders SET fulfillment_status = ?, updated_at = datetime('now') WHERE id = ?`,
      nextFulfillment,
      orderId,
    );
  }
  // First transition into "shipped" → tell the customer it's on its way.
  if (wasOpen && nextFulfillment === "shipped") {
    const { notifyShipmentStatus } = await import("../services/transactional-emails");
    await notifyShipmentStatus(c.env, c.var.db, { orderId, kind: "shipped", shopSlug: c.var.shopSlug });
  }
  await writeAudit(c.var.db, c.var.userId, "shipping.shipment.create", "order_shipment", id, {
    orderId,
    provider: body.provider,
    trackingNumber: result.trackingNumber ?? body.trackingNumber ?? null,
  });
  return c.json(
    {
      id,
      trackingNumber: result.trackingNumber ?? body.trackingNumber ?? null,
      trackingUrl: result.trackingUrl ?? body.trackingUrl ?? null,
      labelUrl,
      status,
    },
    201,
  );
});

/** Mark a shipment delivered/cancelled by hand (e.g. no webhook coverage). */
adminShippingRoutes.patch("/shipments/:id", requireAdminWrite, async (c) => {
  const body = await parseBody(
    c,
    z.object({
      status: z.enum(["in_transit", "delivered", "exception", "returned", "cancelled"]),
    }),
  );
  const shipment = await first<{ id: string; order_id: string }>(
    c.var.db,
    `SELECT id, order_id FROM order_shipments WHERE id = ?`,
    c.req.param("id"),
  );
  if (!shipment) return c.json({ error: "Shipment not found" }, 404);
  const order = await first<{ fulfillment_status: string }>(
    c.var.db,
    `SELECT fulfillment_status FROM orders WHERE id = ?`,
    shipment.order_id,
  );
  const prior = order?.fulfillment_status ?? "";
  await run(
    c.var.db,
    `UPDATE order_shipments SET status = ?, updated_at = datetime('now') WHERE id = ?`,
    body.status,
    shipment.id,
  );
  if (body.status === "delivered" || body.status === "in_transit") {
    await run(
      c.var.db,
      `UPDATE orders SET fulfillment_status = ?, updated_at = datetime('now')
       WHERE id = ? AND fulfillment_status != 'cancelled'`,
      body.status === "delivered" ? "delivered" : "shipped",
      shipment.order_id,
    );
    // Notify the customer once per transition (guarding on the prior state).
    const { notifyShipmentStatus } = await import("../services/transactional-emails");
    if (body.status === "delivered" && prior !== "delivered" && prior !== "cancelled") {
      await notifyShipmentStatus(c.env, c.var.db, { orderId: shipment.order_id, kind: "delivered", shopSlug: c.var.shopSlug });
    } else if (body.status === "in_transit" && !["shipped", "delivered", "cancelled"].includes(prior)) {
      await notifyShipmentStatus(c.env, c.var.db, { orderId: shipment.order_id, kind: "shipped", shopSlug: c.var.shopSlug });
    }
  }
  return c.json({ ok: true });
});

/** Stream a stored label PDF from R2 (labels bought via DHL/Sendcloud). */
adminShippingRoutes.get("/shipments/:id/label", async (c) => {
  const row = await first<{ label_r2_key: string | null }>(
    c.var.db,
    `SELECT label_r2_key FROM order_shipments WHERE id = ?`,
    c.req.param("id"),
  );
  if (!row?.label_r2_key) return c.json({ error: "No stored label for this shipment" }, 404);
  const object = await c.env.FILES.get(row.label_r2_key);
  if (!object) return c.json({ error: "Label file missing" }, 404);
  return new Response(object.body as ReadableStream, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="label-${c.req.param("id")}.pdf"`,
    },
  });
});
