import { useEffect, useMemo, useState } from "react";
import { PageHeader, EmptyState } from "../../components/admin/ui";
import { useFetch } from "../../lib/useFetch";
import { api } from "../../lib/api";
import { useToast } from "../../lib/toast";
import { SIZE_STEPS, type SizeStep } from "../../../shared/garments";
import {
  draftPatternSvg,
  patternAdjustables,
  PATTERN_BLOCKS,
  PATTERN_GROUPS,
  type BodyMeasurements,
  type PatternOptions,
} from "../../lib/patterns";
import type { AdminStyle } from "../../../shared/types";

/**
 * Pattern Studio — real, manufacturable 2D sewing patterns (FreeSewing),
 * drafted entirely in the browser. Pick a block, grade it to a size or a
 * person's measurements, adjust the cut with the block's native options, and
 * download a cutting-ready SVG. Saved patterns double as a made-to-measure
 * client book for shops with tailors on staff.
 */

interface SavedPattern {
  id: string;
  name: string;
  garmentId: string;
  fabricId: string;
  color: string | null;
  fit: Record<string, unknown>;
  styleId: string | null;
  styleName: string | null;
  updatedAt: string;
}

interface PatternState {
  size: SizeStep;
  easePct: number;
  lengthPct: number;
  sleevePct: number;
  seamAllowance: boolean;
  paperless: boolean;
  measurements: BodyMeasurements;
}

const DEFAULT_STATE: PatternState = {
  size: "M",
  easePct: 0,
  lengthPct: 0,
  sleevePct: 0,
  seamAllowance: true,
  paperless: true,
  measurements: {},
};

/** The old Fitting Studio stored fit as multipliers (ease 0.7–1.5, length
 *  0.8–1.2); the studio speaks % bonuses. Load either shape. */
function stateFromFit(fit: Record<string, unknown>): Partial<PatternState> {
  const out: Partial<PatternState> = {};
  const size = fit.size;
  if (typeof size === "string" && (SIZE_STEPS as readonly string[]).includes(size)) out.size = size as SizeStep;
  const pct = (v: unknown, multBase: number): number | undefined => {
    const n = Number(v);
    if (!Number.isFinite(n)) return undefined;
    // Values near 1.0 are legacy multipliers; convert. Larger values are %.
    return Math.abs(n) <= 2 ? Math.round((n - multBase) * 100) : Math.round(n);
  };
  const ease = pct(fit.easePct ?? fit.ease, 1);
  if (ease !== undefined) out.easePct = Math.min(25, Math.max(0, ease));
  const length = pct(fit.lengthPct ?? fit.length, 1);
  if (length !== undefined) out.lengthPct = Math.min(20, Math.max(-15, length));
  const sleeve = pct(fit.sleevePct ?? fit.sleeve, 1);
  if (sleeve !== undefined) out.sleevePct = Math.min(10, Math.max(-30, sleeve));
  if (typeof fit.seamAllowance === "boolean") out.seamAllowance = fit.seamAllowance;
  if (typeof fit.paperless === "boolean") out.paperless = fit.paperless;
  if (fit.measurements && typeof fit.measurements === "object") {
    out.measurements = fit.measurements as BodyMeasurements;
  }
  return out;
}

export function PatternStudioPage() {
  const toast = useToast();
  const [blockId, setBlockId] = useState(PATTERN_BLOCKS[0].id);
  const [state, setState] = useState<PatternState>(DEFAULT_STATE);
  const [describe, setDescribe] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [patternName, setPatternName] = useState("");
  const [styleId, setStyleId] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingToLibrary, setSavingToLibrary] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [pageFormat, setPageFormat] = useState<"a4" | "letter">("a4");
  const [visualising, setVisualising] = useState(false);
  const [visualised, setVisualised] = useState(false);

  // Fit notes arriving from the Fitting Studio: /admin/patterns?adjust=cropped,looser
  // Each refit chip maps to a slider delta, so a visual fit decision lands as a
  // drafting adjustment.
  useEffect(() => {
    const adjust = new URLSearchParams(window.location.search).get("adjust");
    if (!adjust) return;
    const DELTAS: Record<string, Partial<Record<"easePct" | "lengthPct" | "sleevePct", number>>> = {
      tighter: { easePct: -6 },
      looser: { easePct: 8 },
      cropped: { lengthPct: -10 },
      longer: { lengthPct: 10 },
      "sleeves-shorter": { sleevePct: -15 },
      "sleeves-longer": { sleevePct: 8 },
    };
    setState((s) => {
      let next = { ...s };
      for (const chip of adjust.split(",")) {
        const d = DELTAS[chip.trim()];
        if (!d) continue;
        if (d.easePct) next = { ...next, easePct: Math.min(25, Math.max(0, next.easePct + d.easePct)) };
        if (d.lengthPct) next = { ...next, lengthPct: Math.min(20, Math.max(-15, next.lengthPct + d.lengthPct)) };
        if (d.sleevePct) next = { ...next, sleevePct: Math.min(10, Math.max(-30, next.sleevePct + d.sleevePct)) };
      }
      return next;
    });
    toast.success("Fit notes applied", "The Fitting Studio's adjustments are on the sliders — pick the block that matches.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const styles = useFetch<AdminStyle[]>("/api/admin/styles");
  const saved = useFetch<SavedPattern[]>("/api/admin/fitting/looks");

  const adjustables = patternAdjustables(blockId);
  const block = PATTERN_BLOCKS.find((b) => b.id === blockId)!;

  const opts: PatternOptions = {
    easePct: state.easePct,
    lengthPct: state.lengthPct,
    sleevePct: state.sleevePct,
    seamAllowanceMm: state.seamAllowance ? 10 : 0,
    paperless: state.paperless,
  };
  const pattern = useMemo(
    () => draftPatternSvg(blockId, state.size, state.measurements, opts),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [blockId, state],
  );

  const hasMeasurements = Object.values(state.measurements).some((v) => v !== undefined);

  function set<K extends keyof PatternState>(key: K, value: PatternState[K]) {
    setState((s) => ({ ...s, [key]: value }));
  }

  function setMeasure(key: keyof BodyMeasurements, value: string) {
    const n = Number(value);
    setState((s) => ({
      ...s,
      measurements: { ...s.measurements, [key]: value === "" || !Number.isFinite(n) ? undefined : n },
    }));
  }

  async function draftFromWords() {
    if (!describe.trim()) return;
    setDrafting(true);
    try {
      const res = await api.post<{
        garmentId: string;
        fit: { size?: string; ease?: number; length?: number; sleeve?: number };
        rationale?: string;
      }>("/api/admin/fitting/design", { prompt: describe });
      if (PATTERN_BLOCKS.some((b) => b.id === res.garmentId)) setBlockId(res.garmentId);
      setState((s) => ({ ...s, ...stateFromFit(res.fit as Record<string, unknown>) }));
      toast.success("Pattern drafted", res.rationale || undefined);
    } catch {
      toast.error("Couldn't interpret that", "Try describing the garment a bit differently.");
    } finally {
      setDrafting(false);
    }
  }

  async function printPdf() {
    if (!pattern) return;
    setPrinting(true);
    try {
      const { downloadTiledPdf } = await import("../../lib/pattern-pdf");
      await downloadTiledPdf(pattern.svg, `${blockId}-${state.size}${hasMeasurements ? "-mtm" : ""}-pattern`, pageFormat);
      toast.success("Print-ready PDF saved", "Print at 100% scale and check the 5 cm bar on each page.");
    } catch (e) {
      toast.error("Couldn't build the PDF", e instanceof Error ? e.message : undefined);
    } finally {
      setPrinting(false);
    }
  }

  /** Pattern-first design: render THIS block + adjustments on a photoreal
   *  model via the Fitting Studio's generate path. */
  async function seeOnModel() {
    setVisualising(true);
    try {
      const bits: string[] = [];
      if (state.easePct >= 15) bits.push("an oversized, boxy fit");
      else if (state.easePct >= 7) bits.push("a relaxed fit with visible ease");
      else bits.push("a clean regular fit");
      if (adjustables.length && state.lengthPct <= -8) bits.push("a cropped hem");
      if (adjustables.length && state.lengthPct >= 8) bits.push("a longline hem");
      if (adjustables.sleeve && state.sleevePct <= -12) bits.push("short sleeves");
      if (adjustables.sleeve && state.sleevePct >= 6) bits.push("extra-long sleeves");
      const description = `a ${block.name.toLowerCase()} cut with ${bits.join(", ")}`;
      await api.post("/api/admin/fitting/generate", {
        description,
        fit: {
          ease: 1 + state.easePct / 100,
          length: 1 + state.lengthPct / 100,
          sleeve: adjustables.sleeve ? 1 + state.sleevePct / 100 : undefined,
        },
      });
      setVisualised(true);
      toast.success("Rendered on a model", "Open the Fitting Studio to see it — it's in Model renders.");
    } catch (e) {
      toast.error("Couldn't render it", e instanceof Error ? e.message : undefined);
    } finally {
      setVisualising(false);
    }
  }

  function downloadSvg() {
    if (!pattern) return;
    const blob = new Blob([pattern.svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${blockId}-${state.size}${hasMeasurements ? "-mtm" : ""}-pattern.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function saveToLibrary() {
    if (!pattern) return;
    setSavingToLibrary(true);
    try {
      const form = new FormData();
      form.set(
        "file",
        new File([new Blob([pattern.svg], { type: "image/svg+xml" })], `${blockId}-${state.size}-pattern.svg`, {
          type: "image/svg+xml",
        }),
      );
      form.set("entityType", "general");
      form.set("isPublic", "1");
      await api.upload("/api/admin/files/upload", form);
      toast.success("Pattern saved to your media library", "Find it under Studio → Files.");
    } catch {
      toast.error("Couldn't save the file");
    } finally {
      setSavingToLibrary(false);
    }
  }

  async function savePattern() {
    setSaving(true);
    try {
      await api.post("/api/admin/fitting/looks", {
        name: patternName.trim() || `${block.name} — ${state.size}${hasMeasurements ? " (made-to-measure)" : ""}`,
        garmentId: blockId,
        fit: {
          size: state.size,
          easePct: state.easePct,
          lengthPct: state.lengthPct,
          sleevePct: state.sleevePct,
          seamAllowance: state.seamAllowance,
          paperless: state.paperless,
          measurements: state.measurements,
        },
        styleId: styleId || null,
      });
      setPatternName("");
      toast.success("Pattern saved");
      saved.reload();
    } catch {
      toast.error("Couldn't save the pattern");
    } finally {
      setSaving(false);
    }
  }

  function loadPattern(p: SavedPattern) {
    if (PATTERN_BLOCKS.some((b) => b.id === p.garmentId)) setBlockId(p.garmentId);
    setState({ ...DEFAULT_STATE, ...stateFromFit(p.fit) });
    setStyleId(p.styleId ?? "");
  }

  async function removePattern(id: string) {
    try {
      await api.delete(`/api/admin/fitting/looks/${id}`);
      saved.reload();
    } catch {
      toast.error("Couldn't delete");
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Studio · from picture to pattern"
        title="Pattern Studio"
        help="pattern-studio"
        description="Real, manufacturable sewing patterns — drafted in your browser, graded to a size or a person's exact measurements, and adjusted with the block's own drafting options. For the shops with a tailor or seamstress in the room: download the SVG and cut."
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* Pattern viewer */}
        <div className="overflow-hidden rounded-lg border border-ink/10 bg-[#f4f2ee]">
          <div className="flex items-center justify-between border-b border-ink/10 bg-white/60 px-4 py-2">
            <span className="text-xs text-warmgrey">
              {pattern?.label ?? block.name} · size {state.size}
              {hasMeasurements ? " · made-to-measure" : ""}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="input !py-1 w-auto text-xs"
                value={pageFormat}
                onChange={(e) => setPageFormat(e.target.value as "a4" | "letter")}
                title="Paper size for the tiled print PDF"
              >
                <option value="a4">A4</option>
                <option value="letter">Letter</option>
              </select>
              <button
                type="button"
                className="btn btn-secondary text-xs"
                onClick={printPdf}
                disabled={!pattern || printing}
                title="A tiled, true-scale PDF — tape the pages together and cut"
              >
                {printing ? "Building…" : "Print PDF"}
              </button>
              <button
                type="button"
                className="btn btn-secondary text-xs"
                onClick={saveToLibrary}
                disabled={!pattern || savingToLibrary}
              >
                {savingToLibrary ? "Saving…" : "Save to library"}
              </button>
              <button type="button" className="btn btn-primary text-xs" onClick={downloadSvg} disabled={!pattern}>
                Download SVG
              </button>
            </div>
          </div>
          <div className="h-[560px] w-full overflow-auto bg-white p-4">
            {pattern ? (
              <div
                className="[&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full"
                // FreeSewing renders a self-contained SVG string (its own styles).
                dangerouslySetInnerHTML={{ __html: pattern.svg }}
              />
            ) : (
              <div className="flex h-full items-center justify-center px-6 text-center text-sm text-warmgrey">
                This block couldn't be drafted with the current settings — nudge the adjustments back toward
                zero, or clear the measurements.
              </div>
            )}
          </div>
          <div className="flex items-center justify-between border-t border-ink/10 bg-white/60 px-4 py-2 text-xs text-warmgrey">
            <span>
              {state.seamAllowance ? "1 cm seam allowance drawn" : "No seam allowance"} ·{" "}
              {state.paperless ? "dimensions printed on the pattern" : "clean cutting lines"}
            </span>
            <span>Real, manufacturable pattern (FreeSewing)</span>
          </div>
        </div>

        {/* Controls */}
        <div className="space-y-5">
          {/* Describe it — the LLM drafting loop */}
          <div className="space-y-2 rounded-lg border border-navy/15 bg-navy/[0.03] p-3">
            <label className="block text-xs font-medium uppercase tracking-wider text-warmgrey">
              ✨ Describe the garment
            </label>
            <textarea
              className="input min-h-[60px] w-full"
              placeholder="e.g. a boxy cropped tee, or a longline relaxed hoodie"
              value={describe}
              onChange={(e) => setDescribe(e.target.value)}
            />
            <button
              type="button"
              className="btn btn-primary w-full"
              onClick={draftFromWords}
              disabled={drafting || !describe.trim()}
            >
              {drafting ? "Drafting…" : "Draft it"}
            </button>
            <p className="text-[11px] leading-snug text-warmgrey">
              Your words become a block, size, and adjustments — then fine-tune everything below.
            </p>
          </div>

          {/* Block — the full FreeSewing apparel catalogue, grouped */}
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-warmgrey">
              Pattern block <span className="normal-case text-warmgrey/70">· {PATTERN_BLOCKS.length} blocks</span>
            </label>
            <select className="input w-full" value={blockId} onChange={(e) => setBlockId(e.target.value)}>
              {PATTERN_GROUPS.map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.blocks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Size */}
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-warmgrey">
              Size
            </label>
            <div className="flex overflow-hidden rounded-md border border-ink/15">
              {SIZE_STEPS.map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => set("size", sz as SizeStep)}
                  className={`flex-1 px-2 py-1.5 text-xs ${
                    state.size === sz ? "bg-navy text-chalk" : "bg-white text-ink/60 hover:text-ink"
                  }`}
                >
                  {sz}
                </button>
              ))}
            </div>
          </div>

          {/* Made-to-measure */}
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-warmgrey">
              Made-to-measure <span className="normal-case text-warmgrey/70">· cm, optional</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["chestCm", "Chest"],
                  ["waistCm", "Waist"],
                  ["hipsCm", "Hips"],
                  ["heightCm", "Height"],
                ] as const
              ).map(([key, label]) => (
                <input
                  key={key}
                  type="number"
                  className="input w-full"
                  placeholder={label}
                  value={state.measurements[key] ?? ""}
                  onChange={(e) => setMeasure(key, e.target.value)}
                />
              ))}
            </div>
            <p className="mt-1 text-[11px] text-warmgrey">
              Enter a person's measurements and the pattern drafts to their body — blank fields grade from the
              size above.
            </p>
          </div>

          {/* Adjustments — the block's native drafting options */}
          {(adjustables.ease || adjustables.length || adjustables.sleeve) && (
            <div className="space-y-3">
              {adjustables.ease && (
                <div>
                  <div className="mb-1 flex justify-between text-xs uppercase tracking-wider text-warmgrey">
                    <span>Extra ease</span>
                    <span>+{state.easePct}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={25}
                    step={1}
                    value={state.easePct}
                    onChange={(e) => set("easePct", Number(e.target.value))}
                    className="w-full"
                  />
                </div>
              )}
              {adjustables.length && (
                <div>
                  <div className="mb-1 flex justify-between text-xs uppercase tracking-wider text-warmgrey">
                    <span>Length</span>
                    <span>
                      {state.lengthPct > 0 ? "+" : ""}
                      {state.lengthPct}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-15}
                    max={20}
                    step={1}
                    value={state.lengthPct}
                    onChange={(e) => set("lengthPct", Number(e.target.value))}
                    className="w-full"
                  />
                </div>
              )}
              {adjustables.sleeve && (
                <div>
                  <div className="mb-1 flex justify-between text-xs uppercase tracking-wider text-warmgrey">
                    <span>Sleeve length</span>
                    <span>
                      {state.sleevePct > 0 ? "+" : ""}
                      {state.sleevePct}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-30}
                    max={10}
                    step={1}
                    value={state.sleevePct}
                    onChange={(e) => set("sleevePct", Number(e.target.value))}
                    className="w-full"
                  />
                </div>
              )}
            </div>
          )}

          {/* Output options */}
          <div className="space-y-1.5">
            <label className="flex cursor-pointer items-center gap-2 text-xs text-warmgrey">
              <input
                type="checkbox"
                checked={state.seamAllowance}
                onChange={(e) => set("seamAllowance", e.target.checked)}
                className="accent-navy"
              />
              Draw a 1 cm seam allowance
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-warmgrey">
              <input
                type="checkbox"
                checked={state.paperless}
                onChange={(e) => set("paperless", e.target.checked)}
                className="accent-navy"
              />
              Print dimensions on the pattern (paperless)
            </label>
          </div>

          {/* Pattern-first design: visualize the block on a body */}
          <div className="space-y-2 rounded-lg border border-navy/15 bg-navy/[0.03] p-3">
            <label className="block text-xs font-medium uppercase tracking-wider text-warmgrey">
              See it on a model
            </label>
            <button
              type="button"
              className="btn btn-secondary w-full"
              onClick={seeOnModel}
              disabled={visualising}
            >
              {visualising ? "Rendering…" : "Render this cut on a model"}
            </button>
            <p className="text-[11px] leading-snug text-warmgrey">
              Pattern-first design: this block and your adjustments become a photoreal look.{" "}
              {visualised ? (
                <a href="/admin/fitting" className="link-quiet">
                  View it in the Fitting Studio →
                </a>
              ) : (
                "The render lands in the Fitting Studio's gallery (uses one render from the daily budget)."
              )}
            </p>
          </div>

          {/* Save */}
          <div className="space-y-2 rounded-lg border border-ink/10 bg-white p-3">
            <label className="block text-xs font-medium uppercase tracking-wider text-warmgrey">
              Save this pattern
            </label>
            <input
              className="input w-full"
              placeholder={`${block.name} — ${state.size}${hasMeasurements ? " (made-to-measure)" : ""}`}
              value={patternName}
              onChange={(e) => setPatternName(e.target.value)}
            />
            <select className="input w-full" value={styleId} onChange={(e) => setStyleId(e.target.value)}>
              <option value="">Link to a style (optional)…</option>
              {(styles.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <button type="button" className="btn btn-primary w-full" onClick={savePattern} disabled={saving}>
              {saving ? "Saving…" : "Save pattern"}
            </button>
            <p className="text-[11px] leading-snug text-warmgrey">
              Name it after a client to build a made-to-measure book — their measurements and adjustments
              reload with one click.
            </p>
          </div>
        </div>
      </div>

      {/* Saved patterns */}
      <div className="mt-8">
        <h2 className="mb-3 font-display text-lg font-light">Saved patterns</h2>
        {(saved.data ?? []).length === 0 ? (
          <EmptyState
            title="No saved patterns yet"
            hint="Dial in a block and save it — sizes for your line, or a measurement record per client."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(saved.data ?? []).map((p) => {
              const b = PATTERN_BLOCKS.find((x) => x.id === p.garmentId);
              const mtm =
                p.fit && typeof p.fit === "object" && (p.fit as { measurements?: object }).measurements
                  ? Object.values((p.fit as { measurements: Record<string, unknown> }).measurements).some(
                      (v) => v !== undefined && v !== null,
                    )
                  : false;
              return (
                <div key={p.id} className="rounded-lg border border-ink/10 bg-white p-3">
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-warmgrey">
                    {b?.name ?? p.garmentId}
                    {typeof p.fit?.size === "string" ? ` · ${p.fit.size}` : ""}
                    {mtm ? " · made-to-measure" : ""}
                    {p.styleName ? ` · ${p.styleName}` : ""}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      className="btn btn-secondary flex-1 text-xs"
                      onClick={() => loadPattern(p)}
                    >
                      Load
                    </button>
                    <button type="button" className="btn btn-danger text-xs" onClick={() => removePattern(p.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p className="mt-6 max-w-3xl text-xs text-warmgrey">
        Patterns are drafted by <strong>FreeSewing</strong> — an open-source parametric drafting engine — right
        in your browser. Grading from a size is a proportional first pass; made-to-measure drafts use the
        numbers you enter directly. Either way you get a genuine flat pattern a tailor can cut, refine, and
        sew — not a picture of one.
      </p>
    </div>
  );
}
