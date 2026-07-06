/**
 * Promo-video render worker — runs in GitHub Actions, not the Worker.
 *
 * It pulls the exact composition the customer approved in their browser,
 * seeks window.__render(t) frame-by-frame with Playwright, encodes h264 with
 * ffmpeg, lays ElevenLabs music under it, reframes to any requested aspect
 * ratios, and posts every finished MP4 back to the Worker. Progress is
 * reported scene-by-scene so the studio's wait screen stays honest.
 *
 * Inputs (env):
 *   JOB_SHOP_ID, JOB_ID, CALLBACK_BASE  — from the repository_dispatch payload
 *   RENDER_CALLBACK_SECRET              — shared secret for the callbacks
 *   ELEVENLABS_API_KEY                  — optional; silent track if absent
 *   FORMATS                             — JSON array, e.g. ["16:9","9:16"]
 */
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { readFileSync, mkdirSync, rmSync, existsSync } from "node:fs";

const FPS = 24;
const SHOP_ID = process.env.JOB_SHOP_ID;
const JOB_ID = process.env.JOB_ID;
const CALLBACK_BASE = (process.env.CALLBACK_BASE || "").replace(/\/$/, "");
const SECRET = process.env.RENDER_CALLBACK_SECRET || "";
const ELEVEN_KEY = process.env.ELEVENLABS_API_KEY || "";
const FORMATS = safeJson(process.env.FORMATS, ["16:9"]);

const SCENE_FRACS = [0, 0.16, 0.3, 0.74, 0.88, 1];
const SCENE_LABELS = ["Opening", "Collection title", "The pieces", "Brand story", "Closing"];
const DIMS = { "16:9": [1920, 1080], "9:16": [1080, 1920], "1:1": [1080, 1080] };

function safeJson(s, fallback) {
  try {
    return JSON.parse(s);
  } catch {
    return fallback;
  }
}
const base = () => `${CALLBACK_BASE}/${SHOP_ID}/${JOB_ID}`;
const headers = { "x-render-secret": SECRET, "content-type": "application/json" };

async function progress(pct, label) {
  try {
    await fetch(`${base()}/progress`, {
      method: "POST",
      headers,
      body: JSON.stringify({ progress: Math.round(pct), label, status: "rendering" }),
    });
  } catch (e) {
    console.warn("progress post failed", String(e));
  }
}

async function main() {
  if (!SHOP_ID || !JOB_ID || !CALLBACK_BASE || !SECRET) {
    throw new Error("missing JOB_SHOP_ID / JOB_ID / CALLBACK_BASE / RENDER_CALLBACK_SECRET");
  }
  // 1. Pull job spec + composition.
  const metaRes = await fetch(`${base()}?secret=${encodeURIComponent(SECRET)}`);
  if (!metaRes.ok) throw new Error(`meta fetch ${metaRes.status}`);
  const meta = await metaRes.json();
  const DUR = Number(meta.durationSec) || 30;
  const N = Math.round(FPS * DUR);
  const htmlRes = await fetch(`${base()}/composition?secret=${encodeURIComponent(SECRET)}`);
  if (!htmlRes.ok) throw new Error(`composition fetch ${htmlRes.status}`);
  const html = await htmlRes.text();

  await progress(2, "Warming up the render");

  // 2. Capture the 16:9 master frame-by-frame.
  rmSync("frames", { recursive: true, force: true });
  mkdirSync("frames", { recursive: true });
  const browser = await chromium.launch({ args: ["--no-sandbox", "--force-color-profile=srgb"] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  for (let i = 0; i < N; i++) {
    const t = i / FPS;
    await page.evaluate((tt) => window.__render(tt), t);
    await page.screenshot({ path: `frames/f${String(i).padStart(5, "0")}.png` });
    if (i % 12 === 0) {
      const frac = i / N;
      let sceneIdx = 0;
      for (let s = 0; s < SCENE_LABELS.length; s++) {
        if (frac >= SCENE_FRACS[s] && frac < SCENE_FRACS[s + 1]) sceneIdx = s;
      }
      const label = SCENE_LABELS[sceneIdx] || "Rendering";
      // Capture is ~65% of the total work; music + encode is the rest.
      await progress(5 + frac * 65, `Filming — ${label}`);
    }
  }
  await browser.close();

  // 3. Encode the silent master.
  await progress(72, "Cutting the master");
  ff([
    "-y", "-framerate", String(FPS), "-i", "frames/f%05d.png",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "19", "-preset", "medium",
    "master.mp4",
  ]);

  // 4. Compose music (best-effort — silent track if the key/API is unavailable).
  await progress(80, "Scoring the music");
  const hasMusic = await composeMusic(meta.musicPrompt, DUR);

  // 5. Poster still (handed to the studio immediately).
  ff(["-y", "-ss", "1.4", "-i", "master.mp4", "-frames:v", "1", "-q:v", "3", "poster.jpg"]);

  // 6. Per-format encode + upload.
  let posterSent = false;
  for (let idx = 0; idx < FORMATS.length; idx++) {
    const fmt = FORMATS[idx];
    await progress(84 + (idx / FORMATS.length) * 14, `Exporting ${fmt}`);
    const out = `out_${fmt.replace(":", "x")}.mp4`;
    encodeFormat(fmt, out, hasMusic, DUR);
    await upload(fmt, out, !posterSent);
    posterSent = true;
  }

  await progress(100, "Ready");
  await fetch(`${base()}/finalize`, { method: "POST", headers, body: JSON.stringify({ ok: true }) });
  console.log("RENDER COMPLETE", JOB_ID, FORMATS.join(","));
}

function ff(args) {
  execFileSync("ffmpeg", args, { stdio: ["ignore", "inherit", "inherit"] });
}

function encodeFormat(fmt, out, hasMusic, DUR) {
  const [W, H] = DIMS[fmt] || DIMS["16:9"];
  const audio = hasMusic ? ["-i", "music.mp3"] : [];
  const afade = `afade=t=out:st=${Math.max(0, DUR - 1.5)}:d=1.5`;
  if (fmt === "16:9") {
    ff([
      "-y", "-i", "master.mp4", ...audio,
      ...(hasMusic ? ["-filter:a", afade, "-c:a", "aac", "-b:a", "192k", "-shortest"] : ["-an"]),
      "-c:v", "copy", out,
    ]);
    return;
  }
  // Reframe: blurred fill behind the letterboxed 16:9 content — nothing is cropped away.
  const vf = `[0:v]split[a][b];[a]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},boxblur=24:2[bg];[b]scale=${W}:-2[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,format=yuv420p[v]`;
  ff([
    "-y", "-i", "master.mp4", ...audio,
    "-filter_complex", vf, "-map", "[v]",
    ...(hasMusic ? ["-map", "1:a", "-filter:a", afade, "-c:a", "aac", "-b:a", "192k", "-shortest"] : ["-an"]),
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "19", "-preset", "medium", out,
  ]);
}

async function composeMusic(prompt, DUR) {
  if (!ELEVEN_KEY || !prompt) return false;
  try {
    const res = await fetch("https://api.elevenlabs.io/v1/music/compose", {
      method: "POST",
      headers: { "xi-api-key": ELEVEN_KEY, "content-type": "application/json" },
      body: JSON.stringify({ prompt, music_length_ms: Math.min(300000, Math.max(10000, Math.round(DUR * 1000))) }),
    });
    if (!res.ok) {
      console.warn("music compose failed", res.status, (await res.text()).slice(0, 200));
      return false;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const { writeFileSync } = await import("node:fs");
    writeFileSync("music.mp3", buf);
    return true;
  } catch (e) {
    console.warn("music error", String(e));
    return false;
  }
}

async function upload(fmt, file, withPoster) {
  const form = new FormData();
  form.set("secret", SECRET);
  form.set("format", fmt);
  form.set("video", new Blob([readFileSync(file)], { type: "video/mp4" }), `${JOB_ID}.mp4`);
  if (withPoster && existsSync("poster.jpg")) {
    form.set("poster", new Blob([readFileSync("poster.jpg")], { type: "image/jpeg" }), "poster.jpg");
  }
  const res = await fetch(`${base()}/complete`, { method: "POST", body: form });
  if (!res.ok) throw new Error(`upload ${fmt} failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
}

main().catch(async (err) => {
  console.error("RENDER FAILED", err);
  try {
    await fetch(`${base()}/finalize`, {
      method: "POST",
      headers,
      body: JSON.stringify({ ok: false, error: String(err && err.message ? err.message : err).slice(0, 400) }),
    });
  } catch {
    /* best effort */
  }
  process.exit(1);
});
