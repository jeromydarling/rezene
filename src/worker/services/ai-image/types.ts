/**
 * Pluggable AI-image provider layer for the Fitting Room / Look Studio.
 *
 * One interface, several backends: fal.ai (primary — unlocks best-in-class
 * try-on AND reference-conditioned generation through a single key), FASHN
 * (direct try-on), and on-platform Cloudflare Workers AI FLUX (zero-key
 * fallback for generation). A router picks the best configured provider per
 * capability, so the feature degrades gracefully instead of crashing when a
 * key is absent.
 */
import type { Env } from "../../types/env";

/** An image passed to a provider: either a fetchable URL or raw bytes. */
export type ImageInput = { kind: "url"; url: string } | { kind: "bytes"; bytes: Uint8Array; contentType: string };

export interface GenerateInput {
  prompt: string;
  /** Reference/mood-board images to condition the style/subject on (0–6). */
  references?: ImageInput[];
  count?: number;
  /** e.g. "3:4" — providers that support it frame full-body fashion better. */
  aspectRatio?: string;
}

export type GarmentCategory = "tops" | "bottoms" | "one-pieces" | "auto";

export interface TryOnInput {
  /** Photo of the person/model to dress. */
  modelImage: ImageInput;
  /** Photo of the garment (flat lay or worn). */
  garmentImage: ImageInput;
  category?: GarmentCategory;
}

export interface ImageResult {
  bytes: Uint8Array;
  contentType: string;
  /** Provider/model that produced it, for provenance + debugging. */
  providerModel: string;
}

export interface ProviderCapabilities {
  generate: boolean;
  /** Reference-image-conditioned generation (mood board → garment). */
  referenceGen: boolean;
  /** Photo-real virtual try-on (garment photo → on a model). */
  tryOn: boolean;
}

export interface ImageProvider {
  id: string;
  label: string;
  capabilities: ProviderCapabilities;
  configured(env: Env): boolean;
  generate?(env: Env, input: GenerateInput): Promise<ImageResult[]>;
  tryOn?(env: Env, input: TryOnInput): Promise<ImageResult>;
}

/** Thrown when no configured provider can serve a requested capability. */
export class NoProviderError extends Error {
  constructor(capability: string) {
    super(`No AI-image provider is configured for ${capability}.`);
    this.name = "NoProviderError";
  }
}

/** Thrown for upstream/provider failures (surfaced as a clear 5xx). */
export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status = 502,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
