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
    slug: "automations",
    title: "Automations — Verto thinks ahead for you",
    summary: "Built-in rules that watch your shop and file the obvious next step: tasks, draft orders, reminders.",
    part: "account",
    moduleRoute: "/admin/automations",
    keywords: "automations rules triggers workflow auto task draft calendar activity feed toggle",
    updated: "2026-07-11",
    screenshot: "/kb/shots/automations.png",
    body: `# Automations

Verto watches what happens in your shop and files the obvious next step for you, so nothing falls through the cracks between modules. Every rule is a plain sentence, every rule can be paused, and **no rule ever changes or deletes anything** — automations only create tasks, drafts, and reminders. The worst surprise is a task you delete.

## The built-in rules

- **Sample approved → draft the production order.** Approve a sample and Verto drafts a purchase order to that maker (auto-numbered, waiting for line items) plus a task to finalise it.
- **Order confirmed → ex-factory reminder.** A task to chase the shipment lands on the promised ex-factory date.
- **Order received → reconcile the delivery.** A task to check the delivery against the order and update stock.
- **R&D lead promoted → follow up.** Promote a maker from [R&D](/admin/support/kb/rd-research) and a reach-out task appears, due in a week.
- **Commission moves stage → next step.** Each stage files its natural follow-up — source the fabric, schedule the fitting, arrange the handover.
- **Product published → draft the launch kit.** Publish a product and Verto drafts a launch campaign for it in [Marketing](/admin/support/kb/marketing) — an Instagram caption, a launch email, and an SEO article, all in your brand voice and grounded in the product. They land as **editable drafts**: nothing posts or sends on its own. Open the campaign, edit anything, schedule it, and send when you're ready. If your shop has no AI provider configured, Verto still starts the campaign so you can generate it with one click.
- **Back in stock → “it's back” post.** When a sold-out product is restocked, Verto drafts a warm back-in-stock post. (Your waitlist is emailed automatically and separately — that's transactional, not a draft.)
- **Low stock → urgency post.** When a product runs low, Verto drafts an honest “selling fast” post — real scarcity, never fake countdowns.
- **Sold out → sold-out note.** When a product sells out, Verto drafts a gracious sold-out post that points to your waitlist or next drop.
- **Trend adopted → season angle.** Adopt a trend board into the Design Studio and Verto drafts a campaign angle for that season direction.
- **New review → repost.** When a customer leaves a review, Verto drafts a tasteful repost that quotes them and credits them by first name.

Every one of these lands as an **editable draft in Marketing** — you edit, schedule, and send. Nothing is posted or emailed to customers without your say-so.

Toggle any rule on the **System → Automations** page. The **Recent activity** feed beside the toggles shows everything Verto noticed — the events your automations react to.

## The calendar fills itself in

The [Production board](/admin/support/kb/production)'s calendar now shows **derived entries** automatically: purchase-order production windows and ex-factory deadlines, commission due dates, consult bookings, and scheduled content — anything dated that already lives in your shop. Derived entries are marked \`auto\`, link back to their record, and can't be deleted from the calendar (change the source record instead).

## Undo instead of "are you sure?"

Deleting a research note or maker, a production task, or a sample round no longer interrupts you with a confirmation — the toast that appears offers **Undo**, and one click brings the record back exactly as it was.

## Edits save themselves

Where you write at length (research note bodies today, more editors over time), changes save automatically a moment after you stop typing — the "Saved" chip below the editor confirms it. There is no save button to forget.

## What needs your attention

The Dashboard opens with a card of what's **stuck** — overdue tasks, orders past their ex-factory date, sample rounds waiting over two weeks, maker messages awaiting a response, overdue commissions, unconfirmed consults. The calendar says what's scheduled; this card says what needs a human. It disappears when nothing needs you.`,
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
