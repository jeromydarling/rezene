/**
 * Pull a brand palette out of a photo / moodboard / logo, entirely client-side.
 * Downscale to a small canvas, quantise pixels into colour buckets, then assign
 * the four brand roles by luminance + saturation: background = a light dominant,
 * ink = a dark dominant, accent = the most vivid colour, primary = a strong dark
 * that isn't the near-black ink. No dependencies.
 */
import type { BrandPalette } from "../../shared/types";

interface Bucket {
  r: number;
  g: number;
  b: number;
  count: number;
}

function toHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
}
function lum({ r, g, b }: Bucket): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}
function sat({ r, g, b }: Bucket): number {
  const mx = Math.max(r, g, b),
    mn = Math.min(r, g, b);
  return mx === 0 ? 0 : (mx - mn) / mx;
}
function mix(a: Bucket, t: number, target = 255): Bucket {
  return { r: a.r + (target - a.r) * t, g: a.g + (target - a.g) * t, b: a.b + (target - a.b) * t, count: a.count };
}

export async function extractPalette(src: string): Promise<BrandPalette> {
  const img = await loadImage(src);
  const size = 72;
  const scale = Math.min(1, size / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  // Quantise into 4-bits-per-channel buckets by frequency.
  const map = new Map<number, Bucket>();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue; // skip transparent
    const r = data[i],
      g = data[i + 1],
      b = data[i + 2];
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const cur = map.get(key);
    if (cur) {
      cur.r += r;
      cur.g += g;
      cur.b += b;
      cur.count++;
    } else {
      map.set(key, { r, g, b, count: 1 });
    }
  }
  const buckets = [...map.values()].map((x) => ({ r: x.r / x.count, g: x.g / x.count, b: x.b / x.count, count: x.count }));
  if (buckets.length === 0) return { primary: "#1f2a44", accent: "#c06e52", ink: "#23201b", bg: "#faf7f0" };
  buckets.sort((a, b) => b.count - a.count);
  const top = buckets.slice(0, 12);

  // Background: a light, frequent colour (lifted toward white for a clean page).
  const light = [...top].sort((a, b) => lum(b) - lum(a))[0];
  const bg = mix(light, 0.55);
  // Ink: darkest frequent, pushed toward near-black for legibility.
  const dark = [...top].sort((a, b) => lum(a) - lum(b))[0];
  const ink = mix(dark, -0.35, 0); // darken
  // Accent: most saturated colour with usable brightness.
  const accent =
    [...top].filter((c) => lum(c) > 0.18 && lum(c) < 0.85).sort((a, b) => sat(b) * b.count - sat(a) * a.count)[0] ??
    top[0];
  // Primary: a strong dark that isn't the near-black ink (fall back to a darkened accent).
  const primary =
    [...top].filter((c) => lum(c) < 0.5 && sat(c) > 0.15).sort((a, b) => b.count - a.count)[0] ?? mix(accent, -0.25, 0);

  return {
    primary: toHex(primary.r, primary.g, primary.b),
    accent: toHex(accent.r, accent.g, accent.b),
    ink: toHex(ink.r, ink.g, ink.b),
    bg: toHex(bg.r, bg.g, bg.b),
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = "anonymous";
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = src;
  });
}
