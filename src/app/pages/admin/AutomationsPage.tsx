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
  supportsAutoApprove?: boolean;
  autoApproveNote?: string | null;
  autoApprove?: boolean;
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

interface ActivityRow {
  id: string;
  kind: string;
  title: string;
  createdAt: string;
}

interface ClientMessage {
  id: string;
  clientId: string;
  clientName: string | null;
  clientEmail: string | null;
  commissionTitle: string | null;
  trigger: string | null;
  channel: "email" | "portal";
  subject: string | null;
  body: string;
  status: string;
  createdAt: string;
}

const TRIGGER_LABEL: Record<string, string> = {
  "client-created-welcome": "Welcome note",
  "commission-stage-notify": "Stage update",
  "deposit-paid-thanks": "Payment thank-you",
  manual: "Written by you",
};

/** One editable client-message draft in the Approvals inbox. */
function ApprovalCard({ msg, onDone }: { msg: ClientMessage; onDone: () => void }) {
  const toast = useToast();
  const [subject, setSubject] = useState(msg.subject ?? "");
  const [body, setBody] = useState(msg.body);
  const [channel, setChannel] = useState<"email" | "portal">(msg.channel);
  const [busy, setBusy] = useState(false);
  const dirty = subject !== (msg.subject ?? "") || body !== msg.body || channel !== msg.channel;

  const save = async () => {
    await api.patch(`/api/admin/client-messages/${msg.id}`, { subject, body, channel });
  };
  const send = async () => {
    setBusy(true);
    try {
      if (dirty) await save();
      const res = await api.post<{ emailed: boolean }>(`/api/admin/client-messages/${msg.id}/send`);
      toast.success(channel === "portal" ? "Posted to the client's portal." : res.emailed ? "Sent." : "Marked sent (email isn't configured yet).");
      onDone();
    } catch {
      /* toast via api layer */
    } finally {
      setBusy(false);
    }
  };
  const dismiss = async () => {
    setBusy(true);
    try {
      await api.post(`/api/admin/client-messages/${msg.id}/dismiss`);
      toast.success("Draft dismissed.");
      onDone();
    } catch {
      /* toast */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-ink/10 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-navy/10 px-2 py-0.5 text-[11px] font-medium text-navy">
          {TRIGGER_LABEL[msg.trigger ?? "manual"] ?? "Draft"}
        </span>
        <span className="text-sm font-medium text-ink">{msg.clientName ?? "Client"}</span>
        {msg.commissionTitle && <span className="text-xs text-warmgrey">· {msg.commissionTitle}</span>}
      </div>

      <div className="mt-3 space-y-2">
        <label className="block text-[11px] font-medium uppercase tracking-wide text-warmgrey">Subject</label>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full rounded-lg border border-ink/15 px-3 py-1.5 text-sm"
          placeholder="Subject"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
          className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm leading-relaxed"
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-ink/15 p-0.5 text-xs">
          <button
            onClick={() => setChannel("email")}
            disabled={!msg.clientEmail}
            title={msg.clientEmail ? "" : "This client has no email on file"}
            className={`rounded-md px-2.5 py-1 ${channel === "email" ? "bg-navy text-white" : "text-ink/70"} ${!msg.clientEmail ? "opacity-40" : ""}`}
          >
            Email
          </button>
          <button
            onClick={() => setChannel("portal")}
            className={`rounded-md px-2.5 py-1 ${channel === "portal" ? "bg-navy text-white" : "text-ink/70"}`}
          >
            Portal
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={dismiss} disabled={busy} className="text-xs text-warmgrey hover:text-ink">
            Dismiss
          </button>
          <button
            onClick={send}
            disabled={busy || !body.trim()}
            className="rounded-lg bg-navy px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {channel === "portal" ? "Post to portal" : "Send"}
          </button>
        </div>
      </div>
      {channel === "email" && !msg.clientEmail && (
        <p className="mt-2 text-[11px] text-warmgrey">No email on file — post to the portal, or add an email on the client's page.</p>
      )}
    </div>
  );
}

function ApprovalsInbox() {
  const drafts = useFetch<ClientMessage[]>("/api/admin/client-messages?status=draft");
  const list = drafts.data ?? [];
  return (
    <div className="max-w-2xl space-y-3">
      <p className="text-sm text-warmgrey">
        Client-facing messages your automations drafted — a welcome, a stage update, a thank-you. Edit any of them, then
        send by email or post to the client's portal. Nothing reaches a client until you send it.
      </p>
      {list.map((m) => (
        <ApprovalCard key={m.id} msg={m} onDone={() => drafts.reload()} />
      ))}
      {drafts.data && list.length === 0 && (
        <EmptyState
          title="Nothing waiting"
          hint="When you add a client, move a commission to a client-facing stage, or mark a payment paid, a draft lands here for your okay."
        />
      )}
    </div>
  );
}

/** Automations — toggles for the built-in rules, the Approvals inbox for
 *  client-facing drafts, and the live activity feed they hang off. */
export function AutomationsPage() {
  const toast = useToast();
  const rules = useFetch<Rule[]>("/api/admin/automations");
  const activity = useFetch<ActivityRow[]>("/api/admin/automations/activity");
  const pending = useFetch<ClientMessage[]>("/api/admin/client-messages?status=draft");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [tab, setTab] = useState<"rules" | "approvals">("rules");

  const pendingCount = pending.data?.length ?? 0;

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

  const toggleAuto = async (rule: Rule) => {
    setBusyKey(rule.key + ":auto");
    try {
      await api.patch(`/api/admin/automations/${rule.key}`, { autoApprove: !rule.autoApprove });
      toast.success(rule.autoApprove ? "Back to review-first — drafts wait for you." : "Auto-approve on for this one.");
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
        description="Verto watches what happens in your shop and files the obvious next step for you — a task, a draft order, a message to a client. Every rule can be paused; none of them ever change or delete anything."
        help="automations"
      />

      <div className="mb-4 flex gap-1 border-b border-ink/10">
        <button
          onClick={() => setTab("rules")}
          className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${tab === "rules" ? "border-navy text-ink" : "border-transparent text-warmgrey hover:text-ink"}`}
        >
          Rules
        </button>
        <button
          onClick={() => setTab("approvals")}
          className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${tab === "approvals" ? "border-navy text-ink" : "border-transparent text-warmgrey hover:text-ink"}`}
        >
          Approvals
          {pendingCount > 0 && (
            <span className="ml-1.5 rounded-full bg-navy px-1.5 py-0.5 text-[10px] font-semibold text-white">{pendingCount}</span>
          )}
        </button>
      </div>

      {tab === "approvals" ? (
        <ApprovalsInbox />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-3">
            {(rules.data ?? []).map((rule) => (
              <div key={rule.key} className="rounded-xl border border-ink/10 bg-white p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-ink">{rule.title}</p>
                    <p className="mt-1 text-xs text-warmgrey">{rule.description}</p>
                  </div>
                  <div className="mt-1">
                    <Switch on={rule.enabled} busy={busyKey === rule.key} onClick={() => toggle(rule)} label={`Enable ${rule.title}`} />
                  </div>
                </div>
                {rule.supportsAutoApprove && rule.enabled && (
                  <div className="mt-3 flex items-center justify-between gap-4 border-t border-ink/8 pt-3">
                    <div>
                      <p className="text-xs font-medium text-ink/80">Auto-approve</p>
                      <p className="mt-0.5 text-[11px] text-warmgrey">
                        {rule.autoApprove
                          ? `On — Verto will ${rule.autoApproveNote ?? "complete this automatically"}`
                          : `Off — drafts wait for you to review. Turn on to ${rule.autoApproveNote ?? "let it complete automatically"}`}
                      </p>
                    </div>
                    <Switch
                      on={Boolean(rule.autoApprove)}
                      busy={busyKey === rule.key + ":auto"}
                      onClick={() => toggleAuto(rule)}
                      label={`Auto-approve ${rule.title}`}
                    />
                  </div>
                )}
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
      )}
    </div>
  );
}
