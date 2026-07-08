import { useEffect, useState } from "react";
import { PageHeader } from "../../components/admin/ui";
import { useFetch } from "../../lib/useFetch";
import { api } from "../../lib/api";
import { useToast } from "../../lib/toast";

/**
 * Fitting Studio — pure virtual try-on. Photograph a real garment (or pull a
 * Design Studio creation), put it on a consistent model roster, then refit and
 * style the result. The parametric mannequin/pattern tooling that used to share
 * this page is retired here; the sewing-pattern drafter is being reworked into
 * its own feature.
 */

/** Quick adjustments for refitting a finished render — ids match the server's
 *  vetted REFIT_PRESETS map. Fit changes the garment; Styling changes how it's
 *  worn. Chips sharing an `excl` key are mutually exclusive (radio-style). */
interface RefitChip {
  id: string;
  label: string;
  excl?: string;
}
const REFIT_GROUPS: { label: string; chips: RefitChip[] }[] = [
  {
    label: "Fit",
    chips: [
      { id: "tighter", label: "Tighter" },
      { id: "looser", label: "Looser" },
      { id: "cropped", label: "Crop it" },
      { id: "longer", label: "Longer hem" },
      { id: "sleeves-shorter", label: "Shorter sleeves" },
      { id: "sleeves-longer", label: "Longer sleeves" },
    ],
  },
  {
    label: "Styling",
    chips: [
      { id: "tuck-full", label: "Full tuck", excl: "tuck" },
      { id: "tuck-french", label: "French tuck", excl: "tuck" },
      { id: "untucked", label: "Untucked", excl: "tuck" },
      { id: "sleeves-rolled", label: "Roll the sleeves" },
      { id: "pants-cuffed", label: "Cuff the pants" },
      { id: "collar-open", label: "Open collar", excl: "collar" },
      { id: "collar-buttoned", label: "Buttoned up", excl: "collar" },
    ],
  },
  {
    label: "Finish",
    chips: [
      { id: "complete-outfit", label: "Complete the outfit" },
      { id: "pressed", label: "Press it" },
    ],
  },
];
const CHIP_EXCL: Record<string, string | undefined> = Object.fromEntries(
  REFIT_GROUPS.flatMap((g) => g.chips.map((c) => [c.id, c.excl])),
);

interface FittingRender {
  id: string;
  url: string;
  garmentId: string | null;
  modelId: string | null;
  settingId: string | null;
  prompt: string | null;
  kind?: string;
  provider?: string | null;
  createdAt: string;
}

interface FittingModelItem {
  id: string;
  fileId: string;
  url: string;
  label: string;
  presetId: string | null;
  source: string;
  createdAt: string;
}

interface GarmentSource {
  id: string;
  url: string;
  label: string;
  prompt: string | null;
}

interface FittingCaps {
  generate: { available: boolean; provider: string | null };
  referenceGen: { available: boolean; provider: string | null };
  tryOn: { available: boolean; provider: string | null };
}

interface RosterItem {
  id: string;
  name: string;
  gender: "female" | "male";
  build: string;
  url: string;
}

interface UploadedImg {
  id: string;
  url: string;
}

interface QuotaInfo {
  used: number;
  limit: number;
  remaining: number;
}

interface UseTargetItem {
  id: string;
  name?: string;
  title?: string;
}

export function FittingStudioPage() {
  const toast = useToast();
  const [rendering, setRendering] = useState(false);
  const [activeRender, setActiveRender] = useState<FittingRender | null>(null);
  const renders = useFetch<FittingRender[]>("/api/admin/fitting/renders");
  const capabilities = useFetch<FittingCaps>("/api/admin/fitting/capabilities");
  const models = useFetch<FittingModelItem[]>("/api/admin/fitting/models");
  const roster = useFetch<RosterItem[]>("/api/admin/fitting/roster");
  const garmentSources = useFetch<GarmentSource[]>("/api/admin/fitting/garment-sources");
  const quota = useFetch<QuotaInfo>("/api/admin/fitting/quota");

  const [garmentPhoto, setGarmentPhoto] = useState<UploadedImg | null>(null);
  const [garmentSource, setGarmentSource] = useState<"studio" | "upload">("studio");
  // Up to three models — one try-on each, so a garment can be judged across
  // different bodies in a single pass (a mini line review).
  const [modelSels, setModelSels] = useState<{ kind: "roster" | "shop"; id: string }[]>([]);
  const [progress, setProgress] = useState("");
  const [compareWith, setCompareWith] = useState<FittingRender | null>(null);
  const [colorwayText, setColorwayText] = useState("");
  const [rosterGender, setRosterGender] = useState<"female" | "male">("female");
  const [category, setCategory] = useState<"auto" | "tops" | "bottoms" | "one-pieces">("auto");
  const [evenLighting, setEvenLighting] = useState(true);
  const [refitSel, setRefitSel] = useState<string[]>([]);
  const [refitNote, setRefitNote] = useState("");
  const [showGrid, setShowGrid] = useState(false);
  const [busyUpload, setBusyUpload] = useState(false);
  const [addingModel, setAddingModel] = useState(false);

  // "Use on your site" mini-panel for the active render.
  const [useOpen, setUseOpen] = useState(false);
  const [useTarget, setUseTarget] = useState<"product" | "lookbook">("product");
  const [useItemId, setUseItemId] = useState("");
  const [sendingUse, setSendingUse] = useState(false);
  const products = useFetch<UseTargetItem[]>("/api/admin/products");
  const lookbooks = useFetch<UseTargetItem[]>("/api/admin/content/lookbooks");

  // Deep link from the Design Studio: /admin/fitting?garment=<fileId> preselects
  // that design as the garment and drops you straight into try-on.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const g = params.get("garment");
    if (g) {
      setGarmentPhoto({ id: g, url: `/media/${g}` });
      setGarmentSource("studio");
    }
  }, []);

  async function uploadImage(file: File): Promise<UploadedImg> {
    const form = new FormData();
    form.set("file", file);
    form.set("entityType", "general");
    form.set("isPublic", "1");
    const res = await api.upload<{ id: string }>("/api/admin/files/upload", form);
    return { id: res.id, url: `/media/${res.id}` };
  }

  async function onGarmentFile(files: FileList | null) {
    if (!files?.[0]) return;
    setBusyUpload(true);
    try {
      setGarmentPhoto(await uploadImage(files[0]));
    } catch {
      toast.error("Upload failed");
    } finally {
      setBusyUpload(false);
    }
  }

  function toggleModel(sel: { kind: "roster" | "shop"; id: string }) {
    setModelSels((s) => {
      const on = s.some((m) => m.kind === sel.kind && m.id === sel.id);
      if (on) return s.filter((m) => !(m.kind === sel.kind && m.id === sel.id));
      return [...s, sel].slice(-3);
    });
  }

  async function runTryOn() {
    if (!garmentPhoto || modelSels.length === 0) return;
    setRendering(true);
    let done = 0;
    try {
      for (let i = 0; i < modelSels.length; i++) {
        const sel = modelSels[i];
        if (modelSels.length > 1) setProgress(`Fitting model ${i + 1} of ${modelSels.length}…`);
        const payload: Record<string, unknown> = {
          garmentFileId: garmentPhoto.id,
          category,
          cleanGarment: evenLighting,
        };
        if (sel.kind === "roster") {
          payload.modelRosterId = sel.id;
        } else {
          const model = (models.data ?? []).find((m) => m.id === sel.id);
          if (!model) continue;
          payload.modelFileId = model.fileId;
        }
        const res = await api.post<FittingRender>("/api/admin/fitting/tryon", payload);
        setActiveRender(res);
        done++;
      }
      toast.success(done > 1 ? `Tried on ${done} models` : "Garment tried on");
    } catch (e) {
      toast.error(
        done > 0 ? `Try-on stopped after ${done} of ${modelSels.length}` : "Try-on failed",
        e instanceof Error ? e.message : undefined,
      );
    } finally {
      setProgress("");
      setRendering(false);
      renders.reload();
      quota.reload();
    }
  }

  async function runColorways() {
    if (!activeRender) return;
    const colors = colorwayText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 3);
    if (colors.length === 0) return;
    setRendering(true);
    setProgress(`Dyeing ${colors.length} colorway${colors.length > 1 ? "s" : ""}…`);
    try {
      const res = await api.post<{ renders: FittingRender[]; requested: number }>(
        `/api/admin/fitting/renders/${activeRender.id}/colorways`,
        { colors },
      );
      setColorwayText("");
      if (res.renders[0]) setActiveRender(res.renders[0]);
      toast.success(
        `${res.renders.length} colorway${res.renders.length > 1 ? "s" : ""} added`,
        res.renders.length < colors.length ? "Some colours didn't come out — try them again." : undefined,
      );
    } catch (e) {
      toast.error("Couldn't dye the colorways", e instanceof Error ? e.message : undefined);
    } finally {
      setProgress("");
      setRendering(false);
      renders.reload();
      quota.reload();
    }
  }

  async function runRefit() {
    if (!activeRender || (refitSel.length === 0 && !refitNote.trim())) return;
    setRendering(true);
    try {
      const res = await api.post<FittingRender>(`/api/admin/fitting/renders/${activeRender.id}/refit`, {
        adjustments: refitSel,
        note: refitNote.trim() || undefined,
      });
      setActiveRender(res);
      renders.reload();
      quota.reload();
      setRefitSel([]);
      setRefitNote("");
      toast.success("Look refitted");
    } catch (e) {
      toast.error("Couldn't refit the look", e instanceof Error ? e.message : undefined);
    } finally {
      setRendering(false);
    }
  }

  async function adoptUploadedModel(files: FileList | null) {
    if (!files?.[0]) return;
    setAddingModel(true);
    try {
      const img = await uploadImage(files[0]);
      const m = await api.post<FittingModelItem>("/api/admin/fitting/models", {
        fileId: img.id,
        label: "My model",
      });
      models.reload();
      toggleModel({ kind: "shop", id: m.id });
      toast.success("Model added");
    } catch {
      toast.error("Couldn't add model");
    } finally {
      setAddingModel(false);
    }
  }

  async function removeRender(id: string) {
    try {
      await api.delete(`/api/admin/fitting/renders/${id}`);
      if (activeRender?.id === id) setActiveRender(null);
      renders.reload();
    } catch {
      toast.error("Couldn't delete");
    }
  }

  async function sendRenderTo() {
    if (!activeRender || !useItemId) return;
    setSendingUse(true);
    try {
      await api.post(`/api/admin/fitting/renders/${activeRender.id}/use`, {
        target: useTarget,
        productId: useTarget === "product" ? useItemId : undefined,
        lookbookId: useTarget === "lookbook" ? useItemId : undefined,
      });
      setUseOpen(false);
      setUseItemId("");
      toast.success(useTarget === "product" ? "Added as a product photo" : "Added to the lookbook", "The image is live on your site.");
    } catch (e) {
      toast.error("Couldn't add the image", e instanceof Error ? e.message : undefined);
    } finally {
      setSendingUse(false);
    }
  }

  const useItems = useTarget === "product" ? (products.data ?? []) : (lookbooks.data ?? []);
  const remaining = quota.data?.remaining;

  return (
    <div>
      <PageHeader
        eyebrow="Design & Development · dial it in"
        title="Fitting Studio"
        description="Where you dial a garment in. Bring a Design Studio creation (or a photo of a real sample) and try it on your consistent model roster — the same bodies across every style — so you can judge fit and styling for real. Exploring new ideas? Start in the Design Studio."
        help="look-studio"
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* Viewer */}
        <div className="overflow-hidden rounded-lg border border-ink/10 bg-[#f4f2ee]">
          <div className="relative h-[540px] w-full bg-white">
            {activeRender ? (
              <>
                {compareWith ? (
                  <div className="grid h-full w-full grid-cols-2">
                    <div className="relative border-r border-ink/10">
                      <img src={activeRender.url} alt="Current render" className="h-full w-full object-contain" />
                      <span className="absolute left-2 top-2 rounded-full bg-navy/85 px-2 py-0.5 text-[10px] text-chalk">
                        Current
                      </span>
                    </div>
                    <div className="relative">
                      <img src={compareWith.url} alt="Comparison render" className="h-full w-full object-contain" />
                      <span className="absolute left-2 top-2 rounded-full bg-ink/60 px-2 py-0.5 text-[10px] text-chalk">
                        {compareWith.kind === "refit"
                          ? "Refit"
                          : compareWith.kind === "colorway"
                            ? "Colorway"
                            : compareWith.kind === "tryon"
                              ? "Try-on"
                              : "Render"}
                      </span>
                    </div>
                  </div>
                ) : (
                  <img
                    src={activeRender.url}
                    alt="Garment rendered on a model"
                    className="h-full w-full object-contain"
                  />
                )}
                {showGrid && (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0"
                    style={{
                      backgroundImage:
                        "linear-gradient(to right, rgba(28,43,58,0.14) 1px, transparent 1px), " +
                        "linear-gradient(to bottom, rgba(28,43,58,0.14) 1px, transparent 1px)",
                      backgroundSize: "10% 5%",
                    }}
                  />
                )}
                <div className="absolute right-2 top-2 flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (compareWith) {
                        setCompareWith(null);
                      } else {
                        const other = (renders.data ?? []).find((r) => r.id !== activeRender.id);
                        if (other) setCompareWith(other);
                      }
                    }}
                    title="Side-by-side — click any render in the gallery below to compare it against the current one"
                    className={`rounded-full border px-2.5 py-1 text-[11px] backdrop-blur transition ${
                      compareWith
                        ? "border-navy bg-navy text-chalk"
                        : "border-ink/20 bg-white/85 text-ink/70 hover:border-navy hover:text-navy"
                    }`}
                  >
                    {compareWith ? "Exit compare" : "Compare"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowGrid((g) => !g)}
                    title="Proportion grid — the lines stay put between renders, so you can verify a refit actually moved a hem or sleeve"
                    className={`rounded-full border px-2.5 py-1 text-[11px] backdrop-blur transition ${
                      showGrid
                        ? "border-navy bg-navy text-chalk"
                        : "border-ink/20 bg-white/85 text-ink/70 hover:border-navy hover:text-navy"
                    }`}
                  >
                    {showGrid ? "Grid on" : "Grid"}
                  </button>
                </div>
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                <p className="max-w-sm text-sm text-warmgrey">
                  Photograph your real garment and try it on a model. Add a garment photo and pick a model on
                  the right.
                </p>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={runTryOn}
                  disabled={rendering || !garmentPhoto || modelSels.length === 0}
                >
                  {rendering ? progress || "Rendering…" : "Try it on"}
                </button>
              </div>
            )}
            {rendering && activeRender && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-sm text-navy">
                {progress || "Rendering a new look…"}
              </div>
            )}
          </div>

          {activeRender && (
            <div className="border-t border-ink/10 bg-white/70 px-4 py-2.5">
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-warmgrey">
                Refit this look
              </p>
              <div className="space-y-1.5">
                {REFIT_GROUPS.map((group) => (
                  <div key={group.label} className="flex flex-wrap items-center gap-1.5">
                    <span className="w-12 shrink-0 text-[10px] uppercase tracking-wider text-warmgrey/70">
                      {group.label}
                    </span>
                    {group.chips.map((chip) => {
                      const on = refitSel.includes(chip.id);
                      return (
                        <button
                          key={chip.id}
                          type="button"
                          onClick={() =>
                            setRefitSel((s) => {
                              if (s.includes(chip.id)) return s.filter((x) => x !== chip.id);
                              const cleared = chip.excl ? s.filter((x) => CHIP_EXCL[x] !== chip.excl) : s;
                              return [...cleared, chip.id];
                            })
                          }
                          className={`rounded-full border px-2.5 py-0.5 text-[11px] transition ${
                            on
                              ? "border-navy bg-navy text-chalk"
                              : "border-ink/20 bg-white text-ink/70 hover:border-navy hover:text-navy"
                          }`}
                        >
                          {chip.label}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <input
                  className="input flex-1 text-xs"
                  placeholder="Or describe it — e.g. “sleeves to the elbow, a touch boxier”"
                  value={refitNote}
                  onChange={(e) => setRefitNote(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") runRefit();
                  }}
                />
                <button
                  type="button"
                  className="btn btn-secondary whitespace-nowrap text-xs"
                  onClick={runRefit}
                  disabled={
                    rendering ||
                    (refitSel.length === 0 && !refitNote.trim()) ||
                    (capabilities.data && !capabilities.data.referenceGen.available) === true
                  }
                >
                  {rendering ? "Refitting…" : "Refit"}
                </button>
              </div>

              {/* Render exits — a finished look shouldn't be a dead end. */}
              <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-ink/10 pt-2.5">
                <span className="text-[10px] uppercase tracking-wider text-warmgrey/70">Send it</span>
                <a
                  href={activeRender.url}
                  download={`verto-look-${activeRender.id}.png`}
                  className="rounded-full border border-ink/20 bg-white px-2.5 py-0.5 text-[11px] text-ink/70 transition hover:border-navy hover:text-navy"
                >
                  Download
                </a>
                <button
                  type="button"
                  onClick={() => setUseOpen((o) => !o)}
                  className={`rounded-full border px-2.5 py-0.5 text-[11px] transition ${
                    useOpen
                      ? "border-navy bg-navy text-chalk"
                      : "border-ink/20 bg-white text-ink/70 hover:border-navy hover:text-navy"
                  }`}
                >
                  Use on your site
                </button>
                {typeof remaining === "number" && (
                  <span className="ml-auto text-[11px] text-warmgrey" title="Each try-on or refit uses one render. Resets at 00:00 UTC.">
                    {remaining} of {quota.data!.limit} renders left today
                  </span>
                )}
              </div>
              {useOpen && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <select
                    className="input w-auto text-xs"
                    value={useTarget}
                    onChange={(e) => {
                      setUseTarget(e.target.value as "product" | "lookbook");
                      setUseItemId("");
                    }}
                  >
                    <option value="product">Product photo</option>
                    <option value="lookbook">Lookbook image</option>
                  </select>
                  <select
                    className="input min-w-40 flex-1 text-xs"
                    value={useItemId}
                    onChange={(e) => setUseItemId(e.target.value)}
                  >
                    <option value="">{useTarget === "product" ? "Pick a product…" : "Pick a lookbook…"}</option>
                    {useItems.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.name || it.title || it.id}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-secondary text-xs"
                    onClick={sendRenderTo}
                    disabled={sendingUse || !useItemId}
                  >
                    {sendingUse ? "Adding…" : "Add"}
                  </button>
                </div>
              )}

              {/* Colorways — the same look, re-dyed. Line planning in one pass. */}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider text-warmgrey/70">Colorways</span>
                <input
                  className="input min-w-40 flex-1 text-xs"
                  placeholder="sage, rust, cream — up to 3 colours"
                  value={colorwayText}
                  onChange={(e) => setColorwayText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") runColorways();
                  }}
                />
                <button
                  type="button"
                  className="btn btn-secondary text-xs"
                  onClick={runColorways}
                  disabled={
                    rendering ||
                    !colorwayText.trim() ||
                    (capabilities.data && !capabilities.data.referenceGen.available) === true
                  }
                >
                  {rendering ? "Dyeing…" : "Recolour"}
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-ink/10 bg-white/60 px-4 py-2 text-xs text-warmgrey">
            <span>
              {activeRender
                ? activeRender.kind === "refit"
                  ? "Refit render"
                  : activeRender.kind === "tryon"
                    ? "Try-on render"
                    : "Model render"
                : "Virtual try-on"}
            </span>
            <span>Photoreal AI render</span>
          </div>
        </div>

        {/* Try-on controls */}
        <div className="space-y-5">
          <div className="space-y-3 rounded-lg border border-navy/15 bg-navy/[0.03] p-3">
            {capabilities.data && !capabilities.data.tryOn.available && (
              <p className="rounded border border-amber-300 bg-amber-50 p-2 text-[11px] text-amber-700">
                Virtual try-on needs a <strong>fal.ai</strong> or <strong>FASHN</strong> API key. Ask your
                platform admin to set <code>FAL_KEY</code> to turn this on.
              </p>
            )}
            {/* Step 1 — the garment: a Design Studio creation or a photo */}
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-warmgrey">
                1 · Your garment
              </label>
              {garmentPhoto ? (
                <div className="relative inline-block">
                  <img
                    src={garmentPhoto.url}
                    alt="Garment"
                    className="h-28 w-28 rounded border border-ink/15 object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setGarmentPhoto(null)}
                    className="absolute -right-1 -top-1 rounded-full bg-white px-1 text-[10px] text-ink/60 shadow"
                    title="Choose a different garment"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <>
                  <div className="mb-2 flex overflow-hidden rounded-md border border-ink/15 text-[11px]">
                    {(["studio", "upload"] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setGarmentSource(s)}
                        className={`flex-1 px-2 py-1.5 ${
                          garmentSource === s ? "bg-navy text-chalk" : "bg-white text-ink/60 hover:text-ink"
                        }`}
                      >
                        {s === "studio" ? "From Design Studio" : "Upload a photo"}
                      </button>
                    ))}
                  </div>
                  {garmentSource === "studio" ? (
                    (garmentSources.data ?? []).length > 0 ? (
                      <div className="grid max-h-48 grid-cols-3 gap-1.5 overflow-y-auto pr-1">
                        {(garmentSources.data ?? []).map((g) => (
                          <button
                            key={g.id}
                            type="button"
                            onClick={() => setGarmentPhoto({ id: g.id, url: g.url })}
                            className="overflow-hidden rounded border border-ink/15 hover:border-navy"
                            title={g.label}
                          >
                            <img src={g.url} alt={g.label} className="aspect-square w-full object-cover" />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="rounded border border-dashed border-ink/20 px-3 py-4 text-center text-[11px] text-warmgrey">
                        No Design Studio images yet. Create one in{" "}
                        <a href="/admin/ai-concepts" className="link-quiet">
                          Design Studio
                        </a>
                        , or upload a photo.
                      </p>
                    )
                  ) : (
                    <label className="flex h-24 cursor-pointer items-center justify-center rounded border border-dashed border-ink/25 text-center text-xs text-warmgrey hover:border-navy hover:text-navy">
                      {busyUpload ? "Uploading…" : "Upload a photo of your garment (flat lay or worn)"}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => onGarmentFile(e.target.files)}
                      />
                    </label>
                  )}
                </>
              )}
            </div>
            {/* Category */}
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-warmgrey">
                Garment type
              </label>
              <div className="flex overflow-hidden rounded-md border border-ink/15 text-xs">
                {(["auto", "tops", "bottoms", "one-pieces"] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`flex-1 px-1.5 py-1.5 ${
                      category === cat ? "bg-navy text-chalk" : "bg-white text-ink/60 hover:text-ink"
                    }`}
                  >
                    {cat === "one-pieces" ? "dress" : cat}
                  </button>
                ))}
              </div>
            </div>
            {/* Model picker — the shared roster, plus this shop's own models */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="block text-xs font-medium uppercase tracking-wider text-warmgrey">
                  2 · Choose models <span className="normal-case text-warmgrey/70">· up to 3</span>
                </label>
                <div className="flex overflow-hidden rounded-md border border-ink/15 text-[11px]">
                  {(["female", "male"] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setRosterGender(g)}
                      className={`px-2 py-0.5 ${
                        rosterGender === g ? "bg-navy text-chalk" : "bg-white text-ink/60 hover:text-ink"
                      }`}
                    >
                      {g === "female" ? "Women" : "Men"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid max-h-56 grid-cols-4 gap-1.5 overflow-y-auto pr-1">
                {(roster.data ?? [])
                  .filter((m) => m.gender === rosterGender)
                  .map((m) => {
                    const on = modelSels.some((s) => s.kind === "roster" && s.id === m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => toggleModel({ kind: "roster", id: m.id })}
                        className={`relative overflow-hidden rounded border ${
                          on ? "border-navy ring-2 ring-navy/40" : "border-ink/15"
                        }`}
                        title={`${m.name} · ${m.build}`}
                      >
                        <img src={m.url} alt={m.name} className="aspect-[3/4] w-full object-cover" />
                      </button>
                    );
                  })}
              </div>
              {(models.data ?? []).length > 0 && (
                <>
                  <p className="mt-2 text-[11px] uppercase tracking-wider text-warmgrey/70">Your models</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {(models.data ?? []).map((m) => {
                      const on = modelSels.some((s) => s.kind === "shop" && s.id === m.id);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => toggleModel({ kind: "shop", id: m.id })}
                          className={`relative overflow-hidden rounded border ${
                            on ? "border-navy ring-2 ring-navy/40" : "border-ink/15"
                          }`}
                          title={m.label}
                        >
                          <img src={m.url} alt={m.label} className="h-20 w-16 object-cover" />
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
              <label className="mt-2 flex cursor-pointer items-center justify-center rounded border border-dashed border-ink/25 py-1.5 text-center text-[11px] text-warmgrey hover:border-navy hover:text-navy">
                {addingModel ? "Uploading…" : "+ Upload your own model photo"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => adoptUploadedModel(e.target.files)}
                />
              </label>
            </div>
            <label className="flex cursor-pointer items-start gap-2 text-[11px] leading-snug text-warmgrey">
              <input
                type="checkbox"
                checked={evenLighting}
                onChange={(e) => setEvenLighting(e.target.checked)}
                className="mt-0.5 accent-navy"
              />
              <span>
                <span className="font-medium text-ink/80">Even out the photo's lighting first.</span> Shadows
                falling across your garment photo can read as darker fabric — this re-lights the photo before
                the try-on. Untick if a colour comes back wrong.
              </span>
            </label>
            <button
              type="button"
              className="btn btn-primary w-full"
              onClick={runTryOn}
              disabled={
                rendering ||
                !garmentPhoto ||
                modelSels.length === 0 ||
                (capabilities.data && !capabilities.data.tryOn.available) === true
              }
            >
              {rendering
                ? progress || "Trying it on…"
                : modelSels.length > 1
                  ? `Try it on ${modelSels.length} models`
                  : "Try it on"}
            </button>
            <p className="text-[11px] leading-snug text-warmgrey">
              Photoreal virtual try-on of your real garment.{" "}
              {capabilities.data?.tryOn.provider ? `Engine: ${capabilities.data.tryOn.provider}. ` : ""}
              {typeof remaining === "number" ? `${remaining} of ${quota.data!.limit} renders left today.` : ""}
            </p>
          </div>
        </div>
      </div>

      {/* Model renders gallery */}
      {(renders.data ?? []).length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 font-display text-lg font-light">Model renders</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {(renders.data ?? []).map((r) => (
              <div key={r.id} className="group relative overflow-hidden rounded-lg border border-ink/10 bg-white">
                <button
                  type="button"
                  onClick={() => (compareWith && activeRender && r.id !== activeRender.id ? setCompareWith(r) : setActiveRender(r))}
                  className="block w-full"
                  title={compareWith ? "Compare against this render" : "View this render"}
                >
                  <img src={r.url} alt="Model render" className="aspect-[3/4] w-full object-cover" />
                </button>
                {(r.kind === "tryon" || r.kind === "refit" || r.kind === "colorway") && (
                  <span className="absolute left-1.5 top-1.5 rounded-full bg-navy/85 px-1.5 py-0.5 text-[10px] text-chalk">
                    {r.kind === "tryon" ? "Try-on" : r.kind === "refit" ? "Refit" : "Colorway"}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => removeRender(r.id)}
                  className="absolute right-1.5 top-1.5 rounded-full bg-white/85 px-2 py-0.5 text-xs text-ink/70 opacity-0 transition group-hover:opacity-100 hover:text-red-600"
                  title="Delete"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="mt-6 max-w-3xl text-xs text-warmgrey">
        <strong>Design Studio</strong> is where you dream garments up; the <strong>Fitting Studio</strong> is where
        you dial them in. <strong>Try-on</strong> takes a real garment — a Design Studio creation or a photo of a
        sample — and puts it on your <strong>consistent model roster</strong>, so you can judge fit on the same
        bodies across every style. Refit the cut, style how it's worn, then send the result straight to a product
        page or lookbook.
      </p>
    </div>
  );
}
