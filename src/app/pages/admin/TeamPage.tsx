import { useCallback, useState } from "react";
import { useFetch } from "../../lib/useFetch";
import { api, ApiRequestError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { formatDate } from "../../lib/format";
import { EmptyState, ErrorNote, LoadingTable, PageHeader, StatusBadge } from "../../components/admin/ui";

/**
 * Team management — invite multiple logins per shop across three roles.
 * Admin-only (the nav entry is hidden for others; the API enforces it too).
 */

interface TeamMember {
  id: string;
  email: string;
  name: string | null;
  role: "admin" | "ops" | "viewer";
  isActive: boolean;
  pending: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  isSelf: boolean;
}

const ROLES: { value: TeamMember["role"]; label: string; blurb: string }[] = [
  { value: "admin", label: "Admin", blurb: "Everything, including team & settings" },
  { value: "ops", label: "Operations", blurb: "Day-to-day work; no team or settings changes" },
  { value: "viewer", label: "Viewer", blurb: "Read-only across the admin" },
];

export function TeamPage() {
  const { user } = useAuth();
  const isAdmin = user?.roles.includes("admin");
  const { data, loading, error, reload } = useFetch<TeamMember[]>("/api/admin/users");
  const [invite, setInvite] = useState({ email: "", name: "", role: "ops" as TeamMember["role"] });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<{ url: string; emailed: boolean } | null>(null);
  const [copied, setCopied] = useState(false);

  const submitInvite = useCallback(async () => {
    setBusy(true);
    setFormError(null);
    setInviteLink(null);
    try {
      const res = await api.post<{ inviteUrl: string; emailed: boolean }>("/api/admin/users", invite);
      setInviteLink({ url: res.inviteUrl, emailed: res.emailed });
      setInvite({ email: "", name: "", role: "ops" });
      await reload();
    } catch (e) {
      setFormError(e instanceof ApiRequestError ? e.message : "Couldn't send the invite");
    } finally {
      setBusy(false);
    }
  }, [invite, reload]);

  if (!isAdmin) {
    return (
      <div>
        <PageHeader title="Team" eyebrow="Settings" />
        <EmptyState title="Admins only" hint="Ask an admin on your team to manage members and roles." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Team"
        eyebrow="Settings"
        description="Invite teammates and choose what each person can do. Everyone sets their own password from an invite link."
      />

      {/* Invite */}
      <div className="admin-card mb-6 space-y-4 p-5">
        <h2 className="font-display text-lg font-light">Invite a teammate</h2>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <input
            type="email"
            placeholder="name@email.com"
            className="input"
            value={invite.email}
            onChange={(e) => setInvite({ ...invite, email: e.target.value })}
          />
          <input
            type="text"
            placeholder="Name (optional)"
            className="input"
            value={invite.name}
            onChange={(e) => setInvite({ ...invite, name: e.target.value })}
          />
          <select
            className="input"
            value={invite.role}
            onChange={(e) => setInvite({ ...invite, role: e.target.value as TeamMember["role"] })}
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <p className="text-xs text-warmgrey">{ROLES.find((r) => r.value === invite.role)?.blurb}</p>
        {formError && <ErrorNote message={formError} />}
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || !invite.email}
          onClick={() => void submitInvite()}
        >
          {busy ? "Sending…" : "Send invite"}
        </button>

        {inviteLink && (
          <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-900">
            <p className="font-medium">
              {inviteLink.emailed ? "Invite emailed." : "Invite created."}{" "}
              {inviteLink.emailed ? "You can also share this link directly:" : "Email isn’t set up yet — share this link:"}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <input readOnly className="input flex-1 !text-xs" value={inviteLink.url} onFocus={(e) => e.target.select()} />
              <button
                type="button"
                className="btn btn-secondary !py-1.5 text-xs"
                onClick={() => {
                  void navigator.clipboard.writeText(inviteLink.url);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        )}
      </div>

      {loading && <LoadingTable />}
      {error && <ErrorNote message={error} />}
      {data && data.length === 0 && <EmptyState title="No teammates yet" hint="Invite your first teammate above." />}

      {data && data.length > 0 && (
        <div className="admin-card divide-y divide-ink/10 p-0">
          {data.map((m) => (
            <MemberRow key={m.id} member={m} onChanged={reload} />
          ))}
        </div>
      )}
    </div>
  );
}

function MemberRow({ member, onChanged }: { member: TeamMember; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const act = useCallback(
    async (fn: () => Promise<unknown>) => {
      setBusy(true);
      setErr(null);
      try {
        await fn();
        await onChanged();
      } catch (e) {
        setErr(e instanceof ApiRequestError ? e.message : "Action failed");
      } finally {
        setBusy(false);
      }
    },
    [onChanged],
  );

  const resend = useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await api.post<{ inviteUrl: string; emailed: boolean }>(`/api/admin/users/${member.id}/resend-invite`);
      await navigator.clipboard.writeText(res.inviteUrl).catch(() => {});
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : "Couldn't resend");
    } finally {
      setBusy(false);
    }
  }, [member.id]);

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{member.name || member.email}</span>
          {member.isSelf && <span className="badge badge-neutral">You</span>}
          {member.pending && <StatusBadge status="pending" />}
          {!member.isActive && <StatusBadge status="inactive" />}
        </div>
        <p className="truncate text-xs text-warmgrey">
          {member.email}
          {member.lastLoginAt ? ` · last in ${formatDate(member.lastLoginAt)}` : " · never signed in"}
        </p>
      </div>

      <select
        className="input !w-auto !py-1.5 text-xs"
        value={member.role}
        disabled={busy}
        onChange={(e) => void act(() => api.patch(`/api/admin/users/${member.id}`, { role: e.target.value }))}
      >
        {ROLES.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>

      {member.pending && (
        <button type="button" className="link-quiet text-xs" disabled={busy} onClick={() => void resend()}>
          {linkCopied ? "Link copied" : "Resend invite"}
        </button>
      )}

      {!member.isSelf && (
        <>
          <button
            type="button"
            className="link-quiet text-xs"
            disabled={busy}
            onClick={() => void act(() => api.patch(`/api/admin/users/${member.id}`, { isActive: !member.isActive }))}
          >
            {member.isActive ? "Deactivate" : "Reactivate"}
          </button>
          <button
            type="button"
            className="text-xs text-warmgrey hover:text-red-700 hover:underline"
            disabled={busy}
            onClick={() => {
              if (confirm(`Remove ${member.email} from the team?`)) void act(() => api.delete(`/api/admin/users/${member.id}`));
            }}
          >
            Remove
          </button>
        </>
      )}
      {err && <p className="w-full text-xs text-red-700">{err}</p>}
    </div>
  );
}
