/**
 * The Verto marketing FAQ. One source of truth for both the rendered /faq page
 * (src/app/verto/VertoFaq.tsx) and the FAQPage JSON-LD injected at the edge
 * (buildFaqLd in src/worker/services/seo.ts). Answers are plain text — no
 * markup — so they're safe to drop straight into schema.org and the page.
 *
 * The questions come from real forum/community research into what independent
 * fashion brands actually ask and complain about (cost & app sprawl, being
 * invisible on Google, production chaos, pre-orders, made-to-order, wholesale,
 * lock-in, support). Every answer maps to something Verto genuinely does —
 * never a promise the app doesn't keep.
 */

export interface FaqItem {
  q: string;
  a: string;
}

export interface FaqCategory {
  title: string;
  items: FaqItem[];
}

export const FAQ: FaqCategory[] = [
  {
    title: "Cost & fees",
    items: [
      {
        q: "How much does Verto really cost, all in?",
        a: "Every plan is one flat monthly price that already includes the whole platform — storefront, production tools, wholesale, pre-orders, lookbooks, and AI marketing. Plans run from $29 to $399 a month, plus a small application fee on your sales that drops as you grow (from 1.5% down to 0.5%) and Stripe's standard card processing. There's no separate bill for “the features you actually need” — they're all in the box. Start free for 14 days, no card required.",
      },
      {
        q: "Will I end up paying for a pile of add-on apps like on Shopify?",
        a: "No. The things that become $10–40/month apps elsewhere — email marketing, reviews, wholesale, pre-orders, size runs, SEO, a blog — are built into Verto and included in your plan. One login, one bill, and everything shares the same data instead of a stack of apps that don't talk to each other and charge per click.",
      },
      {
        q: "Are there hidden fees or surprise price hikes?",
        a: "The price is the price: your monthly plan, a transparent application fee on sales, and Stripe's processing rate. We show the fee on every plan up front and it only ever goes down as you scale. There are no per-click or per-action app charges, and nothing unlocks a feature you assumed was included.",
      },
      {
        q: "Is it worth it if I only make a few sales a month?",
        a: "The Starter plan is built for exactly that stage — pre-launch and first sales — and the application fee is a percentage, so it stays small while your volume is small. You also get the production, pre-order, and wholesale tools that usually only come with expensive setups, so you can grow into them without switching platforms later.",
      },
    ],
  },
  {
    title: "One platform vs. a pile of apps",
    items: [
      {
        q: "What does Verto actually replace?",
        a: "In one system you get your storefront and CMS, production (tech packs, factories, samples, purchase orders, size runs), multi-carrier shipping and landed cost, wholesale line sheets, pre-orders, made-to-order, lookbooks, and AI marketing. On the usual setup that's Shopify plus a dozen apps plus a spreadsheet or two — here it's one place where your catalogue, inventory, and production share the same data.",
      },
      {
        q: "When something breaks, who do I call?",
        a: "Us — there's no vendor ping-pong. Because it's one platform rather than a host plus a pile of third-party apps, there's a single team behind everything. Every page has a built-in guide, the Verto Companion answers questions in plain language, and a real person is one message away.",
      },
    ],
  },
  {
    title: "For people who actually make clothes",
    items: [
      {
        q: "Most tools assume I'm reselling finished products. Does Verto understand that I make clothes?",
        a: "Yes — that's the whole point. Verto has first-class tech packs, factory and supplier records, sample rounds, purchase orders, and size-run production, all connected to the same catalogue you sell from. Your production doesn't live in a separate spreadsheet that's out of sync with your store: approving a sample can draft the production order, and receiving a size run updates stock per size.",
      },
      {
        q: "Can I run pre-orders without overselling my production run?",
        a: "Yes. A pre-order campaign has a goal, counts orders against it, and won't sell past your cap, so you never promise more than you can make. When the goal is met the campaign is marked funded and a production task is created — you validate demand first, then commit to the run, with clear “ships by” messaging so customers aren't confused.",
      },
      {
        q: "Can I take made-to-order or made-to-measure, with measurements and a deposit?",
        a: "Yes. There's a client book for measurements, commissions that take a deposit now and the balance when the piece is ready, and a client portal — so bespoke work isn't an endless DM thread about sizing. It's a real made-to-order flow, not a print-on-demand workaround.",
      },
      {
        q: "Can I sell wholesale to boutiques from the same shop?",
        a: "Yes. Verto builds line sheets from your catalogue with your own wholesale pricing and minimums, and approved buyers order through a B2B portal — on your own storefront, with your own pricing, instead of handing a cut to a marketplace.",
      },
      {
        q: "Do I have to guess my landed cost and margins?",
        a: "No. The costing and duties tools roll duty rates, fees, and freight into a real per-unit landed cost, so you price on evidence instead of finding out what a run actually cost after it lands. Research assists help fill the gaps when a rate isn't obvious.",
      },
    ],
  },
  {
    title: "Getting found",
    items: [
      {
        q: "My current store doesn't show up on Google. Will Verto fix that?",
        a: "Storefronts built as apps often serve search engines a nearly-empty page. Verto renders real titles, descriptions, and social tags into every page at the edge, publishes a fresh sitemap and Product data automatically, and gives you a Search Checkup that audits your live pages and tells you exactly what to fix — in plain language, worst-first.",
      },
      {
        q: "Can AI assistants like ChatGPT find and recommend my shop?",
        a: "Yes. Verto publishes an llms.txt index and clean structured data — the emerging standard for letting ChatGPT, Claude, and Perplexity read and cite your shop. It's on by default; there's nothing to configure.",
      },
      {
        q: "I'm invisible and can't afford ads. What does Verto do about discovery?",
        a: "Beyond the technical SEO being automatic, the AI marketing drafts SEO-aware product descriptions, journal posts, and social captions from what you already have, and Search Checkup even suggests an article topic to pull in people who don't know your name yet — the organic, content-led growth that's realistic for a one-person team.",
      },
    ],
  },
  {
    title: "Getting paid",
    items: [
      {
        q: "Whose payment system is it — do I get my own payouts?",
        a: "Your own. Verto connects to your own Stripe account, so customers check out on your shop and payouts land in your bank on Stripe's schedule. You're not forced onto our payments or waiting on us to pass money along.",
      },
      {
        q: "What are the total fees per sale?",
        a: "Stripe's standard card processing (2.9% + 30¢ in the US) plus Verto's application fee for your plan, which starts at 1.5% and drops to 0.5% as you scale. Both are shown up front, and there's nothing else skimmed on top.",
      },
      {
        q: "Can I sell internationally?",
        a: "Yes — Stripe handles multiple currencies at checkout, and the landed-cost tools help you price cross-border orders so duties and fees don't quietly eat your margin.",
      },
    ],
  },
  {
    title: "Your domain & setup",
    items: [
      {
        q: "Can I use my own domain, and is SSL included?",
        a: "Yes. Point one CNAME at Verto and your shop runs on your own domain with a valid SSL certificate issued automatically — usually live within a minute, with no DNS wizardry and no extra charge for the padlock.",
      },
      {
        q: "Do I need to be technical or hire a designer?",
        a: "No. An AI site starter drafts your whole site from a few questions, your brand's colours and type flow everywhere automatically, and a guided setup walks you from empty shop to open for business. In-app tours and a real handbook mean you don't need a developer or an agency.",
      },
      {
        q: "What about professional email at my domain?",
        a: "Your storefront runs on your domain, and Verto sends your order and marketing emails branded as you, with replies routed to whatever inbox you choose. For mailboxes like hello@yourbrand.com you can use any email provider — you're not tied to ours.",
      },
    ],
  },
  {
    title: "Switching to Verto",
    items: [
      {
        q: "Will I lose my Google ranking if I switch?",
        a: "Your domain carries your authority, and you keep it — so the ranking that lives on yourbrand.com comes with you. Every page on Verto is edge-rendered with proper titles, canonicals, and a sitemap, so search engines re-index you cleanly, and the Search Checkup flags anything to tidy up during the move.",
      },
      {
        q: "How hard is it to move my products and customers over?",
        a: "There's an AI-assisted import studio for bringing your catalogue in, and your customer list is yours to upload. You keep your own domain, so from a shopper's point of view the address doesn't change.",
      },
    ],
  },
  {
    title: "Your data, lock-in & trust",
    items: [
      {
        q: "Do I own my data and my customer list?",
        a: "Yes, completely. You can export your products, customers, and orders to CSV at any time, plus QuickBooks/Xero-ready accounting. Your customer list is yours — never held hostage behind a paywall.",
      },
      {
        q: "What happens if I want to leave, or if Verto disappears?",
        a: "You're never locked in. Your domain is registered to you, your data exports anytime, and because everything runs on your own domain and your own Stripe account, the essentials of your business don't depend on us to keep existing.",
      },
      {
        q: "Is my data safe?",
        a: "Each shop's data lives in its own isolated database. Payment details never touch Verto — they go straight to Stripe — and connection keys are stored as encrypted secrets outside the app, so card numbers and API keys never appear in your shop or the browser.",
      },
      {
        q: "How do I get help when I'm stuck?",
        a: "Every admin page has a “?” that opens the right chapter of a real handbook, the Verto Companion answers questions in plain language on any page, and Report a bug or idea sends a note straight to the team — a human, not an AI loop.",
      },
    ],
  },
];

/** Flattened Q&A, for the FAQPage structured data. */
export const FAQ_FLAT: FaqItem[] = FAQ.flatMap((c) => c.items);
