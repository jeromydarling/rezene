import { useMemo, useState } from "react";
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from "react-router";
import {
  BarChart3,
  Boxes,
  Calendar,
  CircleDollarSign,
  ClipboardList,
  Factory,
  FileBox,
  FileText,
  FlaskConical,
  Landmark,
  LayoutDashboard,
  Layers,
  Package,
  Rotate3d,
  Scissors,
  Settings,
  Shirt,
  ShoppingBag,
  Sparkles,
  Tags,
  Users,
} from "lucide-react";
import { useAuth } from "../lib/auth";

const NAV_SECTIONS: { title: string; items: { to: string; label: string; icon: typeof Shirt }[] }[] = [
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
    title: "Commerce",
    items: [
      { to: "/admin/orders", label: "Orders", icon: Package },
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
];

const ALL_ITEMS = NAV_SECTIONS.flatMap((s) => s.items);

export function AdminLayout() {
  const { user, loading, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const matches = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return ALL_ITEMS.filter((i) => i.label.toLowerCase().includes(q)).slice(0, 6);
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

  return (
    <div className="flex min-h-screen bg-cream/60">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 hidden w-60 flex-col border-r border-ink/10 bg-navy text-chalk lg:flex">
        <Link to="/admin" className="border-b border-chalk/10 px-5 py-5">
          <p className="font-display text-lg font-light">Maison Atlantique</p>
          <p className="text-[0.65rem] uppercase tracking-editorial text-chalk/50">
            Brand Operating System
          </p>
        </Link>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {NAV_SECTIONS.map((section) => (
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
                        `flex items-center gap-2.5 rounded px-2 py-1.5 text-[0.8rem] transition-colors ${
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
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
        <header className="sticky top-0 z-30 flex items-center gap-4 border-b border-ink/10 bg-white/95 px-5 py-3 backdrop-blur">
          <div className="text-xs uppercase tracking-wider text-warmgrey lg:hidden">
            <Link to="/admin" className="font-semibold text-ink">
              MA Admin
            </Link>
          </div>
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
