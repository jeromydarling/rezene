import type { KbArticle } from "../types";

export const finance: KbArticle[] = [
  {
    slug: "costing",
    title: "Costing & margins",
    summary: "Build a cost sheet, add destination markets, and see true landed margin.",
    part: "finance",
    moduleRoute: "/admin/costing",
    keywords: "cost sheet margin landed destination scenario fabric cmt freight retail wholesale ai benchmark",
    screenshot: "/kb/shots/costing.png",
    updated: "2026-07-06",
    body: `# Costing & margins

A **cost sheet** tells you what a style really costs to make and land — and the margin left at your price, market by market.

## Building a sheet

1. **Finance → Costing → New cost sheet**, pick a style.
2. Open it and fill the cost lines: fabric, trims, cut/sew/make, sample allocation, packaging, freight, insurance, duty, payment processing, returns reserve.
3. Verto totals them and shows **gross margin** against your target or actual retail.

## Let AI benchmark it

On any sheet, open **🔍 Fill with AI benchmarks**. Describe the garment, where it's made, and where it sells, and Verto benchmarks a first-pass per-unit breakdown (fabric, trims, CMT, packaging, freight) plus a suggested retail and margin — with sources. Click **Apply** to fill the sheet, then adjust to your real quotes.

## Destinations (landed cost by market)

Add a **destination** to a sheet to model a specific market. Duty is charged on production cost + freight to that market, so each destination carries its own freight/insurance and pulls a duty rate. Verto computes the **landed cost** and **margin** per market. Pull duty rates from the [Duties engine](/admin/support/kb/duties).

> [!NOTE]
> Everything here is an estimate to plan with — not customs advice. Confirm duty rates against an official source before you commit.`,
  },
  {
    slug: "duties",
    title: "Duties & landed cost",
    summary: "An editable duty-rules engine with an AI HS-code + rate lookup.",
    part: "finance",
    moduleRoute: "/admin/duties",
    keywords: "duty tariff hs code landed cost rule preferential yarn forward estimate ai lookup",
    screenshot: "/kb/shots/duties.png",
    updated: "2026-07-06",
    body: `# Duties & landed cost

This is an **editable rules engine**, not a customs authority. It holds the duty rules for your trade lanes so costing and quotes reflect real tariffs.

## Duty rules

Each rule captures a **destination region**, **origin country**, an optional **HS category**, the **qualifying condition** (e.g. a yarn-forward rule of origin for a preferential 0%), and a **duty-rate range**. Toggle a rule active/off, or delete it.

## Add a rule with AI

Click **+ New duty rule** and use **🔍 Look up HS code & duty rate**: describe a garment and a trade lane (e.g. woven cotton shirt, Morocco → United States) and Verto drafts the rule — HS category, rule-of-origin condition, and a duty-rate range — with sources. Review, then save.

## Quick estimator

The estimator applies your active rules for a destination to a base cost + freight and returns the duty and landed-cost range per rule.

> [!WARNING]
> Duty figures are **estimates only** — not legal or customs advice. Final classification requires trade/legal review.`,
  },
  {
    slug: "shipping",
    title: "Shipping zones & rates",
    summary: "Set storefront shipping with manual rates or a carrier integration.",
    part: "finance",
    moduleRoute: "/admin/shipping",
    keywords: "shipping zone rate carrier dhl shippo easypost manual delivery",
    updated: "2026-07-06",
    body: `# Shipping zones & rates

**Finance → Shipping** controls what customers pay for delivery. Define **zones** (by country/region) and **rates** within each — flat, weight-based, or free-over-threshold.

Verto supports **manual rates** out of the box and can plug into carriers (DHL, Shippo, EasyPost, ShipEngine, Sendcloud, Easyship) when you're ready for live rates and labels. Create and remove zones and rates as your markets grow.`,
  },
  {
    slug: "analytics",
    title: "Analytics",
    summary: "Sales, traffic, the buying funnel, and the real size/colour demand curve.",
    part: "finance",
    moduleRoute: "/admin/analytics",
    keywords: "analytics revenue orders funnel conversion best sellers size curve colorway traffic country",
    screenshot: "/kb/shots/analytics.png",
    updated: "2026-07-06",
    body: `# Analytics

**Finance → Analytics** shows how the shop is doing over 7 / 30 / 90 days: revenue, orders, average order value, units, visitors, conversion, and signups — each versus the previous period.

## Beyond vanity metrics

- **From browsing to buying** — the funnel from visit → product view → cart → checkout → purchase, with drop-off at each step and abandoned-checkout counts.
- **Best sellers vs. most viewed** — a product with lots of views but few sales usually has a price, photo, or size question to answer.
- **Demand by size & colourway** — your **real size curve** from actual orders. Use it to weight your next production run instead of guessing.
- **Where buyers come from** — traffic sources, visitor and order countries, top pages.

Analytics is a read-only reporting surface — it's built from what actually happens in the shop.`,
  },
];
