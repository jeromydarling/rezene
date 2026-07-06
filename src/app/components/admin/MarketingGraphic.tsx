import { useRef, useState } from "react";
import { useBrand } from "../../lib/brand";
import { ImageField } from "./cms";

/**
 * Graphics studio: brand-styled social/print graphics composed as SVG and
 * exported to PNG entirely client-side — no image-generation API needed.
 * AI writes the words elsewhere; this gives them a designed canvas.
 */

const SIZES = [
  { key: "square", label: "Post (1080×1080)", width: 1080, height: 1080 },
  { key: "story", label: "Story (1080×1920)", width: 1080, height: 1920 },
  { key: "landscape", label: "Link card (1200×630)", width: 1200, height: 630 },
] as const;

const SCHEMES = [
  { key: "navy", label: "Navy", bg: "#1f2a44", fg: "#faf7f0", accent: "#d9a441" },
  { key: "cream", label: "Cream", bg: "#f5eedd", fg: "#1c1a17", accent: "#a2583f" },
  { key: "terracotta", label: "Terracotta", bg: "#a2583f", fg: "#faf7f0", accent: "#f5eedd" },
  { key: "chalk", label: "Chalk", bg: "#faf7f0", fg: "#1f2a44", accent: "#c06e52" },
] as const;

export function MarketingGraphic({
  initialHeadline = "",
  initialEyebrow = "",
}: {
  initialHeadline?: string;
  initialEyebrow?: string;
}) {
  const brand = useBrand();
  const svgRef = useRef<SVGSVGElement>(null);
  const [sizeKey, setSizeKey] = useState<(typeof SIZES)[number]["key"]>("square");
  const [schemeKey, setSchemeKey] = useState<(typeof SCHEMES)[number]["key"]>("navy");
  const [eyebrow, setEyebrow] = useState(initialEyebrow);
  const [headline, setHeadline] = useState(initialHeadline || "Say the one thing.");
  const [subline, setSubline] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [downloading, setDownloading] = useState(false);

  const size = SIZES.find((s) => s.key === sizeKey)!;
  const scheme = SCHEMES.find((s) => s.key === schemeKey)!;
  const { width, height } = size;
  const isStory = sizeKey === "story";
  const pad = Math.round(width * 0.08);
  const headlineSize = Math.round(width / (headline.length > 40 ? 16 : headline.length > 24 ? 13 : 10));
  // Text sits in the lower third over an image, centered otherwise.
  const textBlockY = imageUrl ? height * 0.62 : height * (isStory ? 0.4 : 0.34);

  // Naive word wrap for SVG (no CSS text wrapping in <text>).
  const wrap = (text: string, perLine: number): string[] => {
    const words = text.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      if ((line + " " + word).trim().length > perLine && line) {
        lines.push(line.trim());
        line = word;
      } else {
        line = `${line} ${word}`;
      }
    }
    if (line.trim()) lines.push(line.trim());
    return lines.slice(0, 5);
  };
  const headlineLines = wrap(headline, Math.round(width / (headlineSize * 0.52)));
  const sublineLines = subline ? wrap(subline, Math.round(width / (headlineSize * 0.3))) : [];

  async function downloadPng() {
    const svg = svgRef.current;
    if (!svg) return;
    setDownloading(true);
    try {
      // Inline the photo as a data URI so canvas export isn't tainted.
      let svgText = new XMLSerializer().serializeToString(svg);
      if (imageUrl) {
        const res = await fetch(imageUrl);
        const blob = await res.blob();
        const dataUri = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        svgText = svgText.replaceAll(imageUrl, dataUri);
      }
      const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("SVG render failed"));
        img.src = url;
      });
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      const png = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = png;
      a.download = `${brand.brandName.toLowerCase().replaceAll(/\s+/g, "-")}-${sizeKey}.png`;
      a.click();
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
      <div className="space-y-3">
        <div>
          <label className="label">Format</label>
          <select className="input" value={sizeKey} onChange={(e) => setSizeKey(e.target.value as typeof sizeKey)}>
            {SIZES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Color scheme</label>
          <div className="flex gap-2">
            {SCHEMES.map((s) => (
              <button
                key={s.key}
                type="button"
                title={s.label}
                aria-label={s.label}
                className={`h-8 w-8 rounded-full border-2 ${schemeKey === s.key ? "border-ink" : "border-ink/15"}`}
                style={{ backgroundColor: s.bg }}
                onClick={() => setSchemeKey(s.key)}
              />
            ))}
          </div>
        </div>
        <div>
          <label className="label">Kicker</label>
          <input className="input" value={eyebrow} onChange={(e) => setEyebrow(e.target.value)} />
        </div>
        <div>
          <label className="label">Headline</label>
          <textarea rows={2} className="input" value={headline} onChange={(e) => setHeadline(e.target.value)} />
        </div>
        <div>
          <label className="label">Subline</label>
          <input className="input" value={subline} onChange={(e) => setSubline(e.target.value)} />
        </div>
        <div>
          <label className="label">Photo (optional)</label>
          <ImageField value={imageUrl} onChange={setImageUrl} />
        </div>
        <button type="button" className="btn btn-primary w-full" disabled={downloading} onClick={() => void downloadPng()}>
          {downloading ? "Rendering…" : "Download PNG"}
        </button>
        <p className="text-xs text-warmgrey">
          Sized for Instagram, stories, and link previews. Photos from your media library render
          under a dark wash so the text always reads.
        </p>
      </div>

      <div className="admin-card overflow-hidden p-3">
        <svg
          ref={svgRef}
          xmlns="http://www.w3.org/2000/svg"
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: "100%", height: "auto", maxHeight: 560, display: "block", margin: "0 auto" }}
        >
          <rect width={width} height={height} fill={scheme.bg} />
          {imageUrl && (
            <>
              <image href={imageUrl} x="0" y="0" width={width} height={height} preserveAspectRatio="xMidYMid slice" />
              <rect width={width} height={height} fill="#141d31" opacity="0.45" />
            </>
          )}
          {/* Frame */}
          <rect
            x={pad / 2}
            y={pad / 2}
            width={width - pad}
            height={height - pad}
            fill="none"
            stroke={imageUrl ? "#faf7f0" : scheme.accent}
            strokeOpacity={imageUrl ? 0.5 : 0.7}
            strokeWidth={Math.max(2, width / 400)}
          />
          {eyebrow && (
            <text
              x={width / 2}
              y={textBlockY - headlineSize * 1.4}
              textAnchor="middle"
              fill={imageUrl ? "#faf7f0" : scheme.accent}
              fontFamily="Georgia, 'Times New Roman', serif"
              fontSize={headlineSize * 0.34}
              letterSpacing={headlineSize * 0.08}
              style={{ textTransform: "uppercase" }}
            >
              {eyebrow.toUpperCase()}
            </text>
          )}
          {headlineLines.map((line, i) => (
            <text
              key={i}
              x={width / 2}
              y={textBlockY + i * headlineSize * 1.18}
              textAnchor="middle"
              fill={imageUrl ? "#faf7f0" : scheme.fg}
              fontFamily="Georgia, 'Times New Roman', serif"
              fontSize={headlineSize}
              fontWeight="300"
            >
              {line}
            </text>
          ))}
          {sublineLines.map((line, i) => (
            <text
              key={i}
              x={width / 2}
              y={textBlockY + headlineLines.length * headlineSize * 1.18 + headlineSize * 0.5 + i * headlineSize * 0.52}
              textAnchor="middle"
              fill={imageUrl ? "#faf7f0" : scheme.fg}
              opacity="0.75"
              fontFamily="Georgia, 'Times New Roman', serif"
              fontSize={headlineSize * 0.36}
            >
              {line}
            </text>
          ))}
          <text
            x={width / 2}
            y={height - pad * 0.9}
            textAnchor="middle"
            fill={imageUrl ? "#faf7f0" : scheme.fg}
            opacity="0.85"
            fontFamily="Georgia, 'Times New Roman', serif"
            fontSize={headlineSize * 0.3}
            letterSpacing={headlineSize * 0.1}
          >
            {brand.brandName.toUpperCase()}
          </text>
        </svg>
      </div>
    </div>
  );
}
