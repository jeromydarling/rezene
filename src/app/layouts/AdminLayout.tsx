import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from "react-router";
import {
  BarChart3,
  HeartHandshake,
  Map,
  Menu,
  X,
  BookOpen,
  Boxes,
  Calendar,
  CircleDollarSign,
  ClipboardList,
  Factory,
  FileBox,
  FileSpreadsheet,
  FileText,
  FlaskConical,
  Images,
  Landmark,
  LayoutDashboard,
  Megaphone,
  Layers,
  Newspaper,
  Package,
  Rotate3d,
  Scissors,
  Settings,
  Shirt,
  ShoppingBag,
  Store,
  Sparkles,
  Tags,
  Truck,
  Users,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { useBrand } from "../lib/brand";
import { isDemoShop, isPrimaryShop } from "../lib/shop";

const NAV_SECTIONS: {
  title: string;
  platformOnly?: boolean;
  items: { to: string; label: string; icon: typeof Shirt }[];
}[] = [
  {
    title: "Overview",
    items: [{ to: "/admin", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    title: "Catalog",
    items: [
      { to: "/admin/products", label: "Products", icon: ShoppingBag },
      { to: "/admin/styles", label: "Styles", icon: Shirt },
      { to: "/admin/skus", label: "SKUs", icon: Tags },
      { to: "/admin/collections", label: "Collections", icon: Layers },
      { to: "/admin/inventory", label: "Inventory", icon: Boxes },
    ],
  },
  {
    title: "Content",
    items: [
      { to: "/admin/content/pages", label: "Pages", icon: BookOpen },
      { to: "/admin/content/journal", label: "Journal", icon: Newspaper },
      { to: "/admin/content/lookbooks", label: "Lookbooks", icon: Images },
    ],
  },
  {
    title: "Marketing",
    items: [{ to: "/admin/marketing", label: "Campaigns", icon: Megaphone }],
  },
  {
    title: "Commerce",
    items: [
      { to: "/admin/orders", label: "Orders", icon: Package },
      { to: "/admin/pre-orders", label: "Pre-orders", icon: Sparkles },
      { to: "/admin/shipping", label: "Shipping", icon: Truck },
      { to: "/admin/line-sheets", label: "Line Sheets", icon: FileSpreadsheet },
      { to: "/admin/customers", label: "Customers", icon: Users },
    ],
  },
  {
    title: "Production",
    items: [
      { to: "/admin/production", label: "Production Calendar", icon: Calendar },
      { to: "/admin/suppliers", label: "Factories & Suppliers", icon: Factory },
      { to: "/admin/materials", label: "Fabrics & Materials", icon: Scissors },
      { to: "/admin/samples", label: "Samples", icon: ClipboardList },
      { to: "/admin/purchase-orders", label: "Purchase Orders", icon: FileText },
    ],
  },
  {
    title: "Studio",
    items: [
      { to: "/admin/tech-packs", label: "Tech Packs", icon: FileBox },
      { to: "/admin/ai-concepts", label: "AI Concept Lab", icon: Sparkles },
      { to: "/admin/3d", label: "3D Simulation", icon: Rotate3d },
      { to: "/admin/files", label: "Files", icon: FlaskConical },
    ],
  },
  {
    title: "Finance",
    items: [
      { to: "/admin/costing", label: "Costing & Margins", icon: CircleDollarSign },
      { to: "/admin/duties", label: "Duties & Landed Cost", icon: Landmark },
      { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
    ],
  },
  {
    title: "System",
    items: [{ to: "/admin/settings", label: "Settings", icon: Settings }],
  },
  {
    title: "Verto HQ",
    platformOnly: true,
    items: [
      { to: "/admin/crm", label: "Customers", icon: HeartHandshake },
      { to: "/admin/crm/atlas", label: "Atlas", icon: Map },
      { to: "/admin/platform", label: "Verto Shops", icon: Store },
    ],
  },
];

function visibleSections() {
  return NAV_SECTIONS.filter((s) => !s.platformOnly || isPrimaryShop());
}

const ALL_ITEMS = NAV_SECTIONS.flatMap((s) => s.items);

export function AdminLayout() {
  const { user, loading, logout } = useAuth();
  const brand = useBrand();
  const location = useLocation();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  // Navigating always closes the drawer; a route change means the choice landed.
  useEffect(() => setMenuOpen(false), [location.pathname]);
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const matches = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return visibleSections()
      .flatMap((s) => s.items)
      .filter((i) => i.label.toLowerCase().includes(q))
      .slice(0, 6);
  }, [query]);

  const breadcrumb = useMemo(() => {
    const current = ALL_ITEMS.filter((i) => i.to !== "/admin").find((i) =>
      location.pathname.startsWith(i.to),
    );
    return current?.label ?? "Dashboard";
  }, [location.pathname]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <p className="eyebrow">Loading…</p>
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }

  const sidebar = (
    <>
      <Link to="/admin" className="block border-b border-chalk/10 px-5 py-5">
        <p className="font-display text-lg font-light">{brand.brandName}</p>
        <p className="text-[0.65rem] uppercase tracking-editorial text-chalk/50">
          Brand Operating System
        </p>
      </Link>
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {visibleSections().map((section) => (
          <div key={section.title} className="mb-5">
            <p className="mb-1.5 px-2 text-[0.62rem] font-semibold uppercase tracking-wider text-chalk/40">
              {section.title}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === "/admin"}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 rounded px-2 py-2 text-[0.8rem] transition-colors lg:py-1.5 ${
                        isActive
                          ? "bg-chalk/15 text-chalk"
                          : "text-chalk/65 hover:bg-chalk/8 hover:text-chalk"
                      }`
                    }
                  >
                    <item.icon size={15} strokeWidth={1.7} />
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-chalk/10 px-5 py-4">
        <p className="truncate text-xs text-chalk/70">{user.email}</p>
        <div className="mt-1 flex items-center justify-between">
          <p className="text-[0.65rem] uppercase tracking-wider text-chalk/40">
            {user.roles.join(", ") || "no role"}
          </p>
          <button
            type="button"
            onClick={() => void logout().then(() => navigate("/admin/login"))}
            className="text-[0.7rem] uppercase tracking-wider text-chalk/60 hover:text-chalk"
          >
            Sign out
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-cream/60">
      {/* Sidebar (desktop, static) */}
      <aside className="fixed inset-y-0 hidden w-60 flex-col border-r border-ink/10 bg-navy text-chalk lg:flex">
        {sidebar}
      </aside>

      {/* Sidebar (mobile, slide-over drawer) */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-navy-deep/50"
            onClick={() => setMenuOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-[19rem] max-w-[85vw] flex-col bg-navy text-chalk shadow-2xl">
            <button
              type="button"
              aria-label="Close menu"
              className="absolute right-3 top-4 rounded p-2 text-chalk/70 hover:text-chalk"
              onClick={() => setMenuOpen(false)}
            >
              <X size={18} />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
        {isDemoShop() && (
          <div className="bg-terracotta px-4 py-1.5 text-center text-xs text-chalk">
            You're touring the {brand.brandName} demo (read-only).{" "}
            <a href="/signup" className="font-semibold underline">
              Open your own shop →
            </a>
          </div>
        )}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-ink/10 bg-white/95 px-4 py-3 backdrop-blur sm:px-5">
          <button
            type="button"
            aria-label="Open menu"
            className="-ml-1 rounded p-1.5 text-ink/70 hover:bg-cream hover:text-ink lg:hidden"
            onClick={() => setMenuOpen(true)}
          >
            <Menu size={20} strokeWidth={1.8} />
          </button>
          <Link
            to="/admin"
            className="max-w-[9rem] truncate text-xs font-semibold uppercase tracking-wider text-ink lg:hidden"
          >
            {brand.brandName}
          </Link>
          <nav className="hidden text-xs text-warmgrey md:block">
            <Link to="/admin" className="hover:text-ink">
              Admin
            </Link>
            <span className="mx-1.5">/</span>
            <span className="text-ink">{breadcrumb}</span>
          </nav>
          <div className="relative ml-auto w-full max-w-xs">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Jump to module…"
              className="input !py-1.5 text-xs"
            />
            {matches.length > 0 && (
              <ul className="absolute inset-x-0 top-full z-40 mt-1 overflow-hidden rounded-md border border-ink/10 bg-white shadow-lg">
                {matches.map((m) => (
                  <li key={m.to}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-cream"
                      onClick={() => {
                        setQuery("");
                        navigate(m.to);
                      }}
                    >
                      <m.icon size={14} strokeWidth={1.7} className="text-warmgrey" />
                      {m.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </header>
        <main className="flex-1 px-5 py-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
