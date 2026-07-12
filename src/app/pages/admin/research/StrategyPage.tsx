import { useMemo, useState } from "react";
import { Link } from "react-router";
import { PageHeader, EmptyState } from "../../../components/admin/ui";
import { Markdown } from "../../../components/Markdown";
import { api } from "../../../lib/api";
import { useFetch } from "../../../lib/useFetch";
import { useToast } from "../../../lib/toast";
import { ResearchNav, sinceLabel } from "./shared";
import {
  STRATEGY_KINDS,
  STRATEGY_PERSONAS,
  strategyKindMeta,
  strategyPersonaMeta,
  strategyDocLabel,
  type StrategyDoc,
  type StrategyKind,
  type StrategyPersona,
  type StrategyVariant,
  type StrategySection,
  type StrategyAction,
} from "../../../../shared/strategy";

/**
 * Business Strategy — the R&D room where a shop works with a Claude persona to
 * build SWOTs, business plans, OKRs, and competitive analyses grounded in its
 * own Brand Brain, then turns the resulting action items into calendar dates.
 * Degrades to a plain drafting tool on Workers AI when no Anthropic key is set.
 */

function futureDate(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

// ---- The generator ----------------------------------------------------------

function Generator({ onCreated }: { onCreated: (doc: StrategyDoc) => void }) {
  const toast = useToast();
  const [kind, setKind] = useState<StrategyKind | null>(null);
  const [persona, setPersona] = useState<StrategyPersona>("advisor");
  const [variant, setVariant] = useState<StrategyVariant>("lean");
  const [plain, setPlain] = useState(false);
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState(false);

  const meta = kind ? strategyKindMeta(kind) : null;

  const pick = (k: StrategyKind) => {
    setKind(k);
    setPersona(strategyKindMeta(k)?.defaultPersona ?? "advisor");
    setBrief("");
  };

  const generate = async () => {
    if (!kind) return;
    setBusy(true);
    try {
      const doc = await api.post<StrategyDoc>("/api/admin/strategy/generate", {
        kind,
        variant: kind === "business_plan" ? variant : undefined,
        persona,
        plain,
        brief: brief.trim() || undefined,
      });
      toast.success(`${strategyDocLabel(kind, doc.variant)} ready`, "Scroll down — and turn any action into a calendar date.");
      onCreated(doc);
      setKind(null);
      setBrief("");
    } catch {
      /* api layer surfaces the toast */
    } finally {
      setBusy(false);
    }
  };

  if (!kind || !meta) {
    return (
      <div className="mb-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {STRATEGY_KINDS.map((k) => (
            <button
              key={k.key}
              onClick={() => pick(k.key)}
              className="rounded-xl border border-ink/10 bg-white p-4 text-left transition hover:border-navy/40 hover:shadow-sm"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{k.icon}</span>
                <h3 className="font-display text-base text-ink">{k.label}</h3>
              </div>
              <p className="mt-0.5 text-xs font-medium text-navy/70">{k.tagline}</p>
              <p className="mt-1 text-sm text-warmgrey">{k.blurb}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-5 rounded-xl border border-navy/20 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg">{meta.icon}</span>
            <h3 className="font-display text-base text-ink">{meta.label}</h3>
          </div>
          <p className="mt-0.5 text-sm text-warmgrey">{meta.blurb}</p>
        </div>
        <button onClick={() => setKind(null)} className="shrink-0 text-xs text-warmgrey hover:underline">
          ← Pick a different tool
        </button>
      </div>

      {/* Variant (business plan only) */}
      {meta.variants && (
        <div className="mt-3">
          <p className="mb-1 text-xs font-medium text-warmgrey">Depth</p>
          <div className="flex flex-wrap gap-1.5">
            {meta.variants.map((v) => (
              <button
                key={v.key}
                onClick={() => setVariant(v.key)}
                title={v.blurb}
                className={`rounded-full px-3 py-1 text-xs ${variant === v.key ? "bg-navy text-white" : "bg-ink/5 text-ink/70 hover:bg-ink/10"}`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Persona */}
      <div className="mt-3">
        <p className="mb-1 text-xs font-medium text-warmgrey">Who should draft it?</p>
        <div className="flex flex-wrap gap-1.5">
          {STRATEGY_PERSONAS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPersona(p.key)}
              title={p.blurb}
              className={`rounded-full px-3 py-1 text-xs ${persona === p.key ? "bg-navy text-white" : "bg-ink/5 text-ink/70 hover:bg-ink/10"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-warmgrey">{strategyPersonaMeta(persona)?.blurb}</p>
      </div>

      {/* Brief */}
      <div className="mt-3">
        <p className="mb-1 text-xs font-medium text-warmgrey">Anything to add? (optional)</p>
        <textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          rows={3}
          placeholder={meta.briefPlaceholder}
          className="w-full rounded border border-ink/15 px-2 py-1.5 text-sm"
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          onClick={generate}
          disabled={busy}
          className="rounded bg-navy px-4 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {busy ? "Drafting…" : `Draft my ${meta.label.toLowerCase()}`}
        </button>
        <label className="flex items-center gap-1.5 text-xs text-warmgrey">
          <input type="checkbox" checked={plain} onChange={(e) => setPlain(e.target.checked)} />
          Plain language — no jargon
        </label>
        <span className="text-xs text-warmgrey">Grounded in your Brand Brain &amp; R&amp;D. Draft it, then edit anything.</span>
      </div>
    </div>
  );
}

// ---- Rendering a finished document -----------------------------------------

function SectionView({ section }: { section: StrategySection }) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-ink">{section.heading}</h4>
      {section.kind === "text" && section.body && (
        <p className="mt-1 whitespace-pre-line text-sm text-ink/80">{section.body}</p>
      )}
      {section.kind === "list" && section.items && (
        <ul className="mt-1 space-y-1">
          {section.items.map((it, i) => (
            <li key={i} className="flex gap-2 text-sm text-ink/80">
              <span className="text-navy/50">•</span>
              <span>{it}</span>
            </li>
          ))}
        </ul>
      )}
      {section.kind === "keyvalue" && section.pairs && (
        <dl className="mt-1 space-y-1.5">
          {section.pairs.map((p, i) => (
            <div key={i} className="grid grid-cols-1 gap-0.5 sm:grid-cols-[9rem_1fr] sm:gap-2">
              <dt className="text-xs font-medium text-warmgrey">{p.label}</dt>
              <dd className="text-sm text-ink/80">{p.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {section.kind === "okr" && section.objectives && (
        <div className="mt-1 space-y-3">
          {section.objectives.map((o, i) => (
            <div key={i} className="rounded-lg border border-ink/10 bg-ink/[0.02] p-3">
              <p className="text-sm font-medium text-ink">{o.objective}</p>
              {o.rationale && <p className="mt-0.5 text-xs text-warmgrey">{o.rationale}</p>}
              <ul className="mt-1.5 space-y-1">
                {o.keyResults.map((kr, j) => (
                  <li key={j} className="flex flex-wrap items-baseline gap-x-2 text-sm text-ink/80">
                    <span className="text-navy/50">→</span>
                    <span>{kr.kr}</span>
                    {kr.target && <span className="rounded bg-palm/15 px-1.5 py-0.5 text-xs text-palm">{kr.target}</span>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ActionRow({
  action,
  index,
  scheduled,
  onSchedule,
}: {
  action: StrategyAction;
  index: number;
  scheduled: boolean;
  onSchedule: (index: number) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const date = futureDate(action.dueInDays);
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-ink/10 bg-white px-3 py-2">
      <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${action.kind === "deadline" ? "bg-terracotta/15 text-terracotta-deep" : "bg-saffron/20 text-bark"}`}>
        {action.kind}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-ink">{action.title}</p>
        {action.detail && <p className="text-xs text-warmgrey">{action.detail}</p>}
      </div>
      <span className="text-xs text-warmgrey">{date}</span>
      {scheduled ? (
        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs text-emerald-800">On calendar ✓</span>
      ) : (
        <button
          onClick={async () => {
            setBusy(true);
            try {
              await onSchedule(index);
            } finally {
              setBusy(false);
            }
          }}
          disabled={busy}
          className="rounded-full border border-navy/25 bg-navy/[0.04] px-2.5 py-1 text-xs font-medium text-navy transition hover:bg-navy/10 disabled:opacity-50"
        >
          {busy ? "Adding…" : "Add to calendar"}
        </button>
      )}
    </div>
  );
}

function DocCard({ doc, onChanged }: { doc: StrategyDoc; onChanged: () => void }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const scheduledSet = useMemo(() => new Set(doc.scheduled), [doc.scheduled]);
  const content = doc.content;
  const unscheduled = content ? content.actions.map((_, i) => i).filter((i) => !scheduledSet.has(i)) : [];

  const schedule = async (indexes: number[]) => {
    if (!indexes.length) return;
    const res = await api.post<{ added: number }>(`/api/admin/strategy/${doc.id}/schedule`, { actions: indexes });
    if (res.added > 0) {
      toast.success(
        `${res.added} ${res.added === 1 ? "step" : "steps"} added to your calendar`,
        "Find them on the Production Calendar.",
      );
    }
    onChanged();
  };

  const setStatus = async (status: "active" | "archived") => {
    await api.patch(`/api/admin/strategy/${doc.id}`, { status });
    onChanged();
  };

  const remove = async () => {
    const res = await api.delete<{ ok: boolean; undoId?: string }>(`/api/admin/strategy/${doc.id}`);
    onChanged();
    if (res.undoId) {
      const undoId = res.undoId;
      toast.undo(`Deleted “${doc.title}”.`, async () => {
        await api.post(`/api/admin/undo/${undoId}`, {});
        onChanged();
      });
    }
  };

  return (
    <div className={`rounded-lg border bg-white ${doc.status === "archived" ? "border-ink/10 opacity-70" : "border-ink/10"}`}>
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <button onClick={() => setOpen(!open)} className="min-w-0 flex-1 text-left">
          <span className="font-medium text-ink">{doc.title}</span>
          <span className="ml-2 text-xs text-warmgrey">
            {strategyDocLabel(doc.kind, doc.variant)} · {strategyPersonaMeta(doc.persona)?.label ?? doc.persona} · {sinceLabel(doc.createdAt)}
          </span>
        </button>
        {doc.provider === "workers-ai" && (
          <span className="rounded-full bg-ink/5 px-2 py-0.5 text-[10px] text-warmgrey" title="Drafted on Workers AI Llama — add an Anthropic key in Settings → AI for sharper results.">
            Llama
          </span>
        )}
        {content && content.actions.length > 0 && (
          <span className="text-xs text-warmgrey">
            {doc.scheduled.length}/{content.actions.length} scheduled
          </span>
        )}
        <span className="text-warmgrey">{open ? "▲" : "▼"}</span>
      </div>

      {open && content && (
        <div className="space-y-4 border-t border-ink/5 px-3 py-3">
          {content.summary && (
            <div className="rounded-lg bg-navy/[0.03] p-3">
              <Markdown text={content.summary} headingBase={2} />
            </div>
          )}

          <div className="space-y-4">
            {content.sections.map((s, i) => (
              <SectionView key={i} section={s} />
            ))}
          </div>

          {content.actions.length > 0 && (
            <div className="border-t border-ink/8 pt-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-ink">Next steps</h4>
                {unscheduled.length > 0 && (
                  <button
                    onClick={() => void schedule(unscheduled)}
                    className="rounded-full border border-navy/25 bg-navy/[0.04] px-2.5 py-1 text-xs font-medium text-navy transition hover:bg-navy/10"
                  >
                    Add all {unscheduled.length} to calendar
                  </button>
                )}
              </div>
              <div className="space-y-1.5">
                {content.actions.map((a, i) => (
                  <ActionRow
                    key={i}
                    action={a}
                    index={i}
                    scheduled={scheduledSet.has(i)}
                    onSchedule={(idx) => schedule([idx])}
                  />
                ))}
              </div>
              <p className="mt-2 text-xs text-warmgrey">
                Scheduled steps land on your{" "}
                <Link to="/admin/production" className="text-navy hover:underline">
                  Production Calendar
                </Link>
                .
              </p>
            </div>
          )}

          <div className="flex items-center gap-3 border-t border-ink/8 pt-3 text-xs">
            {doc.status === "archived" ? (
              <button onClick={() => void setStatus("active")} className="text-navy hover:underline">
                Unarchive
              </button>
            ) : (
              <button onClick={() => void setStatus("archived")} className="text-warmgrey hover:underline">
                Archive
              </button>
            )}
            <button onClick={remove} className="text-red-600 hover:underline">
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * What the strategy engine is grounded in, made visible — and, when the Brand
 * Brain is empty, an honest nudge to fill the Launch Playbook first (that's
 * where the real specificity comes from). You can still draft from the brief.
 */
function GroundingStrip() {
  const brain = useFetch<{ answers: Record<string, unknown> }>("/api/admin/brain");
  const overview = useFetch<{ counts: { brands: number; trendBoards: number } }>("/api/admin/research/overview");
  if (brain.loading) return null;

  const answers = brain.data?.answers ?? {};
  const brainFilled = Object.values(answers).filter((v) =>
    Array.isArray(v) ? v.length : String(v ?? "").trim(),
  ).length;
  const brands = overview.data?.counts.brands ?? 0;
  const trends = overview.data?.counts.trendBoards ?? 0;

  if (brainFilled === 0) {
    return (
      <div className="mb-4 rounded-xl border border-saffron/30 bg-saffron/[0.06] p-3 text-sm">
        <p className="font-medium text-ink">Fill the Launch Playbook first for brand-specific plans</p>
        <p className="mt-0.5 text-warmgrey">
          Strategy reads your <Link to="/admin/launch" className="text-navy underline">Launch Playbook</Link> (your brand,
          customer, price position, collection) and your R&amp;D. With none of it filled in yet, drafts will lean on
          general best practice — still useful, but not yet about <em>your</em> brand. You can also just describe the
          situation in the brief box below.
        </p>
      </div>
    );
  }

  const parts = [
    `your brand profile (${brainFilled} field${brainFilled === 1 ? "" : "s"})`,
    brands > 0 ? `${brands} competitor dossier${brands === 1 ? "" : "s"}` : null,
    trends > 0 ? `${trends} trend board${trends === 1 ? "" : "s"}` : null,
  ].filter(Boolean);

  return (
    <div className="mb-4 rounded-lg border border-palm/25 bg-palm/[0.05] px-3 py-2 text-xs text-ink/75">
      <span className="mr-1">✓</span>
      Grounded in {parts.join(", ")}. The more of your{" "}
      <Link to="/admin/launch" className="text-navy underline">Launch Playbook</Link> and{" "}
      <Link to="/admin/research/brands" className="text-navy underline">R&amp;D</Link> you fill in, the sharper every draft.
    </div>
  );
}

export function StrategyPage() {
  const docs = useFetch<StrategyDoc[]>("/api/admin/strategy");
  const [showArchived, setShowArchived] = useState(false);

  const list = docs.data ?? [];
  const visible = list.filter((d) => (showArchived ? true : d.status !== "archived"));
  const archivedCount = list.filter((d) => d.status === "archived").length;

  return (
    <div>
      <PageHeader
        title="Business strategy"
        eyebrow="R&D"
        description="Sit down with a strategy advisor. Build a SWOT, a business plan, quarterly OKRs, or a competitive map — each one grounded in your own brand — then turn the next steps into calendar dates."
        help="rd-strategy"
      />
      <ResearchNav />

      <GroundingStrip />

      <Generator onCreated={() => docs.reload()} />

      {visible.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base text-ink">Your strategy documents</h3>
            {archivedCount > 0 && (
              <button onClick={() => setShowArchived((v) => !v)} className="text-xs text-warmgrey hover:underline">
                {showArchived ? "Hide archived" : `Show archived (${archivedCount})`}
              </button>
            )}
          </div>
          {visible.map((doc) => (
            <DocCard key={doc.id} doc={doc} onChanged={() => docs.reload()} />
          ))}
        </div>
      ) : (
        !docs.loading && (
          <EmptyState
            title="No strategy documents yet"
            hint="Pick a tool above. Verto reads your Brand Brain and R&D, then drafts a working document you can edit — and every one ends with next steps you can drop straight onto your calendar."
          />
        )
      )}
    </div>
  );
}
