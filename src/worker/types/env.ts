/**
 * Worker environment bindings and secrets.
 *
 * Bindings are declared in wrangler.toml. Secrets are set with
 * `wrangler secret put <NAME>` (production) or .dev.vars (local dev)
 * and are intentionally optional here: routes that need them must
 * check presence and fail with a clear 503 rather than crash.
 */
export interface Env {
  // Bindings
  DB: D1Database;
  FILES: R2Bucket;
  KV: KVNamespace;
  ASSETS: Fetcher;

  // Plain vars (wrangler.toml [vars])
  APP_ENV: string;
  APP_URL: string;
  BRAND_NAME: string;
  BRAND_SLUG: string;
  R2_PUBLIC_BASE_URL: string;

  // Secrets
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_PUBLISHABLE_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  SESSION_SECRET?: string;
  ADMIN_EMAIL?: string;
  ADMIN_INITIAL_PASSWORD?: string;
}

/** Hono context variables set by middleware. */
export interface AppVariables {
  userId: string | null;
  userEmail: string | null;
  roles: string[];
  sessionId: string | null;
}

export type AppContext = { Bindings: Env; Variables: AppVariables };
