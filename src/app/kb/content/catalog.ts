import type { KbArticle } from "../types";

export const catalog: KbArticle[] = [
  {
    slug: "products",
    title: "Adding and editing products",
    summary: "Create a product, fill its details, add variants, and publish it live.",
    part: "catalog",
    moduleRoute: "/admin/products",
    keywords: "product create edit new price publish catalog merchandising draft slug",
    screenshot: "/kb/shots/products.png",
    updated: "2026-07-06",
    body: `# Adding and editing products

A **Product** is a listing your customers can buy on the storefront. This is different from a **Style** (the design-side record) — see [Styles vs. Products](/admin/support/kb/styles-vs-products) for how they relate.

## Create a product

1. Go to **Catalog → Products** and click **New product**.
2. Give it a **name**, a **base price**, and a **category**. That creates a draft.
3. You land in the product editor.

## Fill in the editor

The editor has everything a storefront listing needs:

- **Name, subtitle, description** — the copy shoppers read.
- **Audience & category** — how it's filed and filtered.
- **Collection** — optionally group it into a season/capsule (see [Collections](/admin/support/kb/collections)).
- **URL slug** — the web address, auto-suggested from the name.
- **More fields** — expand for fabric, care, origin, and fit notes.

Click **Save** to persist changes.

## Make it buyable

> [!WARNING]
> A product is **not** buyable until it has at least one **variant** and is **published**.

1. Under **Colours & sizes**, add each colour + size combination you sell (see [Colours, sizes & SKUs](/admin/support/kb/variants)).
2. Click **Publish**. The listing appears on your storefront right away — publishing is instant.

## Editing later

Open any product from the list to edit it. Changes to a published product go live when you save. To pull a product from sale, unpublish it — it stays in your catalog as a draft.`,
  },
  {
    slug: "variants",
    title: "Colours, sizes & SKUs",
    summary: "Each colour+size is a sellable SKU with its own stock and optional price.",
    part: "catalog",
    moduleRoute: "/admin/skus",
    keywords: "variant sku size colour colorway stock sellable price override barcode",
    screenshot: "/kb/shots/skus.png",
    updated: "2026-07-06",
    body: `# Colours, sizes & SKUs

Every buyable combination of **colour and size** is a **variant** — the sellable SKU. A "Linen Shirt" in Ecru / M is one variant; Ecru / L is another.

## Adding variants

In the product editor, open **Colours & sizes**:

1. Enter a **colour**, a **size**, and an optional **starting stock**.
2. Click **Add**.

You can also give each variant its own **SKU code** (your internal identifier) and a **price** that overrides the product's base price — useful when a colourway costs more to make.

## Inventory is automatic

Every variant automatically gets an **inventory line**. Edit the stock number inline and Verto records an inventory movement, so your history stays accurate. Remove a variant with the **✕**.

## The SKUs screen

**Catalog → SKUs** is the flat, cross-product list of every variant — handy for a quick stock scan or bulk edits. You can add, edit, and remove SKUs there too, and import them in bulk via the [Import Studio](/admin/support/kb/import).

> [!TIP]
> The real demand curve for sizes and colourways shows up in **Analytics** once orders arrive — use it to weight your next production run instead of guessing.`,
  },
  {
    slug: "inventory",
    title: "Managing inventory",
    summary: "On-hand, reserved, and incoming stock — and how to adjust it with a paper trail.",
    part: "catalog",
    moduleRoute: "/admin/inventory",
    keywords: "inventory stock on hand reserved adjust receive count damage return ledger",
    screenshot: "/kb/shots/inventory.png",
    updated: "2026-07-06",
    body: `# Managing inventory

**Catalog → Inventory** lists every variant's stock: **on-hand**, **reserved**, **incoming**, and a **low-stock** flag.

## Adjusting stock

Click **Adjust** on any line to:

- **Receive** stock (a delivery arrived)
- **Record a sale** (offline/wholesale)
- **Reserve / release** units
- **Log damage or returns**
- **Make a manual correction** (a count fix)

Every adjustment is written to an inventory ledger, so you can always see *why* a number changed — not just what it is.

## Stock that moves on its own

- A **paid order** decrements on-hand automatically.
- A **pre-order** counts against its campaign allocation.

> [!NOTE]
> If a variant shows **no inventory line**, make sure the product actually has that colour/size variant. Inventory lines are created with variants — see [Colours, sizes & SKUs](/admin/support/kb/variants).`,
  },
  {
    slug: "collections",
    title: "Collections",
    summary: "Group products into seasons or capsules on the storefront.",
    part: "catalog",
    moduleRoute: "/admin/collections",
    keywords: "collection season group capsule create delete hero",
    screenshot: "/kb/shots/collections.png",
    updated: "2026-07-06",
    body: `# Collections

**Collections** group products into seasons or capsules on your storefront — "SS26", "The Linen Edit", "Archive".

## Managing collections

Go to **Catalog → Collections**:

- **New collection** — create one with a name and optional season.
- **Edit** — add copy, a hero image, and publish it.
- **Delete** — removes the grouping only. Products in it simply become uncollected; they are **not** deleted.

## Assigning products

Set a product's collection from the **Collection** dropdown in the product editor. A product can belong to one collection at a time.`,
  },
  {
    slug: "import",
    title: "The Import Studio",
    summary: "Bulk-import products, variants, and prices from a CSV with AI column mapping.",
    part: "catalog",
    moduleRoute: "/admin/import",
    keywords: "import csv bulk upload spreadsheet mapping ai migrate shopify",
    screenshot: "/kb/shots/import.png",
    updated: "2026-07-06",
    body: `# The Import Studio

Moving a catalog in from a spreadsheet (or another platform's export)? **Catalog → Import Studio** turns a CSV into real products, variants, and prices.

## How it works

1. **Upload or paste** your CSV.
2. Verto **analyzes the columns** — AI (with a heuristic fallback) maps your headers to Verto fields like name, price, colour, size, SKU, and description. It's smart about messy real-world headers ("Product Title", "Variant SKU", etc.).
3. **Review the mapping** and the previewed rows. Fix any column that mapped wrong.
4. **Apply** — rows are grouped by product name, so multiple size/colour rows collapse into one product with many variants.

> [!TIP]
> Export from your old platform, drop the CSV in here, and you've migrated a catalog in minutes instead of retyping it. Start with a 10-row sample to confirm the mapping, then run the full file.`,
  },
];
