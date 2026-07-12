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
- **Design & Development** — styles, tech packs, the LLM Design Studio, and 3D.
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
    summary: "Start with the Launch Playbook — then a guided path to your first real product.",
    part: "getting-started",
    moduleRoute: "/admin/launch",
    keywords: "onboarding setup quickstart new account checklist launch playbook plan brand brain established getting started",
    updated: "2026-07-06",
    body: `# Your first 15 minutes

A brand-new Verto account starts empty — no products, no suppliers, no fake data. The fastest way to fill it isn't to click through screens one by one. It's the **Launch Playbook** (**Account → Launch Playbook**, or \`/admin/launch\`), which turns a plan into a working app and then guides you through everything else.

## Start with the Launch Playbook

The first time you open it, the Playbook asks one question: **which best describes you?**

- **I'm established** — you already have a brand, products, suppliers, and numbers. Take the **import lane**: paste or upload what you have and Verto seeds your catalog, sourcing, and costing from it, so you're not retyping a business you already run.
- **I'm just getting started** — take the **guided lane**. Verto walks you through a real clothing-brand launch, one decision at a time, and builds the plan with you.

You can switch lanes anytime — nothing is locked in by the choice.

## The guided lane: build a plan, then a brand

The guided Playbook is a clickable version of a complete brand-launch field guide, organized into parts — **brand foundation, product, sourcing, tariffs & landed cost, commerce, launch, finance**. You fill in the blanks; three things make it fast:

1. **Draft it with an LLM.** Don't have answers yet? Verto can research and draft a starting plan for your category and markets, which you then edit. You can also **paste** a plan you wrote elsewhere, or **upload a PDF** and let Verto parse it into the guide.
2. **Invisible business admin.** A new founder shouldn't have to hand-calculate tariffs, landed cost, or margins. Sections like **Tariffs & landed cost** have a **"✨ Fill this in for me"** button — Verto fills them in and leaves a plain-English note explaining *why*, so you learn the reasoning instead of just getting numbers.
3. **A living brief, not a document.** As you fill sections, the Playbook feeds a per-shop **Brand Brain** that seeds and guides the rest of the app — your positioning words shape LLM copy, your hero style and mood board flow into the Design Studio, your fabrics into Materials, your markets into Duties and Costing.

> [!TIP]
> On **Visual identity**, upload 6–20 images to build a **mood board** — it captures the world of the brand and feeds the Design Studio. On **Key fabrics**, pick from the built-in fabric library, or hit **"🧵 Not sure? Describe the feel"** and Verto suggests fabrics from a plain-English description like "soft and cozy for a hoodie."

## Compile it, then set up your app

When the plan is filled in, **compile** it into a clean business plan you can read and share — and the compiled view links straight into each module it seeds, so "set up your app" is a click, not a re-entry.

The **launch-readiness checklist** at the bottom is a real tracker, not decoration. Each item (samples approved, checkout tested, shipping rates configured, returns policy published, launch emails drafted…) deep-links to the exact screen where you do it, and ticking it fills a **launch-ready progress bar**.

## Then: your first real product

With a plan in place, these five steps turn it into a live storefront. If you took the Playbook, most of the groundwork is already seeded.

1. **Set your brand identity.** **Account → Settings** — brand name and tagline flow everywhere (storefront header, tech pack covers, email footers). The Playbook seeds this from your brand foundation.
2. **Add your first product.** **Catalog → Products → New product**. A name, price, and category create a draft; add a **variant** (colour + size) and **Publish** to go live. See [Adding and editing products](/admin/support/kb/products).
3. **Design your hero style.** **Design & Development → Design Studio** — describe the garment (your Playbook concept prompt is a head start) and Flux generates concept imagery to iterate on. See [The LLM Design Studio](/admin/support/kb/design-studio).
4. **Find a maker.** **Sourcing & Production → Find a Maker** researches real, low-MOQ ateliers by garment, materials, and location, with sources. See [Finding a maker](/admin/support/kb/sourcing).
5. **Know your numbers.** Create a **Cost Sheet** for your hero style (**Finance → Costing**), add a destination market, and Verto shows landed cost and margin — its LLM can benchmark a first-pass breakdown. See [Costing & margins](/admin/support/kb/costing).

> [!NOTE]
> Nothing here is destructive or public until you choose. Products stay drafts until published; LLM outputs are always yours to edit; your plan and sheets are private to your team.

## Ready for a real journey?

The **[How-to guides](/admin/support/kb/how-to-first-piece)** walk whole scenarios end to end — designing your first piece and sending it to a maker, drafting made-to-measure for a client, going from approved sample to a production run, and launching your shop.`,
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
> Connection keys (Stripe, LLM providers) are stored as encrypted secrets **outside** the database and never appear in the app or the browser. Never paste an API key into a note, product field, or chat.`,
  },
  {
    slug: "get-selling-fast",
    title: "Get selling fast",
    summary: "The activation guide on your dashboard — the shortest path from a drafted brand to a shop that can take real orders.",
    part: "getting-started",
    moduleRoute: "/admin",
    keywords: "onboarding activation get selling checklist open shop go live first sale payments shipping publish setup guide progress",
    updated: "2026-07-12",
    body: `# Get selling fast

The **Launch Playbook** drafts your brand and your site. **Get Selling Fast** is what comes next: the shortest path from that draft to a shop a stranger can actually buy from. You'll find it at the top of your **Dashboard** as a progress ring with a short, ordered checklist.

## It watches your real shop, not a to-do list

Every step ticks itself off the moment you actually do it — because each one reads your live shop, not a box you check. Add a priced product and the product step goes green on its own. Connect Stripe and payments turns green. There's nothing to mark "done" by hand and nothing to fake: when the ring hits the point where a real order can go through, the guide tells you **you're open for business** and then quietly steps aside.

## The steps

1. **Set your brand basics** — done for you if you've been through the Launch Playbook. Your name, voice, and look so the storefront and every document feel like you.
2. **Add your first product** — nothing sells until there's something to buy. One product that's **priced** and set to **available** is enough to open. ([Products guide](/admin/support/kb/products).)
3. **Connect payments** — the step that turns a website into a store. Stripe deposits sales straight to your bank. Set it up under **Account → Settings**.
4. **Set how orders reach buyers** — add a shipping rate (**Finance → Shipping**), or mark your shop pickup/digital-only, so checkout can total an order.
5. **Open your storefront** — publish your shop so the world can visit. Your address is live the moment a page is public.
6. **Make your first sale** — send your shop link to your list and your socials. The **Share your shop** button copies your public address to your clipboard.

## When you don't see it

The guide hides itself on the public demo shop, and once your shop is fully open it collapses out of the way — you can bring it back any time from the **Show steps** control until you dismiss it. If something later regresses (say your only product goes out of stock and gets archived), it reappears so you're never quietly un-sellable without knowing.

> [!TIP]
> Steps stay useful after they're green — each keeps a **Review** link so you can jump back to add another product, adjust a shipping rate, or check your published pages.`,
  },
];
