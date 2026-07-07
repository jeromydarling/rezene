/**
 * End-to-end smoke test for the Look Studio (Fitting Room → "On a model"),
 * driven against the LIVE site with headless Chromium. Verifies the real flow:
 * login → open the Fitting Room → read capabilities → run a Generate render and
 * confirm an image comes back → (if try-on is configured) run a real virtual
 * try-on with a garment photo pulled from the storefront.
 *
 * Meant for CI (.github/workflows/e2e-look-studio.yml) where a plain runner has
 * open network + a Playwright-installed Chromium, but also runs locally.
 *
 *   LS_EMAIL=you@example.com LS_PASSWORD=... node scripts/e2e-look-studio.mjs
 *   # optional: LS_BASE=https://verto.style (default)
 *
 * Exit 0 = the Generate flow produced an image. Try-on is attempted only when
 * the platform reports it as available; otherwise it's reported as skipped.
 */
import { chromium } from "playwright-core";
import { mkdirSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.LS_BASE || "https://verto.style";
const EMAIL = process.env.LS_EMAIL;
const PASSWORD = process.env.LS_PASSWORD;
if (!EMAIL || !PASSWORD) {
  console.error("Set LS_EMAIL and LS_PASSWORD env vars.");
  process.exit(1);
}
const OUT = "artifacts/look-studio";
mkdirSync(OUT, { recursive: true });

function findChromium() {
  const root = "/opt/pw-browsers";
  if (!existsSync(root)) return undefined;
  const dir = readdirSync(root).find((d) => d.startsWith("chromium-"));
  return dir ? join(root, dir, "chrome-linux", "chrome") : undefined;
}

const proxyServer = process.env.HTTPS_PROXY || process.env.https_proxy;
const executablePath = findChromium();
const browser = await chromium.launch({
  ...(executablePath ? { executablePath } : {}),
  headless: true,
  ...(proxyServer ? { proxy: { server: proxyServer } } : {}),
  args: ["--no-sandbox", "--ignore-certificate-errors", "--disable-background-networking"],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, ignoreHTTPSErrors: true });
const page = await context.newPage();

let failed = false;
const step = (msg) => console.log(`• ${msg}`);

try {
  // --- Sign in --------------------------------------------------------------
  step(`login → ${BASE}`);
  await page.goto(`${BASE}/admin/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await Promise.all([
    page.waitForURL(/\/admin(\/|$)/, { timeout: 25000 }).catch(() => {}),
    page.locator('button[type="submit"]').first().click(),
  ]);
  await page.waitForTimeout(2000);
  if (/\/admin\/login/.test(page.url())) throw new Error("login failed (still on /admin/login)");

  // --- Open the Fitting Room ------------------------------------------------
  step("open /admin/fitting");
  await page.goto(`${BASE}/admin/fitting`, { waitUntil: "networkidle", timeout: 30000 });
  await page.getByRole("button", { name: "On a model" }).first().click().catch(() => {});
  await page.waitForTimeout(800);

  // --- Capabilities ---------------------------------------------------------
  const caps = await page.evaluate(async () => {
    const r = await fetch("/api/admin/fitting/capabilities", { credentials: "include" });
    return r.ok ? r.json() : null;
  });
  step(`capabilities: ${JSON.stringify(caps)}`);
  const tryOnAvailable = Boolean(caps?.tryOn?.available);

  const rendersCount = async () =>
    page.evaluate(async () => {
      const r = await fetch("/api/admin/fitting/renders", { credentials: "include" });
      const j = r.ok ? await r.json() : [];
      return Array.isArray(j) ? j.length : 0;
    });

  // --- Generate flow (works on the free FLUX fallback regardless of keys) ----
  step("generate a look on a model");
  const before = await rendersCount();
  await page.getByRole("button", { name: "Generate", exact: true }).first().click().catch(() => {});
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: /Generate on a model/i }).first().click();

  // Wait for the rendered image (or a new render row) — FLUX can take a while.
  let genOk = false;
  for (let i = 0; i < 90; i++) {
    await page.waitForTimeout(2000);
    if ((await rendersCount()) > before) {
      genOk = true;
      break;
    }
    if (await page.locator('img[alt="Garment rendered on a model"]').count()) {
      genOk = true;
      break;
    }
  }
  await page.screenshot({ path: join(OUT, "generate.png"), fullPage: false });
  if (genOk) step("✓ generate produced an image");
  else {
    failed = true;
    console.error("✗ generate did not produce an image within the timeout");
  }

  // --- Try-on flow (only when a try-on provider is configured) --------------
  if (tryOnAvailable) {
    step("try-on: switch mode, upload garment, pick model, run");
    await page.getByRole("button", { name: /Try on my garment/i }).first().click();
    await page.waitForTimeout(500);

    // Use a storefront product image as the garment photo.
    const garment = await fetchImageBuffer(`${BASE}/`, page);
    if (garment) {
      const input = page.locator('input[type="file"]').first();
      await input.setInputFiles({ name: "garment.jpg", mimeType: "image/jpeg", buffer: garment });
      await page.waitForTimeout(2500);
      // Generate a base model to try onto.
      await page.getByRole("button", { name: /Generate a .* model/i }).first().click().catch(() => {});
      for (let i = 0; i < 60 && !(await page.locator('button img[alt]').count()); i++) await page.waitForTimeout(2000);
      await page.locator("button img").first().click().catch(() => {});
      const beforeT = await rendersCount();
      await page.getByRole("button", { name: /^Try it on$/i }).first().click().catch(() => {});
      let tryOk = false;
      for (let i = 0; i < 60; i++) {
        await page.waitForTimeout(2000);
        if ((await rendersCount()) > beforeT) {
          tryOk = true;
          break;
        }
      }
      await page.screenshot({ path: join(OUT, "tryon.png"), fullPage: false });
      step(tryOk ? "✓ try-on produced an image" : "✗ try-on did not complete (non-fatal)");
    } else {
      step("try-on skipped — couldn't source a garment image");
    }
  } else {
    step("try-on not configured (no FAL_KEY/FASHN key) — skipped, as expected");
  }

  await page.screenshot({ path: join(OUT, "look-studio.png"), fullPage: true });
} catch (err) {
  failed = true;
  console.error("E2E error:", String(err).slice(0, 400));
  await page.screenshot({ path: join(OUT, "error.png"), fullPage: true }).catch(() => {});
} finally {
  await browser.close();
}

console.log(failed ? "\nLook Studio E2E: FAILED" : "\nLook Studio E2E: PASSED");
process.exit(failed ? 1 : 0);

/** Grab the first sizeable <img> from a page to use as a garment fixture. */
async function fetchImageBuffer(url, page) {
  try {
    const p = await page.context().newPage();
    await p.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    const src = await p.evaluate(() => {
      const imgs = [...document.images].filter((i) => i.naturalWidth > 200 && /\.(jpg|jpeg|png|webp)/i.test(i.src));
      return imgs[0]?.src || document.images[0]?.src || null;
    });
    let buf = null;
    if (src) {
      const resp = await p.request.get(src);
      if (resp.ok()) buf = Buffer.from(await resp.body());
    }
    await p.close();
    return buf;
  } catch {
    return null;
  }
}
