import { useEffect, useMemo, useState } from "react";
import { PageHeader, LoadingTable } from "../../components/admin/ui";
import { BrandMark } from "../../components/BrandMark";
import { useFetch } from "../../lib/useFetch";
import { useToast } from "../../lib/toast";
import type { BrandSettings } from "../../../shared/types";
import { typePairing } from "../../../shared/brand-identity";
import { collateralBrand } from "../../lib/collateral";
import {
  buildGuidelinesDoc,
  download,
  downloadKitZip,
  faviconSvg,
  hexToRgb,
  paletteText,
  socialImage,
  wordmarkSvg,
} from "../../lib/brand-kit";

export function BrandGuidelinesPage() {
  const toast = useToast();
  const settings = useFetch<BrandSettings>("/api/public/settings");
  const voiceRes = useFetch<{ voice: string }>("/api/admin/content/brand-voice");
  const [busy, setBusy] = useState<string | null>(null);

  const website = typeof window !== "undefined" ? window.location.host : "yourlabel.com";
  const brand = useMemo(
    () => (settings.data ? collateralBrand(settings.data, website) : null),
    [settings.data, website],
  );

  useEffect(() => {
    const p = typePairing(settings.data?.typography?.pairing);
    if (!p.googleUrl) return;
    const id = `brand-font-${p.key}`;
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = p.googleUrl;
    document.head.appendChild(link);
  }, [settings.data?.typography?.pairing]);

  if (settings.loading || !brand) return <LoadingTable rows={6} />;
  const slug = brand.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "brand";
  const p = brand.palette;

  function openGuidelines() {
    const doc = buildGuidelinesDoc(brand!, voiceRes.data?.voice ?? "");
    const w = window.open("", "_blank");
    if (!w) return toast.error("Pop-up blocked", "Allow pop-ups to open the guidelines.");
    w.document.write(doc);
    w.document.close();
  }

  async function exportSocial(kind: "avatar" | "og" | "banner") {
    setBusy(kind);
    try {
      const url = await socialImage(kind, brand!);
      const blob = await (await fetch(url)).blob();
      download(`${slug}-${kind}.png`, blob, "image/png");
    } catch {
      toast.error("Couldn't export that image");
    } finally {
      setBusy(null);
    }
  }

  const isWordmark = brand.logo?.kind !== "image";

  return (
    <div>
      <PageHeader
        eyebrow="Brand"
        title="Guidelines & Kit"
        description="A shareable brand guidelines document and a downloadable kit — everything a collaborator, factory, or freelancer needs to use your brand correctly."
        actions={
          <button type="button" className="btn btn-primary" onClick={openGuidelines}>
            Open / Save as PDF
          </button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Inline guidelines */}
        <div className="admin-card space-y-8 p-6">
          <div className="border-b border-ink/10 pb-5" style={{ borderColor: "rgba(0,0,0,0.1)" }}>
            <p className="text-[11px] uppercase tracking-editorial" style={{ color: p.accent }}>
              Brand guidelines
            </p>
            <h2 className="font-display text-3xl font-light" style={{ color: p.primary }}>
              {brand.name}
            </h2>
            {brand.tagline && <p className="text-sm text-warmgrey">{brand.tagline}</p>}
          </div>

          <Section label="Logo" accent={p.accent}>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex h-28 items-center justify-center rounded-lg border border-ink/10" style={{ background: p.bg }}>
                <BrandMark logo={settings.data!.logo} palette={p} brandName={brand.name} height={30} />
              </div>
              <div className="flex h-28 items-center justify-center rounded-lg" style={{ background: p.primary }}>
                <BrandMark logo={settings.data!.logo} palette={p} brandName={brand.name} onDark height={30} />
              </div>
            </div>
            <p className="mt-2 text-[11px] text-warmgrey">
              Keep clear space around the logo. Don't stretch, recolour, or add effects.
            </p>
          </Section>

          <Section label="Colour" accent={p.accent}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {([["Primary", p.primary], ["Accent", p.accent], ["Text", p.ink], ["Background", p.bg]] as const).map(
                ([label, hex]) => (
                  <div key={label}>
                    <div className="h-16 rounded-md border border-ink/10" style={{ background: hex }} />
                    <p className="mt-1.5 text-xs font-medium">{label}</p>
                    <p className="text-[10px] uppercase text-warmgrey">{hex}</p>
                    <p className="text-[10px] text-warmgrey">rgb({hexToRgb(hex)})</p>
                  </div>
                ),
              )}
            </div>
          </Section>

          <Section label="Typography" accent={p.accent}>
            <p style={{ fontFamily: brand.headingFamily, color: p.primary }} className="text-3xl">
              Aa Bb Cc — Headings
            </p>
            <p style={{ fontFamily: brand.bodyFamily }} className="mt-2 max-w-lg text-sm leading-relaxed">
              Body copy is set in the paired sans. The quick brown fox jumps over the lazy dog. 0123456789.
            </p>
            <p className="mt-2 text-[11px] text-warmgrey">{typePairing(settings.data?.typography?.pairing).label} pairing</p>
          </Section>

          {voiceRes.data?.voice && (
            <Section label="Voice" accent={p.accent}>
              <p className="max-w-xl text-sm leading-relaxed">{voiceRes.data.voice}</p>
            </Section>
          )}
        </div>

        {/* Kit downloads */}
        <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <div className="admin-card p-5">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-warmgrey">Brand kit</h3>
            <button
              type="button"
              className="btn btn-primary mb-3 w-full"
              disabled={busy === "zip"}
              onClick={async () => {
                setBusy("zip");
                try {
                  await downloadKitZip(brand, voiceRes.data?.voice ?? "");
                } catch {
                  toast.error("Couldn't build the kit");
                } finally {
                  setBusy(null);
                }
              }}
            >
              {busy === "zip" ? "Packing…" : "↓ Download full brand kit (.zip)"}
            </button>
            <div className="space-y-2">
              {isWordmark && (
                <KitButton label="Wordmark logo (SVG)" onClick={() => download(`${slug}-logo.svg`, wordmarkSvg(brand), "image/svg+xml")} />
              )}
              <KitButton label="Favicon (SVG)" onClick={() => download(`${slug}-favicon.svg`, faviconSvg(brand.name, p), "image/svg+xml")} />
              <KitButton label="Colour palette (.txt)" onClick={() => download(`${slug}-palette.txt`, paletteText(brand.name, p))} />
              <KitButton label="Brand guidelines (PDF)" onClick={openGuidelines} />
            </div>
          </div>

          <div className="admin-card p-5">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-warmgrey">Social images</h3>
            <div className="space-y-2">
              <KitButton label="Profile avatar · 1000×1000" busy={busy === "avatar"} onClick={() => void exportSocial("avatar")} />
              <KitButton label="Banner · 1500×500" busy={busy === "banner"} onClick={() => void exportSocial("banner")} />
              <KitButton label="Link / OG card · 1200×630" busy={busy === "og"} onClick={() => void exportSocial("og")} />
            </div>
            <p className="mt-2 text-[11px] text-warmgrey">PNG images in your brand colours, sized per platform.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ label, accent, children }: { label: string; accent: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="mb-3 border-b border-ink/10 pb-1.5 text-[11px] uppercase tracking-editorial" style={{ color: accent }}>
        {label}
      </p>
      {children}
    </section>
  );
}

function KitButton({ label, onClick, busy }: { label: string; onClick: () => void; busy?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="flex w-full items-center justify-between rounded-md border border-ink/15 px-3 py-2 text-left text-sm hover:border-navy disabled:opacity-50"
    >
      <span>{label}</span>
      <span className="text-warmgrey">{busy ? "…" : "↓"}</span>
    </button>
  );
}
