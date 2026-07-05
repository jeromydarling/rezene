import { useState } from "react";
import { useParams } from "react-router";
import { useFetch } from "../../lib/useFetch";
import { api, ApiRequestError } from "../../lib/api";
import { formatDate } from "../../lib/format";
import { SectionContent } from "../../components/TechPackContent";
import type { AdminTechPackDetail } from "../../../shared/types";

interface FactoryComment {
  id: string;
  author: string | null;
  author_kind: string;
  body: string;
  created_at: string;
}

interface FactoryShareResponse {
  brandName: string;
  label: string | null;
  supplierName: string | null;
  language: "en" | "fr";
  approvedAt: string | null;
  approvedByName: string | null;
  approvalNote: string | null;
  pack: AdminTechPackDetail;
  comments: FactoryComment[];
}

const T = {
  en: {
    subtitle: "Technical Specification — live document",
    liveNote:
      "This link always shows the current version of the specification. If anything changes, this page changes with it — there is no newer copy by email.",
    construction: "Construction Notes",
    stitches: "Stitch Details",
    labels: "Labels & Packaging",
    comments: "Questions & comments",
    commentHint: "Write in English or French — the brand is notified immediately.",
    yourName: "Your name",
    comment: "Your comment",
    send: "Send comment",
    approve: "Approve this specification",
    approveHint:
      "Approving confirms your atelier can produce this garment as specified. You can still comment afterwards.",
    approvedBy: "Specification approved by",
    approveNote: "Note (optional)",
    confirm: "Confirm approval",
    version: "Version",
  },
  fr: {
    subtitle: "Dossier technique — document en direct",
    liveNote:
      "Ce lien affiche toujours la version actuelle du dossier technique. En cas de modification, cette page est mise à jour — il n'existe pas de copie plus récente par e-mail.",
    construction: "Notes de montage",
    stitches: "Détails des piqûres",
    labels: "Étiquettes & emballage",
    comments: "Questions & commentaires",
    commentHint: "Écrivez en français ou en anglais — la marque est notifiée immédiatement.",
    yourName: "Votre nom",
    comment: "Votre commentaire",
    send: "Envoyer",
    approve: "Approuver ce dossier technique",
    approveHint:
      "L'approbation confirme que votre atelier peut produire ce vêtement selon le dossier. Vous pouvez continuer à commenter ensuite.",
    approvedBy: "Dossier approuvé par",
    approveNote: "Note (facultatif)",
    confirm: "Confirmer l'approbation",
    version: "Version",
  },
};

export function FactoryPortalPage() {
  const { token } = useParams();
  const { data, loading, error, reload } = useFetch<FactoryShareResponse>(
    token ? `/api/factory/${token}` : null,
  );
  const [lang, setLang] = useState<"en" | "fr" | null>(null);
  const [comment, setComment] = useState({ name: "", body: "" });
  const [commentState, setCommentState] = useState<"idle" | "busy" | "sent">("idle");
  const [approval, setApproval] = useState({ name: "", note: "" });
  const [approveBusy, setApproveBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-5 py-16">
        <div className="skeleton h-10 w-2/3" />
        <div className="skeleton h-64 w-full" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="mx-auto max-w-xl px-5 py-32 text-center">
        <h1 className="font-display text-2xl font-light">Link unavailable</h1>
        <p className="prose-editorial mt-3">
          {error ?? "This link is invalid or has been revoked."} / Ce lien est invalide ou a été
          révoqué.
        </p>
      </div>
    );
  }

  const activeLang = lang ?? data.language;
  const t = T[activeLang];
  const pack = data.pack;
  const filledSections = pack.sections.filter(
    (s) => s.content && Object.keys(s.content as object).length > 0,
  );

  async function sendComment() {
    if (!token) return;
    setCommentState("busy");
    setActionError(null);
    try {
      await api.post(`/api/factory/${token}/comments`, {
        authorName: comment.name,
        body: comment.body,
      });
      setComment({ ...comment, body: "" });
      setCommentState("sent");
      setTimeout(() => setCommentState("idle"), 2000);
      reload();
    } catch (err) {
      setCommentState("idle");
      setActionError(err instanceof ApiRequestError ? err.message : "Failed");
    }
  }

  async function approve() {
    if (!token) return;
    setApproveBusy(true);
    setActionError(null);
    try {
      await api.post(`/api/factory/${token}/approve`, {
        name: approval.name,
        note: approval.note || undefined,
      });
      reload();
    } catch (err) {
      setActionError(err instanceof ApiRequestError ? err.message : "Failed");
    } finally {
      setApproveBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-chalk">
      {/* Portal chrome */}
      <header className="border-b border-ink/10 bg-navy px-5 py-4 text-chalk">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div>
            <p className="font-display text-lg font-light">{data.brandName}</p>
            <p className="text-[0.65rem] uppercase tracking-editorial text-chalk/60">
              {t.subtitle}
              {data.supplierName ? ` · ${data.supplierName}` : ""}
            </p>
          </div>
          <div className="flex overflow-hidden rounded border border-chalk/30">
            {(["en", "fr"] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLang(l)}
                className={`px-3 py-1 text-xs uppercase ${
                  activeLang === l ? "bg-chalk text-navy" : "text-chalk/70"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-8 px-5 py-8">
        <p className="rounded bg-saffron/15 px-4 py-3 text-sm text-bark">{t.liveNote}</p>

        {data.approvedAt && (
          <p className="rounded bg-palm/15 px-4 py-3 text-sm text-palm">
            ✓ {t.approvedBy} {data.approvedByName} · {formatDate(data.approvedAt)}
            {data.approvalNote && <span className="block text-xs">"{data.approvalNote}"</span>}
          </p>
        )}

        {/* Document */}
        <article className="admin-card space-y-8 p-6 sm:p-8">
          <header className="border-b border-ink/15 pb-5 text-center">
            <h1 className="font-display text-2xl font-light">{pack.name}</h1>
            <p className="mt-1 text-sm text-warmgrey">
              {pack.code} · {t.version} {pack.version}
              {pack.season ? ` · ${pack.season}` : ""}
            </p>
            {pack.summary && <p className="prose-editorial mx-auto mt-2 max-w-lg">{pack.summary}</p>}
          </header>

          {filledSections.map((section) => (
            <section key={section.id}>
              <h2 className="mb-3 border-b border-ink/10 pb-1 text-sm font-semibold uppercase tracking-wider text-ink/70">
                {section.title}
              </h2>
              <SectionContent content={section.content} />
            </section>
          ))}

          {pack.constructionNotes.length > 0 && (
            <section>
              <h2 className="mb-3 border-b border-ink/10 pb-1 text-sm font-semibold uppercase tracking-wider text-ink/70">
                {t.construction}
              </h2>
              <ul className="space-y-2 text-sm">
                {pack.constructionNotes.map((n) => (
                  <li key={n.id}>
                    <span className="font-semibold">{n.area}: </span>
                    {activeLang === "fr" && n.noteFr ? n.noteFr : n.note}
                    {activeLang === "fr" && !n.noteFr && (
                      <span className="text-warmgrey"> (EN)</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {pack.stitchDetails.length > 0 && (
            <section>
              <h2 className="mb-3 border-b border-ink/10 pb-1 text-sm font-semibold uppercase tracking-wider text-ink/70">
                {t.stitches}
              </h2>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Operation</th>
                    <th>Stitch</th>
                    <th>SPI</th>
                    <th>Thread</th>
                  </tr>
                </thead>
                <tbody>
                  {pack.stitchDetails.map((s) => (
                    <tr key={s.id}>
                      <td>{s.operation}</td>
                      <td>{s.stitchClass ?? "—"}</td>
                      <td>{s.spi ?? "—"}</td>
                      <td>{s.thread ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {pack.labelsPackaging.length > 0 && (
            <section>
              <h2 className="mb-3 border-b border-ink/10 pb-1 text-sm font-semibold uppercase tracking-wider text-ink/70">
                {t.labels}
              </h2>
              <ul className="space-y-1.5 text-sm">
                {pack.labelsPackaging.map((l) => (
                  <li key={l.id}>
                    <span className="font-semibold">{l.item}</span>
                    {l.placement ? ` — ${l.placement}` : ""}
                    {l.material ? ` · ${l.material}` : ""}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </article>

        {/* Comments */}
        <section className="admin-card p-6">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-ink/70">
            {t.comments}
          </h2>
          <p className="mb-4 text-xs text-warmgrey">{t.commentHint}</p>
          <div className="space-y-3">
            {data.comments.map((cm) => (
              <div
                key={cm.id}
                className={`rounded border p-3 text-sm ${
                  cm.author_kind === "factory"
                    ? "border-indigo-faded/40 bg-indigo-faded/5"
                    : "border-ink/10 bg-cream/50"
                }`}
              >
                <p className="mb-1 text-xs text-warmgrey">
                  {cm.author ?? "—"} · {formatDate(cm.created_at)}
                  {cm.author_kind !== "factory" && ` · ${data.brandName}`}
                </p>
                {cm.body}
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-2">
            <input
              className="input"
              placeholder={t.yourName}
              value={comment.name}
              onChange={(e) => setComment({ ...comment, name: e.target.value })}
            />
            <textarea
              rows={3}
              className="input"
              placeholder={t.comment}
              value={comment.body}
              onChange={(e) => setComment({ ...comment, body: e.target.value })}
            />
            <button
              type="button"
              className="btn btn-primary"
              disabled={commentState === "busy" || !comment.name || !comment.body}
              onClick={() => void sendComment()}
            >
              {commentState === "busy" ? "…" : commentState === "sent" ? "✓" : t.send}
            </button>
          </div>
        </section>

        {/* Approval */}
        {!data.approvedAt && (
          <section className="admin-card border-palm/40 p-6">
            <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-palm">
              {t.approve}
            </h2>
            <p className="mb-4 text-xs text-warmgrey">{t.approveHint}</p>
            <div className="space-y-2">
              <input
                className="input"
                placeholder={t.yourName}
                value={approval.name}
                onChange={(e) => setApproval({ ...approval, name: e.target.value })}
              />
              <input
                className="input"
                placeholder={t.approveNote}
                value={approval.note}
                onChange={(e) => setApproval({ ...approval, note: e.target.value })}
              />
              <button
                type="button"
                className="btn border-palm bg-palm text-chalk hover:opacity-90"
                disabled={approveBusy || !approval.name}
                onClick={() => void approve()}
              >
                {approveBusy ? "…" : t.confirm}
              </button>
            </div>
          </section>
        )}
        {actionError && <p className="field-error">{actionError}</p>}
      </main>
    </div>
  );
}
