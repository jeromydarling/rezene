/**
 * Business Strategy — shared vocabulary between the worker (which builds the
 * documents with Claude) and the client (which lets a shop pick a tool, a
 * persona, and a voice). The heavy prompts and schemas live server-side in
 * `worker/services/strategy.ts`; this file is only the labels both sides agree
 * on, plus the structured shape a finished document takes.
 */

/** The four strategy tools a shop can run. */
export type StrategyKind = "swot" | "business_plan" | "okrs" | "competitive";

/** Business plans come in two depths; other tools ignore this. */
export type StrategyVariant = "lean" | "full";

/** The advisory "voice" Claude adopts. */
export type StrategyPersona = "advisor" | "investor" | "operator" | "coach";

export interface StrategyKindMeta {
  key: StrategyKind;
  label: string;
  tagline: string;
  blurb: string;
  /** Emoji marker used on the picker cards. */
  icon: string;
  /** The persona pre-selected when you open this tool (you can change it). */
  defaultPersona: StrategyPersona;
  /** business_plan is the only tool with a lean/full choice. */
  variants?: { key: StrategyVariant; label: string; blurb: string }[];
  /** Placeholder shown in the brief box. */
  briefPlaceholder: string;
}

export const STRATEGY_KINDS: StrategyKindMeta[] = [
  {
    key: "swot",
    label: "SWOT analysis",
    tagline: "Where you stand, honestly",
    blurb:
      "A clear-eyed read of your Strengths, Weaknesses, Opportunities, and Threats — then the two or three moves that actually follow from it.",
    icon: "🧭",
    defaultPersona: "advisor",
    briefPlaceholder:
      "Anything you want weighed in — a launch you're planning, a channel that's stalling, a competitor that just moved. Leave it blank to work from what Verto already knows about the brand.",
  },
  {
    key: "business_plan",
    label: "Business plan",
    tagline: "Your model, on one page or ten",
    blurb:
      "Articulate the business — problem, customer, offer, economics, and the path to growth. A lean canvas for yourself, or a full plan to pitch a partner or investor.",
    icon: "📋",
    defaultPersona: "investor",
    variants: [
      { key: "lean", label: "Lean canvas", blurb: "One page — the model at a glance, for you." },
      { key: "full", label: "Full plan", blurb: "Investor-ready — market, product, go-to-market, ops, and numbers." },
    ],
    briefPlaceholder:
      "What's this plan for? e.g. raising a small round, bringing on a production partner, or just getting the model straight in your own head. Add any numbers you already know.",
  },
  {
    key: "okrs",
    label: "OKRs & goals",
    tagline: "What to actually do this quarter",
    blurb:
      "Turn ambition into a handful of measurable objectives with concrete key results — the kind you can check yourself against in ninety days.",
    icon: "🎯",
    defaultPersona: "operator",
    briefPlaceholder:
      "What does a great next quarter look like? e.g. \"first wholesale doors\", \"steady DTC repeat rate\", \"the spring drop out on time\". Verto shapes it into objectives and key results.",
  },
  {
    key: "competitive",
    label: "Competitive analysis",
    tagline: "The landscape and your way in",
    blurb:
      "Map the labels your customer also shops — how they're positioned, where they're strong, and the white space you can own. Barriers to entry named plainly.",
    icon: "⚔️",
    defaultPersona: "advisor",
    briefPlaceholder:
      "Name any competitors you already watch, or the segment you're entering. Verto folds in the brand dossiers you've built in R&D and finds the gaps.",
  },
];

export interface StrategyPersonaMeta {
  key: StrategyPersona;
  label: string;
  blurb: string;
}

export const STRATEGY_PERSONAS: StrategyPersonaMeta[] = [
  { key: "advisor", label: "Strategy advisor", blurb: "Direct and practical. Honest about trade-offs, allergic to fluff." },
  { key: "investor", label: "Investor lens", blurb: "Skeptical on unit economics, defensibility, and the size of the prize." },
  { key: "operator", label: "Operating partner", blurb: "Thinks in sequencing, resourcing, and what ships when." },
  { key: "coach", label: "Founder coach", blurb: "Encouraging and plain-spoken. Keeps it human and doable." },
];

// --- The shape a finished document takes ------------------------------------

export type StrategySectionKind = "list" | "text" | "keyvalue" | "okr";

export interface StrategyKeyResult {
  kr: string;
  target?: string;
}

export interface StrategyObjective {
  objective: string;
  rationale?: string;
  keyResults: StrategyKeyResult[];
}

export interface StrategySection {
  heading: string;
  kind: StrategySectionKind;
  /** kind: "text" */
  body?: string;
  /** kind: "list" */
  items?: string[];
  /** kind: "keyvalue" */
  pairs?: { label: string; value: string }[];
  /** kind: "okr" */
  objectives?: StrategyObjective[];
}

export interface StrategyAction {
  title: string;
  detail?: string;
  kind: "milestone" | "deadline";
  /** Days from today the action should land on the calendar. */
  dueInDays: number;
}

export interface StrategyContent {
  summary: string;
  sections: StrategySection[];
  actions: StrategyAction[];
}

export interface StrategyDoc {
  id: string;
  kind: StrategyKind;
  variant: StrategyVariant | null;
  persona: StrategyPersona;
  title: string;
  brief: string | null;
  content: StrategyContent | null;
  scheduled: number[];
  status: "active" | "archived";
  provider: string | null;
  plain: boolean;
  createdAt: string;
  updatedAt: string;
}

export function strategyKindMeta(kind: string): StrategyKindMeta | undefined {
  return STRATEGY_KINDS.find((k) => k.key === kind);
}

export function strategyPersonaMeta(persona: string): StrategyPersonaMeta | undefined {
  return STRATEGY_PERSONAS.find((p) => p.key === persona);
}

/** Human label for a document, e.g. "Business plan · Lean canvas". */
export function strategyDocLabel(kind: string, variant?: string | null): string {
  const meta = strategyKindMeta(kind);
  if (!meta) return kind;
  const v = variant && meta.variants?.find((x) => x.key === variant);
  return v ? `${meta.label} · ${v.label}` : meta.label;
}
