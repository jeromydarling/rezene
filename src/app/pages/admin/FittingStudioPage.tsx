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
  const [view, setView] = useState<"3d" | "pattern">("3d");
  const [measurements, setMeasurements] = useState<BodyMeasurements>({});
  const [designPrompt, setDesignPrompt] = useState("");
  const [designing, setDesigning] = useState(false);

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
        eyebrow="Design & Development"
        title="3D Fitting Room"
        description="Preview a base garment in 3D, dial in the fit, and drape it in a fabric. A fast, stylized proportion study — the physics-accurate drape lands in a later release."
        actions={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setShowBody((b) => !b)}>
              {showBody ? "Hide body" : "Show body"}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setSpin((s) => !s)}>
              {spin ? "Stop spin" : "Auto-spin"}
            </button>
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* Viewer */}
        <div className="overflow-hidden rounded-lg border border-ink/10 bg-[#f4f2ee]">
          <div className="flex items-center justify-between border-b border-ink/10 bg-white/60 px-3 py-2">
            <div className="flex overflow-hidden rounded-md border border-ink/15">
              {(["3d", "pattern"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={`px-3 py-1.5 text-xs uppercase tracking-wider ${
                    view === v ? "bg-navy text-chalk" : "bg-white text-ink/60 hover:text-ink"
                  }`}
                >
                  {v === "3d" ? "3D preview" : "Pattern"}
                </button>
              ))}
            </div>
            {view === "pattern" && pattern && (
              <button type="button" className="btn btn-secondary text-xs" onClick={downloadPattern}>
                Download SVG
              </button>
            )}
          </div>

          {view === "3d" ? (
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
              {view === "3d"
                ? `${garment.name} · ${fabric?.name ?? "—"} · size ${fit.size}`
                : (pattern?.label ?? patternLabel(garmentId) ?? garment.name) + ` · size ${fit.size}`}
            </span>
            <span>{view === "3d" ? "Drag to orbit · scroll to zoom" : "Real, manufacturable pattern"}</span>
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
              The LLM maps your words to a garment, fit, and fabric — updating both the 3D preview and the real
              pattern. You can fine-tune everything below.
            </p>
          </div>

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
              Leave blank to grade from the standard size. Drives the Pattern view.
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
        <strong>Two views, both real work:</strong> the <strong>3D preview</strong> is a stylized proportion and
        fabric study — great for exploring silhouette, ease, and fabric feel early (not a physics-accurate drape).
        The <strong>Pattern</strong> view drafts a genuine, manufacturable 2D sewing pattern for your size or
        measurements (powered by FreeSewing) that you can download as SVG and hand to a factory or drop into a
        tech pack. <strong>Describe your garment</strong> and the LLM sets the garment, fit, and fabric for both
        views — you refine from there. For
        full physics draping and made-to-measure fit, bring a CLO&nbsp;3D / Browzwear / Style3D file into the 3D
        Simulation bridge.
      </p>
    </div>
  );
}
