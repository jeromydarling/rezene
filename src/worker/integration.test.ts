import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Miniflare } from "miniflare";
import { createServer, type Server } from "node:http";
import { emit } from "./services/activity";
import { savePipeline, resolvePipeline } from "./services/pipeline";
import { sendClientMessage } from "./services/client-messages";
import { mintApiKey, verifyApiKey, revokeApiKey } from "./services/api-keys";
import { recordAiUsage, estimateCostCents } from "./services/ai-usage";
import { computeShopDay, rollupFleetMetrics } from "./services/shop-metrics";
import { recordPlatformError, normalizePath } from "./services/platform-errors";
import { fleetActivity } from "./services/fleet-activity";
import { createLookbook, resolveRenderModel, updateLookbook, availableProducts } from "./services/lookbook";
import { first, all, run } from "./services/db";
import { Hono } from "hono";
import { wholesalePortalRoutes } from "./routes/wholesale-portal";
import { adminWholesaleRoutes } from "./routes/admin-wholesale";
import { handleStripeEvent } from "./routes/stripe-webhooks";
import { createInvoiceCheckout } from "./services/wholesale";
import { newId, sha256Hex } from "./utils/id";
import type Stripe from "stripe";
import type { AppContext } from "./types/env";
import type { Env } from "./types/env";

/**
 * Integration tests — the real thing, against a real D1 (Miniflare's SQLite).
 * These drive the actual event spine end to end: emit() → built-in automations
 * → the no-code workflow engine, plus the pipeline config and the client
 * outbox. No network (no AI keys/binding, so client messages fall back to the
 * written template), no HTTP layer — just the worker's own code against a live
 * database with the production migrations applied.
 */

let mf: Miniflare;
let db: D1Database;
let env: Env;
// A ctx whose waitUntil we can await, so deferred (network-path) work completes
// deterministically inside the test.
const deferred: Promise<unknown>[] = [];
const ctx = { waitUntil: (p: Promise<unknown>) => void deferred.push(p) };
const flush = async () => {
  while (deferred.length) await deferred.shift();
};

const MIGRATIONS_DIR = join(__dirname, "../../migrations");

// The per-shop DB applies every migration except the platform-only / seed ones
// (mirrors scripts/embed-migrations.mjs). This test DB represents a shop DB.
const EXCLUDE = new Set([
  "0002_seed_demo_data.sql",
  "0009_verto_shops.sql",
  "0010_platform_crm.sql",
  "0011_crm_health_inbox.sql",
  "0016_feedback.sql",
  "0020_kb_overrides.sql",
  "0021_superadmin_role.sql",
  "0045_school_certificates.sql",
  "0047_library_cache.sql",
  "0048_directory.sql",
  "0049_activation_events.sql",
  // Referrals ALTER the platform `shops` registry, which this shop-DB harness
  // deliberately doesn't have (0009 is excluded above). 0060/0061 stay in:
  // they create standalone tables, so applying them here is harmless coverage.
  "0062_referrals.sql",
  "0063_stripe_connect_billing.sql", // also ALTERs the platform shops registry
  "0064_email_verification.sql", // ALTERs the platform shops registry
]);

beforeAll(async () => {
  mf = new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response('ok'); } }",
    d1Databases: { DB: "verto-test" },
    kvNamespaces: ["KV"],
  });
  db = (await mf.getD1Database("DB")) as unknown as D1Database;
  const kv = await mf.getKVNamespace("KV");

  // Apply every migration in order — the same SQL the platform D1 and each
  // shop DO run. No triggers in these files, so a whole-file exec is safe.
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql") && !EXCLUDE.has(f)).sort();
  for (const f of files) {
    const raw = readFileSync(join(MIGRATIONS_DIR, f), "utf8");
    // Strip `--` comments (whole-line and trailing) so D1's exec sees only SQL,
    // then run each statement.
    const cleaned = raw
      .split("\n")
      .map((line) => line.replace(/--.*$/, ""))
      .join("\n");
    const statements = cleaned
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const stmt of statements) {
      try {
        await db.exec(stmt.replace(/\n/g, " "));
      } catch (err) {
        throw new Error(`migration ${f} failed on: ${stmt.slice(0, 80)} — ${String(err).slice(0, 200)}`);
      }
    }
  }

  // Minimal shop registry so verifyApiKey can resolve the slug. Using the
  // primary shop id makes getShopDb return the bound D1 (this same test db).
  await db.exec(
    `CREATE TABLE IF NOT EXISTS shops (id TEXT PRIMARY KEY, slug TEXT, name TEXT, status TEXT, custom_domain TEXT, plan TEXT, created_at TEXT DEFAULT (datetime('now')))`,
  );
  await run(
    db,
    `INSERT INTO shops (id, slug, name, status, created_at) VALUES ('shop_rezene', 'teststudio', 'Test Studio', 'active', datetime('now'))`,
  );

  env = { DB: db, KV: kv, BRAND_NAME: "Test Studio" } as unknown as Env;
}, 60_000);

afterAll(async () => {
  await mf?.dispose();
});

describe("commission pipeline config", () => {
  it("renames, reorders and hides stages while keeping labels for terminal states", async () => {
    await savePipeline(db, [
      { key: "fitting", label: "Muslin", active: true },
      { key: "delivery", label: "Handover", active: true },
      { key: "consult", label: "First chat", active: true },
      { key: "cutting", label: "Cutting", active: false },
    ]);
    const resolved = await resolvePipeline(db);
    // Order is honoured: the saved order comes first.
    expect(resolved.stages.slice(0, 3).map((s) => s.key)).toEqual(["fitting", "delivery", "consult"]);
    // Renames stick.
    expect(resolved.labels.fitting).toBe("Muslin");
    expect(resolved.labels.delivery).toBe("Handover");
    // Hidden stage is kept but inactive (so existing commissions never vanish).
    expect(resolved.stages.find((s) => s.key === "cutting")?.active).toBe(false);
    // A canonical stage the config forgot (design) is still present, inactive.
    expect(resolved.stages.find((s) => s.key === "design")).toBeTruthy();
    // Terminal labels always resolve.
    expect(resolved.labels.done).toBe("Done");
    expect(resolved.labels.cancelled).toBe("Cancelled");
  });
});

describe("workflow engine via emit()", () => {
  it("runs a create_task action with {field} interpolation when the trigger fires", async () => {
    await run(
      db,
      `INSERT INTO workflows (id, name, trigger_event, conditions_json, actions_json, enabled)
       VALUES ('wf_task', 'Greet new clients', 'client.created', '[]', ?, 1)`,
      JSON.stringify([{ type: "create_task", params: { title: "Welcome {name}", dueInDays: "3" } }]),
    );
    await emit(
      db,
      { kind: "client.created", entityType: "client", entityId: "c_wf1", title: "New client", payload: { clientId: "c_wf1", name: "Maya Okafor" } },
      { env, ctx },
    );
    await flush();
    const task = await first<{ title: string; due_date: string | null }>(
      db,
      `SELECT title, due_date FROM production_tasks WHERE title = 'Welcome Maya Okafor'`,
    );
    expect(task).toBeTruthy();
    expect(task!.due_date).toBeTruthy();
    const runRow = await first<{ status: string }>(db, `SELECT status FROM workflow_runs WHERE workflow_id = 'wf_task' ORDER BY created_at DESC LIMIT 1`);
    expect(runRow?.status).toBe("ok");
    const wf = await first<{ run_count: number }>(db, `SELECT run_count FROM workflows WHERE id = 'wf_task'`);
    expect(wf!.run_count).toBeGreaterThan(0);
  });

  it("honours conditions — fires above the threshold, skips below it", async () => {
    await run(
      db,
      `INSERT INTO workflows (id, name, trigger_event, conditions_json, actions_json, enabled)
       VALUES ('wf_vip', 'VIP deposits', 'deposit.paid', ?, ?, 1)`,
      JSON.stringify([{ field: "amountCents", op: "gt", value: "50000" }]),
      JSON.stringify([{ type: "activity_note", params: { title: "VIP paid {label}" } }]),
    );
    // Below threshold → skipped, no note.
    await emit(
      db,
      { kind: "deposit.paid", entityType: "commission", entityId: "co1", title: "small", payload: { clientId: "c1", label: "Deposit", amountCents: 10000 } },
      { env, ctx },
    );
    await flush();
    let notes = await all<{ id: string }>(db, `SELECT id FROM activity_events WHERE kind = 'workflow.note' AND title = 'VIP paid Deposit'`);
    expect(notes.length).toBe(0);
    let skipped = await first<{ status: string }>(db, `SELECT status FROM workflow_runs WHERE workflow_id = 'wf_vip' ORDER BY created_at DESC LIMIT 1`);
    expect(skipped?.status).toBe("skipped");

    // Above threshold → note is posted.
    await emit(
      db,
      { kind: "deposit.paid", entityType: "commission", entityId: "co2", title: "big", payload: { clientId: "c1", label: "Deposit", amountCents: 90000 } },
      { env, ctx },
    );
    await flush();
    notes = await all<{ id: string }>(db, `SELECT id FROM activity_events WHERE kind = 'workflow.note' AND title = 'VIP paid Deposit'`);
    expect(notes.length).toBe(1);
  });
});

describe("client-message outbox via the built-in welcome automation", () => {
  // A client with no email → the welcome drafts to the PORTAL channel, whose
  // send path shares the same status/timeline code as email but doesn't touch
  // the Workers-only `cloudflare:email` module — so it runs under Node.
  it("drafts a welcome message (written fallback, no AI) and publishes it to the portal", async () => {
    await run(db, `INSERT INTO clients (id, name) VALUES ('cl_welcome', 'Nadia Rahmani')`);
    await emit(
      db,
      { kind: "client.created", entityType: "client", entityId: "cl_welcome", title: "New client", payload: { clientId: "cl_welcome", name: "Nadia Rahmani" } },
      { env, ctx },
    );
    await flush();
    const draft = await first<{ id: string; status: string; channel: string; body_md: string }>(
      db,
      `SELECT id, status, channel, body_md FROM client_messages WHERE client_id = 'cl_welcome' AND trigger = 'client-created-welcome'`,
    );
    expect(draft).toBeTruthy();
    expect(draft!.status).toBe("draft");
    expect(draft!.channel).toBe("portal"); // no email on file → portal
    expect(draft!.body_md).toContain("Nadia"); // personalised by first name

    // Approve → publish to the portal, and write to the client's timeline.
    const result = await sendClientMessage(env, db, draft!.id);
    expect(result.ok).toBe(true);
    const sent = await first<{ status: string; sent_at: string | null }>(db, `SELECT status, sent_at FROM client_messages WHERE id = ?`, draft!.id);
    expect(sent!.status).toBe("sent");
    expect(sent!.sent_at).toBeTruthy();
    const timeline = await first<{ id: string }>(db, `SELECT id FROM client_events WHERE client_id = 'cl_welcome' AND subject LIKE 'Posted to portal:%'`);
    expect(timeline).toBeTruthy();
  });
});

describe("inbound webhook → workflow chaining", () => {
  it("a workflow can react to an inbound.received event", async () => {
    await run(
      db,
      `INSERT INTO workflows (id, name, trigger_event, conditions_json, actions_json, enabled)
       VALUES ('wf_inbound', 'Inbound notes → task', 'inbound.received', ?, ?, 1)`,
      JSON.stringify([{ field: "inboundType", op: "equals", value: "note" }]),
      JSON.stringify([{ type: "create_task", params: { title: "Follow up on: {subject}" } }]),
    );
    await emit(
      db,
      { kind: "inbound.received", entityType: "webhook", entityId: "note", title: "Inbound note", payload: { inboundType: "note", subject: "New enquiry from the site" } },
      { env, ctx },
    );
    await flush();
    const task = await first<{ id: string }>(db, `SELECT id FROM production_tasks WHERE title = 'Follow up on: New enquiry from the site'`);
    expect(task).toBeTruthy();
  });
});

describe("developer API — personal access tokens", () => {
  it("mints a hashed key, verifies a valid token, and rejects tampered/revoked/expired", async () => {
    const minted = await mintApiKey(db, "teststudio", { label: "Zapier" });
    expect(minted.token.startsWith("vrto_teststudio_")).toBe(true);
    expect(minted.prefix).toBe(`vrto_teststudio_${minted.id}`);
    // The plaintext secret is NOT stored — only its hash.
    const row = await first<{ token_hash: string }>(db, `SELECT token_hash FROM api_keys WHERE id = ?`, minted.id);
    expect(row!.token_hash).not.toContain(minted.token.split(".")[1]);

    const ok = await verifyApiKey(env, minted.token);
    expect(ok?.shopSlug).toBe("teststudio");
    expect(ok?.keyId).toBe(minted.id);

    // Tampered secret → rejected.
    expect(await verifyApiKey(env, minted.token.slice(0, -3) + "xyz")).toBeNull();
    // Unknown shop slug → rejected.
    expect(await verifyApiKey(env, `vrto_nope_${minted.id}.whatever`)).toBeNull();

    // Revoked → rejected.
    await revokeApiKey(db, minted.id);
    expect(await verifyApiKey(env, minted.token)).toBeNull();

    // Expired → rejected.
    const past = await mintApiKey(db, "teststudio", { label: "old", expiresAt: "2000-01-01 00:00:00" });
    expect(await verifyApiKey(env, past.token)).toBeNull();
  });
});

describe("webhook fan-out to external subscribers", () => {
  let server: Server;
  let received: { headers: Record<string, string | string[] | undefined>; body: string } | null = null;
  let url = "";

  beforeAll(async () => {
    server = createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        received = { headers: req.headers, body };
        res.writeHead(200);
        res.end("ok");
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const addr = server.address();
    url = typeof addr === "object" && addr ? `http://127.0.0.1:${addr.port}/hook` : "";
  });
  afterAll(() => server?.close());

  it("delivers a signed POST to a registered subscription when its event fires", async () => {
    // A neutral event kind (nothing reacts to it) — keeps the test off the
    // marketing-automation code path, which transitively imports the
    // Workers-only `cloudflare:email` module. The fan-out matches by kind
    // regardless, so this exercises the delivery path directly.
    await run(
      db,
      `INSERT INTO webhook_subscriptions (id, event, target_url, secret, source)
       VALUES ('whs_1', 'test.ping', ?, 'sub-secret', 'zapier')`,
      url,
    );
    await emit(
      db,
      { kind: "test.ping", entityType: "product", entityId: "p1", title: "Launched the Linen Shirt", payload: { productId: "p1", name: "Linen Shirt" } },
      { env, ctx },
    );
    await flush();
    // Give the http server a tick to record the request.
    await new Promise((r) => setTimeout(r, 50));
    expect(received).toBeTruthy();
    expect(received!.headers["x-verto-event"]).toBe("test.ping");
    expect(String(received!.headers["x-verto-signature"])).toMatch(/^sha256=[0-9a-f]{64}$/);
    const parsed = JSON.parse(received!.body);
    expect(parsed.event).toBe("test.ping");
    expect(parsed.payload.name).toBe("Linen Shirt");
  });
});

describe("AI usage ledger", () => {
  it("estimates cost from the price table (tokens and units)", () => {
    // Opus: $15/M in, $75/M out → 1M in + 1M out = $90 = 9000 cents.
    expect(estimateCostCents({ provider: "anthropic", model: "claude-opus-4-8", tokensIn: 1_000_000, tokensOut: 1_000_000 })).toBeCloseTo(9000, 2);
    // Workers AI (Llama/Flux) is per-neuron → treated as $0 here.
    expect(estimateCostCents({ provider: "workers-ai", model: "@cf/meta/llama-4-scout", tokensIn: 5_000_000, tokensOut: 5_000_000 })).toBe(0);
    expect(estimateCostCents({ provider: "workers-ai", model: "@cf/black-forest-labs/flux-1-schnell", units: 3 })).toBe(0);
    // External try-on model at $0.075/unit → 2 units = $0.15 = 15 cents.
    expect(estimateCostCents({ provider: "fashn", model: "fashn/tryon-v1.5", units: 2 })).toBeCloseTo(15, 2);
  });

  it("records rows to the platform ledger and aggregates by provider/model", async () => {
    await recordAiUsage(env, { shopId: "shop_rezene", provider: "anthropic", model: "claude-sonnet-5", operation: "marketing.kit", tokensIn: 1000, tokensOut: 500 });
    await recordAiUsage(env, { shopId: "shop_rezene", provider: "anthropic", model: "claude-sonnet-5", operation: "marketing.kit", tokensIn: 2000, tokensOut: 800 });
    await recordAiUsage(env, { shopId: null, provider: "perplexity", model: "sonar-pro", operation: "research.ask", tokensIn: 4000, tokensOut: 1200 });

    const byModel = await all<{ provider: string; model: string; calls: number; tokensIn: number; costCents: number }>(
      db,
      `SELECT provider, model, COUNT(*) AS calls, COALESCE(SUM(tokens_in),0) AS tokensIn, COALESCE(SUM(cost_cents),0) AS costCents
         FROM ai_usage GROUP BY provider, model ORDER BY calls DESC`,
    );
    const sonnet = byModel.find((r) => r.model === "claude-sonnet-5");
    expect(sonnet?.calls).toBe(2);
    expect(sonnet?.tokensIn).toBe(3000);
    // 3000 in @ $3/M + 1300 out @ $15/M = $0.009 + $0.0195 = $0.0285 = 2.85 cents.
    expect(sonnet?.costCents).toBeCloseTo(2.85, 2);

    const perplexity = byModel.find((r) => r.model === "sonar-pro");
    expect(perplexity?.calls).toBe(1);

    // NULL shop_id attributes to the platform, non-null to the shop.
    const byShop = await all<{ shopId: string | null; calls: number }>(
      db,
      `SELECT shop_id AS shopId, COUNT(*) AS calls FROM ai_usage GROUP BY shop_id`,
    );
    expect(byShop.find((r) => r.shopId === "shop_rezene")?.calls).toBe(2);
    expect(byShop.find((r) => r.shopId === null)?.calls).toBe(1);
  });
});

describe("fleet revenue rollup", () => {
  // The test DB doubles as the primary shop's DO (getShopDb(primary) → bound D1),
  // so seeding orders/refunds/customers here is exactly what the rollup reads.
  const today = new Date().toISOString().slice(0, 10);
  const ts = `${today} 12:00:00`;

  beforeAll(async () => {
    await run(db, `INSERT INTO customers (id, email, name, created_at) VALUES ('cust_r1', 'a@example.com', 'A', ?)`, ts);
    await run(
      db,
      `INSERT INTO orders (id, order_number, customer_id, currency, subtotal_cents, total_cents, payment_status, created_at)
       VALUES ('ord_r1', 'RZ-1', 'cust_r1', 'USD', 5000, 5000, 'paid', ?)`,
      ts,
    );
    await run(
      db,
      `INSERT INTO orders (id, order_number, currency, total_cents, payment_status, created_at)
       VALUES ('ord_r2', 'RZ-2', 'USD', 3000, 'paid', ?)`,
      ts,
    );
    // An unpaid order must NOT count toward GMV.
    await run(
      db,
      `INSERT INTO orders (id, order_number, currency, total_cents, payment_status, created_at)
       VALUES ('ord_r3', 'RZ-3', 'USD', 9999, 'pending', ?)`,
      ts,
    );
    await run(
      db,
      `INSERT INTO refunds (id, order_id, amount_cents, currency, status, created_at)
       VALUES ('ref_r1', 'ord_r1', 1000, 'USD', 'succeeded', ?)`,
      ts,
    );
  });

  it("aggregates one shop's day from its own DO (paid only)", async () => {
    const m = await computeShopDay(env, "shop_rezene", today);
    expect(m).toBeTruthy();
    expect(m!.gmvCents).toBe(8000); // 5000 + 3000, pending excluded
    expect(m!.orders).toBe(2);
    expect(m!.refundsCents).toBe(1000);
    expect(m!.newCustomers).toBe(1);
    expect(m!.currency).toBe("USD");
  });

  it("rolls the fleet up into the platform shop_metrics_daily table", async () => {
    const written = await rollupFleetMetrics(env, { days: [today] });
    expect(written).toBeGreaterThanOrEqual(1);
    const row = await first<{ gmv: number; orders: number; refunds: number; customers: number }>(
      db,
      `SELECT gmv_cents AS gmv, orders, refunds_cents AS refunds, new_customers AS customers
         FROM shop_metrics_daily WHERE shop_id='shop_rezene' AND day=?`,
      today,
    );
    expect(row?.gmv).toBe(8000);
    expect(row?.orders).toBe(2);
    expect(row?.refunds).toBe(1000);
    expect(row?.customers).toBe(1);

    // Idempotent: a second rollup overwrites, not doubles.
    await rollupFleetMetrics(env, { days: [today] });
    const again = await first<{ gmv: number }>(
      db,
      `SELECT gmv_cents AS gmv FROM shop_metrics_daily WHERE shop_id='shop_rezene' AND day=?`,
      today,
    );
    expect(again?.gmv).toBe(8000);
  });
});

describe("platform error/incident log", () => {
  it("normalizes id-ish path segments so instances group", () => {
    expect(normalizePath("/api/admin/products/ord_r1/items")).toBe("/api/admin/products/:id/items");
    expect(normalizePath("/api/admin/shops")).toBe("/api/admin/shops");
  });

  it("dedupes by signature (count rises) and re-opens on recurrence", async () => {
    const e = { method: "POST", path: "/api/admin/products/ord_9", status: 500, message: "TypeError: boom" };
    await recordPlatformError(env, { ...e, shopId: "shop_rezene" });
    await recordPlatformError(env, { ...e, shopId: "shop_rezene" });
    const row = await first<{ id: number; count: number; path: string; resolvedAt: string | null }>(
      db,
      `SELECT id, count, path, resolved_at AS resolvedAt FROM platform_errors WHERE message = 'TypeError: boom'`,
    );
    expect(row?.count).toBe(2); // two hits, one row
    expect(row?.path).toBe("/api/admin/products/:id"); // normalized

    // Resolve it, then a recurrence must re-open it.
    await run(db, `UPDATE platform_errors SET resolved_at = datetime('now') WHERE id = ?`, row!.id);
    await recordPlatformError(env, { ...e, shopId: "shop_rezene" });
    const after = await first<{ count: number; resolvedAt: string | null }>(
      db,
      `SELECT count, resolved_at AS resolvedAt FROM platform_errors WHERE id = ?`,
      row!.id,
    );
    expect(after?.count).toBe(3);
    expect(after?.resolvedAt).toBeNull(); // re-opened
  });
});

describe("fleet activity pulse", () => {
  it("merges notable events across shops, newest first, and drops noise", async () => {
    // The test DB is the primary shop's DO, so events here are the shop's spine.
    await run(
      db,
      `INSERT INTO activity_events (id, kind, entity_type, entity_id, title, created_at)
       VALUES ('act_f1', 'product.published', 'product', 'p1', 'Published the Linen Shirt', '2026-07-14 09:00:00')`,
    );
    await run(
      db,
      `INSERT INTO activity_events (id, kind, entity_type, entity_id, title, created_at)
       VALUES ('act_f2', 'order.paid', 'order', 'o1', 'New order — $80', '2026-07-14 10:00:00')`,
    );
    // A non-notable kind must be filtered out of the pulse.
    await run(
      db,
      `INSERT INTO activity_events (id, kind, entity_type, entity_id, title, created_at)
       VALUES ('act_f3', 'settings.updated', 'settings', 's1', 'Changed a setting', '2026-07-14 11:00:00')`,
    );

    const { items, shopsScanned } = await fleetActivity(env, { limit: 50 });
    expect(shopsScanned).toBeGreaterThanOrEqual(1);
    const kinds = items.map((i) => i.kind);
    expect(kinds).toContain("product.published");
    expect(kinds).toContain("order.paid");
    expect(kinds).not.toContain("settings.updated"); // noise filtered
    // Newest first: the paid order (10:00) precedes the publish (09:00).
    const paidIdx = items.findIndex((i) => i.kind === "order.paid");
    const pubIdx = items.findIndex((i) => i.kind === "product.published");
    expect(paidIdx).toBeLessThan(pubIdx);
    // Tagged with the shop it came from.
    expect(items[paidIdx].shopId).toBe("shop_rezene");
    expect(items[paidIdx].shopName).toBe("Test Studio");
  });
});

describe("lookbook composition", () => {
  beforeAll(async () => {
    // Two published, sellable pieces — one with a photo, one without; plus a
    // draft that must NOT appear in a lookbook.
    await run(db, `INSERT INTO products (id, slug, name, gender, category, base_price_cents, currency, availability, is_published, sort_order, editorial_story, fabric_composition)
                   VALUES ('prod_a','linen-shirt','Linen Shirt','unisex','tops', 12000, 'USD','available',1,1,'Woven in Portugal.','100% linen')`);
    await run(db, `INSERT INTO products (id, slug, name, gender, category, base_price_cents, currency, availability, is_published, sort_order)
                   VALUES ('prod_b','wool-coat','Wool Coat','womens','outerwear', 48000, 'USD','available',1,2)`);
    await run(db, `INSERT INTO products (id, slug, name, gender, category, base_price_cents, currency, availability, is_published, sort_order)
                   VALUES ('prod_draft','secret','Secret Piece','unisex','tops', 9000, 'USD','draft',0,3)`);
    await run(db, `INSERT INTO product_images (id, product_id, url, alt_text, sort_order) VALUES ('img_a','prod_a','/media/a.jpg','Linen shirt front',0)`);
    await run(db, `INSERT INTO product_images (id, product_id, url, alt_text, sort_order) VALUES ('img_b','prod_b','/media/b.jpg','Wool coat',0)`);
  });

  it("lists only published + sellable products, with the lead image", async () => {
    const products = await availableProducts(db);
    const ids = products.map((p) => p.id);
    expect(ids).toContain("prod_a");
    expect(ids).toContain("prod_b");
    expect(ids).not.toContain("prod_draft"); // draft excluded
    const a = products.find((p) => p.id === "prod_a");
    expect(a?.imageUrl).toBe("/media/a.jpg");
    expect(a?.editorialStory).toBe("Woven in Portugal.");
  });

  it("auto-composes a spec from the catalogue and resolves live product data", async () => {
    const created = await createLookbook(db, { title: "Autumn 2026" });
    expect(created.spec.spreads.length).toBeGreaterThanOrEqual(2);
    // The piece with a photo leads, on a hero layout.
    expect(created.spec.spreads[0].productId).toBe("prod_a");
    expect(created.spec.spreads[0].layout).toBe("hero");

    const model = await resolveRenderModel(db, created.id);
    expect(model).toBeTruthy();
    expect(model!.spreads[0].product.name).toBe("Linen Shirt");
    expect(model!.spreads[0].product.priceCents).toBe(12000);
    expect(model!.catalog.length).toBeGreaterThanOrEqual(2);

    // Reorder + drop: point one spread at a non-existent product; it must be
    // silently dropped from the render (a lookbook never breaks on a dead ref).
    await updateLookbook(db, created.id, {
      spec: { spreads: [{ productId: "prod_b", layout: "clean" }, { productId: "gone", layout: "clean" }] },
    });
    const after = await resolveRenderModel(db, created.id);
    expect(after!.spreads.map((s) => s.product.id)).toEqual(["prod_b"]);
  });
});

/**
 * Wholesale channel, end to end — the whole lifecycle through the REAL
 * portal and admin routes (mounted with harness middleware standing in for
 * tenant + session resolution), with only Stripe's own hop faked: the
 * webhook lands as a crafted checkout.session.completed event driven through
 * the real handleStripeEvent dispatcher. What the live $1 smoke test covers
 * that this can't: Stripe actually creating a session and signing a webhook.
 */
describe("wholesale channel end to end (Stripe hop faked)", () => {
  const portal = new Hono<AppContext>();
  portal.use("*", async (c, next) => {
    c.set("db", db);
    c.set("shopId", "shop_rezene");
    c.set("shopSlug", "teststudio");
    await next();
  });
  portal.route("/", wholesalePortalRoutes);

  const admin = new Hono<AppContext>();
  admin.use("*", async (c, next) => {
    c.set("db", db);
    c.set("shopId", "shop_rezene");
    c.set("shopSlug", "teststudio");
    c.set("userId", "usr_wstest");
    c.set("userEmail", "owner@teststudio.test");
    c.set("roles", ["admin"]);
    await next();
  });
  admin.route("/", adminWholesaleRoutes);

  const json = (body: unknown, cookie?: string): RequestInit => ({
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
  const COOKIE = "verto_wholesale=ws-e2e-token";
  const BUYER = "buyer@boutique.test";

  let accountId: string;
  let sheetId: string;
  let p1 = "";
  let p2 = "";
  let orderId: string;
  let fulfillmentOrderId: string;

  it("buyer applies, shop approves with discount + net terms", async () => {
    // The harness admin user must exist — audit_logs carries an FK to users.
    await run(db, `INSERT OR IGNORE INTO users (id, email) VALUES ('usr_wstest', 'owner@teststudio.test')`);
    const res = await portal.request("/apply", json({ email: BUYER, company: "Test Boutique", contactName: "Bo Yer" }), env);
    expect(res.status).toBe(200);
    const acct = await first<{ id: string; status: string }>(
      db, `SELECT id, status FROM wholesale_accounts WHERE email = ?`, BUYER);
    expect(acct?.status).toBe("pending");
    accountId = acct!.id;

    const ok = await admin.request(`/accounts/${accountId}/approve`, json({ discountPct: 10, termsDays: 30 }), env);
    expect(ok.status).toBe(200);
    const approved = await first<{ status: string; discount_pct: number; terms_days: number }>(
      db, `SELECT status, discount_pct, terms_days FROM wholesale_accounts WHERE id = ?`, accountId);
    expect(approved).toMatchObject({ status: "approved", discount_pct: 10, terms_days: 30 });
  });

  it("shop builds a line sheet with volume tiers and a per-buyer override", async () => {
    p1 = newId("prod");
    p2 = newId("prod");
    for (const [id, slug, name] of [[p1, "ws-coat", "Atlas Coat"], [p2, "ws-shirt", "Rif Shirt"]] as const) {
      await run(
        db,
        `INSERT INTO products (id, slug, name, gender, category, base_price_cents, availability, is_published)
         VALUES (?, ?, ?, 'unisex', 'outerwear', 20000, 'available', 1)`,
        id, slug, name);
    }
    const created = await admin.request("/line-sheets", json({ title: "AW Trade", productIds: [p1, p2] }), env);
    expect(created.status).toBe(201);
    sheetId = ((await created.json()) as { id: string }).id;

    const detail = (await (await admin.request(`/line-sheets/${sheetId}`, undefined, env)).json()) as {
      items: { id: string; product_id: string }[];
    };
    const item1 = detail.items.find((i) => i.product_id === p1)!;
    // $10 base from qty 2, $8 from a dozen.
    const patched = await admin.request(`/line-sheets/items/${item1.id}`, {
      ...json({ wholesalePriceCents: 1000, minQty: 2, priceTiers: [{ minQty: 12, priceCents: 800 }] }),
      method: "PATCH",
    }, env);
    expect(patched.status).toBe(200);
    // The negotiated price list: Rif Shirt at $42 flat for this buyer.
    const override = await admin.request(`/accounts/${accountId}/overrides`, {
      ...json({ productId: p2, unitPriceCents: 4200 }),
      method: "PUT",
    }, env);
    expect(override.status).toBe(200);
  });

  it("the portal prices with discount, tiers, and the override", async () => {
    await run(
      db,
      `INSERT INTO wholesale_sessions (id, account_id, token_hash, expires_at)
       VALUES (?, ?, ?, datetime('now', '+1 day'))`,
      newId("wsess"), accountId, await sha256Hex("ws-e2e-token"));

    const res = await portal.request(`/line-sheets/${sheetId}`, { headers: { cookie: COOKIE } }, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      items: { productId: string; priceCents: number; customPrice: boolean; tiers: { minQty: number; priceCents: number }[] }[];
    };
    const coat = body.items.find((i) => i.productId === p1)!;
    const shirt = body.items.find((i) => i.productId === p2)!;
    expect(coat.priceCents).toBe(900); // $10 − 10% trade discount
    expect(coat.customPrice).toBe(false);
    expect(coat.tiers).toEqual([{ minQty: 12, priceCents: 720 }]); // $8 tier − 10%
    expect(shirt.priceCents).toBe(4200); // absolute override; discount ignored
    expect(shirt.customPrice).toBe(true);
    expect(shirt.tiers).toEqual([]);
  });

  it("enforces minimums, then places the order at tier + override pricing with a ship-to", async () => {
    const tooFew = await portal.request("/orders", json({ lineSheetId: sheetId, items: [{ productId: p1, quantity: 1 }] }, COOKIE), env);
    expect(tooFew.status).toBe(400);
    expect(((await tooFew.json()) as { error: string }).error).toContain("minimum of 2");

    const placed = await portal.request("/orders", json({
      lineSheetId: sheetId,
      items: [
        { productId: p1, quantity: 12 }, // hits the tier: 12 × 720
        { productId: p2, quantity: 3 },  // override: 3 × 4200
      ],
      shipTo: { name: "Test Boutique", line1: "1 Rue du Stock", city: "Casablanca", postalCode: "20000", country: "ma" },
    }, COOKIE), env);
    expect(placed.status).toBe(201);

    const order = await first<{ id: string; total_cents: number; shipping_country: string; shipping_address_json: string }>(
      db, `SELECT id, total_cents, shipping_country, shipping_address_json FROM wholesale_orders WHERE account_id = ? ORDER BY created_at DESC`, accountId);
    orderId = order!.id;
    expect(order!.total_cents).toBe(12 * 720 + 3 * 4200);
    expect(order!.shipping_country).toBe("MA");
    expect(JSON.parse(order!.shipping_address_json).address.line1).toBe("1 Rue du Stock");
    const units = await all<{ unit_price_cents: number }>(
      db, `SELECT unit_price_cents FROM wholesale_order_items WHERE order_id = ? ORDER BY unit_price_cents`, orderId);
    expect(units.map((u) => u.unit_price_cents)).toEqual([720, 4200]);
  });

  it("confirming materialises a fulfilment order in the retail pipeline", async () => {
    const res = await admin.request(`/orders/${orderId}/status`, json({ status: "confirmed" }), env);
    expect(res.status).toBe(200);
    const wo = await first<{ fulfillment_order_id: string | null; order_number: string }>(
      db, `SELECT fulfillment_order_id, order_number FROM wholesale_orders WHERE id = ?`, orderId);
    expect(wo?.fulfillment_order_id).toBeTruthy();
    fulfillmentOrderId = wo!.fulfillment_order_id!;

    const ord = await first<{ order_number: string; email: string; total_cents: number; payment_status: string; fulfillment_status: string; shipping_country: string }>(
      db, `SELECT order_number, email, total_cents, payment_status, fulfillment_status, shipping_country FROM orders WHERE id = ?`, fulfillmentOrderId);
    expect(ord).toMatchObject({
      order_number: wo!.order_number,
      email: BUYER,
      total_cents: 12 * 720 + 3 * 4200,
      payment_status: "pending",
      fulfillment_status: "unfulfilled",
      shipping_country: "MA",
    });
    const lines = await all<{ description: string }>(db, `SELECT description FROM order_items WHERE order_id = ?`, fulfillmentOrderId);
    expect(lines.length).toBe(2);
    expect(lines.every((l) => l.description.includes("Wholesale"))).toBe(true);

    // Re-confirming must not duplicate the fulfilment order.
    await admin.request(`/orders/${orderId}/status`, json({ status: "confirmed" }), env);
    const again = await first<{ fulfillment_order_id: string }>(db, `SELECT fulfillment_order_id FROM wholesale_orders WHERE id = ?`, orderId);
    expect(again!.fulfillment_order_id).toBe(fulfillmentOrderId);
  });

  it("invoicing stamps the due date from the buyer's net terms", async () => {
    const before = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
    const res = await admin.request(`/orders/${orderId}/status`, json({ status: "invoiced" }), env);
    const after = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
    expect(res.status).toBe(200);
    const wo = await first<{ status: string; due_date: string }>(db, `SELECT status, due_date FROM wholesale_orders WHERE id = ?`, orderId);
    expect(wo?.status).toBe("invoiced");
    expect([before, after]).toContain(wo?.due_date);
  });

  it("payment guards: degrades without Stripe, rejects a not-ready order with it", async () => {
    const noStripe = await createInvoiceCheckout(env, db, { orderId, shopId: "shop_rezene", baseUrl: "http://test" });
    expect("error" in noStripe && noStripe.error).toContain("isn't set up");

    // A fresh, still-submitted order is not payable even with Stripe configured
    // (the guard fires before any network call, so a fake key is safe here).
    const stripeEnv = { ...(env as object), STRIPE_SECRET_KEY: "sk_test_fake" } as unknown as Env;
    const placed = await portal.request("/orders", json({ lineSheetId: sheetId, items: [{ productId: p1, quantity: 2 }] }, COOKIE), env);
    expect(placed.status).toBe(201);
    const submitted = await first<{ id: string }>(
      db, `SELECT id FROM wholesale_orders WHERE account_id = ? AND status = 'submitted' ORDER BY created_at DESC`, accountId);
    const notReady = await portal.request(`/orders/${submitted!.id}/pay`, json({}, COOKIE), stripeEnv);
    expect(notReady.status).toBe(400);
    expect(((await notReady.json()) as { error: string }).error).toContain("isn't ready");
  });

  it("the faked Stripe webhook marks the order paid and syncs fulfilment — idempotently", async () => {
    const event = {
      id: "evt_ws_e2e_1",
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: { kind: "wholesale_invoice", shop_id: "shop_rezene", wholesale_order_id: orderId },
          payment_intent: "pi_ws_e2e_1",
        },
      },
    } as unknown as Stripe.Event;
    const res = await handleStripeEvent(env, null as unknown as Stripe, event, (p) => void deferred.push(p));
    await flush();
    expect(res.received).toBe(true);

    const wo = await first<{ status: string; paid_at: string | null; stripe_payment_intent_id: string | null }>(
      db, `SELECT status, paid_at, stripe_payment_intent_id FROM wholesale_orders WHERE id = ?`, orderId);
    expect(wo).toMatchObject({ status: "paid", stripe_payment_intent_id: "pi_ws_e2e_1" });
    expect(wo?.paid_at).toBeTruthy();
    const ord = await first<{ payment_status: string }>(db, `SELECT payment_status FROM orders WHERE id = ?`, fulfillmentOrderId);
    expect(ord?.payment_status).toBe("paid");

    // Stripe retries: the same event id is swallowed by the receipt table…
    const replay = await handleStripeEvent(env, null as unknown as Stripe, event, (p) => void deferred.push(p));
    expect(replay.duplicate).toBe(true);
    // …and even a NEW event for an already-paid order no-ops instead of double-applying.
    const paidAt = wo!.paid_at;
    await handleStripeEvent(env, null as unknown as Stripe, { ...event, id: "evt_ws_e2e_2" } as unknown as Stripe.Event, (p) => void deferred.push(p));
    await flush();
    const after = await first<{ paid_at: string | null; stripe_payment_intent_id: string | null }>(
      db, `SELECT paid_at, stripe_payment_intent_id FROM wholesale_orders WHERE id = ?`, orderId);
    expect(after).toMatchObject({ paid_at: paidAt, stripe_payment_intent_id: "pi_ws_e2e_1" });

    // And a paid order can't be paid again from the portal.
    const stripeEnv = { ...(env as object), STRIPE_SECRET_KEY: "sk_test_fake" } as unknown as Env;
    const payAgain = await portal.request(`/orders/${orderId}/pay`, json({}, COOKIE), stripeEnv);
    expect(payAgain.status).toBe(400);
    expect(((await payAgain.json()) as { error: string }).error).toContain("already paid");
  });
});
