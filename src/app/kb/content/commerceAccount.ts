import type { KbArticle } from "../types";

export const commerceAccount: KbArticle[] = [
  // ---- Selling ----
  {
    slug: "orders",
    title: "Orders & customers",
    summary: "How storefront checkouts become orders, and how customers accumulate.",
    part: "commerce",
    moduleRoute: "/admin/orders",
    keywords: "order customer checkout stripe payment fulfilment shipment",
    screenshot: "/kb/shots/orders.png",
    updated: "2026-07-06",
    body: `# Orders & customers

## Orders

An **order** is created when a customer checks out and pays via **Stripe**. Each order (under **Selling → Orders**) shows its items, payment status, and shipping. Paid orders decrement inventory automatically. Orders originate at checkout — they're a system record, so there's no manual "create order" here; fulfilment and shipments are managed on the order.

## Customers

**Customers** accumulate as people buy — no manual entry. Each shows their order history, and Analytics tracks how many are repeat buyers.`,
  },
  {
    slug: "pre-orders",
    title: "Pre-orders & demand campaigns",
    summary: "Sell before stock exists and count demand against a goal.",
    part: "commerce",
    moduleRoute: "/admin/pre-orders",
    keywords: "pre-order preorder campaign goal funded demand deposit production",
    updated: "2026-07-06",
    body: `# Pre-orders & demand campaigns

Pre-orders let you **sell before stock exists** and prove demand before you commit to a production run.

## How it works

Create a campaign for a product with a **goal** (units). Customers pre-order; Verto counts orders against the goal. When the goal is met, the campaign is marked **funded** and a **production task** is created to kick off making it.

> [!TIP]
> Pre-orders turn guesswork into evidence: you book the run you *know* sells, in the sizes and colours people actually reserved.`,
  },
  {
    slug: "line-sheets",
    title: "Wholesale line sheets",
    summary: "Share a tokenized, priced line sheet with buyers and take wholesale interest.",
    part: "commerce",
    moduleRoute: "/admin/line-sheets",
    keywords: "wholesale line sheet buyer stockist price quantity tokenized share",
    updated: "2026-07-06",
    body: `# Wholesale line sheets

**Selling → Line Sheets** creates a shareable, priced catalog for wholesale buyers.

Build a sheet, set per-item wholesale **price and minimums**, and share a **tokenized link** — buyers browse and register interest without a login. Revoke the link anytime. Create, edit item pricing, and remove sheets as your wholesale programme grows.`,
  },
  // ---- Account ----
  {
    slug: "team",
    title: "Team & roles",
    summary: "Invite teammates, set roles, and manage access safely.",
    part: "account",
    moduleRoute: "/admin/team",
    keywords: "team user invite role admin operations viewer deactivate remove password",
    screenshot: "/kb/shots/team.png",
    updated: "2026-07-06",
    body: `# Team & roles

**Account → Team** lets admins invite teammates by email. Each person sets their **own password** from an invite link — no shared logins.

## Roles

- **Admin** — everything, including team and settings
- **Operations** — day-to-day work
- **Viewer** — read-only

Change a role, deactivate, or remove anyone from the same screen. The **last admin can't be removed**, so you never lock yourself out. See also [Accounts, roles & security](/admin/support/kb/accounts-and-security).`,
  },
  {
    slug: "domain",
    title: "Connect a custom domain",
    summary: "Point your own domain at your Verto shop with a simple CNAME.",
    part: "account",
    moduleRoute: "/admin/domain",
    keywords: "domain custom cname dns connect subdomain registrar verify",
    screenshot: "/kb/shots/domain.png",
    updated: "2026-07-06",
    body: `# Connect a custom domain

By default your shop lives at a Verto address. **Account → Custom Domain** connects your own.

## The steps

1. Enter the domain (or subdomain, e.g. \`shop.yourbrand.com\`) you want to use.
2. Verto shows the exact **CNAME** record to add at your registrar, with copy-paste values and step-by-step instructions for the major registrars.
3. Add the record, then click **Check** — Verto looks up your DNS and confirms when it's pointing correctly.

Once connected, your storefront, SEO output, and sitemaps all serve on your domain. DNS can take a little while to propagate — the checker tells you when it's live.`,
  },
  {
    slug: "settings",
    title: "Settings & integrations",
    summary: "Your brand identity, integration status, and your own password.",
    part: "account",
    moduleRoute: "/admin/settings",
    keywords: "settings brand name tagline integration stripe ai password change",
    updated: "2026-07-06",
    body: `# Settings & integrations

**Account → Settings** holds the essentials.

- **Brand** — name, tagline, and identity. Change them here and they update everywhere, from the storefront to your tech pack covers.
- **Integrations** — at-a-glance status for Payments (Stripe) and LLM assistance. Connection keys live as encrypted secrets outside the app.
- **Change password** — update your own password; all other sessions sign out.`,
  },
  {
    slug: "ai-limits",
    title: "LLM research limits",
    summary: "How the shared daily quota on paid LLM research works.",
    part: "account",
    moduleRoute: "/admin/sourcing",
    keywords: "ai quota limit research perplexity daily cap rate limit cost",
    updated: "2026-07-06",
    body: `# LLM research limits

Some features do **live web research** (Find a Maker, contact lookups, export intelligence, the duty and costing LLM helpers). These run on Verto's research provider and share one **daily quota per shop**.

## What counts

- Only a **real research call** counts against the quota. **Cached** results (like a lane's export intelligence you already looked up today) are free.
- All research features draw from the **same daily bucket**, so the limit is on total research per shop per day.

If you hit the cap, you'll see a friendly message — it resets at **00:00 UTC**. If your team genuinely needs a higher limit, ask us.`,
  },
  {
    slug: "support",
    title: "Getting help & sending feedback",
    summary: "Use this handbook, the help-dots, and the one-tap report to reach us.",
    part: "account",
    moduleRoute: "/admin/support",
    keywords: "help support knowledge base feedback bug feature report question",
    updated: "2026-07-06",
    body: `# Getting help & sending feedback

You're reading it — this **Knowledge Base** is the complete field guide to Verto. Search it from the top of any page here, or browse by Part in the sidebar.

## Help-dots

Throughout the app, small **?** dots sit next to screen titles and controls. Hover for a one-line explanation; click **Open guide** to jump to the exact chapter here.

## Tell us something

The **Report a bug or idea** button (top-right) sends a note straight to the Verto team — a bug, a feature request, or a question. We automatically attach the page you're on, so we can find it fast.`,
  },
];
