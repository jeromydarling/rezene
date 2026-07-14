/**
 * Lookbook PDF render (runs in GitHub Actions).
 *
 * Fetches the print composition from the Worker (interior + cover parts),
 * renders each to a Letter-size PDF with Playwright/Chromium, posts both back
 * to the Worker's callback, then finalizes (which submits the Lulu print jobs
 * and captures the shop's payment). On any error it finalizes with ok:false so
 * the Worker releases the payment hold.
 */
import { chromium } from "playwright";

const SHOP_ID = process.env.JOB_SHOP_ID;
const JOB_ID = process.env.JOB_ID;
const BASE = process.env.CALLBACK_BASE; // e.g. https://verto.style/api/render/lookbook
const SECRET = process.env.RENDER_CALLBACK_SECRET;

if (!SHOP_ID || !JOB_ID || !BASE || !SECRET) {
  console.error("Missing JOB_SHOP_ID / JOB_ID / CALLBACK_BASE / RENDER_CALLBACK_SECRET");
  process.exit(1);
}

const jobBase = `${BASE}/${SHOP_ID}/${JOB_ID}`;

async function renderPart(browser, part) {
  const page = await browser.newPage();
  const url = `${jobBase}/composition?part=${part}&secret=${encodeURIComponent(SECRET)}`;
  const res = await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
  if (!res || !res.ok()) throw new Error(`composition ${part} fetch ${res ? res.status() : "no response"}`);
  // Give fonts + remote images a beat to settle.
  await page.waitForTimeout(1500);
  const pdf = await page.pdf({
    format: "Letter",
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: "0", bottom: "0", left: "0", right: "0" },
  });
  await page.close();
  return pdf;
}

async function finalize(ok, error) {
  await fetch(`${jobBase}/finalize`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-render-secret": SECRET },
    body: JSON.stringify({ ok, error: error ? String(error).slice(0, 400) : undefined }),
  }).catch((e) => console.error("finalize post failed:", e));
}

async function main() {
  const browser = await chromium.launch();
  try {
    const interior = await renderPart(browser, "interior");
    const cover = await renderPart(browser, "cover");
    console.log(`Rendered interior ${interior.length}B, cover ${cover.length}B`);

    const form = new FormData();
    form.append("secret", SECRET);
    form.append("interior", new Blob([interior], { type: "application/pdf" }), "interior.pdf");
    form.append("cover", new Blob([cover], { type: "application/pdf" }), "cover.pdf");
    const up = await fetch(`${jobBase}/complete`, { method: "POST", body: form });
    if (!up.ok) throw new Error(`complete upload ${up.status}: ${(await up.text()).slice(0, 200)}`);

    await finalize(true);
    console.log("Done.");
  } catch (err) {
    console.error("Render failed:", err);
    await finalize(false, err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();
