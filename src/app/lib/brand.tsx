import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "./api";
import type { BrandSettings } from "../../shared/types";

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
};

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
        });
        if (settings.brandName) document.title = settings.brandName;
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
