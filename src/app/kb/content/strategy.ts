import type { KbArticle } from "../types";

/**
 * Business Strategy — the R&D → Strategy room. One guide covering the four
 * tools, the personas, the grounding, and how action items become calendar
 * dates. Lives in the sourcing part so it clusters with the R&D workspace.
 */
export const strategy: KbArticle[] = [
  {
    slug: "rd-strategy",
    title: "Business strategy — a strategist in the room, grounded in your brand",
    summary:
      "Build SWOTs, business plans, OKRs, and competitive analyses with a Claude persona that already knows your brand — then drop the next steps onto your calendar.",
    part: "sourcing",
    moduleRoute: "/admin/research/strategy",
    keywords:
      "business strategy swot analysis business plan lean canvas full plan okr okrs goals objectives key results competitive analysis competition market landscape persona advisor investor operating partner coach calendar action items plan",
    updated: "2026-07-12",
    body: `# Business strategy — a strategist in the room

Most founders never sit down to do the strategy work — not because it's hard, but because a blank page is intimidating and generic templates don't know anything about *your* brand. **R&D → Strategy** fixes both. You pick a tool and a voice; Verto reads your Brand Brain and your R&D and drafts a real working document for you to edit. Every one ends with concrete next steps you can put straight on your calendar.

## The four tools

- **SWOT analysis** — a clear-eyed read of your Strengths, Weaknesses, Opportunities, and Threats, then the two or three moves that actually follow. Good before a season, a launch, or a pivot.
- **Business plan** — articulate the model. Choose **Lean canvas** (one page, for you) or **Full plan** (investor-ready: market, product, go-to-market, operations, and numbers) when you're pitching a partner or a small raise.
- **OKRs & goals** — turn ambition into a handful of measurable objectives with concrete key results, the kind you can check yourself against in ninety days.
- **Competitive analysis** — map the labels your customer also shops: how they're positioned, where they're strong, and the white space you can credibly own. If you've built [brand dossiers](/admin/support/kb/rd-brands), it folds them straight in.

## Pick a voice

The same question sounds different depending on who's answering it, so you choose the **persona** that drafts your document:

- **Strategy advisor** — direct and practical, honest about trade-offs.
- **Investor lens** — skeptical on unit economics, defensibility, and the size of the prize.
- **Operating partner** — thinks in sequencing, resourcing, and what ships when.
- **Founder coach** — encouraging and plain-spoken, keeps it human.

Each tool opens on a sensible default, but switch freely — running the same SWOT through the advisor and the investor is a genuinely useful exercise.

> [!TIP]
> Tick **Plain language** to strip out the MBA vocabulary entirely — the document reads like a smart friend explaining it over coffee.

## It already knows your brand

You don't start from nothing. Every document is grounded in what Verto already holds:

- your **Brand Brain** — the name, category, customer, positioning, and thesis you set in the [Launch Playbook](/admin/launch);
- the **competitors** you've profiled in [Brand dossiers](/admin/support/kb/rd-brands);
- the **trend directions** and the scale of your catalog and sales.

The more you've filled in, the sharper the work. Where Verto is inferring rather than quoting your data, it says so — it won't invent numbers or competitors it has no basis for. Add anything specific in the **Anything to add?** box (a launch you're weighing, a channel that's stalling) and it's woven in.

## From strategy to your calendar

A plan you don't act on is a document. So every strategy document ends with **Next steps** — three to six concrete actions, each with a suggested date. Hit **Add to calendar** on any one (or **Add all**) and it becomes an entry on your [Production Calendar](/admin/production), tagged back to the document it came from. Scheduled steps show a green tick so you always know what's already booked.

## If AI isn't configured

Strategy runs on your shop's **Anthropic key** when it's set (Settings → AI) for the sharpest results, and falls back to Workers AI Llama otherwise — so it works either way. Documents drafted on the fallback carry a small **Llama** tag. Generation draws from your shared daily AI allowance, the same pool the [Companion](/admin/support/kb/companion) uses.

## Good habits

- **Re-run each quarter.** Strategy isn't a one-off — a fresh SWOT and new OKRs every quarter keep you honest as the brand moves.
- **Archive, don't delete.** Archived documents drop out of the way but stay on the record, so you can look back at what you were thinking a season ago.
- **Edit freely.** The draft is a starting point with your name on it, not a verdict. Change anything that doesn't ring true.
`,
  },
];
