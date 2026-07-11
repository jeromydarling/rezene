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

export async function companionAnswer(
  env: Env,
  question: string,
  route: string | null,
  history: CompanionTurn[],
): Promise<{ answer: string; sources: CompanionSource[]; provider: string }> {
  const chunks = retrieve(question, route);
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
${where ? `\nContext: ${where}` : ""}`;

  const historyText = history
    .slice(-6)
    .map((t) => `${t.role === "user" ? "User" : "Companion"}: ${t.content.slice(0, 600)}`)
    .join("\n");

  const prompt = `${context ? `SOURCES:\n\n${context}\n\n---\n\n` : ""}${historyText ? `Conversation so far:\n${historyText}\n\n` : ""}User: ${question}`;

  const { text, provider } = await aiComplete(env, { system, prompt, maxTokens: 900 });
  return {
    answer: text.trim(),
    sources: chunks.map((c) => ({ title: c.title, link: c.link })),
    provider,
  };
}

export { AiUnavailableError };
