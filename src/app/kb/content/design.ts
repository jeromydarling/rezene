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

If a style shows **Missing tech pack**, that style simply has no tech pack record yet. Fix it by opening the style (or **Tech Packs → the style**) and creating one — start from a template, or let LLM rough it in, then refine the measurements, BOM, and construction. See [Building the factory spec](/admin/support/kb/tech-packs).`,
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

You don't have to build from a blank page. Create a tech pack **from a template** for common garment types, or use **LLM assist** to rough in a first draft from a description or sketch, then refine. See also [Send a design straight to a maker](/admin/support/kb/design-studio#ship-to-a-maker).`,
  },
  {
    slug: "design-studio",
    title: "The LLM Design Studio",
    summary: "Generate real garment concepts with Flux, iterate, and ship them to a maker.",
    part: "design",
    moduleRoute: "/admin/ai-concepts",
    keywords: "design studio flux ai image generate concept reference prompt lookbook ship maker sample rename archive delete download",
    screenshot: "/kb/shots/design-studio.png",
    updated: "2026-07-08",
    body: `# The LLM Design Studio

The Design Studio turns an idea into real, editable garment imagery — powered by **Flux**, built in. No external tools and no bring-your-own API keys.

## Generating concepts

1. Open **Design & Development → Design Studio** and start a concept.
2. Describe the garment, or use the **prompt builder** to assemble silhouette, fabric, mood, and details.
3. **Generate**. Flux returns imagery in seconds. Favourite the ones you like; each keeps its seed so you can iterate coherently.

## Reference images

Upload up to a few **reference images** (a mood shot, a fabric, an existing piece) and Flux (FLUX.2) conditions the generation on them — carrying tone, drape, and detail across your concepts for a consistent line.

## Keep the studio tidy

Designs live in the left rail, newest first. **Rename** a design any time, **Archive** it when a direction is parked (archived designs tuck away under "Show archived"), or **Delete** it outright — deleting removes its generated looks too, so storage stays clean.

## Use a look on your site

Love an image? Use it right away — attach it to a **product** or a **lookbook** without leaving the studio, or hit **⤓** on any look to download the image itself. From the same hover bar, **▦ try on** sends the look straight to the Fitting Studio.

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
  {
    slug: "look-studio",
    title: "The Fitting Studio: your garment on a model",
    summary: "Try a real garment photo on a model, refit and style it, then send it to your site.",
    part: "design",
    moduleRoute: "/admin/fitting",
    keywords: "fitting room look studio virtual try on model mood board pinterest generate ai image garment photo drape 3d pattern freesewing",
    screenshot: "/kb/shots/fitting.png",
    updated: "2026-07-08",
    body: `# The Fitting Studio

One job, done properly: **see a real garment on a real body before you cut, buy, or shoot**. Bring a Design Studio creation or a photo of an actual sample, put it on a consistent model roster, then refine the fit and styling until it's right.

## Try it on

1. **Your garment** — pull an image straight from the Design Studio, or upload a photo (a flat lay or a photo of it worn both work).
2. Choose the **garment type** (top, bottom, dress, or auto).
3. **Choose models** — the shared roster spans shapes, sizes, and skin tones (the same bodies every season, so styles are comparable), or upload your own model/fit photo. Pick **up to three at once** and the same garment is fitted on each body in one pass — a mini line review.
4. **Try it on.**

> [!TIP]
> Verto **evens out the lighting** on your garment photo before the try-on, so a window
> shadow raking across a flat lay doesn't come back as a two-tone garment. It's on by
> default; if a colour ever looks off in the result, untick **Even out the photo's
> lighting** and try again with the untouched photo.

## Refit a look

Fittings spark changes — tighter here, shorter sleeves there. With any render open, use **Refit this look** under the image:

- **Fit** chips change the garment: **Tighter · Looser · Crop it · Longer hem · Shorter/Longer sleeves**.
- **Styling** chips change how it's worn: **Full tuck · French tuck · Untucked** (pick one), **Roll the sleeves**, **Cuff the pants**, **Open collar · Buttoned up** (pick one).
- **Finish** chips get it presentation-ready: **Complete the outfit** and **Press it** (freshly-steamed fabric).
- Combine chips across rows, or just describe it: *"sleeves to the elbow, a touch boxier."*

Each refit saves as a new render beside the original, so your gallery reads as a fit progression you can compare and share.

**Checking a refit really moved:** toggle the **Grid** button in the corner of the viewer. The proportion grid is a fixed overlay (never part of the image), and refits keep the same framing — so you can read exactly which line a hem or sleeve sits on, before and after.

**Basics vs a full outfit:** models wear fitted neutral basics on purpose — like a real fit model, the body line stays visible so ease and hem positions read true. When you want the look presentation-ready instead (line reviews, client decks), tap **Complete the outfit** and the model gets quiet grey trousers and clean white sneakers — or a plain white tee when your featured piece is the bottoms — without touching your garment.

## Colorways

Line planning's favourite trick: with a render open, type up to three colour names — *sage, rust, cream* — and **Recolour**. The same look comes back re-dyed in each colour, with every detail, the model, and the lighting untouched. Each colorway is a normal render (and one render from the daily budget).

## Compare side by side

Tap **Compare** in the viewer corner and the view splits: your current render on the left, any render you click in the gallery on the right. Toggle the **Grid** on top to read hems and sleeve lines across both. Perfect for before/after refits and colorway calls.

## Send it somewhere

A finished look shouldn't be a dead end. Under the refit chips:

- **Download** the image for a deck or a client message.
- **Use on your site** — add it straight to a product's photo gallery or a lookbook, live immediately.

## Renders and the daily budget

Every result saves to **Model renders** at the bottom — click any to reopen it, or delete it. Try-on results are badged **Try-on**, refits **Refit**. Each try-on or refit uses one render from the shop's daily budget; the counter next to the button shows what's left (it resets at midnight UTC).

## Turning it on

Virtual try-on, refits, and mood-board style-matching use a best-in-class engine (fal.ai) that a platform admin enables with an API key — until then the page shows a short "needs a key" note.`,
  },
];
