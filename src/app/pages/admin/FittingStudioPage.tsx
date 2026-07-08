import { Component, Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, ContactShadows, Center, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import {
  GARMENT_LIBRARY,
  SIZE_STEPS,
  FIT_PRESETS,
  DEFAULT_FIT,
  type BaseGarment,
  type FitConfig,
  type SizeStep,
} from "../../../shared/garments";
import { FABRIC_LIBRARY, type FabricRef } from "../../../shared/fabrics";
import {
  FITTING_MODELS,
  FITTING_SETTINGS,
  DEFAULT_FITTING_MODEL,
  DEFAULT_FITTING_SETTING,
} from "../../../shared/fitting-models";
import { buildGarment, buildMannequin, disposeGroup, fabricAppearance } from "../../lib/garmentGeometry";
import { draftPatternSvg, patternLabel, type BodyMeasurements } from "../../lib/patterns";
import { PageHeader, EmptyState } from "../../components/admin/ui";
import { useFetch } from "../../lib/useFetch";
import { api } from "../../lib/api";
import { useToast } from "../../lib/toast";
import type { AdminStyle } from "../../../shared/types";

// ---------------------------------------------------------------------------
// Viewer — builds the garment (and optional mannequin) via the shared geometry
// module, so the live app matches the offline previews exactly. A stylized
// proportion+fabric study, not a physics drape (that's a later phase).
// ---------------------------------------------------------------------------

// Realistic body: a CC0 MakeHuman base mesh (see public/models/README.md).
const MANNEQUIN_URL = "/models/mannequin.glb";
useGLTF.preload(MANNEQUIN_URL);
const BODY_MATERIAL = new THREE.MeshStandardMaterial({ color: "#d7d3cd", roughness: 0.9, metalness: 0 });

function RealBody() {
  const gltf = useGLTF(MANNEQUIN_URL) as unknown as { scene: THREE.Group };
  const body = useMemo(() => {
    const c = gltf.scene.clone(true);
    c.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.material = BODY_MATERIAL;
    });
    return c;
  }, [gltf]);
  return <primitive object={body} />;
}

// Fallback body (procedural primitives) shown while the GLB loads or if it fails.
function ProceduralBody() {
  const body = useMemo(() => buildMannequin(), []);
  return <primitive object={body} />;
}

class BodyBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function GarmentScene({
  garment,
  fit,
  fabric,
  color,
  showBody,
}: {
  garment: BaseGarment;
  fit: FitConfig;
  fabric: FabricRef | undefined;
  color: string;
  showBody: boolean;
}) {
  const group = useMemo(() => {
    const g = new THREE.Group();
    g.add(buildGarment(garment, fit, fabric, color));
    return g;
  }, [garment, fit, fabric, color]);
  // Dispose the previous group's geometries/materials when it's replaced.
  useEffect(() => () => disposeGroup(group), [group]);
  return (
    <Center>
      {showBody && (
        <BodyBoundary fallback={<ProceduralBody />}>
          <Suspense fallback={<ProceduralBody />}>
            <RealBody />
          </Suspense>
        </BodyBoundary>
      )}
      <primitive object={group} />
    </Center>
  );
}

function Viewer({
  garment,
  fit,
  fabric,
  color,
  spin,
  showBody,
}: {
  garment: BaseGarment;
  fit: FitConfig;
  fabric: FabricRef | undefined;
  color: string;
  spin: boolean;
  showBody: boolean;
}) {
  return (
    <Canvas camera={{ position: [0, 0, 3.4], fov: 38 }} dpr={[1, 2]}>
      <color attach="background" args={["#f4f2ee"]} />
      <ambientLight intensity={0.65} />
      <hemisphereLight args={["#ffffff", "#b8b0a4", 0.5]} />
      <directionalLight position={[4, 6, 5]} intensity={1.2} />
      <directionalLight position={[-5, 2, -3]} intensity={0.35} />
      <GarmentScene garment={garment} fit={fit} fabric={fabric} color={color} showBody={showBody} />
      <ContactShadows position={[0, -1.1, 0]} opacity={0.35} scale={5} blur={2.4} far={3} />
      <OrbitControls
        enablePan={false}
        minDistance={1.6}
        maxDistance={6}
        autoRotate={spin}
        autoRotateSpeed={1.6}
        target={[0, 0, 0]}
      />
    </Canvas>
  );
}

// ---------------------------------------------------------------------------

interface SavedLook {
  id: string;
  name: string;
  garmentId: string;
  fabricId: string;
  color: string | null;
  fit: Partial<FitConfig>;
  styleId: string | null;
  styleName: string | null;
  updatedAt: string;
}

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

// A tiny hex→name map so the "on a model" prompt describes colour in words the
// image model understands (a hex string is meaningless to Flux).
const COLOR_NAMES: [number, number, number, string][] = [
  [0, 0, 0, "black"],
  [40, 40, 40, "charcoal"],
  [128, 128, 128, "grey"],
  [220, 220, 220, "light grey"],
  [255, 255, 255, "white"],
  [245, 240, 225, "cream"],
  [120, 90, 60, "camel"],
  [90, 60, 40, "brown"],
  [40, 55, 95, "navy"],
  [60, 110, 190, "blue"],
  [120, 190, 220, "sky blue"],
  [40, 110, 90, "emerald green"],
  [120, 150, 90, "olive"],
  [150, 30, 40, "burgundy"],
  [200, 60, 60, "red"],
  [220, 130, 140, "pink"],
  [230, 150, 70, "rust orange"],
  [235, 205, 120, "mustard"],
  [110, 80, 150, "purple"],
];
function colorName(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "";
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255,
    g = (n >> 8) & 255,
    b = n & 255;
  let best = COLOR_NAMES[0],
    bestD = Infinity;
  for (const c of COLOR_NAMES) {
    const d = (c[0] - r) ** 2 + (c[1] - g) ** 2 + (c[2] - b) ** 2;
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best[3];
}

// The Mannequin (3D proportion study) and Pattern (sewing-pattern drafter) views
// are hidden for now — the Fitting Studio is focused purely on virtual try-on.
// Both are still fully built (this file's Viewer/pattern code + the shared
// geometry and pattern modules); flip this to bring the two tabs back when we
// return to them. Kept as a flag rather than deleted so re-enabling is one line.
const SHOW_STUDY_TABS = false;

export function FittingStudioPage() {
  const toast = useToast();
  const [garmentId, setGarmentId] = useState(GARMENT_LIBRARY[0].id);
  const garment = useMemo(() => GARMENT_LIBRARY.find((g) => g.id === garmentId)!, [garmentId]);
  const [fabricId, setFabricId] = useState(garment.defaultFabric);
  const fabric = useMemo(() => FABRIC_LIBRARY.find((f) => f.id === fabricId), [fabricId]);
  const [color, setColor] = useState(fabricAppearance(fabric).color);
  const [fit, setFit] = useState<FitConfig>(DEFAULT_FIT);
  const [spin, setSpin] = useState(true);
  const [showBody, setShowBody] = useState(true);
  const [view, setView] = useState<"model" | "3d" | "pattern">("model");
  const [measurements, setMeasurements] = useState<BodyMeasurements>({});
  const [designPrompt, setDesignPrompt] = useState("");
  const [designing, setDesigning] = useState(false);

  // AI Look Studio ("on a model") state.
  const [modelId, setModelId] = useState(DEFAULT_FITTING_MODEL);
  const [settingId, setSettingId] = useState(DEFAULT_FITTING_SETTING);
  // The Fitting Studio is for dialing a real garment in, so "on a model" is
  // try-on only — freeform "generate a garment" lives in the Design Studio.
  const [studioMode, setStudioMode] = useState<"generate" | "tryon">("tryon");
  const [rendering, setRendering] = useState(false);
  const [activeRender, setActiveRender] = useState<FittingRender | null>(null);
  const renders = useFetch<FittingRender[]>("/api/admin/fitting/renders");
  const capabilities = useFetch<FittingCaps>("/api/admin/fitting/capabilities");
  const models = useFetch<FittingModelItem[]>("/api/admin/fitting/models");
  const roster = useFetch<RosterItem[]>("/api/admin/fitting/roster");
  const garmentSources = useFetch<GarmentSource[]>("/api/admin/fitting/garment-sources");

  // Mood board (reference images) + try-on photo + chosen base model.
  const [moodboard, setMoodboard] = useState<UploadedImg[]>([]);
  const [garmentPhoto, setGarmentPhoto] = useState<UploadedImg | null>(null);
  const [garmentSource, setGarmentSource] = useState<"studio" | "upload">("studio");
  const [modelSel, setModelSel] = useState<{ kind: "roster" | "shop"; id: string } | null>(null);
  const [rosterGender, setRosterGender] = useState<"female" | "male">("female");
  const [category, setCategory] = useState<"auto" | "tops" | "bottoms" | "one-pieces">("auto");
  const [evenLighting, setEvenLighting] = useState(true);
  const [refitSel, setRefitSel] = useState<string[]>([]);
  const [refitNote, setRefitNote] = useState("");
  const [showGrid, setShowGrid] = useState(false);
  const [busyUpload, setBusyUpload] = useState(false);
  const [addingModel, setAddingModel] = useState(false);

  // Deep link from the Design Studio: /admin/fitting?garment=<fileId> preselects
  // that design as the garment and drops you straight into try-on.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const g = params.get("garment");
    if (g) {
      setGarmentPhoto({ id: g, url: `/media/${g}` });
      setGarmentSource("studio");
      setStudioMode("tryon");
      setView("model");
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

  async function onMoodboardFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusyUpload(true);
    try {
      const uploaded: UploadedImg[] = [];
      for (const f of Array.from(files).slice(0, 6)) uploaded.push(await uploadImage(f));
      setMoodboard((m) => [...m, ...uploaded].slice(0, 6));
    } catch {
      toast.error("Upload failed");
    } finally {
      setBusyUpload(false);
    }
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

  async function generateOnModel() {
    setRendering(true);
    try {
      const res = await api.post<FittingRender>("/api/admin/fitting/generate", {
        garmentId,
        fabricId,
        colorName: colorName(color),
        description: designPrompt.trim() || undefined,
        modelId,
        settingId,
        styleId: styleId || null,
        referenceFileIds: moodboard.map((m) => m.id),
        fit: { ease: fit.ease, length: fit.length, sleeve: hasSleeve ? fit.sleeve : undefined },
      });
      setActiveRender(res);
      renders.reload();
      toast.success("Look rendered on a model");
    } catch (e) {
      toast.error("Couldn't render the look", e instanceof Error ? e.message : undefined);
    } finally {
      setRendering(false);
    }
  }

  async function runTryOn() {
    if (!garmentPhoto || !modelSel) return;
    const payload: Record<string, unknown> = {
      garmentFileId: garmentPhoto.id,
      category,
      garmentId,
      styleId: styleId || null,
      cleanGarment: evenLighting,
    };
    if (modelSel.kind === "roster") {
      payload.modelRosterId = modelSel.id;
    } else {
      const model = (models.data ?? []).find((m) => m.id === modelSel.id);
      if (!model) return;
      payload.modelFileId = model.fileId;
    }
    setRendering(true);
    try {
      const res = await api.post<FittingRender>("/api/admin/fitting/tryon", payload);
      setActiveRender(res);
      renders.reload();
      toast.success("Garment tried on");
    } catch (e) {
      toast.error("Try-on failed", e instanceof Error ? e.message : undefined);
    } finally {
      setRendering(false);
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
      setModelSel({ kind: "shop", id: m.id });
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

  const pattern = useMemo(
    () => (view === "pattern" ? draftPatternSvg(garmentId, fit.size, measurements) : null),
    [view, garmentId, fit.size, measurements],
  );

  async function describeGarment() {
    if (!designPrompt.trim()) return;
    setDesigning(true);
    try {
      const res = await api.post<{
        garmentId: string;
        fit: FitConfig;
        fabricId: string;
        color?: string;
        rationale?: string;
      }>("/api/admin/fitting/design", { prompt: designPrompt });
      setGarmentId(res.garmentId);
      // Defer fabric/colour/fit so the garment-change effect doesn't clobber them.
      setTimeout(() => {
        if (res.fabricId) setFabricId(res.fabricId);
        if (res.color) setColor(res.color);
        setFit({ ...DEFAULT_FIT, ...res.fit });
      }, 0);
      toast.success("Design drafted", res.rationale || undefined);
    } catch {
      toast.error("Couldn't interpret that", "Try describing the garment a bit differently.");
    } finally {
      setDesigning(false);
    }
  }

  function setMeasure(key: keyof BodyMeasurements, value: string) {
    const n = Number(value);
    setMeasurements((m) => ({ ...m, [key]: value === "" || !Number.isFinite(n) ? undefined : n }));
  }

  function downloadPattern() {
    if (!pattern) return;
    const blob = new Blob([pattern.svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${garmentId}-${fit.size}-pattern.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }
  const [styleId, setStyleId] = useState("");
  const [lookName, setLookName] = useState("");
  const [saving, setSaving] = useState(false);

  const styles = useFetch<AdminStyle[]>("/api/admin/styles");
  const looks = useFetch<SavedLook[]>("/api/admin/fitting/looks");

  const hasSleeve = garment.silhouette.sleeve > 0;

  // When the garment changes, reset fabric + colour to its default.
  useEffect(() => {
    const f = FABRIC_LIBRARY.find((x) => x.id === garment.defaultFabric);
    setFabricId(garment.defaultFabric);
    setColor(fabricAppearance(f).color);
    setFit((prev) => ({ ...prev, sleeve: 1.0 }));
  }, [garment]);

  function applyFabric(id: string) {
    setFabricId(id);
    setColor(fabricAppearance(FABRIC_LIBRARY.find((f) => f.id === id)).color);
  }

  function loadLook(l: SavedLook) {
    setGarmentId(l.garmentId);
    // Defer fabric/colour so the garment-change effect doesn't clobber them.
    setTimeout(() => {
      setFabricId(l.fabricId);
      if (l.color) setColor(l.color);
      setFit({ ...DEFAULT_FIT, ...l.fit });
      setStyleId(l.styleId ?? "");
    }, 0);
  }

  async function save() {
    setSaving(true);
    try {
      await api.post("/api/admin/fitting/looks", {
        name: lookName.trim() || `${garment.name} — ${fit.size}`,
        garmentId,
        fabricId,
        color,
        fit,
        styleId: styleId || null,
      });
      setLookName("");
      toast.success("Look saved");
      looks.reload();
    } catch {
      toast.error("Couldn't save the look");
    } finally {
      setSaving(false);
    }
  }

  async function removeLook(id: string) {
    try {
      await api.delete(`/api/admin/fitting/looks/${id}`);
      looks.reload();
    } catch {
      toast.error("Couldn't delete");
    }
  }

  const garmentFabrics = FABRIC_LIBRARY.filter((f) => garment.fabrics.includes(f.id));

  return (
    <div>
      <PageHeader
        eyebrow="Design & Development · dial it in"
        title="Fitting Studio"
        description="Where you dial a garment in. Bring a Design Studio creation (or a photo of a real sample) and try it on your consistent model roster — the same bodies across every style — so you can judge fit and styling for real. Exploring new ideas? Start in the Design Studio."
        actions={
          view === "3d" ? (
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setShowBody((b) => !b)}>
                {showBody ? "Hide body" : "Show body"}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setSpin((s) => !s)}>
                {spin ? "Stop spin" : "Auto-spin"}
              </button>
            </>
          ) : undefined
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* Viewer */}
        <div className="overflow-hidden rounded-lg border border-ink/10 bg-[#f4f2ee]">
          {SHOW_STUDY_TABS && (
            <div className="flex items-center justify-between border-b border-ink/10 bg-white/60 px-3 py-2">
              <div className="flex overflow-hidden rounded-md border border-ink/15">
                {(["model", "3d", "pattern"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setView(v)}
                    className={`px-3 py-1.5 text-xs uppercase tracking-wider ${
                      view === v ? "bg-navy text-chalk" : "bg-white text-ink/60 hover:text-ink"
                    }`}
                  >
                    {v === "model" ? "Try-on" : v === "3d" ? "Mannequin" : "Pattern"}
                  </button>
                ))}
              </div>
              {view === "pattern" && pattern && (
                <button type="button" className="btn btn-secondary text-xs" onClick={downloadPattern}>
                  Download SVG
                </button>
              )}
            </div>
          )}

          {view === "model" ? (
            <>
            <div className="relative h-[540px] w-full bg-white">
              {activeRender ? (
                <>
                  <img
                    src={activeRender.url}
                    alt="Garment rendered on a model"
                    className="h-full w-full object-contain"
                  />
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
                  <button
                    type="button"
                    onClick={() => setShowGrid((g) => !g)}
                    title="Proportion grid — the lines stay put between renders, so you can verify a refit actually moved a hem or sleeve"
                    className={`absolute right-2 top-2 rounded-full border px-2.5 py-1 text-[11px] backdrop-blur transition ${
                      showGrid
                        ? "border-navy bg-navy text-chalk"
                        : "border-ink/20 bg-white/85 text-ink/70 hover:border-navy hover:text-navy"
                    }`}
                  >
                    {showGrid ? "Grid on" : "Grid"}
                  </button>
                </>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                  <p className="max-w-sm text-sm text-warmgrey">
                    {studioMode === "tryon"
                      ? "Photograph your real garment and try it on a model. Add a garment photo and pick a model on the right."
                      : "Render this garment on a photoreal model. Pick a body and setting on the right — or drop in a mood board — then generate."}
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={studioMode === "tryon" ? runTryOn : generateOnModel}
                    disabled={rendering || (studioMode === "tryon" && (!garmentPhoto || !modelSel))}
                  >
                    {rendering
                      ? "Rendering…"
                      : studioMode === "tryon"
                        ? "Try it on"
                        : "Generate on a model"}
                  </button>
                </div>
              )}
              {rendering && activeRender && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-sm text-navy">
                  Rendering a new look…
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
                                  const cleared = chip.excl
                                    ? s.filter((x) => CHIP_EXCL[x] !== chip.excl)
                                    : s;
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
                </div>
            )}
            </>
          ) : view === "3d" ? (
            <div className="h-[540px] w-full">
              <Viewer garment={garment} fit={fit} fabric={fabric} color={color} spin={spin} showBody={showBody} />
            </div>
          ) : (
            <div className="h-[540px] w-full overflow-auto bg-white p-4">
              {pattern ? (
                <div
                  className="[&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full"
                  // FreeSewing renders a self-contained SVG string (its own styles).
                  dangerouslySetInnerHTML={{ __html: pattern.svg }}
                />
              ) : (
                <div className="flex h-full items-center justify-center px-6 text-center text-sm text-warmgrey">
                  A drafted sewing pattern isn’t wired for this silhouette yet — try the tee, hoodie, slip dress,
                  wide trouser, or skirt.
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between border-t border-ink/10 bg-white/60 px-4 py-2 text-xs text-warmgrey">
            <span>
              {view === "model"
                ? `${garment.name} · ${fabric?.name ?? "—"} on a model`
                : view === "3d"
                  ? `${garment.name} · ${fabric?.name ?? "—"} · size ${fit.size}`
                  : (pattern?.label ?? patternLabel(garmentId) ?? garment.name) + ` · size ${fit.size}`}
            </span>
            <span>
              {view === "model"
                ? "Photoreal AI render"
                : view === "3d"
                  ? "Drag to orbit · scroll to zoom"
                  : "Real, manufacturable pattern"}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="space-y-5">
          {/* Describe it — the LLM design loop */}
          <div className="space-y-2 rounded-lg border border-navy/15 bg-navy/[0.03] p-3">
            <label className="block text-xs font-medium uppercase tracking-wider text-warmgrey">
              ✨ Describe your garment
            </label>
            <textarea
              className="input min-h-[64px] w-full"
              placeholder="e.g. an oversized cropped hoodie in heavy black fleece"
              value={designPrompt}
              onChange={(e) => setDesignPrompt(e.target.value)}
            />
            <button
              type="button"
              className="btn btn-primary w-full"
              onClick={describeGarment}
              disabled={designing || !designPrompt.trim()}
            >
              {designing ? "Drafting…" : "Draft it"}
            </button>
            <p className="text-[11px] leading-snug text-warmgrey">
              The LLM maps your words to a garment, fit, and fabric — updating all views. You can fine-tune
              everything below.
            </p>
          </div>

          {/* On-a-model controls (AI Look Studio) */}
          {view === "model" && (
            <div className="space-y-3 rounded-lg border border-navy/15 bg-navy/[0.03] p-3">
              {studioMode === "generate" ? (
                <>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-warmgrey">
                      Model
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {FITTING_MODELS.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setModelId(m.id)}
                          className={`rounded-full border px-2.5 py-1 text-xs ${
                            modelId === m.id
                              ? "border-navy bg-navy text-chalk"
                              : "border-ink/15 bg-white text-ink/70 hover:text-ink"
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-warmgrey">
                      Setting
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {FITTING_SETTINGS.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setSettingId(s.id)}
                          className={`rounded-full border px-2.5 py-1 text-xs ${
                            settingId === s.id
                              ? "border-navy bg-navy text-chalk"
                              : "border-ink/15 bg-white text-ink/70 hover:text-ink"
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Mood board */}
                  <div>
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-warmgrey">
                      Mood board <span className="normal-case text-warmgrey/70">· optional, up to 6</span>
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {moodboard.map((m) => (
                        <div key={m.id} className="relative">
                          <img src={m.url} alt="" className="h-12 w-12 rounded border border-ink/15 object-cover" />
                          <button
                            type="button"
                            onClick={() => setMoodboard((mb) => mb.filter((x) => x.id !== m.id))}
                            className="absolute -right-1 -top-1 rounded-full bg-white px-1 text-[10px] text-ink/60 shadow"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      {moodboard.length < 6 && (
                        <label className="flex h-12 w-12 cursor-pointer items-center justify-center rounded border border-dashed border-ink/25 text-lg text-warmgrey hover:border-navy hover:text-navy">
                          +
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(e) => onMoodboardFiles(e.target.files)}
                          />
                        </label>
                      )}
                    </div>
                    {moodboard.length > 0 && !capabilities.data?.referenceGen.available && (
                      <p className="mt-1 text-[11px] text-amber-600">
                        Style-matching from a mood board needs a fal.ai key — without it the references are ignored.
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary w-full"
                    onClick={generateOnModel}
                    disabled={rendering}
                  >
                    {rendering ? "Rendering…" : activeRender ? "Render another" : "Generate on a model"}
                  </button>
                  <p className="text-[11px] leading-snug text-warmgrey">
                    Uses the garment, fabric, and colour below (or your description above). Add a mood board to match
                    a Pinterest-style reference. {capabilities.data?.generate.provider ? `Engine: ${capabilities.data.generate.provider}.` : ""}
                  </p>
                </>
              ) : (
                <>
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
                        2 · Choose a model
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
                          const on = modelSel?.kind === "roster" && modelSel.id === m.id;
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => setModelSel({ kind: "roster", id: m.id })}
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
                            const on = modelSel?.kind === "shop" && modelSel.id === m.id;
                            return (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => setModelSel({ kind: "shop", id: m.id })}
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
                      <span className="font-medium text-ink/80">Even out the photo's lighting first.</span>{" "}
                      Shadows falling across your garment photo can read as darker fabric — this
                      re-lights the photo before the try-on. Untick if a colour comes back wrong.
                    </span>
                  </label>
                  <button
                    type="button"
                    className="btn btn-primary w-full"
                    onClick={runTryOn}
                    disabled={
                      rendering ||
                      !garmentPhoto ||
                      !modelSel ||
                      (capabilities.data && !capabilities.data.tryOn.available) === true
                    }
                  >
                    {rendering ? "Trying it on…" : "Try it on"}
                  </button>
                  <p className="text-[11px] leading-snug text-warmgrey">
                    Photoreal virtual try-on of your real garment.{" "}
                    {capabilities.data?.tryOn.provider ? `Engine: ${capabilities.data.tryOn.provider}.` : ""}
                  </p>
                </>
              )}
            </div>
          )}

          {/* Garment */}
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-warmgrey">
              Garment
            </label>
            <select
              className="input w-full"
              value={garmentId}
              onChange={(e) => setGarmentId(e.target.value)}
            >
              {GARMENT_LIBRARY.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} · {g.category}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-warmgrey">{garment.blurb}</p>
          </div>

          {/* Fabric */}
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-warmgrey">
              Fabric
            </label>
            <select className="input w-full" value={fabricId} onChange={(e) => applyFabric(e.target.value)}>
              {garmentFabrics.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
            {fabric && <p className="mt-1 text-xs text-warmgrey">{fabric.feel}</p>}
          </div>

          {/* Colour */}
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-warmgrey">
              Colour
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-9 w-12 cursor-pointer rounded border border-ink/15 bg-white p-0.5"
              />
              <span className="text-xs uppercase text-warmgrey">{color}</span>
            </div>
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
                  onClick={() => setFit((f) => ({ ...f, size: sz as SizeStep }))}
                  className={`flex-1 px-2 py-1.5 text-xs ${
                    fit.size === sz ? "bg-navy text-chalk" : "bg-white text-ink/60 hover:text-ink"
                  }`}
                >
                  {sz}
                </button>
              ))}
            </div>
          </div>

          {/* Measurements (made-to-measure — feeds the real pattern) */}
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-warmgrey">
              Measurements <span className="normal-case text-warmgrey/70">· cm, optional</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {([
                ["chestCm", "Chest"],
                ["waistCm", "Waist"],
                ["hipsCm", "Hips"],
                ["heightCm", "Height"],
              ] as const).map(([key, label]) => (
                <input
                  key={key}
                  type="number"
                  className="input w-full"
                  placeholder={label}
                  value={measurements[key] ?? ""}
                  onChange={(e) => setMeasure(key, e.target.value)}
                />
              ))}
            </div>
            <p className="mt-1 text-[11px] text-warmgrey">
              Leave blank to grade from the standard size. Saved with the look for reference.
            </p>
          </div>

          {/* Fit / ease */}
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-warmgrey">
              Fit
            </label>
            <div className="flex overflow-hidden rounded-md border border-ink/15">
              {FIT_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setFit((f) => ({ ...f, ease: p.ease }))}
                  className={`flex-1 px-2 py-1.5 text-xs ${
                    Math.abs(fit.ease - p.ease) < 0.01
                      ? "bg-navy text-chalk"
                      : "bg-white text-ink/60 hover:text-ink"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <input
              type="range"
              min={0.7}
              max={1.5}
              step={0.01}
              value={fit.ease}
              onChange={(e) => setFit((f) => ({ ...f, ease: Number(e.target.value) }))}
              className="mt-2 w-full"
            />
          </div>

          {/* Length */}
          <div>
            <div className="mb-1 flex justify-between text-xs uppercase tracking-wider text-warmgrey">
              <span>Length</span>
              <span>{Math.round(fit.length * 100)}%</span>
            </div>
            <input
              type="range"
              min={0.8}
              max={1.2}
              step={0.01}
              value={fit.length}
              onChange={(e) => setFit((f) => ({ ...f, length: Number(e.target.value) }))}
              className="w-full"
            />
          </div>

          {/* Sleeve */}
          {hasSleeve && (
            <div>
              <div className="mb-1 flex justify-between text-xs uppercase tracking-wider text-warmgrey">
                <span>Sleeve</span>
                <span>{Math.round(fit.sleeve * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1.3}
                step={0.01}
                value={fit.sleeve}
                onChange={(e) => setFit((f) => ({ ...f, sleeve: Number(e.target.value) }))}
                className="w-full"
              />
            </div>
          )}

          {/* Save */}
          <div className="space-y-2 rounded-lg border border-ink/10 bg-white p-3">
            <label className="block text-xs font-medium uppercase tracking-wider text-warmgrey">
              Save this look
            </label>
            <input
              className="input w-full"
              placeholder={`${garment.name} — ${fit.size}`}
              value={lookName}
              onChange={(e) => setLookName(e.target.value)}
            />
            <select className="input w-full" value={styleId} onChange={(e) => setStyleId(e.target.value)}>
              <option value="">Link to a style (optional)…</option>
              {(styles.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <button type="button" className="btn btn-primary w-full" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save look"}
            </button>
          </div>
        </div>
      </div>

      {/* Model renders (AI Look Studio gallery) */}
      {(renders.data ?? []).length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 font-display text-lg font-light">Model renders</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {(renders.data ?? []).map((r) => (
              <div key={r.id} className="group relative overflow-hidden rounded-lg border border-ink/10 bg-white">
                <button
                  type="button"
                  onClick={() => {
                    setActiveRender(r);
                    setView("model");
                  }}
                  className="block w-full"
                  title="View this render"
                >
                  <img src={r.url} alt="Model render" className="aspect-[3/4] w-full object-cover" />
                </button>
                {(r.kind === "tryon" || r.kind === "refit") && (
                  <span className="absolute left-1.5 top-1.5 rounded-full bg-navy/85 px-1.5 py-0.5 text-[10px] text-chalk">
                    {r.kind === "tryon" ? "Try-on" : "Refit"}
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

      {/* Saved looks */}
      <div className="mt-8">
        <h2 className="mb-3 font-display text-lg font-light">Saved looks</h2>
        {(looks.data ?? []).length === 0 ? (
          <EmptyState title="No saved looks yet" hint="Dial in a garment and save it to build a proportion library." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(looks.data ?? []).map((l) => {
              const g = GARMENT_LIBRARY.find((x) => x.id === l.garmentId);
              const f = FABRIC_LIBRARY.find((x) => x.id === l.fabricId);
              return (
                <div key={l.id} className="rounded-lg border border-ink/10 bg-white p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="mt-0.5 inline-block h-4 w-4 shrink-0 rounded-full border border-ink/15"
                        style={{ background: l.color ?? "#ccc" }}
                      />
                      <div>
                        <p className="text-sm font-medium">{l.name}</p>
                        <p className="text-xs text-warmgrey">
                          {g?.name ?? l.garmentId} · {f?.name ?? l.fabricId}
                          {l.styleName ? ` · ${l.styleName}` : ""}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button type="button" className="btn btn-secondary flex-1 text-xs" onClick={() => loadLook(l)}>
                      Load
                    </button>
                    <button type="button" className="btn btn-danger text-xs" onClick={() => removeLook(l.id)}>
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
        <strong>Design Studio</strong> is where you dream garments up; the <strong>Fitting Studio</strong> is where
        you dial them in. <strong>Try-on</strong> takes a real garment — a Design Studio creation or a photo of a
        sample — and puts it on your <strong>consistent model roster</strong>, so you can judge fit on the same
        bodies across every style. The 3D mannequin study and the sewing-pattern drafter are taking a back seat for
        now while we keep honing them.
      </p>
    </div>
  );
}
