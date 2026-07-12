import { all, run } from "./db";
import { newId } from "../utils/id";
import {
  triggerByEvent,
  actionByType,
  type WorkflowCondition,
  type WorkflowAction,
  type ConditionOp,
} from "../../shared/workflows";
import type { ActivityEvent, EmitOpts } from "./activity";

/**
 * The no-code Workflow Builder's runtime. After the built-in automations run,
 * `emit()` calls `runWorkflows` with the same event; we load the shop's
 * enabled workflows for that trigger, check their conditions against the
 * event payload, and run their actions. Everything here is create-only and
 * defensively wrapped — a workflow failure must never break the write that
 * triggered it, and never throws back into emit().
 *
 * Actions that reach the network (drafting a client message, posting a
 * webhook) run off the request path via ctx.waitUntil when env/ctx were
 * passed; when they weren't, or the trigger carries no client, they're
 * recorded as 'skipped' rather than run.
 */

type DB = D1Database;

interface WorkflowRow {
  id: string;
  name: string;
  trigger_event: string;
  conditions_json: string;
  actions_json: string;
}

function parseJson<T>(s: string, fallback: T): T {
  try {
    const v = JSON.parse(s);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

function matchCondition(payloadValue: unknown, op: ConditionOp, target: string): boolean {
  const left = payloadValue == null ? "" : String(payloadValue);
  switch (op) {
    case "equals":
      return left.toLowerCase() === target.trim().toLowerCase();
    case "not_equals":
      return left.toLowerCase() !== target.trim().toLowerCase();
    case "contains":
      return left.toLowerCase().includes(target.trim().toLowerCase());
    case "gt":
      return Number(left) > Number(target);
    case "lt":
      return Number(left) < Number(target);
    default:
      return false;
  }
}

/** Interpolate {field} tokens in an action string from the event payload. */
function fill(template: string, payload: Record<string, unknown>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const v = payload[key];
    return v == null ? "" : String(v);
  });
}

const daysFromNow = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

async function record(db: DB, workflowId: string, eventKind: string, status: "ok" | "skipped" | "error", detail: string) {
  await run(
    db,
    `INSERT INTO workflow_runs (id, workflow_id, event_kind, status, detail) VALUES (?, ?, ?, ?, ?)`,
    newId("wfr"),
    workflowId,
    eventKind,
    status,
    detail.slice(0, 300),
  ).catch(() => {});
  await run(
    db,
    `UPDATE workflows SET run_count = run_count + 1, last_run_at = datetime('now') WHERE id = ?`,
    workflowId,
  ).catch(() => {});
}

async function runAction(
  db: DB,
  ev: ActivityEvent,
  payload: Record<string, unknown>,
  action: WorkflowAction,
  opts: EmitOpts | undefined,
): Promise<string> {
  const def = actionByType(action.type);
  if (!def) return "unknown action";
  const clientId = payload.clientId ? String(payload.clientId) : null;
  const commissionId = payload.commissionId ? String(payload.commissionId) : ev.entityType === "commission" ? ev.entityId : null;

  switch (action.type) {
    case "create_task": {
      const title = fill(action.params.title ?? "", payload).trim() || "Workflow task";
      const days = Number(action.params.dueInDays);
      const due = Number.isFinite(days) ? daysFromNow(Math.min(365, Math.max(0, Math.round(days)))) : null;
      await run(
        db,
        `INSERT INTO production_tasks (id, title, status, due_date, notes)
         VALUES (?, ?, 'todo', ?, ?)`,
        newId("task"),
        title.slice(0, 200),
        due,
        "Filed automatically by one of your workflows.",
      );
      return `task: ${title.slice(0, 60)}`;
    }
    case "activity_note": {
      const title = fill(action.params.title ?? "", payload).trim() || "Workflow note";
      await run(
        db,
        `INSERT INTO activity_events (id, kind, entity_type, entity_id, title, payload)
         VALUES (?, 'workflow.note', ?, ?, ?, ?)`,
        newId("act"),
        ev.entityType,
        ev.entityId,
        title.slice(0, 240),
        JSON.stringify({ from: "workflow" }),
      );
      return `note: ${title.slice(0, 60)}`;
    }
    case "timeline_note": {
      if (!clientId) return "skipped — no client on this event";
      const subject = fill(action.params.subject ?? "", payload).trim() || "Note";
      await run(
        db,
        `INSERT INTO client_events (id, client_id, commission_id, kind, subject, event_at)
         VALUES (?, ?, ?, 'note', ?, datetime('now'))`,
        newId("cev"),
        clientId,
        commissionId,
        subject.slice(0, 200),
      );
      return `timeline note for client`;
    }
    case "draft_client_message": {
      if (!clientId) return "skipped — no client on this event";
      if (!opts?.env || !opts?.ctx) return "skipped — needs the request context";
      const env = opts.env;
      const situation = fill(action.params.situation ?? "", payload).trim() || "A note to the client.";
      opts.ctx.waitUntil(
        import("./client-messages").then(({ draftClientMessage }) =>
          draftClientMessage(env, db, {
            clientId,
            commissionId,
            trigger: "manual",
            situation,
          }),
        ),
      );
      return "drafting client message";
    }
    case "webhook": {
      const url = (action.params.url ?? "").trim();
      if (!/^https:\/\//i.test(url)) return "skipped — needs an https URL";
      if (!opts?.ctx) return "skipped — needs the request context";
      const body = JSON.stringify({ event: ev.kind, title: ev.title, payload, at: new Date().toISOString() });
      opts.ctx.waitUntil(
        fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body })
          .then(() => undefined)
          .catch((err) => {
            console.log("workflow webhook failed", String(err).slice(0, 120));
          }),
      );
      return `webhook → ${url.slice(0, 40)}`;
    }
    default:
      return "unknown action";
  }
}

export async function runWorkflows(db: DB, ev: ActivityEvent, opts?: EmitOpts): Promise<void> {
  let rows: WorkflowRow[];
  try {
    rows = await all<WorkflowRow>(
      db,
      `SELECT id, name, trigger_event, conditions_json, actions_json
       FROM workflows WHERE trigger_event = ? AND enabled = 1`,
      ev.kind,
    );
  } catch {
    // Table not provisioned on this shop DB yet — nothing to run.
    return;
  }
  if (!rows.length) return;

  const payload = (ev.payload ?? {}) as Record<string, unknown>;
  const trigger = triggerByEvent(ev.kind);

  for (const wf of rows) {
    try {
      const conditions = parseJson<WorkflowCondition[]>(wf.conditions_json, []);
      const passes = conditions.every((c) => {
        // Only known fields for this trigger are honoured.
        if (trigger && !trigger.fields.some((f) => f.key === c.field)) return true;
        return matchCondition(payload[c.field], c.op, c.value);
      });
      if (!passes) {
        await record(db, wf.id, ev.kind, "skipped", "conditions not met");
        continue;
      }
      const actions = parseJson<WorkflowAction[]>(wf.actions_json, []);
      const results: string[] = [];
      for (const action of actions) {
        try {
          results.push(await runAction(db, ev, payload, action, opts));
        } catch (err) {
          results.push(`error: ${String(err).slice(0, 80)}`);
        }
      }
      await record(db, wf.id, ev.kind, "ok", results.join("; ") || "no actions");
    } catch (err) {
      await record(db, wf.id, ev.kind, "error", String(err).slice(0, 200));
    }
  }
}
