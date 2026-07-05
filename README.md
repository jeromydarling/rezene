# Maison Atlantique — Brand OS

A Cloudflare-native operating system for a Morocco-produced clothing brand:
premium editorial storefront, Stripe-powered DTC commerce, and an internal
admin app covering styles, SKUs, tech packs, production, suppliers, costing,
duties, AI concepting, and 3D simulation bridges.

Business context lives in [`BUSINESS_PLAN_CONTEXT.md`](./BUSINESS_PLAN_CONTEXT.md);
the build brief in [`CLAUDE_CODE_PROMPT.md`](./CLAUDE_CODE_PROMPT.md).
The brand name is a placeholder — it is data (Settings → brand), not code.

## Verto — the platform layer

This app now serves two things from one Worker:

- **`/` — Verto**, the platform's marketing site (features, pricing,
  signup). Signups reserve a slug as a `pending` row in the `shops` table
  and notify the founder; provisioning/tenant scoping is the next phase.
- **`/<shop-slug>` — a shop.** Each active row in `shops` routes its slug
  to the storefront + admin (Rezene is shop #1 at `/rezene` — same data,
  same login, only the URL prefix changed; legacy paths 301-redirect).
  `shops.custom_domain` is already consulted first during resolution, so
  putting a customer's CNAME on the Worker later is just DNS + one column.

The edge injects `window.__VERTO__` (the resolved shop or null) into the
document shell; the SPA boots the Verto marketing app or the shop app
under a router basename accordingly.

**Tenant isolation is physical.** Every non-primary shop's data lives in
its own SQLite Durable Object (`ShopDatabase`), bootstrapped from the
embedded schema migrations (`scripts/embed-migrations.mjs` — rerun after
adding a migration; it runs on every build). The tenant middleware
resolves the shop (custom domain → `X-Verto-Shop` header → primary) and
hangs the right database on the request before authentication runs, so a
session token only exists in its own shop's database. The primary shop
(Rezene) stays on the bound D1. Provisioning (Admin → System → Verto
Shops, primary shop only) turns a pending signup into a live shop: schema
bootstrap, neutral seed (roles, settings, block homepage, legal drafts),
owner admin account with a one-time-shown generated password, credentials
emailed, slug routing instantly. Suspending a shop stops its routing.

Platform-wide for now (per-shop in the Stripe Connect phase): Stripe
keys, Anthropic key, email sending, R2 bucket (rows per shop DB keep
objects private per tenant).

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                       Cloudflare Worker                        │
│                                                                │
│  Static assets (Vite build, SPA fallback)                      │
│   ├── /            public editorial site (React 19)           │
│   └── /admin       internal brand OS (React 19, RBAC-gated)   │
│                                                                │
│  Hono API (run_worker_first: /api/*)                           │
│   ├── /api/public/*    catalog, content, leads, analytics,    │
│   │                    checkout (Stripe Checkout Sessions)    │
│   ├── /api/stripe/*    signature-verified webhooks            │
│   ├── /api/auth/*      session login (PBKDF2 + hashed tokens) │
│   └── /api/admin/*     20 modules, role-gated (admin/ops/     │
│                        viewer), Zod-validated, audit-logged   │
│                                                                │
│  Bindings                                                      │
│   ├── D1  (DB)     ~65-table normalized domain schema         │
│   ├── R2  (FILES)  sketches, patterns, CLO files, exports     │
│   ├── KV  (KV)     rate limiting, cache/config adjuncts       │
│   └── Cron         daily ops sweep (late-task risk flags)     │
│                                                                │
│  External (server-side only, keys via secrets)                 │
│   ├── Stripe       Checkout, webhooks, customers, refunds     │
│   └── Anthropic    tech pack AI assist (claude-sonnet-5)      │
└────────────────────────────────────────────────────────────────┘
```

Deployment model: **Workers static assets** via `@cloudflare/vite-plugin`
(the current best-supported full-stack approach — Pages-style SPA routing
with a first-class Worker). One `npm run dev` serves both app and API.

## Local development

```bash
npm install

# Local secrets (never committed)
cp .dev.vars.example .dev.vars     # fill in what you have; all optional for dev

# Apply migrations to the local D1 (SQLite in .wrangler/)
npm run db:migrate:local

# Single dev server: Vite + Worker in workerd
npm run dev                        # http://localhost:5173
```

Checks and builds:

```bash
npm run check     # tsc project references (app + worker)
npm run build     # type-check + vite build (client + worker bundle)
npm run preview   # serve the production build locally
```

### Admin seed login

No user accounts are seeded (no secrets in migrations). The first login
**bootstraps** the founder account: if the `users` table is empty and the
submitted credentials equal `ADMIN_EMAIL` / `ADMIN_INITIAL_PASSWORD` (from
`.dev.vars` locally or Worker secrets in production), that user is created
with the `admin` role. Sign in at `/admin/login`, then rotate the password.
Roles: `admin` (everything), `ops` (read/write modules), `viewer` (read-only).

## Deployment — nothing to run locally

The Cloudflare resources are **already provisioned** in the account and
their real ids are committed in `wrangler.toml`:

| Resource | Name | Id |
|----------|------|----|
| D1 | `maison-atlantique-db` | `efe744ff-e3dd-41a4-b61e-b93cd79e2139` |
| KV | `maison-atlantique-kv` | `79bcbb9c583f4ad0b90f715897bd8d2e` |
| R2 | `maison-atlantique-files` | — |

Both migrations are **already applied to the remote D1** (schema + seed
data, verified against local), with wrangler migration bookkeeping in
place — so the CI migration step is a safe no-op until a new migration
lands.

The Worker itself deploys through **GitHub Actions**
(`.github/workflows/deploy.yml`, runs on push to `main` or manually via
the Actions tab → Deploy → Run workflow). One-time repository setup, in
GitHub → Settings → Secrets and variables → Actions:

1. `CLOUDFLARE_API_TOKEN` *(required)* — create at dash.cloudflare.com →
   My Profile → API Tokens, starting from the "Edit Cloudflare Workers"
   template. Required account-scoped permissions: Workers Scripts:Edit,
   D1:Edit, Workers KV Storage:Edit, Workers R2 Storage:Edit, Account
   Settings:Read. Restrict Account Resources to this account. If a deploy
   ever fails on the email binding, add Email Routing Addresses:Read.
2. `CLOUDFLARE_ACCOUNT_ID` *(recommended)* — from the Cloudflare
   dashboard sidebar.
3. Optionally add any of `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
   `STRIPE_PUBLISHABLE_KEY`, `ANTHROPIC_API_KEY`, `SESSION_SECRET`,
   `ADMIN_EMAIL`, `ADMIN_INITIAL_PASSWORD` — the workflow syncs whichever
   exist to the Worker with `wrangler secret put` after each deploy.

A separate CI workflow (`.github/workflows/ci.yml`) type-checks, builds,
and validates migrations on every PR and non-main push.

After the first deploy, update `APP_URL` in `wrangler.toml` `[vars]` to
the deployed URL (used for Stripe success/cancel redirects in production).

For internal routes in production, additionally fronting `/admin` and
`/api/admin` with **Cloudflare Access** is recommended; the app-level
session auth + RBAC still applies underneath it.

## Stripe setup

1. Create a Stripe account (test mode first) and set the three Stripe
   secrets above. Checkout uses inline `price_data`, so **no product sync
   is required** to start selling; `stripe_product_mappings` exists for a
   future sync strategy.
2. Dashboard → Developers → Webhooks → add endpoint
   `https://<your-worker>/api/stripe/webhooks` with events:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.refunded`
   - `customer.created`
   - `customer.updated`
3. Put the endpoint's signing secret in `STRIPE_WEBHOOK_SECRET`.
4. Stripe Tax: activate it in the dashboard, then uncomment
   `automatic_tax: { enabled: true }` in `src/worker/routes/commerce.ts`.

### Webhook local testing

```bash
stripe listen --forward-to localhost:5173/api/stripe/webhooks
# copy the printed whsec_… into .dev.vars as STRIPE_WEBHOOK_SECRET
stripe trigger checkout.session.completed
```

## Shipping providers

Shops choose their own carrier stack under **Admin → Shipping**. The
`manual` provider (flat rates per destination zone) is enabled by default
so checkout always has something to quote; connect any of DHL Express
(MyDHL API), Shippo, EasyPost, ShipEngine, Sendcloud, or Easyship by
pasting that provider's API credentials — keys are stored in D1
(`shipping_provider_configs`) and never returned to the browser.

Per provider you can toggle:

- **Enabled** — available for fulfillment (quoting + label purchase on
  the order panel under Admin → Orders).
- **Quote live rates to buyers at checkout** — rates for the buyer's
  country are passed to Stripe Checkout as `shipping_options` (max 5,
  cheapest first, matching the cart currency).

**Test connection** runs a live rate request against the provider and
surfaces the provider's own error message if credentials are wrong.

**Tracking webhooks:** each connected provider gets a secret webhook URL
(shown in its configure panel) — paste it into the provider's dashboard.
Inbound events append to `shipment_events`, advance the shipment status
(never backwards), and roll the order's fulfillment status up to
`shipped`/`delivered` once every parcel on the order has arrived.
EasyPost events are additionally HMAC-verified when a webhook secret is
configured.

Labels bought from providers that return raw PDF bytes (DHL, Sendcloud)
are stored in R2 under `shipping-labels/` and served via an
admin-authenticated route; URL-hosted labels (Shippo, EasyPost,
ShipEngine, Easyship) link out directly.

The ship-from address, default parcel size, and per-item weight used for
quoting live in `settings` (`shipping_origin`, `shipping_default_parcel`,
`shipping_per_item_weight_kg`) and are editable at the top of the
Shipping page.

## Outbound email — Cloudflare Email Service

All email — founder notifications and buyer confirmations — runs on
Cloudflare Email Service via the single `send_email` binding (`EMAIL` in
`wrangler.toml`). Wired senders:

- **Order notification** (founder) — fires on `checkout.session.completed`
  (`src/worker/services/email.ts`)
- **High-intent lead notification** (founder) — wholesale inquiries, line
  sheet inquiries, and contact messages (list signups intentionally
  don't email)
- **Daily ops digest** (founder) — the 06:00 UTC cron emails late tasks,
  low stock, abandoned checkouts (pending > 24h, also swept into
  analytics), pending factory follow-ups, and open samples
- **Order confirmation** (buyer) — emailed to the customer after payment,
  with pre-order line items flagged "made to order"
  (`src/worker/services/buyer-email.ts`)

Two activation tiers, matching how Email Service works:

1. **Founder notifications** — verify a destination address in the
   Cloudflare dashboard (free on all plans), then set `NOTIFY_EMAIL_FROM`
   and `NOTIFY_EMAIL_TO` in `wrangler.toml [vars]`.
2. **Buyer email** — onboard your sending domain to **Email Sending**
   (Compute → Email Service → Email Sending → Onboard Domain; requires
   Workers Paid and Cloudflare DNS). Once onboarded, the account can send
   to *any* recipient — set `BUYER_EMAIL_FROM` (e.g.
   `orders@yourdomain.com`) to activate.

Until the vars are set, every send is a logged no-op — checkout and
webhooks work regardless. No third-party email provider is involved.

## Anthropic setup

Set `ANTHROPIC_API_KEY`. AI assist runs entirely server-side
(`src/worker/services/anthropic.ts`, default model `claude-sonnet-5`) and
powers `/admin/tech-packs/:id/ai-assist`: BOM drafts, construction notes,
QC checklists, measurement points, grading, FR translation, factory
summaries/emails, completeness audits, and version comparison. To route
through Cloudflare AI Gateway later, change `BASE_URL` in the service.

## Environment variables

See [`.env.example`](./.env.example). Secrets go in `.dev.vars` (local) or
`wrangler secret put` (production); plain vars live in `wrangler.toml [vars]`.
Nothing secret is ever exposed to the browser or stored in D1.

## Feature map

| Area | Where | Status |
|------|-------|--------|
| Public editorial site (15 pages) | `src/app/pages/public` | ✅ working |
| Email capture: newsletter, waitlist, drop, wholesale, contact | `/api/public/leads` → D1 | ✅ working |
| Stripe Checkout + webhooks + orders/customers/refunds | `src/worker/routes/commerce.ts`, `stripe-webhooks.ts` | ✅ working (needs keys) |
| Admin auth: PBKDF2 + hashed session tokens + RBAC + audit log | `src/worker/services/auth.ts` | ✅ working |
| Dashboard KPIs (revenue, late tasks, low stock, margin risk…) | `/api/admin/dashboard` | ✅ working |
| Styles / colorways / SKUs | admin Catalog | ✅ CRUD (create/list/update) |
| Products, publish toggle, variants, images | admin Catalog | ✅ list/update |
| Inventory + movement ledger + low-stock alerts | admin Catalog | ✅ working |
| Production calendar: kanban / table / Gantt-lite, tasks, stages | admin Production | ✅ working |
| Supplier CRM: profiles, contacts, interactions, history | admin Production | ✅ working |
| Samples pipeline, purchase orders, fabrics & trims | admin Production | ✅ working |
| Tech packs: typed sections, printable export (print → PDF) | admin Studio | ✅ working |
| Tech pack AI assist (10 structured actions) | `/admin/tech-packs/:id/ai-assist` | ✅ working (needs key) |
| AI Concept Lab: preset prompts, concepts, ratings, versioning | admin Studio | ✅ working |
| External tool bridges (Midjourney/Firefly/CLO metadata) | `external_tool_exports` API | ✅ API, minimal UI |
| 3D simulation bridge: projects, statuses, fit-issue → task | admin Studio | ✅ working |
| Files: R2 upload/download by entity | admin Studio | ✅ working |
| Costing: cost sheets, landed-cost scenarios, margins | admin Finance | ✅ working (edit via API) |
| Duty rules engine + estimator (estimates, not legal advice) | admin Finance | ✅ working |
| Analytics event foundation (11 event types) | D1 `analytics_events` | ✅ working |
| Settings: brand identity as data, integration status | admin System | ✅ working |
| Cron: daily late-task risk sweep | `wrangler.toml [triggers]` | ✅ working |
| CMS: block-composed pages (11 section types), templates, 3 layouts, hero images, editable homepage (blocks) + hero + navigation, journal, lookbooks, drafts + revision history + delete | admin Content | ✅ working |
| CMS ops: draft preview links, scheduled publishing (hourly cron), media library with alt text | admin Content | ✅ working |
| Edge SEO: per-route meta/OG injection into the SPA shell, sitemap.xml, robots.txt, SEO fields | worker `services/seo.ts` | ✅ working |
| AI content suite: interview drafting, selection rewrite, SEO meta, image alt text, brand voice, site-starter interview | admin Content (needs Anthropic key) | ✅ working |
| Storefront translations: EN/FR toggle, on-demand Llama translation via Workers AI, cached in D1 | `services/translate.ts` | ✅ working |
| Marketing suite: AI campaign kits (IG/story/TikTok/Pinterest/X/FB, email, blog, press release, Google/Meta ads), posting calendar, graphics studio (SVG→PNG), subscriber email sends w/ unsubscribe, SEO content ideas | admin Marketing (Anthropic key or Workers AI Llama) | ✅ working |
| Verto platform: marketing site + pricing + signup at `/`, shop registry with path routing (`/rezene`) and CNAME-ready domain mapping, legacy 301s | `services/shops.ts`, `verto/VertoApp.tsx` | ✅ working |
| Multi-tenancy: per-shop SQLite Durable Object databases, tenant middleware, one-click provisioning of signups, suspend/reactivate, per-shop webhooks/media/SEO/unsubscribe | `do/shop-database.ts`, `services/tenant-db.ts`, `services/provision.ts` | ✅ working |
| Factory share portal: tokenized live tech packs, EN/FR, comments, approval | `/factory/:token` | ✅ working |
| Photo/sketch → AI tech pack draft (vision) | Tech Packs → "From photo" | ✅ working (needs key) |
| Pre-order campaigns: MOQ goals, cutoffs, caps, funded → production task | admin Commerce → Pre-orders | ✅ working |
| Spec-driven size charts on PDPs (graded from measurement specs) | product detail pages | ✅ working |
| Shoppable lookbooks (images link to products) | admin Content → Lookbooks | ✅ working |
| Cart + multi-item checkout + buyer confirmation email | `/cart`, `src/app/lib/cart.tsx` | ✅ working |
| Wholesale line sheets: tokenized links, wholesale pricing, buyer inquiries | admin Commerce → Line Sheets, `/linesheet/:token` | ✅ working |
| Product CSV import (Shopify export or simple template) | admin Products → Import CSV | ✅ working |
| Multi-provider shipping: manual rates, DHL Express, Shippo, EasyPost, ShipEngine, Sendcloud, Easyship — checkout rates, labels, tracking webhooks | admin Commerce → Shipping | ✅ working (carriers need keys) |

### Formerly scaffolds — now wired

- **Tech pack R2 export snapshots**: server-side standalone HTML renderer
  (`src/worker/services/techpack-html.ts`), "Export snapshot → R2" button,
  export history with session-gated downloads (`tech_pack_exports`).
- **Outbound email**: Cloudflare Email Service binding — order
  notifications, lead notifications, daily ops digest (see the email
  section above).
- **Abandoned checkout sweep**: the daily cron flags Stripe sessions
  pending > 24h as `checkout_abandoned` analytics events (idempotent) and
  includes them in the digest email.
- **Cost sheet editing UI**: full edit slide-over in Costing & Margins
  backed by `PATCH /api/admin/costing/cost-sheets/:id`.
- **External tool bridge UI**: "Bridges" tab in the AI Concept Lab — log
  Midjourney/Firefly/CLO job URLs and metadata into
  `external_tool_exports`.
- **3D fit-issue → task**: one click on a 3D project files a sample-
  revision production task.

### Remaining placeholders (documented, intentional)

- **Native PDF rendering**: the R2 HTML snapshot + print-to-PDF covers the
  factory workflow; binary PDF generation (Browserless/Gotenberg) remains
  the documented external option.
- **Customer portal / accounts**: route exists
  (`/api/public/customer-portal`); customer-facing auth is a later phase.
- **Customer-facing transactional email beyond order confirmations**:
  confirmations ship via Email Service; drop notifications and marketing
  email are later phases.
- **Queues**: producer/consumer config is commented in `wrangler.toml` —
  enable for webhook fan-out and AI batch jobs when the account has Queues.
- **Multi-tenancy**: not built (per brief); all ids are opaque TEXT so a
  `workspace_id` column can be added by migration without identity rewrites.
- Supplier leads (Atelier Coupe Cousu, Sinti, HITEX) are seeded as
  **unverified research data** — the UI flags them until verified.
- Duty rules are **editable estimates with disclaimers** — never presented
  as legal or customs advice.

## Data model

Four migrations in [`migrations/`](./migrations):

- `0001_initial.sql` — ~65 tables across identity/auth, commerce,
  brand/content, product development, production, costing, tech packs,
  AI/tool bridges, files, analytics. TEXT ids, ISO timestamps, money as
  integer cents, CHECK-constrained states, indexed hot paths.
- `0002_seed_demo_data.sql` — 2 collections, 8 styles/products with
  variants + inventory, 3 Casablanca supplier leads, 3 fabrics, the
  8-month season calendar, 2 tech packs, duty rules (EU 0% preferential,
  US yarn-forward, US MFN fallback 16.5–32%), cost sheet with EU/US
  landed-cost scenarios, 6 AI prompt presets, journal/lookbook/pages.
- `0003_content_revisions.sql` — CMS revision history for pages, journal
  posts, and lookbooks.
- `0004_factory_portal_commerce.sql` — factory tech pack shares,
  pre-order campaigns, wholesale line sheets + items, per-line-item
  pre-order flags, shoppable lookbook image → product links.

## Known limitations

- KV rate limiting is fixed-window and non-atomic — fine for abuse damping,
  not billing-grade quotas.
- Order numbers derive from a count (`MA-1001…`); replace with a D1
  sequence/KV counter before high-concurrency launch.
- `useFetch` is a minimal data hook; adopt TanStack Query when caching and
  optimistic updates start to matter.
- The cart is client-side (localStorage) with all validation server-side
  at checkout; carts don't sync across devices until customer accounts
  exist.
- Markdown rendering supports headings/bold/lists/tables only (renders via
  React elements, no `innerHTML` — safe by construction).

## Next steps

1. Verify the Casablanca supplier leads; flip `is_verified` as confirmed.
2. Stripe live keys + Stripe Tax + duties-in-pricing decision per region.
3. Photography → replace `EditorialImage` placeholder slots (R2-hosted).
4. Server-side PDF rendering for tech pack exports into R2.
5. Drop notifications to waitlists (Email Service, batched).
6. Cloudflare Access in front of `/admin` for production.
7. Cost-sheet edit forms and per-style margin what-if UI.
8. SaaS phase: `workspace_id` migration, Stripe Billing.
