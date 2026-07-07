/**
 * Shared 3D geometry for the Fitting Room — used by both the live viewer page
 * and the offline render harness so what we preview matches what ships.
 *
 * This is a *stylized* build: a procedural mannequin (our own primitives, no
 * SMPL / external body model) wearing a parametric garment shell. It reads like
 * a fashion figure in a garment — not a physics drape. The real GarmentCode +
 * Warp pipeline is a later phase.
 */
import * as THREE from "three";
import type { BaseGarment, FitConfig } from "../../shared/garments";
import { SIZE_SCALE } from "../../shared/garments";
import type { FabricRef } from "../../shared/fabrics";

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// Body frame (world units, ~1.7 tall figure). Garments anchor to these.
const Y_SHOULDER = 1.4;
const Y_WAIST = 1.02;
const FLATTEN_Z = 0.62; // front-to-back squash so garments aren't round cans

export function fabricAppearance(f: FabricRef | undefined): { color: string; roughness: number } {
  if (!f) return { color: "#b8b2a6", roughness: 0.7 };
  const byId: Record<string, { color: string; roughness: number }> = {
    "silk-charmeuse": { color: "#d9ccbe", roughness: 0.22 },
    sateen: { color: "#cdbfd6", roughness: 0.35 },
    "viscose-crepe": { color: "#c2b8a8", roughness: 0.5 },
    linen: { color: "#c8bda2", roughness: 0.9 },
    "cotton-linen": { color: "#cabfa6", roughness: 0.85 },
    poplin: { color: "#e6e3dc", roughness: 0.6 },
    denim: { color: "#3b5b7a", roughness: 0.85 },
    "wool-suiting": { color: "#3a3a42", roughness: 0.7 },
    "wool-cashmere": { color: "#6b6258", roughness: 0.75 },
    "brushed-fleece": { color: "#6b7280", roughness: 0.95 },
    "french-terry": { color: "#8b8578", roughness: 0.9 },
    "cotton-jersey": { color: "#b9b3a6", roughness: 0.8 },
    "organic-cotton-jersey": { color: "#b3ac9a", roughness: 0.8 },
    "modal-jersey": { color: "#a9a29a", roughness: 0.55 },
    twill: { color: "#7a6f57", roughness: 0.8 },
    ponte: { color: "#4a4650", roughness: 0.7 },
    "rib-knit": { color: "#9a9488", roughness: 0.8 },
    "waffle-knit": { color: "#a59a86", roughness: 0.85 },
  };
  return byId[f.id] ?? { color: "#b8b2a6", roughness: f.weight === "light" ? 0.5 : f.weight === "heavy" ? 0.9 : 0.7 };
}

// ---------------------------------------------------------------------------
// Mannequin — a neutral light-grey figure from primitives. Female-ish croquis
// proportions in a relaxed A-pose (arms slightly out), like CLO's avatar.
// ---------------------------------------------------------------------------

function tube(profile: [number, number][], seg = 48): THREE.LatheGeometry {
  return new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.001), y)),
    seg,
  );
}

export function buildMannequin(): THREE.Group {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: "#d7d3cd", roughness: 0.9, metalness: 0, flatShading: false });
  const add = (geo: THREE.BufferGeometry, pos?: [number, number, number], rot?: [number, number, number]) => {
    const m = new THREE.Mesh(geo, skin);
    if (pos) m.position.set(...pos);
    if (rot) m.rotation.set(...rot);
    g.add(m);
    return m;
  };
  const SEG = 64;

  // Head + smooth neck blend
  add(new THREE.SphereGeometry(0.096, 32, 24), [0, 1.63, 0.005]).scale.set(0.82, 1.04, 0.9);
  add(tube([[0.03, 1.56], [0.045, 1.52], [0.052, 1.46], [0.07, 1.42]], SEG), [0, 0, 0]).scale.z = 0.85;

  // One continuous torso→waist→hip lathe (no seam), gentle female-croquis S-curve
  const torso = add(
    tube(
      [
        [0.055, 1.45], // neck root
        [0.15, 1.42], // shoulder (rounded)
        [0.152, 1.35], // upper chest
        [0.146, 1.24], // bust
        [0.126, 1.14], // under-bust
        [0.111, 1.05], // waist (nip)
        [0.128, 0.96], // high hip
        [0.152, 0.86], // hip
        [0.146, 0.77],
        [0.075, 0.67], // crotch
      ],
      SEG,
    ),
  );
  torso.scale.z = 0.62;

  // Legs (thigh → knee → calf → ankle), smoother taper
  const legProfile: [number, number][] = [
    [0.086, 0.7],
    [0.08, 0.58],
    [0.058, 0.42],
    [0.062, 0.36], // calf
    [0.04, 0.18],
    [0.034, 0.04],
    [0.03, 0.015],
  ];
  for (const sx of [-1, 1]) {
    add(tube(legProfile, SEG), [sx * 0.072, 0, 0]).scale.z = 0.92;
    // rounded foot pointing forward
    add(new THREE.SphereGeometry(0.05, 20, 14), [sx * 0.072, 0.028, 0.05]).scale.set(0.72, 0.5, 1.7);
  }

  // Arms (shoulder → wrist) with a soft taper, A-pose; small hand at the wrist
  const armProfile: [number, number][] = [
    [0.056, 0], [0.05, -0.16], [0.045, -0.3], [0.047, -0.34], [0.036, -0.5], [0.03, -0.62],
  ];
  const A = 0.22;
  for (const sx of [-1, 1]) {
    add(tube(armProfile, SEG), [sx * 0.15, 1.4, 0], [0, 0, sx * A]).scale.z = 0.9;
    // hand at the arm tip
    const hx = 0.15 * sx + Math.sin(A) * 0.62 * sx;
    const hy = 1.4 - Math.cos(A) * 0.62;
    add(new THREE.SphereGeometry(0.036, 16, 12), [hx, hy - 0.03, 0]).scale.set(0.7, 1.3, 0.45);
  }
  return g;
}

// ---------------------------------------------------------------------------
// Garment shell — a parametric surface worn on the body frame.
// ---------------------------------------------------------------------------

function garmentMaterial(app: { color: string; roughness: number }, color: string) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: app.roughness,
    metalness: 0,
    side: THREE.DoubleSide,
  });
}

export function buildGarment(
  garment: BaseGarment,
  fit: FitConfig,
  fabric: FabricRef | undefined,
  color: string,
): THREE.Group {
  const g = new THREE.Group();
  const app = fabricAppearance(fabric);
  const mat = garmentMaterial(app, color);
  const s = SIZE_SCALE[fit.size];
  const flare = fabric?.weight === "light" ? 0.92 : fabric?.weight === "heavy" ? 1.12 : 1.0;
  const K = 0.01;

  // Body-relative radii (world units). Sit just outside the mannequin.
  const chest = garment.silhouette.chest * fit.ease * s * K * 0.9 + 0.025;
  const hem = garment.silhouette.hem * Math.pow(fit.ease, 0.5) * s * flare * K * 0.9 + 0.02;
  const shoulder = (garment.silhouette.shoulder || garment.silhouette.chest * 0.9) * fit.ease * s * K + 0.025;
  const lenW = garment.silhouette.length * fit.length * s * K;
  const sleeveLen = garment.silhouette.sleeve * fit.sleeve * s * K;

  const addMesh = (geo: THREE.BufferGeometry, pos?: [number, number, number], rot?: [number, number, number]) => {
    const m = new THREE.Mesh(geo, mat);
    if (pos) m.position.set(...pos);
    if (rot) m.rotation.set(...rot);
    g.add(m);
    return m;
  };
  const V = (r: number, y: number) => new THREE.Vector2(Math.max(r, 0.001), y);

  if (garment.type === "pants") {
    const waistY = Y_WAIST + 0.05;
    const waist = chest;
    // Full-length legs from the waist down to the ankle, clearly separated.
    const legLen = waistY - 0.05;
    const legTop = 0.085 * fit.ease;
    const legBot = 0.1 * flare; // wide leg
    for (const sx of [-1, 1]) {
      const leg = addMesh(
        new THREE.CylinderGeometry(legTop, legBot, legLen, 22, 1, true),
        [sx * 0.085, waistY - legLen / 2, 0],
      );
      leg.scale.z = 0.9;
    }
    // Hip / waistband over the pelvis — snug, not a slab.
    void waist;
    const hip = addMesh(
      new THREE.LatheGeometry([V(0.135, waistY + 0.03), V(0.155, waistY - 0.05), V(0.13, waistY - 0.14)], 32),
    );
    hip.scale.z = 0.72;
    return g;
  }

  if (garment.type === "skirt") {
    const waistY = Y_WAIST;
    const body = addMesh(
      new THREE.LatheGeometry(
        [V(chest * 0.98, waistY), V(chest * 1.02, waistY - lenW * 0.28), V(lerp(chest, hem, 0.55), waistY - lenW * 0.66), V(hem, waistY - lenW)],
        64,
      ),
    );
    body.scale.z = 0.7;
    return g;
  }

  // Tops & dresses — shoulder-anchored shell with a sloped yoke.
  const topY = Y_SHOULDER + 0.04;
  const hemY = topY - lenW;
  const neck = chest * 0.5;
  const waist = chest * (garment.type === "dress" ? 0.9 : 0.97);
  const isDress = garment.type === "dress";
  const profile = [
    V(neck, topY), // collar
    V(shoulder, topY - 0.05), // shoulder
    V(chest * 0.92, topY - 0.18), // chest/armscye (kept in so no shoulder "wings")
    V(waist, topY - lenW * 0.42), // waist
    V(lerp(waist, hem, isDress ? 0.45 : 0.5), topY - lenW * 0.72),
    V(hem, hemY), // hem
  ];
  const shell = addMesh(new THREE.LatheGeometry(profile, 64));
  shell.scale.z = FLATTEN_Z;

  // Finished neckline — a slim collar ring so the top isn't an open hole.
  const collar = addMesh(
    new THREE.TorusGeometry(neck, isDress ? 0.008 : 0.014, 10, 28),
    [0, topY, 0],
    [Math.PI / 2, 0, 0],
  );
  collar.scale.z = FLATTEN_Z;

  // Sleeveless pieces get thin shoulder straps so they sit on the body.
  if (sleeveLen <= 0.02) {
    for (const sx of [-1, 1]) {
      addMesh(
        new THREE.CylinderGeometry(0.014, 0.014, 0.11, 10),
        [sx * neck * 0.72, topY - 0.02, 0],
        [0, 0, sx * 0.16],
      );
    }
  }

  // Sleeves — hang from the shoulder down the arm (body is in a natural stance).
  if (sleeveLen > 0.02 && garment.silhouette.shoulder > 0) {
    const angle = 0.18; // radians out from vertical (arms hang close to the body)
    const ax = Math.sin(angle);
    const ay = -Math.cos(angle);
    for (const sx of [-1, 1]) {
      const attachX = shoulder * 0.9 * sx;
      const attachY = topY - 0.06;
      const cx = attachX + ax * sx * (sleeveLen / 2);
      const cy = attachY + ay * (sleeveLen / 2);
      const sleeve = addMesh(
        new THREE.CylinderGeometry(chest * 0.3, chest * 0.22, sleeveLen, 18, 1, true),
        [cx, cy, 0],
        [0, 0, sx * angle],
      );
      sleeve.scale.z = 0.82;
    }
  }

  // Hood for hoodies — a small rolled hood sitting behind the neck.
  if (garment.id === "relaxed-hoodie") {
    const hood = addMesh(
      new THREE.SphereGeometry(neck * 1.15, 20, 16),
      [0, topY + 0.05, -neck * 0.45],
    );
    hood.scale.set(1.0, 0.85, 0.7);
  }
  return g;
}

/** Recursively dispose a group's geometries + materials (for viewer teardown). */
export function disposeGroup(obj: THREE.Object3D) {
  obj.traverse((child) => {
    const m = child as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    if (m.material) {
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      mats.forEach((mat) => mat.dispose());
    }
  });
}
