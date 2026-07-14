import type { Env } from "../types/env";

/**
 * Best-effort error/incident recorder for Verto HQ. Called from the worker's
 * onError hook on every 500; writes to the platform `platform_errors` table
 * (env.DB), deduped by a signature so a recurring fault is one row with a count
 * and a last-seen, not a flood. Never throws — an analytics write must never
 * turn one failing request into two.
 */

export interface PlatformErrorInput {
  shopId?: string | null;
  method?: string;
  path?: string;
  status?: number;
  message?: string;
}

/**
 * Normalize a path so instances of the same route group: id-ish segments
 * (containing a digit, or very long) collapse to ':id'. /shops/ord_r1/x →
 * /shops/:id/x. Keeps the shape, drops the cardinality.
 */
export function normalizePath(path: string): string {
  return path
    .split("/")
    .map((seg) => (seg && (/\d/.test(seg) || seg.length > 24) ? ":id" : seg))
    .join("/")
    .slice(0, 200);
}

/** A stable, short dedup key from method + normalized path + the message's leading class. */
function signature(method: string, path: string, message: string): string {
  const head = message.replace(/\s+/g, " ").trim().slice(0, 60);
  return `${method} ${path} :: ${head}`.slice(0, 240);
}

export async function recordPlatformError(env: Env, input: PlatformErrorInput): Promise<void> {
  try {
    const method = (input.method ?? "").toUpperCase().slice(0, 10);
    const path = normalizePath(input.path ?? "");
    const message = (input.message ?? "").slice(0, 500);
    const sig = signature(method, path, message);
    await env.DB.prepare(
      `INSERT INTO platform_errors (signature, shop_id, method, path, status, message)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(signature) DO UPDATE SET
         count = count + 1,
         last_seen = datetime('now'),
         shop_id = excluded.shop_id,
         status = excluded.status,
         -- a recurrence re-opens a previously resolved incident
         resolved_at = NULL`,
    )
      .bind(sig, input.shopId ?? null, method, path, input.status ?? 500, message)
      .run();
  } catch {
    /* never break a request path over analytics */
  }
}
