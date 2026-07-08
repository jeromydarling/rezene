import { useEffect, useMemo, useState } from "react";
import { PageHeader, LoadingTable } from "../../components/admin/ui";
import { BrandMark, paletteVars } from "../../components/BrandMark";
import { useFetch } from "../../lib/useFetch";
import { api } from "../../lib/api";
import { useToast } from "../../lib/toast";
import { extractPalette } from "../../lib/color-extract";
import type { BrandLogo, BrandPalette, BrandSettings, BrandTypography, BrandWordmark } from "../../../shared/types";
import {
  BRAND_FONTS,
  DEFAULT_PALETTE,
  DEFAULT_TYPOGRAPHY,
  DEFAULT_WORDMARK,
  PALETTE_PRESETS,
  TYPE_PAIRINGS,
  typePairing,
} from "../../../shared/brand-identity";

type LogoTab = "wordmark" | "upload" | "emblem";

export function BrandStudioPage() {
  const toast = useToast();
  const settings = useFetch<BrandSettings>("/api/public/settings");
  const brandName = settings.data?.brandName ?? "Your Label";

  const [logo, setLogo] = useState<BrandLogo | null>(null);
  const [palette, setPalette] = useState<BrandPalette>(DEFAULT_PALETTE);
  const [typography, setTypography] = useState<BrandTypography>(DEFAULT_TYPOGRAPHY);
  const [tab, setTab] = useState<LogoTab>("wordmark");
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<
    "upload" | "upload-dark" | "emblem" | "palette" | "generate" | "extract" | "import" | null
  >(null);
  const [vibe, setVibe] = useState("");
  const [importUrl, setImportUrl] = useState("");
  // Brand-in-a-box (AI full-identity generator).
  const [makes, setMakes] = useState("");
  const [genVibe, setGenVibe] = useState("");
  const [suggestion, setSuggestion] = useState<{ tagline: string; voice: string } | null>(null);
  const [emblemPrompt, setEmblemPrompt] = useState("");
  const [emblemUrl, setEmblemUrl] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Seed from saved settings once loaded.
  useEffect(() => {
    if (!settings.data || hydrated) return;
    setPalette(settings.data.palette ?? DEFAULT_PALETTE);
    setTypography(settings.data.typography ?? DEFAULT_TYPOGRAPHY);
    if (settings.data.logo) {
      setLogo(settings.data.logo);
      setTab(settings.data.logo.kind === "image" ? "upload" : "wordmark");
    } else {
      setLogo({ kind: "wordmark", wordmark: DEFAULT_WORDMARK(settings.data.brandName) });
    }
    setHydrated(true);
  }, [settings.data, hydrated]);

  // Load the selected pairing's web fonts so the preview is truthful.
  useEffect(() => {
    const p = typePairing(typography.pairing);
    if (!p.googleUrl) return;
    const id = `brand-font-${p.key}`;
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = p.googleUrl;
    document.head.appendChild(link);
  }, [typography.pairing]);

  const wordmark: BrandWordmark = logo?.wordmark ?? DEFAULT_WORDMARK(brandName);
  const setWordmark = (patch: Partial<BrandWordmark>) =>
    setLogo((l) => ({ kind: "wordmark", ...l, wordmark: { ...wordmark, ...patch } }));

  // The effective logo the preview/save uses depends on the active tab so the
  // preview always reflects what you're editing.
  const effectiveLogo: BrandLogo = useMemo(() => {
    if (tab === "wordmark") return { ...logo, kind: "wordmark", wordmark };
    return { ...logo, kind: "image", imageUrl: logo?.imageUrl ?? null, darkImageUrl: logo?.darkImageUrl ?? null };
  }, [tab, logo, wordmark]);

  async function upload(file: File): Promise<string> {
    const form = new FormData();
    form.set("file", file);
    form.set("entityType", "brand");
    form.set("isPublic", "1");
    const res = await api.upload<{ id: string }>("/api/admin/files/upload", form);
    return `/media/${res.id}`;
  }

  async function onUpload(file: File | undefined, which: "light" | "dark") {
    if (!file) return;
    setBusy(which === "dark" ? "upload-dark" : "upload");
    try {
      const url = await upload(file);
      setLogo((l) => ({
        kind: "image",
        ...l,
        ...(which === "dark" ? { darkImageUrl: url } : { imageUrl: url }),
      }));
      setTab("upload");
    } catch {
      toast.error("Upload failed");
    } finally {
      setBusy(null);
    }
  }

  async function generateEmblem() {
    setBusy("emblem");
    try {
      const res = await api.post<{ url: string }>("/api/admin/brand/emblem", {
        brandName,
        prompt: emblemPrompt.trim() || undefined,
      });
      setEmblemUrl(res.url);
    } catch (e) {
      toast.error("Couldn't generate an emblem", e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(null);
    }
  }

  async function importFromUrl() {
    if (!importUrl.trim()) return;
    setBusy("import");
    try {
      const res = await api.post<{
        name: string | null;
        tagline: string | null;
        themeColor: string | null;
        logoUrl: string | null;
        pairing: string;
      }>("/api/admin/brand/import-url", { url: importUrl.trim() });

      if (res.logoUrl) {
        setLogo({ kind: "image", imageUrl: res.logoUrl });
        setTab("upload");
        // Pull a palette from the imported logo (same-origin → canvas-safe).
        try {
          const pal = await extractPalette(res.logoUrl);
          setPalette(res.themeColor ? { ...pal, accent: res.themeColor } : pal);
        } catch {
          if (res.themeColor) setPalette((p) => ({ ...p, accent: res.themeColor! }));
        }
      } else if (res.themeColor) {
        setPalette((p) => ({ ...p, accent: res.themeColor! }));
      }
      setTypography({ pairing: res.pairing });
      if (res.tagline) setSuggestion({ tagline: res.tagline, voice: "" });
      toast.success("Imported from your site", "Review the logo, colours, and type, then save.");
    } catch (e) {
      toast.error("Couldn't import from that site", e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(null);
    }
  }

  async function generateIdentity() {
    setBusy("generate");
    try {
      const res = await api.post<{
        palette: BrandPalette;
        typography: BrandTypography;
        wordmark: BrandWordmark;
        tagline: string;
        voice: string;
      }>("/api/admin/brand/generate", {
        brandName,
        makes: makes.trim() || undefined,
        vibe: genVibe.trim() || undefined,
      });
      setPalette(res.palette);
      setTypography(res.typography);
      setLogo({ kind: "wordmark", wordmark: { ...res.wordmark, text: brandName } });
      setTab("wordmark");
      setSuggestion({ tagline: res.tagline, voice: res.voice });
      toast.success("Identity generated", "Tweak anything, then save.");
    } catch (e) {
      toast.error("Couldn't generate an identity", e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(null);
    }
  }

  async function applyTagline() {
    if (!suggestion?.tagline) return;
    try {
      await api.patch("/api/admin/settings", { brand_tagline: suggestion.tagline });
      toast.success("Tagline saved");
    } catch {
      toast.error("Couldn't save the tagline");
    }
  }

  async function extractFromPhoto(file: File | undefined) {
    if (!file) return;
    setBusy("extract");
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      setPalette(await extractPalette(dataUrl));
      toast.success("Palette pulled from your image", "Fine-tune any colour by hand.");
    } catch {
      toast.error("Couldn't read colours from that image");
    } finally {
      setBusy(null);
    }
  }

  async function suggestPalette() {
    setBusy("palette");
    try {
      const res = await api.post<BrandPalette>("/api/admin/brand/palette-suggest", {
        brandName,
        vibe: vibe.trim() || undefined,
      });
      setPalette(res);
      toast.success("Palette suggested", "Tweak any colour by hand.");
    } catch (e) {
      toast.error("Couldn't suggest a palette", e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    setSaving(true);
    try {
      const toSave: BrandLogo =
        tab === "wordmark"
          ? { kind: "wordmark", wordmark, markUrl: logo?.markUrl ?? null }
          : {
              kind: "image",
              imageUrl: logo?.imageUrl ?? null,
              darkImageUrl: logo?.darkImageUrl ?? null,
              wordmark, // keep the wordmark config so switching back is lossless
              markUrl: logo?.markUrl ?? null,
            };
      await api.patch("/api/admin/settings", {
        brand_logo: JSON.stringify(toSave),
        brand_palette: JSON.stringify(palette),
        brand_typography: JSON.stringify(typography),
      });
      toast.success("Brand identity saved", "It's live across your storefront.");
      settings.reload();
    } catch (e) {
      toast.error("Couldn't save", e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  if (settings.loading || !hydrated) return <LoadingTable rows={6} />;

  return (
    <div>
      <PageHeader
        eyebrow="Studio"
        title="Brand Studio"
        description="Your logo and colours, in one place — set them here and they carry across your storefront, favicon, and everything you send. New label? Design a wordmark and a palette from scratch."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Controls */}
        <div className="space-y-5">
          {/* Import from an existing website */}
          <div className="admin-card space-y-2 p-5">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-warmgrey">
                Already have a brand?
              </h2>
              <p className="text-[11px] text-warmgrey">
                Paste your current website and we'll pull in your logo, colours, and fonts to start from.
              </p>
            </div>
            <div className="flex gap-2">
              <input
                className="input !py-1.5 text-sm"
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void importFromUrl()}
                placeholder="yourlabel.com"
              />
              <button
                type="button"
                className="btn btn-secondary shrink-0"
                disabled={busy === "import" || !importUrl.trim()}
                onClick={() => void importFromUrl()}
              >
                {busy === "import" ? "Importing…" : "Import"}
              </button>
            </div>
          </div>

          {/* Brand in a box — AI full-identity generator */}
          <div className="admin-card space-y-3 border-navy/20 bg-navy/[0.03] p-5">
            <div>
              <h2 className="font-display text-lg font-light">✦ Brand in a box</h2>
              <p className="text-[11px] text-warmgrey">
                New label? Answer two questions and generate a full identity — palette, type, logo, and a
                tagline — then tweak anything.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                className="input !py-1.5 text-sm"
                value={makes}
                onChange={(e) => setMakes(e.target.value)}
                placeholder="What you make (e.g. linen resortwear)"
              />
              <input
                className="input !py-1.5 text-sm"
                value={genVibe}
                onChange={(e) => setGenVibe(e.target.value)}
                placeholder="Vibe (e.g. warm, coastal, refined)"
              />
            </div>
            <button
              type="button"
              className="btn btn-primary w-full"
              disabled={busy === "generate"}
              onClick={() => void generateIdentity()}
            >
              {busy === "generate" ? "Designing your brand…" : `Generate an identity for ${brandName}`}
            </button>
            {suggestion && (
              <div className="space-y-2 rounded-md border border-ink/10 bg-white p-3">
                {suggestion.tagline && (
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm">
                      <span className="text-warmgrey">Tagline:</span>{" "}
                      <span className="font-medium">{suggestion.tagline}</span>
                    </p>
                    <button type="button" className="btn btn-secondary !py-1 text-xs" onClick={() => void applyTagline()}>
                      Use tagline
                    </button>
                  </div>
                )}
                {suggestion.voice && (
                  <p className="text-[11px] leading-snug text-warmgrey">
                    <span className="font-semibold text-ink/70">Voice:</span> {suggestion.voice}{" "}
                    <a href="/admin/content/pages" className="link-quiet">
                      set it in Brand voice →
                    </a>
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Logo */}
          <div className="admin-card p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-warmgrey">Logo</h2>
            <div className="mb-4 flex overflow-hidden rounded-md border border-ink/15 text-xs">
              {(["wordmark", "upload", "emblem"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`flex-1 px-3 py-1.5 capitalize ${
                    tab === t ? "bg-navy text-chalk" : "bg-white text-ink/60 hover:text-ink"
                  }`}
                >
                  {t === "wordmark" ? "Wordmark" : t === "upload" ? "Upload" : "AI emblem"}
                </button>
              ))}
            </div>

            {tab === "wordmark" && (
              <div className="space-y-3">
                <Field label="Logo text">
                  <input
                    className="input"
                    value={wordmark.text}
                    onChange={(e) => setWordmark({ text: e.target.value })}
                    placeholder={brandName}
                  />
                </Field>
                <Field label="Typeface">
                  <div className="grid grid-cols-2 gap-1.5">
                    {BRAND_FONTS.map((f) => (
                      <button
                        key={f.key}
                        type="button"
                        onClick={() => setWordmark({ font: f.key })}
                        className={`rounded border px-2 py-1.5 text-left ${
                          wordmark.font === f.key ? "border-navy ring-1 ring-navy" : "border-ink/15 hover:border-ink/40"
                        }`}
                        title={f.mood}
                      >
                        <span style={{ fontFamily: f.stack }} className="text-sm">
                          {wordmark.text || brandName}
                        </span>
                        <span className="block text-[10px] text-warmgrey">{f.label}</span>
                      </button>
                    ))}
                  </div>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Case">
                    <div className="flex overflow-hidden rounded-md border border-ink/15 text-xs">
                      {(["as-is", "upper", "lower"] as const).map((cs) => (
                        <button
                          key={cs}
                          type="button"
                          onClick={() => setWordmark({ case: cs })}
                          className={`flex-1 px-2 py-1.5 ${
                            wordmark.case === cs ? "bg-navy text-chalk" : "bg-white text-ink/60 hover:text-ink"
                          }`}
                        >
                          {cs === "as-is" ? "Aa" : cs === "upper" ? "AA" : "aa"}
                        </button>
                      ))}
                    </div>
                  </Field>
                  <Field label="Weight">
                    <div className="flex overflow-hidden rounded-md border border-ink/15 text-xs">
                      {[300, 400, 600].map((w) => (
                        <button
                          key={w}
                          type="button"
                          onClick={() => setWordmark({ weight: w })}
                          className={`flex-1 px-2 py-1.5 ${
                            wordmark.weight === w ? "bg-navy text-chalk" : "bg-white text-ink/60 hover:text-ink"
                          }`}
                        >
                          {w === 300 ? "Light" : w === 400 ? "Reg" : "Bold"}
                        </button>
                      ))}
                    </div>
                  </Field>
                </div>
                <Field label={`Letter-spacing · ${wordmark.tracking.toFixed(2)}em`}>
                  <input
                    type="range"
                    min={-0.05}
                    max={0.4}
                    step={0.01}
                    value={wordmark.tracking}
                    onChange={(e) => setWordmark({ tracking: Number(e.target.value) })}
                    className="w-full"
                  />
                </Field>
                <div className="flex gap-4 text-sm">
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={wordmark.monogram}
                      onChange={(e) => setWordmark({ monogram: e.target.checked })}
                    />
                    Monogram
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={wordmark.divider}
                      onChange={(e) => setWordmark({ divider: e.target.checked })}
                    />
                    Underline rule
                  </label>
                </div>
              </div>
            )}

            {tab === "upload" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <UploadTile
                    label="Logo (for light backgrounds)"
                    url={logo?.imageUrl ?? null}
                    dark={false}
                    busy={busy === "upload"}
                    onFile={(f) => onUpload(f, "light")}
                    onClear={() => setLogo((l) => ({ kind: "image", ...l, imageUrl: null }))}
                  />
                  <UploadTile
                    label="Dark variant (optional)"
                    url={logo?.darkImageUrl ?? null}
                    dark
                    busy={busy === "upload-dark"}
                    onFile={(f) => onUpload(f, "dark")}
                    onClear={() => setLogo((l) => ({ kind: "image", ...l, darkImageUrl: null }))}
                  />
                </div>
                <p className="text-[11px] text-warmgrey">
                  Use a transparent PNG or an SVG. The dark variant shows on your navy nav bar and footer;
                  without one we use your main logo everywhere.
                </p>
              </div>
            )}

            {tab === "emblem" && (
              <div className="space-y-3">
                <Field label="Describe the mark (optional)">
                  <input
                    className="input"
                    value={emblemPrompt}
                    onChange={(e) => setEmblemPrompt(e.target.value)}
                    placeholder="e.g. an abstract wave, a crescent, a woven knot"
                  />
                </Field>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy === "emblem"}
                  onClick={() => void generateEmblem()}
                >
                  {busy === "emblem" ? "Generating…" : "✦ Generate an emblem"}
                </button>
                {emblemUrl && (
                  <div className="flex items-center gap-3 rounded-md border border-ink/10 bg-cream/40 p-3">
                    <img src={emblemUrl} alt="Emblem" className="h-16 w-16 rounded object-contain" />
                    <div className="space-y-1.5">
                      <button
                        type="button"
                        className="btn btn-secondary text-xs"
                        onClick={() => {
                          setLogo((l) => ({ kind: "image", ...l, imageUrl: emblemUrl, markUrl: emblemUrl }));
                          setTab("upload");
                        }}
                      >
                        Use as my logo
                      </button>
                      <p className="text-[11px] text-warmgrey">
                        A raster mark on a white background. Best for an icon; for a wordmark, use the Wordmark tab.
                      </p>
                    </div>
                  </div>
                )}
                <p className="text-[11px] text-warmgrey">
                  Generated with your native Flux model — no keys, no extra cost.
                </p>
              </div>
            )}
          </div>

          {/* Palette */}
          <div className="admin-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-warmgrey">Colours</h2>
            </div>
            <div className="mb-4 flex flex-wrap gap-1.5">
              {PALETTE_PRESETS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPalette({ primary: p.primary, accent: p.accent, ink: p.ink, bg: p.bg })}
                  className="flex items-center gap-1.5 rounded-full border border-ink/15 py-1 pl-1 pr-2.5 text-xs hover:border-navy"
                  title={p.label}
                >
                  <span className="flex overflow-hidden rounded-full">
                    {[p.primary, p.accent, p.bg].map((c, i) => (
                      <span key={i} className="h-4 w-4" style={{ background: c }} />
                    ))}
                  </span>
                  {p.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(
                [
                  ["primary", "Primary"],
                  ["accent", "Accent"],
                  ["ink", "Text"],
                  ["bg", "Background"],
                ] as const
              ).map(([key, label]) => (
                <Field key={key} label={label}>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={palette[key]}
                      onChange={(e) => setPalette({ ...palette, [key]: e.target.value })}
                      className="h-9 w-10 cursor-pointer rounded border border-ink/15 bg-white p-0.5"
                    />
                    <input
                      className="input !py-1 text-xs uppercase"
                      value={palette[key]}
                      onChange={(e) => setPalette({ ...palette, [key]: e.target.value })}
                    />
                  </div>
                </Field>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-end gap-2 rounded-md border border-navy/15 bg-navy/[0.03] p-3">
              <Field label="✨ Suggest from a vibe">
                <input
                  className="input !py-1.5 text-sm"
                  value={vibe}
                  onChange={(e) => setVibe(e.target.value)}
                  placeholder="warm, coastal, understated luxury"
                />
              </Field>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy === "palette"}
                onClick={() => void suggestPalette()}
              >
                {busy === "palette" ? "Thinking…" : "Suggest"}
              </button>
            </div>
            <label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-ink/25 px-3 py-2 text-xs text-warmgrey hover:border-navy hover:text-navy">
              {busy === "extract" ? "Reading colours…" : "🎨 Extract a palette from a photo or moodboard"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void extractFromPhoto(e.target.files?.[0])}
              />
            </label>
          </div>

          {/* Typography */}
          <div className="admin-card p-5">
            <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-warmgrey">Typography</h2>
            <p className="mb-3 text-[11px] text-warmgrey">
              The heading + body pairing your whole storefront is set in.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {TYPE_PAIRINGS.map((p) => {
                const on = typography.pairing === p.key;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setTypography({ pairing: p.key })}
                    className={`rounded-md border p-2.5 text-left ${on ? "border-navy ring-1 ring-navy" : "border-ink/15 hover:border-ink/40"}`}
                    title={p.mood}
                  >
                    <span style={{ fontFamily: p.headingFamily }} className="block text-lg leading-tight">
                      {brandName}
                    </span>
                    <span style={{ fontFamily: p.bodyFamily }} className="block text-[11px] text-warmgrey">
                      {p.label} · Aa Bb Cc 123
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void save()}>
            {saving ? "Saving…" : "Save brand identity"}
          </button>
        </div>

        {/* Live preview */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-warmgrey">Live preview</p>
          <div className="overflow-hidden rounded-xl border border-ink/10 shadow-sm" style={paletteVars(palette)}>
            {/* storefront header */}
            <div className="flex items-center justify-between px-4 py-3" style={{ background: palette.primary }}>
              <BrandMark logo={effectiveLogo} palette={palette} brandName={brandName} onDark height={26} />
              <div className="flex gap-3 text-[11px]" style={{ color: "#f7f4ee" }}>
                <span>Shop</span>
                <span>Lookbook</span>
                <span>About</span>
              </div>
            </div>
            {/* storefront body */}
            <div
              className="px-5 py-6"
              style={{ background: palette.bg, color: palette.ink, fontFamily: typePairing(typography.pairing).bodyFamily }}
            >
              <p
                className="text-2xl"
                style={{ fontFamily: typePairing(typography.pairing).headingFamily }}
              >
                Dressed for the last light.
              </p>
              <div className="mt-2">
                <BrandMark logo={effectiveLogo} palette={palette} brandName={brandName} height={34} />
              </div>
              <p className="mt-3 max-w-xs text-sm" style={{ opacity: 0.8 }}>
                {settings.data?.tagline || "Your tagline sets the tone for the whole shop."}
              </p>
              <div className="mt-4 flex gap-2">
                <span
                  className="rounded px-3 py-1.5 text-xs font-medium"
                  style={{ background: palette.accent, color: "#fff" }}
                >
                  Shop the collection
                </span>
                <span
                  className="rounded border px-3 py-1.5 text-xs font-medium"
                  style={{ borderColor: palette.ink, color: palette.ink }}
                >
                  Our story
                </span>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="aspect-[3/4] rounded" style={{ background: palette.primary, opacity: 0.08 + i * 0.04 }} />
                ))}
              </div>
            </div>
            {/* favicon + footer */}
            <div className="flex items-center gap-2 px-4 py-2 text-[11px]" style={{ background: palette.primary, color: "#f7f4ee" }}>
              <span
                className="grid h-5 w-5 place-items-center rounded"
                style={{ background: palette.accent, color: "#fff", fontSize: 9 }}
              >
                {(wordmark.text || brandName).trim().slice(0, 1).toUpperCase()}
              </span>
              favicon + footer use the same identity
            </div>
          </div>
          <p className="mt-2 text-[11px] text-warmgrey">
            This is your live storefront chrome. Colours also flow into buttons, links, and headings across the shop.
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-warmgrey">{label}</span>
      {children}
    </label>
  );
}

function UploadTile({
  label,
  url,
  dark,
  busy,
  onFile,
  onClear,
}: {
  label: string;
  url: string | null;
  dark: boolean;
  busy: boolean;
  onFile: (f: File | undefined) => void;
  onClear: () => void;
}) {
  return (
    <div>
      <span className="mb-1 block text-xs font-medium text-warmgrey">{label}</span>
      {url ? (
        <div
          className="relative flex h-24 items-center justify-center rounded border border-ink/15"
          style={{ background: dark ? "#1f2a44" : "#faf7f0" }}
        >
          <img src={url} alt="" className="max-h-16 max-w-[80%] object-contain" />
          <button
            type="button"
            onClick={onClear}
            className="absolute right-1 top-1 rounded-full bg-white/85 px-1.5 text-[11px] text-ink/70 shadow hover:text-red-600"
          >
            ✕
          </button>
        </div>
      ) : (
        <label
          className="flex h-24 cursor-pointer items-center justify-center rounded border border-dashed border-ink/25 text-center text-[11px] text-warmgrey hover:border-navy hover:text-navy"
          style={{ background: dark ? "#1f2a44" : undefined, color: dark ? "#cdd3e0" : undefined }}
        >
          {busy ? "Uploading…" : "Upload PNG / SVG"}
          <input
            type="file"
            accept="image/png,image/svg+xml,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </label>
      )}
    </div>
  );
}
