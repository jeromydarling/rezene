/**
 * Worker environment bindings and secrets.
 *
 * Bindings are declared in wrangler.toml. Secrets are set with
 * `wrangler secret put <NAME>` (production) or .dev.vars (local dev)
 * and are intentionally optional here: routes that need them must
 * check presence and fail with a clear 503 rather than crash.
 */
/**
 * Minimal Workers AI surface (kept local so we don't depend on a specific
 * workers-types version). Used for content translation.
 */
export interface WorkersAi {
  run(model: string, inputs: Record<string, unknown>): Promise<unknown>;
}

export interface Env {
  // Bindings
  DB: D1Database;
  FILES: R2Bucket;
  KV: KVNamespace;
  ASSETS: Fetcher;
  /** Workers AI (optional: absent in very old local dev setups). */
  AI?: WorkersAi;
  /** Per-shop SQLite databases (Durable Objects); primary shop uses DB. */
  SHOP_DB: DurableObjectNamespace;
  /** Cloudflare Email Service send binding (optional in local dev). */
  EMAIL?: SendEmail;

  // Plain vars (wrangler.toml [vars])
  APP_ENV: string;
  APP_URL: string;
  BRAND_NAME: string;
  BRAND_SLUG: string;
  R2_PUBLIC_BASE_URL: string;
  NOTIFY_EMAIL_FROM: string;
  NOTIFY_EMAIL_TO: string;
  /**
   * Sender for buyer email (order confirmations), e.g. orders@brand.com.
   * Must be on a domain onboarded to Cloudflare Email Sending — only then
   * can the EMAIL binding reach arbitrary recipients.
   */
  BUYER_EMAIL_FROM: string;
  /** The hostname shops point a CNAME at to connect a custom domain. */
  CUSTOM_DOMAIN_TARGET?: string;
  /** GitHub repo (owner/name) whose Actions render promo videos. */
  RENDER_REPO?: string;
  /** Per-video export price in minor units, as a string var. Default 1900. */
  VIDEO_EXPORT_PRICE_CENTS?: string;

  // Secrets
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_PUBLISHABLE_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  SESSION_SECRET?: string;
  ADMIN_EMAIL?: string;
  ADMIN_INITIAL_PASSWORD?: string;
  /** Comma-separated emails granted Verto HQ (SuperAdmin) access. The
   *  bootstrap ADMIN_EMAIL is always included. */
  SUPERADMIN_EMAILS?: string;
  /** Perplexity API key for the Sourcing (find-a-maker) deep research. */
  PERPLEXITY_API_KEY?: string;
  /** Per-shop daily cap on paid Perplexity research calls (default 40). */
  PERPLEXITY_DAILY_LIMIT?: string;
  /** Shared secret the render worker (GitHub Action) presents on callbacks. */
  RENDER_CALLBACK_SECRET?: string;
  /** GitHub token (repo scope) used to trigger the render workflow. */
  GITHUB_DISPATCH_TOKEN?: string;
  /**
   * fal.ai key — the primary gateway for the Fitting Room's best-in-class image
   * work: virtual try-on (FASHN/Kolors) and reference-conditioned generation
   * (nano-banana / FLUX.2 pro). Absent → the Fitting Room falls back to
   * on-platform Workers AI FLUX for generation and disables try-on.
   */
  FAL_KEY?: string;
  /** FASHN direct API key (alternative try-on provider if fal is not set). */
  FASHN_API_KEY?: string;
  /**
   * Higgsfield REST API key as "KEY_ID:KEY_SECRET". A stopgap generation engine
   * (nano-banana) for the Fitting Room until fal is funded: powers "generate on
   * a model" and mood-board style-matching, plus a best-effort image-edit
   * try-on. Real try-on prefers fal/FASHN when configured.
   */
  HIGGSFIELD_API_KEY?: string;
  /** Per-shop daily cap on paid Fitting Room renders (default 30). */
  FITTING_DAILY_LIMIT?: string;
}

/** Hono context variables set by middleware. */
export interface AppVariables {
  userId: string | null;
  userEmail: string | null;
  roles: string[];
  sessionId: string | null;
  /** Tenant context (set by tenantMiddleware before anything else). */
  shopId: string;
  shopSlug: string | null;
  /** The resolved shop's database: bound D1 for the primary shop, a
   *  ShopDatabase Durable Object facade for every other shop. */
  db: D1Database;
}

export type AppContext = { Bindings: Env; Variables: AppVariables };
