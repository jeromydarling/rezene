import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "./api";
import type { BrandSettings } from "../../shared/types";
import { faviconDataUri, typePairing } from "../../shared/brand-identity";

/**
 * Brand identity is data (admin Settings → brand), not code. This context
 * fetches /api/public/settings once and feeds every place the brand name
 * or tagline renders. The defaults below are only the pre-fetch fallback.
 */
const DEFAULT_BRAND: BrandSettings = {
  brandName: "Maison Atlantique",
  tagline: "Tailored resortwear, cut in Casablanca.",
  currency: "USD",
  homeHero: {
    eyebrow: "Casablanca · Atlantic Riviera · SS27",
    heading: "Dressed for the last hour of light.",
    subheading:
      "High-waisted linen tailoring and draped resortwear, cut in the ateliers of Casablanca. Old-world proportions, modern ease, honest cloth.",
    primaryCtaLabel: "Shop the collection",
    primaryCtaHref: "/products",
    secondaryCtaLabel: "Our story",
    secondaryCtaHref: "/story",
    imageUrl: null,
  },
  navigation: null,
  languages: ["en"],
  logo: null,
  palette: null,
  typography: null,
  vertoBadge: true,
};

/** Point the browser tab's icon at the brand's favicon (or a derived one). */
function setFavicon(href: string) {
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.href = href;
}

/** Load a brand type pairing's web fonts once (id-guarded), if it needs any. */
function loadBrandFonts(pairingKey: string | undefined) {
  const pairing = typePairing(pairingKey);
  if (!pairing.googleUrl) return; // bundled default → nothing to fetch
  const id = `brand-font-${pairing.key}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = pairing.googleUrl;
  document.head.appendChild(link);
}

const BrandContext = createContext<BrandSettings>(DEFAULT_BRAND);

export function BrandProvider({ children }: { children: ReactNode }) {
  const [brand, setBrand] = useState<BrandSettings>(DEFAULT_BRAND);

  useEffect(() => {
    api
      .get<BrandSettings>("/api/public/settings")
      .then((settings) => {
        setBrand({
          brandName: settings.brandName || DEFAULT_BRAND.brandName,
          tagline: settings.tagline || DEFAULT_BRAND.tagline,
          currency: settings.currency || DEFAULT_BRAND.currency,
          homeHero: settings.homeHero ?? DEFAULT_BRAND.homeHero,
          navigation: settings.navigation ?? null,
          languages:
            settings.languages && settings.languages.length > 0 ? settings.languages : ["en"],
          logo: settings.logo ?? null,
          palette: settings.palette ?? null,
          typography: settings.typography ?? null,
          vertoBadge: settings.vertoBadge !== false,
        });
        if (settings.brandName) document.title = settings.brandName;
        if (settings.typography?.pairing) loadBrandFonts(settings.typography.pairing);
        // Favicon: an explicit one if set, else derive initials-on-accent from
        // the palette so every shop has a distinct tab icon out of the box.
        const fav = settings.logo?.faviconUrl;
        if (fav) setFavicon(fav);
        else if (settings.palette && settings.brandName)
          setFavicon(faviconDataUri(settings.brandName, settings.palette));
      })
      .catch(() => {
        // Fallback brand already rendered; never block the page on this.
      });
  }, []);

  return <BrandContext.Provider value={brand}>{children}</BrandContext.Provider>;
}

export function useBrand(): BrandSettings {
  return useContext(BrandContext);
}
