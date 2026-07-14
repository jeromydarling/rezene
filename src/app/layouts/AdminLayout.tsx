import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from "react-router";
import {
  Activity,
  Zap,
  BookUser,
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
  FolderOpen,
  Gauge,
  TriangleAlert,
  Images,
  Landmark,
  LayoutDashboard,
  Megaphone,
  Clapperboard,
  UsersRound,
  ChevronRight,
  LifeBuoy,
  Upload,
  Compass,
  Globe,
  Layers,
  Newspaper,
  MessagesSquare,
  Package,
  Palette,
  Percent,
  PencilRuler,
  PersonStanding,
  Rocket,
  Rotate3d,
  Ruler,
  Scissors,
  SearchCheck,
  Settings,
  Shirt,
  ShoppingBag,
  Star,
  Store,
  Sparkles,
  Tags,
  TrendingUp,
  Truck,
  Undo2,
  Users,
  GraduationCap,
  LibraryBig,
  Workflow,
  Cable,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { useBrand } from "../lib/brand";
import { BrandMark } from "../components/BrandMark";
import { getShop, isDemoShop } from "../lib/shop";
import { Companion } from "../components/Companion";

const NAV_SECTIONS: {
  title: string;
  superAdminOnly?: boolean;
  items: { to: string; label: string; icon: typeof Shirt }[];
}[] = [
  {
    title: "Overview",
    items: [
      { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
      { to: "/admin/launch", label: "Launch Playbook", icon: Rocket },
    ],
  },
  {
    title: "Catalog",
    items: [
      { to: "/admin/products", label: "Products", icon: ShoppingBag },
      { to: "/admin/styles", label: "Styles", icon: Shirt },
      { to: "/admin/skus", label: "SKUs", icon: Tags },
      { to: "/admin/collections", label: "Collections", icon: Layers },
      { to: "/admin/inventory", label: "Inventory", icon: Boxes },
      { to: "/admin/import", label: "Import studio", icon: Upload },
    ],
  },
  {
    title: "Content",
    items: [
      { to: "/admin/content/pages", label: "Pages", icon: BookOpen },
      { to: "/admin/content/journal", label: "Journal", icon: Newspaper },
      { to: "/admin/content/lookbooks", label: "Lookbooks", icon: Images },
      { to: "/admin/content/search", label: "Search Checkup", icon: SearchCheck },
    ],
  },
  {
    title: "Brand",
    items: [
      { to: "/admin/brand", label: "Brand Studio", icon: Palette },
      { to: "/admin/brand/print", label: "Print Shop", icon: FileText },
      { to: "/admin/brand/guidelines", label: "Guidelines & Kit", icon: BookOpen },
    ],
  },
  {
    title: "Marketing",
    items: [
      { to: "/admin/marketing", label: "Campaigns", icon: Megaphone },
      { to: "/admin/marketing/video", label: "Promo Video", icon: Clapperboard },
    ],
  },
  {
    title: "Commerce",
    items: [
      { to: "/admin/orders", label: "Orders", icon: Package },
      { to: "/admin/pre-orders", label: "Pre-orders", icon: Sparkles },
      { to: "/admin/discounts", label: "Discounts & Tax", icon: Percent },
      { to: "/admin/returns", label: "Returns", icon: Undo2 },
      { to: "/admin/reviews", label: "Reviews", icon: Star },
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
      { to: "/admin/messages", label: "Maker Messages", icon: MessagesSquare },
      { to: "/admin/sourcing", label: "Find a Maker", icon: Compass },
      { to: "/admin/research", label: "R&D", icon: FlaskConical },
      { to: "/admin/materials", label: "Fabrics & Materials", icon: Scissors },
      { to: "/admin/samples", label: "Samples", icon: ClipboardList },
      { to: "/admin/purchase-orders", label: "Purchase Orders", icon: FileText },
    ],
  },
  {
    // The making tools, in workflow order: imagine it, see it on a body,
    // draft it, spec it for the maker.
    title: "Studio",
    items: [
      { to: "/admin/ai-concepts", label: "Design Studio", icon: Sparkles },
      { to: "/admin/fitting", label: "Fitting Studio", icon: PersonStanding },
      { to: "/admin/patterns", label: "Pattern Studio", icon: Ruler },
      { to: "/admin/drafting", label: "Drafting Room", icon: PencilRuler },
      { to: "/admin/3d", label: "3D Simulation", icon: Rotate3d },
      { to: "/admin/tech-packs", label: "Tech Packs", icon: FileBox },
    ],
  },
  {
    // The made-to-measure lane: the people you sew for.
    title: "Clients",
    items: [
      { to: "/admin/clients", label: "Client Book", icon: BookUser },
      { to: "/admin/commissions", label: "Commissions", icon: ClipboardList },
    ],
  },
  {
    title: "Finance",
    items: [
      { to: "/admin/costing", label: "Costing & Margins", icon: CircleDollarSign },
      { to: "/admin/cash-flow", label: "Cash Flow", icon: TrendingUp },
      { to: "/admin/duties", label: "Duties & Landed Cost", icon: Landmark },
      { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
    ],
  },
  {
    // Learning and reference: the courses and the archive they teach from.
    title: "School & Library",
    items: [
      { to: "/admin/school", label: "Verto School", icon: GraduationCap },
      { to: "/admin/library", label: "Timeless Library", icon: LibraryBig },
    ],
  },
  {
    title: "System",
    items: [
      { to: "/admin/settings", label: "Settings", icon: Settings },
      { to: "/admin/automations", label: "Automations", icon: Zap },
      { to: "/admin/workflows", label: "Workflows", icon: Workflow },
      { to: "/admin/connect", label: "Connect apps", icon: Cable },
      { to: "/admin/files", label: "Files", icon: FolderOpen },
      { to: "/admin/domain", label: "Custom Domain", icon: Globe },
      { to: "/admin/team", label: "Team", icon: UsersRound },
      { to: "/admin/support", label: "Help & Support", icon: LifeBuoy },
    ],
  },
  {
    title: "Verto HQ",
    superAdminOnly: true,
    items: [
      { to: "/admin/crm", label: "Customers", icon: HeartHandshake },
      { to: "/admin/crm/atlas", label: "Atlas", icon: Map },
      { to: "/admin/feedback", label: "Support tickets", icon: LifeBuoy },
      { to: "/admin/platform", label: "Verto Shops", icon: Store },
      { to: "/admin/shop-progress", label: "Shop Progress", icon: Rocket },
      { to: "/admin/activity", label: "Fleet Activity", icon: Activity },
      { to: "/admin/revenue", label: "Fleet Revenue", icon: CircleDollarSign },
      { to: "/admin/ai-usage", label: "AI Usage", icon: Gauge },
      { to: "/admin/errors", label: "Errors", icon: TriangleAlert },
    ],
  },
];

/** Platform HQ routes — the only admin surface at bare verto.style/admin. */
const HQ_PREFIXES = ["/admin/crm", "/admin/feedback", "/admin/platform", "/admin/shop-progress", "/admin/activity", "/admin/revenue", "/admin/ai-usage", "/admin/errors"];

function visibleSections(platformMode: boolean) {
  // Verto HQ lives at bare verto.style/admin (platform context, SuperAdmin
  // sessions in the platform database). Shop admins — including the
  // founder's own shop — never show HQ: every shop is a normal tenant.
  return NAV_SECTIONS.filter((s) => (platformMode ? s.superAdminOnly : !s.superAdminOnly));
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

  // Bare verto.style/admin (no shop in the URL) is the platform HQ; a shop's
  // admin always carries its shop context. Mirrors the worker's tenant rule.
  const platformMode = !getShop();
  // Unread maker replies — a badge on the nav so new mail is visible anywhere.
  // Refetch on every route change (opening a thread marks it read server-side).
  const [makerUnread, setMakerUnread] = useState(0);
  useEffect(() => {
    let live = true;
    fetch("/api/admin/messages/unread", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { count: 0 }))
      .then((d: { count?: number }) => {
        if (live) setMakerUnread(Number(d?.count) || 0);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [location.pathname]);
  // Collapsible nav — closed by default, active section auto-opens, choices persist.
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem("verto_nav_open") || "{}") as Record<string, boolean>;
    } catch {
      return {};
    }
  });
  const toggleSection = (title: string, active: boolean) => {
    setOpenSections((s) => {
      const current = s[title] ?? active;
      const next = { ...s, [title]: !current };
      try {
        localStorage.setItem("verto_nav_open", JSON.stringify(next));
      } catch {
        /* private mode — non-fatal */
      }
      return next;
    });
  };
  const matches = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return visibleSections(platformMode)
      .flatMap((s) => s.items)
      .filter((i) => i.label.toLowerCase().includes(q))
      .slice(0, 6);
  }, [query, platformMode]);

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
  // The platform HQ serves only HQ pages — everything else belongs to a shop.
  if (platformMode && !HQ_PREFIXES.some((p) => location.pathname.startsWith(p))) {
    return <Navigate to="/admin/crm" replace />;
  }

  const sidebar = (
    <>
      <Link to={platformMode ? "/admin/crm" : "/admin"} className="block border-b border-chalk/10 px-5 py-6">
        {platformMode ? (
          <p className="font-display text-2xl font-light text-chalk">Verto HQ</p>
        ) : (
          <BrandMark logo={brand.logo} palette={brand.palette} brandName={brand.brandName} onDark height={30} />
        )}
        <p className="mt-2 text-[0.58rem] uppercase tracking-editorial text-chalk/55">
          {platformMode ? "Platform operations" : "The Fashion Desk"}
        </p>
      </Link>
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {visibleSections(platformMode).map((section) => {
          const active = section.items.some(
            (i) => location.pathname === i.to || (i.to !== "/admin" && location.pathname.startsWith(i.to)),
          );
          const open = openSections[section.title] ?? active;
          return (
            <div key={section.title} className="mb-1.5">
              <button
                type="button"
                onClick={() => toggleSection(section.title, active)}
                className="flex w-full items-center justify-between rounded px-2 py-1.5 text-[0.62rem] font-semibold uppercase tracking-wider text-chalk/60 hover:text-chalk"
                aria-expanded={open}
              >
                <span>{section.title}</span>
                <ChevronRight size={13} className={`transition-transform ${open ? "rotate-90" : ""}`} />
              </button>
              {open && (
                <ul className="mb-3 mt-0.5 space-y-0.5">
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
                        <span className="flex-1">{item.label}</span>
                        {item.to === "/admin/messages" && makerUnread > 0 && (
                          <span className="rounded-full bg-terracotta px-1.5 py-0.5 text-[0.6rem] font-semibold leading-none text-chalk">
                            {makerUnread > 99 ? "99+" : makerUnread}
                          </span>
                        )}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </nav>
      <div className="border-t border-chalk/10 px-5 py-4">
        <p className="truncate text-xs text-chalk/70">{user.email}</p>
        <div className="mt-1 flex items-center justify-between">
          <p className="text-[0.65rem] uppercase tracking-wider text-chalk/60">
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
    <div className="flex min-h-screen bg-cream">
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
          <nav className="hidden text-[0.65rem] uppercase tracking-editorial text-warmgrey md:block">
            <Link to="/admin" className="text-ink/45 hover:text-ink">
              {brand.brandName}
            </Link>
            <span className="mx-2 text-ink/25">—</span>
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
        <main className="mx-auto w-full max-w-[1600px] flex-1 px-5 py-8 sm:px-7 lg:px-12 lg:py-10">
          <Outlet />
        </main>
      </div>
      <Companion />
    </div>
  );
}
