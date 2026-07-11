import type { KbArticle } from "../types";

export const interpreter: KbArticle[] = [
  {
    slug: "interpreter",
    title: "The Interpreter — decode any message, measure from photos",
    summary: "Paste a client's tangled question or a maker's reply in any language and get the meaning, the terms explained, and a reply drafted in both languages. Plus: estimated measurements from two photos (beta).",
    part: "clients",
    moduleRoute: "/admin/clients",
    keywords: "interpreter translate translation language client message question maker factory fabric supplier reply draft decode jargon photo measure measurements estimate picture body",
    updated: "2026-07-14",
    body: `# The Interpreter

Two assists for the conversations a studio actually has — both live where the conversations do: the **Interpreter** button sits on [Maker Messages](/admin/messages) and the [Client Book](/admin/clients).

## Decode any message

Paste anything into the box — a client's three-paragraph worry that buries the actual question, a factory's reply in Turkish, a mill quoting *GSM*, *MOQ* and *greige* — pick who it's from, and you get back:

- **What it says** — a faithful translation when it isn't in English.
- **What they actually need** — the real ask in plain words, including what's implied but unsaid, and the risk if it's mishandled.
- **The terms, translated** — any trade jargon defined.
- **A suggested reply, twice** — once in English for you to review and edit, once in the sender's language, ready to send.

The Interpreter never invents prices, dates or commitments you didn't state, and when a message needs a decision only you can make, the draft buys time gracefully and tells you what the decision is. Review before sending — it drafts; you decide.

## Measure from photos (beta)

In a client's **Record new set** form, the photo block estimates a full measurement set from a **front photo** (a side photo raises confidence) plus the client's **height**, which sets the scale.

Honest expectations: this is a **starting point, not a substitute for the tape**. Estimates land in the form as a draft with the confidence level and caveats written into the set's note — fitted clothing, good light, and the full body in frame make the biggest difference. Use it to get a remote client's first consultation moving; confirm everything at the fitting. (Requires the shop's Anthropic key for vision; without one the feature explains itself and bows out.)

> [!NOTE]
> Both assists draw from the same daily allowance as the Companion.`,
  },
];
