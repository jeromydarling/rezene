import { first, run } from "./db";
import { runWorkersAiChat } from "./workers-ai";
import { newId, sha256Hex } from "../utils/id";
import type { Env } from "../types/env";

/**
 * Lightweight content translation via Workers AI (Llama). Not full
 * localization: the storefront chrome stays in the default language; CMS
 * content (pages, journal posts) translates on demand and is cached in
 * `content_translations`, keyed by a hash of the source fields so edits
 * invalidate automatically. If Workers AI is unavailable or errors,
 * callers get `null` and serve the original language — the site never
 * breaks over a translation.
 */

/** Why the most recent translation attempt failed (admin diagnostics). */
export { lastWorkersAiError as lastTranslateError } from "./workers-ai";

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  fr: "French",
  es: "Spanish",
  de: "German",
  it: "Italian",
  pt: "Portuguese",
  nl: "Dutch",
  ar: "Arabic",
};

export async function getSupportedLanguages(db: D1Database): Promise<string[]> {
  const row = await first<{ value: string }>(
    db,
    `SELECT value FROM settings WHERE key = 'supported_languages'`,
  );
  try {
    const parsed = row ? (JSON.parse(row.value) as string[]) : null;
    return Array.isArray(parsed) && parsed.length > 0 ? parsed.map(String) : ["en"];
  } catch {
    return ["en"];
  }
}

async function translateText(env: Env, text: string, targetLang: string): Promise<string | null> {
  if (!text.trim()) return text;
  const language = LANGUAGE_NAMES[targetLang] ?? targetLang;
  return runWorkersAiChat(
    env,
    [
      {
        role: "system",
        content:
          `You are a professional translator. Translate the user's text into ${language}. ` +
          `Preserve all markdown formatting (headings, lists, links, emphasis) exactly. ` +
          `Keep brand names, product names, and URLs untranslated. ` +
          `Output ONLY the translation — no preamble, no notes, no quotation marks around it.`,
      },
      { role: "user", content: text.slice(0, 12_000) },
    ],
    { maxTokens: 4096 },
  );
}

/**
 * Translate a set of named fields, serving from cache when the source
 * hasn't changed. Returns null when translation isn't possible right now.
 */
export async function translateFields(
  env: Env,
  db: D1Database,
  entityType: "page" | "journal_post",
  entityId: string,
  lang: string,
  fields: Record<string, string | null>,
): Promise<Record<string, string | null> | null> {
  const sourceHash = await sha256Hex(
    Object.entries(fields)
      .map(([k, v]) => `${k}=${v ?? ""}`)
      .join(" "),
  );
  const cached = await first<{ source_hash: string; payload_json: string }>(
    db,
    `SELECT source_hash, payload_json FROM content_translations
     WHERE entity_type = ? AND entity_id = ? AND lang = ?`,
    entityType,
    entityId,
    lang,
  );
  if (cached && cached.source_hash === sourceHash) {
    try {
      return JSON.parse(cached.payload_json) as Record<string, string | null>;
    } catch {
      /* re-translate below */
    }
  }

  if (!env.AI) return null;
  const translated: Record<string, string | null> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value == null || !value.trim()) {
      translated[key] = value;
      continue;
    }
    const result = await translateText(env, value, lang);
    if (result === null) return null; // partial translations read worse than none
    translated[key] = result;
  }

  await run(
    db,
    `INSERT INTO content_translations (id, entity_type, entity_id, lang, source_hash, payload_json)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(entity_type, entity_id, lang) DO UPDATE SET
       source_hash = excluded.source_hash, payload_json = excluded.payload_json,
       created_at = datetime('now')`,
    newId("ctr"),
    entityType,
    entityId,
    lang,
    sourceHash,
    JSON.stringify(translated),
  );
  return translated;
}
