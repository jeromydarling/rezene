import { useState } from "react";
import { Link } from "react-router";
import { useFetch } from "../../lib/useFetch";
import { api } from "../../lib/api";
import { useToast } from "../../lib/toast";
import { formatDate, formatMoney } from "../../lib/format";
import { EmptyState, ErrorNote, LoadingTable, PageHeader, StatusBadge } from "../../components/admin/ui";

/**
 * The commission pipeline — every piece of client work in the studio,
 * grouped by stage. The stages, their order, and their names come from the
 * shop's own pipeline config (customisable here). Cards link to the client's
 * page, where the work actually happens (fittings, stage moves, photos).
 */

interface CommissionSummary {
  id: string;
  clientId: string;
  clientName: string;
  title: string;
  kind: string;
  stage: string;
  stageLabel: string;
  dueAt: string | null;
  priceCents: number | null;
  updatedAt: string;
}

interface PipelineStage {
  key: string;
  label: string;
  active: boolean;
}
interface Pipeline {
  stages: PipelineStage[];
  labels: Record<string, string>;
}

function PipelineEditor({ pipeline, onSaved, onClose }: { pipeline: Pipeline; onSaved: () => void; onClose: () => void }) {
  const toast = useToast();
  const [stages, setStages] = useState<PipelineStage[]>(pipeline.stages.map((s) => ({ ...s })));
  const [busy, setBusy] = useState(false);

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= stages.length) return;
    const next = [...stages];
    [next[i], next[j]] = [next[j], next[i]];
    setStages(next);
  };
  const save = async () => {
    setBusy(true);
    try {
      await api.put("/api/admin/commissions/pipeline", { stages });
      toast.success("Pipeline saved.");
      onSaved();
      onClose();
    } catch {
      /* toast via api layer */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-card mb-4 p-4">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="font-medium">Customise your pipeline</h2>
        <button className="text-xs text-warmgrey hover:text-ink" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="mb-3 text-xs text-warmgrey">
        Rename each stage to your own language, reorder them, or hide the ones you don't use. The stages themselves are
        fixed (so your automations keep working) — this is about wording and flow.
      </p>
      <ul className="space-y-2">
        {stages.map((s, i) => (
          <li key={s.key} className="flex items-center gap-2">
            <div className="flex flex-col">
              <button className="text-xs text-warmgrey hover:text-ink disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)}>
                ▲
              </button>
              <button
                className="text-xs text-warmgrey hover:text-ink disabled:opacity-30"
                disabled={i === stages.length - 1}
                onClick={() => move(i, 1)}
              >
                ▼
              </button>
            </div>
            <input
              className="admin-input flex-1 text-sm"
              value={s.label}
              onChange={(e) =>
                setStages((prev) => prev.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))
              }
            />
            <label className="flex items-center gap-1.5 whitespace-nowrap text-xs text-warmgrey">
              <input
                type="checkbox"
                checked={s.active}
                onChange={(e) => setStages((prev) => prev.map((x, j) => (j === i ? { ...x, active: e.target.checked } : x)))}
              />
              shown
            </label>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex justify-end">
        <button className="admin-btn-primary text-sm" onClick={save} disabled={busy}>
          Save pipeline
        </button>
      </div>
    </div>
  );
}

export function CommissionsPage() {
  const { data, loading, error } = useFetch<CommissionSummary[]>("/api/admin/commissions");
  const pipelineFetch = useFetch<Pipeline>("/api/admin/commissions/pipeline");
  const [editing, setEditing] = useState(false);

  const active = (data ?? []).filter((c) => !["done", "cancelled"].includes(c.stage));
  const finished = (data ?? []).filter((c) => ["done", "cancelled"].includes(c.stage));

  const pipeline = pipelineFetch.data;
  // Columns: active configured stages, in order, plus any stage that has cards
  // even if hidden (so nothing ever disappears from view).
  const columnKeys: string[] = [];
  if (pipeline) {
    for (const s of pipeline.stages) if (s.active) columnKeys.push(s.key);
    for (const c of active) if (!columnKeys.includes(c.stage)) columnKeys.push(c.stage);
  }
  const label = (key: string) => pipeline?.labels[key] ?? key;

  return (
    <div>
      <PageHeader
        eyebrow="Clients"
        title="Commissions"
        help="commissions"
        description="Every piece of client work, from first consult to delivery. Open a card to run fittings and move it along on the client's page."
      />
      <div className="mb-4 flex justify-end">
        <button className="admin-btn text-sm" onClick={() => setEditing((v) => !v)}>
          {editing ? "Close" : "Customise pipeline"}
        </button>
      </div>
      {editing && pipeline && (
        <PipelineEditor pipeline={pipeline} onSaved={() => pipelineFetch.reload()} onClose={() => setEditing(false)} />
      )}
      {error && <ErrorNote message={error} />}
      {loading && <LoadingTable />}
      {data && data.length === 0 && (
        <EmptyState
          title="No commissions yet"
          hint="Open a client in the Client Book and start their first commission — a made-to-measure piece or an alteration."
        />
      )}
      {active.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {columnKeys
            .filter((st) => active.some((c) => c.stage === st))
            .map((st) => (
              <section key={st} className="admin-card p-4">
                <h2 className="mb-2 flex items-center justify-between font-medium">
                  {label(st)}
                  <span className="text-xs text-warmgrey">{active.filter((c) => c.stage === st).length}</span>
                </h2>
                <ul className="space-y-2">
                  {active
                    .filter((c) => c.stage === st)
                    .map((c) => (
                      <li key={c.id} className="rounded border border-black/5 p-3 text-sm">
                        <Link to={`/admin/clients/${c.clientId}`} className="font-medium hover:underline">
                          {c.title}
                        </Link>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-warmgrey">
                          <span>{c.clientName}</span>
                          {c.kind === "alteration" && <StatusBadge status="alteration" />}
                          {c.dueAt && <span>due {formatDate(c.dueAt)}</span>}
                          {c.priceCents != null && <span>{formatMoney(c.priceCents)}</span>}
                        </div>
                      </li>
                    ))}
                </ul>
              </section>
            ))}
        </div>
      )}
      {finished.length > 0 && (
        <section className="admin-card mt-4 p-4">
          <h2 className="mb-2 font-medium">Finished</h2>
          <ul className="space-y-1 text-sm">
            {finished.slice(0, 20).map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2">
                <Link to={`/admin/clients/${c.clientId}`} className="hover:underline">
                  {c.title} <span className="text-xs text-warmgrey">— {c.clientName}</span>
                </Link>
                <span className="flex items-center gap-2 text-xs text-warmgrey">
                  <StatusBadge status={c.stage} />
                  {formatDate(c.updatedAt)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
