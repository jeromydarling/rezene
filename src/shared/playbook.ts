/**
 * The Launch Playbook — a data-driven, fillable version of the Clothing Brand
 * Launch Field Guide. Shared by the worker (AI generate/parse/compile) and the
 * client (the clickable guide). Every field is a decision a founder fills in;
 * `seeds` marks which module a field feeds when the plan compiles into the
 * Brand Brain.
 */

export type PbFieldType = "text" | "textarea" | "list" | "select" | "images";

export interface PbField {
  id: string;
  label: string;
  help?: string;
  type: PbFieldType;
  placeholder?: string;
  options?: string[];
  /** Module this field seeds when the plan is applied. */
  seeds?: "settings" | "studio" | "costing" | "duties" | "production" | "marketing" | "content" | "sourcing" | "materials" | "commerce";
}

export interface PbSection {
  id: string;
  title: string;
  /** Short guidance (plain text) shown under the section title. */
  intro?: string;
  fields: PbField[];
  /** Optional pre-launch checklist items for this section. */
  checklist?: string[];
}

export interface PbPart {
  slug: string;
  title: string;
  summary: string;
  sections: PbSection[];
}

export const PLAYBOOK: PbPart[] = [
  {
    slug: "foundation",
    title: "Brand foundation",
    summary: "Thesis, positioning, name, and identity — the decisions everything else inherits.",
    sections: [
      {
        id: "thesis",
        title: "Brand thesis",
        intro:
          "One paragraph, under 100 words. If you can't keep it short, the thesis isn't clear yet.",
        fields: [
          { id: "brand.name", label: "Brand name", type: "text", seeds: "settings", placeholder: "e.g. Rezene" },
          { id: "brand.category", label: "Product category", type: "text", seeds: "settings", placeholder: "e.g. elevated linen essentials" },
          { id: "brand.target", label: "Target person", type: "text", seeds: "marketing", placeholder: "Who is it for?" },
          { id: "brand.feeling", label: "Feeling / world / place", type: "text", seeds: "content", placeholder: "What does wearing it feel like?" },
          { id: "brand.gap", label: "Why it exists (market gap)", type: "textarea", placeholder: "The cultural or market opportunity" },
          { id: "brand.rejects", label: "What it refuses to be", type: "text", placeholder: "What you're explicitly rejecting" },
          { id: "brand.thesis", label: "Thesis paragraph", type: "textarea", seeds: "content", help: "Compile the above into one tight paragraph (AI can draft this)." },
        ],
      },
      {
        id: "positioning",
        title: "Positioning & references",
        intro: "The words that govern every creative decision, plus 2–4 brands that prove your taste.",
        fields: [
          { id: "brand.words", label: "Positioning words (8–12)", type: "list", seeds: "settings", help: "Words that describe the brand accurately." },
          { id: "brand.antiWords", label: "Words you reject (4–6)", type: "list", help: "The brand voice's negative space." },
          { id: "brand.references", label: "Reference brands", type: "list", help: "2–4 brands near your aesthetic — proof of taste, not competitors." },
          { id: "brand.voice", label: "Brand voice", type: "textarea", seeds: "settings", help: "How the brand speaks — feeds AI copy across the app." },
        ],
      },
      {
        id: "identity",
        title: "Visual identity",
        intro: "Brief the look before you commission it.",
        fields: [
          { id: "brand.moodboard", label: "Mood board & references", type: "images", help: "Upload 6–20 images that capture the world of the brand — these also feed the Design Studio.", seeds: "studio" },
          { id: "brand.palette", label: "Colour palette", type: "list", placeholder: "3–5 core colours (hex / Pantone)" },
          { id: "brand.type", label: "Typography direction", type: "text", placeholder: "e.g. elegant French serif + clean grotesk" },
        ],
        checklist: [
          "Domain available",
          "Instagram handle available",
          "TikTok handle available",
          "USPTO trademark search clear",
          "EUIPO trademark search clear (if selling to EU)",
          "No negative translations in target markets",
        ],
      },
    ],
  },
  {
    slug: "product",
    title: "Product development",
    summary: "Collection architecture, calendar model, and how AI accelerates design.",
    sections: [
      {
        id: "collection",
        title: "Collection architecture",
        intro: "Define the launch collection before designing anything. 8–12 SKUs is a healthy debut.",
        fields: [
          { id: "collection.skuCount", label: "How many SKUs?", type: "text", placeholder: "8–12 recommended" },
          { id: "collection.categories", label: "Categories", type: "list", seeds: "commerce", placeholder: "tops, bottoms, dresses…" },
          { id: "collection.hero", label: "Hero product", type: "text", seeds: "studio", help: "The one style that defines the brand." },
          { id: "collection.colorways", label: "Colourways per style", type: "text", placeholder: "e.g. 2–3" },
          { id: "collection.calendar", label: "Calendar model", type: "select", options: ["Seasonal (SS/AW)", "Constant / core", "Drops", "Hybrid"], seeds: "production" },
        ],
      },
      {
        id: "design",
        title: "AI-assisted design",
        intro: "Use AI to accelerate concepting, not skip craft. A good prompt names era, setting, fabric, silhouette, light, and use.",
        fields: [
          { id: "design.concept", label: "Concept prompt for your hero style", type: "textarea", seeds: "studio", placeholder: "draped viscose maxi dress, halter neck, ivory palette, golden-hour Riviera editorial…" },
        ],
      },
    ],
  },
  {
    slug: "sourcing",
    title: "Sourcing & production",
    summary: "Region, factories, MOQ, fabric, and the sampling plan.",
    sections: [
      {
        id: "region",
        title: "Manufacturing region",
        intro: "A strategic decision, not just a cost one — it shapes lead time, duty, story, and MOQ.",
        fields: [
          { id: "prod.region", label: "Primary production region", type: "select", seeds: "sourcing", options: ["Morocco", "Portugal", "Turkey", "India", "China", "Vietnam", "USA (domestic)", "Other"] },
          { id: "prod.regionWhy", label: "Why this region", type: "textarea", help: "Story origin, duty from your markets, fabric strength, MOQ fit." },
          { id: "prod.moq", label: "Launch MOQ strategy", type: "textarea", placeholder: "Fewer styles at higher depth? Pre-orders to fund? Blanket order?" },
        ],
      },
      {
        id: "fabric",
        title: "Fabric & sampling",
        fields: [
          { id: "prod.fabrics", label: "Key fabrics", type: "list", seeds: "materials", placeholder: "100% linen 190gsm; 78/22 viscose-nylon…" },
          { id: "prod.sampleRounds", label: "Planned sample rounds", type: "select", options: ["2", "3", "4"], seeds: "production", placeholder: "Expect 2–3" },
        ],
      },
    ],
  },
  {
    slug: "landed-cost",
    title: "Tariffs & landed cost",
    summary: "Model landed cost and duty before you price — your margin depends on it.",
    sections: [
      {
        id: "markets",
        title: "Markets & duty",
        fields: [
          { id: "cost.markets", label: "Primary selling markets", type: "list", seeds: "duties", placeholder: "EU, US, UK…" },
          { id: "cost.dutyNotes", label: "Duty assumptions per lane", type: "textarea", seeds: "duties", help: "e.g. Morocco→EU 0% under Association Agreement for qualifying goods." },
        ],
      },
      {
        id: "price",
        title: "Price architecture",
        intro: "DTC retail is typically 5–8× total unit cost; wholesale 2–2.5×. Healthy DTC margin 70–85%.",
        fields: [
          { id: "cost.avgRetail", label: "Target average retail", type: "text", seeds: "costing", placeholder: "e.g. $145" },
          { id: "cost.targetMargin", label: "Target DTC gross margin %", type: "text", seeds: "costing", placeholder: "70–85%" },
          { id: "cost.wholesale", label: "Wholesale approach", type: "text", placeholder: "2–2.5× cost; 45–60% margin" },
        ],
      },
    ],
  },
  {
    slug: "commerce",
    title: "Commerce & distribution",
    summary: "Your stack, and the phased path from DTC to wholesale to physical.",
    sections: [
      {
        id: "stack",
        title: "Commerce & distribution plan",
        fields: [
          { id: "commerce.phase", label: "Launch distribution focus", type: "select", options: ["DTC-first", "DTC + selective wholesale", "Wholesale-led"], seeds: "commerce" },
          { id: "commerce.preorder", label: "Pre-order strategy", type: "textarea", seeds: "commerce", help: "Charge at order or at ship? Caps? Discount?" },
          { id: "commerce.fulfilment", label: "Fulfilment plan", type: "text", placeholder: "Self-ship, 3PL (ShipBob/Flexport…)" },
        ],
      },
    ],
  },
  {
    slug: "launch",
    title: "Brand launch",
    summary: "The pre-launch checklist, the email sequence, and photography.",
    sections: [
      {
        id: "plan",
        title: "Launch plan",
        fields: [
          { id: "launch.date", label: "Target launch date", type: "text", seeds: "production", placeholder: "e.g. 2026-10-01" },
          { id: "launch.listGoal", label: "Pre-launch email list goal", type: "text", seeds: "marketing", placeholder: "500–1,000" },
          { id: "launch.campaign", label: "Launch campaign angle", type: "textarea", seeds: "marketing" },
        ],
        checklist: [
          "Business entity formed",
          "Trademark filed in primary markets",
          "All launch SKUs sampled and approved",
          "Checkout tested end-to-end",
          "Shipping rates configured",
          "Returns policy + size guide published",
          "Product photography complete",
          "Launch email sequence drafted",
          "Email list at goal",
        ],
      },
    ],
  },
  {
    slug: "finance",
    title: "Financial plan",
    summary: "Startup budget, first-year revenue model, and the risks to watch.",
    sections: [
      {
        id: "money",
        title: "Money",
        intro: "A scrappy AI-and-pre-order launch can run $40–60k; don't plan to break even in year one.",
        fields: [
          { id: "fin.budget", label: "Launch budget", type: "text", placeholder: "e.g. $50,000" },
          { id: "fin.launchUnits", label: "Planned launch units", type: "text", placeholder: "units across N styles" },
          { id: "fin.risks", label: "Top risks & mitigations", type: "list", help: "Cash-flow gap, factory delay, duty surprise, return rate…" },
        ],
      },
    ],
  },
];

/** Flat list of every field, for AI prompts and seeding. */
export const PLAYBOOK_FIELDS: PbField[] = PLAYBOOK.flatMap((p) => p.sections.flatMap((s) => s.fields));

export type PlaybookAnswers = Record<string, string | string[] | boolean>;
