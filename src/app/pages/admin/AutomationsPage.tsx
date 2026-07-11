import { useState } from "react";
import { PageHeader, EmptyState } from "../../components/admin/ui";
import { useFetch } from "../../lib/useFetch";
import { api } from "../../lib/api";
import { useToast } from "../../lib/toast";

interface Rule {
  key: string;
  title: string;
  description: string;
  enabled: boolean;
}

interface ActivityRow {
  id: string;
  kind: string;
  title: string;
  createdAt: string;
}

/** Automations — toggles for the built-in rules plus the live activity feed
 *  they hang off. Rules only ever CREATE things (a task, a draft order), so
 *  the worst surprise is a task you delete. */
export function AutomationsPage() {
  const toast = useToast();
  const rules = useFetch<Rule[]>("/api/admin/automations");
  const activity = useFetch<ActivityRow[]>("/api/admin/automations/activity");
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const toggle = async (rule: Rule) => {
    setBusyKey(rule.key);
    try {
      await api.patch(`/api/admin/automations/${rule.key}`, { enabled: !rule.enabled });
      toast.success(rule.enabled ? "Automation paused." : "Automation on.");
      rules.reload();
    } catch {
      /* toast handled by api layer */
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Automations"
        eyebrow="System"
        description="Verto watches what happens in your shop and files the obvious next step for you — a task, a draft order, a reminder. Every rule can be paused; none of them ever change or delete anything."
        help="automations"
      />

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-3">
          {(rules.data ?? []).map((rule) => (
            <div key={rule.key} className="flex items-start justify-between gap-4 rounded-xl border border-ink/10 bg-white p-4">
              <div>
                <p className="text-sm font-medium text-ink">{rule.title}</p>
                <p className="mt-1 text-xs text-warmgrey">{rule.description}</p>
              </div>
              <button
                onClick={() => toggle(rule)}
                disabled={busyKey === rule.key}
                role="switch"
                aria-checked={rule.enabled}
                className={`relative mt-1 h-6 w-11 shrink-0 rounded-full transition-colors ${
                  rule.enabled ? "bg-navy" : "bg-ink/20"
                } ${busyKey === rule.key ? "opacity-50" : ""}`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                    rule.enabled ? "left-[22px]" : "left-0.5"
                  }`}
                />
              </button>
            </div>
          ))}
          {rules.data && rules.data.length === 0 && (
            <EmptyState title="No automations available" hint="Rules ship with the platform — check back after the next update." />
          )}
        </div>

        <div className="rounded-xl border border-ink/10 bg-white p-4">
          <h3 className="font-display text-sm">Recent activity</h3>
          <p className="mt-0.5 text-xs text-warmgrey">
            Everything Verto noticed lately — the events your automations react to.
          </p>
          <ul className="mt-3 space-y-2">
            {(activity.data ?? []).map((a) => (
              <li key={a.id} className="border-l-2 border-ink/10 pl-2 text-xs">
                <p className="text-ink/80">{a.title}</p>
                <p className="text-[10px] text-warmgrey">
                  {a.kind} · {a.createdAt?.slice(0, 16).replace("T", " ")}
                </p>
              </li>
            ))}
            {activity.data && activity.data.length === 0 && (
              <li className="text-xs text-warmgrey">
                Nothing yet — approve a sample, move an order or promote an R&D lead and it lands here.
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
