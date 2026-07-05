import { createContext, useContext, useState, type ReactNode } from "react";
import { useBrand } from "./brand";

/**
 * Storefront language choice. Lightweight by design: the site chrome stays
 * in the default language; CMS content (pages, journal) is fetched with a
 * ?lang= param and machine-translated server-side (Workers AI, cached).
 */
const LangContext = createContext<{ lang: string; setLang: (lang: string) => void }>({
  lang: "",
  setLang: () => {},
});

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<string>(() => {
    try {
      return localStorage.getItem("site_lang") ?? "";
    } catch {
      return "";
    }
  });
  const setLang = (next: string) => {
    try {
      localStorage.setItem("site_lang", next);
    } catch {
      /* private mode */
    }
    setLangState(next);
  };
  return <LangContext.Provider value={{ lang, setLang }}>{children}</LangContext.Provider>;
}

/** The active language ('' = site default) and available options. */
export function useLang(): { lang: string; setLang: (lang: string) => void; languages: string[]; defaultLang: string } {
  const { lang, setLang } = useContext(LangContext);
  const brand = useBrand();
  const languages = brand.languages && brand.languages.length > 0 ? brand.languages : ["en"];
  return { lang, setLang, languages, defaultLang: languages[0] };
}

/** Query-string fragment for content fetches ('' when on the default language). */
export function langParam(lang: string, defaultLang: string): string {
  return lang && lang !== defaultLang ? `lang=${encodeURIComponent(lang)}` : "";
}
