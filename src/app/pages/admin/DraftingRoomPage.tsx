import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { PageHeader } from "../../components/admin/ui";
import { useToast } from "../../lib/toast";
import { setCompanionContext } from "../../lib/companionContext";
import {
  PERIOD_SYSTEMS,
  periodSystem,
  periodMeasurements,
  renderPeriodSvg,
  type PeriodBodyInput,
} from "../../lib/periodDrafts";
import { SIZE_STEPS, SIZE_SCALE, type SizeStep } from "../../../shared/garments";

/**
 * The Drafting Room — the school's period drafting systems as working
 * generators. Pick a system, set the measurements, and the draft is struck
 * the way the book strikes it: lettered points, construction lines, and the
 * source cited on the sheet. Companion piece to the Pattern Studio (modern
 * parametric blocks) and the Timeless Library (where the books live).
 */

const MEASUREMENT_LABELS: Record<string, string> = {
  waist: "Waist",
  seat: "Seat / hips",
  inseam: "Inseam",
  waistToFloor: "Waist to floor",
  knee: "Knee girth",
  chest: "Chest / bust",
  hpsToWaistBack: "Nape to waist",
  neck: "Neck",
  shoulderToShoulder: "Shoulder to shoulder",
  biceps: "Upper arm",
  shoulderToWrist: "Shoulder to wrist",
  wrist: "Wrist",
};

export function DraftingRoomPage() {
  const toast = useToast();
  const [systemId, setSystemId] = useState(PERIOD_SYSTEMS[0].id);
  const [size, setSize] = useState<SizeStep>("M");
  const [mtm, setMtm] = useState<PeriodBodyInput>({});
  const [exactOpen, setExactOpen] = useState(false);
  const [options, setOptions] = useState<Record<string, number>>({});
  const [zoom, setZoom] = useState(1);
  const [printing, setPrinting] = useState(false);
  const [pageFormat, setPageFormat] = useState<"a4" | "letter">("a4");

  const system = periodSystem(systemId)!;

  // Reset options to the system's defaults when the system changes.
  useEffect(() => {
    setOptions(Object.fromEntries(system.options.map((o) => [o.key, o.dflt])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [systemId]);

  const measured = useMemo(() => periodMeasurements(SIZE_SCALE[size], mtm), [size, mtm]);

  const svg = useMemo(() => {
    try {
      const opts = { ...Object.fromEntries(system.options.map((o) => [o.key, o.dflt])), ...options };
      const pieces = system.draft(measured, opts);
      const custom = mtm.chestCm || mtm.waistCm || mtm.heightCm || Object.values(mtm.exact ?? {}).some(Boolean);
      return renderPeriodSvg(pieces, {
        system,
        gradeNote: custom ? "to the given measurements" : `size ${size} standard`,
      });
    } catch {
      return null;
    }
  }, [system, measured, options, size, mtm]);

  // Tell the Companion what's on the drafting table.
  useEffect(() => {
    setCompanionContext(
      `Drafting Room, open draft: "${system.name}" (${system.garment}), after ${system.source.author}, ` +
        `${system.source.title} (${system.source.year}). Size ${size}${mtm.chestCm ? `, chest ${mtm.chestCm}cm` : ""}. ` +
        `Options: ${system.options.map((o) => `${o.label} ${options[o.key] ?? o.dflt}${o.unit}`).join(", ") || "none"}.`,
    );
    return () => setCompanionContext(null);
  }, [system, size, mtm, options]);

  const download = () => {
    if (!svg) return;
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${system.id}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printPdf = async () => {
    if (!svg) return;
    setPrinting(true);
    try {
      const { downloadTiledPdf } = await import("../../lib/pattern-pdf");
      await downloadTiledPdf(svg, system.id, pageFormat);
    } catch (e) {
      toast.error("Couldn't build the PDF", e instanceof Error ? e.message : undefined);
    } finally {
      setPrinting(false);
    }
  };

  const setExact = (key: string, raw: string) => {
    const v = raw === "" ? undefined : Number(raw);
    setMtm((m) => ({ ...m, exact: { ...m.exact, [key]: Number.isFinite(v as number) ? (v as number) : undefined } }));
  };

  return (
    <div>
      <PageHeader
        title="Drafting Room"
        eyebrow="Studio · cut the way the books cut"
        description="The school's drafting systems, working: pick a period method, give it measurements, and the draft is struck the way the book strikes it — lettered points, construction lines, source on the sheet."
        help="drafting-room"
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Sheet */}
        <div className="admin-card overflow-hidden p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-warmgrey">
              {system.garment} · after {system.source.author}, <span className="italic">{system.source.title}</span> ({system.source.year})
            </p>
            <div className="flex items-center gap-2">
              <div className="flex items-center rounded border border-ink/15">
                <button type="button" className="px-2.5 py-1 text-sm" onClick={() => setZoom((z) => Math.max(0.4, z - 0.2))}>−</button>
                <span className="px-1 text-xs text-warmgrey">{Math.round(zoom * 100)}%</span>
                <button type="button" className="px-2.5 py-1 text-sm" onClick={() => setZoom((z) => Math.min(3, z + 0.2))}>+</button>
              </div>
              <select className="input !py-1 w-auto text-xs" value={pageFormat} onChange={(e) => setPageFormat(e.target.value as "a4" | "letter")} title="Paper size for the tiled print PDF">
                <option value="a4">A4</option>
                <option value="letter">Letter</option>
              </select>
              <button type="button" className="btn btn-secondary !py-1.5 text-xs" onClick={printPdf} disabled={printing || !svg}>
                {printing ? "Tiling…" : "Print PDF"}
              </button>
              <button type="button" className="btn btn-primary !py-1.5 text-xs" onClick={download} disabled={!svg}>
                Download SVG
              </button>
            </div>
          </div>
          <div className="overflow-auto rounded-lg border border-ink/10" style={{ maxHeight: "70vh" }}>
            {svg ? (
              <div
                style={{ width: `${zoom * 100}%` }}
                // The sheet is generated locally from pure geometry — no user or remote HTML.
                dangerouslySetInnerHTML={{ __html: svg.replace(/width="[\d.]+mm" height="[\d.]+mm"/, 'width="100%" height="100%"') }}
              />
            ) : (
              <p className="p-8 text-sm text-warmgrey">Those measurements defeat the draft — bring them back toward the body.</p>
            )}
          </div>
          <p className="mt-2 text-xs text-warmgrey">
            True scale: print the PDF at 100% and check the 5 cm bar. Seam allowance is not included — add your own as the period cutters did.
          </p>
        </div>

        {/* Controls */}
        <div className="space-y-4">
          <div className="admin-card p-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-warmgrey">The system</p>
            <div className="space-y-2">
              {PERIOD_SYSTEMS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSystemId(s.id)}
                  className={`block w-full rounded-lg border p-3 text-left transition-colors ${
                    s.id === systemId ? "border-navy bg-navy/5" : "border-ink/10 bg-white hover:border-ink/25"
                  }`}
                >
                  <p className="text-sm font-medium text-ink">{s.name}</p>
                  <p className="text-xs text-warmgrey">{s.garment} · {s.era}</p>
                  {s.id === systemId && <p className="mt-1.5 text-xs text-ink/70">{s.blurb}</p>}
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-warmgrey">
              The source volumes are on the shelf in the{" "}
              <Link to="/admin/library/books" className="text-navy underline">
                Timeless Library
              </Link>{" "}
              — and the{" "}
              <Link to="/admin/school" className="text-navy underline">
                School
              </Link>{" "}
              teaches the method.
            </p>
          </div>

          <div className="admin-card p-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-warmgrey">Size</p>
            <div className="flex overflow-hidden rounded-md border border-ink/15">
              {SIZE_STEPS.map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => setSize(sz)}
                  className={`flex-1 px-2 py-1.5 text-xs ${size === sz ? "bg-navy text-chalk" : "bg-white text-ink/60 hover:text-ink"}`}
                >
                  {sz}
                </button>
              ))}
            </div>
            <p className="mb-1.5 mt-3 text-xs font-medium uppercase tracking-wider text-warmgrey">Made to measure · optional</p>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["chestCm", "Chest (cm)"],
                  ["waistCm", "Waist (cm)"],
                  ["hipsCm", "Hips (cm)"],
                  ["heightCm", "Height (cm)"],
                ] as const
              ).map(([key, label]) => (
                <input
                  key={key}
                  type="number"
                  className="input text-sm"
                  placeholder={label}
                  value={mtm[key] ?? ""}
                  onChange={(e) => setMtm((m) => ({ ...m, [key]: e.target.value === "" ? undefined : Number(e.target.value) }))}
                />
              ))}
            </div>
            <button type="button" className="mt-2 text-xs text-navy underline" onClick={() => setExactOpen((v) => !v)}>
              {exactOpen ? "Hide" : "Open"} every measurement this system drafts from
            </button>
            {exactOpen && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                {system.measurements.map((k) => (
                  <label key={k} className="text-xs text-warmgrey">
                    {MEASUREMENT_LABELS[k] ?? k}
                    <input
                      type="number"
                      className="input mt-0.5 text-sm"
                      placeholder={`${(measured[k] / 10).toFixed(1)} cm`}
                      value={mtm.exact?.[k] ?? ""}
                      onChange={(e) => setExact(k, e.target.value)}
                    />
                  </label>
                ))}
              </div>
            )}
          </div>

          {system.options.length > 0 && (
            <div className="admin-card p-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-warmgrey">The cut</p>
              <div className="space-y-3">
                {system.options.map((o) => (
                  <div key={o.key}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-ink/80">{o.label}</span>
                      <span className="text-warmgrey">
                        {options[o.key] ?? o.dflt}
                        {o.unit === "mm" ? " mm" : "%"}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={o.min}
                      max={o.max}
                      step={o.step}
                      value={options[o.key] ?? o.dflt}
                      onChange={(e) => setOptions((prev) => ({ ...prev, [o.key]: Number(e.target.value) }))}
                      className="w-full"
                    />
                    {o.hint && <p className="text-[0.68rem] text-warmgrey">{o.hint}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
