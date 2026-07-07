import type { KbArticle } from "../types";

export const sourcing: KbArticle[] = [
  {
    slug: "sourcing",
    title: "Finding a maker",
    summary: "Research real, low-MOQ factories and ateliers by garment, materials, and location.",
    part: "sourcing",
    moduleRoute: "/admin/sourcing",
    keywords: "sourcing find maker factory tailor atelier perplexity research moq contact",
    screenshot: "/kb/shots/sourcing.png",
    updated: "2026-07-06",
    body: `# Finding a maker

New line and no factory yet? **Sourcing & Production → Find a Maker** does deep web research to surface **real, currently-operating** makers that fit your brief — favouring small/low-MOQ studios that take emerging brands.

## Running a search

Describe the piece: garment, materials, order quantity, preferred location, aesthetic. Verto researches and returns up to eight makers, each with a **why-it-fits** note and **citations** you can open.

## Getting real contact details

The search captures websites and, where it can verify them, phone numbers and addresses. For any lead, click **🔍 Find contact details** to run a focused lookup for that one maker's official **address, phone, WhatsApp, and email** — it never invents a number, so a blank means it couldn't verify one.

## Adding a lead

**+ Add to factories** files the maker in [Factories & Suppliers](/admin/support/kb/suppliers) as an **unverified** lead with its sources attached, ready for you to reach out and request a sample.

> [!NOTE]
> Maker research and contact lookups draw from a shared **daily research quota** per shop (see [LLM research limits](/admin/support/kb/ai-limits)). Cached results are free.`,
  },
  {
    slug: "suppliers",
    title: "Factories & Suppliers (your maker CRM)",
    summary: "A working CRM for your makers: profiles, contacts, verification, and history.",
    part: "sourcing",
    moduleRoute: "/admin/suppliers",
    keywords: "supplier factory crm verified contact add edit delete interaction log export intelligence",
    screenshot: "/kb/shots/suppliers.png",
    updated: "2026-07-06",
    body: `# Factories & Suppliers

This is your **maker CRM** — every atelier, mill, and factory you work with or are courting.

## Adding & editing

- **+ New supplier** — add a maker by hand with full contact details (address, phone, WhatsApp, email, website), capabilities, MOQ, lead time, and notes.
- Open any profile to **Edit** or **Remove** it. The profile shows a clickable contact block (address → map, tap-to-call, WhatsApp, email).

> [!NOTE]
> A supplier with **production orders** can't be deleted — that would erase the paper trail. Close or reassign those first.

## Verifying a maker

Leads added from research start **unverified**. Once you've confirmed capabilities, MOQ, and terms, open the profile and click **Mark verified** — a clear signal to your team that this maker is production-ready.

## The interaction log

Log every touchpoint — emails, calls, visits, quotes, sample feedback — right on the profile, with a "needs response" flag so nothing goes cold.

## Live export intelligence

The **Export intelligence** panel researches the current trade lane for a maker (e.g. Morocco → United States): the applicable agreement, duty summary, required documents, freight ballparks, and non-obvious gotchas (rules of origin, quotas, labelling) — with sources, cached for a day. See also [Duties & landed cost](/admin/support/kb/duties).`,
  },
  {
    slug: "materials",
    title: "Fabrics & Materials",
    summary: "Your cloth and trims library — origin drives duty qualification.",
    part: "sourcing",
    moduleRoute: "/admin/materials",
    keywords: "fabric trim material composition weight gsm origin price moq lead time",
    screenshot: "/kb/shots/materials.png",
    updated: "2026-07-06",
    body: `# Fabrics & Materials

**Sourcing & Production → Fabrics & Materials** is your library of **fabrics** and **trims**.

## Fabrics

Add a fabric with its **composition**, **weight (gsm)**, **origin country**, price per metre, currency, lead time, and MOQ. Link it to the supplier you buy it from. Edit or delete any row.

> [!WARNING]
> **Origin country matters.** It drives duty qualification — many trade programs use a *yarn-forward* rule of origin. Recording where a fabric is made lets your [cost sheets](/admin/support/kb/costing) and [duty rules](/admin/support/kb/duties) reflect reality.

## Trims

Buttons, zips, labels, elastics — add each with a spec, price per unit, and supplier. Trims and fabrics feed a style's bill of materials in the [tech pack](/admin/support/kb/tech-packs).`,
  },
  {
    slug: "samples",
    title: "Samples",
    summary: "Track every sampling round — proto, fit, SMS, PP, TOP — against style and atelier.",
    part: "sourcing",
    moduleRoute: "/admin/samples",
    keywords: "sample proto fit sms pp top round status request atelier approve",
    screenshot: "/kb/shots/samples.png",
    updated: "2026-07-06",
    body: `# Samples

Sampling is where a design becomes a real garment. Verto tracks every round against its style and atelier.

## The sampling ladder

**Proto → Fit → SMS → PP → TOP.** Each is a round with a purpose:

- **Proto** — first shape
- **Fit** — on-body corrections
- **SMS** — salesman sample
- **PP** — pre-production
- **TOP** — top of production

## Requesting a sample

Click **Request sample**, pick the style and atelier, choose the round type, and add notes on what changed and what to check on arrival. Verto numbers the round automatically. Update status inline as it moves (requested → shipped → received → approved), or delete a round you filed by mistake. Approving a sample records an event you'll see reflected in production.`,
  },
  {
    slug: "purchase-orders",
    title: "Purchase Orders",
    summary: "Raise production orders to factories with line items, status, and a running total.",
    part: "sourcing",
    moduleRoute: "/admin/purchase-orders",
    keywords: "purchase order po production factory line item incoterms ex-factory status total",
    screenshot: "/kb/shots/purchase-orders.png",
    updated: "2026-07-06",
    body: `# Purchase Orders

A **Purchase Order (PO)** is a production order to a factory — pilot runs first, scale later.

## Creating a PO

Click **+ New PO**, choose the **supplier**, set currency and (optionally) incoterms and ex-factory date, then add **line items** — a description, an optional style link, a quantity, and a unit cost. Verto:

- **Auto-numbers** the PO (\`PO-YYYY-NNN\`),
- Sums the line items into a **running total**.

## Managing a PO

Open any PO to edit it: change **status** (draft → sent → confirmed → in production → QC → shipped → received), update dates and incoterms, add or remove **line items** (the total recomputes), or delete the PO.

> [!TIP]
> Marking a PO **received** stamps the received date — a clean record for reconciling against what actually landed and updating inventory.`,
  },
  {
    slug: "production",
    title: "The production board",
    summary: "Tasks, stages, and a timeline that keep a collection moving.",
    part: "sourcing",
    moduleRoute: "/admin/production",
    keywords: "production task stage kanban timeline calendar owner due risk milestone",
    screenshot: "/kb/shots/production.png",
    updated: "2026-07-06",
    body: `# The production board

**Sourcing & Production → Production** is the operational heartbeat — everything that has to happen to get a collection made, in one place.

## Views

- **Kanban** — drag tasks across stages to update status at a glance.
- **Table** — a sortable list with owner, style, supplier, due date, and risk flag. Delete a task here.
- **Timeline** — a Gantt-lite view over your calendar windows.

## Tasks

Create a task with a title, stage, owner, linked style/supplier, due date, and a **risk flag** for anything at risk of slipping. Some tasks appear automatically — approving a sample or logging a 3D fit issue files the follow-up for you.`,
  },
];
