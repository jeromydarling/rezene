import { useMemo, useState } from "react";
import { PageHeader, EmptyState } from "../../components/admin/ui";
import { useFetch } from "../../lib/useFetch";
import { api } from "../../lib/api";
import { useToast } from "../../lib/toast";
import {
  WORKFLOW_TRIGGERS,
  WORKFLOW_ACTIONS,
  CONDITION_OPS,
  triggerByEvent,
  actionByType,
  type WorkflowCondition,
  type WorkflowAction,
  type ConditionOp,
} from "../../../shared/workflows";

interface Workflow {
  id: string;
  name: string;
  description: string | null;
  triggerEvent: string;
  triggerLabel: string;
  conditions: WorkflowCondition[];
  actions: WorkflowAction[];
  enabled: boolean;
  runCount: number;
  lastRunAt: string | null;
}

interface WorkflowRun {
  id: string;
  eventKind: string;
  status: string;
  detail: string | null;
  createdAt: string;
}

function Switch({ on, busy, onClick, label }: { on: boolean; busy: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "bg-navy" : "bg-ink/20"} ${busy ? "opacity-50" : ""}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

/** A plain-English sentence for a workflow — the "does what" at a glance. */
function sentence(w: { triggerEvent: string; conditions: WorkflowCondition[]; actions: WorkflowAction[] }): string {
  const t = triggerByEvent(w.triggerEvent);
  const trigger = t?.noun ?? w.triggerEvent;
  const conds = w.conditions
    .map((c) => {
      const field = t?.fields.find((f) => f.key === c.field)?.label ?? c.field;
      const op = CONDITION_OPS.find((o) => o.op === c.op)?.label ?? c.op;
      return `${field.toLowerCase()} ${op} “${c.value}”`;
    })
    .join(" and ");
  const acts = w.actions.map((a) => actionByType(a.type)?.label.toLowerCase() ?? a.type).join(", then ");
  return `When ${trigger}${conds ? `, and ${conds}` : ""}, Verto will ${acts || "…"}.`;
}

const EXAMPLES: { name: string; triggerEvent: string; conditions: WorkflowCondition[]; actions: WorkflowAction[] }[] = [
  {
    name: "VIP deposit → say thank you personally",
    triggerEvent: "deposit.paid",
    conditions: [{ field: "amountCents", op: "gt", value: "50000" }],
    actions: [{ type: "draft_client_message", params: { situation: "A significant deposit just came in — send a warm, personal thank-you." } }],
  },
  {
    name: "Ready to collect → book the handover",
    triggerEvent: "commission.stage_changed",
    conditions: [{ field: "stage", op: "equals", value: "delivery" }],
    actions: [{ type: "create_task", params: { title: "Arrange handover for {title} · {clientName}", dueInDays: "3" } }],
  },
  {
    name: "New client → send my intake form (via Zapier)",
    triggerEvent: "client.created",
    conditions: [],
    actions: [{ type: "webhook", params: { url: "https://hooks.zapier.com/…" } }],
  },
];

// ---- Builder form ----------------------------------------------------------

interface Draft {
  name: string;
  description: string;
  triggerEvent: string;
  conditions: WorkflowCondition[];
  actions: WorkflowAction[];
}

function blankDraft(): Draft {
  return { name: "", description: "", triggerEvent: WORKFLOW_TRIGGERS[0].event, conditions: [], actions: [] };
}

function WorkflowForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial: (Draft & { id?: string }) | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const toast = useToast();
  const [draft, setDraft] = useState<Draft & { id?: string }>(initial ?? blankDraft());
  const [busy, setBusy] = useState(false);
  const trigger = triggerByEvent(draft.triggerEvent) ?? WORKFLOW_TRIGGERS[0];

  // Actions offered depend on whether the trigger carries a client.
  const availableActions = useMemo(
    () => WORKFLOW_ACTIONS.filter((a) => !a.needsClient || trigger.hasClient),
    [trigger],
  );

  const setTrigger = (event: string) => {
    const t = triggerByEvent(event);
    setDraft((d) => ({
      ...d,
      triggerEvent: event,
      // Drop conditions/actions that no longer make sense for the new trigger.
      conditions: d.conditions.filter((c) => t?.fields.some((f) => f.key === c.field)),
      actions: d.actions.filter((a) => {
        const def = actionByType(a.type);
        return def && (!def.needsClient || t?.hasClient);
      }),
    }));
  };

  const addCondition = () =>
    setDraft((d) => ({ ...d, conditions: [...d.conditions, { field: trigger.fields[0].key, op: "equals", value: "" }] }));
  const addAction = () =>
    setDraft((d) => ({ ...d, actions: [...d.actions, { type: availableActions[0].type, params: {} }] }));

  const save = async () => {
    if (!draft.name.trim()) return toast.error("Give your workflow a name.");
    if (draft.actions.length === 0) return toast.error("Add at least one action.");
    setBusy(true);
    try {
      const payload = {
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        triggerEvent: draft.triggerEvent,
        conditions: draft.conditions,
        actions: draft.actions,
      };
      if (draft.id) await api.put(`/api/admin/workflows/${draft.id}`, payload);
      else await api.post("/api/admin/workflows", payload);
      toast.success(draft.id ? "Workflow saved." : "Workflow created.");
      onSaved();
    } catch {
      /* toast via api layer */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-ink/15 bg-white p-4">
      <input
        className="admin-input mb-2 w-full text-sm font-medium"
        placeholder="Name this workflow — e.g. “Ready to collect → book the handover”"
        value={draft.name}
        onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
      />

      {/* WHEN */}
      <div className="mt-3">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-warmgrey">When…</p>
        <select className="admin-input w-full text-sm" value={draft.triggerEvent} onChange={(e) => setTrigger(e.target.value)}>
          {WORKFLOW_TRIGGERS.map((t) => (
            <option key={t.event} value={t.event}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {/* IF */}
      <div className="mt-3">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-warmgrey">Only if… (optional)</p>
        {draft.conditions.map((c, i) => (
          <div key={i} className="mb-2 flex flex-wrap items-center gap-2">
            <select
              className="admin-input text-sm"
              value={c.field}
              onChange={(e) =>
                setDraft((d) => {
                  const next = [...d.conditions];
                  next[i] = { ...next[i], field: e.target.value };
                  return { ...d, conditions: next };
                })
              }
            >
              {trigger.fields.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
            <select
              className="admin-input text-sm"
              value={c.op}
              onChange={(e) =>
                setDraft((d) => {
                  const next = [...d.conditions];
                  next[i] = { ...next[i], op: e.target.value as ConditionOp };
                  return { ...d, conditions: next };
                })
              }
            >
              {CONDITION_OPS.map((o) => (
                <option key={o.op} value={o.op}>
                  {o.label}
                </option>
              ))}
            </select>
            <input
              className="admin-input flex-1 text-sm"
              placeholder="value"
              value={c.value}
              onChange={(e) =>
                setDraft((d) => {
                  const next = [...d.conditions];
                  next[i] = { ...next[i], value: e.target.value };
                  return { ...d, conditions: next };
                })
              }
            />
            <button
              className="text-xs text-warmgrey hover:text-red-700"
              onClick={() => setDraft((d) => ({ ...d, conditions: d.conditions.filter((_, j) => j !== i) }))}
            >
              remove
            </button>
          </div>
        ))}
        <button className="admin-btn text-xs" onClick={addCondition}>
          + Add a condition
        </button>
      </div>

      {/* THEN */}
      <div className="mt-4">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-warmgrey">Then…</p>
        {draft.actions.map((a, i) => {
          const def = actionByType(a.type);
          return (
            <div key={i} className="mb-2 rounded-lg border border-ink/10 p-3">
              <div className="flex items-center gap-2">
                <select
                  className="admin-input flex-1 text-sm"
                  value={a.type}
                  onChange={(e) =>
                    setDraft((d) => {
                      const next = [...d.actions];
                      next[i] = { type: e.target.value, params: {} };
                      return { ...d, actions: next };
                    })
                  }
                >
                  {availableActions.map((ad) => (
                    <option key={ad.type} value={ad.type}>
                      {ad.label}
                    </option>
                  ))}
                </select>
                <button
                  className="text-xs text-warmgrey hover:text-red-700"
                  onClick={() => setDraft((d) => ({ ...d, actions: d.actions.filter((_, j) => j !== i) }))}
                >
                  remove
                </button>
              </div>
              {def?.help && <p className="mt-1 text-[11px] text-warmgrey">{def.help}</p>}
              {def?.params.map((p) => (
                <div key={p.key} className="mt-2">
                  {p.kind === "longtext" ? (
                    <textarea
                      className="admin-input h-16 w-full text-sm"
                      placeholder={p.placeholder}
                      value={a.params[p.key] ?? ""}
                      onChange={(e) =>
                        setDraft((d) => {
                          const next = [...d.actions];
                          next[i] = { ...next[i], params: { ...next[i].params, [p.key]: e.target.value } };
                          return { ...d, actions: next };
                        })
                      }
                    />
                  ) : (
                    <input
                      className="admin-input w-full text-sm"
                      type={p.kind === "number" ? "number" : "text"}
                      placeholder={`${p.label}${p.optional ? " (optional)" : ""}${p.placeholder ? ` — ${p.placeholder}` : ""}`}
                      value={a.params[p.key] ?? ""}
                      onChange={(e) =>
                        setDraft((d) => {
                          const next = [...d.actions];
                          next[i] = { ...next[i], params: { ...next[i].params, [p.key]: e.target.value } };
                          return { ...d, actions: next };
                        })
                      }
                    />
                  )}
                </div>
              ))}
            </div>
          );
        })}
        <button className="admin-btn text-xs" onClick={addAction}>
          + Add an action
        </button>
      </div>

      {draft.actions.length > 0 && (
        <p className="mt-4 rounded-lg bg-navy/[0.04] p-3 text-xs text-ink/80">{sentence(draft)}</p>
      )}

      <div className="mt-4 flex justify-end gap-2">
        <button className="admin-btn text-sm" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button className="admin-btn-primary text-sm" onClick={save} disabled={busy}>
          {draft.id ? "Save changes" : "Create workflow"}
        </button>
      </div>
    </div>
  );
}

// ---- Row + runs ------------------------------------------------------------

function WorkflowRow({ w, onChange, onEdit }: { w: Workflow; onChange: () => void; onEdit: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [showRuns, setShowRuns] = useState(false);
  const runs = useFetch<WorkflowRun[]>(showRuns ? `/api/admin/workflows/${w.id}/runs` : null);

  const toggle = async () => {
    setBusy(true);
    try {
      await api.patch(`/api/admin/workflows/${w.id}`, { enabled: !w.enabled });
      onChange();
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    setBusy(true);
    try {
      await api.delete(`/api/admin/workflows/${w.id}`);
      toast.success("Workflow deleted.");
      onChange();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-ink/10 bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-ink">{w.name}</p>
          <p className="mt-1 text-xs text-warmgrey">{sentence(w)}</p>
          <p className="mt-1 text-[11px] text-warmgrey">
            Ran {w.runCount} time{w.runCount === 1 ? "" : "s"}
            {w.lastRunAt ? ` · last ${w.lastRunAt.slice(0, 16).replace("T", " ")}` : ""}
            {" · "}
            <button className="underline hover:text-ink" onClick={() => setShowRuns((v) => !v)}>
              {showRuns ? "hide runs" : "recent runs"}
            </button>
          </p>
        </div>
        <Switch on={w.enabled} busy={busy} onClick={toggle} label={`Enable ${w.name}`} />
      </div>
      {showRuns && (
        <ul className="mt-3 space-y-1 border-t border-ink/8 pt-2">
          {(runs.data ?? []).map((r) => (
            <li key={r.id} className="text-[11px] text-warmgrey">
              <span
                className={`mr-1.5 rounded px-1.5 py-0.5 text-[10px] ${r.status === "ok" ? "bg-green-100 text-green-800" : r.status === "skipped" ? "bg-ink/8 text-ink/60" : "bg-red-100 text-red-800"}`}
              >
                {r.status}
              </span>
              {r.detail} · {r.createdAt.slice(0, 16).replace("T", " ")}
            </li>
          ))}
          {runs.data && runs.data.length === 0 && <li className="text-[11px] text-warmgrey">No runs yet.</li>}
        </ul>
      )}
      <div className="mt-3 flex gap-3 text-xs">
        <button className="text-navy hover:underline" onClick={onEdit}>
          Edit
        </button>
        <button className="text-warmgrey hover:text-red-700" onClick={remove} disabled={busy}>
          Delete
        </button>
      </div>
    </div>
  );
}

/** Workflows — the no-code builder. Shops compose their own "when this, do
 *  that" rules on the same event spine the built-in automations use. */
export function WorkflowsPage() {
  const workflows = useFetch<Workflow[]>("/api/admin/workflows");
  const [editing, setEditing] = useState<(Draft & { id?: string }) | null>(null);
  const [creating, setCreating] = useState(false);

  const startEdit = (w: Workflow) =>
    setEditing({
      id: w.id,
      name: w.name,
      description: w.description ?? "",
      triggerEvent: w.triggerEvent,
      conditions: w.conditions,
      actions: w.actions,
    });

  const startExample = (ex: (typeof EXAMPLES)[number]) =>
    setEditing({ name: ex.name, description: "", triggerEvent: ex.triggerEvent, conditions: ex.conditions, actions: ex.actions });

  const done = () => {
    setEditing(null);
    setCreating(false);
    workflows.reload();
  };

  const list = workflows.data ?? [];
  const showForm = creating || editing;

  return (
    <div>
      <PageHeader
        title="Workflows"
        eyebrow="System"
        description="Build your own rules — “when this happens in my shop, do that.” Workflows run on the same event spine as the built-in automations, and like them they only ever create things. Nothing they do is destructive."
        help="workflows"
      />

      {!showForm && (
        <div className="mb-4 flex justify-end">
          <button className="admin-btn-primary text-sm" onClick={() => setCreating(true)}>
            + New workflow
          </button>
        </div>
      )}

      {showForm && (
        <div className="mb-4">
          <WorkflowForm initial={editing} onSaved={done} onCancel={done} />
        </div>
      )}

      <div className="space-y-3">
        {list.map((w) => (
          <WorkflowRow key={w.id} w={w} onChange={workflows.reload} onEdit={() => startEdit(w)} />
        ))}
      </div>

      {!showForm && workflows.data && list.length === 0 && (
        <div>
          <EmptyState
            title="No workflows yet"
            hint="Workflows are your own automations. Start from an example below, or build one from scratch."
          />
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {EXAMPLES.map((ex) => (
              <button
                key={ex.name}
                onClick={() => startExample(ex)}
                className="rounded-xl border border-ink/10 bg-white p-4 text-left hover:border-navy/40"
              >
                <p className="text-sm font-medium text-ink">{ex.name}</p>
                <p className="mt-1 text-xs text-warmgrey">{sentence(ex)}</p>
                <p className="mt-2 text-[11px] font-medium text-navy">Use this →</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
