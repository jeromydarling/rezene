/**
 * The page-context channel: any admin page can tell the Companion what is
 * actually on screen — the open pattern draft, the selected concept, the
 * study being read — as one short plain-text summary. The Companion reads
 * it at ask time and sends it with the question, which is what lets it
 * catch a mistake in THIS draft instead of describing drafts in general.
 *
 * Deliberately not React state: pages set it as a side effect, the
 * Companion polls it per ask, nothing re-renders.
 */

let current: string | null = null;

export function setCompanionContext(text: string | null): void {
  current = text ? text.slice(0, 1200) : null;
}

export function getCompanionContext(): string | null {
  return current;
}
