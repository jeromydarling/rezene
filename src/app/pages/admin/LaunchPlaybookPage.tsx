import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { api, ApiRequestError } from "../../lib/api";
import { useToast } from "../../lib/toast";
import { extractPdfText } from "../../lib/pdfText";
import { ErrorNote, LoadingTable, PageHeader } from "../../components/admin/ui";
import { KbMarkdown } from "../../kb/KbMarkdown";
import { PLAYBOOK, type PbField } from "../../../shared/playbook";

interface BrainState {
  mode: "established" | "new" | null;
  status: string;
  onboarded: boolean;
  answers: Record<string, unknown>;
  checklist: Record<string, boolean>;
  brief: BrainBrief | null;
  planMarkdown: string | null;
  updatedAt: string;
}
interface BrainBrief {
  name?: string;
  oneLiner?: string;
  voice?: string;
  customer?: string;
  aesthetic?: string;
  priceArchitecture?: string;
  productionRegion?: string;
  markets?: string[];
  launchDate?: string;
  heroConcept?: string;
  nextSteps?: string[];
}

export function LaunchPlaybookPage() {
  const { data, loading, error, reload } = useFetchBrain();
  if (loading) return <LoadingTable rows={5} />;
  if (error) return <ErrorNote message={error} />;
  if (!data) return null;
  if (!data.mode) return <OnboardingFork onChanged={reload} />;
  if (data.mode === "established") return <EstablishedLane brain={data} onChanged={reload} />;
  return <Playbook brain={data} onChanged={reload} />;
}

function useFetchBrain() {
  const [data, setData] = useState<BrainState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = () => {
    api
      .get<BrainState>("/api/admin/brain")
      .then((d) => setData(d))
      .catch((e) => setError(e instanceof ApiRequestError ? e.message : "Couldn't load your plan"))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);
  return { data, loading, error, reload: load };
}

// ---------------- Onboarding fork ----------------

function OnboardingFork({ onChanged }: { onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  async function pick(mode: "established" | "new") {
    setBusy(mode);
    try {
      await api.put("/api/admin/brain", { mode });
      onChanged();
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="Launch" title="Let's get your brand running" help="welcome" />
      <p className="mb-6 max-w-2xl text-warmgrey">
        Two ways in. Pick the one that fits — you can change later.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void pick("established")}
          className="admin-card p-6 text-left transition hover:border-navy/40 hover:shadow-md"
        >
          <p className="text-2xl">📦</p>
          <h3 className="mt-2 font-display text-xl font-light">I'm established</h3>
          <p className="mt-1 text-sm text-warmgrey">
            You already have a brand. Bring everything in — products, suppliers, styles, customers,
            content — and we'll wire it up.
          </p>
          <span className="mt-3 inline-block text-sm font-medium text-navy">{busy === "established" ? "Setting up…" : "Import my business →"}</span>
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void pick("new")}
          className="admin-card p-6 text-left transition hover:border-navy/40 hover:shadow-md"
        >
          <p className="text-2xl">🌱</p>
          <h3 className="mt-2 font-display text-xl font-light">I'm just getting started</h3>
          <p className="mt-1 text-sm text-warmgrey">
            From nothing to a real brand. We'll walk you through the Launch Playbook, then Verto sets
            up every section from your plan.
          </p>
          <span className="mt-3 inline-block text-sm font-medium text-navy">{busy === "new" ? "Setting up…" : "Start the Launch Playbook →"}</span>
        </button>
      </div>
    </div>
  );
}

// ---------------- Established (import) lane ----------------

const IMPORT_TARGETS = [
  { label: "Products & variants", to: "/admin/import", note: "CSV import with AI column mapping — live now.", ready: true },
  { label: "Suppliers / factories", to: "/admin/suppliers", note: "Add makers, or bulk-import (coming).", ready: true },
  { label: "Styles & tech packs", to: "/admin/styles", note: "Create styles; bulk import coming.", ready: true },
  { label: "Content & pages", to: "/admin/content/pages", note: "Build pages; site import coming.", ready: true },
];

function EstablishedLane({ brain, onChanged }: { brain: BrainState; onChanged: () => void }) {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Launch"
        title="Bring your business in"
        help="import"
        actions={
          <button type="button" className="link-quiet text-sm" onClick={() => void api.put("/api/admin/brain", { mode: "new" }).then(onChanged)}>
            Switch to the guided plan
          </button>
        }
      />
      <p className="mb-5 max-w-2xl text-warmgrey">
        Move each part of your existing brand into Verto. Start with your catalog — the Import Studio
        maps a spreadsheet in minutes.
      </p>
      <div className="space-y-3">
        {IMPORT_TARGETS.map((t) => (
          <Link key={t.label} to={t.to} className="admin-card flex items-center justify-between gap-3 p-4 hover:bg-cream">
            <div>
              <p className="font-medium">{t.label}</p>
              <p className="text-xs text-warmgrey">{t.note}</p>
            </div>
            <span className="text-navy">→</span>
          </Link>
        ))}
      </div>
      <p className="mt-6 text-xs text-warmgrey">
        Tip: once your data's in, open the <Link to="/admin/support/kb/welcome" className="text-navy hover:underline">handbook</Link> for a tour of every module.
      </p>
      {brain.brief && <CompiledPlan brain={brain} />}
    </div>
  );
}

// ---------------- The Playbook ----------------

function Playbook({ brain, onChanged }: { brain: BrainState; onChanged: () => void }) {
  const toast = useToast();
  const [answers, setAnswers] = useState<Record<string, unknown>>(brain.answers ?? {});
  const [checklist, setChecklist] = useState<Record<string, boolean>>(brain.checklist ?? {});
  const [compiling, setCompiling] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filledCount = useMemo(
    () => Object.values(answers).filter((v) => (Array.isArray(v) ? v.length : String(v ?? "").trim())).length,
    [answers],
  );

  function setField(id: string, value: unknown) {
    setAnswers((a) => ({ ...a, [id]: value }));
  }
  function saveField(id: string, value: unknown) {
    void api.put("/api/admin/brain", { answers: { [id]: value } }).catch(() => {});
  }
  function toggleCheck(key: string, on: boolean) {
    setChecklist((c) => ({ ...c, [key]: on }));
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void api.put("/api/admin/brain", { checklist: { [key]: on } }).catch(() => {}), 300);
  }

  function mergeAnswers(incoming: Record<string, unknown>) {
    const merged = { ...answers, ...incoming };
    setAnswers(merged);
    void api.put("/api/admin/brain", { answers: incoming }).catch(() => {});
    const n = Object.keys(incoming).length;
    toast.success(`Filled ${n} field${n === 1 ? "" : "s"}`, "Review and tweak anything — it's all yours to edit.");
  }

  async function compile() {
    setCompiling(true);
    try {
      await api.post("/api/admin/brain/compile", {});
      onChanged();
      toast.success("Your plan is compiled", "Scroll down for your business plan and next steps.");
    } catch (e) {
      toast.error(e instanceof ApiRequestError ? e.message : "Couldn't compile");
    } finally {
      setCompiling(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Launch"
        title="Launch Playbook"
        help="welcome"
        description="Fill in the blanks — or let AI draft them. When you're ready, compile it into a real plan that sets up every section of Verto."
        actions={
          <button type="button" className="btn btn-primary" disabled={compiling || filledCount === 0} onClick={() => void compile()}>
            {compiling ? "Compiling…" : "Compile my plan"}
          </button>
        }
      />

      <PlanImport onFilled={mergeAnswers} />

      <p className="mb-4 mt-6 text-xs text-warmgrey">{filledCount} field{filledCount === 1 ? "" : "s"} filled · autosaves as you go</p>

      <div className="space-y-8">
        {PLAYBOOK.map((part) => (
          <section key={part.slug}>
            <h2 className="font-display text-xl font-light">{part.title}</h2>
            <p className="mb-3 text-sm text-warmgrey">{part.summary}</p>
            <div className="space-y-5">
              {part.sections.map((section) => (
                <div key={section.id} className="admin-card p-4">
                  <h3 className="text-sm font-semibold">{section.title}</h3>
                  {section.intro && <p className="mt-0.5 text-xs text-warmgrey">{section.intro}</p>}
                  <div className="mt-3 grid gap-3">
                    {section.fields.map((f) => (
                      <FieldInput
                        key={f.id}
                        field={f}
                        value={answers[f.id]}
                        onChange={(v) => setField(f.id, v)}
                        onCommit={(v) => saveField(f.id, v)}
                      />
                    ))}
                  </div>
                  {section.checklist && (
                    <div className="mt-3 space-y-1.5 border-t border-ink/8 pt-3">
                      {section.checklist.map((item) => {
                        const key = `${section.id}:${item}`;
                        return (
                          <label key={key} className="flex items-start gap-2 text-xs">
                            <input type="checkbox" checked={Boolean(checklist[key])} onChange={(e) => toggleCheck(key, e.target.checked)} className="mt-0.5" />
                            <span className={checklist[key] ? "text-warmgrey line-through" : ""}>{item}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      {brain.brief && <CompiledPlan brain={brain} />}
    </div>
  );
}

function FieldInput({
  field,
  value,
  onChange,
  onCommit,
}: {
  field: PbField;
  value: unknown;
  onChange: (v: unknown) => void;
  onCommit: (v: unknown) => void;
}) {
  const label = (
    <span className="mb-1 block text-xs font-medium text-warmgrey">
      {field.label}
      {field.help && <span className="ml-1 font-normal text-warmgrey/70">— {field.help}</span>}
    </span>
  );
  if (field.type === "select") {
    return (
      <label className="block">
        {label}
        <select className="input" value={String(value ?? "")} onChange={(e) => { onChange(e.target.value); onCommit(e.target.value); }}>
          <option value="">Choose…</option>
          {field.options?.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </label>
    );
  }
  if (field.type === "list") {
    const text = Array.isArray(value) ? value.join(", ") : String(value ?? "");
    return (
      <label className="block">
        {label}
        <input
          className="input"
          placeholder={field.placeholder || "Comma-separated"}
          defaultValue={text}
          onBlur={(e) => {
            const arr = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
            onChange(arr);
            onCommit(arr);
          }}
        />
      </label>
    );
  }
  if (field.type === "textarea") {
    return (
      <label className="block">
        {label}
        <textarea
          className="input"
          rows={3}
          placeholder={field.placeholder}
          defaultValue={String(value ?? "")}
          onBlur={(e) => { onChange(e.target.value); onCommit(e.target.value); }}
        />
      </label>
    );
  }
  return (
    <label className="block">
      {label}
      <input
        className="input"
        placeholder={field.placeholder}
        defaultValue={String(value ?? "")}
        onBlur={(e) => { onChange(e.target.value); onCommit(e.target.value); }}
      />
    </label>
  );
}

// ---------------- Plan import (generate / paste / PDF) ----------------

function PlanImport({ onFilled }: { onFilled: (a: Record<string, unknown>) => void }) {
  const toast = useToast();
  const [tab, setTab] = useState<"ai" | "paste" | "pdf">("ai");
  const [busy, setBusy] = useState(false);
  const [gen, setGen] = useState({ idea: "", category: "", market: "" });
  const [pasteText, setPasteText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function generate() {
    if (!gen.idea.trim()) return;
    setBusy(true);
    try {
      const res = await api.post<{ answers: Record<string, unknown> }>("/api/admin/brain/generate", gen);
      onFilled(res.answers ?? {});
    } catch (e) {
      toast.error(e instanceof ApiRequestError ? e.message : "Couldn't draft");
    } finally {
      setBusy(false);
    }
  }
  async function parse(text: string) {
    if (text.trim().length < 40) return toast.error("Not enough text to parse");
    setBusy(true);
    try {
      const res = await api.post<{ answers: Record<string, unknown> }>("/api/admin/brain/parse", { text });
      onFilled(res.answers ?? {});
    } catch (e) {
      toast.error(e instanceof ApiRequestError ? e.message : "Couldn't parse");
    } finally {
      setBusy(false);
    }
  }
  async function onPdf(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const text = await extractPdfText(file);
      if (!text.trim()) throw new Error("No selectable text found in that PDF.");
      await parse(text);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't read the PDF");
      setBusy(false);
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="admin-card p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-warmgrey">Kickstart the plan</p>
      <div className="mb-3 flex gap-2 text-xs">
        {([["ai", "✨ Draft with AI"], ["paste", "📋 Paste my plan"], ["pdf", "📄 Upload a PDF"]] as const).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={`rounded-full border px-3 py-1 ${tab === k ? "border-navy bg-navy text-chalk" : "border-ink/15 hover:border-ink/40"}`}>
            {l}
          </button>
        ))}
      </div>

      {tab === "ai" && (
        <div className="space-y-2">
          <input className="input" placeholder="Your brand idea in a sentence" value={gen.idea} onChange={(e) => setGen({ ...gen, idea: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <input className="input" placeholder="Category (optional)" value={gen.category} onChange={(e) => setGen({ ...gen, category: e.target.value })} />
            <input className="input" placeholder="Main market (optional)" value={gen.market} onChange={(e) => setGen({ ...gen, market: e.target.value })} />
          </div>
          <button type="button" className="btn btn-secondary w-full !py-1.5 text-xs" disabled={busy} onClick={() => void generate()}>
            {busy ? "Drafting your plan…" : "Draft the whole Playbook"}
          </button>
          <p className="text-[11px] text-warmgrey">Uses live research where available — always review before compiling.</p>
        </div>
      )}
      {tab === "paste" && (
        <div className="space-y-2">
          <textarea className="input" rows={5} placeholder="Paste your existing launch plan / brief here…" value={pasteText} onChange={(e) => setPasteText(e.target.value)} />
          <button type="button" className="btn btn-secondary w-full !py-1.5 text-xs" disabled={busy} onClick={() => void parse(pasteText)}>
            {busy ? "Parsing…" : "Parse into the Playbook"}
          </button>
        </div>
      )}
      {tab === "pdf" && (
        <div className="space-y-2">
          <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => void onPdf(e.target.files?.[0])} />
          <button type="button" className="btn btn-secondary w-full !py-1.5 text-xs" disabled={busy} onClick={() => fileRef.current?.click()}>
            {busy ? "Reading your PDF…" : "Choose a PDF launch plan"}
          </button>
          <p className="text-[11px] text-warmgrey">We read the text in your browser and parse it into the Playbook. Needs a text-based PDF (not a scan).</p>
        </div>
      )}
    </div>
  );
}

// ---------------- Compiled plan + seeding ----------------

const SEED_LINKS = [
  { to: "/admin/settings", label: "Brand identity & voice", desc: "Set your name, tagline, and voice." },
  { to: "/admin/ai-concepts", label: "Design your hero style", desc: "Send your concept to the Design Studio." },
  { to: "/admin/costing", label: "Build your cost sheet", desc: "Model your price architecture & margin." },
  { to: "/admin/duties", label: "Set your duty lanes", desc: "Add duty rules for your markets." },
  { to: "/admin/sourcing", label: "Find your makers", desc: "Research factories for your region." },
  { to: "/admin/production", label: "Plan your calendar", desc: "Lay out milestones to your launch date." },
];

function CompiledPlan({ brain }: { brain: BrainState }) {
  const brief = brain.brief;
  return (
    <div className="mt-10 border-t border-ink/10 pt-6">
      <h2 className="font-display text-2xl font-light">Your business plan</h2>
      {brief?.oneLiner && <p className="mt-1 text-warmgrey">{brief.oneLiner}</p>}

      {brief?.nextSteps && brief.nextSteps.length > 0 && (
        <div className="admin-card mt-4 border-navy/20 bg-navy/[0.03] p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-warmgrey">Your next steps</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink/80">
            {brief.nextSteps.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      )}

      <div className="mt-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-warmgrey">Set up your app</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {SEED_LINKS.map((s) => (
            <Link key={s.to} to={s.to} className="admin-card flex items-center justify-between gap-2 p-3 hover:bg-cream">
              <div>
                <p className="text-sm font-medium">{s.label}</p>
                <p className="text-xs text-warmgrey">{s.desc}</p>
              </div>
              <span className="text-navy">→</span>
            </Link>
          ))}
        </div>
      </div>

      {brain.planMarkdown && (
        <div className="admin-card mt-6 p-6">
          <KbMarkdown text={brain.planMarkdown} />
        </div>
      )}
    </div>
  );
}
