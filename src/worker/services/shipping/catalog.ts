import type { ProviderSlug } from "./types";

/**
 * Provider catalog — everything the admin UI needs to render a "connect"
 * card without hardcoding provider knowledge client-side. Capabilities
 * drive which buttons appear; credential fields drive the connect form.
 */

export interface CredentialField {
  key: string;
  label: string;
  /** Rendered as a password input when true. */
  secret: boolean;
  placeholder?: string;
}

export interface ConfigField {
  key: string;
  label: string;
  kind: "text" | "boolean";
  hint?: string;
}

export type ProviderCapability = "rates" | "labels" | "tracking" | "customs";

export interface ProviderCatalogEntry {
  provider: ProviderSlug;
  name: string;
  blurb: string;
  bestFor: string;
  capabilities: ProviderCapability[];
  credentialFields: CredentialField[];
  configFields: ConfigField[];
  docsUrl: string | null;
  /** Providers that push tracking updates get a webhook URL surfaced. */
  supportsWebhooks: boolean;
}

export const PROVIDER_CATALOG: ProviderCatalogEntry[] = [
  {
    provider: "manual",
    name: "Manual rate table",
    blurb:
      "Flat rates you define per destination zone — no carrier account or API key needed. Always available as a fallback.",
    bestFor: "Getting started, or predictable flat-rate shipping.",
    capabilities: ["rates"],
    credentialFields: [],
    configFields: [],
    docsUrl: null,
    supportsWebhooks: false,
  },
  {
    provider: "dhl_express",
    name: "DHL Express (MyDHL API)",
    blurb:
      "Carrier-direct: live express rates, labels with electronic customs paperwork (Paperless Trade), and push tracking. Needs a DHL Express account number.",
    bestFor: "International express from any origin country DHL serves.",
    capabilities: ["rates", "labels", "tracking", "customs"],
    credentialFields: [
      { key: "apiKey", label: "API key", secret: false },
      { key: "apiSecret", label: "API secret", secret: true },
      { key: "accountNumber", label: "DHL account number", secret: false, placeholder: "9 digits" },
    ],
    configFields: [
      {
        key: "sandbox",
        label: "Sandbox mode",
        kind: "boolean",
        hint: "Use DHL's test environment until production credentials are issued.",
      },
    ],
    docsUrl: "https://developer.dhl.com/api-reference/dhl-express-mydhl-api",
    supportsWebhooks: true,
  },
  {
    provider: "shippo",
    name: "Shippo",
    blurb:
      "Aggregator: rate-shop 40+ carriers, buy labels, auto-generated customs forms, tracking webhooks. Connect your own carrier accounts or use Shippo's.",
    bestFor: "Lowest-cost aggregator entry point (pay-as-you-go per label).",
    capabilities: ["rates", "labels", "tracking", "customs"],
    credentialFields: [{ key: "apiToken", label: "API token", secret: true }],
    configFields: [],
    docsUrl: "https://docs.goshippo.com/",
    supportsWebhooks: true,
  },
  {
    provider: "easypost",
    name: "EasyPost",
    blurb:
      "Aggregator: 100+ carriers, labels, customs docs in one call, HMAC-signed tracking webhooks. Connect your own carrier accounts or use EasyPost's.",
    bestFor: "Multi-carrier rate shopping with the most robust webhooks.",
    capabilities: ["rates", "labels", "tracking", "customs"],
    credentialFields: [
      { key: "apiKey", label: "API key", secret: true },
      {
        key: "webhookSecret",
        label: "Webhook secret (optional)",
        secret: true,
        placeholder: "Enables HMAC verification of tracking events",
      },
    ],
    configFields: [],
    docsUrl: "https://docs.easypost.com/",
    supportsWebhooks: true,
  },
  {
    provider: "shipengine",
    name: "ShipEngine (ShipStation API)",
    blurb:
      "Aggregator: rate shopping across connected carriers, labels with electronic customs submission, tracking webhooks.",
    bestFor: "Shops already on ShipStation, or higher-volume multi-carrier.",
    capabilities: ["rates", "labels", "tracking", "customs"],
    credentialFields: [{ key: "apiKey", label: "API key", secret: true }],
    configFields: [],
    docsUrl: "https://www.shipengine.com/docs/",
    supportsWebhooks: true,
  },
  {
    provider: "sendcloud",
    name: "Sendcloud",
    blurb:
      "Europe's shipping platform: 160+ EU carriers (DPD, Colissimo, DHL Parcel, Evri…), labels, customs docs, tracking. Ships from 8 EU countries + UK only.",
    bestFor: "EU/UK fulfillment — e.g. shipping from a European 3PL hub.",
    capabilities: ["rates", "labels", "tracking", "customs"],
    credentialFields: [
      { key: "publicKey", label: "Public key", secret: false },
      { key: "secretKey", label: "Secret key", secret: true },
    ],
    configFields: [],
    docsUrl: "https://sendcloud.dev/",
    supportsWebhooks: true,
  },
  {
    provider: "easyship",
    name: "Easyship",
    blurb:
      "Aggregator with the deepest cross-border tooling: 550+ couriers, landed-cost/duty estimates, customs docs, tracking.",
    bestFor: "International-heavy shops wanting duty-aware rate quotes.",
    capabilities: ["rates", "labels", "tracking", "customs"],
    credentialFields: [{ key: "accessToken", label: "Access token", secret: true }],
    configFields: [],
    docsUrl: "https://developers.easyship.com/",
    supportsWebhooks: true,
  },
];

export function catalogEntry(provider: string): ProviderCatalogEntry | undefined {
  return PROVIDER_CATALOG.find((p) => p.provider === provider);
}
