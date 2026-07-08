# Verto — working notes for Claude

Multi-tenant fashion-tech SaaS on Cloudflare Workers (Hono) + Vite/React 19 + TypeScript.
Platform D1 (`env.DB`) holds shops/CRM and the primary/demo shop; every other shop is a
per-shop SQLite Durable Object. Migrations in `migrations/*.sql` are applied to platform D1
and embedded into the per-shop DOs via `node scripts/embed-migrations.mjs`
(→ `src/worker/generated/migrations.ts`). Platform-only migrations are excluded from the DO
embed by the script's exclusion list.

## Build & verify (run before every commit)

```
npx tsc -b        # typecheck (noUnusedLocals is on)
npm run build     # client + worker build
```

If you added a migration: `node scripts/embed-migrations.mjs` first, then typecheck/build.

## Ship a feature: the documentation convention (do this automatically)

Every user-facing feature must ship its own docs in the same change. When you add or
meaningfully change a feature, ALWAYS also:

1. **Knowledge Base article** — add or update an article under `src/app/kb/content/*.ts`
   (register new files in `src/app/kb/index.ts` `KB_ARTICLES`). Give it a `slug`, `title`,
   `summary`, `part`, `moduleRoute`, `keywords`, and markdown `body`.
2. **Help-dot** — pass `help="<article-slug>"` to the admin page's `PageHeader` so the "?"
   links to the guide.
3. **Marketing features page** — reflect it on `src/app/verto/VertoFeatures.tsx`
   (add a line to `ModernShopGrid`'s `MODERN_SHOP`, or a full entry in `FEATURES` for a
   flagship capability with its own mini-screen).

This is not optional cleanup — treat it as part of "done," the same as typecheck passing.

## House style

- Warm, plain-language copy aimed at independent designers and boutique owners — no jargon.
- All admin writes go through `requireAdminWrite`/`requireAdminOnly` so demo shops stay
  read-only. Features gated on external config (Stripe, `BUYER_EMAIL_FROM`, research keys)
  must degrade cleanly with a clear message, never crash.
- Buyer/customer email uses the branded shell in `services/email-template.ts` and is a
  logged no-op until `BUYER_EMAIL_FROM` is set.
- Money is integer cents. Passwordless sessions store tokens hashed, same shape as the admin
  `sessions` table.
