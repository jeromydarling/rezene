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

/**
 * Minimal Cloudflare Images binding surface (kept local, same reason as
 * WorkersAi). Used for server-side file thumbnails.
 */
export interface ImagesTransformer {
  transform(options: { width?: number; height?: number; fit?: string }): ImagesTransformer;
  output(options: { format?: string; quality?: number }): Promise<{ response(): Response }>;
}
export interface ImagesBinding {
  input(stream: ReadableStream): ImagesTransformer;
}

export interface Env {
  // Bindings
  DB: D1Database;
  FILES: R2Bucket;
  KV: KVNamespace;
  ASSETS: Fetcher;
  /** Workers AI (optional: absent in very old local dev setups). */
  AI?: WorkersAi;
  /** Cloudflare Images transformations (optional: thumbs fall back to originals). */
  IMAGES?: ImagesBinding;
  /** Per-shop SQLite databases (Durable Objects); primary shop uses DB. */
  SHOP_DB: DurableObjectNamespace;
  /** Cloudflare Email Service send binding (optional in local dev). */
  EMAIL?: SendEmail;

  // Plain vars (wrangler.toml [vars])
  APP_ENV: string;
  APP_URL: string;
  /** "1" once the primary shop has been migrated to its own ShopDatabase DO
   *  (the bound D1 is then platform-only). Flip AFTER running the
   *  /api/admin/platform/migrate-primary copy. */
  PRIMARY_ON_DO?: string;
  /** Sentry DSN (publishable). Empty = error monitoring disabled. */
  SENTRY_DSN?: string;
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
  /**
   * Domain used for maker-message reply addresses, e.g. "makers.verto.style".
   * Its MX must route to this Worker via Cloudflare Email Routing (catch-all →
   * Send to Worker) so factory replies come back in, and it must be onboarded
   * to Email Sending so the outbound `m-<token>@…` messages deliver. Until set,
   * messages are still recorded in-app; the email just doesn't send.
   */
  MAKER_INBOUND_DOMAIN?: string;
  /** The hostname shops point a CNAME at to connect a custom domain. */
  CUSTOM_DOMAIN_TARGET?: string;
  /** GitHub repo (owner/name) whose Actions render promo videos. */
  RENDER_REPO?: string;
  /** Per-video export price in minor units, as a string var. Default 1900. */
  VIDEO_EXPORT_PRICE_CENTS?: string;
  /** Lulu print-on-demand environment: "sandbox" (default) or "production". */
  LULU_ENV?: string;
  /** Verto's markup on Lulu wholesale (print + shipping), as a percent string. Default "35". */
  LULU_MARKUP_PCT?: string;
  /** HQ marketing sender address (falls back to BUYER_EMAIL_FROM). */
  MARKETING_EMAIL_FROM?: string;
  /** Sends per 5-minute drain tick (default "10", capped at 50). */
  MARKETING_BATCH_PER_TICK?: string;
  /** Postal address for the CAN-SPAM footer on marketing email. */
  MARKETING_POSTAL_ADDRESS?: string;

  // Secrets
  /** Lulu Print API OAuth2 client key + secret (platform-brokered account). */
  LULU_CLIENT_KEY?: string;
  LULU_CLIENT_SECRET?: string;
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
  /**
   * Cloudflare for SaaS: API token (Zone > SSL and Certificates > Edit +
   * Custom Hostnames > Edit on the platform zone) + the zone id. Present →
   * merchant custom domains activate fully automatically (hostname
   * registered, certificate issued, registry flipped). Absent → the manual
   * HQ-notification flow.
   */
  CF_API_TOKEN?: string;
  CF_ZONE_ID?: string;
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
  /** Per-shop daily cap on Design Studio Flux generation batches (default 40). */
  DESIGN_DAILY_LIMIT?: string;
  COMPANION_DAILY_LIMIT?: string;
  DIRECTORY_PUBLIC?: string;
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
