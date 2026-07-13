import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Miniflare } from "miniflare";
import { createServer, type Server } from "node:http";
import { emit } from "./services/activity";
import { savePipeline, resolvePipeline } from "./services/pipeline";
import { sendClientMessage } from "./services/client-messages";
import { mintApiKey, verifyApiKey, revokeApiKey } from "./services/api-keys";
import { first, all, run } from "./services/db";
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
]);

beforeAll(async () => {
  mf = new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response('ok'); } }",
    d1Databases: { DB: "verto-test" },
  });
  db = (await mf.getD1Database("DB")) as unknown as D1Database;

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
    `CREATE TABLE IF NOT EXISTS shops (id TEXT PRIMARY KEY, slug TEXT, name TEXT, status TEXT, custom_domain TEXT)`,
  );
  await run(
    db,
    `INSERT INTO shops (id, slug, name, status) VALUES ('shop_rezene', 'teststudio', 'Test Studio', 'active')`,
  );

  env = { DB: db, BRAND_NAME: "Test Studio" } as unknown as Env;
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
