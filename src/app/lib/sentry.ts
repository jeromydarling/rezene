/**
 * Client-side error monitoring. Mirrors the worker's Sentry setup so browser
 * crashes and failed API calls land in the same project the worker already
 * reports to. A no-op until the edge injects a DSN into window.__VERTO__
 * (the DSN is a publishable identifier, not a secret), so local/dev builds and
 * any deploy without SENTRY_DSN stay silent instead of erroring.
 */
import * as Sentry from "@sentry/react";

let initialized = false;

/** Initialise the browser SDK once, from the edge-injected config. Safe to call always. */
export function initSentry(): void {
  if (initialized) return;
  const cfg = typeof window !== "undefined" ? window.__VERTO__ : undefined;
  const dsn = cfg?.sentryDsn;
  if (!dsn) return; // unconfigured — stay a no-op
  Sentry.init({
    dsn,
    environment: cfg?.env || "unknown",
    // Errors are the point; keep tracing light.
    tracesSampleRate: 0.05,
    sendDefaultPii: false,
  });
  // Tag every event with the shop so HQ can see which tenant hit the error.
  if (cfg?.shop?.slug) Sentry.setTag("shop", cfg.shop.slug);
  initialized = true;
}

/**
 * Report an exception to Sentry with extra context. Falls back to console when
 * Sentry isn't configured, so nothing is ever silently dropped in dev.
 */
export function captureError(error: unknown, context?: Record<string, unknown>): void {
  if (initialized) {
    Sentry.captureException(error, context ? { extra: context } : undefined);
  } else {
    // eslint-disable-next-line no-console
    console.error("[captureError]", error, context);
  }
}

/** Re-export for the app-wide error boundary in main.tsx. */
export { Sentry };
