import type { TourDef } from "./lib/tour";

/**
 * The tour book: one guided walk per section, anchored to [data-tour="…"]
 * attributes on the real UI (plus a few stable structural selectors). Steps
 * whose target isn't present are skipped by the engine, so tours degrade
 * gracefully on empty states and small screens. Register a tour here and the
 * "Show me around" button appears on matching routes automatically.
 */

interface TourEntry extends TourDef {
  /** Route prefixes (basename-relative, e.g. "/admin/products"). First match wins. */
  routes: string[];
  /** Match the route exactly instead of by prefix (for "/admin" itself). */
  exact?: boolean;
}

export const TOURS: TourEntry[] = [
  {
    key: "dashboard",
    label: "Your studio",
    routes: ["/admin", "/admin/launch"],
    exact: true,
    steps: [
      {
        title: "Welcome to your studio",
        body: "This is mission control for your label. This one-minute walk shows you where everything lives — you can rerun it anytime from the compass button up top.",
      },
      {
        target: '[data-tour="nav"]',
        title: "Everything, one rail",
        body: "The sidebar is your whole studio: design, production, commerce, marketing, and your brand. Sections expand on click — start with Commerce and Brand.",
      },
      {
        target: '[data-tour="search"]',
        title: "Jump anywhere",
        body: "Search pages by name — type “look” or “orders” and go. Fastest way around once you know what you want.",
      },
      {
        target: ".masthead-title",
        title: "Every page explains itself",
        body: "Look for the small “?” beside page titles — it opens that page's chapter in the help book. And the Companion (bottom corner) answers questions in plain language.",
      },
    ],
  },
  {
    key: "products",
    label: "Products",
    routes: ["/admin/products"],
    steps: [
      {
        target: ".masthead-title",
        title: "Your catalogue",
        body: "Products are the heart of the shop — everything else (lookbooks, campaigns, line sheets) is composed from what lives here.",
      },
      {
        target: '[data-tour="new-product"]',
        title: "Add a piece",
        body: "One photo, a price, and a size run is enough to publish. You can layer in stories, fabric, and care details anytime — the storefront updates live.",
      },
      {
        title: "Photos do double duty",
        body: "A product's first photo becomes its lookbook page, campaign image, and line-sheet thumbnail. One good shot goes a long way.",
      },
    ],
  },
  {
    key: "settings",
    label: "Settings",
    routes: ["/admin/settings"],
    steps: [
      {
        target: ".masthead-title",
        title: "The essentials, one page",
        body: "Brand identity on the left; money, email, and account cards on the right. Three minutes here sets up the whole shop.",
      },
      {
        target: '[data-tour="payments-card"]',
        title: "Get paid",
        body: "Connect payouts once (Stripe walks you through it) and every sale lands in your own bank account. This card is also where you choose your Verto plan.",
      },
      {
        target: '[data-tour="referral-card"]',
        title: "A month free, twice",
        body: "Share your link with a designer friend — when they open a shop, you both get a month free, automatically tracked here.",
      },
    ],
  },
  {
    key: "lookbook",
    label: "Lookbook",
    routes: ["/admin/brand/lookbook"],
    steps: [
      {
        target: ".masthead-title",
        title: "A magazine from your catalogue",
        body: "One click composes a seasonal issue from your published pieces — cover, editorial spreads, back page — always in your brand's colours and type.",
      },
      {
        target: '[data-tour="print-mail"]',
        title: "Print & mail it",
        body: "Add recipients (or upload a CSV of customers) and real printed copies drop-ship to their doors — no minimums, tracking included, priced before you pay.",
      },
    ],
  },
  {
    key: "outreach",
    label: "Outreach",
    routes: ["/admin/outreach"],
    steps: [
      {
        target: '[data-tour="outreach-segments"]',
        title: "Your audience, live",
        body: "Segments are live queries over your CRM — shops, leads, the makers waitlist. Pick who you're talking to; unsubscribes are respected automatically.",
      },
      {
        target: '[data-tour="outreach-composer"]',
        title: "Brief → draft → send",
        body: "Describe the email in a sentence and the AI drafts it in Verto's voice. Edit, send yourself a test, then queue — sends pace out gently.",
      },
      {
        target: '[data-tour="outreach-automations"]',
        title: "Email that runs itself",
        body: "Welcome notes, stuck-shop nudges, win-backs, testimonial asks — keyed to what shops actually do. Flip one on and the daily sweep handles the rest.",
      },
      {
        target: '[data-tour="outreach-changelog"]',
        title: "Shipped something?",
        body: "Paste what's new and get a tweet thread, LinkedIn post, and newsletter section — the newsletter loads straight into the composer.",
      },
    ],
  },
];

export function tourForPath(pathname: string): TourDef | null {
  const clean = pathname.replace(/\/+$/, "") || "/";
  for (const t of TOURS) {
    const hit = t.routes.some((r) => (t.exact ? clean === r : clean === r || clean.startsWith(`${r}/`)));
    if (hit) return t;
  }
  return null;
}
