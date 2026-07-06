import { useCallback, useState } from "react";
import { useFetch } from "../../lib/useFetch";
import { api } from "../../lib/api";
import { formatDate } from "../../lib/format";
import { EmptyState, ErrorNote, LoadingTable, PageHeader, StatusBadge } from "../../components/admin/ui";

/**
 * Verto HQ — support queue. Every shop's bug reports and feature requests land
 * here (SuperAdmin only). Triage, note, and close them out.
 */

interface Ticket {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  severity: string | null;
  status: string;
  shop_name: string | null;
  shop_slug: string | null;
  reporter_email: string | null;
  page_path: string | null;
  admin_note: string | null;
  created_at: string;
}
interface FeedbackResponse {
  tickets: Ticket[];
  counts: Record<string, number>;
}

const STATUSES = ["open", "in_progress", "resolved", "closed", "wont_fix"];
const KIND_ICON: Record<string, string> = { bug: "🐞", feature: "✨", question: "❓" };

export function FeedbackInboxPage() {
  const [filter, setFilter] = useState<string>("");
  const { data, loading, error, reload } = useFetch<FeedbackResponse>(
    `/api/admin/feedback${filter ? `?status=${filter}` : ""}`,
  );

  return (
    <div>
      <PageHeader
        eyebrow="Verto HQ"
        title="Support tickets"
        description="Bugs and feature requests from every shop on Verto."
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <FilterChip label="All" active={filter === ""} onClick={() => setFilter("")} count={undefined} />
        {STATUSES.map((s) => (
          <FilterChip key={s} label={s.replace("_", " ")} active={filter === s} onClick={() => setFilter(s)} count={data?.counts?.[s]} />
        ))}
      </div>

      {loading && <LoadingTable />}
      {error && <ErrorNote message={error} />}
      {data && data.tickets.length === 0 && <EmptyState title="Nothing here" hint="No tickets match this filter." />}
      {data && data.tickets.length > 0 && (
        <div className="space-y-2">
          {data.tickets.map((t) => (
            <TicketRow key={t.id} ticket={t} onChanged={reload} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({ label, active, onClick, count }: { label: string; active: boolean; onClick: () => void; count?: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs capitalize transition ${
        active ? "border-navy bg-navy text-chalk" : "border-ink/15 text-ink/70 hover:border-ink/40"
      }`}
    >
      {label}
      {count !== undefined && count > 0 && <span className="ml-1 opacity-70">({count})</span>}
    </button>
  );
}

function TicketRow({ ticket, onChanged }: { ticket: Ticket; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(ticket.admin_note ?? "");
  const [busy, setBusy] = useState(false);

  const update = useCallback(
    async (patch: Record<string, unknown>) => {
      setBusy(true);
      try {
        await api.patch(`/api/admin/feedback/${ticket.id}`, patch);
        await onChanged();
      } finally {
        setBusy(false);
      }
    },
    [ticket.id, onChanged],
  );

  return (
    <div className="admin-card p-0">
      <button
        type="button"
        className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-cream"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <span>{KIND_ICON[ticket.kind] ?? "•"}</span>
            <span className="truncate text-sm font-medium">{ticket.title}</span>
            {ticket.severity && ticket.kind === "bug" && <StatusBadge status={ticket.severity} />}
          </span>
          <span className="mt-0.5 block text-xs text-warmgrey">
            {ticket.shop_name ?? ticket.shop_slug ?? "unknown shop"}
            {ticket.reporter_email ? ` · ${ticket.reporter_email}` : ""} · {formatDate(ticket.created_at)}
          </span>
        </span>
        <StatusBadge status={ticket.status} />
      </button>

      {open && (
        <div className="space-y-3 border-t border-ink/10 px-4 py-3">
          {ticket.body && <p className="whitespace-pre-wrap text-sm text-ink/80">{ticket.body}</p>}
          {ticket.page_path && <p className="text-xs text-warmgrey">Reported from: {ticket.page_path}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-warmgrey">Status:</span>
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                disabled={busy || ticket.status === s}
                onClick={() => void update({ status: s })}
                className={`rounded-full border px-2.5 py-1 text-xs capitalize transition disabled:opacity-40 ${
                  ticket.status === s ? "border-navy bg-navy text-chalk" : "border-ink/15 hover:border-ink/40"
                }`}
              >
                {s.replace("_", " ")}
              </button>
            ))}
          </div>
          <div className="flex items-end gap-2">
            <label className="flex-1">
              <span className="mb-1 block text-xs text-warmgrey">Internal note</span>
              <input className="input !text-sm" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Triage note…" />
            </label>
            <button type="button" className="btn btn-secondary !py-2 text-xs" disabled={busy} onClick={() => void update({ adminNote: note })}>
              Save note
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
