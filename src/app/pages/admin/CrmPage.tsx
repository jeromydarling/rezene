import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useSearchParams, useNavigate } from "react-router";
import {
  Activity,
  CalendarClock,
  Circle,
  Eye,
  Inbox,
  Mail,
  MapPin,
  MessageSquare,
  PartyPopper,
  Phone,
  Rocket,
  Sparkles,
  StickyNote,
  Store,
  Wand2,
} from "lucide-react";
import { api } from "../../lib/api";
import { useFetch } from "../../lib/useFetch";
import { formatDate } from "../../lib/format";
import { EmptyState, ErrorNote, LoadingTable, PageHeader, SlideOver, StatCard } from "../../components/admin/ui";
import { MapboxMap } from "../../components/MapboxMap";

/**
 * Verto HQ CRM — the founder's relationship desk. The timeline writes
 * itself (signups, demo tours, provisioning); this UI adds the human
 * layer: notes, follow-up promises, personal email, and an atlas of
 * everyone using the platform.
 */

interface ContactRow {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
  shop_id: string | null;
  shop_slug: string | null;
  shop_status: string | null;
  source: string;
  status: string;
  health: string | null;
  country: string | null;
  city: string | null;
  timezone: string | null;
  tags: string;
  last_touch_at: string | null;
  next_followup_at: string | null;
  created_at: string;
  open_tasks: number;
}

interface Overview {
  counts: { status: string; n: number }[];
  dueTasks: {
    id: string;
    title: string;
    due_at: string | null;
    contact_id: string;
    name: string | null;
    email: string;
    company: string | null;
    timezone: string | null;
  }[];
  recent: { id: string; kind: string; subject: string | null; created_at: string; contact_id: string; name: string | null; email: string; company: string | null }[];
  newThisWeek: number;
}

const STATUSES = ["lead", "trial", "active", "champion", "churn_risk", "churned"] as const;

const STATUS_TONES: Record<string, string> = {
  lead: "bg-ink/8 text-ink/70",
  trial: "bg-saffron/20 text-bark",
  active: "bg-palm/15 text-palm",
  champion: "bg-navy/10 text-navy",
  churn_risk: "bg-terracotta/15 text-terracotta",
  churned: "bg-ink/8 text-warmgrey",
};

const KIND_META: Record<string, { icon: typeof Mail; label: string }> = {
  signup: { icon: Sparkles, label: "Signed up" },
  provision: { icon: Rocket, label: "Shop provisioned" },
  demo_visit: { icon: Eye, label: "Demo tour" },
  email_out: { icon: Mail, label: "Email sent" },
  email_in: { icon: Inbox, label: "Email received" },
  milestone: { icon: PartyPopper, label: "Milestone" },
  note: { icon: StickyNote, label: "Note" },
  call: { icon: Phone, label: "Call" },
  meeting: { icon: CalendarClock, label: "Meeting" },
  support: { icon: MessageSquare, label: "Support" },
};

const HEALTH_META: Record<string, { dot: string; label: string }> = {
  healthy: { dot: "bg-palm", label: "healthy — active in their shop this week" },
  cooling: { dot: "bg-saffron", label: "cooling — quiet for 1–3 weeks" },
  at_risk: { dot: "bg-terracotta", label: "at risk — shop quiet for 3+ weeks" },
  unknown: { dot: "bg-ink/20", label: "no shop activity data yet" },
};

function HealthDot({ health }: { health: string | null }) {
  if (!health) return null;
  const meta = HEALTH_META[health] ?? HEALTH_META.unknown;
  return <span title={meta.label} className={`inline-block h-2 w-2 shrink-0 rounded-full ${meta.dot}`} />;
}

function StatusPill({ status }: { status: string }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide ${STATUS_TONES[status] ?? STATUS_TONES.lead}`}>
      {status.replace("_", " ")}
    </span>
  );
}

/** "14:32 their time" — the little detail that keeps outreach human. */
function localTime(timezone: string | null): string | null {
  if (!timezone) return null;
  try {
    return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: timezone }).format(new Date());
  } catch {
    return null;
  }
}

export function CrmPage() {
  const [params, setParams] = useSearchParams();
  const openId = params.get("open");
  const [status, setStatus] = useState<string>("");
  const [q, setQ] = useState("");
  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (status) p.set("status", status);
    if (q.trim()) p.set("q", q.trim());
    const s = p.toString();
    return s ? `?${s}` : "";
  }, [status, q]);

  const overview = useFetch<Overview>("/api/admin/crm/overview");
  const contacts = useFetch<ContactRow[]>(`/api/admin/crm/contacts${query}`);

  const setOpen = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set("open", id);
    else next.delete("open");
    setParams(next, { replace: true });
  };

  async function completeTask(id: string) {
    await api.patch(`/api/admin/crm/tasks/${id}`, { done: true });
    overview.reload();
  }

  const statusCount = (s: string) => overview.data?.counts.find((c) => c.status === s)?.n ?? 0;

  return (
    <div>
      <PageHeader
        eyebrow="Verto HQ"
        title="Customers"
        description="Every label on the platform, with the whole story in one place — signups, demo tours, notes, follow-ups. The timeline writes itself; you add the human part."
        actions={
          <>
            <Link to="/admin/crm/atlas" className="btn btn-secondary">
              <MapPin size={14} className="mr-1.5 inline" />
              Atlas
            </Link>
            <AddContactButton onAdded={(id) => { contacts.reload(); setOpen(id); }} />
          </>
        }
      />

      {/* Pulse row */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Trials" value={String(statusCount("trial"))} />
        <StatCard label="Active" value={String(statusCount("active") + statusCount("champion"))} />
        <StatCard label="Leads" value={String(statusCount("lead"))} />
        <StatCard label="At risk" value={String(statusCount("churn_risk"))} />
        <StatCard label="New this week" value={String(overview.data?.newThisWeek ?? 0)} />
      </div>

      {/* Follow-ups: promises first, always */}
      {overview.data && overview.data.dueTasks.length > 0 && (
        <div className="admin-card mb-6 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-warmgrey">
            Follow-ups due — {overview.data.dueTasks.length}
          </p>
          <ul className="space-y-1.5">
            {overview.data.dueTasks.slice(0, 8).map((t) => {
              const lt = localTime(t.timezone);
              return (
                <li key={t.id} className="flex items-center gap-2 text-sm">
                  <button type="button" aria-label="Mark done" onClick={() => void completeTask(t.id)} className="text-warmgrey hover:text-palm">
                    <Circle size={15} />
                  </button>
                  <button type="button" className="min-w-0 flex-1 truncate text-left hover:underline" onClick={() => setOpen(t.contact_id)}>
                    {t.title}
                  </button>
                  {lt && <span className="hidden shrink-0 text-xs text-warmgrey sm:inline">{lt} their time</span>}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Contact list */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          className="input !w-64 !py-1.5 text-sm"
          placeholder="Search name, email, label, city…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="input !w-auto !py-1.5 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s.replace("_", " ")}</option>
          ))}
        </select>
      </div>

      {contacts.error && <ErrorNote message={contacts.error} />}
      {contacts.loading && <LoadingTable />}
      {contacts.data && contacts.data.length === 0 && (
        <EmptyState title="Nobody here yet" hint="Signups, demo tours, and leads appear automatically." />
      )}
      {contacts.data && contacts.data.length > 0 && (
        <div className="admin-card overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Contact</th>
                <th>Label</th>
                <th>Status</th>
                <th>Where</th>
                <th>Last touch</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {contacts.data.map((ct) => {
                const lt = localTime(ct.timezone);
                return (
                  <tr key={ct.id} className="cursor-pointer" onClick={() => setOpen(ct.id)}>
                    <td>
                      <p className="font-medium">{ct.name ?? ct.email}</p>
                      {ct.name && <p className="text-xs text-warmgrey">{ct.email}</p>}
                    </td>
                    <td>
                      {ct.company ?? "—"}
                      {ct.shop_slug && (
                        <span className="ml-1.5 inline-flex items-center gap-1 text-xs text-navy">
                          <Store size={11} />/{ct.shop_slug}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className="inline-flex items-center gap-1.5">
                        <HealthDot health={ct.health} />
                        <StatusPill status={ct.status} />
                      </span>
                    </td>
                    <td className="text-sm text-ink/70">
                      {[ct.city, ct.country].filter(Boolean).join(", ") || "—"}
                      {lt && <span className="block text-xs text-warmgrey">{lt} local</span>}
                    </td>
                    <td className="text-sm text-warmgrey">{ct.last_touch_at ? formatDate(ct.last_touch_at) : "never"}</td>
                    <td className="text-right text-xs text-warmgrey">
                      {ct.open_tasks > 0 && <span className="rounded-full bg-terracotta/15 px-2 py-0.5 font-semibold text-terracotta">{ct.open_tasks}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {openId && <ContactDrawer id={openId} onClose={() => { setOpen(null); contacts.reload(); overview.reload(); }} />}
    </div>
  );
}

function AddContactButton({ onAdded }: { onAdded: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.post<{ id: string }>("/api/admin/crm/contacts", {
        email,
        name: name || undefined,
        company: company || undefined,
      });
      setOpen(false);
      setEmail(""); setName(""); setCompany("");
      onAdded(res.id);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
        Add contact
      </button>
      {open && (
        <SlideOver open title="New contact" onClose={() => setOpen(false)}>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="label">Name</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="label">Label / company</label>
              <input className="input" value={company} onChange={(e) => setCompany(e.target.value)} />
            </div>
            <button type="submit" disabled={busy} className="btn btn-primary w-full">
              {busy ? "Saving…" : "Add contact"}
            </button>
          </form>
        </SlideOver>
      )}
    </>
  );
}

// ---------- Contact drawer: the whole relationship on one panel ----------
interface ContactDetail {
  contact: ContactRow & {
    notes_md: string | null;
    latitude: number | null;
    longitude: number | null;
    shop_plan: string | null;
    last_shop_login_at: string | null;
    last_shop_order_at: string | null;
    last_shop_publish_at: string | null;
    shop_orders_total: number | null;
    shop_orders_30d: number | null;
  };
  interactions: { id: string; kind: string; subject: string | null; body_md: string | null; created_by: string | null; created_at: string }[];
  tasks: { id: string; title: string; due_at: string | null; done_at: string | null }[];
}

function ContactDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const detail = useFetch<ContactDetail>(`/api/admin/crm/contacts/${id}`);
  const ct = detail.data?.contact;
  const [tab, setTab] = useState<"note" | "email" | "task">("note");
  const [notes, setNotes] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState(false);

  useEffect(() => {
    setNotes(null);
    setSavedNote(false);
  }, [id]);

  async function patch(body: Record<string, unknown>) {
    await api.patch(`/api/admin/crm/contacts/${id}`, body);
    detail.reload();
  }

  const lt = ct ? localTime(ct.timezone) : null;
  const tags: string[] = ct ? (JSON.parse(ct.tags || "[]") as string[]) : [];

  return (
    <SlideOver open title={ct ? (ct.name ?? ct.email) : "…"} onClose={onClose}>
      {detail.error && <ErrorNote message={detail.error} />}
      {!ct ? (
        <LoadingTable rows={3} />
      ) : (
        <div className="space-y-5">
          {/* Identity */}
          <div className="rounded bg-cream/70 p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={ct.status} />
              <span className="text-xs uppercase tracking-wide text-warmgrey">via {ct.source}</span>
              {ct.shop_slug && (
                <a href={`/${ct.shop_slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-navy underline">
                  <Store size={11} />/{ct.shop_slug}
                </a>
              )}
            </div>
            <p className="mt-2">{ct.email}</p>
            {ct.company && <p className="text-ink/70">{ct.company}</p>}
            <p className="mt-1 flex items-center gap-1 text-xs text-warmgrey">
              <MapPin size={11} />
              {[ct.city, ct.country].filter(Boolean).join(", ") || "location unknown"}
              {lt && <span>· {lt} their time</span>}
            </p>
          </div>

          {/* Shop pulse: their activity, not our outreach */}
          {ct.shop_slug && (
            <div className="rounded border border-ink/10 p-3 text-sm">
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-warmgrey">
                <Activity size={12} />
                Shop pulse
                <HealthDot health={ct.health} />
                {ct.health && <span className="font-normal normal-case">{(HEALTH_META[ct.health] ?? HEALTH_META.unknown).label}</span>}
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-ink/75">
                <span>Last admin login</span>
                <span className="text-right">{ct.last_shop_login_at ? formatDate(ct.last_shop_login_at) : "—"}</span>
                <span>Last paid order</span>
                <span className="text-right">{ct.last_shop_order_at ? formatDate(ct.last_shop_order_at) : "—"}</span>
                <span>Last content publish</span>
                <span className="text-right">{ct.last_shop_publish_at ? formatDate(ct.last_shop_publish_at) : "—"}</span>
                <span>Paid orders (total · 30d)</span>
                <span className="text-right">
                  {ct.shop_orders_total ?? 0} · {ct.shop_orders_30d ?? 0}
                </span>
              </div>
            </div>
          )}

          {/* Status + follow-up promise */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Status</label>
              <select className="input !py-1.5 text-sm" value={ct.status} onChange={(e) => void patch({ status: e.target.value })}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s.replace("_", " ")}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Follow up on</label>
              <input
                type="date"
                className="input !py-1.5 text-sm"
                defaultValue={ct.next_followup_at?.slice(0, 10) ?? ""}
                onBlur={(e) => void patch({ nextFollowupAt: e.target.value ? `${e.target.value} 09:00:00` : null })}
              />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="label">Tags</label>
            <input
              className="input !py-1.5 text-sm"
              defaultValue={tags.join(", ")}
              placeholder="wholesale-curious, met-at-première-vision…"
              onBlur={(e) => void patch({ tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })}
            />
          </div>

          {/* Human notes */}
          <div>
            <div className="flex items-baseline justify-between">
              <label className="label">Notes</label>
              {savedNote && <span className="text-xs text-palm">saved ✓</span>}
            </div>
            <textarea
              className="input min-h-24 text-sm"
              placeholder="Context you'd want on a call: their story, what they're worried about, kids' names…"
              value={notes ?? ct.notes_md ?? ""}
              onChange={(e) => { setNotes(e.target.value); setSavedNote(false); }}
              onBlur={() => { if (notes !== null && notes !== ct.notes_md) void patch({ notesMd: notes }).then(() => setSavedNote(true)); }}
            />
          </div>

          {/* Composer */}
          <div className="admin-card p-3">
            <div className="mb-2 flex gap-1.5">
              {(["note", "email", "task"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`rounded px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${tab === t ? "bg-navy text-chalk" : "bg-ink/5 text-ink/60 hover:bg-ink/10"}`}
                  onClick={() => setTab(t)}
                >
                  {t === "note" ? "Log touch" : t === "email" ? "Send email" : "Add task"}
                </button>
              ))}
            </div>
            {tab === "note" && <NoteComposer contactId={id} onDone={() => detail.reload()} />}
            {tab === "email" && <EmailComposer contactId={id} email={ct.email} onDone={() => detail.reload()} />}
            {tab === "task" && <TaskComposer contactId={id} onDone={() => detail.reload()} />}
          </div>

          {/* Open tasks */}
          {detail.data && detail.data.tasks.some((t) => !t.done_at) && (
            <div>
              <p className="label">Open follow-ups</p>
              <ul className="space-y-1">
                {detail.data.tasks.filter((t) => !t.done_at).map((t) => (
                  <li key={t.id} className="flex items-center gap-2 text-sm">
                    <button
                      type="button"
                      aria-label="Mark done"
                      className="text-warmgrey hover:text-palm"
                      onClick={() => void api.patch(`/api/admin/crm/tasks/${t.id}`, { done: true }).then(() => detail.reload())}
                    >
                      <Circle size={14} />
                    </button>
                    <span className="min-w-0 flex-1">{t.title}</span>
                    {t.due_at && <span className="text-xs text-warmgrey">{formatDate(t.due_at)}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Timeline */}
          <div>
            <p className="label">Timeline</p>
            <ul className="space-y-3">
              {detail.data!.interactions.map((ix) => {
                const meta = KIND_META[ix.kind] ?? KIND_META.note;
                const Icon = meta.icon;
                return (
                  <li key={ix.id} className="flex gap-2.5">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy/8 text-navy">
                      <Icon size={12} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm">
                        <span className="font-medium">{meta.label}</span>
                        {ix.subject && <span className="text-ink/80"> — {ix.subject}</span>}
                      </p>
                      {ix.body_md && <p className="mt-0.5 whitespace-pre-wrap text-xs text-ink/70">{ix.body_md}</p>}
                      <p className="mt-0.5 text-xs text-warmgrey">
                        {formatDate(ix.created_at)}
                        {!ix.created_by && " · automatic"}
                      </p>
                    </div>
                  </li>
                );
              })}
              {detail.data!.interactions.length === 0 && (
                <li className="text-sm text-warmgrey">No touches yet — log the first one above.</li>
              )}
            </ul>
          </div>
        </div>
      )}
    </SlideOver>
  );
}

function NoteComposer({ contactId, onDone }: { contactId: string; onDone: () => void }) {
  const [kind, setKind] = useState<"note" | "call" | "meeting" | "support">("note");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post(`/api/admin/crm/contacts/${contactId}/interactions`, {
        kind,
        subject: subject || undefined,
        bodyMd: body || undefined,
      });
      setSubject(""); setBody("");
      onDone();
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="flex gap-2">
        <select className="input !w-auto !py-1.5 text-sm" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
          <option value="note">Note</option>
          <option value="call">Call</option>
          <option value="meeting">Meeting</option>
          <option value="support">Support</option>
        </select>
        <input className="input !py-1.5 text-sm" placeholder="Subject (optional)" value={subject} onChange={(e) => setSubject(e.target.value)} />
      </div>
      <textarea className="input min-h-16 text-sm" placeholder="What happened?" value={body} onChange={(e) => setBody(e.target.value)} />
      <button type="submit" disabled={busy || (!subject && !body)} className="btn btn-primary w-full !py-2">
        {busy ? "Logging…" : "Log it"}
      </button>
    </form>
  );
}

function EmailComposer({ contactId, email, onDone }: { contactId: string; email: string; onDone: () => void }) {
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const res = await api.post<{ sent: boolean }>(`/api/admin/crm/contacts/${contactId}/email`, { subject, text });
      setResult(res.sent ? `Sent to ${email}` : "Logged — email sending isn't configured, so it was recorded but not delivered");
      setSubject(""); setText("");
      onDone();
    } finally {
      setBusy(false);
    }
  }
  async function draft() {
    setDrafting(true);
    setResult(null);
    try {
      const res = await api.post<{ subject: string; body: string }>(`/api/admin/crm/contacts/${contactId}/draft-checkin`);
      setSubject(res.subject);
      setText(res.body);
    } catch {
      setResult("LLM drafting is unavailable right now — write it by hand");
    } finally {
      setDrafting(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-warmgrey">To: {email} — plain text, from you. No templates, no tracking pixels.</p>
        <button
          type="button"
          disabled={drafting}
          onClick={() => void draft()}
          className="inline-flex shrink-0 items-center gap-1 rounded bg-navy/8 px-2 py-1 text-xs font-medium text-navy hover:bg-navy/15"
        >
          <Wand2 size={12} />
          {drafting ? "Drafting…" : "Draft check-in"}
        </button>
      </div>
      <input className="input !py-1.5 text-sm" required placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
      <textarea className="input min-h-24 text-sm" required placeholder="Write like a person…" value={text} onChange={(e) => setText(e.target.value)} />
      {result && <p className="text-xs text-palm">{result}</p>}
      <button type="submit" disabled={busy} className="btn btn-primary w-full !py-2">
        {busy ? "Sending…" : "Send email"}
      </button>
    </form>
  );
}

function TaskComposer({ contactId, onDone }: { contactId: string; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post(`/api/admin/crm/contacts/${contactId}/tasks`, {
        title,
        dueAt: due ? `${due} 09:00:00` : undefined,
      });
      setTitle(""); setDue("");
      onDone();
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-2">
      <input className="input !py-1.5 text-sm" required placeholder="Follow-up…" value={title} onChange={(e) => setTitle(e.target.value)} />
      <input type="date" className="input !py-1.5 text-sm" value={due} onChange={(e) => setDue(e.target.value)} />
      <button type="submit" disabled={busy} className="btn btn-primary w-full !py-2">
        {busy ? "Adding…" : "Add follow-up"}
      </button>
    </form>
  );
}

// ---------- Atlas: customers on the world ----------
interface AtlasContact {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
  status: string;
  source: string;
  city: string | null;
  country: string | null;
  latitude: number;
  longitude: number;
  timezone: string | null;
  shop_slug: string | null;
}

const DOT_COLORS: Record<string, string> = {
  active: "#4a7c59",
  champion: "#4a7c59",
  trial: "#d9a441",
  lead: "#8b8578",
  churn_risk: "#c06e52",
  churned: "#8b8578",
};

export function CrmAtlasPage() {
  const navigate = useNavigate();
  const { data, loading, error } = useFetch<AtlasContact[]>("/api/admin/crm/atlas");

  const byCountry = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of data ?? []) map.set(c.country ?? "??", (map.get(c.country ?? "??") ?? 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [data]);

  return (
    <div>
      <PageHeader
        eyebrow="Verto HQ"
        title="Atlas"
        description="Everyone building on Verto, on the map — locations captured at the edge when they sign up or tour the demo. Hover a dot; click through to the relationship."
        actions={
          <Link to="/admin/crm" className="btn btn-secondary">
            ← Customers
          </Link>
        }
      />
      {error && <ErrorNote message={error} />}
      {loading && <LoadingTable rows={3} />}
      {data && (
        <>
          {/* The real world, not a projection: Mapbox with the house style.
              Clicking a pin opens the relationship in the CRM. */}
          <MapboxMap
            className="h-[520px]"
            markers={data.map((c) => ({
              id: c.id,
              lng: c.longitude,
              lat: c.latitude,
              color: DOT_COLORS[c.status] ?? DOT_COLORS.lead,
              label: c.name ?? c.email,
              sublabel: [
                c.company,
                [c.city, c.country].filter(Boolean).join(", "),
                localTime(c.timezone) ? `${localTime(c.timezone)} local` : null,
              ]
                .filter(Boolean)
                .join(" · "),
            }))}
            onMarkerClick={(id) => navigate(`/admin/crm?open=${id}`)}
          />
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <div className="flex flex-wrap gap-3 text-xs text-ink/70">
              {[["active / champion", DOT_COLORS.active], ["trial", DOT_COLORS.trial], ["lead / demo", DOT_COLORS.lead], ["at risk", DOT_COLORS.churn_risk]].map(([label, color]) => (
                <span key={label} className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                  {label}
                </span>
              ))}
            </div>
            <div className="ml-auto flex flex-wrap gap-2 text-xs text-warmgrey">
              {byCountry.map(([cc, n]) => (
                <span key={cc} className="rounded-full bg-ink/5 px-2 py-0.5">{cc} · {n}</span>
              ))}
            </div>
          </div>
          {data.length === 0 && (
            <EmptyState
              title="No locations yet"
              hint="Locations are captured automatically when someone signs up or tours the demo (Cloudflare edge geo). You can also set city/country on any contact."
            />
          )}
        </>
      )}
    </div>
  );
}
