import { useState } from "react";
import { Link, useParams } from "react-router";
import { useFetch } from "../../lib/useFetch";
import { api, ApiRequestError } from "../../lib/api";
import { titleCase } from "../../lib/format";
import { ErrorNote, LoadingTable, PageHeader } from "../../components/admin/ui";
import type { AdminTechPackDetail, AdminTechPackSummary } from "../../../shared/types";

const ACTIONS: { id: string; label: string; hint: string; needsInput?: string; needsOther?: boolean }[] = [
  { id: "bom", label: "Draft BOM", hint: "First-pass bill of materials from the garment description." },
  { id: "construction_notes", label: "Construction notes", hint: "Area-by-area make notes for the atelier." },
  { id: "qc_checklist", label: "QC checklist", hint: "Final-inspection checklist, 8–14 checkable items." },
  { id: "measurement_points", label: "Measurement points", hint: "POM suggestions with how-to-measure and tolerances." },
  { id: "grading_rules", label: "Grading rules", hint: "Per-size increment suggestions." },
  { id: "translate_fr", label: "Translate to French", hint: "Factory notes in Moroccan-atelier French.", needsInput: "Notes to translate (leave blank to use the pack's construction notes)" },
  { id: "factory_summary", label: "Factory summary", hint: "Concise EN/FR briefing with open questions." },
  { id: "factory_email", label: "Factory email", hint: "Proto-quote request email, EN + FR.", needsInput: "Extra instructions (optional)" },
  { id: "completeness_check", label: "Completeness check", hint: "What's missing before this can go to a factory." },
  { id: "compare_versions", label: "Compare versions", hint: "Diff two tech packs, section by section.", needsOther: true },
];

interface AssistResponse {
  action: string;
  result: unknown;
  applicableSectionKind: string | null;
  usage: { tokensIn: number; tokensOut: number; model: string };
}

export function TechPackAiPage() {
  const { id } = useParams();
  const pack = useFetch<AdminTechPackDetail>(id ? `/api/admin/tech-packs/${id}` : null);
  const allPacks = useFetch<AdminTechPackSummary[]>("/api/admin/tech-packs");

  const [active, setActive] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [otherId, setOtherId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<AssistResponse | null>(null);
  const [applied, setApplied] = useState(false);

  const activeSpec = ACTIONS.find((a) => a.id === active) ?? null;

  async function runAction() {
    if (!id || !active) return;
    setBusy(true);
    setError(null);
    setResponse(null);
    setApplied(false);
    try {
      const res = await api.post<AssistResponse>(`/api/admin/tech-packs/${id}/ai-assist`, {
        action: active,
        input: input || undefined,
        otherTechPackId: otherId || undefined,
      });
      setResponse(res);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "AI assist failed");
    } finally {
      setBusy(false);
    }
  }

  async function applyToSection() {
    if (!id || !response?.applicableSectionKind) return;
    await api.patch(`/api/admin/tech-packs/${id}/sections/${response.applicableSectionKind}`, {
      content: response.result,
    });
    setApplied(true);
  }

  if (pack.loading) return <LoadingTable rows={6} />;
  if (pack.error) return <ErrorNote message={pack.error} />;
  if (!pack.data) return null;

  return (
    <div>
      <PageHeader
        eyebrow="AI Assist"
        title={pack.data.name}
        description="Structured first drafts, reviewed by you before anything reaches a factory. Runs server-side via the Anthropic API."
        actions={
          <Link to={`/admin/tech-packs/${id}`} className="btn btn-secondary">
            Back to tech pack
          </Link>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        {/* Action list */}
        <div className="space-y-2">
          {ACTIONS.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => {
                setActive(a.id);
                setResponse(null);
                setError(null);
              }}
              className={`admin-card w-full p-3 text-left transition-colors ${
                active === a.id ? "!border-navy ring-1 ring-navy" : "hover:border-ink/25"
              }`}
            >
              <p className="text-sm font-medium">{a.label}</p>
              <p className="text-xs text-warmgrey">{a.hint}</p>
            </button>
          ))}
        </div>

        {/* Run panel */}
        <div className="admin-card min-h-64 p-5">
          {!activeSpec && (
            <p className="py-16 text-center text-sm text-warmgrey">
              Choose an assist action. Output is a structured draft you can review and apply.
            </p>
          )}
          {activeSpec && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-light">{activeSpec.label}</h2>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy || (activeSpec.needsOther && !otherId)}
                  onClick={() => void runAction()}
                >
                  {busy ? "Thinking…" : "Generate"}
                </button>
              </div>
              {activeSpec.needsInput && (
                <div>
                  <label className="label">{activeSpec.needsInput}</label>
                  <textarea
                    rows={3}
                    className="input"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                  />
                </div>
              )}
              {activeSpec.needsOther && (
                <div>
                  <label className="label">Compare against</label>
                  <select
                    className="input"
                    value={otherId}
                    onChange={(e) => setOtherId(e.target.value)}
                  >
                    <option value="">Select a tech pack…</option>
                    {allPacks.data
                      ?.filter((p) => p.id !== id)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.code} — {p.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}
              {error && <ErrorNote message={error} />}
              {response && (
                <div className="space-y-3">
                  <ResultView result={response.result} />
                  <div className="flex items-center justify-between border-t border-ink/10 pt-3">
                    <p className="text-xs text-warmgrey">
                      {response.usage.model} · {response.usage.tokensIn}→{response.usage.tokensOut}{" "}
                      tokens
                    </p>
                    {response.applicableSectionKind && (
                      <button
                        type="button"
                        className="btn btn-terracotta"
                        disabled={applied}
                        onClick={() => void applyToSection()}
                      >
                        {applied
                          ? "Applied ✓"
                          : `Apply to ${titleCase(response.applicableSectionKind)} section`}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Render assist output: tables for rows, lists for items, prose for strings. */
function ResultView({ result }: { result: unknown }) {
  if (result == null) return null;
  if (typeof result !== "object") {
    return <p className="text-sm">{String(result)}</p>;
  }
  const obj = result as Record<string, unknown>;
  return (
    <div className="space-y-4">
      {Object.entries(obj).map(([key, value]) => {
        if (Array.isArray(value) && value.length > 0 && typeof value[0] === "object") {
          const rows = value as Record<string, unknown>[];
          const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
          return (
            <div key={key} className="overflow-x-auto">
              <p className="label">{titleCase(key)}</p>
              <table className="admin-table">
                <thead>
                  <tr>
                    {cols.map((col) => (
                      <th key={col}>{titleCase(col)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i}>
                      {cols.map((col) => (
                        <td key={col} className="align-top">
                          {String(row[col] ?? "—")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        if (Array.isArray(value)) {
          return (
            <div key={key}>
              <p className="label">{titleCase(key)}</p>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {value.map((v, i) => (
                  <li key={i}>{String(v)}</li>
                ))}
              </ul>
            </div>
          );
        }
        return (
          <div key={key}>
            <p className="label">{titleCase(key)}</p>
            <p className="whitespace-pre-wrap rounded bg-cream p-3 text-sm leading-relaxed">
              {String(value)}
            </p>
          </div>
        );
      })}
    </div>
  );
}
