import { DurableObject } from "cloudflare:workers";
import { SCHEMA_MIGRATIONS } from "../generated/migrations";

/**
 * One SQLite database per shop, as a Durable Object. Tenant isolation is
 * physical: a shop's queries run inside its own object against its own
 * storage — there is no WHERE clause to forget. The primary shop (Rezene)
 * stays on the bound D1; every other shop lives here.
 *
 * On first touch the object applies the embedded schema migrations
 * (identical files the primary D1 runs, minus the demo seed) and records
 * them in its own d1_migrations table, so future releases apply only
 * what's missing — the same idempotent semantics wrangler gives D1.
 */

export interface QueryRequest {
  sql: string;
  params: unknown[];
}

export interface QueryResult {
  results: Record<string, unknown>[];
  meta: { changes: number; last_row_id: number };
}

/** Split a migration file into statements (comment-aware, string-safe enough
 * for our schema files: semicolons only terminate statements at line ends). */
function splitStatements(sql: string): string[] {
  return sql
    .split(/;\s*(?:\n|$)/)
    .map((s) =>
      s
        .split("\n")
        .filter((line) => !/^\s*--/.test(line))
        .join("\n")
        .trim(),
    )
    .filter((s) => s.length > 0);
}

export class ShopDatabase extends DurableObject {
  private migrated = false;

  private ensureMigrated(): void {
    if (this.migrated) return;
    const sql = this.ctx.storage.sql;
    sql.exec(
      `CREATE TABLE IF NOT EXISTS d1_migrations (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         name TEXT UNIQUE,
         applied_at TEXT DEFAULT (datetime('now'))
       )`,
    );
    const applied = new Set(
      [...sql.exec(`SELECT name FROM d1_migrations`)].map((r) => String(r.name)),
    );
    for (const migration of SCHEMA_MIGRATIONS) {
      if (applied.has(migration.name)) continue;
      for (const statement of splitStatements(migration.sql)) {
        sql.exec(statement);
      }
      sql.exec(`INSERT INTO d1_migrations (name) VALUES (?)`, migration.name);
    }
    this.migrated = true;
  }

  private runOne(query: QueryRequest): QueryResult {
    const sql = this.ctx.storage.sql;
    const cursor = sql.exec(query.sql, ...(query.params as (string | number | null)[]));
    const results = [...cursor] as Record<string, unknown>[];
    return {
      results,
      meta: {
        changes: cursor.rowsWritten,
        last_row_id: Number(
          [...sql.exec(`SELECT last_insert_rowid() AS id`)][0]?.id ?? 0,
        ),
      },
    };
  }

  /** Execute one statement. */
  async query(request: QueryRequest): Promise<QueryResult> {
    this.ensureMigrated();
    return this.runOne(request);
  }

  /** Execute several statements atomically (D1 batch semantics). */
  async batch(requests: QueryRequest[]): Promise<QueryResult[]> {
    this.ensureMigrated();
    return this.ctx.storage.transactionSync(() => requests.map((r) => this.runOne(r)));
  }
}
