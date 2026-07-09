import { useEffect, useMemo, useState } from "react";
import { PageHeader, EmptyState } from "../../components/admin/ui";
import { useFetch } from "../../lib/useFetch";
import { api } from "../../lib/api";
import { useToast } from "../../lib/toast";
import { SIZE_STEPS, type SizeStep } from "../../../shared/garments";
import {
  designMeasurementNames,
  designNativeOptions,
  draftPatternSvg,
  effectiveMeasurementsCm,
  humanizeKey,
  patternAdjustables,
  PATTERN_BLOCKS,
  PATTERN_GROUPS,
  type BodyMeasurements,
  type NativeOptionDef,
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
  saMm: number;
  paperless: boolean;
  measurements: BodyMeasurements;
  /** Touched native drafting options (UI units), keyed by FreeSewing option name. */
  advanced: Record<string, number | string | boolean>;
  units: "cm" | "in";
}

const DEFAULT_STATE: PatternState = {
  size: "M",
  easePct: 0,
  lengthPct: 0,
  sleevePct: 0,
  saMm: 10,
  paperless: true,
  measurements: {},
  advanced: {},
  units: "cm",
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
  if (typeof fit.saMm === "number") out.saMm = Math.min(30, Math.max(0, fit.saMm));
  else if (typeof fit.seamAllowance === "boolean") out.saMm = fit.seamAllowance ? 10 : 0;
  if (typeof fit.paperless === "boolean") out.paperless = fit.paperless;
  if (fit.measurements && typeof fit.measurements === "object") {
    out.measurements = fit.measurements as BodyMeasurements;
  }
  if (fit.advanced && typeof fit.advanced === "object") {
    out.advanced = fit.advanced as Record<string, number | string | boolean>;
  }
  if (fit.units === "in" || fit.units === "cm") out.units = fit.units;
  return out;
}

const CM_PER_IN = 2.54;

/** Blocks the cloth-sim drape pipeline can sew (mirrors the worker/extract
 *  whitelist): tee, tank, sweatshirt, raglan hoodie (hood not simulated). */
const DRAPE_BLOCKS = new Set(["classic-tee", "aaron", "relaxed-hoodie", "hugo"]);

/** Rasterize a pattern SVG to a PNG blob (long side capped) for use as an
 *  image-model reference. White background; the SVG's own mm dimensions set
 *  the aspect ratio. */
async function rasterizePattern(svg: string, maxPx = 1280): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Couldn't rasterize the pattern."));
      img.src = url;
    });
    const w = img.naturalWidth || 1000;
    const h = img.naturalHeight || 1000;
    const scale = Math.min(1, maxPx / Math.max(w, h));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't encode the pattern image."))), "image/png"),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** A range slider with −/+ tap steps — sliders alone are miserable on a
 *  tablet at a cutting table, and that's exactly where this page gets used. */
function TouchRange({
  min,
  max,
  step,
  tap,
  value,
  onChange,
}: {
  min: number;
  max: number;
  step: number;
  /** How far one −/+ tap moves the value. */
  tap: number;
  value: number;
  onChange: (v: number) => void;
}) {
  const nudge = (dir: 1 | -1) => onChange(Math.min(max, Math.max(min, Math.round((value + dir * tap) * 10) / 10)));
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => nudge(-1)}
        className="h-6 w-6 shrink-0 rounded border border-ink/15 bg-white text-xs leading-none text-ink/60 hover:border-navy hover:text-navy"
        aria-label="Decrease"
      >
        −
      </button>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
      <button
        type="button"
        onClick={() => nudge(1)}
        className="h-6 w-6 shrink-0 rounded border border-ink/15 bg-white text-xs leading-none text-ink/60 hover:border-navy hover:text-navy"
        aria-label="Increase"
      >
        +
      </button>
    </div>
  );
}

/** One introspected FreeSewing option, rendered by its native type. Untouched
 *  options show the block's default; touching one adds it to the overrides. */
function NativeOptionControl({
  def,
  value,
  onChange,
}: {
  def: NativeOptionDef;
  value: number | string | boolean | undefined;
  onChange: (v: number | string | boolean) => void;
}) {
  const label = humanizeKey(def.key);
  if (def.type === "bool") {
    return (
      <label className="flex cursor-pointer items-center gap-2 text-xs text-warmgrey">
        <input
          type="checkbox"
          checked={value === undefined ? Boolean(def.dflt) : Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="accent-navy"
        />
        {label}
      </label>
    );
  }
  if (def.type === "list") {
    return (
      <label className="block text-xs text-warmgrey">
        <span className="mb-0.5 block text-[10px]">{label}</span>
        <select
          className="input w-full !py-1 text-xs"
          value={String(value ?? def.dflt)}
          onChange={(e) => onChange(e.target.value)}
        >
          {(def.choices ?? []).map((c) => (
            <option key={c} value={c}>
              {humanizeKey(c)}
            </option>
          ))}
        </select>
      </label>
    );
  }
  // pct / deg / mm / count — a slider with a live readout.
  const num = value === undefined ? Number(def.dflt) : Number(value);
  const unit = def.type === "pct" ? "%" : def.type === "deg" ? "°" : def.type === "mm" ? " mm" : "";
  return (
    <div className="text-xs text-warmgrey">
      <div className="mb-0.5 flex justify-between text-[10px]">
        <span>{label}</span>
        <span>
          {Math.round(num * 10) / 10}
          {unit}
        </span>
      </div>
      <TouchRange
        min={def.min ?? 0}
        max={def.max ?? 100}
        step={def.type === "count" ? 1 : 0.5}
        tap={def.type === "count" ? 1 : 1}
        value={num}
        onChange={(v) => onChange(def.type === "count" ? Math.round(v) : v)}
      />
    </div>
  );
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
  const [zoom, setZoom] = useState(1);
  const [visualising, setVisualising] = useState(false);
  const [visualised, setVisualised] = useState(false);
  const [usePatternRef, setUsePatternRef] = useState(false);
  const [drape, setDrape] = useState<{
    jobId: string;
    status: string;
    url?: string;
    fileId?: string;
    error?: string;
  } | null>(null);
  const [draping, setDraping] = useState(false);
  const [styling, setStyling] = useState(false);
  const [explaining, setExplaining] = useState(false);
  const [explainText, setExplainText] = useState<string | null>(null);

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
    seamAllowanceMm: state.saMm,
    paperless: state.paperless,
    advanced: state.advanced,
  };
  const pattern = useMemo(
    () => draftPatternSvg(blockId, state.size, state.measurements, opts),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [blockId, state],
  );

  // Touched drafting options belong to a specific block; body measurements
  // belong to the person. Switching blocks clears the former, keeps the latter.
  useEffect(() => {
    setState((s) => (Object.keys(s.advanced).length ? { ...s, advanced: {} } : s));
  }, [blockId]);

  const nativeOptions = useMemo(() => designNativeOptions(blockId), [blockId]);
  const measurementNames = useMemo(() => designMeasurementNames(blockId), [blockId]);
  const effective = useMemo(
    () => effectiveMeasurementsCm(blockId, state.size, state.measurements),
    [blockId, state.size, state.measurements],
  );
  const touchedCount = Object.keys(state.advanced).length;

  const hasMeasurements =
    state.measurements.chestCm !== undefined ||
    state.measurements.waistCm !== undefined ||
    state.measurements.hipsCm !== undefined ||
    state.measurements.heightCm !== undefined ||
    Object.values(state.measurements.exact ?? {}).some((v) => v !== undefined);

  // Unit helpers: everything is stored in cm (or mm for seam allowance);
  // imperial is a display-layer conversion only.
  const inches = state.units === "in";
  const toDisplay = (cm: number | undefined): string =>
    cm === undefined ? "" : String(Math.round((inches ? cm / CM_PER_IN : cm) * 10) / 10);
  const fromDisplay = (v: string): number | undefined => {
    const n = Number(v);
    if (v === "" || !Number.isFinite(n)) return undefined;
    return inches ? n * CM_PER_IN : n;
  };

  function set<K extends keyof PatternState>(key: K, value: PatternState[K]) {
    setState((s) => ({ ...s, [key]: value }));
  }

  function setMeasure(key: "chestCm" | "waistCm" | "hipsCm" | "heightCm", value: string) {
    const cm = fromDisplay(value);
    setState((s) => ({ ...s, measurements: { ...s.measurements, [key]: cm } }));
  }

  function setExactMeasure(name: string, value: string) {
    const cm = fromDisplay(value);
    setState((s) => ({
      ...s,
      measurements: { ...s.measurements, exact: { ...s.measurements.exact, [name]: cm } },
    }));
  }

  function setAdvanced(key: string, value: number | string | boolean) {
    setState((s) => ({ ...s, advanced: { ...s.advanced, [key]: value } }));
  }

  async function styleThisBlock() {
    if (!describe.trim()) return;
    setStyling(true);
    try {
      const res = await api.post<{ options: Record<string, unknown>; rationale?: string }>(
        "/api/admin/fitting/pattern-assist",
        {
          prompt: describe,
          block: { id: blockId, name: block.name },
          options: nativeOptions.map((o) => ({
            key: o.key,
            type: o.type,
            min: o.min,
            max: o.max,
            choices: o.choices,
          })),
        },
      );
      // Re-validate everything the model returned against the introspected
      // defs before it touches state — the assistant proposes, the defs decide.
      const defs = new Map(nativeOptions.map((o) => [o.key, o]));
      const accepted: Record<string, number | string | boolean> = {};
      for (const [key, raw] of Object.entries(res.options)) {
        const def = defs.get(key);
        if (!def) continue;
        if (def.type === "bool" && typeof raw === "boolean") accepted[key] = raw;
        else if (def.type === "list" && def.choices?.includes(String(raw))) accepted[key] = String(raw);
        else if (def.type !== "bool" && def.type !== "list") {
          const n = Number(raw);
          if (Number.isFinite(n)) accepted[key] = Math.min(def.max ?? 999, Math.max(def.min ?? -999, n));
        }
      }
      if (Object.keys(accepted).length === 0) {
        toast.error("Nothing usable came back", "Try naming the details — cuffs, collar, buttons…");
        return;
      }
      setState((s) => ({ ...s, advanced: { ...s.advanced, ...accepted } }));
      toast.success(
        `${Object.keys(accepted).length} drafting option${Object.keys(accepted).length > 1 ? "s" : ""} set`,
        res.rationale || "Check them under “All drafting options” — everything is yours to override.",
      );
    } catch (e) {
      toast.error("Couldn't style the block", e instanceof Error ? e.message : undefined);
    } finally {
      setStyling(false);
    }
  }

  async function explainPattern() {
    setExplaining(true);
    try {
      const changed = Object.keys(state.advanced).map(humanizeKey).join(", ");
      const res = await api.post<{ text: string }>("/api/admin/fitting/pattern-explain", {
        block: block.name,
        summary: `size ${state.size}${hasMeasurements ? ", made-to-measure" : ""}, seam allowance ${state.saMm}mm${
          changed ? `, customised: ${changed}` : ""
        }`,
      });
      setExplainText(res.text);
    } catch (e) {
      toast.error("Couldn't get the guidance", e instanceof Error ? e.message : undefined);
    } finally {
      setExplaining(false);
    }
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
   *  model via the Fitting Studio's generate path. Honest scope: the image
   *  model gets a text description — the silhouette class, the fit buckets,
   *  and every NAMEABLE styling choice (cuffs, collar, plackets, buttons) —
   *  never the drafted geometry itself. */
  /** True-drape preview (beta): dispatch the Blender cloth-sim render and
   *  poll until the grey ghost-mannequin PNG lands. The draft's effective
   *  measurements ride along (mm) so the sim sews the client's actual
   *  pattern and scales the mannequin to their body. */
  async function startDrape() {
    setDraping(true);
    setDrape(null);
    try {
      const measurementsMm = Object.fromEntries(
        Object.entries(effective).map(([k, cm]) => [k, Math.round(cm * 10)]),
      );
      const res = await api.post<{ jobId: string }>("/api/admin/fitting/drape", {
        block: blockId,
        easePct: state.easePct,
        lengthPct: state.lengthPct,
        sleevePct: state.sleevePct,
        measurementsMm,
      });
      setDrape({ jobId: res.jobId, status: "queued" });
      // The Actions run takes ~4-6 min (installs Blender, sims, renders).
      for (let i = 0; i < 100; i++) {
        await new Promise((r) => setTimeout(r, 6000));
        const s = await api.get<{ status: string; url?: string; fileId?: string; error?: string }>(
          `/api/admin/fitting/drape/${res.jobId}`,
        );
        setDrape({ jobId: res.jobId, ...s });
        if (s.status === "done" || s.status === "failed") {
          if (s.status === "failed") toast.error("Drape simulation failed", s.error);
          return;
        }
      }
      toast.error("Drape render timed out", "The job may still finish — check back in a minute.");
    } catch (e) {
      setDrape(null);
      toast.error("Couldn't start the drape render", e instanceof Error ? e.message : undefined);
    } finally {
      setDraping(false);
    }
  }

  async function seeOnModel(drapeFileId?: string) {
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

      // Carry the touched drafting choices that translate to words: list
      // choices ("rounded french cuff"), booleans ("split yoke"), counts
      // ("8 buttons"). Geometry (percent/degree/mm) stays behind — no text
      // prompt renders a 70° collar angle faithfully.
      const defs = new Map(nativeOptions.map((o) => [o.key, o]));
      const details: string[] = [];
      for (const [key, value] of Object.entries(state.advanced)) {
        const def = defs.get(key);
        if (!def) continue;
        if (def.type === "list") {
          const v = humanizeKey(String(value)).toLowerCase();
          const noun = humanizeKey(key).toLowerCase().replace(/ style$/, "");
          details.push(v.includes(noun.split(" ")[0]) ? v : `a ${v} ${noun}`);
        } else if (def.type === "bool") {
          const name = humanizeKey(key).toLowerCase();
          details.push(value ? `a ${name}` : `no ${name}`);
        } else if (def.type === "count") {
          details.push(`${value} ${humanizeKey(key).toLowerCase()}`);
        }
      }
      const detailClause = details.length ? `, detailed with ${details.slice(0, 8).join(", ")}` : "";
      const description = `a ${block.name.toLowerCase()} cut with ${bits.join(", ")}${detailClause}`.slice(0, 450);

      // Experimental: show the engine the pattern sheet itself. A CLEAN draft
      // (no seam allowance, no dimension text) rasterized and passed as a
      // reference, with a server-side clause that frames it as a technical
      // diagram — proportions only, never a print.
      let referenceFileIds: string[] | undefined;
      let referenceRole: "pattern" | "drape" | undefined;
      if (drapeFileId) {
        // True-drape bridge: the physically-simulated grey render carries the
        // draft's real proportions — stronger signal than the flat sheet.
        referenceFileIds = [drapeFileId];
        referenceRole = "drape";
      } else if (usePatternRef) {
        const clean = draftPatternSvg(blockId, state.size, state.measurements, {
          easePct: state.easePct,
          lengthPct: state.lengthPct,
          sleevePct: state.sleevePct,
          seamAllowanceMm: 0,
          paperless: false,
          advanced: state.advanced,
        });
        if (clean) {
          const png = await rasterizePattern(clean.svg);
          const form = new FormData();
          form.set("file", new File([png], `${blockId}-pattern-ref.png`, { type: "image/png" }));
          form.set("entityType", "general");
          form.set("isPublic", "1");
          const up = await api.upload<{ id: string }>("/api/admin/files/upload", form);
          referenceFileIds = [up.id];
          referenceRole = "pattern";
        }
      }

      // No `fit` here: those multipliers are relative to THIS block's own
      // proportions, but the server's fitClause words them on the Fitting
      // Studio's absolute scale (where 0.75 sleeve = three-quarter length) —
      // for a tee draft at -25% sleeves that injects "three-quarter sleeves"
      // into the prompt, contradicting both the description and the drape.
      // The description already words the fit; the drape carries geometry.
      await api.post("/api/admin/fitting/generate", {
        description,
        referenceFileIds,
        referenceRole,
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
      const fit = {
        size: state.size,
        easePct: state.easePct,
        lengthPct: state.lengthPct,
        sleevePct: state.sleevePct,
        saMm: state.saMm,
        paperless: state.paperless,
        measurements: state.measurements,
        advanced: state.advanced,
        units: state.units,
      };
      if (JSON.stringify(fit).length > 1900) {
        toast.error(
          "Too many custom settings to save",
          "Clear a few untouched drafting options or exact measurements, then save again.",
        );
        setSaving(false);
        return;
      }
      await api.post("/api/admin/fitting/looks", {
        name: patternName.trim() || `${block.name} — ${state.size}${hasMeasurements ? " (made-to-measure)" : ""}`,
        garmentId: blockId,
        fit,
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
          <div className="relative h-[560px] w-full overflow-auto bg-white p-4">
            {pattern && (
              <div className="absolute right-3 top-3 z-10 flex overflow-hidden rounded-md border border-ink/15 bg-white/90 text-xs shadow-sm backdrop-blur">
                <button
                  type="button"
                  className="h-8 w-8 text-ink/60 hover:text-navy"
                  onClick={() => setZoom((z) => Math.max(0.5, Math.round((z - 0.25) * 100) / 100))}
                  aria-label="Zoom out"
                >
                  −
                </button>
                <button
                  type="button"
                  className="h-8 min-w-12 border-x border-ink/10 px-1 text-[11px] text-ink/60 hover:text-navy"
                  onClick={() => setZoom(1)}
                  title="Reset zoom"
                >
                  {Math.round(zoom * 100)}%
                </button>
                <button
                  type="button"
                  className="h-8 w-8 text-ink/60 hover:text-navy"
                  onClick={() => setZoom((z) => Math.min(4, Math.round((z + 0.25) * 100) / 100))}
                  aria-label="Zoom in"
                >
                  +
                </button>
              </div>
            )}
            {pattern ? (
              <div
                style={{ width: `${zoom * 100}%` }}
                className="[&_svg]:mx-auto [&_svg]:h-auto [&_svg]:w-full"
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
              {state.saMm > 0
                ? `${inches ? `${Math.round((state.saMm / 25.4) * 100) / 100} in` : `${state.saMm} mm`} seam allowance drawn`
                : "No seam allowance"}{" "}
              · {state.paperless ? "dimensions printed on the pattern" : "clean cutting lines"}
              {touchedCount > 0 ? ` · ${touchedCount} drafting option${touchedCount > 1 ? "s" : ""} customised` : ""}
            </span>
            <button
              type="button"
              className="text-navy hover:underline disabled:opacity-50"
              onClick={explainPattern}
              disabled={explaining}
              title="A plain-language guide to cutting and sewing this pattern"
            >
              {explaining ? "Writing…" : "✨ Explain this pattern"}
            </button>
          </div>
          {explainText && (
            <div className="border-t border-ink/10 bg-navy/[0.03] px-4 py-3">
              <div className="mb-1 flex items-center justify-between">
                <p className="text-[11px] font-medium uppercase tracking-wider text-warmgrey">
                  Cutting & sewing guide
                </p>
                <button
                  type="button"
                  className="text-xs text-ink/50 hover:text-ink"
                  onClick={() => setExplainText(null)}
                >
                  ✕
                </button>
              </div>
              <div className="whitespace-pre-wrap text-xs leading-relaxed text-ink/80">{explainText}</div>
            </div>
          )}
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
            <div className="flex gap-2">
              <button
                type="button"
                className="btn btn-primary flex-1"
                onClick={draftFromWords}
                disabled={drafting || styling || !describe.trim()}
              >
                {drafting ? "Drafting…" : "Draft it"}
              </button>
              <button
                type="button"
                className="btn btn-secondary flex-1"
                onClick={styleThisBlock}
                disabled={drafting || styling || !describe.trim()}
                title="Apply your words to THIS block's full drafting options — cuffs, collar, plackets…"
              >
                {styling ? "Styling…" : "Style this block"}
              </button>
            </div>
            <p className="text-[11px] leading-snug text-warmgrey">
              <strong>Draft it</strong> picks a block and rough fit. <strong>Style this block</strong> drives the
              current block's full drafting options — "french cuffs, split yoke, eight buttons". Everything the
              assistant sets appears on the manual controls, yours to override.
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
            <div className="mb-1.5 flex items-center justify-between">
              <label className="block text-xs font-medium uppercase tracking-wider text-warmgrey">
                Made-to-measure <span className="normal-case text-warmgrey/70">· optional</span>
              </label>
              <div className="flex overflow-hidden rounded-md border border-ink/15 text-[11px]">
                {(["cm", "in"] as const).map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => set("units", u)}
                    className={`px-2 py-0.5 ${
                      state.units === u ? "bg-navy text-chalk" : "bg-white text-ink/60 hover:text-ink"
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>
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
                  step="0.1"
                  className="input w-full"
                  placeholder={`${label} (${state.units})`}
                  value={toDisplay(state.measurements[key])}
                  onChange={(e) => setMeasure(key, e.target.value)}
                />
              ))}
            </div>
            <p className="mt-1 text-[11px] text-warmgrey">
              Enter a person's measurements and the pattern drafts to their body — blank fields grade from the
              size above.
            </p>
            {/* Full bespoke input: every measurement this block drafts from. */}
            <details className="mt-2 rounded border border-ink/10 bg-white px-2.5 py-1.5">
              <summary className="cursor-pointer text-[11px] font-medium text-ink/70">
                Full measurements ({measurementNames.length}) — bespoke input
              </summary>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {measurementNames.map((name) => (
                  <label key={name} className="block">
                    <span className="mb-0.5 block truncate text-[10px] text-warmgrey" title={humanizeKey(name)}>
                      {humanizeKey(name)}
                    </span>
                    <input
                      type="number"
                      step="0.1"
                      className="input w-full !py-1 text-xs"
                      placeholder={toDisplay(effective[name])}
                      value={toDisplay(state.measurements.exact?.[name])}
                      onChange={(e) => setExactMeasure(name, e.target.value)}
                    />
                  </label>
                ))}
              </div>
              <p className="mt-1.5 text-[10px] leading-snug text-warmgrey">
                Greyed values show what the draft currently uses ({state.units}). Type over any of them and the
                pattern uses your number exactly — this is true bespoke input, the same points a tailor takes.
              </p>
            </details>
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
                  <TouchRange min={0} max={25} step={1} tap={1} value={state.easePct} onChange={(v) => set("easePct", v)} />
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
                  <TouchRange min={-15} max={20} step={1} tap={1} value={state.lengthPct} onChange={(v) => set("lengthPct", v)} />
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
                  <TouchRange min={-30} max={10} step={1} tap={1} value={state.sleevePct} onChange={(v) => set("sleevePct", v)} />
                </div>
              )}
            </div>
          )}

          {/* Every drafting option this block defines, straight from the design. */}
          <details className="rounded-lg border border-ink/10 bg-white px-3 py-2" open={touchedCount > 0}>
            <summary className="cursor-pointer text-xs font-medium uppercase tracking-wider text-warmgrey">
              All drafting options ({nativeOptions.length})
              {touchedCount > 0 ? ` · ${touchedCount} changed` : ""}
            </summary>
            {touchedCount > 0 && (
              <button
                type="button"
                className="mt-1 text-[11px] text-navy hover:underline"
                onClick={() => set("advanced", {})}
              >
                Reset all to the block's defaults
              </button>
            )}
            {(["fit", "style", "advanced"] as const).map((group) => {
              const items = nativeOptions.filter((o) => o.group === group);
              if (items.length === 0) return null;
              return (
                <div key={group} className="mt-2.5">
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-warmgrey/70">
                    {group === "fit" ? "Fit" : group === "style" ? "Style" : "Advanced"}
                  </p>
                  <div className="space-y-2">
                    {items.map((o) => (
                      <NativeOptionControl
                        key={o.key}
                        def={o}
                        value={state.advanced[o.key]}
                        onChange={(v) => setAdvanced(o.key, v)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
            <p className="mt-2 text-[10px] leading-snug text-warmgrey">
              These are the block's own drafting options — the same controls a pattern-maker gets from
              FreeSewing itself. Anything you change here redrafts the actual pattern pieces.
            </p>
          </details>

          {/* Output options */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs text-warmgrey">
              Seam allowance
              <input
                type="number"
                step={inches ? 0.125 : 1}
                min={0}
                max={inches ? 1.25 : 30}
                className="input w-20 !py-1 text-xs"
                value={inches ? Math.round((state.saMm / 25.4) * 1000) / 1000 : state.saMm}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (!Number.isFinite(n)) return;
                  set("saMm", Math.min(30, Math.max(0, inches ? n * 25.4 : n)));
                }}
              />
              {inches ? "in" : "mm"} <span className="text-warmgrey/70">(0 = none drawn)</span>
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
              onClick={() => seeOnModel()}
              disabled={visualising}
            >
              {visualising ? "Rendering…" : "Render this cut on a model"}
            </button>
            {DRAPE_BLOCKS.has(blockId) && (
              <div className="space-y-2 rounded-md border border-navy/10 bg-white/60 p-2">
                <p className="text-[11px] leading-snug text-warmgrey">
                  <span className="font-medium text-ink/80">True-drape preview (beta).</span>{" "}
                  Sews your exact draft — your measurements included — in a cloth simulator and drapes
                  it on a ghost mannequin scaled to the same body: a physically true picture of the
                  proportions, used as a stronger reference for the model render. Takes a few minutes.
                </p>
                <button
                  type="button"
                  className="btn btn-secondary w-full !py-1.5 text-xs"
                  onClick={startDrape}
                  disabled={draping}
                >
                  {draping
                    ? drape?.status === "queued"
                      ? "Simulating cloth… (takes ~5 min)"
                      : "Simulating cloth…"
                    : "Simulate the real drape"}
                </button>
                {drape?.status === "done" && drape.url && (
                  <div className="space-y-2">
                    <img
                      src={drape.url}
                      alt="Simulated drape of this draft on a ghost mannequin"
                      className="w-full rounded-md border border-ink/10"
                    />
                    <button
                      type="button"
                      className="btn btn-primary w-full !py-1.5 text-xs"
                      onClick={() => seeOnModel(drape.fileId)}
                      disabled={visualising}
                    >
                      {visualising ? "Rendering…" : "Render on a model from this drape"}
                    </button>
                  </div>
                )}
                {drape?.status === "failed" && (
                  <p className="text-[11px] text-red-700">
                    The simulation didn&apos;t finish: {drape.error || "unknown error"}. Try again.
                  </p>
                )}
              </div>
            )}
            <label className="flex cursor-pointer items-start gap-2 text-[11px] leading-snug text-warmgrey">
              <input
                type="checkbox"
                checked={usePatternRef}
                onChange={(e) => setUsePatternRef(e.target.checked)}
                className="mt-0.5 accent-navy"
              />
              <span>
                <span className="font-medium text-ink/80">Experimental: show the engine the pattern sheet.</span>{" "}
                Sends a clean drawing of the pieces as a proportion reference. May land proportions closer to
                your draft — may also add artifacts. Judge it honestly: render the same cut with and without,
                then use <em>Compare</em> + <em>Grid</em> in the Fitting Studio.
              </span>
            </label>
            <p className="text-[11px] leading-snug text-warmgrey">
              A <strong>visual sketch</strong> of this cut — the silhouette, proportions, and the styling
              details it can name (cuffs, collar, buttons). Not your exact draft: the seams and geometry live
              in the pattern, not the picture.{" "}
              {visualised ? (
                <a href="/admin/fitting" className="link-quiet">
                  View it in the Fitting Studio →
                </a>
              ) : (
                "Lands in the Fitting Studio's gallery (one render from the daily budget)."
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
