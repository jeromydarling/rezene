/**
 * Offline preview of the 3D Fitting Room geometry — renders every garment on
 * the mannequin to a PNG using local headless Chromium, with NO network (the
 * scene is bundled and injected inline). This lets us iterate on the shared
 * garment geometry (src/app/lib/garmentGeometry.ts) and see the result without
 * a deploy, a login, or CI.
 *
 * Usage:
 *   node scripts/preview-fitting.mjs [out.png] [nobody]
 *     out.png  — output path (default ./fitting-preview.png)
 *     nobody   — render garments without the mannequin
 *
 * Needs playwright-core + the pre-installed/installed Chromium; uses esbuild
 * (a dev dependency of the toolchain) to bundle scripts/preview-fitting.scene.mjs.
 */
import { build } from "esbuild";
import { chromium } from "playwright-core";
import { readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const out = process.argv[2] || "fitting-preview.png";
const withBody = process.argv[3] !== "nobody";

// Bundle the browser scene (resolves three + the shared TS geometry).
const result = await build({
  entryPoints: [join(here, "preview-fitting.scene.mjs")],
  bundle: true,
  format: "iife",
  write: false,
  logLevel: "error",
});
const bundle = result.outputFiles[0].text;

// Find a Chromium binary: the sandbox pre-installs one; CI/laptops get it from
// `npx playwright install chromium` on the default registry path.
function findChromium() {
  const root = "/opt/pw-browsers";
  if (!existsSync(root)) return undefined;
  const d = readdirSync(root).find((x) => x.startsWith("chromium-"));
  return d ? join(root, d, "chrome-linux", "chrome") : undefined;
}
const executablePath = findChromium();

const browser = await chromium.launch({
  ...(executablePath ? { executablePath } : {}),
  headless: true,
  // Headless runners have no GPU — render WebGL via SwiftShader.
  args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1120, height: 980 } });
page.on("pageerror", (e) => console.error("PAGEERR:", String(e).slice(0, 300)));
await page.setContent("<!doctype html><html><body></body></html>", { waitUntil: "load" });
await page.addScriptTag({ content: bundle });
await page.evaluate((wb) => window.__buildAndRender(wb), withBody);
await page.waitForTimeout(1200);
const title = await page.title();
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log(`Rendered ${out} (${title})`);
