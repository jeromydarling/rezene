import { all, first, run } from "./db";
import { newId } from "../utils/id";
import type { Env } from "../types/env";

/**
 * HQ lifecycle sequences (Phase B): automated, behavior-keyed email to Verto's
 * own customers, driven by data the platform already records — the shop
 * registry, activation events, and CRM lifecycle status. Sequences are code
 * (definitions below); the founder switches each on/off from Outreach. The
 * daily sweep advances every contact's state machine and queues due steps into
 * the same paced outbox broadcasts use, so suppression, pacing, compliance
 * headers, and CRM logging all apply automatically.
 *
 * Idempotency: hq_marketing_sequence_state records the last step SENT per
 * (sequence, contact); a step is queued at most once, ever. A global courtesy
 * cap skips anyone we've emailed in the last 3 days.
 */

export interface SequenceStep {
  /** Days after the previous step (or after becoming eligible, for step 1). */
  afterDays: number;
  subject: string;
  /** Markdown with {{name}} and {{shop}} placeholders. */
  bodyMd: string;
}

export interface SequenceDef {
  key: string;
  label: string;
  description: string;
  steps: SequenceStep[];
}

export const SEQUENCE_DEFS: SequenceDef[] = [
  {
    key: "welcome",
    label: "Welcome series",
    description: "New shop owners get a warm hello, then a getting-started nudge three days later.",
    steps: [
      {
        afterDays: 0,
        subject: "Welcome to Verto — here's the fastest path to open",
        bodyMd: `Hi {{name}},

Welcome — {{shop}} has a home now. Verto runs best when three things are in place: your brand basics, your first piece, and payments. The dashboard's **Get Selling Fast** guide walks each one in order.

If you get stuck anywhere, just reply to this email — a real person reads these.

Warmly,
Verto`,
      },
      {
        afterDays: 3,
        subject: "Three days in — anything in your way?",
        bodyMd: `Hi {{name}},

Just checking in on {{shop}}. Most designers find the first product is the hardest step — the [product guide](https://verto.style/admin/support/kb/products) covers photos, pricing, and sizes in about five minutes.

Reply if anything's unclear; happy to help directly.

— Verto`,
      },
    ],
  },
  {
    key: "stuck_product",
    label: "Stuck-shop nudge",
    description: "Shops a week old with no product yet get one gentle push toward the product guide.",
    steps: [
      {
        afterDays: 0,
        subject: "{{shop}} is set up — it just needs its first piece",
        bodyMd: `Hi {{name}},

{{shop}} has been open a week, and the storefront is ready the moment the first piece is in. The [product guide](https://verto.style/admin/support/kb/products) is the five-minute version: one photo, a price, a size run — done.

One piece is enough to go live. The rest can follow at your pace.

— Verto`,
      },
    ],
  },
  {
    key: "milestone_testimonial",
    label: "Testimonial ask",
    description: "Shops that reach their first sale get one proud note asking for a quote we can feature.",
    steps: [
      {
        afterDays: 0,
        subject: "Congratulations on the first sale at {{shop}}",
        bodyMd: `Hi {{name}},

A first sale is a real milestone — congratulations. {{shop}} is officially a working label.

A small ask: would you write a sentence or two about what running your label on Verto has been like? We feature designers' own words on the site (with your shop linked), and it means more than anything we could write ourselves. Just reply to this email — I read every one.

Warmly,
Verto`,
      },
    ],
  },
  {
    key: "winback",
    label: "Win-back",
    description: "Shops marked at-risk or churned get a single honest check-in.",
    steps: [
      {
        afterDays: 0,
        subject: "Still here when you're ready",
        bodyMd: `Hi {{name}},

It's been quiet at {{shop}} and we wanted to check in — no pitch, just a question: did something get in the way? If Verto is missing something you need, reply and tell us; the roadmap genuinely comes from these notes.

Your shop, products, and data are exactly where you left them.

— Verto`,
      },
    ],
  },
];

export async function sequenceSettings(env: Env): Promise<Record<string, boolean>> {
  const rows = await all<{ key: string; enabled: number }>(env.DB, `SELECT key, enabled FROM hq_marketing_sequences`);
  const map: Record<string, boolean> = {};
  for (const d of SEQUENCE_DEFS) map[d.key] = false;
  for (const r of rows) if (r.key in map) map[r.key] = Boolean(r.enabled);
  return map;
}

export async function setSequenceEnabled(env: Env, key: string, enabled: boolean): Promise<void> {
  if (!SEQUENCE_DEFS.some((d) => d.key === key)) throw new Error("unknown sequence");
  await run(
    env.DB,
    `INSERT INTO hq_marketing_sequences (key, enabled) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET enabled = excluded.enabled, updated_at = datetime('now')`,
    key,
    enabled ? 1 : 0,
  );
}

interface Candidate {
  contactId: string;
  email: string;
  name: string | null;
  shopName: string | null;
}

/** Contacts newly eligible for a sequence (no state row yet). */
async function eligible(env: Env, key: string): Promise<Candidate[]> {
  const base = `SELECT ct.id AS contactId, ct.email, ct.name, s.name AS shopName
      FROM crm_contacts ct LEFT JOIN shops s ON s.id = ct.shop_id
     WHERE ct.email NOT IN (SELECT email FROM hq_marketing_suppression)
       AND NOT EXISTS (SELECT 1 FROM hq_marketing_sequence_state st WHERE st.sequence_key = ? AND st.contact_id = ct.id)`;
  switch (key) {
    case "welcome":
      // Linked to a live shop created in the last 30 days (older shops would
      // find a "welcome" note odd) — demo/closed shops excluded.
      return all<Candidate>(
        env.DB,
        `${base} AND ct.shop_id IS NOT NULL AND s.status = 'active'
           AND s.created_at >= datetime('now','-30 days') AND s.slug != 'maison'`,
        key,
      );
    case "stuck_product":
      // A week old, still no 'product' activation event.
      return all<Candidate>(
        env.DB,
        `${base} AND ct.shop_id IS NOT NULL AND s.status = 'active' AND s.slug != 'maison'
           AND s.created_at <= datetime('now','-7 days')
           AND NOT EXISTS (SELECT 1 FROM activation_events ae WHERE ae.shop_id = ct.shop_id AND ae.event = 'product')`,
        key,
      );
    case "milestone_testimonial":
      // Crossed the 'share' milestone (shared / first sale) — the proudest
      // moment to ask, and the answer doubles as marketing-site social proof.
      return all<Candidate>(
        env.DB,
        `${base} AND ct.shop_id IS NOT NULL AND s.status = 'active' AND s.slug != 'maison'
           AND EXISTS (SELECT 1 FROM activation_events ae WHERE ae.shop_id = ct.shop_id AND ae.event = 'share')`,
        key,
      );
    case "winback":
      return all<Candidate>(env.DB, `${base} AND ct.status IN ('churn_risk','churned')`, key);
    default:
      return [];
  }
}

function fill(template: string, c: Candidate): string {
  const firstName = c.name?.trim().split(/\s+/)[0] || "there";
  return template.replaceAll("{{name}}", firstName).replaceAll("{{shop}}", c.shopName ?? "your shop");
}

/** Courtesy cap: skip anyone we've emailed (any stream) in the last 3 days. */
async function recentlyEmailed(env: Env, email: string): Promise<boolean> {
  const row = await first<{ n: number }>(
    env.DB,
    `SELECT COUNT(*) AS n FROM hq_marketing_sends
      WHERE email = ? AND status IN ('queued','sending','sent') AND created_at >= datetime('now','-3 days')`,
    email,
  );
  return (row?.n ?? 0) > 0;
}

async function queueStep(env: Env, def: SequenceDef, step: SequenceStep, c: Candidate): Promise<void> {
  await run(
    env.DB,
    `INSERT INTO hq_marketing_sends (id, sequence_key, email, contact_id, subject, body_md)
     VALUES (?, ?, ?, ?, ?, ?)`,
    newId("send"),
    def.key,
    c.email.toLowerCase(),
    c.contactId,
    fill(step.subject, c),
    fill(step.bodyMd, c),
  );
}

/**
 * The daily sweep: enter newly-eligible contacts at step 1, advance existing
 * ones whose next step is due, and close out finished sequences. Queued steps
 * ride the same paced outbox as broadcasts.
 */
export async function runMarketingSequences(env: Env): Promise<{ queued: number }> {
  const { marketingConfigured } = await import("./hq-marketing");
  if (!marketingConfigured(env)) return { queued: 0 };
  const enabled = await sequenceSettings(env);
  let queued = 0;

  for (const def of SEQUENCE_DEFS) {
    if (!enabled[def.key]) continue;

    // New entrants → step 1.
    for (const c of await eligible(env, def.key)) {
      if (await recentlyEmailed(env, c.email)) continue;
      await queueStep(env, def, def.steps[0], c);
      await run(
        env.DB,
        `INSERT INTO hq_marketing_sequence_state (sequence_key, contact_id, step, last_sent_at, completed_at)
         VALUES (?, ?, 1, datetime('now'), ?)`,
        def.key,
        c.contactId,
        def.steps.length === 1 ? new Date().toISOString() : null,
      );
      queued++;
    }

    // Existing entrants → next due step.
    for (let stepIdx = 1; stepIdx < def.steps.length; stepIdx++) {
      const step = def.steps[stepIdx];
      const due = await all<Candidate & { step: number }>(
        env.DB,
        `SELECT ct.id AS contactId, ct.email, ct.name, s.name AS shopName, st.step
           FROM hq_marketing_sequence_state st
           JOIN crm_contacts ct ON ct.id = st.contact_id
           LEFT JOIN shops s ON s.id = ct.shop_id
          WHERE st.sequence_key = ? AND st.step = ? AND st.completed_at IS NULL
            AND st.last_sent_at <= datetime('now', ?)
            AND ct.email NOT IN (SELECT email FROM hq_marketing_suppression)`,
        def.key,
        stepIdx,
        `-${step.afterDays} days`,
      );
      for (const c of due) {
        if (await recentlyEmailed(env, c.email)) continue;
        await queueStep(env, def, step, c);
        await run(
          env.DB,
          `UPDATE hq_marketing_sequence_state
              SET step = ?, last_sent_at = datetime('now'),
                  completed_at = CASE WHEN ? THEN datetime('now') ELSE NULL END
            WHERE sequence_key = ? AND contact_id = ?`,
          stepIdx + 1,
          stepIdx + 1 >= def.steps.length ? 1 : 0,
          def.key,
          c.contactId,
        );
        queued++;
      }
    }
  }
  if (queued) console.log(`[marketing] sequences queued ${queued} step(s)`);
  return { queued };
}
