/**
 * The Verto Companion's grounding layer. Verto already owns an unusual
 * corpus — nine courses of real craft (the school) and a deep manual for
 * every module (the KB) — so the companion retrieves from what the product
 * actually teaches and cites it, instead of free-associating.
 *
 * Retrieval is deliberately lexical (term overlap with title/keyword
 * boosts): the corpus is small (~150 chunks), domain terms are distinctive
 * ("scye", "balance", "markdown"), and it needs no index, no embeddings
 * service, and no configuration — it works on every deployment the moment
 * it ships, in the house tradition of degrading cleanly.
 */
import { KB_ARTICLES } from "../../app/kb/index";
import { COURSES } from "../school/content";
import { aiComplete, AiUnavailableError } from "./ai";
import type { Env } from "../types/env";

export interface CompanionSource {
  title: string;
  link: string;
}

interface Chunk {
  title: string;
  link: string;
  keywords: string;
  text: string;
}

// ---- corpus (built once per isolate) ----------------------------------------

let CORPUS: Chunk[] | null = null;

const stripFigures = (md: string): string => md.replace(/!\[[^\]]*\]\([^)]*\)\n?(\*[^*]+\*\n?)?/g, "");

function buildCorpus(): Chunk[] {
  const chunks: Chunk[] = [];
  for (const a of KB_ARTICLES) {
    // Split long guides on their section headings so retrieval lands on the
    // paragraph that answers, not the whole chapter.
    const sections = a.body.split(/\n## /);
    sections.forEach((sec, i) => {
      const [head = "", ...rest] = sec.split("\n");
      const sectionTitle = i === 0 ? a.title : `${a.title} — ${head.trim()}`;
      const text = (i === 0 ? sec : rest.join("\n")).trim();
      if (text.length < 80) return;
      chunks.push({
        title: sectionTitle.replace(/^#\s*/, ""),
        link: `/admin/support/kb/${a.slug}`,
        keywords: a.keywords ?? "",
        text: text.slice(0, 2400),
      });
    });
  }
  for (const course of COURSES) {
    course.lessons.forEach((lesson, idx) => {
      chunks.push({
        title: `${course.title} — ${lesson.title} (Verto School)`,
        link: `/admin/school/${course.slug}/lesson/${idx}`,
        keywords: `${course.slug} ${course.summary}`,
        text: stripFigures(lesson.bodyMd).slice(0, 2600),
      });
    });
  }
  return chunks;
}

// ---- retrieval ----------------------------------------------------------------

const STOP = new Set(
  "the a an and or of to in on for with is are was be do does my your our this that it as at by from how what why when can i we".split(" "),
);

const tokenize = (s: string): string[] =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .filter((w) => w.length > 2 && !STOP.has(w));

export function retrieve(question: string, route: string | null, k = 6): Chunk[] {
  if (!CORPUS) CORPUS = buildCorpus();
  const terms = [...new Set(tokenize(question))];
  if (!terms.length) return [];
  const scored = CORPUS.map((c) => {
    const titleLc = c.title.toLowerCase();
    const textLc = c.text.toLowerCase();
    let score = 0;
    for (const t of terms) {
      if (titleLc.includes(t)) score += 4;
      if (c.keywords.includes(t)) score += 2;
      let n = 0;
      let i = textLc.indexOf(t);
      while (i !== -1 && n < 5) {
        n++;
        i = textLc.indexOf(t, i + t.length);
      }
      score += n;
    }
    // A gentle nudge toward the module the user is standing in.
    if (route && c.link !== "/admin/support/kb/undefined" && route.startsWith("/admin/school") && c.link.startsWith("/admin/school")) score += 1;
    return { c, score };
  })
    .filter((x) => x.score >= 3)
    .sort((a, b) => b.score - a.score);
  // At most two chunks per destination so one long chapter can't crowd out the rest.
  const out: Chunk[] = [];
  const perLink = new Map<string, number>();
  for (const { c } of scored) {
    const n = perLink.get(c.link) ?? 0;
    if (n >= 2) continue;
    perLink.set(c.link, n + 1);
    out.push(c);
    if (out.length >= k) break;
  }
  return out;
}

// ---- the module the user is standing in ---------------------------------------

export function moduleContext(route: string | null): string | null {
  if (!route) return null;
  // Longest matching KB moduleRoute wins ("/admin/research" over "/admin").
  let best: { title: string; summary: string; len: number } | null = null;
  for (const a of KB_ARTICLES) {
    if (a.moduleRoute && a.moduleRoute !== "/admin" && route.startsWith(a.moduleRoute) && (!best || a.moduleRoute.length > best.len)) {
      best = { title: a.title, summary: a.summary, len: a.moduleRoute.length };
    }
  }
  return best ? `The user is currently on: ${best.title}. (${best.summary})` : null;
}

// ---- the ask -------------------------------------------------------------------

export interface CompanionTurn {
  role: "user" | "assistant";
  content: string;
}

// ---- proposed actions -----------------------------------------------------
// The companion never executes anything: it may end a reply with an ACTIONS
// line proposing up to two concrete next steps. The server validates them
// against this whitelist, the client renders them as buttons, and the click
// runs through the same admin APIs (and the same write-permission checks)
// as doing it by hand.

export interface CompanionAction {
  type: "open" | "create_concept" | "create_trend_board" | "create_price_study" | "add_research_note";
  label: string;
  path?: string;
  title?: string;
  brief?: string;
  name?: string;
  category?: string;
  market?: string;
  bodyMd?: string;
  directions?: { label: string; note?: string }[];
}

const cleanStr = (v: unknown, max: number): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;

function parseActions(raw: string): { answer: string; actions: CompanionAction[] } {
  const m = raw.match(/\n?ACTIONS:\s*(\[[\s\S]*\])\s*$/);
  if (!m) return { answer: raw.trim(), actions: [] };
  const answer = raw.slice(0, m.index).trim();
  try {
    const parsed = JSON.parse(m[1]) as unknown[];
    const actions: CompanionAction[] = [];
    for (const a of Array.isArray(parsed) ? parsed.slice(0, 2) : []) {
      const o = a as Record<string, unknown>;
      const label = cleanStr(o.label, 80);
      if (!label) continue;
      switch (o.type) {
        case "open": {
          const path = cleanStr(o.path, 200);
          if (path && path.startsWith("/admin")) actions.push({ type: "open", label, path });
          break;
        }
        case "create_concept": {
          const title = cleanStr(o.title, 200);
          if (title) actions.push({ type: "create_concept", label, title, brief: cleanStr(o.brief, 2000) });
          break;
        }
        case "create_trend_board": {
          const title = cleanStr(o.title, 200);
          if (!title) break;
          const directions = Array.isArray(o.directions)
            ? (o.directions as Record<string, unknown>[])
                .map((d) => ({ label: cleanStr(d.label, 160) ?? "", note: cleanStr(d.note, 400) }))
                .filter((d) => d.label)
                .slice(0, 6)
            : [];
          actions.push({ type: "create_trend_board", label, title, directions });
          break;
        }
        case "create_price_study": {
          const name = cleanStr(o.name, 200) ?? cleanStr(o.title, 200);
          if (name) actions.push({ type: "create_price_study", label, name, category: cleanStr(o.category, 160), market: cleanStr(o.market, 160) });
          break;
        }
        case "add_research_note": {
          const title = cleanStr(o.title, 200);
          if (title) actions.push({ type: "add_research_note", label, title, bodyMd: cleanStr(o.bodyMd, 8000) });
          break;
        }
      }
    }
    return { answer, actions };
  } catch {
    return { answer, actions: [] };
  }
}

export async function companionAnswer(
  env: Env,
  question: string,
  route: string | null,
  history: CompanionTurn[],
  opts: { plain?: boolean; shopContext?: string | null; pageContext?: string | null; extraChunks?: Chunk[] } = {},
): Promise<{ answer: string; sources: CompanionSource[]; actions: CompanionAction[]; provider: string }> {
  const chunks = [...retrieve(question, route), ...(opts.extraChunks ?? []).slice(0, 3)];
  const context = chunks
    .map((c, i) => `[${i + 1}] ${c.title}\n${c.text}`)
    .join("\n\n---\n\n")
    .slice(0, 9000);
  const where = moduleContext(route);

  const system = `You are the Verto Companion — a calm, senior atelier hand inside Verto, the studio platform for independent designers, tailors and boutique labels. You have read the Verto School's nine courses (taught from the pre-1931 masters: Vincent, Madison, Picken, Nystrom) and every page of the product manual.

Rules:
- Answer briefly and warmly, in plain language — a couple of short paragraphs or a short list. No corporate filler.
- Ground answers in the SOURCES when they apply, and mark claims taken from them with [1], [2] … matching the source numbers. Don't invent sources.
- When the question is about doing something in Verto, name the exact place as a markdown link with a relative path, e.g. [Pattern Studio](/admin/patterns), [R&D → Price studies](/admin/research/pricing), [the Timeless Library](/admin/library).
- Craft questions deserve craft answers: quote the masters' reasoning (balance, ease, seat angle, price zones), not generic advice.
- If you genuinely don't know, or the question needs live market data, say so and point to [R&D](/admin/research) where research runs with citations.
- Never fabricate prices, laws, or measurements. Money in Verto is integer cents; don't do tax or legal advice.
- When a concrete next step in Verto would genuinely help, you may end the reply with ONE line proposing at most 2 actions:
ACTIONS: [{"type":"open","label":"Open the Pattern Studio","path":"/admin/patterns"}]
Allowed types (no others): open {path}; create_concept {title, brief}; create_trend_board {title, directions:[{label,note}]}; create_price_study {name, category, market}; add_research_note {title, bodyMd}. The user sees these as buttons and decides — propose them only when they follow directly from your answer.${
    opts.plain
      ? `

PLAIN-LANGUAGE MODE IS ON. The user is new to sewing and tailoring. Keep every trade term, but define it in plain words the moment it appears — "the scye (the armhole)", "pitch (the angle the sleeve is rotated when it's sewn in)", "ease (extra room beyond the body's own measurement)". Prefer everyday words, short sentences, and one concrete example over abstraction. Never talk down; explain like a friendly teacher at the cutting table.`
      : ""
  }
${where ? `\nContext: ${where}` : ""}${opts.shopContext ? `\nThis shop right now: ${opts.shopContext}` : ""}${
    opts.pageContext
      ? `\nON THE USER'S SCREEN RIGHT NOW: ${opts.pageContext}\nWhen the question touches this work, answer about THIS draft/study/concept specifically — check its numbers against good practice, and if something looks off (ease of 0% on a fitted block, a measurement that contradicts the size, a retail between two zones), say so plainly. Catching a mistake before cloth is cut is the best help you can give.`
      : ""
  }`;

  const historyText = history
    .slice(-6)
    .map((t) => `${t.role === "user" ? "User" : "Companion"}: ${t.content.slice(0, 600)}`)
    .join("\n");

  const prompt = `${context ? `SOURCES:\n\n${context}\n\n---\n\n` : ""}${historyText ? `Conversation so far:\n${historyText}\n\n` : ""}User: ${question}`;

  const { text, provider } = await aiComplete(env, { system, prompt, maxTokens: 900 });
  const { answer, actions } = parseActions(text);
  return {
    answer,
    sources: chunks.map((c) => ({ title: c.title, link: c.link })),
    actions,
    provider,
  };
}

export { AiUnavailableError };
