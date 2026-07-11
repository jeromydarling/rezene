import type { KbArticle } from "../types";

/**
 * The R&D studio's research rooms beyond makers & notes: brand dossiers,
 * price studies, trend boards, and stockist research. One article per room,
 * all in the sourcing part so they cluster with the R&D workspace chapter.
 */
export const rdStudio: KbArticle[] = [
  {
    slug: "rd-brands",
    title: "Brand dossiers — competition research that stays current",
    summary: "Build cited dossiers on the labels your customer also shops, and put the important ones on watch.",
    part: "sourcing",
    moduleRoute: "/admin/research/brands",
    keywords: "brand dossier competitor competition research positioning price architecture channels stockists watch refresh snapshot what changed",
    updated: "2026-07-11",
    body: `# Brand dossiers — competition research that stays current

You don't need a subscription tool to know your competitive set. You need dossiers on the three to six labels your customer actually cross-shops — and a way to notice when they move.

## Build the set

Open **R&D → Brands** and add each label with a segment:

- **Direct competitor** — same customer, same price neighbourhood. These earn a watch.
- **Aspirational** — the label you're compared to on a good day. Useful for price ceilings and story.
- **Adjacent** — different category, same customer. Where collab and stockist ideas come from.

Add your one-line read of their positioning if you have one — research sharpens it rather than replacing it.

## Research the dossier

**Research this brand** builds the dossier live: positioning, price architecture (entry / core / top, with actual current prices), channels and stockists, recent moves — every claim carried by the sources listed under the text. Nothing is invented; where the sources are silent, the dossier says so.

Record the observed **entry and top price** on the card — that range shows up in the list view, so the whole competitive landscape reads at a glance.

## Watch what matters

Flip **Watch** on the direct competitors. Watched brands re-research themselves about once a week (drawing from the same daily research allowance you use by hand, with a conservative cap). Each refresh:

- keeps the previous dossier as a **snapshot** — the History button shows every version;
- ends with a **"What changed"** section — new products, price moves, new doors, campaigns;
- lands in your [activity feed and daily digest](/admin/support/kb/automations), so you hear about it without checking.

> [!NOTE]
> The refresh is a rule in the [Automations library](/admin/support/kb/automations) ("Watched research → weekly refresh") — turn it off there if you'd rather refresh by hand.

## Where it leads

Dossiers feed decisions elsewhere in the studio: price architecture flows into [price studies](/admin/support/kb/rd-pricing), stockist lists seed your [stockist research](/admin/support/kb/rd-stockists), and positioning sharpens your own brand story.`,
  },
  {
    slug: "rd-pricing",
    title: "Price studies — decide a retail price you can defend",
    summary: "Collect real comparables, set the band, and push the target retail straight into the style's cost sheet.",
    part: "sourcing",
    moduleRoute: "/admin/research/pricing",
    keywords: "price study pricing research comparables comps retail band target cost sheet margin market positioning",
    updated: "2026-07-11",
    body: `# Price studies — decide a retail price you can defend

"What should this retail for?" deserves better than a gut number. A price study answers it once, with evidence, and the decision flows straight into your costing.

## One study per question

Open **R&D → Pricing** and start a study per category and market: *Linen shirt — US direct-to-consumer*. The currency you pick is the currency the whole study speaks.

## Fill the comps table

The heart of a study is the **comparables table**: real garments on sale right now — brand, product, price, fabric, where it's made. Add rows by hand as you shop the market, or hit **Research this price point** and the live research assembles comparables, typical bands, and a recommendation — sources listed, so you can click through and verify any number before you lean on it.

## Set the band, make the call

Record three numbers on the study:

- **Accessible** — the edge where your customer starts taking you seriously.
- **Core** — where most of the range should sit.
- **Premium** — what the hero pieces can carry.

Then decide. The band isn't the answer — it's the evidence. Your fabric, make, and story decide where in (or above) the band you belong.

## Push it into costing

Pick the style and **Set as target retail** — the number writes into the style's cost sheet in [Costing & Margins](/admin/support/kb/costing) (creating a starter sheet if the style has none). From there the cost sheet shows exactly what's left after fabric, make, freight, and duty — pricing and margin stop being separate conversations.

> [!TIP]
> Studies marked **decided** sink below open ones, so the list reads as a to-do: what's still unpriced this season.`,
  },
  {
    slug: "rd-trends",
    title: "Trend boards — season scouting with receipts",
    summary: "Research a direction with sources, keep it current with watch, and hand adopted boards to the Design Studio.",
    part: "sourcing",
    moduleRoute: "/admin/research/trends",
    keywords: "trend board scouting season silhouettes fabrics colors details research brief design studio adopt watch",
    updated: "2026-07-11",
    body: `# Trend boards — season scouting with receipts

Trend research usually dies in screenshots. A trend board keeps one direction — a silhouette, a fabric story, a color family — as a living brief with sources, and hands it to the Design Studio the day you commit.

## One board per direction

Open **R&D → Trends** and start a board per direction you're weighing for the season: *Fluid tailoring — SS27 — silhouettes*. Pin your own observations as **directions** on the board (chips like "soft-shoulder blazers", "wide pleated trouser") — they travel with the brief.

## Research the brief

**Research this direction** grounds the board: what's actually happening (not hype), who's showing it, which fabrics and treatments carry the look — and, because you're not a fast-fashion factory, how to produce it **small-batch** without chasing drops. Sources sit under the brief; claims trace to them.

## Watch the moving ones

A direction you're circling but haven't committed to is exactly what **Watch** is for — the board re-researches itself about once a week and ends with a "What's new" section. Refreshes land in your [activity feed and digest](/admin/support/kb/automations).

## Adopt it into the Design Studio

When a direction earns a place in the line, **Open in Design Studio** — the board becomes a [Design Studio](/admin/support/kb/design-studio) concept with the brief and directions attached, ready to generate from. The board flips to **adopted** and keeps pointing at its concept, so the paper trail from "we noticed" to "we made" stays intact.`,
  },
  {
    slug: "rd-stockists",
    title: "Stockists — research the doors before you pitch them",
    summary: "Profile boutiques, online retailers, and showrooms with cited research, then walk each pitch from shortlist to stocked.",
    part: "sourcing",
    moduleRoute: "/admin/research/stockists",
    keywords: "stockists wholesale boutique department store online retailer showroom fair pitch buyer research pipeline stocked",
    updated: "2026-07-11",
    body: `# Stockists — research the doors before you pitch them

Wholesale starts long before a line sheet: it starts with knowing which doors your customer already walks through, what those doors carry, and how their buyers actually buy.

## Build the door list

Open **R&D → Stockists** and add every door that could plausibly carry the label — boutiques, department stores, online retailers, showrooms, fairs, pop-ups. Start with where your [brand dossier](/admin/support/kb/rd-brands) competitors are stocked: those buyers already believe in your category.

## Profile before you pitch

**Profile this door** researches the retailer live: what they carry and at what price points, who their customer is, and — where the sources support it — how they take submissions and which trade shows they attend. Contact details are never invented; what research can't find, you fill in from the source links.

Add your own **fit note** — why this door, why now. It's the seed of the pitch email.

## Walk the pipeline

The status chip is the pipeline: **researching → shortlist → pitched → in talks → stocked** (or **passed**, honestly). Reaching *stocked* drops an event into your [activity feed](/admin/support/kb/automations) — a wholesale door opening is worth noticing.

## When a door says yes

Move the relationship to the [wholesale portal](/admin/support/kb/wholesale-portal): buyer accounts, line sheets, and wholesale pricing live there. R&D keeps the map of the market; the portal runs the trade.`,
  },
];
