import { useState } from "react";
import { useFetch } from "../../lib/useFetch";
import { api, ApiRequestError } from "../../lib/api";
import { useToast } from "../../lib/toast";
import { PageHeader, ErrorNote, LoadingTable, EmptyState } from "../../components/admin/ui";

/**
 * Outreach (Verto HQ): email marketing to Verto's own audience — shops, demo
 * leads, the makers waitlist. Pick a segment, brief the AI, edit the draft,
 * test it on yourself, send. Sends drain through a paced queue (Cloudflare
 * Email Sending), with one-click unsubscribe and a permanent suppression list.
 */

interface Segment {
  key: string;
  label: string;
  description: string;
  count: number;
}
interface BroadcastRow {
  id: string;
  subject: string;
  segment: string;
  status: string;
  recipient_count: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
  completed_at: string | null;
}
interface Overview {
  configured: boolean;
  maxPerHour: number;
  segments: Segment[];
  broadcasts: BroadcastRow[];
  suppressedCount: number;
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  queued: "Queued",
  sending: "Sending…",
  sent: "Sent",
  cancelled: "Cancelled",
};

export function OutreachPage() {
  const toast = useToast();
  const overview = useFetch<Overview>("/api/admin/platform/marketing");

  const [segment, setSegment] = useState("active_shops");
  const [brief, setBrief] = useState("");
  const [subject, setSubject] = useState("");
  const [preheader, setPreheader] = useState("");
  const [bodyMd, setBodyMd] = useState("");
  const [draftId, setDraftId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const seg = overview.data?.segments.find((s) => s.key === segment);

  async function draftWithAi() {
    if (brief.trim().length < 5) {
      toast.error("Give the AI a brief first", "A sentence or two about what this email should say.");
      return;
    }
    setBusy("draft");
    try {
      const d = await api.post<{ subject: string; preheader: string; body_md: string }>(
        "/api/admin/platform/marketing/draft",
        { brief, segment },
      );
      setSubject(d.subject);
      setPreheader(d.preheader);
      setBodyMd(d.body_md);
      setDraftId(null); // a fresh draft hasn't been saved yet
    } catch (err) {
      toast.error("Couldn't draft", err instanceof ApiRequestError ? err.message : undefined);
    } finally {
      setBusy(null);
    }
  }

  async function saveDraft(): Promise<string | null> {
    if (!subject.trim() || !bodyMd.trim()) {
      toast.error("Subject and body are needed first");
      return null;
    }
    const payload = { subject, preheader, body_md: bodyMd, segment };
    try {
      if (draftId) {
        await api.patch(`/api/admin/platform/marketing/broadcasts/${draftId}`, payload);
        return draftId;
      }
      const r = await api.post<{ id: string }>("/api/admin/platform/marketing/broadcasts", payload);
      setDraftId(r.id);
      overview.reload();
      return r.id;
    } catch (err) {
      toast.error("Couldn't save", err instanceof ApiRequestError ? err.message : undefined);
      return null;
    }
  }

  async function sendTest() {
    setBusy("test");
    const id = await saveDraft();
    if (id) {
      try {
        const r = await api.post<{ ok?: boolean; to?: string; error?: string }>(
          `/api/admin/platform/marketing/broadcasts/${id}/test`,
        );
        toast.success("Test sent", r.to ? `Check ${r.to} — that's exactly what recipients get.` : undefined);
      } catch (err) {
        toast.error("Test failed", err instanceof ApiRequestError ? err.message : undefined);
      }
    }
    setBusy(null);
  }

  async function sendReal() {
    const count = seg?.count ?? 0;
    if (!window.confirm(`Send "${subject}" to ${count} recipient${count === 1 ? "" : "s"} (${seg?.label})? Sends go out gradually through the queue.`)) return;
    setBusy("send");
    const id = await saveDraft();
    if (id) {
      try {
        const r = await api.post<{ queued: number }>(`/api/admin/platform/marketing/broadcasts/${id}/send`);
        toast.success(`Queued for ${r.queued} recipient${r.queued === 1 ? "" : "s"}`, "The queue drains every few minutes — watch the list below.");
        setSubject("");
        setPreheader("");
        setBodyMd("");
        setBrief("");
        setDraftId(null);
        overview.reload();
      } catch (err) {
        toast.error("Couldn't send", err instanceof ApiRequestError ? err.message : undefined);
      }
    }
    setBusy(null);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Outreach"
        description="Email your audience — shops, leads, and the makers waitlist — in Verto's voice."
      />

      {overview.error && <ErrorNote message={overview.error} />}
      {overview.loading && <LoadingTable rows={4} />}

      {overview.data && !overview.data.configured && (
        <div className="admin-card border-l-4 border-amber-500 p-4 text-sm">
          <p className="font-medium">Email sending isn't switched on yet.</p>
          <p className="mt-1 text-warmgrey">
            Onboard a sending domain to Cloudflare Email Sending, then set <code>MARKETING_EMAIL_FROM</code> (or{" "}
            <code>BUYER_EMAIL_FROM</code>) to an address on it. Drafting and the audience view work now; sending
            unlocks when that's set.
          </p>
        </div>
      )}

      {overview.data && (
        <div className="admin-card border-l-4 border-navy/30 p-4 text-xs text-warmgrey">
          Cloudflare's Email Sending is officially <strong>transactional-first</strong> (their marketing/bulk tooling
          is on their roadmap). Keep Outreach to account news and lifecycle notes to your own customers and opted-in
          leads — never cold lists. Sends pace out at up to {overview.data.maxPerHour}/hour;{" "}
          {overview.data.suppressedCount} address{overview.data.suppressedCount === 1 ? " is" : "es are"} on the
          never-email list.
        </div>
      )}

      {/* Audience segments */}
      {overview.data && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {overview.data.segments.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSegment(s.key)}
              className={`admin-card p-4 text-left transition ${segment === s.key ? "ring-2 ring-terracotta" : "hover:ring-1 hover:ring-navy/20"}`}
              title={s.description}
            >
              <p className="text-2xl font-light">{s.count}</p>
              <p className="mt-1 text-xs font-medium uppercase tracking-wider text-warmgrey">{s.label}</p>
            </button>
          ))}
        </div>
      )}

      {/* Composer */}
      <div className="admin-card space-y-4 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-warmgrey">
          New broadcast — to {seg ? `${seg.label} (${seg.count})` : "…"}
        </h2>
        <div className="flex gap-2">
          <input
            className="admin-input flex-1 text-sm"
            placeholder="Brief the AI — e.g. “Announce the new print lookbook feature, warm and short, link to the KB guide”"
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
          />
          <button type="button" className="btn btn-secondary whitespace-nowrap" onClick={draftWithAi} disabled={busy === "draft"}>
            {busy === "draft" ? "Drafting…" : "Draft with AI"}
          </button>
        </div>
        <input
          className="admin-input w-full text-sm"
          placeholder="Subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
        <input
          className="admin-input w-full text-sm"
          placeholder="Preheader (inbox preview line, optional)"
          value={preheader}
          onChange={(e) => setPreheader(e.target.value)}
        />
        <textarea
          className="admin-input min-h-[16rem] w-full font-mono text-sm"
          placeholder={"Body (markdown). Use {{name}} for the recipient's first name.\n\nHi {{name}},\n\n…"}
          value={bodyMd}
          onChange={(e) => setBodyMd(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn btn-secondary" onClick={sendTest} disabled={busy !== null || !subject}>
            {busy === "test" ? "Sending test…" : "Send me a test"}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={sendReal}
            disabled={busy !== null || !subject || !overview.data?.configured || (seg?.count ?? 0) === 0}
          >
            {busy === "send" ? "Queueing…" : `Send to ${seg?.count ?? 0}`}
          </button>
          <p className="text-xs text-warmgrey">
            Every email carries one-click unsubscribe; unsubscribes are honored instantly and permanently.
          </p>
        </div>
      </div>

      {/* Past broadcasts */}
      <div className="admin-card p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-warmgrey">Broadcasts</h2>
        {overview.data && overview.data.broadcasts.length === 0 && (
          <EmptyState title="Nothing sent yet" hint="Your first broadcast will show up here with live send counts." />
        )}
        {overview.data && overview.data.broadcasts.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-warmgrey">
                  <th className="pb-2 pr-4">Subject</th>
                  <th className="pb-2 pr-4">Segment</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 pr-4">Sent</th>
                  <th className="pb-2">Failed</th>
                </tr>
              </thead>
              <tbody>
                {overview.data.broadcasts.map((b) => (
                  <tr key={b.id} className="border-t border-navy/5">
                    <td className="py-2 pr-4">{b.subject}</td>
                    <td className="py-2 pr-4 text-warmgrey">{b.segment}</td>
                    <td className="py-2 pr-4">{STATUS_LABEL[b.status] ?? b.status}</td>
                    <td className="py-2 pr-4">
                      {b.sent_count}/{b.recipient_count}
                    </td>
                    <td className="py-2">{b.failed_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
