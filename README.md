# Maison Atlantique — Brand OS

A Cloudflare-native operating system for a Morocco-produced clothing brand:
premium editorial storefront, Stripe-powered DTC commerce, and an internal
admin app covering styles, SKUs, tech packs, production, suppliers, costing,
duties, AI concepting, and 3D simulation bridges.

Business context lives in [`BUSINESS_PLAN_CONTEXT.md`](./BUSINESS_PLAN_CONTEXT.md);
the build brief in [`CLAUDE_CODE_PROMPT.md`](./CLAUDE_CODE_PROMPT.md).
The brand name is a placeholder — it is data (Settings → brand), not code.

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

## Cloudflare setup

```bash
wrangler login

# 1. D1
wrangler d1 create maison-atlantique-db
#    → paste database_id into wrangler.toml

# 2. KV
wrangler kv namespace create KV
#    → paste id into wrangler.toml

# 3. R2
wrangler r2 bucket create maison-atlantique-files

# 4. Migrations (remote)
npm run db:migrate:remote

# 5. Secrets
wrangler secret put STRIPE_SECRET_KEY
wrangler secret put STRIPE_WEBHOOK_SECRET
wrangler secret put STRIPE_PUBLISHABLE_KEY
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put SESSION_SECRET
wrangler secret put ADMIN_EMAIL
wrangler secret put ADMIN_INITIAL_PASSWORD

# 6. Deploy
npm run deploy
```

Update `APP_URL` in `wrangler.toml` `[vars]` to the deployed URL (it is used
for Stripe success/cancel redirects in production).

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

### Scaffolds / placeholders (documented, intentional)

- **PDF export**: printable HTML via `window.print()` is the working path;
  server-side HTML→PDF (e.g. Browserless/Gotenberg or a queue-driven
  renderer) and R2 export snapshots are the documented next step
  (`tech_pack_exports` table is ready).
- **Customer portal / accounts**: route exists
  (`/api/public/customer-portal`); customer-facing auth is a later phase.
- **Queues**: producer/consumer config is commented in `wrangler.toml` —
  enable for webhook fan-out and AI batch jobs when the account has Queues.
- **Abandoned checkout**: pending orders with `payment_status='pending'`
  are the raw material; a cron sweep + email hook is the follow-up.
- **Email sending** (Resend/Loops/Klaviyo): leads are captured in D1;
  outbound email is a documented integration point.
- **Multi-tenancy**: not built (per brief); all ids are opaque TEXT so a
  `workspace_id` column can be added by migration without identity rewrites.
- **Cost sheet editing UI**: cost data renders in admin; edits go through
  the API today, with a form UI as follow-up.
- Supplier leads (Atelier Coupe Cousu, Sinti, HITEX) are seeded as
  **unverified research data** — the UI flags them until verified.
- Duty rules are **editable estimates with disclaimers** — never presented
  as legal or customs advice.

## Data model

Two migrations in [`migrations/`](./migrations):

- `0001_initial.sql` — ~65 tables across identity/auth, commerce,
  brand/content, product development, production, costing, tech packs,
  AI/tool bridges, files, analytics. TEXT ids, ISO timestamps, money as
  integer cents, CHECK-constrained states, indexed hot paths.
- `0002_seed_demo_data.sql` — 2 collections, 8 styles/products with
  variants + inventory, 3 Casablanca supplier leads, 3 fabrics, the
  8-month season calendar, 2 tech packs, duty rules (EU 0% preferential,
  US yarn-forward, US MFN fallback 16.5–32%), cost sheet with EU/US
  landed-cost scenarios, 6 AI prompt presets, journal/lookbook/pages.

## Known limitations

- KV rate limiting is fixed-window and non-atomic — fine for abuse damping,
  not billing-grade quotas.
- Order numbers derive from a count (`MA-1001…`); replace with a D1
  sequence/KV counter before high-concurrency launch.
- `useFetch` is a minimal data hook; adopt TanStack Query when caching and
  optimistic updates start to matter.
- Checkout is single-item buy-now (matches the pre-order launch model);
  a cart is additive work on the same order/line-item schema.
- Markdown rendering supports headings/bold/lists/tables only (renders via
  React elements, no `innerHTML` — safe by construction).

## Next steps

1. Verify the Casablanca supplier leads; flip `is_verified` as confirmed.
2. Stripe live keys + Stripe Tax + duties-in-pricing decision per region.
3. Photography → replace `EditorialImage` placeholder slots (R2-hosted).
4. Server-side PDF rendering for tech pack exports into R2.
5. Outbound email (Resend) for order confirmations and drop notifications.
6. Cloudflare Access in front of `/admin` for production.
7. Cost-sheet edit forms and per-style margin what-if UI.
8. SaaS phase: `workspace_id` migration, factory portal, Stripe Billing.
