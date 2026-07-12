import { first, run } from "./db";

/**
 * Configurable commission pipeline. Shops run their client work through
 * stages; the canonical set is fixed (the DB enforces it), but a shop can
 * put those stages in their own order, rename them to their language
 * ("Muslin" instead of "Fittings"), and hide the ones they don't use. The
 * config is stored in settings and merged over the defaults — an unconfigured
 * shop just gets the standard tailoring pipeline.
 *
 * Only the WORKING stages are configurable. The terminal states (done,
 * cancelled) are always present with fixed labels and never appear as pipeline
 * columns. Because storage always writes a canonical stage key, the DB CHECK
 * constraint holds and the built-in stage automations keep working — the
 * config only changes order and wording.
 */

export const WORKING_STAGES = ["consult", "design", "fabric", "cutting", "fitting", "delivery"] as const;
export type WorkingStage = (typeof WORKING_STAGES)[number];

const DEFAULT_LABELS: Record<string, string> = {
  consult: "Consult",
  design: "Design approved",
  fabric: "Fabric sourced",
  cutting: "Cutting",
  fitting: "Fittings",
  delivery: "Delivery",
  done: "Done",
  cancelled: "Cancelled",
};

// Alterations skip the development stages — a fixed shorter run.
export const ALTERATION_WORKING = ["consult", "fitting", "delivery"] as const;

export interface PipelineStage {
  key: string;
  label: string;
  active: boolean;
}

export interface ResolvedPipeline {
  /** Working stages in the shop's order, active flag intact. */
  stages: PipelineStage[];
  /** Label for every stage key, working + terminal. */
  labels: Record<string, string>;
}

const SETTINGS_KEY = "commission_pipeline";

function defaults(): PipelineStage[] {
  return WORKING_STAGES.map((key) => ({ key, label: DEFAULT_LABELS[key], active: true }));
}

/** Merge the saved config over the canonical defaults (defensively). */
export async function resolvePipeline(db: D1Database): Promise<ResolvedPipeline> {
  let stages = defaults();
  try {
    const row = await first<{ value: string }>(db, `SELECT value FROM settings WHERE key = ?`, SETTINGS_KEY);
    if (row?.value) {
      const saved = JSON.parse(row.value) as { stages?: { key?: string; label?: string; active?: boolean }[] };
      if (Array.isArray(saved.stages) && saved.stages.length) {
        const seen = new Set<string>();
        const ordered: PipelineStage[] = [];
        for (const s of saved.stages) {
          const key = String(s.key ?? "");
          if (!(WORKING_STAGES as readonly string[]).includes(key) || seen.has(key)) continue;
          seen.add(key);
          ordered.push({
            key,
            label: (typeof s.label === "string" && s.label.trim()) || DEFAULT_LABELS[key],
            active: s.active !== false,
          });
        }
        // Any canonical stage the config forgot stays available (inactive), so
        // no existing commission can end up on a stage the pipeline dropped.
        for (const key of WORKING_STAGES) {
          if (!seen.has(key)) ordered.push({ key, label: DEFAULT_LABELS[key], active: false });
        }
        stages = ordered;
      }
    }
  } catch {
    /* keep defaults */
  }
  const labels: Record<string, string> = { done: DEFAULT_LABELS.done, cancelled: DEFAULT_LABELS.cancelled };
  for (const s of stages) labels[s.key] = s.label;
  return { stages, labels };
}

export async function savePipeline(db: D1Database, stages: { key: string; label: string; active: boolean }[]): Promise<void> {
  // Keep only canonical keys, dedupe, cap label length.
  const seen = new Set<string>();
  const clean: PipelineStage[] = [];
  for (const s of stages) {
    if (!(WORKING_STAGES as readonly string[]).includes(s.key) || seen.has(s.key)) continue;
    seen.add(s.key);
    clean.push({ key: s.key, label: (s.label || DEFAULT_LABELS[s.key]).slice(0, 40), active: s.active !== false });
  }
  if (!clean.length) return;
  await run(
    db,
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    SETTINGS_KEY,
    JSON.stringify({ stages: clean }),
  );
}

export { DEFAULT_LABELS };
