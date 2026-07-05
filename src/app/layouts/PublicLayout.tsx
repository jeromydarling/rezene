import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import { ShoppingBag } from "lucide-react";
import { track } from "../lib/analytics";
import { useBrand } from "../lib/brand";
import { useCart } from "../lib/cart";
import { useLang } from "../lib/lang";
import { NewsletterForm } from "../components/LeadForm";

// Pre-fetch fallbacks — the live menus are data (Admin → Content → Pages).
const DEFAULT_NAV = [
  { href: "/products", label: "Shop" },
  { href: "/collections", label: "Collections" },
  { href: "/lookbook", label: "Lookbook" },
  { href: "/story", label: "Story" },
  { href: "/atelier", label: "Atelier" },
  { href: "/journal", label: "Journal" },
];

const DEFAULT_FOOTER = [
  { href: "/size-guide", label: "Size Guide" },
  { href: "/shipping-returns", label: "Shipping & Returns" },
  { href: "/stockists", label: "Stockists" },
  { href: "/contact", label: "Contact" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
];

function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { lang, setLang, languages, defaultLang } = useLang();
  if (languages.length < 2) return null;
  return (
    <select
      aria-label="Language"
      className={`bg-transparent text-[0.7rem] uppercase tracking-editorial text-ink/70 hover:text-ink ${className}`}
      value={lang || defaultLang}
      onChange={(e) => setLang(e.target.value)}
    >
      {languages.map((code) => (
        <option key={code} value={code}>
          {code.toUpperCase()}
        </option>
      ))}
    </select>
  );
}

export function PublicLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const brand = useBrand();
  const cart = useCart();
  const nav = brand.navigation?.header?.length ? brand.navigation.header : DEFAULT_NAV;
  const footerLinks = brand.navigation?.footer?.length ? brand.navigation.footer : DEFAULT_FOOTER;

  useEffect(() => {
    setMenuOpen(false);
    track("page_view");
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-ink/10 bg-chalk/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link to="/" className="font-display text-xl font-light tracking-wide">
            {brand.brandName}
          </Link>
          <nav className="hidden items-center gap-7 md:flex">
            {nav.map((item) => (
              <NavLink
                key={item.href}
                to={item.href}
                className={({ isActive }) =>
                  `text-[0.72rem] font-medium uppercase tracking-editorial transition-colors ${
                    isActive ? "text-terracotta" : "text-ink/70 hover:text-ink"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-4">
            <LanguageSwitcher className="hidden md:block" />
            <Link to="/cart" className="relative text-ink/70 hover:text-ink" aria-label="Cart">
              <ShoppingBag size={19} strokeWidth={1.6} />
              {cart.count > 0 && (
                <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-terracotta px-1 text-[0.6rem] font-semibold text-chalk">
                  {cart.count}
                </span>
              )}
            </Link>
            <button
              type="button"
              className="text-xs uppercase tracking-editorial md:hidden"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-label="Toggle menu"
            >
              {menuOpen ? "Close" : "Menu"}
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav className="border-t border-ink/10 px-5 py-4 md:hidden">
            <ul className="space-y-3">
              {[...nav, ...footerLinks].map((item) => (
                <li key={item.href}>
                  <Link to={item.href} className="text-sm uppercase tracking-editorial text-ink/80">
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <LanguageSwitcher />
              </li>
            </ul>
          </nav>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-ink/10 bg-navy text-chalk">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 md:grid-cols-3">
          <div className="space-y-3">
            <p className="font-display text-lg font-light">{brand.brandName}</p>
            <p className="text-sm leading-relaxed text-chalk/70">
              {brand.tagline} Old-world craft, Atlantic light, modern ease.
            </p>
          </div>
          <div>
            <p className="eyebrow mb-4 !text-chalk/50">Concierge</p>
            <ul className="space-y-2">
              {footerLinks.map((item) => (
                <li key={item.href}>
                  <Link to={item.href} className="text-sm text-chalk/80 hover:text-chalk">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="eyebrow mb-4 !text-chalk/50">The First Drop</p>
            <p className="mb-3 text-sm text-chalk/70">
              Join the waitlist for the Atlantic Riviera collection.
            </p>
            <NewsletterForm kind="waitlist" dark />
          </div>
        </div>
        <div className="border-t border-chalk/10 px-5 py-4 text-center text-xs text-chalk/50">
          © {new Date().getFullYear()} {brand.brandName} · Produced in Casablanca, Morocco
        </div>
      </footer>
    </div>
  );
}
