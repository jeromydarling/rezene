import type { Env } from "../types/env";
import type { QueryRequest, QueryResult } from "../do/shop-database";

/**
 * A D1-compatible facade over a shop's ShopDatabase Durable Object, so
 * every existing route/service (written against D1's
 * prepare().bind().all/first/run + batch) works unchanged against a
 * per-shop database. Only the surface this codebase actually uses is
 * implemented.
 */

/** RPC surface of the ShopDatabase DO (typed locally — generic stub
 * typing depends on the workers-types version). */
interface Stub {
  query(request: QueryRequest): Promise<QueryResult>;
  batch(requests: QueryRequest[]): Promise<QueryResult[]>;
}

class ShopPreparedStatement {
  constructor(
    private stub: Stub,
    private sql: string,
    private params: unknown[] = [],
  ) {}

  bind(...params: unknown[]): ShopPreparedStatement {
    return new ShopPreparedStatement(this.stub, this.sql, params);
  }

  /** @internal for batch() */
  toRequest(): QueryRequest {
    return { sql: this.sql, params: this.params };
  }

  async all<T = Record<string, unknown>>(): Promise<{ results: T[]; meta: QueryResult["meta"] }> {
    const result = await this.stub.query(this.toRequest());
    return { results: result.results as T[], meta: result.meta };
  }

  async first<T = Record<string, unknown>>(): Promise<T | null> {
    const result = await this.stub.query(this.toRequest());
    return (result.results[0] as T) ?? null;
  }

  async run(): Promise<{ success: boolean; meta: QueryResult["meta"] }> {
    const result = await this.stub.query(this.toRequest());
    return { success: true, meta: result.meta };
  }

  async raw<T = unknown[]>(): Promise<T[]> {
    const result = await this.stub.query(this.toRequest());
    return result.results.map((row) => Object.values(row)) as T[];
  }
}

class ShopDbFacade {
  constructor(private stub: Stub) {}

  prepare(sql: string): ShopPreparedStatement {
    return new ShopPreparedStatement(this.stub, sql);
  }

  async batch(statements: ShopPreparedStatement[]): Promise<{ success: boolean; meta: QueryResult["meta"] }[]> {
    const results = await this.stub.batch(statements.map((s) => s.toRequest()));
    return results.map((r) => ({ success: true, meta: r.meta }));
  }

  async exec(sql: string): Promise<{ count: number; duration: number }> {
    await this.stub.query({ sql, params: [] });
    return { count: 1, duration: 0 };
  }
}

/**
 * The database handle for a shop: the bound D1 for the primary shop,
 * a ShopDatabase DO facade for everyone else. Callers treat the result
 * as a D1Database — the facade implements the used surface.
 */
export function getShopDb(env: Env, shopId: string, primaryShopId: string): D1Database {
  if (shopId === primaryShopId) return env.DB;
  const stub = env.SHOP_DB.get(env.SHOP_DB.idFromName(shopId)) as unknown as Stub;
  return new ShopDbFacade(stub) as unknown as D1Database;
}
