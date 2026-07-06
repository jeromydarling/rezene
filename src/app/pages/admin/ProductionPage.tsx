import { useMemo, useState, type FormEvent } from "react";
import { useFetch } from "../../lib/useFetch";
import { api, ApiRequestError } from "../../lib/api";
import { formatDate, titleCase } from "../../lib/format";
import {
  EmptyState,
  ErrorNote,
  LoadingTable,
  PageHeader,
  SlideOver,
  StatusBadge,
} from "../../components/admin/ui";
import type {
  AdminCalendarEvent,
  AdminProductionStage,
  AdminProductionTask,
} from "../../../shared/types";

const KANBAN_COLUMNS: { status: AdminProductionTask["status"]; label: string }[] = [
  { status: "todo", label: "To do" },
  { status: "in_progress", label: "In progress" },
  { status: "blocked", label: "Blocked" },
  { status: "done", label: "Done" },
];

type View = "kanban" | "table" | "timeline";

export function ProductionPage() {
  const tasks = useFetch<AdminProductionTask[]>("/api/admin/production/tasks");
  const calendar = useFetch<AdminCalendarEvent[]>("/api/admin/production/calendar");
  const stages = useFetch<AdminProductionStage[]>("/api/admin/production/stages");
  const [view, setView] = useState<View>("kanban");
  const [createOpen, setCreateOpen] = useState(false);

  async function moveTask(task: AdminProductionTask, status: AdminProductionTask["status"]) {
    await api.patch(`/api/admin/production/tasks/${task.id}`, { status });
    tasks.reload();
  }

  async function deleteTask(task: AdminProductionTask) {
    if (!window.confirm(`Delete task "${task.title}"?`)) return;
    await api.delete(`/api/admin/production/tasks/${task.id}`);
    tasks.reload();
  }

  const byStatus = useMemo(() => {
    const map = new Map<string, AdminProductionTask[]>();
    for (const col of KANBAN_COLUMNS) map.set(col.status, []);
    for (const t of tasks.data ?? []) {
      if (!map.has(t.status)) map.set(t.status, []);
      map.get(t.status)!.push(t);
    }
    return map;
  }, [tasks.data]);

  return (
    <div>
      <PageHeader
        eyebrow="Production"
        title="Production Calendar"
        description="The season plan: brand identity → concepts → tech packs → Casablanca briefings → sampling → bulk → QC → launch."
        actions={
          <>
            <div className="flex overflow-hidden rounded-md border border-ink/15">
              {(["kanban", "table", "timeline"] as View[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={`px-3 py-1.5 text-xs uppercase tracking-wider ${
                    view === v ? "bg-navy text-chalk" : "bg-white text-ink/60 hover:text-ink"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
            <button type="button" className="btn btn-primary" onClick={() => setCreateOpen(true)}>
              New task
            </button>
          </>
        }
      />
      {tasks.error && <ErrorNote message={tasks.error} />}
      {tasks.loading && <LoadingTable />}

      {/* Kanban */}
      {view === "kanban" && tasks.data && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {KANBAN_COLUMNS.map((col) => (
            <div key={col.status} className="rounded-md bg-ink/4 p-3">
              <p className="mb-3 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-warmgrey">
                {col.label}
                <span>{byStatus.get(col.status)?.length ?? 0}</span>
              </p>
              <div className="space-y-2">
                {(byStatus.get(col.status) ?? []).map((t) => (
                  <div key={t.id} className="admin-card p-3">
                    <p className="text-sm font-medium leading-snug">
                      {t.riskFlag && <span className="mr-1 text-terracotta-deep">▲</span>}
                      {t.title}
                    </p>
                    <p className="mt-1 text-xs text-warmgrey">
                      {[t.stageName, t.styleName, t.supplierName].filter(Boolean).join(" · ")}
                    </p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-warmgrey">
                        {t.dueDate ? formatDate(t.dueDate) : "no due date"}
                      </span>
                      <select
                        className="rounded border border-ink/15 bg-white px-1 py-0.5 text-[0.68rem]"
                        value={t.status}
                        onChange={(e) =>
                          void moveTask(t, e.target.value as AdminProductionTask["status"])
                        }
                      >
                        {[...KANBAN_COLUMNS.map((k) => k.status), "cancelled"].map((s) => (
                          <option key={s} value={s}>
                            {titleCase(s)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      {view === "table" && tasks.data && (
        <div className="admin-card overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Stage</th>
                <th>Owner</th>
                <th>Style</th>
                <th>Supplier</th>
                <th>Due</th>
                <th>Status</th>
                <th>Risk</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {tasks.data.map((t) => (
                <tr key={t.id}>
                  <td className="font-medium">{t.title}</td>
                  <td>{t.stageName ?? "—"}</td>
                  <td>{t.owner ?? "—"}</td>
                  <td>{t.styleName ?? "—"}</td>
                  <td>{t.supplierName ?? "—"}</td>
                  <td>{t.dueDate ? formatDate(t.dueDate) : "—"}</td>
                  <td>
                    <StatusBadge status={t.status} />
                  </td>
                  <td>{t.riskFlag ? <span className="badge badge-danger">risk</span> : "—"}</td>
                  <td className="text-right">
                    <button type="button" className="text-xs text-terracotta hover:underline" onClick={() => void deleteTask(t)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Timeline (Gantt-lite over calendar windows) */}
      {view === "timeline" && (
        <TimelineView events={calendar.data ?? []} loading={calendar.loading} />
      )}

      <SlideOver open={createOpen} title="New production task" onClose={() => setCreateOpen(false)}>
        <TaskCreateForm
          stages={stages.data ?? []}
          onCreated={() => {
            setCreateOpen(false);
            tasks.reload();
          }}
        />
      </SlideOver>
    </div>
  );
}

function TimelineView({ events, loading }: { events: AdminCalendarEvent[]; loading: boolean }) {
  if (loading) return <LoadingTable />;
  if (events.length === 0) {
    return <EmptyState title="No calendar events" hint="Add season milestones to see the timeline." />;
  }
  const dates = events.flatMap((e) => [e.startsOn, e.endsOn ?? e.startsOn]);
  const min = new Date(dates.reduce((a, b) => (a < b ? a : b)));
  const max = new Date(dates.reduce((a, b) => (a > b ? a : b)));
  const span = Math.max(1, max.getTime() - min.getTime());
  const pct = (d: string) => ((new Date(d).getTime() - min.getTime()) / span) * 100;

  return (
    <div className="admin-card space-y-3 p-5">
      {events.map((e) => {
        const left = pct(e.startsOn);
        const width = Math.max(2, pct(e.endsOn ?? e.startsOn) - left);
        return (
          <div key={e.id} className="grid grid-cols-[200px_1fr] items-center gap-4">
            <div>
              <p className="truncate text-sm font-medium">{e.title}</p>
              <p className="text-xs text-warmgrey">
                {formatDate(e.startsOn)}
                {e.endsOn ? ` → ${formatDate(e.endsOn)}` : ""}
              </p>
            </div>
            <div className="relative h-5 rounded bg-ink/5">
              <div
                className={`absolute top-0 h-5 rounded ${
                  e.kind === "deadline" ? "bg-terracotta" : e.kind === "milestone" ? "bg-saffron" : "bg-indigo-faded"
                }`}
                style={{ left: `${left}%`, width: `${width}%` }}
                title={e.notes ?? e.title}
              />
            </div>
          </div>
        );
      })}
      <p className="pt-2 text-xs text-warmgrey">
        <span className="mr-3 inline-block h-2.5 w-2.5 rounded bg-indigo-faded" /> window
        <span className="mx-3 inline-block h-2.5 w-2.5 rounded bg-saffron" /> milestone
        <span className="mx-3 inline-block h-2.5 w-2.5 rounded bg-terracotta" /> deadline
      </p>
    </div>
  );
}

function TaskCreateForm({
  stages,
  onCreated,
}: {
  stages: AdminProductionStage[];
  onCreated: () => void;
}) {
  const [form, setForm] = useState({ title: "", stageId: "", owner: "", dueDate: "", notes: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/admin/production/tasks", {
        title: form.title,
        stageId: form.stageId || undefined,
        owner: form.owner || undefined,
        dueDate: form.dueDate || undefined,
        notes: form.notes || undefined,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label">Title *</label>
        <input
          required
          className="input"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
      </div>
      <div>
        <label className="label">Stage</label>
        <select
          className="input"
          value={form.stageId}
          onChange={(e) => setForm({ ...form, stageId: e.target.value })}
        >
          <option value="">—</option>
          {stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Owner</label>
          <input
            className="input"
            value={form.owner}
            onChange={(e) => setForm({ ...form, owner: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Due date</label>
          <input
            type="date"
            className="input"
            value={form.dueDate}
            onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
          />
        </div>
      </div>
      <div>
        <label className="label">Notes</label>
        <textarea
          rows={3}
          className="input"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
      </div>
      {error && <p className="field-error">{error}</p>}
      <button type="submit" disabled={busy} className="btn btn-primary w-full">
        {busy ? "Creating…" : "Create task"}
      </button>
    </form>
  );
}
