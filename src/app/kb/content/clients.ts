import type { KbArticle } from "../types";

export const clients: KbArticle[] = [
  {
    slug: "made-to-measure-studio",
    title: "Running a made-to-measure studio on Verto",
    summary: "The whole client workflow, end to end: book, measure, pattern, drape, commission, fittings, portal, deposit.",
    part: "clients",
    moduleRoute: "/admin/clients",
    keywords: "stylist tailor made to measure mtm workflow bespoke studio overview client",
    updated: "2026-07-10",
    body: `# Running a made-to-measure studio

If your business is people — made-to-measure garments, alterations, styling — Verto gives every step of that relationship a home. Here's the whole arc, with links into each chapter.

## 1. They find you

Share your public **/book** page ("Book a consult") from your site or social bio. Requests land at the top of your [Client Book](/admin/support/kb/client-book); confirming one creates the client with the consult already on their timeline. See [Deposits & booking](/admin/support/kb/deposits-and-booking).

## 2. You measure them

Record a dated measurement set on their page. Sets are **never overwritten** — bodies change, and the history is the point. The fields match what the [Pattern Studio](/admin/support/kb/pattern-studio) drafts from.

## 3. You design and draft

Draft their pattern in the Pattern Studio using their measurements, and save it to their name. Run the **true drape preview** to see the garment hang on a mannequin with their proportions — and the strain fit map to see where it skims and where it pulls, before any cloth is cut.

## 4. You open a commission

A [commission](/admin/support/kb/commissions) tracks the piece from consult to delivery — design approved, fabric sourced, cutting, fittings. Alterations run a shorter path. Every stage change lands on the client's timeline.

## 5. They follow along and sign off

Share a [portal link](/admin/support/kb/client-portal). The client sees their piece's stage in plain words, their renders on their own body, and an **Approve this design** button — the sign-off is on record before cutting.

## 6. Money, without friction

Request a deposit against the commission; mark it paid when it arrives. The client sees what's owed on their portal; request and receipt sit on the timeline. See [Deposits & booking](/admin/support/kb/deposits-and-booking).

## 7. Fittings to delivery

Record each fitting against the commission ("take in left shoulder 1 cm"), move it to delivery, done. The client's page reads as one continuous story — which is exactly what you hand to your future self next season.

> [!NOTE]
> Privacy, throughout: a client's measurements and photos are theirs. Deleting a client removes them completely; their patterns and photos stay in your studio, unlinked.`,
  },
  {
    slug: "client-book",
    title: "The Client Book: the people behind the patterns",
    summary: "Measurement history, style notes, fittings, and every pattern and photo a client owns — in one place.",
    part: "clients",
    moduleRoute: "/admin/clients",
    keywords: "client book made to measure mtm measurements history fitting timeline tailor stylist notes adopt",
    updated: "2026-07-10",
    screenshot: "/kb/shots/client-book.png",
    body: `# The Client Book

If you sew or style for individual people — made-to-measure clients, styling clients, alterations — the Client Book is where each person lives. One page per client, holding everything that used to be scattered across the studio tools:

- **Measurement history.** Every set is **dated and kept** — bodies change, and a tailor needs to see "measured last autumn" next to "measured this week", not have one overwrite the other. The fields use the same names the Pattern Studio drafts from, so a set is ready to become a pattern.
- **Style notes.** Plain language: colours they love, fits they avoid, brands whose sizes run true for them, the wedding they need an outfit for in June.
- **Timeline.** Notes, consults, fittings, deliveries and occasions, newest first — "first fitting: take in left shoulder 1 cm" lives with the client, not in your head.
- **Patterns & photos.** Saved patterns from the Pattern Studio and uploaded model photos from the Fitting Studio link to the client who owns them.

## Building the book from what you already have

If you've been naming saved patterns after clients (the old made-to-measure convention), press **Adopt existing patterns** on the Client Book page. Every saved pattern that carries measurements but belongs to no one becomes (or joins) a client with that name, and its measurements arrive as that client's first dated set. Nothing is deleted or changed about the patterns themselves.

## Linking work to a client

- **Patterns** — on a client's page, use *Link a saved pattern*. Newly saved patterns can be linked the same way.
- **Model photos** — upload the client's photo in the **Fitting Studio** as a model, then link it on their page. From there, their own designs can be tried on their own body, and the drape preview can hang a pattern on their exact measurements.

## Privacy

A client's measurements and body photos are theirs. **Delete client & their data** removes the client, their entire measurement history and timeline in one action; their saved patterns and photos are kept in your studio but unlinked from any person.

> [!NOTE]
> On the demo shop the Client Book is read-only, like every write surface.`,
  },
  {
    slug: "commissions",
    title: "Commissions: client work from consult to delivery",
    summary: "A staged pipeline for made-to-measure pieces and alterations, with fittings on the client's timeline.",
    part: "clients",
    moduleRoute: "/admin/commissions",
    keywords: "commission pipeline made to measure alteration fitting stages consult delivery tailor bespoke custom pipeline rename reorder hide stage",
    updated: "2026-07-12",
    screenshot: "/kb/shots/commissions.png",
    body: `# Commissions

A commission is one piece of client work — a made-to-measure garment or an alteration — tracked from the first conversation to the day it's handed over.

## The stages

**Consult → Design approved → Fabric sourced → Cutting → Fittings → Delivery.** Move a commission along from the client's page (or see everything at once on the **Commissions** pipeline). Every stage change is written to the client's timeline automatically, so their page reads as one story.

**Alterations** use a shorter path — consult → fitting → delivery — because there's nothing to design or cut from scratch.

## Make the pipeline yours

Not every studio works the same way. On the **Commissions** page, **Customise pipeline** lets you **rename** each stage to your own language (call *Fittings* your *Muslin*, if that's your word), **reorder** them, and **hide** the ones you don't use. Your names show everywhere — the board, the client's page, and the client's portal. The underlying stages stay fixed, so your [Automations](/admin/support/kb/automations) and [Workflows](/admin/support/kb/workflows) keep firing exactly as before; you're changing the wording and the flow, not breaking the machinery. Nothing ever disappears: a commission sitting on a stage you've hidden still shows up until you move it on.

## Fittings

During the fitting stage, record each session against the commission: *"take in left shoulder 1 cm"* lands on the client's timeline, tagged with the piece it belongs to. Photos can attach to the commission through the media library.

## What a commission links to

- **The client** — always. A commission belongs to exactly one person in your Client Book.
- **A saved pattern** — the made-to-measure draft from the Pattern Studio.
- **A style** — if the piece has a full tech pack, link the style and the factory spec travels with it.
- **A quoted price** — optional, shown on the pipeline so you can see the value of work in progress.

> [!NOTE]
> Deposits and milestone payments are coming next in this lane — for now the price field is a record, not an invoice.`,
  },
  {
    slug: "client-portal",
    title: "The client portal: share the work, get the sign-off",
    summary: "A passwordless page where a client sees their commissions, renders and measurements — and approves designs.",
    part: "clients",
    moduleRoute: "/admin/clients",
    keywords: "client portal invite link approve design passwordless magic link share renders measurements",
    updated: "2026-07-10",
    body: `# The client portal

Your client doesn't need an account, a password, or the admin panel to follow their piece. From their page in the **Client Book**, press **Copy portal invite link** and share it — the link signs them in once and lasts 14 days.

## What the client sees

- **Their pieces** — every commission with its stage in plain words ("being cut", "in fittings", "ready for delivery"), and the expected date if you've set one.
- **Approve this design** — one button. Their approval is stamped on the commission and written to their timeline, so the sign-off is on record before you cut cloth.
- **Their renders** — try-on renders made with their model photos, so they can see the piece on their own body.
- **Their latest measurements** — the set you most recently recorded.

## Sharing the link

If the client has an email on file **and** buyer email is switched on for your shop, the invite is also emailed in your brand shell. Without email configured, nothing breaks — the link is copied to your clipboard and you can send it however you like.

## Privacy

The portal shows a client **only their own** work — nothing about your other clients or your studio's internals. And as everywhere in the Client Book: their measurements and photos are theirs, and deleting the client removes them.`,
  },
  {
    slug: "deposits-and-booking",
    title: "Deposits, milestone payments and booking",
    summary: "Request a deposit against a commission, mark it paid, and take consult requests from a public page.",
    part: "clients",
    moduleRoute: "/admin/commissions",
    keywords: "deposit milestone payment paid booking consult request book appointment money",
    updated: "2026-07-10",
    body: `# Deposits, milestone payments & booking

## Payments on a commission

From a client's page, request a payment against any active commission — *Deposit*, *Final payment*, whatever you call it — with an amount. It appears on the client's portal so there's never confusion about what's owed, and both the request and the receipt are written to their timeline.

When the money arrives — bank transfer, cash, a card reader at the fitting — press **mark paid**. That's the whole flow, on purpose: it matches how small studios actually take money.

> [!NOTE]
> Online payment straight from the portal is coming — it needs your shop's Stripe checkout wired to commissions, which ships as its own upgrade. Requests and receipts you record now will carry over.

## Book a consult

Your shop has a public page at **/book** — link it from your site's navigation or an Instagram bio. A visitor leaves their name, how to reach them, and what they have in mind. Requests appear at the top of your **Client Book**:

- **Confirm** — the visitor becomes a client (or is matched to an existing one by email), and the consult lands on their timeline with their own words attached.
- **Decline** — the request is closed, nothing else happens.

Email confirmations and reminders arrive with the email wave; nothing here depends on them.`,
  },
];
