# Claude Code Master Prompt: Ultimate Cloudflare-Native Fashion Brand OS

You are Claude Code operating inside a GitHub repository. Build a production-grade Cloudflare-native application for a new Morocco-produced clothing brand that combines:

- Men's aesthetic: Casatlantic-inspired mid-century Casablanca / Riviera tailoring, high-waisted trousers, resort knitwear, effortless elegance.
- Women's aesthetic: JLUXLABEL-inspired accessible luxury, feminine resortwear, draped dresses, halters, crochet, skirt sets, clean sensuality.
- Production focus: Casablanca, Morocco.
- Business model: Direct-to-consumer commerce powered by Stripe, with internal business/production/admin management.
- Long-term ambition: An internal brand operating system that can later become a SaaS product for indie apparel brands.

Use `BUSINESS_PLAN_CONTEXT.md` as the primary business context file. Do not ignore it.

## Non-Negotiable Architecture

Build this as a full-stack Cloudflare application using:

- Frontend: React + TypeScript + Vite
- Styling: Tailwind CSS + shadcn/ui-style component patterns
- Runtime/API: Cloudflare Workers
- Deployment: Cloudflare Pages or Workers static assets, whichever is currently best-supported for full-stack routing
- Database: Cloudflare D1
- Object/file storage: Cloudflare R2
- Cache/config/session adjuncts: Cloudflare KV where appropriate
- Async/background workflows: Cloudflare Queues where appropriate
- Scheduled jobs: Cloudflare Cron Triggers
- AI routing: Anthropic Claude API through Workers server-side endpoints; optionally structure so Cloudflare AI Gateway can be added later
- Payments/commerce: Stripe Checkout, Payment Intents, Products, Prices, Tax, Webhooks, Customer Portal, Promotion Codes
- Auth: Implement secure app auth. Prefer Cloudflare Access for internal/admin routes if available, plus application-level RBAC in D1.
- Repo: GitHub-first, with clear commits, README, setup docs, `.env.example`, `wrangler.toml`, migrations, seed data, and deployment instructions.

Do not use Shopify.

Do not hardcode secrets.

Do not expose Stripe secret keys or Anthropic keys to the browser.

Prioritize a clean, extensible domain model over quick hacks.

## Deliverable Goal

Create the "ultimate marketing and business management site" for the brand. It should include:

1. Public marketing site
2. Stripe-powered commerce
3. Internal admin/business management app
4. Production calendar
5. Supplier/factory CRM
6. Style/SKU master
7. AI-assisted tech pack builder
8. Sample tracking
9. Purchase order and production order management
10. Costing, landed cost, duty, margin dashboards
11. File/document management through R2
12. AI concepting bridge
13. 3D simulation bridge
14. Analytics/event logging foundation
15. SaaS-ready architecture for later externalizing the tech pack/business OS

## Build Philosophy

This is not a simple ecommerce site. It is a vertical operating system for a fashion brand.

Build it like a serious founder/developer will extend it.

Use feature folders and domain modules. Avoid one giant file.

Every major feature should have:

- D1 schema/migration
- API routes
- TypeScript types
- UI pages/components
- Validation
- Error states
- Empty states
- Seed/demo data where helpful
- Clear TODO notes only where external credentials or human decisions are required

## Suggested App Structure

Use this structure unless a better Cloudflare/Vite convention is clearly preferable:

```txt
/
  README.md
  BUSINESS_PLAN_CONTEXT.md
  CLAUDE_CODE_PROMPT.md
  package.json
  wrangler.toml
  .env.example
  migrations/
    0001_initial.sql
    0002_seed_demo_data.sql
  src/
    app/
      main.tsx
      router.tsx
      layouts/
      pages/
        public/
        admin/
        auth/
      components/
      lib/
      styles/
    worker/
      index.ts
      routes/
        auth.ts
        products.ts
        commerce.ts
        stripe-webhooks.ts
        admin-styles.ts
        admin-skus.ts
        admin-production.ts
        admin-suppliers.ts
        admin-techpacks.ts
        admin-ai.ts
        admin-files.ts
        admin-analytics.ts
      services/
        db.ts
        stripe.ts
        anthropic.ts
        r2.ts
        tax-duty.ts
        pdf.ts
        auth.ts
        validators.ts
      types/
      utils/
```

If Cloudflare Pages Functions and Vite integration require a different layout, use the best modern approach and document it.

## Public Marketing Site Requirements

Create a premium editorial marketing site with these pages:

### Public Pages

- `/` Home
- `/story` Brand story
- `/collections` Collection overview
- `/collections/:slug` Collection detail
- `/products` Product grid
- `/products/:slug` Product detail
- `/lookbook` Editorial lookbook
- `/atelier` Casablanca production story
- `/journal` Brand journal/articles
- `/stockists` Future wholesale/store locations page
- `/size-guide` Fit and size guide
- `/shipping-returns` Shipping, duties, returns
- `/privacy`
- `/terms`
- `/contact`

### Visual Direction

The public site should feel like:

- 1960s Casablanca
- Mediterranean/Atlantic resort life
- old-world tailoring
- modern accessible luxury
- warm editorial photography
- cream, sand, olive, terracotta, deep navy, faded indigo
- typography pairing: elegant serif display + clean grotesk sans

Use placeholder content and structured seed data where brand name/assets are not finalized.

### Product Detail Page

Each PDP must include:

- Product title
- Price
- Colorways
- Size selector
- Fit notes
- Fabric composition
- Care instructions
- Origin/manufacturing statement
- Shipping and duty note
- Stripe checkout button
- Related products
- Editorial product story
- Inventory/sold-out/pre-order state

## Stripe Commerce Requirements

Implement Stripe as the commerce backbone.

### Stripe Features

- Products and Prices sync or local product-to-Stripe mapping
- Checkout Sessions for one-time purchases
- Stripe Tax support
- Adaptive/multi-currency pricing-ready data model
- Promotion code support
- Customer creation
- Webhook handling for:
  - checkout.session.completed
  - payment_intent.succeeded
  - payment_intent.payment_failed
  - charge.refunded
  - customer.created
  - customer.updated
- Order records in D1
- Order line items
- Payment status
- Fulfillment status
- Refund state
- Customer portal route placeholder
- Secure webhook signature verification

### Commerce Admin

Internal admin should show:

- Orders
- Customers
- Payments
- Refunds
- Product/price mapping
- Inventory
- Pre-orders
- Promotions
- Abandoned checkout placeholder architecture if feasible

Do not rebuild payment storage. Store only Stripe IDs and non-sensitive metadata.

## Internal Admin App

Create `/admin` as the operating system.

### Admin Navigation

Sections:

- Dashboard
- Products
- Styles
- SKUs
- Collections
- Inventory
- Orders
- Customers
- Production Calendar
- Factories & Suppliers
- Fabrics & Materials
- Samples
- Purchase Orders
- Tech Packs
- AI Concept Lab
- 3D Simulation Bridge
- Files
- Costing & Margins
- Duties & Landed Cost
- Analytics
- Settings

### Dashboard

Dashboard cards:

- Revenue
- Orders
- Gross margin
- Production stages by count
- Open samples
- Late production tasks
- Inventory alerts
- Upcoming milestones
- Pending factory responses
- Styles missing tech packs
- Styles with margin risk

## Data Model Requirements

Create D1 migrations for a robust normalized schema.

At minimum include:

### Identity/Auth

- users
- roles
- user_roles
- audit_logs
- sessions if not using external auth entirely

### Commerce

- customers
- products
- product_images
- product_variants
- stripe_product_mappings
- inventory_items
- inventory_movements
- orders
- order_items
- payments
- refunds
- promotions

### Brand/Content

- collections
- lookbooks
- lookbook_images
- journal_posts
- pages
- media_assets

### Product Development

- styles
- style_versions
- skus
- size_specs
- measurement_points
- grading_rules
- colorways
- fabrics
- trims
- bom_items
- care_instructions

### Production

- factories
- suppliers
- supplier_contacts
- supplier_interactions
- production_orders
- production_order_items
- production_stages
- production_tasks
- production_calendar_events
- samples
- sample_reviews
- quality_control_checks
- shipment_batches

### Costing

- cost_sheets
- cost_sheet_items
- landed_cost_scenarios
- duty_rules
- margin_targets

### Tech Packs

- tech_packs
- tech_pack_sections
- tech_pack_files
- tech_pack_exports
- tech_pack_comments
- construction_notes
- stitch_details
- labels_packaging

### AI / External Tool Bridges

- ai_concepts
- ai_generations
- ai_prompts
- external_tool_exports
- clo3d_projects
- simulation_files
- integration_credentials_metadata
- webhooks

## AI-Assisted Tech Pack Builder

Build a real internal tech pack module.

### Tech Pack Features

Users should be able to create a tech pack from:

1. Blank form
2. Existing style
3. Product photo/reference image uploaded to R2
4. Text prompt
5. AI-generated concept

### Tech Pack Sections

Each tech pack should include:

- Cover page
- Style overview
- Flat sketch/reference image
- Bill of materials
- Fabric details
- Trim details
- Colorways
- Size specification table
- Measurement points
- Grading rules
- Construction notes
- Stitch details
- Label/packaging instructions
- Care label instructions
- Quality control checklist
- Revision history
- Export metadata

### AI Tech Pack Assist

Create `/admin/tech-packs/:id/ai-assist`.

AI should help with:

- Generate first-draft BOM from garment description
- Generate construction notes
- Generate QC checklist
- Suggest measurement points
- Suggest grading rules
- Translate factory notes into French
- Create concise factory-ready summary
- Identify missing tech pack fields
- Compare two tech pack versions and summarize changes
- Generate email to factory with attached tech pack context

Server-side only. Use Anthropic API through Worker route.

Design prompts so outputs are structured JSON where possible.

### Tech Pack Export

Implement PDF export architecture.

If PDF generation in Workers is constrained, implement one of:

- HTML print-ready export with `window.print()`
- Server-side HTML-to-PDF placeholder with documented external service option
- R2-stored export snapshots

Must at least generate a clean printable HTML tech pack that can be saved to PDF.

## AI Concept Lab

Build `/admin/ai-concepts`.

This is not meant to replace Midjourney, Firefly, or CLO 3D. It should orchestrate the concepting workflow.

### Features

- Prompt library
- Brand prompt presets:
  - Men's Casatlantic-style trouser
  - Men's resort knit
  - Women's JLUX-style maxi dress
  - Women's halter/resort set
  - Moroccan atelier editorial campaign
  - Fabric texture exploration
- Store generated prompts
- Store generated outputs/links/files
- Upload images from Midjourney/Firefly to R2
- Attach concepts to styles
- Convert concept to draft style
- Convert concept to draft tech pack
- Rate concepts
- Version prompts

### External Tool Bridge

For tools that cannot be replicated internally:

- Midjourney: store prompt, Discord/job URL, output images, seed/reference metadata
- Adobe Firefly: store prompt, output images, license/commercial-safe notes
- CLO 3D: store project file metadata, exported images/videos, measurements, pattern file links
- Browzwear/Style3D: generic bridge
- Illustrator/Figma: upload source files to R2 and attach to style/tech pack

Create generic `external_tool_exports` table.

## 3D Simulation Bridge

Build `/admin/3d`.

This should manage the bridge to CLO 3D/Style3D/Browzwear.

Features:

- Project list
- Attach 3D project to style
- Store project files in R2
- Upload renders and turntables
- Store garment measurements
- Store notes from simulation
- Mark simulation status:
  - not_started
  - pattern_needed
  - in_simulation
  - fit_review
  - approved
- Link simulation outputs back into tech pack
- Create sample revision task from fit issue

Do not attempt to build a physics-based garment simulator.

## Production Calendar

Build `/admin/production`.

Production calendar should model the business plan milestones:

- Brand identity/design brief
- AI concept generation
- CLO/3D simulation
- Tech packs completed
- Factory briefings in Casablanca
- Fabric sourcing
- Sampling
- Sample approval/revision
- Bulk production
- QC
- Shipping
- Launch

Features:

- Calendar view
- Kanban view
- Table view
- Gantt-lite timeline if feasible
- Milestone templates
- Task dependencies
- Responsible owner
- Factory/supplier linked
- Style/PO linked
- Due date
- Status
- Risk flag
- Notes
- File attachments

## Supplier & Factory CRM

Build `/admin/suppliers`.

Features:

- Factory/supplier profiles
- Contacts
- Capabilities
- MOQ
- Lead times
- Languages
- Certifications
- Address/map link
- Email/WhatsApp fields
- Interaction log
- Quote history
- Sample history
- Production order history
- On-time score
- Quality score
- Risk notes

Seed demo data for:

- Atelier Coupe Cousu
- Sinti
- HITEX Morocco

Mark data as research/demo until verified.

## Costing, Duty, and Margin Engine

Build `/admin/costing`.

### Cost Sheet

Fields:

- Style
- SKU
- Fabric cost
- trim cost
- cut/sew/make
- sample cost allocation
- packaging
- freight
- insurance
- duty
- payment processing
- returns reserve
- wholesale margin
- DTC margin
- target retail price
- actual retail price
- gross margin

### Duty Logic

Create a duty rules engine with editable assumptions.

Seed rules:

- EU import duty for qualifying Morocco-origin apparel: 0%
- US-Morocco FTA: yarn-forward rule assumption
- US fallback MFN duty placeholder: 16.5% to 32% depending HS category
- UK: placeholder requiring later validation
- Canada: placeholder requiring later validation

Important: mark duty calculations as estimates, not legal advice.

## Inventory

Build `/admin/inventory`.

Features:

- SKU-level inventory
- Incoming production inventory
- Available
- Reserved
- Sold
- Returned
- Damaged
- Movement ledger
- Low-stock alert
- Pre-order allocation

## Files / R2

Build `/admin/files`.

Features:

- Upload files to R2
- Organize by entity:
  - style
  - tech_pack
  - sample
  - factory
  - production_order
  - concept
  - 3d_project
- Generate signed URLs where appropriate
- Store metadata in D1
- Support images, PDFs, CSVs, ZIPs, AI files, CLO files

## Analytics Foundation

Build event tracking foundation:

- page_view
- product_view
- add_to_cart intent
- checkout_started
- checkout_completed
- email_signup
- concept_created
- tech_pack_created
- production_stage_changed
- sample_approved
- order_fulfilled

Store in D1 for now. Keep compatible with future export to PostHog, GA4, or warehouse.

## Email Capture and CRM

Public site should have:

- Newsletter signup
- Waitlist signup
- Product drop notification
- Wholesale inquiry form
- Contact form

Store leads in D1.

Optional future integration placeholders:

- Resend
- Loops
- Klaviyo
- Mailchimp

## Security Requirements

- Validate all request bodies
- Use Zod or similar validation
- RBAC for admin modules
- Audit log major changes
- Protect webhooks
- Do not leak stack traces in production
- CSRF protection where applicable
- Sanitize rich text
- Use signed URLs for private R2 files
- Rate limit public forms and AI endpoints
- Separate public API from admin API routes

## UI/UX Requirements

Admin should feel like a premium SaaS tool:

- Left sidebar
- Top command/search bar
- Breadcrumbs
- Tables with filters
- Detail pages
- Slide-over edit panels where sensible
- Empty states with CTA
- Loading skeletons
- Toasts
- Confirmation dialogs
- Responsive but desktop-first for admin
- Public site fully responsive and mobile-first

## Seed Data

Create realistic seed data:

- 2 collections:
  - Atlantic Riviera SS27
  - Casablanca Court AW27
- 8 products:
  - Men's high-waisted trouser
  - Men's brushed wool trouser
  - Men's resort knit polo
  - Men's linen overshirt
  - Women's draped maxi dress
  - Women's halter top
  - Women's skirt set
  - Women's crochet coverup
- 3 factories/suppliers:
  - Atelier Coupe Cousu
  - Sinti
  - HITEX Morocco
- 3 fabrics:
  - Spanish linen
  - Turkish viscose
  - Moroccan cotton jersey
- 1 sample production calendar
- 2 tech packs
- 4 AI concept prompts
- 1 CLO 3D placeholder project

## Business Plan Context

Create or preserve `BUSINESS_PLAN_CONTEXT.md` in the root. Use it as product and domain context.

## README Requirements

README must include:

- Project overview
- Architecture diagram in text/markdown
- Local dev setup
- Cloudflare setup
- D1 migrations
- R2 setup
- KV setup
- Stripe setup
- Stripe webhook local testing
- Anthropic API setup
- Environment variables
- Deployment commands
- Admin seed login strategy
- Feature map
- Known limitations
- Next steps

## Environment Variables

Create `.env.example` with:

```bash
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PUBLISHABLE_KEY=
ANTHROPIC_API_KEY=
APP_ENV=development
APP_URL=http://localhost:5173
ADMIN_EMAIL=
SESSION_SECRET=
R2_PUBLIC_BASE_URL=
```

Cloudflare bindings should be configured in `wrangler.toml`.

## Implementation Order

Work in this order:

1. Scaffold Cloudflare/Vite/React/TypeScript project.
2. Add Tailwind and base design system.
3. Configure Worker routes and local dev.
4. Create D1 schema migrations.
5. Create R2/KV binding placeholders.
6. Build public marketing site shell.
7. Build admin layout and navigation.
8. Implement Styles/SKUs/Products CRUD.
9. Implement Production Calendar.
10. Implement Supplier CRM.
11. Implement Tech Pack Builder.
12. Implement AI Assist endpoint and UI.
13. Implement R2 file uploads.
14. Implement Stripe product/checkout/webhook flow.
15. Implement orders/admin commerce views.
16. Implement costing/duty/margin module.
17. Implement AI Concept Lab.
18. Implement 3D Simulation Bridge.
19. Add analytics event tracking.
20. Polish UX, seed data, docs, and deployment.

At the end, provide:

- What was built
- How to run locally
- How to deploy
- Which Cloudflare resources to create
- Which Stripe webhooks to configure
- Which features are production-ready
- Which features are scaffolds/placeholders

## Quality Bar

This should be good enough that a technical founder can keep building on it immediately.

Avoid toy examples.

Use real domain language.

Use strong types.

Keep code maintainable.

Document assumptions.

If something cannot be fully done inside Cloudflare Workers, implement the best possible bridge and document the external integration path.
