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
 * The database handle for a shop: a ShopDatabase DO facade — including,
 * once PRIMARY_ON_DO is flipped, the primary shop, which then lives in its
 * own DO like every other tenant (the bound D1 becomes platform-only:
 * registry, CRM, directory, certificates). Until the flip, the primary
 * stays on the bound D1. Callers treat the result as a D1Database.
 */
export function getShopDb(env: Env, shopId: string, primaryShopId: string): D1Database {
  if (primaryUsesBoundD1(shopId, primaryShopId, env.PRIMARY_ON_DO)) return env.DB;
  return getShopDoDb(env, shopId);
}

/**
 * Whether a shop resolves to the bound D1 (true) or its own Durable Object
 * (false). Only the primary shop can use the bound D1, and only while it hasn't
 * been migrated to its DO (PRIMARY_ON_DO !== "1"). Pure so tenant resolution —
 * the rule that keeps one shop's data out of another's database — is unit-
 * tested directly.
 */
export function primaryUsesBoundD1(
  shopId: string,
  primaryShopId: string,
  primaryOnDo: string | undefined,
): boolean {
  return shopId === primaryShopId && primaryOnDo !== "1";
}

/** The shop's Durable Object database, unconditionally — used by the
 *  primary-shop migration, which must write to the DO while reads still
 *  resolve to the bound D1. */
export function getShopDoDb(env: Env, shopId: string): D1Database {
  const stub = env.SHOP_DB.get(env.SHOP_DB.idFromName(shopId)) as unknown as Stub;
  return new ShopDbFacade(stub) as unknown as D1Database;
}
