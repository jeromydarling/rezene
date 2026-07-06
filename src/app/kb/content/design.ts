import type { KbArticle } from "../types";

export const design: KbArticle[] = [
  {
    slug: "styles-vs-products",
    title: "Styles vs. Products (and where tech packs attach)",
    summary: "The design record vs. the storefront listing — and how they connect.",
    part: "design",
    moduleRoute: "/admin/styles",
    keywords: "style product tech pack relationship pipeline missing development",
    screenshot: "/kb/shots/styles.png",
    updated: "2026-07-06",
    body: `# Styles vs. Products

These two look similar but do different jobs:

- A **Style** is the **design-side record** of a garment as it moves through development: concept → design → tech pack → sampling → approved → production.
- A **Product** is the **storefront listing** you sell.

They're related but separate — a product can optionally point back to the style it came from, so you can trace a listing to its spec.

## Where tech packs live

> [!NOTE]
> Tech packs attach to **Styles**, not products. Each style has one tech pack — the manufacturing spec you send the factory.

## "Missing tech pack"

If a style shows **Missing tech pack**, that style simply has no tech pack record yet. Fix it by opening the style (or **Tech Packs → the style**) and creating one — start from a template, or let AI rough it in, then refine the measurements, BOM, and construction. See [Building the factory spec](/admin/support/kb/tech-packs).`,
  },
  {
    slug: "tech-packs",
    title: "Tech packs: building the factory spec",
    summary: "Graded measurements, BOM, construction, annotated flats, and Excel export.",
    part: "design",
    moduleRoute: "/admin/tech-packs",
    keywords: "tech pack measurements bom construction grading factory export excel flat sketch annotate",
    screenshot: "/kb/shots/tech-packs.png",
    updated: "2026-07-06",
    body: `# Tech packs: building the factory spec

A **tech pack** is the complete manufacturing spec a factory needs to make your garment correctly and consistently.

## What's in it

- **Graded measurements** with tolerances (the points of measure across every size)
- **Bill of materials (BOM)** — every fabric, trim, and label
- **Construction & stitch details**
- **Labels & packaging**
- **Annotated flat sketches** — drop numbered pins on a flat to call out exact construction points

## Working in a tech pack

Open a tech pack and edit each section inline. When it's ready:

- **Export to Excel** — a clean, multi-sheet workbook the factory can open anywhere.
- **Share a factory link** — a read-only, tokenized web page for the maker (no login required). Revoke it anytime.

## Starting fast

You don't have to build from a blank page. Create a tech pack **from a template** for common garment types, or use **AI assist** to rough in a first draft from a description or sketch, then refine. See also [Send a design straight to a maker](/admin/support/kb/design-studio#ship-to-a-maker).`,
  },
  {
    slug: "design-studio",
    title: "The AI Design Studio",
    summary: "Generate real garment concepts with Flux, iterate, and ship them to a maker.",
    part: "design",
    moduleRoute: "/admin/ai-concepts",
    keywords: "design studio flux ai image generate concept reference prompt lookbook ship maker sample",
    screenshot: "/kb/shots/design-studio.png",
    updated: "2026-07-06",
    body: `# The AI Design Studio

The Design Studio turns an idea into real, editable garment imagery — powered by **Flux**, built in. No external tools and no bring-your-own API keys.

## Generating concepts

1. Open **Design & Development → Design Studio** and start a concept.
2. Describe the garment, or use the **prompt builder** to assemble silhouette, fabric, mood, and details.
3. **Generate**. Flux returns imagery in seconds. Favourite the ones you like; each keeps its seed so you can iterate coherently.

## Reference images

Upload up to a few **reference images** (a mood shot, a fabric, an existing piece) and Flux (FLUX.2) conditions the generation on them — carrying tone, drape, and detail across your concepts for a consistent line.

## Use a look on your site

Love an image? Use it right away — attach it to a **product**, a **page**, or a **lookbook** without leaving the studio.

## Ship to a maker {#ship-to-a-maker}

When a concept is ready to become a physical sample, **ship it to a saved maker** in one move. Verto:

1. Creates a **Style** from the concept,
2. Builds a **tech pack** with the concept image as the cover,
3. Opens a **sample** request,
4. Generates a tokenized **factory-portal link**, and
5. **Emails the maker** with everything attached.

> [!SUCCESS]
> That whole design → maker handoff is one action and is race-free — the maker gets a working link to a real spec, not a screenshot.`,
  },
  {
    slug: "three-d",
    title: "The 3D simulation bridge",
    summary: "Track CLO/Browzwear/Style3D projects, fit status, and turn fit issues into tasks.",
    part: "design",
    moduleRoute: "/admin/3d",
    keywords: "3d clo browzwear style3d simulation fit render measurements project",
    updated: "2026-07-06",
    body: `# The 3D simulation bridge

Simulation happens in your 3D tool (CLO 3D, Browzwear, Style3D); the **record** lives in Verto so it's tied to the style, the samples, and the factory.

## What it tracks

- The 3D **project** attached to a style, its **tool**, and current **status**
- **Files, renders, and measurements**
- **Fit status** as it progresses

## Fit issues → tasks

Found a fit problem in simulation? **Log a fit issue** and Verto files a **sample-revision task** on the production board automatically — so the fix doesn't get lost between the 3D tool and the factory. Delete a project when it's retired.`,
  },
];
