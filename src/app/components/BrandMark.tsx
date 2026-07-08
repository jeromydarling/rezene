import type { CSSProperties } from "react";
import type { BrandLogo, BrandPalette, BrandTypography } from "../../shared/types";
import { applyCase, brandFont, brandInitials, logoImageFor, typePairing } from "../../shared/brand-identity";

/**
 * The one place a brand's logo renders — storefront header/footer, admin
 * sidebar, and the Brand Studio preview all use this so what a designer tunes
 * is exactly what ships. Order of preference: uploaded/generated image (with a
 * light-on-dark variant when the surface is dark) → a typeset wordmark → the
 * plain brand name. `onDark` picks the variant and text colour for dark
 * surfaces (nav bars, footers).
 */
export function BrandMark({
  logo,
  palette,
  brandName,
  onDark = false,
  className = "",
  height = 28,
}: {
  logo: BrandLogo | null | undefined;
  palette: BrandPalette | null | undefined;
  brandName: string;
  onDark?: boolean;
  className?: string;
  height?: number;
}) {
  const img = logoImageFor(logo, onDark);
  if (img) {
    return (
      <img
        src={img}
        alt={brandName}
        style={{ height, width: "auto" }}
        className={`inline-block object-contain ${className}`}
      />
    );
  }

  if (logo?.kind === "wordmark" && logo.wordmark) {
    const wm = logo.wordmark;
    const font = brandFont(wm.font);
    const text = applyCase(wm.text || brandName, wm.case);
    const color = onDark ? "#f7f4ee" : palette?.primary ?? "var(--color-navy)";
    return (
      <span className={`inline-flex items-center gap-2 ${className}`} style={{ color }}>
        {wm.monogram && (
          <span
            aria-hidden
            style={{
              fontFamily: font.stack,
              fontWeight: 600,
              fontSize: height * 0.62,
              lineHeight: 1,
              border: `1.5px solid currentColor`,
              borderRadius: 4,
              padding: "0.12em 0.28em",
            }}
          >
            {brandInitials(wm.text || brandName)}
          </span>
        )}
        <span
          style={{
            fontFamily: font.stack,
            fontWeight: wm.weight,
            letterSpacing: `${wm.tracking}em`,
            fontSize: height * 0.72,
            lineHeight: 1.05,
            borderBottom: wm.divider ? `1px solid currentColor` : undefined,
            paddingBottom: wm.divider ? "0.15em" : undefined,
            whiteSpace: "nowrap",
          }}
        >
          {text}
        </span>
      </span>
    );
  }

  // Fallback: the plain wordmark the app has always shown.
  return (
    <span
      className={`font-display font-light tracking-wide ${className}`}
      style={{ fontSize: height * 0.72, color: onDark ? "#f7f4ee" : palette?.primary ?? undefined }}
    >
      {brandName}
    </span>
  );
}

/**
 * Map a brand palette onto the app's Tailwind `@theme` tokens. Set the returned
 * style on a storefront container and every `bg-navy` / `text-terracotta` /
 * `bg-chalk` beneath it re-resolves to the brand's colours — no per-component
 * rewiring. Applied to the storefront only; the admin tool stays neutral.
 */
export function paletteVars(palette: BrandPalette | null | undefined): CSSProperties {
  if (!palette) return {};
  return {
    ["--color-navy" as string]: palette.primary,
    ["--color-navy-deep" as string]: palette.primary,
    ["--color-terracotta" as string]: palette.accent,
    ["--color-terracotta-deep" as string]: palette.accent,
    ["--color-ink" as string]: palette.ink,
    ["--color-chalk" as string]: palette.bg,
    ["--color-cream" as string]: palette.bg,
    ["--color-ivory" as string]: palette.bg,
  } as CSSProperties;
}

/** Override the storefront's display + body font tokens with the brand pairing.
 *  Merge onto the same container as paletteVars. */
export function typographyVars(typography: BrandTypography | null | undefined): CSSProperties {
  if (!typography?.pairing) return {};
  const p = typePairing(typography.pairing);
  return {
    ["--font-display" as string]: p.headingFamily,
    ["--font-sans" as string]: p.bodyFamily,
  } as CSSProperties;
}
