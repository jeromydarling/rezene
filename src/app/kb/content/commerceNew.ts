import type { KbArticle } from "../types";

/**
 * Guides for the commerce, customer, wholesale, and compliance features added
 * on top of the original catalogue-to-factory tools. Kept in their own file so
 * new-feature docs stay easy to find and extend.
 */
export const commerceNew: KbArticle[] = [
  {
    slug: "discounts",
    title: "Discount codes & sales tax",
    summary: "Make codes customers type at checkout, and switch on sales tax/VAT.",
    part: "commerce",
    moduleRoute: "/admin/discounts",
    keywords: "discount code coupon promo percent amount sale tax vat stripe checkout",
    updated: "2026-07-08",
    body: `# Discount codes & sales tax

**Selling → Discounts & Tax** is where you run promotions and turn on tax — no Stripe-dashboard digging.

## Discount codes

Create a code (a **percentage** or a **fixed amount**, with an optional expiry). Behind the scenes each code becomes a Stripe coupon + promotion code, so it works the moment a customer types it at checkout. **Pause** or **resume** a code any time — the change is mirrored to Stripe so checkout always agrees.

> [!NOTE]
> You need your payment account connected first — codes are applied by Stripe as customers check out.

## Sales tax / VAT

Flip one switch to have checkout calculate and add the right sales tax or VAT for each customer's address automatically. One-time setup: turn on **Stripe Tax** in your Stripe account and set your business address, then enable the toggle here.`,
  },
  {
    slug: "returns",
    title: "Returns & refunds",
    summary: "Review a return and refund + restock in one step.",
    part: "commerce",
    moduleRoute: "/admin/returns",
    keywords: "return rma refund restock exchange customer",
    updated: "2026-07-08",
    body: `# Returns & refunds

When a customer asks to send something back, it lands in **Selling → Returns**.

## How it works

A customer starts a return from their account on any paid order — they pick the pieces and a reason. You review it here and either:

- **Approve & refund** — issues the Stripe refund against the order and (with the restock toggle on) puts the pieces back into stock, in one step.
- **Decline** — with a private note.

Approving records everything: the refund shows on the order, and restocked pieces get an inventory *return* movement, so stock and history stay honest.`,
  },
  {
    slug: "reviews",
    title: "Product reviews",
    summary: "Verified-buyer reviews, with light-touch moderation.",
    part: "commerce",
    moduleRoute: "/admin/reviews",
    keywords: "review rating stars verified buyer moderation feedback",
    updated: "2026-07-08",
    body: `# Product reviews

Only someone who **bought the piece on a paid order** can review it — so reviews are trustworthy by construction, and there's no fake-review surface.

Customers write a review (a star rating plus optional title and note) from an order in their account. Reviews publish automatically and show on the product page with an average rating.

Under **Selling → Reviews** you can **hide** anything off-topic or **delete** spam. That's the whole job — it's a light-touch queue.`,
  },
  {
    slug: "customer-accounts",
    title: "Customer accounts",
    summary: "Passwordless accounts: order tracking, reorder, wishlist.",
    part: "commerce",
    moduleRoute: "/admin/customers",
    keywords: "account login magic link order history tracking reorder wishlist address",
    updated: "2026-07-08",
    body: `# Customer accounts

Shoppers get an optional, passwordless account on your storefront — guest checkout is unchanged.

They enter their email, receive a one-time sign-in link, and from there can:

- See their **order history** with live carrier **tracking**.
- **Reorder** a past order in one tap.
- Save **addresses** and keep a **wishlist** (the heart on any product page).

Accounts are created automatically with a customer's first order. Sign-in emails send once your buyer-email sending domain is configured.`,
  },
  {
    slug: "win-back",
    title: "Back-in-stock & abandoned cart",
    summary: "Recover lost sales automatically, on brand.",
    part: "commerce",
    moduleRoute: "/admin/inventory",
    keywords: "back in stock waitlist restock abandoned cart recovery email win-back",
    updated: "2026-07-08",
    body: `# Back-in-stock & abandoned cart

Two automatic win-backs, both sent in your brand's colours.

## Back-in-stock

On a sold-out product page a shopper can leave their email. The moment you restock that piece (stock goes from zero to available in **Inventory**), everyone waiting is emailed — once each.

## Abandoned cart

If a shopper reaches checkout, enters their email, but doesn't pay, they get one friendly nudge back to the pieces they left behind.

Both send once your buyer-email sending domain is configured.`,
  },
  {
    slug: "email-customers",
    title: "Email your customers",
    summary: "Broadcast a branded email to a customer segment.",
    part: "marketing",
    moduleRoute: "/admin/marketing",
    keywords: "email marketing broadcast newsletter customers repeat segment unsubscribe",
    updated: "2026-07-08",
    body: `# Email your customers

From **Marketing → Email customers**, send a branded email to the people who actually bought from you — the most valuable list you own.

Pick a segment (live counts shown): **All customers**, **Repeat customers** (two or more orders), or **Newsletter subscribers**. Write a subject and message — use \`{{SHOP_URL}}\` to drop in a link to your shop — and send. It goes out in your colours and logo with an unsubscribe link added automatically.

Unsubscribes are honoured everywhere: once someone opts out, no future send reaches them.`,
  },
  {
    slug: "loyalty",
    title: "Loyalty & referrals",
    summary: "Reward repeat customers with store credit they redeem at checkout.",
    part: "commerce",
    moduleRoute: "/admin/discounts",
    keywords: "loyalty referral store credit reward points redeem discount friend",
    updated: "2026-07-08",
    body: `# Loyalty & referrals

Turn on a rewards programme under **Selling → Discounts & Tax → Loyalty & referrals**.

## What you set

- **Credit earned per order** — a percentage of each order that comes back to the customer as store credit.
- **Referrer reward** — the credit a customer earns when a friend they referred makes a first order.
- **Friend's first-order discount** — the welcome discount their friend gets.

## How customers use it

In their account's **Rewards** tab, customers see their credit balance and a shareable **referral code**. They **redeem** credit — turning any amount into a one-time discount code — and enter that code at checkout. Because credit becomes a normal Stripe promotion code, it just works with the existing checkout; you need Stripe connected.

> [!NOTE]
> Credit is earned automatically when an order is paid, and a referral is rewarded the moment the referred friend places their first paid order.`,
  },
  {
    slug: "wholesale-portal",
    title: "Wholesale buyer portal",
    summary: "Approve buyers and take orders at their own pricing, with net terms.",
    part: "commerce",
    moduleRoute: "/admin/line-sheets",
    keywords: "wholesale b2b buyer portal account approve discount net terms order invoice moq",
    updated: "2026-07-08",
    body: `# Wholesale buyer portal

Your line sheets are also a real ordering channel for boutiques.

## Approving buyers

A buyer applies at your \`/wholesale\` page. Under **Selling → Line Sheets → Buyers**, review each application and **approve** it with a **trade discount %** and **net terms** (payment days). A pending count shows on the button.

## How they order

Approved buyers sign in with an emailed link and browse your active line sheets at **their own pricing**, placing an order with your per-style minimums enforced.

## Managing orders

Under **Buyers'** sibling, **Orders**, move each wholesale order through *submitted → confirmed → invoiced → paid*. Marking it **invoiced** stamps a due date from that buyer's terms.`,
  },
  {
    slug: "data-export",
    title: "Export your data",
    summary: "Download products, customers, and orders as CSV.",
    part: "finance",
    moduleRoute: "/admin/analytics",
    keywords: "export csv download products customers orders backup accountant spreadsheet reorder",
    updated: "2026-07-08",
    body: `# Export your data

Your data is yours. On **Analytics** there's an **Export your data** panel with one-click CSV downloads for **products**, **customers**, and **orders** — open them in a spreadsheet or hand them to your accountant.

## For your accountant (QuickBooks / Xero)

The same panel has two accounting exports: a **Sales CSV** (one row per paid order, split into net sales, discount, shipping, tax, and total — imports as invoices/sales receipts) and a **Journal CSV** (a monthly summary as debit/credit lines you can import as a manual journal). A live sync to QuickBooks/Xero is a future add-on; these CSVs cover the import path today.

You'll also find **reorder suggestions** at the top of **Inventory**: every piece at or below its low-stock threshold with nothing incoming, shown with its 90-day sales pace and a suggested reorder quantity.`,
  },
  {
    slug: "product-passport",
    title: "Digital Product Passport",
    summary: "A public, printable passport per piece — composition, care, origin.",
    part: "commerce",
    moduleRoute: "/admin/products",
    keywords: "passport dpp sustainability composition care origin traceability compliance eu",
    updated: "2026-07-08",
    body: `# Digital Product Passport

Every published product has a public **passport** page at \`/passport/<product>\` — the direction EU textile rules are heading, and a genuine trust signal for conscious buyers today.

It's built entirely from fields you already keep on a product — **composition**, **care**, and **made-in** — so there's nothing extra to fill in. The page has a **Print** action, so it's ready for a hang-tag or care label, and it's linked from each product page.`,
  },
];
