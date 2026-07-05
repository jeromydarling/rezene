/**
 * Thin D1 helpers. Queries stay close to their routes (feature modules own
 * their SQL); this module only removes the binding/result boilerplate.
 */

export async function all<T = Record<string, unknown>>(
  db: D1Database,
  sql: string,
  ...params: unknown[]
): Promise<T[]> {
  const { results } = await db
    .prepare(sql)
    .bind(...params)
    .all<T>();
  return results;
}

export async function first<T = Record<string, unknown>>(
  db: D1Database,
  sql: string,
  ...params: unknown[]
): Promise<T | null> {
  return await db
    .prepare(sql)
    .bind(...params)
    .first<T>();
}

export async function run(
  db: D1Database,
  sql: string,
  ...params: unknown[]
): Promise<D1Result> {
  return await db
    .prepare(sql)
    .bind(...params)
    .run();
}

/** Parse a TEXT column expected to hold a JSON array; tolerate bad data. */
export function jsonArray(value: unknown): string[] {
  if (typeof value !== "string" || !value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

/** Parse a TEXT column expected to hold JSON; returns {} on bad data. */
export function jsonObject(value: unknown): unknown {
  if (typeof value !== "string" || !value) return {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

export async function writeAudit(
  db: D1Database,
  userId: string | null,
  action: string,
  entityType: string | null,
  entityId: string | null,
  detail?: unknown,
): Promise<void> {
  await run(
    db,
    `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, detail)
     VALUES (?, ?, ?, ?, ?, ?)`,
    `aud_${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`,
    userId,
    action,
    entityType,
    entityId,
    detail === undefined ? null : JSON.stringify(detail),
  );
}
