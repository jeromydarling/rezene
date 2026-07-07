/**
 * Capture real Knowledge Base screenshots by driving the live app with a
 * headless browser, saving them to public/kb/shots/<name>.png (referenced by
 * each chapter's `screenshot` field). Re-run whenever the UI changes.
 *
 * Requires playwright-core (npm i -D playwright-core) and the pre-installed
 * Chromium. Usage:
 *   KB_EMAIL=you@example.com KB_PASSWORD=... node scripts/capture-kb-screenshots.mjs
 *   # optional: KB_BASE=https://verto.style (default)
 */
import { chromium } from "playwright-core";
import { mkdirSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.KB_BASE || "https://verto.style";
const EMAIL = process.env.KB_EMAIL;
const PASSWORD = process.env.KB_PASSWORD;
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

// Sign in.
await page.goto(`${BASE}/admin/login`, { waitUntil: "domcontentloaded" });
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
    await page.screenshot({ path: join(OUT, `${name}.png`) }); // viewport-clipped hero
    console.log(`✓ ${name}`);
    ok++;
  } catch (err) {
    console.warn(`✗ ${name}: ${String(err).slice(0, 120)}`);
  }
}

await browser.close();
console.log(`\nCaptured ${ok}/${SHOTS.length} → ${OUT}`);
