/**
 * Capture real Knowledge Base screenshots by driving the live app with a
 * headless browser, saving them to public/kb/shots/<name>.png (referenced by
 * each chapter's `screenshot` field). Re-run whenever the UI changes.
 *
 * Requires playwright-core (npm i -D playwright-core) and the pre-installed
 * Chromium. Usage (no env needed — defaults to the public demo shop's
 * well-known read-only login):
 *   node scripts/capture-kb-screenshots.mjs
 *   # or capture from a real shop:
 *   KB_EMAIL=you@example.com KB_PASSWORD=... KB_BASE=https://verto.style node scripts/capture-kb-screenshots.mjs
 */
import { chromium } from "playwright-core";
import { mkdirSync, readdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";

// Perceptual-diff gate (optional deps): a freshly captured page almost never
// byte-matches the committed PNG — dates, counters, and cache-warm images all
// shift pixels — so a naive overwrite would churn a commit on every run. Only
// replace a shot when a meaningful fraction of pixels changed. When the deps
// aren't installed (bare local runs) the gate degrades to always-write.
// KB_FORCE=1 bypasses the gate for a deliberate full refresh.
let PNG = null;
let pixelmatch = null;
try {
  ({ PNG } = await import("pngjs"));
  pixelmatch = (await import("pixelmatch")).default;
} catch {
  console.warn("pixelmatch/pngjs not installed — staleness gate off, always writing.");
}
const FORCE = process.env.KB_FORCE === "1";
const CHANGE_GATE = 0.003; // fraction of pixels that must differ to count as a real change
// Calibrated against real captures: date/counter noise measures ~0.01-0.1%,
// while two entirely different admin pages differ by only ~3.4% (the shared
// sidebar and background dominate the frame) — so 0.3% sits well above the
// noise floor yet catches a single redesigned card.

function writeIfChanged(outPath, buf) {
  if (FORCE || !PNG || !pixelmatch || !existsSync(outPath)) {
    writeFileSync(outPath, buf);
    return "captured";
  }
  const prev = PNG.sync.read(readFileSync(outPath));
  const next = PNG.sync.read(buf);
  if (prev.width !== next.width || prev.height !== next.height) {
    writeFileSync(outPath, buf);
    return "resized";
  }
  const differing = pixelmatch(prev.data, next.data, null, next.width, next.height, { threshold: 0.15 });
  const frac = differing / (next.width * next.height);
  if (frac >= CHANGE_GATE) {
    writeFileSync(outPath, buf);
    return `refreshed (${(frac * 100).toFixed(1)}% changed)`;
  }
  return `unchanged (${(frac * 100).toFixed(2)}% pixel noise)`;
}
import { join } from "node:path";

// No env needed: the default target is the public demo shop, whose viewer
// login is deliberately well-known (read-only role — see
// DEMO_VIEWER_PASSWORD in src/worker/services/shops.ts). Point KB_EMAIL /
// KB_PASSWORD / KB_BASE elsewhere to capture from a real shop instead.
const EMAIL = process.env.KB_EMAIL || "demo-viewer@verto.style";
const PASSWORD = process.env.KB_PASSWORD || "maison-demo";
const BASE = process.env.KB_BASE || (process.env.KB_EMAIL ? "https://verto.style" : "https://verto.style/maison");
if (!EMAIL || !PASSWORD) {
  console.error("Set KB_EMAIL and KB_PASSWORD env vars.");
  process.exit(1);
}

// Locate the pre-installed Chromium.
function findChromium() {
  const root = "/opt/pw-browsers";
  if (!existsSync(root)) return undefined;
  const dir = readdirSync(root).find((d) => d.startsWith("chromium-"));
  return dir ? join(root, dir, "chrome-linux", "chrome") : undefined;
}

// name → admin route. name matches the article `screenshot` filename.
const SHOTS = [
  ["dashboard", "/admin"],
  ["launch", "/admin/launch"],
  ["fitting", "/admin/fitting"],
  ["products", "/admin/products"],
  ["skus", "/admin/skus"],
  ["inventory", "/admin/inventory"],
  ["collections", "/admin/collections"],
  ["import", "/admin/import"],
  ["styles", "/admin/styles"],
  ["tech-packs", "/admin/tech-packs"],
  ["design-studio", "/admin/ai-concepts"],
  ["sourcing", "/admin/sourcing"],
  ["suppliers", "/admin/suppliers"],
  ["materials", "/admin/materials"],
  ["samples", "/admin/samples"],
  ["purchase-orders", "/admin/purchase-orders"],
  ["production", "/admin/production"],
  ["costing", "/admin/costing"],
  ["duties", "/admin/duties"],
  ["analytics", "/admin/analytics"],
  ["marketing", "/admin/marketing"],
  ["video", "/admin/marketing/video"],
  ["seo", "/admin/content/search"],
  ["orders", "/admin/orders"],
  ["team", "/admin/team"],
  ["domain", "/admin/domain"],
  ["pattern-studio", "/admin/patterns"],
  ["commissions", "/admin/commissions"],
  ["client-book", "/admin/clients"],
  ["research", "/admin/research"],
  ["automations", "/admin/automations"],
  ["files", "/admin/files"],
];

const OUT = "public/kb/shots";
mkdirSync(OUT, { recursive: true });

// This environment proxies outbound HTTPS; route the browser through it.
// On a CI runner there's no proxy and no pre-installed Chromium — fall back to
// the browser `npx playwright install chromium` puts on the default registry
// path by leaving executablePath undefined.
const proxyServer = process.env.HTTPS_PROXY || process.env.https_proxy;
const executablePath = findChromium();
const browser = await chromium.launch({
  ...(executablePath ? { executablePath } : {}),
  headless: true,
  ...(proxyServer ? { proxy: { server: proxyServer } } : {}),
  args: [
    "--ignore-certificate-errors",
    "--disable-features=NetworkService,ChromeWhatsNewUI",
    "--no-sandbox",
    // Chromium's own connectivity probes (clients2.google.com) are rejected by
    // the agent proxy; stop them so they don't reset the session.
    "--disable-background-networking",
    "--check-for-update-interval=31536000",
    // Headless runners have no GPU — render WebGL (the 3D Fitting Room) via
    // SwiftShader software rasterization so <canvas> pages aren't blank.
    "--enable-unsafe-swiftshader",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--ignore-gpu-blocklist",
  ],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  ignoreHTTPSErrors: true,
});
const page = await context.newPage();

// Sign in. The demo shop's login defaults to the email gate — flip to the
// credentials form first when that toggle is present.
await page.goto(`${BASE}/admin/login`, { waitUntil: "domcontentloaded" });
const credsToggle = page.getByRole("button", { name: /have credentials/i });
if (await credsToggle.isVisible().catch(() => false)) {
  await credsToggle.click();
}
await page.fill('input[type="email"]', EMAIL);
await page.fill('input[type="password"]', PASSWORD);
await Promise.all([
  page.waitForURL(/\/admin(\/|$)/, { timeout: 20000 }).catch(() => {}),
  page.locator('button[type="submit"]').first().click(),
]);
await page.waitForTimeout(2500);

let ok = 0;
for (const [name, route] of SHOTS) {
  try {
    await page.goto(`${BASE}${route}`, { waitUntil: "networkidle", timeout: 25000 });
    await page.waitForTimeout(1800); // let data + images settle
    // WebGL pages (the 3D Fitting Room) paint on a <canvas>, not via network —
    // wait for the canvas and give SwiftShader extra time to render a frame.
    const canvas = await page.$("canvas");
    if (canvas) await page.waitForTimeout(2500);
    const buf = await page.screenshot(); // viewport-clipped hero
    const verdict = writeIfChanged(join(OUT, `${name}.png`), buf);
    console.log(`✓ ${name} — ${verdict}`);
    ok++;
  } catch (err) {
    console.warn(`✗ ${name}: ${String(err).slice(0, 120)}`);
  }
}

await browser.close();
console.log(`\nCaptured ${ok}/${SHOTS.length} → ${OUT}`);
