import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useFetch } from "../../lib/useFetch";
import { api } from "../../lib/api";
import { emitToast } from "../../lib/toast";
import { formatDate, formatMoney } from "../../lib/format";
import {
  EmptyState,
  ErrorNote,
  LoadingTable,
  PageHeader,
  StatusBadge,
} from "../../components/admin/ui";
import { MessageDecoder } from "../../components/MessageDecoder";

/**
 * The Client Book — the people behind the patterns. Each client keeps a
 * dated measurement history, style notes, a timeline of fittings and
 * conversations, and links to their saved patterns and model photos.
 */

interface BookingRequest {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  note: string | null;
  preferredAt: string | null;
  status: string;
  clientId: string | null;
  createdAt: string;
}

interface ClientSummary {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  measurementCount: number;
  lookCount: number;
  modelCount: number;
  lastEventAt: string | null;
  updatedAt: string;
}

interface MeasurementSet {
  id: string;
  takenAt: string;
  measurements: Record<string, number | string>;
  note: string | null;
}

interface ClientEvent {
  id: string;
  kind: string;
  subject: string | null;
  body: string | null;
  eventAt: string;
}

interface CommissionPayment {
  id: string;
  label: string;
  amountCents: number;
  status: string;
  paidAt: string | null;
}

interface Commission {
  id: string;
  title: string;
  kind: string;
  stage: string;
  dueAt: string | null;
  priceCents: number | null;
  updatedAt: string;
  payments: CommissionPayment[];
}

interface ClientDetail {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  styleNotes: string | null;
  status: string;
  measurements: MeasurementSet[];
  events: ClientEvent[];
  commissions: Commission[];
  looks: { id: string; name: string; garmentId: string; styleId: string | null; updatedAt: string }[];
  models: { id: string; label: string; fileId: string; source: string; createdAt: string }[];
  customer: { id: string; email: string; name: string | null } | null;
}

export function ClientBookPage() {
  const { data, loading, error, reload } = useFetch<ClientSummary[]>("/api/admin/clients");
  const bookings = useFetch<BookingRequest[]>("/api/admin/bookings");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const navigate = useNavigate();

  async function createClient(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const created = await api.post<{ id: string }>("/api/admin/clients", {
        name: name.trim(),
        email: email.trim() || null,
      });
      navigate(`/admin/clients/${created.id}`);
    } finally {
      setBusy(false);
    }
  }

  async function adoptExisting() {
    setBusy(true);
    try {
      const r = await api.post<{ created: number; linked: number }>("/api/admin/clients/adopt-existing", {});
      setNote(
        r.linked
          ? `Adopted ${r.linked} saved pattern${r.linked === 1 ? "" : "s"} — ${r.created} new client${r.created === 1 ? "" : "s"} created.`
          : "No unlinked made-to-measure patterns found to adopt.",
      );
      reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Clients"
        title="Client Book"
        help="client-book"
        description="The people you sew and style for — measurement history, style notes, fittings, and every pattern and photo that belongs to them."
      />
      <div className="mb-4 flex justify-end">
        <MessageDecoder defaultKind="client" />
      </div>
      {error && <ErrorNote message={error} />}
      <form onSubmit={createClient} className="admin-card mb-4 flex flex-wrap items-end gap-3 p-4">
        <label className="flex flex-col text-sm">
          <span className="mb-1 text-xs text-warmgrey">Name</span>
          <input className="admin-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Maya Okafor" />
        </label>
        <label className="flex flex-col text-sm">
          <span className="mb-1 text-xs text-warmgrey">Email (optional)</span>
          <input className="admin-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="maya@example.com" />
        </label>
        <button className="admin-btn-primary" disabled={!name.trim() || busy}>
          Add client
        </button>
        <button type="button" className="admin-btn" disabled={busy} onClick={adoptExisting}
          title="Create clients from saved made-to-measure patterns that aren't linked to anyone yet">
          Adopt existing patterns
        </button>
      </form>
      {note && <p className="mb-4 text-sm text-warmgrey">{note}</p>}
      {(bookings.data ?? []).some((b) => b.status === "new") && (
        <section className="admin-card mb-4 p-4">
          <h2 className="mb-2 font-medium">Consult requests</h2>
          <p className="mb-2 text-xs text-warmgrey">
            From your public “Book a consult” page (/book). Confirming creates or matches a client and puts the
            consult on their timeline.
          </p>
          <ul className="space-y-2">
            {(bookings.data ?? [])
              .filter((b) => b.status === "new")
              .map((b) => (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-black/5 p-3 text-sm">
                  <span>
                    <span className="font-medium">{b.name}</span>{" "}
                    <span className="text-xs text-warmgrey">
                      {[b.email, b.phone, b.preferredAt].filter(Boolean).join(" · ")}
                    </span>
                    {b.note && <span className="block text-xs text-warmgrey">{b.note}</span>}
                  </span>
                  <span className="flex gap-2">
                    <button
                      className="admin-btn"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          const r = await api.post<{ clientId: string }>(`/api/admin/bookings/${b.id}/confirm`, {});
                          navigate(`/admin/clients/${r.clientId}`);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      Confirm
                    </button>
                    <button
                      className="admin-btn text-red-700"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await api.post(`/api/admin/bookings/${b.id}/decline`, {});
                          bookings.reload();
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      Decline
                    </button>
                  </span>
                </li>
              ))}
          </ul>
        </section>
      )}
      {loading && <LoadingTable />}
      {data && data.length === 0 && (
        <EmptyState
          title="No clients yet"
          hint="Add your first client above — or press “Adopt existing patterns” to build the book from the made-to-measure patterns you've already saved."
        />
      )}
      {data && data.length > 0 && (
        <div className="admin-card overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Contact</th>
                <th>Measurement sets</th>
                <th>Patterns</th>
                <th>Photos</th>
                <th>Last activity</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.map((cl) => (
                <tr key={cl.id}>
                  <td className="font-medium">
                    <Link to={`/admin/clients/${cl.id}`} className="hover:underline">
                      {cl.name}
                    </Link>
                  </td>
                  <td className="text-xs text-warmgrey">{cl.email ?? cl.phone ?? "—"}</td>
                  <td>{cl.measurementCount}</td>
                  <td>{cl.lookCount}</td>
                  <td>{cl.modelCount}</td>
                  <td className="text-xs text-warmgrey">
                    {cl.lastEventAt ? formatDate(cl.lastEventAt) : formatDate(cl.updatedAt)}
                  </td>
                  <td>
                    <StatusBadge status={cl.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** The measurement fields a fitting most often records, in cm. Keys match
 *  the Pattern Studio's made-to-measure conventions so a set loads straight
 *  into a draft. Anything else arrives via “Adopt existing patterns”. */
const MEASUREMENT_FIELDS: [string, string][] = [
  ["chestCm", "Chest"],
  ["waistCm", "Waist"],
  ["hipsCm", "Hips"],
  ["heightCm", "Height"],
  ["neckCm", "Neck"],
  ["shoulderToShoulderCm", "Shoulder to shoulder"],
  ["shoulderToWristCm", "Shoulder to wrist"],
  ["bicepsCm", "Biceps"],
  ["wristCm", "Wrist"],
  ["seatCm", "Seat"],
  ["inseamCm", "Inseam"],
  ["waistToFloorCm", "Waist to floor"],
];

const EVENT_KINDS = ["note", "consult", "fitting", "delivery", "occasion"] as const;

function labelFor(key: string): string {
  const known = MEASUREMENT_FIELDS.find(([k]) => k === key);
  if (known) return known[1];
  return key.replace(/Cm$/, "").replace(/([A-Z])/g, " $1").toLowerCase().replace(/^./, (ch) => ch.toUpperCase());
}

export function ClientDetailPage() {
  const { id } = useParams();
  const { data, loading, error, reload } = useFetch<ClientDetail>(id ? `/api/admin/clients/${id}` : null);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  // Style notes edit
  const [notesDraft, setNotesDraft] = useState<string | null>(null);
  // New measurement set
  const [measDraft, setMeasDraft] = useState<Record<string, string>>({});
  const [measNote, setMeasNote] = useState("");
  const [photoFront, setPhotoFront] = useState<File | null>(null);
  const [photoSide, setPhotoSide] = useState<File | null>(null);
  const [estimating, setEstimating] = useState(false);

  // Photos → an ESTIMATED measurement set. Honest framing throughout: it
  // prefills the form as a draft the tape must confirm — never saves itself.
  async function estimateFromPhotos() {
    const heightCm = parseFloat(measDraft.heightCm ?? "");
    if (!photoFront || !Number.isFinite(heightCm)) return;
    setEstimating(true);
    try {
      const toDataUrl = (file: File) =>
        new Promise<string>((resolve, reject) => {
          const img = new Image();
          const url = URL.createObjectURL(file);
          img.onload = () => {
            const scale = Math.min(1, 1000 / Math.max(img.width, img.height));
            const canvas = document.createElement("canvas");
            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);
            canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(url);
            resolve(canvas.toDataURL("image/jpeg", 0.85));
          };
          img.onerror = reject;
          img.src = url;
        });
      const front = await toDataUrl(photoFront);
      const side = photoSide ? await toDataUrl(photoSide) : undefined;
      const res = await api.post<{ measurements: Record<string, number>; confidence: string; caveats: string }>(
        "/api/admin/assist/measure-photos",
        { front, side, heightCm },
      );
      setMeasDraft((d) => {
        const next = { ...d };
        for (const [k, v] of Object.entries(res.measurements)) next[k] = String(v);
        return next;
      });
      setMeasNote(
        `AI estimate from photos (${res.confidence} confidence) — verify with the tape at the fitting.${res.caveats ? ` ${res.caveats}` : ""}`,
      );
    } catch (err) {
      emitToast({
        kind: "error",
        message: err instanceof Error && err.message ? err.message : "Couldn't estimate from those photos.",
      });
    } finally {
      setEstimating(false);
    }
  }
  const [showMeasForm, setShowMeasForm] = useState(false);
  // New timeline entry
  const [evKind, setEvKind] = useState<(typeof EVENT_KINDS)[number]>("note");
  const [evSubject, setEvSubject] = useState("");
  const [evBody, setEvBody] = useState("");
  // New commission
  const [showCommForm, setShowCommForm] = useState(false);
  const [commTitle, setCommTitle] = useState("");
  const [commKind, setCommKind] = useState<"commission" | "alteration">("commission");
  const [commDue, setCommDue] = useState("");
  const [commPrice, setCommPrice] = useState("");
  // Per-commission fitting note drafts, keyed by commission id
  const [fitDraft, setFitDraft] = useState<Record<string, string>>({});
  // Per-commission payment drafts: "label|amount"
  const [payDraft, setPayDraft] = useState<Record<string, { label: string; amount: string }>>({});
  const [portalNote, setPortalNote] = useState<string | null>(null);

  const unlinkedLooks = useFetch<{ id: string; name: string; clientId: string | null }[]>(
    "/api/admin/fitting/looks",
  );
  const linkableLooks = useMemo(
    () => (unlinkedLooks.data ?? []).filter((l) => !l.clientId),
    [unlinkedLooks.data],
  );
  const allModels = useFetch<{ id: string; label: string; source: string; clientId: string | null }[]>(
    "/api/admin/fitting/models",
  );
  const linkableModels = useMemo(
    () => (allModels.data ?? []).filter((m) => m.source === "uploaded" && !m.clientId),
    [allModels.data],
  );

  if (loading) return <LoadingTable />;
  if (error) return <ErrorNote message={error} />;
  if (!data || !id) return null;

  const wrap = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      reload();
    } finally {
      setBusy(false);
    }
  };

  async function saveNotes() {
    await wrap(() => api.put(`/api/admin/clients/${id}`, { styleNotes: notesDraft }));
    setNotesDraft(null);
  }

  async function addMeasurements(e: FormEvent) {
    e.preventDefault();
    const measurements: Record<string, number> = {};
    for (const [k, v] of Object.entries(measDraft)) {
      const n = Number(v);
      if (v.trim() && Number.isFinite(n) && n > 0) measurements[k] = n;
    }
    if (!Object.keys(measurements).length) return;
    await wrap(() =>
      api.post(`/api/admin/clients/${id}/measurements`, { measurements, note: measNote.trim() || null }),
    );
    setMeasDraft({});
    setMeasNote("");
    setShowMeasForm(false);
  }

  async function addEvent(e: FormEvent) {
    e.preventDefault();
    if (!evSubject.trim() && !evBody.trim()) return;
    await wrap(() =>
      api.post(`/api/admin/clients/${id}/events`, {
        kind: evKind,
        subject: evSubject.trim() || null,
        body: evBody.trim() || null,
      }),
    );
    setEvSubject("");
    setEvBody("");
  }

  async function createCommission(e: FormEvent) {
    e.preventDefault();
    if (!commTitle.trim()) return;
    const cents = commPrice.trim() ? Math.round(Number(commPrice) * 100) : null;
    await wrap(() =>
      api.post("/api/admin/commissions", {
        clientId: id,
        title: commTitle.trim(),
        kind: commKind,
        dueAt: commDue || null,
        priceCents: Number.isFinite(cents as number) && cents != null && cents >= 0 ? cents : null,
      }),
    );
    setCommTitle("");
    setCommDue("");
    setCommPrice("");
    setShowCommForm(false);
  }

  async function deleteClient() {
    if (!window.confirm(`Delete ${data!.name} and their measurements and timeline? Saved patterns and photos are kept, just unlinked. This can't be undone.`)) return;
    await api.delete(`/api/admin/clients/${id}`);
    navigate("/admin/clients");
  }

  return (
    <div>
      <PageHeader
        eyebrow="Clients"
        title={data.name}
        help="client-book"
        description={[data.email, data.phone].filter(Boolean).join(" · ") || "No contact details yet — edit below."}
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link to="/admin/clients" className="admin-btn">
          ← All clients
        </Link>
        <button
          className="admin-btn"
          disabled={busy}
          onClick={() =>
            wrap(() =>
              api.put(`/api/admin/clients/${id}`, {
                status: data.status === "archived" ? "active" : "archived",
              }),
            )
          }
        >
          {data.status === "archived" ? "Unarchive" : "Archive"}
        </button>
        <button
          className="admin-btn"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const r = await api.post<{ link: string; emailed: boolean }>(
                `/api/admin/clients/${id}/portal-link`,
                {},
              );
              await navigator.clipboard.writeText(r.link).catch(() => {});
              setPortalNote(
                r.emailed
                  ? "Invite link copied — and emailed to the client."
                  : "Invite link copied. Share it with the client — it signs them in once and lasts 14 days.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          Copy portal invite link
        </button>
        <button className="admin-btn text-red-700" disabled={busy} onClick={deleteClient}>
          Delete client &amp; their data
        </button>
        {data.customer && (
          <span className="text-xs text-warmgrey">
            Linked shop account: {data.customer.email}
          </span>
        )}
      </div>
      {portalNote && <p className="mb-4 text-sm text-warmgrey">{portalNote}</p>}

      {/* Commissions: the staged work pipeline for this client */}
      <section className="admin-card mb-4 p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-medium">Commissions</h2>
          <span className="flex items-center gap-2">
            <Link to="/admin/commissions" className="text-xs text-warmgrey hover:underline">
              Whole pipeline →
            </Link>
            <button className="admin-btn" onClick={() => setShowCommForm((v) => !v)}>
              {showCommForm ? "Cancel" : "New commission"}
            </button>
          </span>
        </div>
        {showCommForm && (
          <form onSubmit={createCommission} className="mb-3 flex flex-wrap items-end gap-3 rounded border border-black/5 p-3">
            <label className="flex flex-col text-sm">
              <span className="mb-1 text-xs text-warmgrey">What are you making?</span>
              <input className="admin-input" value={commTitle} onChange={(e) => setCommTitle(e.target.value)} placeholder="e.g. Wedding-guest coat" />
            </label>
            <label className="flex flex-col text-sm">
              <span className="mb-1 text-xs text-warmgrey">Type</span>
              <select className="admin-input" value={commKind} onChange={(e) => setCommKind(e.target.value as typeof commKind)}>
                <option value="commission">Made to measure</option>
                <option value="alteration">Alteration</option>
              </select>
            </label>
            <label className="flex flex-col text-sm">
              <span className="mb-1 text-xs text-warmgrey">Due (optional)</span>
              <input className="admin-input" type="date" value={commDue} onChange={(e) => setCommDue(e.target.value)} />
            </label>
            <label className="flex flex-col text-sm">
              <span className="mb-1 text-xs text-warmgrey">Quoted price (optional)</span>
              <input className="admin-input" inputMode="decimal" value={commPrice} onChange={(e) => setCommPrice(e.target.value)} placeholder="e.g. 480" />
            </label>
            <button className="admin-btn-primary" disabled={busy || !commTitle.trim()}>
              Open commission
            </button>
          </form>
        )}
        {data.commissions.length === 0 && !showCommForm && (
          <p className="text-sm text-warmgrey">
            No commissions yet — open one to track a made-to-measure piece or an alteration from consult to delivery.
          </p>
        )}
        <ul className="space-y-2">
          {data.commissions.map((co) => {
            const stages = co.kind === "alteration"
              ? ["consult", "fitting", "delivery", "done", "cancelled"]
              : ["consult", "design", "fabric", "cutting", "fitting", "delivery", "done", "cancelled"];
            return (
              <li key={co.id} className="rounded border border-black/5 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    {co.title}{" "}
                    {co.kind === "alteration" && <span className="text-xs text-warmgrey">(alteration)</span>}
                  </span>
                  <span className="flex flex-wrap items-center gap-2 text-xs text-warmgrey">
                    {co.dueAt && <span>due {formatDate(co.dueAt)}</span>}
                    {co.priceCents != null && <span>{formatMoney(co.priceCents)}</span>}
                    <select
                      className="admin-input !py-1 text-xs"
                      value={co.stage}
                      disabled={busy}
                      onChange={(e) =>
                        void wrap(() => api.put(`/api/admin/commissions/${co.id}`, { stage: e.target.value }))
                      }
                    >
                      {stages.map((st) => (
                        <option key={st} value={st}>
                          {st === "design" ? "Design approved" : st === "fabric" ? "Fabric sourced" : st[0].toUpperCase() + st.slice(1)}
                        </option>
                      ))}
                    </select>
                  </span>
                </div>
                {co.payments.length > 0 && (
                  <ul className="mt-2 space-y-1 text-xs">
                    {co.payments.map((pm) => (
                      <li key={pm.id} className="flex items-center justify-between gap-2">
                        <span>
                          {pm.label} · {formatMoney(pm.amountCents)}{" "}
                          {pm.status === "paid" ? (
                            <span className="text-green-700">paid {pm.paidAt ? formatDate(pm.paidAt) : ""}</span>
                          ) : (
                            <span className="text-warmgrey">requested</span>
                          )}
                        </span>
                        {pm.status === "requested" && (
                          <span className="flex gap-2">
                            <button
                              className="text-green-700 hover:underline"
                              disabled={busy}
                              onClick={() =>
                                void wrap(() =>
                                  api.post(`/api/admin/commissions/${co.id}/payments/${pm.id}/mark-paid`, {}),
                                )
                              }
                            >
                              mark paid
                            </button>
                            <button
                              className="text-red-700 hover:underline"
                              disabled={busy}
                              onClick={() =>
                                void wrap(() => api.delete(`/api/admin/commissions/${co.id}/payments/${pm.id}`))
                              }
                            >
                              void
                            </button>
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {!["done", "cancelled"].includes(co.stage) && (
                  <div className="mt-2 flex gap-2">
                    <input
                      className="admin-input w-40 text-xs"
                      value={payDraft[co.id]?.label ?? ""}
                      onChange={(e) => setPayDraft((d) => ({ ...d, [co.id]: { label: e.target.value, amount: d[co.id]?.amount ?? "" } }))}
                      placeholder="e.g. Deposit"
                    />
                    <input
                      className="admin-input w-24 text-xs"
                      inputMode="decimal"
                      value={payDraft[co.id]?.amount ?? ""}
                      onChange={(e) => setPayDraft((d) => ({ ...d, [co.id]: { label: d[co.id]?.label ?? "", amount: e.target.value } }))}
                      placeholder="240"
                    />
                    <button
                      className="admin-btn"
                      disabled={busy || !(payDraft[co.id]?.label ?? "").trim() || !Number(payDraft[co.id]?.amount)}
                      onClick={() => {
                        const d = payDraft[co.id];
                        if (!d) return;
                        const cents = Math.round(Number(d.amount) * 100);
                        if (!Number.isFinite(cents) || cents <= 0) return;
                        void wrap(() =>
                          api.post(`/api/admin/commissions/${co.id}/payments`, {
                            label: d.label.trim(),
                            amountCents: cents,
                          }),
                        ).then(() => setPayDraft((pd) => ({ ...pd, [co.id]: { label: "", amount: "" } })));
                      }}
                    >
                      Request payment
                    </button>
                  </div>
                )}
                {!["done", "cancelled"].includes(co.stage) && (
                  <div className="mt-2 flex gap-2">
                    <input
                      className="admin-input flex-1 text-xs"
                      value={fitDraft[co.id] ?? ""}
                      onChange={(e) => setFitDraft((d) => ({ ...d, [co.id]: e.target.value }))}
                      placeholder="Fitting note — e.g. take in left shoulder 1 cm"
                    />
                    <button
                      className="admin-btn"
                      disabled={busy || !(fitDraft[co.id] ?? "").trim()}
                      onClick={() => {
                        const note = (fitDraft[co.id] ?? "").trim();
                        if (!note) return;
                        void wrap(() =>
                          api.post(`/api/admin/commissions/${co.id}/fittings`, { subject: note, kind: "fitting" }),
                        ).then(() => setFitDraft((d) => ({ ...d, [co.id]: "" })));
                      }}
                    >
                      Record fitting
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Style notes */}
        <section className="admin-card p-4">
          <h2 className="mb-2 font-medium">Style notes</h2>
          <p className="mb-2 text-xs text-warmgrey">
            Colours they love, fits they avoid, brands that run true for them, occasions coming up.
          </p>
          <textarea
            className="admin-input h-32 w-full"
            value={notesDraft ?? data.styleNotes ?? ""}
            onChange={(e) => setNotesDraft(e.target.value)}
            placeholder="e.g. Loves saturated jewel tones; never sleeveless; wedding guest in June."
          />
          {notesDraft !== null && notesDraft !== (data.styleNotes ?? "") && (
            <button className="admin-btn-primary mt-2" disabled={busy} onClick={saveNotes}>
              Save notes
            </button>
          )}
        </section>

        {/* Timeline */}
        <section className="admin-card p-4">
          <h2 className="mb-2 font-medium">Timeline</h2>
          <form onSubmit={addEvent} className="mb-3 flex flex-col gap-2">
            <div className="flex gap-2">
              <select className="admin-input" value={evKind} onChange={(e) => setEvKind(e.target.value as typeof evKind)}>
                {EVENT_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k[0].toUpperCase() + k.slice(1)}
                  </option>
                ))}
              </select>
              <input
                className="admin-input flex-1"
                value={evSubject}
                onChange={(e) => setEvSubject(e.target.value)}
                placeholder="e.g. First fitting — take in left shoulder 1 cm"
              />
            </div>
            <textarea
              className="admin-input h-16"
              value={evBody}
              onChange={(e) => setEvBody(e.target.value)}
              placeholder="Details (optional)"
            />
            <button className="admin-btn-primary self-start" disabled={busy || (!evSubject.trim() && !evBody.trim())}>
              Add to timeline
            </button>
          </form>
          {data.events.length === 0 && <p className="text-sm text-warmgrey">Nothing recorded yet.</p>}
          <ul className="space-y-2">
            {data.events.map((ev) => (
              <li key={ev.id} className="rounded border border-black/5 p-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span>
                    <StatusBadge status={ev.kind} /> <span className="font-medium">{ev.subject ?? ""}</span>
                  </span>
                  <span className="flex items-center gap-2 text-xs text-warmgrey">
                    {formatDate(ev.eventAt)}
                    <button
                      className="text-red-700 hover:underline"
                      disabled={busy}
                      onClick={() => wrap(() => api.delete(`/api/admin/clients/${id}/events/${ev.id}`))}
                    >
                      remove
                    </button>
                  </span>
                </div>
                {ev.body && <p className="mt-1 whitespace-pre-wrap text-warmgrey">{ev.body}</p>}
              </li>
            ))}
          </ul>
        </section>

        {/* Measurement history */}
        <section className="admin-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-medium">Measurements</h2>
            <button className="admin-btn" onClick={() => setShowMeasForm((v) => !v)}>
              {showMeasForm ? "Cancel" : "Record new set"}
            </button>
          </div>
          <p className="mb-2 text-xs text-warmgrey">
            A dated history — bodies change, so new measurements never overwrite old ones.
          </p>
          {showMeasForm && (
            <form onSubmit={addMeasurements} className="mb-3 rounded border border-black/5 p-3">
              <div className="mb-3 rounded-lg bg-navy/[0.04] p-3">
                <p className="text-xs font-medium text-ink">Estimate from photos <span className="rounded bg-navy/10 px-1.5 py-0.5 text-[0.6rem] uppercase tracking-wide text-navy">beta</span></p>
                <p className="mt-0.5 text-[0.68rem] text-warmgrey">
                  A front photo (side photo helps), fitted clothing, full body in frame — plus height below to set the
                  scale. It prefills a draft the tape must confirm at the fitting; it never replaces measuring.
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <label className="flex items-center gap-1.5">
                    Front
                    <input type="file" accept="image/*" onChange={(e) => setPhotoFront(e.target.files?.[0] ?? null)} className="text-xs" />
                  </label>
                  <label className="flex items-center gap-1.5">
                    Side (optional)
                    <input type="file" accept="image/*" onChange={(e) => setPhotoSide(e.target.files?.[0] ?? null)} className="text-xs" />
                  </label>
                  <button
                    type="button"
                    onClick={() => void estimateFromPhotos()}
                    disabled={estimating || !photoFront || !parseFloat(measDraft.heightCm ?? "")}
                    className="rounded bg-navy px-3 py-1 text-xs text-white disabled:opacity-50"
                    title={!parseFloat(measDraft.heightCm ?? "") ? "Enter the height first — it sets the scale" : undefined}
                  >
                    {estimating ? "Estimating…" : "Estimate"}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {MEASUREMENT_FIELDS.map(([key, label]) => (
                  <label key={key} className="flex flex-col text-xs">
                    <span className="mb-1 text-warmgrey">{label} (cm)</span>
                    <input
                      className="admin-input"
                      inputMode="decimal"
                      value={measDraft[key] ?? ""}
                      onChange={(e) => setMeasDraft((d) => ({ ...d, [key]: e.target.value }))}
                    />
                  </label>
                ))}
              </div>
              <input
                className="admin-input mt-2 w-full"
                value={measNote}
                onChange={(e) => setMeasNote(e.target.value)}
                placeholder="Note (e.g. measured over shirt)"
              />
              <button className="admin-btn-primary mt-2" disabled={busy}>
                Save measurement set
              </button>
            </form>
          )}
          {data.measurements.length === 0 && !showMeasForm && (
            <p className="text-sm text-warmgrey">No measurements yet — record the first set.</p>
          )}
          <ul className="space-y-3">
            {data.measurements.map((m) => (
              <li key={m.id} className="rounded border border-black/5 p-3">
                <div className="mb-1 flex items-center justify-between text-xs text-warmgrey">
                  <span className="font-medium text-ink">{formatDate(m.takenAt)}</span>
                  <button
                    className="text-red-700 hover:underline"
                    disabled={busy}
                    onClick={() => wrap(() => api.delete(`/api/admin/clients/${id}/measurements/${m.id}`))}
                  >
                    remove
                  </button>
                </div>
                {m.note && <p className="mb-1 text-xs text-warmgrey">{m.note}</p>}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  {Object.entries(m.measurements).map(([k, v]) => (
                    <span key={k}>
                      <span className="text-warmgrey">{labelFor(k)}:</span> {v}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Patterns + photos */}
        <section className="admin-card p-4">
          <h2 className="mb-2 font-medium">Patterns &amp; photos</h2>
          {data.looks.length === 0 && data.models.length === 0 && (
            <p className="mb-2 text-sm text-warmgrey">
              Nothing linked yet. Saved patterns and uploaded model photos attach here so everything about{" "}
              {data.name.split(" ")[0]} lives in one place.
            </p>
          )}
          {data.looks.length > 0 && (
            <ul className="mb-3 space-y-1 text-sm">
              {data.looks.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-2">
                  <Link to="/admin/patterns" className="hover:underline">
                    {l.name} <span className="text-xs text-warmgrey">({l.garmentId})</span>
                  </Link>
                  <span className="flex items-center gap-2 text-xs text-warmgrey">
                    {formatDate(l.updatedAt)}
                    <button
                      className="text-red-700 hover:underline"
                      disabled={busy}
                      onClick={() => wrap(() => api.post(`/api/admin/clients/${id}/link`, { lookId: l.id, detach: true }))}
                    >
                      unlink
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {linkableLooks.length > 0 && (
            <div className="mb-3 flex items-center gap-2 text-sm">
              <select className="admin-input" id="link-look" defaultValue="">
                <option value="" disabled>
                  Link a saved pattern…
                </option>
                {linkableLooks.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
              <button
                className="admin-btn"
                disabled={busy}
                onClick={() => {
                  const sel = document.getElementById("link-look") as HTMLSelectElement | null;
                  if (sel?.value) void wrap(() => api.post(`/api/admin/clients/${id}/link`, { lookId: sel.value }));
                }}
              >
                Link
              </button>
            </div>
          )}
          {linkableModels.length > 0 && (
            <div className="mb-3 flex items-center gap-2 text-sm">
              <select className="admin-input" id="link-model" defaultValue="">
                <option value="" disabled>
                  Link an uploaded model photo…
                </option>
                {linkableModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
              <button
                className="admin-btn"
                disabled={busy}
                onClick={() => {
                  const sel = document.getElementById("link-model") as HTMLSelectElement | null;
                  if (sel?.value) void wrap(() => api.post(`/api/admin/clients/${id}/link`, { modelId: sel.value }));
                }}
              >
                Link
              </button>
            </div>
          )}
          {data.models.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {data.models.map((m) => (
                <figure key={m.id} className="w-20">
                  <img src={`/media/${m.fileId}`} alt={m.label} className="aspect-[3/4] w-full rounded object-cover" />
                  <figcaption className="mt-1 truncate text-xs text-warmgrey">{m.label}</figcaption>
                </figure>
              ))}
            </div>
          )}
          <p className="mt-2 text-xs text-warmgrey">
            Tip: in the Fitting Studio, upload {data.name.split(" ")[0]}'s photo as a model — then link it here to
            try their own designs on their own body.
          </p>
        </section>
      </div>
    </div>
  );
}
