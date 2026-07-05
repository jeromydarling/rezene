import { Hono } from "hono";
import type { AppContext, Env } from "./types/env";

const app = new Hono<AppContext>();

app.get("/api/health", (c) =>
  c.json({
    ok: true,
    brand: c.env.BRAND_NAME,
    env: c.env.APP_ENV,
  }),
);

app.notFound((c) => c.json({ error: "Not found" }, 404));

export default {
  fetch: app.fetch,

  // Daily ops sweep (cron in wrangler.toml). Fleshed out alongside the
  // production-calendar and inventory modules.
  async scheduled(_controller: ScheduledController, _env: Env, _ctx: ExecutionContext) {
    // TODO: low-stock alerts, late production tasks, pending factory follow-ups.
  },
} satisfies ExportedHandler<Env>;
