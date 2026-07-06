import type { KbArticle } from "../types";

export const gettingStarted: KbArticle[] = [
  {
    slug: "welcome",
    title: "Welcome to Verto",
    summary: "What Verto is, who it's for, and how this handbook is organized.",
    part: "getting-started",
    moduleRoute: "/admin",
    keywords: "overview intro start welcome dashboard first",
    screenshot: "/kb/shots/dashboard.png",
    updated: "2026-07-06",
    body: `# Welcome to Verto

Verto is your entire fashion brand in one system: the **storefront** customers shop, the **catalog** behind it, the **production pipeline** that actually makes the clothes, and the **marketing** that sells them — all sharing one database. A fact you enter once (a fabric's origin, a style's measurements, a product's price) is true everywhere it's needed.

This handbook is a complete field guide. Every module has a chapter that explains what it's for, the concepts behind it, and step-by-step how-tos. Chapters are grouped into **Parts** in the left sidebar — start anywhere.

## How Verto is organized

The admin sidebar groups screens into sections that mirror how a collection actually comes to life:

- **Catalog** — the products, variants, inventory, and collections you sell.
- **Design & Development** — styles, tech packs, the AI Design Studio, and 3D.
- **Sourcing & Production** — factories, materials, samples, purchase orders, the production board.
- **Finance** — costing, duties & landed cost, shipping, analytics.
- **Marketing & Content** — campaigns, promo video, your CMS pages, and SEO.
- **Selling** — orders, customers, pre-orders, wholesale line sheets.
- **Account** — team, custom domain, settings, and this help center.

Each section collapses — click a heading to open or close it. The section you're working in opens on its own.

> [!TIP]
> Use the **"Jump to module…"** search at the top of the sidebar to fly to any screen by name without hunting through sections.

## The golden thread: one source of truth

The thing that makes Verto different from stitching together five separate tools is that everything is connected:

- A **Style** you design becomes a **Product** you sell and a **Tech Pack** you send a factory.
- A **Supplier** you find flows into **Samples** and **Purchase Orders**.
- A **Cost Sheet** pulls duty rates from the **Duties** engine to show true landed margin.
- **Orders** feed **Analytics**, which gives you the real **size curve** for your next production run.

You'll see cross-links throughout the app (and this guide) that follow that thread.

## Getting help anywhere

Look for the small **?** help-dots next to screen titles and controls. Hover for a one-line explanation, or click **Open guide** to jump straight to the relevant chapter here. If you're ever stuck, the **Report a bug or idea** button (top-right of Help & Knowledge Base) sends a note straight to the Verto team with the page you're on attached.`,
  },
  {
    slug: "first-15-minutes",
    title: "Your first 15 minutes",
    summary: "A guided path from empty account to a published product and a plan.",
    part: "getting-started",
    moduleRoute: "/admin",
    keywords: "onboarding setup quickstart new account checklist",
    updated: "2026-07-06",
    body: `# Your first 15 minutes

A brand-new Verto account starts empty — no products, no suppliers, no fake data. Here's the fastest path to something real.

## 1. Set your brand identity

Go to **Account → Settings** and set your brand name and tagline. These flow everywhere — the storefront header, tech pack covers, email footers.

## 2. Add your first product

Open **Catalog → Products → New product**. A name, price, and category create a draft. Add at least one **variant** (a colour + size) and click **Publish** — it's live on your storefront immediately. See [Adding and editing products](/admin/support/kb/products).

## 3. Design something (optional but fun)

Open **Design & Development → Design Studio** and describe a garment. Flux generates real concept imagery you can iterate on, drop onto a product, or send straight to a maker. See [The AI Design Studio](/admin/support/kb/design-studio).

## 4. Find a maker

No factory yet? **Sourcing & Production → Find a Maker** researches real, low-MOQ ateliers by garment, materials, and location, with sources. Add promising ones to your factory list. See [Finding a maker](/admin/support/kb/sourcing).

## 5. Know your numbers

Create a **Cost Sheet** for your hero style (**Finance → Costing**) and add a destination market. Verto shows your landed cost and margin — and its AI can benchmark a first-pass breakdown for you. See [Costing & margins](/admin/support/kb/costing).

> [!NOTE]
> Nothing you do here is destructive or public until you choose. Products stay drafts until published; AI outputs are always yours to edit; reports and sheets are private to your team.`,
  },
  {
    slug: "accounts-and-security",
    title: "Accounts, roles & security",
    summary: "How logins, roles, password resets, and platform admin work.",
    part: "getting-started",
    moduleRoute: "/admin/team",
    keywords: "login password role admin security reset session superadmin",
    updated: "2026-07-06",
    body: `# Accounts, roles & security

## Signing in

Each teammate signs in with their own email and password at \`/admin/login\`. There are no shared logins. Forgot your password? Use **Forgot password?** on the sign-in screen to get a reset link by email.

## Roles

Verto has three roles, set per teammate under **Account → Team**:

| Role | Can do |
| --- | --- |
| **Admin** | Everything, including inviting teammates and changing settings |
| **Operations** | Day-to-day work — catalog, production, marketing, orders |
| **Viewer** | Read-only access |

The last remaining admin can't be removed or demoted, so you never lock yourself out.

## Platform (SuperAdmin)

A small set of platform-level screens — the **Verto HQ CRM** and **Platform** tools — are visible only to Verto SuperAdmins, not to shops. If you don't see them, they're not meant for your account.

> [!WARNING]
> Connection keys (Stripe, AI providers) are stored as encrypted secrets **outside** the database and never appear in the app or the browser. Never paste an API key into a note, product field, or chat.`,
  },
];
