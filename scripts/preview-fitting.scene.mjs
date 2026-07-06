// Browser entry for the offline Fitting Room preview. Imports the SAME shared
// geometry the app uses, so the render is faithful. Bundled + driven by
// scripts/preview-fitting.mjs (headless Chromium, no network). See that file.
import * as THREE from "three";
import { GARMENT_LIBRARY, DEFAULT_FIT } from "../src/shared/garments";
import { FABRIC_LIBRARY } from "../src/shared/fabrics";
import { buildGarment, buildMannequin, fabricAppearance } from "../src/app/lib/garmentGeometry";

function renderGarment(canvas, garment, withBody) {
  const fabric = FABRIC_LIBRARY.find((f) => f.id === garment.defaultFabric);
  const app = fabricAppearance(fabric);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(2);
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#f4f2ee");
  scene.add(new THREE.AmbientLight(0xffffff, 0.65));
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb8b0a4, 0.5));
  const d1 = new THREE.DirectionalLight(0xffffff, 1.2); d1.position.set(4, 6, 5); scene.add(d1);
  const d2 = new THREE.DirectionalLight(0xffffff, 0.35); d2.position.set(-5, 2, -3); scene.add(d2);

  const root = new THREE.Group();
  if (withBody) root.add(buildMannequin());
  root.add(buildGarment(garment, DEFAULT_FIT, fabric, app.color));
  const box = new THREE.Box3().setFromObject(root);
  root.position.sub(box.getCenter(new THREE.Vector3()));
  root.rotation.y = -0.3;
  scene.add(root);

  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = 35;
  const cam = new THREE.PerspectiveCamera(fov, canvas.clientWidth / canvas.clientHeight, 0.01, 100);
  cam.position.set(0, size.y * 0.02, (maxDim / 2 / Math.tan((fov * Math.PI) / 360)) * 1.35);
  cam.lookAt(0, 0, 0);
  renderer.render(scene, cam);
}

window.__buildAndRender = (withBody) => {
  const grid = document.createElement("div");
  grid.style.cssText = "display:grid;grid-template-columns:repeat(3,360px);gap:8px;padding:8px;background:#e9e6e1;font-family:sans-serif";
  document.body.style.margin = "0";
  document.body.appendChild(grid);
  for (const g of GARMENT_LIBRARY) {
    const f = FABRIC_LIBRARY.find((x) => x.id === g.defaultFabric);
    const cell = document.createElement("div");
    cell.style.cssText = "background:#f4f2ee;border:1px solid #ddd;border-radius:8px;overflow:hidden";
    const canvas = document.createElement("canvas");
    canvas.width = 720; canvas.height = 920;
    canvas.style.cssText = "width:360px;height:460px;display:block";
    cell.appendChild(canvas);
    const label = document.createElement("div");
    label.style.cssText = "padding:6px 10px;font-size:12px;color:#555;border-top:1px solid #eee";
    label.textContent = `${g.name} · ${f ? f.name : ""}`;
    cell.appendChild(label);
    grid.appendChild(cell);
    renderGarment(canvas, g, withBody);
  }
  document.title = "RENDERED";
};
