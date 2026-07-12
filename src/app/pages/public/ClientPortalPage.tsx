import { useCallback, useEffect, useState } from "react";
import { api, ApiRequestError } from "../../lib/api";
import { useToast } from "../../lib/toast";

/**
 * The client portal — a made-to-measure client's own window into the studio:
 * their commissions and stages, their renders and photos, their latest
 * measurements, and a button to approve a design. Passwordless; the studio
 * shares a one-time link from the Client Book.
 */

interface PortalMe {
  name: string;
  studio: string | null;
  commissions: {
    id: string;
    title: string;
    kind: string;
    stage: string;
    dueAt: string | null;
    approvedAt: string | null;
    updatedAt: string;
    payments: { id: string; label: string; amountCents: number; status: string; paidAt: string | null }[];
  }[];
  measurements: { takenAt: string; values: Record<string, number | string> } | null;
  renders: { url: string; createdAt: string }[];
  photos: { url: string; label: string }[];
  messages: { subject: string | null; body: string; sentAt: string | null }[];
}

const STAGE_LABELS: Record<string, string> = {
  consult: "In consultation",
  design: "Design approved",
  fabric: "Fabric sourced",
  cutting: "Being cut",
  fitting: "In fittings",
  delivery: "Ready for delivery",
  done: "Delivered",
  cancelled: "Cancelled",
};

const fmtDate = (s: string | null) =>
  s ? new Date(s.replace(" ", "T") + "Z").toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "";

const measurementLabel = (key: string) =>
  key.replace(/Cm$/, "").replace(/([A-Z])/g, " $1").toLowerCase().replace(/^./, (ch) => ch.toUpperCase());

export function ClientPortalPage() {
  const toast = useToast();
  const [me, setMe] = useState<PortalMe | null>(null);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);

  const loadMe = useCallback(async () => {
    try {
      setMe(await api.get<PortalMe>("/api/public/portal/me"));
    } catch {
      setMe(null);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    const token = url.searchParams.get("token");
    if (token) {
      api
        .post("/api/public/portal/verify", { token })
        .then(() => {
          url.searchParams.delete("token");
          window.history.replaceState({}, "", url.toString());
        })
        .catch((e) =>
          toast.error("Couldn't open your portal", e instanceof ApiRequestError ? e.message : undefined),
        )
        .finally(() => void loadMe());
    } else {
      void loadMe();
    }
  }, [loadMe, toast]);

  async function approve(commissionId: string, title: string) {
    setBusy(true);
    try {
      await api.post("/api/public/portal/approve", { commissionId });
      toast.success("Approved", `Your studio has been told you love “${title}”.`);
      await loadMe();
    } catch (e) {
      toast.error("Couldn't approve", e instanceof ApiRequestError ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  }

  if (checking) {
    return <div className="mx-auto max-w-3xl px-4 py-16 text-center text-sm text-warmgrey">Opening your portal…</div>;
  }

  if (!me) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-light">Your fitting portal</h1>
        <p className="mt-3 text-sm text-warmgrey">
          This page opens from a personal link your studio shares with you. If your link has expired, just ask them
          for a fresh one — links work once and last 14 days.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-widest text-warmgrey">{me.studio ?? "Your studio"}</p>
        <h1 className="mt-1 font-display text-3xl font-light">Hello, {me.name.split(" ")[0]}.</h1>
        <p className="mt-2 text-sm text-warmgrey">
          Your pieces in progress, your fittings, and your renders — all in one place.
        </p>
      </header>

      {me.commissions.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 font-medium">Your pieces</h2>
          <ul className="space-y-3">
            {me.commissions.map((co) => (
              <li key={co.id} className="rounded-lg border border-black/10 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{co.title}</span>
                  <span className="text-sm text-warmgrey">{STAGE_LABELS[co.stage] ?? co.stage}</span>
                </div>
                {co.payments.length > 0 && (
                  <ul className="mt-2 space-y-0.5 text-xs text-warmgrey">
                    {co.payments.map((pm) => (
                      <li key={pm.id}>
                        {pm.label}: {(pm.amountCents / 100).toLocaleString(undefined, { style: "currency", currency: "USD" })}{" "}
                        {pm.status === "paid"
                          ? `— received${pm.paidAt ? ` ${fmtDate(pm.paidAt)}` : ""}, thank you`
                          : "— your studio will take this at your next visit or by bank transfer"}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-warmgrey">
                  <span>
                    {co.kind === "alteration" ? "Alteration" : "Made to measure"}
                    {co.dueAt ? ` · ready around ${fmtDate(co.dueAt)}` : ""}
                  </span>
                  {co.approvedAt ? (
                    <span className="text-green-700">You approved this on {fmtDate(co.approvedAt)}</span>
                  ) : (
                    !["done", "cancelled"].includes(co.stage) && (
                      <button
                        className="rounded bg-ink px-3 py-1.5 text-xs text-white disabled:opacity-50"
                        disabled={busy}
                        onClick={() => void approve(co.id, co.title)}
                      >
                        Approve this design
                      </button>
                    )
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(me.messages?.length ?? 0) > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 font-medium">Notes from your studio</h2>
          <ul className="space-y-3">
            {me.messages.map((m, i) => (
              <li key={i} className="rounded-lg border border-black/10 p-4">
                {m.subject && <p className="font-medium">{m.subject}</p>}
                <p className="mt-1 whitespace-pre-wrap text-sm text-ink/80">{m.body}</p>
                {m.sentAt && <p className="mt-2 text-xs text-warmgrey">{fmtDate(m.sentAt)}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {(me.renders.length > 0 || me.photos.length > 0) && (
        <section className="mb-8">
          <h2 className="mb-3 font-medium">Your renders</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {me.renders.map((r, i) => (
              <img key={`r${i}`} src={r.url} alt="Fitting render" className="aspect-[3/4] w-full rounded-lg object-cover" />
            ))}
            {me.renders.length === 0 &&
              me.photos.map((p, i) => (
                <img key={`p${i}`} src={p.url} alt={p.label} className="aspect-[3/4] w-full rounded-lg object-cover" />
              ))}
          </div>
        </section>
      )}

      {me.measurements && (
        <section className="mb-8">
          <h2 className="mb-1 font-medium">Your measurements</h2>
          <p className="mb-3 text-xs text-warmgrey">Taken {fmtDate(me.measurements.takenAt)}</p>
          <div className="flex flex-wrap gap-x-5 gap-y-1 rounded-lg border border-black/10 p-4 text-sm">
            {Object.entries(me.measurements.values).map(([k, v]) => (
              <span key={k}>
                <span className="text-warmgrey">{measurementLabel(k)}:</span> {v} cm
              </span>
            ))}
          </div>
        </section>
      )}

      <footer className="mt-10 text-xs text-warmgrey">
        Your measurements and photos belong to you — ask your studio to remove them at any time.
      </footer>
    </div>
  );
}
