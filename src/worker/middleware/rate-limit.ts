import type { MiddlewareHandler } from "hono";
import type { AppContext } from "../types/env";

/**
 * Fixed-window rate limiter backed by KV. Good enough for public forms and
 * AI endpoints; swap for the Workers Rate Limiting binding or Durable
 * Objects if precision starts to matter.
 */
export function rateLimit(opts: {
  key: string;
  limit: number;
  windowSeconds: number;
}): MiddlewareHandler<AppContext> {
  return async (c, next) => {
    const ip =
      c.req.header("cf-connecting-ip") ?? c.req.header("x-forwarded-for") ?? "unknown";
    const window = Math.floor(Date.now() / (opts.windowSeconds * 1000));
    const kvKey = `rl:${opts.key}:${ip}:${window}`;
    const current = parseInt((await c.env.KV.get(kvKey)) ?? "0", 10);
    if (current >= opts.limit) {
      return c.json({ error: "Too many requests. Please try again shortly." }, 429);
    }
    // Not atomic — acceptable for abuse damping, not billing-grade quotas.
    await c.env.KV.put(kvKey, String(current + 1), {
      expirationTtl: Math.max(60, opts.windowSeconds * 2),
    });
    await next();
  };
}
