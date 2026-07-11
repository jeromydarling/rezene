import type { KbArticle } from "../types";

export const companion: KbArticle[] = [
  {
    slug: "companion",
    title: "The Verto Companion — ask the masters, ask the app",
    summary: "A grounded assistant on every admin page: schooled on the nine courses and the whole manual, it answers with citations, links you to the right room, and speaks both ways.",
    part: "getting-started",
    moduleRoute: "/admin",
    keywords: "companion assistant ai chat help ask question voice speak mic talk answer guide school masters citation",
    updated: "2026-07-12",
    body: `# The Verto Companion

The sparkle button in the corner of every admin page opens the **Companion** — an assistant that has read the Verto School's nine courses (Vincent on trousers, Madison on balance, Picken on finishing, Nystrom on the economics) and every chapter of this Knowledge Base.

## What it's good at

- **Craft questions.** "Why does my sleeve spiral around the arm?" gets the master's answer — pitch, in this case, with the remedy — and a citation you can click straight into the lesson.
- **App questions.** "How do I push a price study into a cost sheet?" gets the steps and a link to the exact page.
- **Situational advice.** It knows which module you're standing in, so questions like "what should I check before sending this?" are answered in context.

## How it answers

Every reply is **grounded**: the Companion retrieves the relevant lessons and guide chapters first, answers from them, and lists its sources as numbered chips under the reply — tap one to read the original. When it doesn't know, it says so and points to [R&D](/admin/research), where live research runs with citations.

## Voice

Tap the **microphone** to ask out loud (in browsers that support speech input), and toggle the **speaker** to have replies read aloud — the same voice engine as the school's Listen bar. Hands stay on the muslin.

## The fine print

The Companion is read-only: it advises and links, it never changes your shop's data. Answers run on your own Anthropic key when one is configured (best quality), otherwise on Workers AI — and each shop has a generous daily allowance. It won't invent prices, measurements, or legal advice; for live market numbers it will send you to R&D, where answers arrive with sources.`,
  },
];
