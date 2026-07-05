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
