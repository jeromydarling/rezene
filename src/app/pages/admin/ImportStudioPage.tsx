import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { api, ApiRequestError } from "../../lib/api";
import { useToast } from "../../lib/toast";
import { ErrorNote, PageHeader } from "../../components/admin/ui";

/**
 * LLM-assisted import studio. Drop any product spreadsheet; the LLM maps its
 * columns to Verto's catalog, you confirm the mapping and preview, then bulk
 * import — products grouped by name, each row becoming a variant, with
 * collections created on the fly.
 */

interface FieldDef {
  key: string;
  label: string;
  required?: boolean;
}
interface Analysis {
  headers: string[];
  rows: string[][];
  rowCount: number;
  truncated: boolean;
  mapping: Record<string, number | null>;
  mappedBy: "ai" | "heuristic";
  fields: FieldDef[];
}
interface ApplyResult {
  productsCreated: number;
  variantsCreated: number;
  skipped: string[];
}

export function ImportStudioPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [mapping, setMapping] = useState<Record<string, number | null>>({});
  const [busy, setBusy] = useState<"analyze" | "apply" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApplyResult | null>(null);
  const [fileName, setFileName] = useState("");

  async function analyze(file: File) {
    setBusy("analyze");
    setError(null);
    setResult(null);
    setFileName(file.name);
    try {
      const form = new FormData();
      form.set("file", file);
      const res = await api.upload<Analysis>("/api/admin/import/analyze", form);
      setAnalysis(res);
      setMapping(res.mapping);
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : "Couldn't read that file");
    } finally {
      setBusy(null);
    }
  }

  async function apply() {
    if (!analysis) return;
    setBusy("apply");
    setError(null);
    try {
      const res = await api.post<ApplyResult>("/api/admin/import/apply", {
        headers: analysis.headers,
        rows: analysis.rows,
        mapping,
      });
      setResult(res);
      toast.success(
        `Imported ${res.productsCreated} product${res.productsCreated === 1 ? "" : "s"}`,
        `${res.variantsCreated} variants created. They're drafts — review and publish when ready.`,
      );
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : "Import failed");
    } finally {
      setBusy(null);
    }
  }

  const nameMapped = analysis && mapping.name != null;
  const productGroups = analysis ? new Set(analysis.rows.map((r) => (mapping.name != null ? r[mapping.name] : "")).filter(Boolean)).size : 0;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        eyebrow="Catalog"
        title="Import studio"
        help="import"
        description="Bring products in from any spreadsheet — the LLM figures out your columns, you confirm, and it imports."
      />

      {error && <ErrorNote message={error} />}

      {result ? (
        <div className="admin-card space-y-4 p-6 text-center">
          <p className="font-display text-2xl font-light">Imported ✓</p>
          <p className="text-sm text-warmgrey">
            {result.productsCreated} products and {result.variantsCreated} variants created as drafts.
            {result.skipped.length > 0 && ` ${result.skipped.length} rows were skipped (duplicates or errors).`}
          </p>
          <div className="flex justify-center gap-2">
            <button type="button" className="btn btn-primary" onClick={() => navigate("/admin/products")}>
              Review products
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setAnalysis(null);
                setResult(null);
              }}
            >
              Import another
            </button>
          </div>
        </div>
      ) : !analysis ? (
        <div className="admin-card flex flex-col items-center gap-4 p-10 text-center">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={(e) => e.target.files?.[0] && void analyze(e.target.files[0])}
          />
          <p className="text-sm text-warmgrey">
            Upload a CSV export from Shopify, another platform, or your own spreadsheet.
            One row per product, or one row per colour/size variant.
          </p>
          <button type="button" className="btn btn-primary" disabled={busy === "analyze"} onClick={() => fileRef.current?.click()}>
            {busy === "analyze" ? "Reading…" : "Choose a CSV file"}
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="admin-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-light">Match your columns</h2>
              <span className="text-xs text-warmgrey">
                {fileName} · {analysis.rowCount} rows{analysis.truncated ? " (first 2000)" : ""} ·{" "}
                {analysis.mappedBy === "ai" ? "LLM-matched" : "auto-matched"}
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {analysis.fields.map((f) => (
                <label key={f.key} className="flex items-center justify-between gap-2 rounded-md border border-ink/10 px-3 py-2 text-sm">
                  <span className={f.required ? "font-medium" : ""}>
                    {f.label}
                    {f.required && <span className="text-red-600"> *</span>}
                  </span>
                  <select
                    className="input !w-40 !py-1 text-xs"
                    value={mapping[f.key] ?? ""}
                    onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value === "" ? null : Number(e.target.value) })}
                  >
                    <option value="">— none —</option>
                    {analysis.headers.map((h, i) => (
                      <option key={i} value={i}>
                        {h || `Column ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            {!nameMapped && <p className="mt-3 field-error">Choose which column holds the product name to continue.</p>}
          </div>

          {/* Preview */}
          <div className="admin-card overflow-x-auto p-0">
            <div className="border-b border-ink/10 px-4 py-2 text-xs font-medium text-warmgrey">
              Preview — first {Math.min(5, analysis.rows.length)} rows as they'll import
            </div>
            <table className="admin-table">
              <thead>
                <tr>
                  {analysis.fields
                    .filter((f) => mapping[f.key] != null)
                    .map((f) => (
                      <th key={f.key}>{f.label}</th>
                    ))}
                </tr>
              </thead>
              <tbody>
                {analysis.rows.slice(0, 5).map((row, ri) => (
                  <tr key={ri}>
                    {analysis.fields
                      .filter((f) => mapping[f.key] != null)
                      .map((f) => (
                        <td key={f.key} className="max-w-[200px] truncate text-xs">
                          {row[mapping[f.key] as number]}
                        </td>
                      ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              className="link-quiet text-sm"
              onClick={() => {
                setAnalysis(null);
                setError(null);
              }}
            >
              ← Start over
            </button>
            <button type="button" className="btn btn-primary" disabled={!nameMapped || busy === "apply"} onClick={() => void apply()}>
              {busy === "apply" ? "Importing…" : `Import ${productGroups} product${productGroups === 1 ? "" : "s"}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
