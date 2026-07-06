/**
 * Promo-video render orchestration.
 *
 * The heavy render (Playwright seeks the composition frame-by-frame →
 * ffmpeg encodes h264 + ElevenLabs music) is too slow and too memory-hungry
 * for a Worker, so it runs in GitHub Actions. The Worker only:
 *   1. dispatches the job (repository_dispatch),
 *   2. serves the exact composition HTML the Action captures, and
 *   3. receives progress + finished-MP4 callbacks.
 *
 * Everything is secret-gated and degrades cleanly: with no dispatch creds,
 * the free live preview still works — only the paid render is unavailable.
 */
import type { Env } from "../types/env";

export const VIDEO_FORMATS = ["16:9", "9:16", "1:1"] as const;
export type VideoFormat = (typeof VIDEO_FORMATS)[number];

/** Canvas each aspect ratio renders at (the composition is authored 1920×1080
 *  and letterboxed/cropped by the Action for the vertical + square cuts). */
export const FORMAT_DIMS: Record<VideoFormat, { w: number; h: number }> = {
  "16:9": { w: 1920, h: 1080 },
  "9:16": { w: 1080, h: 1920 },
  "1:1": { w: 1080, h: 1080 },
};

/** True when the Worker can actually kick off a render. */
export function renderConfigured(env: Env): boolean {
  return Boolean(env.GITHUB_DISPATCH_TOKEN && env.RENDER_REPO && env.RENDER_CALLBACK_SECRET);
}

export function videoExportPriceCents(env: Env): number {
  const n = Number(env.VIDEO_EXPORT_PRICE_CENTS);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 1900;
}

/**
 * Trigger the render workflow. The Action pulls the composition + job spec
 * back from the Worker (so nothing large travels in the dispatch payload) and
 * posts the finished files to the callback endpoints.
 */
export async function dispatchRender(
  env: Env,
  args: { shopId: string; jobId: string; formats: VideoFormat[] },
): Promise<{ ok: boolean; error?: string }> {
  if (!renderConfigured(env)) return { ok: false, error: "render backend not configured" };
  const base = (env.APP_URL || "https://verto.style").replace(/\/$/, "");
  const res = await fetch(`https://api.github.com/repos/${env.RENDER_REPO}/dispatches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.GITHUB_DISPATCH_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "verto-render",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      event_type: "render_video",
      client_payload: {
        shopId: args.shopId,
        jobId: args.jobId,
        formats: args.formats,
        callbackBase: `${base}/api/render`,
      },
    }),
  });
  if (res.status === 204) return { ok: true };
  const body = await res.text().catch(() => "");
  return { ok: false, error: `github dispatch ${res.status}: ${body.slice(0, 200)}` };
}

/** Constant-time-ish secret compare for the callback header. */
export function renderSecretOk(env: Env, presented: string | null | undefined): boolean {
  const secret = env.RENDER_CALLBACK_SECRET;
  if (!secret || !presented) return false;
  if (presented.length !== secret.length) return false;
  let diff = 0;
  for (let i = 0; i < secret.length; i++) diff |= secret.charCodeAt(i) ^ presented.charCodeAt(i);
  return diff === 0;
}
