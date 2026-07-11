import type { KbArticle } from "../types";

/**
 * How-to guides: scenario walkthroughs that string modules together into one
 * journey. Module chapters explain a page; these explain a week of work.
 */
export const howTo: KbArticle[] = [
  {
    slug: "how-to-first-piece",
    title: "How to: your first piece, from idea to a maker's inbox",
    summary: "Design a piece in the studio, spin up its tech pack, and send it to a maker — the whole journey, step by step.",
    part: "how-to",
    moduleRoute: "/admin/ai-concepts",
    keywords: "how to first design studio concept style tech pack send factory maker share link excel start beginning",
    updated: "2026-07-11",
    body: `# Your first piece, from idea to a maker's inbox

This is the whole journey — from a spark to a spec a factory can actually build. Half a day of work, most of it the fun kind.

## 1 · Design it in the studio

Open the [Design Studio](/admin/support/kb/design-studio) and describe the piece — silhouette, fabric, mood, details. Generate a few directions, refine the one you love with follow-up edits ("crop the jacket", "make the collar stand"), and pull in reference images if you have them. When a concept is right, **save it as a Style** — that's the moment an image becomes a real garment in your pipeline.

> [!TIP]
> Styles, not products, carry development. A product is what you sell later; the [style](/admin/support/kb/styles-vs-products) is what you develop now.

## 2 · Spin up the tech pack

From the style, create its **tech pack** — the manufacturing spec. Let the assistant rough in a first draft, then make it yours:

- **Measurements** — the graded spec table, straight from a template for the garment type.
- **Bill of materials** — fabrics and trims from your [materials library](/admin/support/kb/materials), so origins and prices flow through.
- **Construction notes** — seams, stitching, finishing, the details that make it yours.
- **Annotated sketch** — drop arrows and callouts right on the flat so nothing is ambiguous.

The full checklist lives in [Building the factory spec](/admin/support/kb/tech-packs).

## 3 · Find the maker

No factory yet? Two doors:

- [Find a Maker](/admin/support/kb/sourcing) researches **real, currently-operating** ateliers matched to your garment, materials, quantity, and region — with citations and verified contact details.
- The [R&D workspace](/admin/support/kb/rd-research) is where longer-term maker research lives; promote a candidate to [Factories & Suppliers](/admin/support/kb/suppliers) when they earn it.

Either way, the maker ends up as a supplier record — your CRM for everything that follows.

## 4 · Send it off

Open the tech pack and either:

- **Share a factory link** — a read-only, tokenized web page the maker opens with no login. Revoke it anytime. Best for the first conversation.
- **Export to Excel** — a clean multi-sheet workbook, for makers who live in spreadsheets.

Log the outreach on the supplier's **interaction log** so the thread never goes cold.

## 5 · What happens next

When the maker responds, [request a sample](/admin/support/kb/samples) — the proto is where your spec meets reality. From there, the [sample-to-production guide](/admin/support/kb/how-to-sample-to-production) takes over.`,
  },
  {
    slug: "how-to-made-to-measure",
    title: "How to: a made-to-measure garment for a real client",
    summary: "From a client's measurements to a drafted pattern, a cloth-physics preview, and a PDF your cutter can use.",
    part: "how-to",
    moduleRoute: "/admin/patterns",
    keywords: "how to made to measure mtm client measurements pattern draft drape preview pdf cutter bespoke",
    updated: "2026-07-11",
    body: `# A made-to-measure garment for a real client

Bespoke work is where independent designers beat every big brand. Here's the path from a tape measure to a cutting table.

## 1 · Measure the client once

Add them to the [Client Book](/admin/support/kb/client-book) and record their measurement set — it's saved for every future garment, not just this one. The measurement list matches what the pattern blocks actually use, so nothing you take goes to waste.

## 2 · Draft the pattern to their body

In the [Pattern Studio](/admin/support/kb/pattern-studio), pick the block (over thirty, from tees to corsetry to tailored coats), choose your client from the book, and the draft uses **their numbers directly** — not a graded approximation. Tune fit and length, and open the native drafting options if you want to go deep (cuff styles, collar geometry, seam allowance, cm/in).

## 3 · See it before you cut

For most blocks, **Simulate the real drape** sews the exact draft in a cloth simulator on a mannequin scaled to the same measurements — where the hem really sits, how much ease really hangs. Toggle the **fit map** (how hard the fabric works) and **pressure map** (where it presses, in kPa). Then **Render on a model** for the photoreal version your client will actually react to.

## 4 · Print for the cutter

Export the **true-scale tiled PDF** — every page carries a scale-check bar, so one ruler measurement confirms the print is exact. Or download the SVG for a projector or plotter.

## 5 · Track it as a commission

If this is paid work, run it through [Commissions](/admin/support/kb/commissions): stages from enquiry to handover, [deposits and fittings booked](/admin/support/kb/deposits-and-booking), and a [client portal](/admin/support/kb/client-portal) where they watch progress without emailing you.`,
  },
  {
    slug: "how-to-sample-to-production",
    title: "How to: from approved sample to a production run",
    summary: "Sampling rounds, the approval that drafts your PO automatically, and tracking the order to your door.",
    part: "how-to",
    moduleRoute: "/admin/samples",
    keywords: "how to sample proto fit pp top approve purchase order production run receive reconcile stock",
    updated: "2026-07-11",
    body: `# From approved sample to a production run

The unglamorous middle of fashion — where money is made or lost. Verto keeps the paper trail honest.

## 1 · Run the sampling ladder

[Request a sample](/admin/support/kb/samples) against the style and maker. Rounds follow the classic ladder — **proto → fit → SMS → PP → TOP** — each with notes on what changed and what to check on arrival. Update status as rounds move; every round stays on the record.

## 2 · Approve — and let the automation work

When you mark a sample **approved**, the [automation](/admin/support/kb/automations) files the next steps for you: a **draft purchase order** to that maker and a production task to finalise it. Nothing sends without you — it's a draft, not a commitment.

## 3 · Finalise the purchase order

Open the draft in [Purchase Orders](/admin/support/kb/purchase-orders): line items with a **size run** ("S:10, M:20, L:15" totals itself), incoterms, currency, ex-factory date. Confirm it, and the automation files an ex-factory chase task on the promised date so the deadline can't sneak past you.

## 4 · Know your landed cost before you commit

Run the style through [Costing & margins](/admin/support/kb/costing) and [Duties & landed cost](/admin/support/kb/duties) — fabric origins from the BOM drive duty qualification, so the tech pack you built earlier is already paying rent.

## 5 · Receive and reconcile

Mark the PO **received** and the automation files a reconciliation task: check the delivery against the order, then update [inventory](/admin/support/kb/inventory). The [production board](/admin/support/kb/production) shows the whole season's state at a glance — and the derived calendar entries appeared there the moment the PO was confirmed.`,
  },
  {
    slug: "how-to-launch-shop",
    title: "How to: launch your shop and make the first sale",
    summary: "Turn a finished piece into a product, open the storefront on your own domain, and announce it properly.",
    part: "how-to",
    moduleRoute: "/admin/products",
    keywords: "how to launch shop first sale product collection storefront domain seo campaign announce",
    updated: "2026-07-11",
    body: `# Launch your shop and make the first sale

The piece exists. Now it needs a shelf, an address, and an audience.

## 1 · Make it a product

Create the [product](/admin/support/kb/products) — name, story, price, photography — and its [variants](/admin/support/kb/variants) (sizes, colourways) with stock counts. If the photography isn't shot yet, see [product pages without a photo shoot](/admin/support/kb/how-to-photo-free-pages).

## 2 · Give it a home

Group pieces into a [collection](/admin/support/kb/collections) and shape the storefront in [Site content](/admin/support/kb/cms) — the homepage hero, the story page, the lookbook. Blocks, not code.

## 3 · Put it on your own domain

[Connect your domain](/admin/support/kb/domain) — one CNAME record, certificates handled for you. Then run the [Search Checkup](/admin/support/kb/seo): titles, descriptions, product schema, and the sitemap, each with a one-click fix where Verto can write it for you.

## 4 · Take real payment

Connect Stripe in [Settings](/admin/support/kb/settings). [Discount codes](/admin/support/kb/discounts) and [tax settings](/admin/support/kb/settings) are ready when you are; [customer accounts](/admin/support/kb/customer-accounts) and [order flows](/admin/support/kb/orders) work out of the box.

## 5 · Announce it like a brand

Build a [campaign kit](/admin/support/kb/campaigns) — social posts, a press note, and an email to your list, all in your voice. Small list? That's fine. A launch email to forty people who care outsells a billboard.

> [!TIP]
> Drops sell scarcity honestly: consider a [pre-order window](/admin/support/kb/pre-orders) instead of holding stock.`,
  },
  {
    slug: "how-to-commission",
    title: "How to: run a commission from enquiry to handover",
    summary: "Price it, take the deposit, book the fittings, and hand over beautifully — with the client watching progress in their portal.",
    part: "how-to",
    moduleRoute: "/admin/commissions",
    keywords: "how to commission bespoke enquiry deposit booking fitting handover client portal stages",
    updated: "2026-07-11",
    body: `# Run a commission from enquiry to handover

Commissions are relationships with a deadline. The craft is yours; this keeps the logistics from eating it.

## 1 · Capture the enquiry

Create the [commission](/admin/support/kb/commissions) against the client (add them to the [Client Book](/admin/support/kb/client-book) if they're new). Describe the piece, attach references, and set the target date. The pipeline runs **enquiry → design → sampling → fitting → finishing → handover**.

## 2 · Price it and take the deposit

Send a [deposit request](/admin/support/kb/deposits-and-booking) — a real Stripe payment link, not an IOU. The commission won't quietly start unpaid, and the money trail starts clean.

## 3 · Let the client watch (without emailing you)

Share the [client portal](/admin/support/kb/client-portal) link: they see stage, photos you choose to post, and what's next. Most "just checking in!" emails disappear here.

## 4 · Book the fittings

[Booking](/admin/support/kb/deposits-and-booking) offers your available slots; each fitting lands on the production calendar. Moving a commission's stage files the natural next task automatically — source the fabric, schedule the fitting, arrange the handover — via the [automations](/admin/support/kb/automations).

## 5 · Hand over and close

Final fitting done, garment wrapped — mark it handed over. The full history (deposits, fittings, photos, notes) stays on the record for the day they come back. They come back.

> [!TIP]
> Drafting the piece to their body? The [made-to-measure guide](/admin/support/kb/how-to-made-to-measure) covers the pattern side of the same journey.`,
  },
  {
    slug: "how-to-photo-free-pages",
    title: "How to: product pages without a photo shoot",
    summary: "Photoreal model imagery from your actual designs and drafts — colourways, try-ons, and drape-true renders.",
    part: "how-to",
    moduleRoute: "/admin/fitting",
    keywords: "how to photos without shoot render model try on colorway fitting studio drape imagery product page",
    updated: "2026-07-11",
    body: `# Product pages without a photo shoot

A shoot costs more than a sample run. Until the piece earns one, render it — from your real designs, not stock lookalikes.

## 1 · Start from something true

Three honest inputs, in order of fidelity:

- **A photo of the actual garment** — the [Fitting Studio](/admin/support/kb/look-studio) composites it onto a model (a true try-on, with the fabric re-lit first so shadows don't read as colour).
- **A drape simulation** — for pattern work, the [Pattern Studio's](/admin/support/kb/pattern-studio) cloth-physics preview anchors the render to your draft's real proportions.
- **A described design** — the studio renders from the tech pack's language when there's no physical piece yet.

## 2 · Build the set

Pick models and settings, then generate. **Colourways** repaint the same look across your palette so a five-colour drop needs one good base. **Compare view** lines up candidates side by side.

## 3 · Use them on the site

Send the keepers straight to the product's gallery. Real photography can replace them piece by piece as the brand grows — the layout never waits.

> [!NOTE]
> Taste note: render honestly. Show the garment you will actually ship — imagery that oversells cut or cloth costs you the customer exactly once.`,
  },
];
