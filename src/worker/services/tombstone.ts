/**
 * Undo for destructive actions. A soft delete SELECTs the row, stashes it as
 * a tombstone (30-day shelf life, pruned opportunistically), then deletes —
 * the UI's toast offers Undo, which re-inserts the row verbatim.
 *
 * Only single-row entities are restorable: rows with dependent children
 * (a product and its variants) would come back incomplete, which is worse
 * than a confirm dialog. Grow the allow-list deliberately.
 */
import { first, run } from "./db";
import { newId } from "../utils/id";

type DB = D1Database;

const RESTORABLE = new Set([
  "research_notes",
  "research_makers",
  "production_tasks",
  "samples",
  "production_calendar_events",
  "strategy_docs",
]);

/** Delete with a safety net. Returns the tombstone id, or null if the table
 *  isn't in the allow-list / the row is gone (caller falls back to a plain
 *  delete result). */
export async function softDelete(db: DB, table: string, id: string, label: string): Promise<string | null> {
  if (!RESTORABLE.has(table)) return null;
  const row = await first<Record<string, unknown>>(db, `SELECT * FROM ${table} WHERE id = ?`, id);
  if (!row) return null;
  const tombId = newId("tomb");
  try {
    await run(
      db,
      `INSERT INTO tombstones (id, entity_type, entity_id, label, row_json) VALUES (?, ?, ?, ?, ?)`,
      tombId,
      table,
      id,
      label,
      JSON.stringify(row),
    );
    // Opportunistic prune — undo is a moment-later affordance, not an archive.
    await run(db, `DELETE FROM tombstones WHERE created_at < datetime('now', '-30 days')`);
  } catch {
    return null; // tombstones table not provisioned — plain delete still works
  }
  await run(db, `DELETE FROM ${table} WHERE id = ?`, id);
  return tombId;
}

export async function restore(db: DB, tombstoneId: string): Promise<{ ok: boolean; error?: string }> {
  const tomb = await first<{ entity_type: string; row_json: string }>(
    db,
    `SELECT entity_type, row_json FROM tombstones WHERE id = ?`,
    tombstoneId,
  );
  if (!tomb) return { ok: false, error: "Nothing to restore — the undo window has passed." };
  if (!RESTORABLE.has(tomb.entity_type)) return { ok: false, error: "This record can't be restored." };
  const row = JSON.parse(tomb.row_json) as Record<string, unknown>;
  const cols = Object.keys(row);
  try {
    await run(
      db,
      `INSERT INTO ${tomb.entity_type} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`,
      ...cols.map((k) => row[k]),
    );
  } catch (err) {
    return { ok: false, error: "Couldn't restore — something else now depends on its absence." };
  }
  await run(db, `DELETE FROM tombstones WHERE id = ?`, tombstoneId);
  return { ok: true };
}
