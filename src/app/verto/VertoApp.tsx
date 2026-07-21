import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, NavLink, Route, Routes, useLocation, useNavigate } from "react-router";
import { Menu, X } from "lucide-react";
import { api, ApiRequestError } from "../lib/api";
import { DEMO_SHOP_BASE } from "../lib/shop";
import {
  MagneticButton,
  ParallaxImage,
  ParticleField,
  Reveal,
  StaggerWords,
  TiltCard,
  Typewriter,
  useSceneProgress,
  useScrolledPast,
} from "./cinema";
import { VertoCompare, VertoWhy } from "./VertoStory";
import { VertoDirectory, VertoMakers } from "./VertoDirectory";
import { VertoJourneys } from "./VertoJourneys";
import { VertoFeatures } from "./VertoFeatures";
import { VertoFaq } from "./VertoFaq";
import { TESTIMONIALS } from "../../shared/testimonials";

/**
 * Verto — the platform's marketing site as a cinematic scroll journey.
 * Every motion decision is annotated with the job it does; anything that
 * couldn't justify itself was cut. All of it collapses gracefully under
 * prefers-reduced-motion.
 */

const TIERS = [
  {
    key: "starter",
    name: "Starter",
    monthly: 29,
    annual: 19,
    fee: "1.5%",
    gmv: "up to $10K/mo in sales",
    tagline: "Side projects and pre-launch labels",
    features: ["Storefront + full CMS", "LLM content & site starter", "Manual shipping rates", "Email capture & campaigns"],
  },
  {
    key: "label",
    name: "Label",
    monthly: 79,
    annual: 59,
    fee: "1.0%",
    gmv: "up to $50K/mo in sales",
    tagline: "Active indie labels selling DTC",
    featured: true,
    features: ["Everything in Starter", "Full LLM marketing suite", "Carrier shipping & labels", "Production & tech packs", "Wholesale line sheets"],
  },
  {
    key: "studio",
    name: "Studio",
    monthly: 179,
    annual: 139,
    fee: "0.75%",
    gmv: "up to $200K/mo in sales",
    tagline: "Multi-collection brands, DTC + wholesale",
    features: ["Everything in Label", "Multi-language storefront", "Factory portals", "Costing & landed-cost tools", "Priority support"],
  },
  {
    key: "house",
    name: "House",
    monthly: 399,
    annual: 299,
    fee: "0.5%",
    gmv: "unlimited",
    tagline: "Established labels, full teams",
    features: ["Everything in Studio", "Custom domain", "Unlimited seats", "Migration assistance"],
  },
];

// ---------- Layout: immersive nav ----------
// The nav starts transparent over the hero (the image is the statement;
// chrome would compete with it) and gains a frosted bar the moment the
// visitor scrolls — orientation appears exactly when it's needed.
const NAV_ITEMS = [
  { to: "/why", label: "Why" },
  { to: "/stories", label: "Stories" },
  { to: "/features", label: "Features" },
  { to: "/compare", label: "Compare" },
  { to: "/pricing", label: "Pricing" },
  { to: "/faq", label: "FAQ" },
];

function VertoLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const scrolled = useScrolledPast(60);
  const onHero = location.pathname === "/" && !scrolled;
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    window.scrollTo(0, 0);
    setMenuOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <div className="flex min-h-screen flex-col overflow-x-clip bg-chalk">
      <header
        className={`fixed inset-x-0 top-0 z-40 transition-all duration-500 ${
          onHero && !menuOpen ? "bg-transparent" : "border-b border-ink/10 bg-chalk/90 backdrop-blur"
        }`}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-5 sm:py-4">
          <Link
            to="/"
            className={`shrink-0 font-display text-xl font-light tracking-wide transition-colors duration-500 ${onHero && !menuOpen ? "text-chalk" : "text-ink"}`}
          >
            Verto<span className="text-terracotta">.</span>
          </Link>
          {/* Desktop nav */}
          <nav className="hidden items-center gap-6 md:flex">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `whitespace-nowrap text-[0.72rem] font-medium uppercase tracking-editorial transition-colors duration-500 ${
                    isActive ? "text-terracotta" : onHero ? "text-chalk/80 hover:text-chalk" : "text-ink/70 hover:text-ink"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
            <a
              href={DEMO_SHOP_BASE}
              className={`whitespace-nowrap text-[0.72rem] font-medium uppercase tracking-editorial transition-colors duration-500 ${
                onHero ? "text-chalk/80 hover:text-chalk" : "text-ink/70 hover:text-ink"
              }`}
            >
              Live demo
            </a>
            <Link to="/signup" className="btn btn-primary verto-sheen shrink-0 whitespace-nowrap !py-2 text-xs">
              Open your shop
            </Link>
          </nav>
          {/* Mobile: compact CTA + hamburger */}
          <div className="flex items-center gap-2 md:hidden">
            <Link to="/signup" className="btn btn-primary verto-sheen shrink-0 whitespace-nowrap !px-3.5 !py-2 text-xs">
              Open shop
            </Link>
            <button
              type="button"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              className={`rounded p-1.5 transition-colors duration-500 ${
                onHero && !menuOpen ? "text-chalk" : "text-ink"
              }`}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <Menu size={22} strokeWidth={1.6} />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu: a full-screen navy interlude — same editorial voice as
          the site itself, one destination per line. */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-navy-deep text-chalk md:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <Link to="/" className="font-display text-xl font-light" onClick={() => setMenuOpen(false)}>
              Verto<span className="text-terracotta">.</span>
            </Link>
            <button
              type="button"
              aria-label="Close menu"
              className="rounded p-1.5 text-chalk/80 hover:text-chalk"
              onClick={() => setMenuOpen(false)}
            >
              <X size={22} strokeWidth={1.6} />
            </button>
          </div>
          <nav className="flex flex-1 flex-col justify-center gap-1 px-8">
            {NAV_ITEMS.map((item, i) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `verto-route py-3 font-display text-3xl font-light ${
                    isActive ? "text-terracotta" : "text-chalk"
                  }`
                }
                style={{ animationDelay: `${i * 60}ms` }}
              >
                {item.label}
              </NavLink>
            ))}
            <a href={DEMO_SHOP_BASE} className="verto-route py-3 font-display text-3xl font-light text-chalk" style={{ animationDelay: "240ms" }}>
              Live demo
            </a>
          </nav>
          <div className="px-8 pb-12">
            <Link to="/signup" className="btn btn-primary w-full">
              Open your shop
            </Link>
          </div>
        </div>
      )}
      {/* Route transitions: a soft rise-in per page keeps navigation feeling
          like cuts in the same film rather than hard reloads. */}
      <main key={location.pathname} className="verto-route flex-1">
        {children}
      </main>
      <footer className="border-t border-ink/10 bg-navy text-chalk">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-10">
          <div>
            <p className="font-display text-lg font-light">Verto</p>
            <p className="text-xs text-chalk/60">The operating system for independent clothing labels.</p>
            <a
              href="https://thecros.app"
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 text-xs text-chalk/55 transition hover:text-chalk"
            >
              Part of the <span className="font-medium text-chalk/80">CROS</span> family of apps
              <span aria-hidden>↗</span>
            </a>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-chalk/70">
            <Link to="/why" className="hover:text-chalk">
              Why Verto
            </Link>
            <Link to="/directory" className="hover:text-chalk">
              Directory
            </Link>
            <Link to="/makers" className="hover:text-chalk">
              For makers
            </Link>
            <Link to="/compare" className="hover:text-chalk">
              Compare
            </Link>
            <Link to="/pricing" className="hover:text-chalk">
              Pricing
            </Link>
            <Link to="/faq" className="hover:text-chalk">
              FAQ
            </Link>
            <Link to="/changelog" className="hover:text-chalk">
              What's new
            </Link>
            <a href={DEMO_SHOP_BASE} className="hover:text-chalk">
              See a live shop
            </a>
            <a href="https://thecros.app" target="_blank" rel="noreferrer" className="hover:text-chalk">
              CROS
            </a>
            <Link to="/signup" className="hover:text-chalk">
              Sign up
            </Link>
          </div>
        </div>
        <div className="border-t border-chalk/10 px-5 py-4 text-center text-xs text-chalk/65">
          © {new Date().getFullYear()} Verto — a{" "}
          <a href="https://thecros.app" target="_blank" rel="noreferrer" className="underline decoration-chalk/30 underline-offset-2 hover:text-chalk">
            CROS
          </a>{" "}
          app
        </div>
      </footer>
    </div>
  );
}

// ---------- Act I: the hero ----------
// A slow push-in (Ken Burns) on a golden-hour Moroccan coast: the visitor
// arrives *inside* the world their brand could live in. Words set one at a
// time like a title card; drifting dust motes give the light physicality.
// One idea, one image, one action.
function Hero() {
  const navigate = useNavigate();
  return (
    <section className="relative flex min-h-screen items-end overflow-hidden bg-navy">
      <img
        src="/verto/hero.jpg"
        alt="Three friends in linen resortwear walking a sunlit rampart above the sea at golden hour"
        fetchPriority="high"
        decoding="async"
        className="verto-kenburns absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-navy-deep/90 via-navy-deep/30 to-transparent" />
      <ParticleField />
      <div className="relative mx-auto w-full max-w-6xl px-5 pb-24 pt-40 md:pb-32">
        <Reveal delay={0}>
          <p className="eyebrow mb-5 !text-chalk/70">For independent clothing labels</p>
        </Reveal>
        <h1 className="display-hero max-w-4xl text-5xl !text-chalk md:text-7xl">
          <StaggerWords text="Run the whole label from one place." startDelay={250} step={110} />
        </h1>
        <Reveal delay={1200}>
          <p className="prose-editorial mt-6 max-w-xl text-base !text-chalk/85">
            Design, production, storefront, and an AI marketing team in one system — so a fact you
            enter once is true everywhere, from first sample to sold out.
          </p>
        </Reveal>
        <Reveal delay={1450}>
          <div className="mt-9 flex flex-wrap gap-4">
            <MagneticButton className="btn btn-primary" onClick={() => navigate("/signup")}>
              Open your shop
            </MagneticButton>
            <a href={DEMO_SHOP_BASE} className="btn border-chalk/60 text-chalk hover:bg-chalk hover:text-navy">
              Browse a live shop
            </a>
          </div>
        </Reveal>
      </div>
      <div className="verto-scroll-cue absolute bottom-6 left-1/2 -translate-x-1/2 text-chalk/70" aria-hidden>
        ↓
      </div>
    </section>
  );
}

// ---------- Act II: the manifesto ----------
// A pinned scene where scrolling advances the argument line by line. The
// visitor's own thumb paces the problem statement — each line lands alone,
// which a static paragraph can never do.
const MANIFESTO = [
  { lead: "You started a label to make clothes.", tail: "" },
  { lead: "Instead you run a warehouse, a studio,", tail: "an ad agency, and a customs desk." },
  { lead: "Verto folds all of it into one place —", tail: "so you can go back to making clothes." },
];

function Manifesto() {
  const ref = useRef<HTMLElement>(null);
  const progress = useSceneProgress(ref);
  const active = Math.min(MANIFESTO.length - 1, Math.floor(progress * MANIFESTO.length));

  return (
    <section ref={ref} className="relative h-[190vh] bg-chalk md:h-[260vh]">
      <div className="sticky top-0 flex h-screen items-center">
        <div className="mx-auto w-full max-w-4xl px-5 text-center">
          {MANIFESTO.map((line, i) => (
            <p
              key={i}
              className="display-hero absolute inset-x-5 top-1/2 -translate-y-1/2 text-3xl transition-all duration-700 md:text-5xl"
              style={{
                opacity: active === i ? 1 : 0,
                transform: `translateY(${active === i ? "-50%" : active > i ? "-58%" : "-42%"})`,
              }}
              aria-hidden={active !== i}
            >
              {line.lead}
              {line.tail && (
                <>
                  <br />
                  <span className="text-warmgrey">{line.tail}</span>
                </>
              )}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------- Act III: feature scenes ----------
// Alternating image/text scenes with gentle parallax: the image drifts
// slower than the page (a dolly move), which reads as physical depth and
// keeps long-form scrolling from feeling flat. Copy reveals on arrival so
// each capability gets its own beat.
const SCENES = [
  {
    number: "01",
    image: "/verto/wall.jpg",
    alt: "A model in high-waisted navy trousers against a sun-washed Essaouira wall",
    eyebrow: "Design",
    heading: "Design the line — then see it worn.",
    body: "An LLM design studio generates looks that hold together and drafts a real sewing pattern for each. The Fitting Studio then tries any piece on a consistent roster of photoreal models — so you judge fit and styling before you cut a single sample.",
    side: "left",
  },
  {
    number: "02",
    image: "/verto/atelier.jpg",
    alt: "A tailor pressing a seam on cream linen trousers in a Moroccan riad",
    eyebrow: "Make",
    heading: "Production, not just products.",
    body: "Styles, tech packs, samples, purchase orders, bilingual factory portals, a production calendar. Verto starts where your clothes actually start — in the workshop.",
    side: "right",
  },
  {
    number: "03",
    image: "/verto/sell.jpg",
    alt: "A couple in warm-toned resortwear walking side by side at golden hour above the sea",
    eyebrow: "Sell",
    heading: "A storefront that reads like a magazine.",
    body: "Block-composed pages, editorial layouts, lookbooks, a journal — with drafts, scheduling, revision history, and per-page SEO injected at the edge. Wholesale line sheets and pre-order campaigns included.",
    side: "left",
  },
] as const;

function FeatureScenes() {
  return (
    <div className="bg-chalk">
      {SCENES.map((scene) => (
        <section key={scene.number} className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-24 md:grid-cols-2">
          {scene.side === "left" ? (
            <>
              <Reveal>
                <ParallaxImage src={scene.image} alt={scene.alt} speed={0.35} className="aspect-[3/4] max-h-[70vh]" />
              </Reveal>
              <SceneCopy scene={scene} />
            </>
          ) : (
            <>
              <SceneCopy scene={scene} />
              <Reveal>
                <ParallaxImage src={scene.image} alt={scene.alt} speed={0.35} className="aspect-[3/4] max-h-[70vh]" />
              </Reveal>
            </>
          )}
        </section>
      ))}
    </div>
  );
}

function SceneCopy({ scene }: { scene: (typeof SCENES)[number] }) {
  return (
    <div>
      <Reveal delay={150}>
        <p className="font-display text-5xl font-light text-ink/10">{scene.number}</p>
      </Reveal>
      <Reveal delay={250}>
        <p className="eyebrow mb-3 mt-2">{scene.eyebrow}</p>
      </Reveal>
      <Reveal delay={350}>
        <h2 className="font-display text-3xl font-light md:text-4xl">{scene.heading}</h2>
      </Reveal>
      <Reveal delay={450}>
        <p className="prose-editorial mt-4 max-w-md">{scene.body}</p>
      </Reveal>
    </div>
  );
}

// ---------- Act IV: the LLM moment ----------
// "LLM that writes like you" is the platform's boldest claim, so instead of
// asserting it, the section performs it: campaign copy composes itself,
// character by character, inside a mock caption card. Seeing the product's
// core loop is worth more than any adjective.
const TYPED_LINES = [
  "Golden hour on the ramparts. The Sahara Trouser, cut high and honest, is back in cream. 150 pieces fund the run — then it's gone.",
  "Subject: The linen you waited for ships Friday · We pressed the last seams this morning in the atelier…",
  "HOOK (0–3s): hands pressing a seam, steam rising. \"Nobody's factory looks like this anymore.\"",
];

function AiMoment() {
  return (
    <section className="relative overflow-hidden bg-navy text-chalk">
      <ParticleField className="opacity-60" />
      <div className="relative mx-auto max-w-5xl px-5 py-28">
        <Reveal>
          <p className="eyebrow mb-3 !text-chalk/50">The marketing team you don't have to hire</p>
        </Reveal>
        <Reveal delay={120}>
          <h2 className="font-display text-3xl font-light md:text-5xl">LLM that writes like you.</h2>
        </Reveal>
        <Reveal delay={240}>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-chalk/75">
            Define your brand voice once. Verto then drafts whole campaigns — Instagram, TikTok
            scripts, email, press releases, ad copy — plus pages, posts, SEO metadata, and
            translations. Bring your own LLM key, or use ours out of the box.
          </p>
        </Reveal>
        <Reveal delay={360}>
          <div className="mt-10 rounded-lg border border-chalk/15 bg-navy-deep/60 p-6 font-mono text-sm leading-relaxed text-chalk/90 md:p-8">
            <p className="mb-3 text-[0.65rem] uppercase tracking-wider text-chalk/40">
              campaign kit · generating
            </p>
            <Typewriter lines={TYPED_LINES} className="min-h-[5.5rem]" />
          </div>
        </Reveal>
        <Reveal delay={480}>
          <p className="mt-6 text-xs text-chalk/50">
            Every draft lands for your edit — nothing publishes itself.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

// ---------- Act V: proof + pricing teaser ----------
function CapabilityIndex() {
  const items = [
    "AI design studio & sewing patterns",
    "Virtual try-on on a model roster",
    "Block CMS & editorial layouts",
    "LLM campaign kits, 11 channels",
    "Site starter interview",
    "6 shipping carriers + customs",
    "Wholesale line sheets",
    "Pre-order campaigns",
    "Factory portals (EN/FR)",
    "Tech packs & costing",
    "Edge SEO & sitemaps",
    "Storefront translations",
    "Email marketing + unsubscribe",
    "Analytics & audit trail",
  ];
  return (
    <section className="mx-auto max-w-6xl px-5 py-24">
      <Reveal>
        <p className="eyebrow mb-2 text-center">The full index</p>
      </Reveal>
      <Reveal delay={100}>
        <h2 className="mb-10 text-center font-display text-3xl font-light">
          Everything a label runs on
        </h2>
      </Reveal>
      <ul className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item, i) => (
          <Reveal key={item} as="li" delay={i * 40} y={12}>
            <span className="flex items-baseline gap-3 border-b border-ink/10 pb-3 text-sm">
              <span className="text-terracotta">—</span> {item}
            </span>
          </Reveal>
        ))}
      </ul>
      <Reveal delay={300}>
        <div className="mt-12 text-center">
          <Link to="/pricing" className="btn btn-secondary verto-sheen">
            Plans from $29/month
          </Link>
        </div>
      </Reveal>
    </section>
  );
}

// ---------- Act VI: the closing shot ----------
// The journey ends where it began — on the coast, at dusk. The visitor has
// scrolled a full day of light; the CTA sits in the calm of the image with
// a magnetic pull. An ending, not a banner.
function ClosingShot() {
  const navigate = useNavigate();
  return (
    <section className="relative flex min-h-[80vh] items-center overflow-hidden bg-navy">
      <ParallaxImage
        src="/verto/dusk.jpg"
        alt="A couple walking the water line of an empty Atlantic beach at dusk"
        speed={0.25}
        className="absolute inset-0 h-full w-full"
      />
      <div className="absolute inset-0 bg-navy-deep/45" />
      <div className="relative mx-auto w-full max-w-4xl px-5 py-24 text-center">
        <Reveal>
          <h2 className="display-hero text-4xl !text-chalk md:text-6xl">
            Your label deserves an operating system.
          </h2>
        </Reveal>
        <Reveal delay={200}>
          <p className="prose-editorial mx-auto mt-5 max-w-md !text-chalk/85">
            Reserve your address, answer eight questions, and your site is drafted before your
            coffee cools.
          </p>
        </Reveal>
        <Reveal delay={350}>
          <div className="mt-9">
            <MagneticButton className="btn btn-primary !px-8 !py-3.5" onClick={() => navigate("/signup")}>
              Open your shop — it takes two minutes
            </MagneticButton>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function VertoHome() {
  return (
    <>
      <Hero />
      <Manifesto />
      <FeatureScenes />
      <AiMoment />
      <CapabilityIndex />
      <Testimonials />
      <ClosingShot />
    </>
  );
}

/**
 * Real customer voices. Renders nothing until src/shared/testimonials.ts holds
 * a real, attributable quote — at which point this section AND the Review
 * structured data on the home page light up together (Google requires the
 * review to be visible on the same page as the markup). Ready for growth.
 */
function Testimonials() {
  if (TESTIMONIALS.length === 0) return null;
  return (
    <section className="mx-auto max-w-5xl px-5 py-20">
      <Reveal>
        <p className="eyebrow mb-2 text-center">In their words</p>
      </Reveal>
      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {TESTIMONIALS.map((t, i) => (
          <Reveal key={t.name + i} delay={i * 80}>
            <figure className="h-full rounded-lg border border-ink/10 bg-white p-6">
              {typeof t.rating === "number" && (
                <div className="mb-2 text-terracotta" aria-label={`${t.rating} out of 5`}>
                  {"★".repeat(Math.round(t.rating))}
                  <span className="text-ink/20">{"★".repeat(5 - Math.round(t.rating))}</span>
                </div>
              )}
              <blockquote className="prose-editorial text-[0.95rem]">“{t.quote}”</blockquote>
              <figcaption className="mt-3 text-sm font-medium text-ink">
                {t.name}
                {t.role && <span className="font-normal text-warmgrey"> · {t.role}</span>}
              </figcaption>
            </figure>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

// ---------- Pricing ----------
// The replacement math. Every line is a real product's published list
// pricing (researched mid-2026) — the honest version of "we save you
// money" is an itemized receipt, not an adjective.
const STACK_ITEMS = [
  { item: "Store platform", tool: "Shopify Basic–Grow", cost: "$29–105" },
  { item: "Email marketing", tool: "Klaviyo, ~2,500 contacts", cost: "$60" },
  { item: "SEO apps", tool: "all-in-one + schema + llms.txt apps", cost: "$30–80" },
  { item: "Translations", tool: "Weglot / Langify", cost: "$17–32" },
  { item: "Reviews · size charts · pre-orders", tool: "three small apps", cost: "$30–50" },
  { item: "LLM copywriting", tool: "Copy.ai / Jasper", cost: "$29–69" },
  { item: "Social scheduling", tool: "Buffer / Later", cost: "$15–25" },
  { item: "Tech packs / PLM", tool: "Techpacker → Backbone, per seat", cost: "$70–398" },
  { item: "Production & inventory ops", tool: "ApparelMagic / Katana", cost: "$255–299" },
  { item: "Shipping labels + customs docs", tool: "ShipStation / Shippo", cost: "$15–30" },
  { item: "Wholesale portal", tool: "SparkLayer → NuORDER", cost: "$49–580" },
];

function StackYouReplace() {
  return (
    <section className="mt-20">
      <div className="mb-8 text-center">
        <Reveal>
          <p className="eyebrow mb-2">The honest math</p>
        </Reveal>
        <Reveal delay={100}>
          <h2 className="font-display text-3xl font-light md:text-4xl">What the patchwork costs</h2>
        </Reveal>
        <Reveal delay={200}>
          <p className="prose-editorial mx-auto mt-3 max-w-2xl">
            Every Verto module exists as a separate product somewhere. Here's what they charge —
            published list pricing, researched mid-2026.
          </p>
        </Reveal>
      </div>
      <div className="grid gap-5 lg:grid-cols-5">
        {/* The receipt */}
        <Reveal className="lg:col-span-3">
          <div className="admin-card h-full p-6">
            <ul className="divide-y divide-ink/5">
              {STACK_ITEMS.map((row) => (
                <li key={row.item} className="flex items-baseline gap-3 py-2 text-sm">
                  <span className="font-medium">{row.item}</span>
                  <span className="hidden flex-1 truncate text-xs text-warmgrey sm:block">{row.tool}</span>
                  <span className="ml-auto whitespace-nowrap text-ink/80">{row.cost}<span className="text-xs text-warmgrey">/mo</span></span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-baseline justify-between border-t border-ink/15 pt-3">
              <span className="text-sm font-semibold">Bought separately</span>
              <span className="font-display text-2xl font-light text-terracotta">$599–1,700<span className="text-sm text-warmgrey">/mo</span></span>
            </div>
            <p className="mt-2 text-xs text-warmgrey">
              Most labels don't buy every line — they run three or four of them (~$400–900/mo) and
              do the rest by hand at midnight. Add a freelancer to glue it together and small-brand
              retainers start around $500/mo for SEO alone.
            </p>
          </div>
        </Reveal>
        {/* The alternative */}
        <Reveal delay={150} className="lg:col-span-2">
          <div className="flex h-full flex-col justify-center rounded-lg bg-navy p-8 text-chalk">
            <p className="eyebrow !text-chalk/60">All of it, on Verto</p>
            <p className="mt-3 font-display text-5xl font-light">
              $19–199<span className="text-lg text-chalk/60">/mo</span>
            </p>
            <p className="mt-4 text-sm leading-relaxed text-chalk/80">
              One login, one database, every module above included on every plan. A label on
              Studio ($79) typically keeps <span className="font-semibold text-chalk">$5,000–10,000 a year</span> that
              the patchwork would have taken — before counting onboarding fees, per-seat charges,
              or the hours lost stitching five systems together.
            </p>
            <Link to="/signup" className="btn btn-primary verto-sheen mt-6 self-start !bg-terracotta">
              Keep the difference
            </Link>
          </div>
        </Reveal>
      </div>
      <p className="mt-4 text-center text-xs text-warmgrey">
        Competitor prices are their published list pricing as of mid-2026 — always verify current
        plans with each vendor. Some tools have free tiers with tight limits; ranges show entry
        paid tiers for a working label.
      </p>
    </section>
  );
}

function VertoPricing() {
  const [annual, setAnnual] = useState(true);
  return (
    <div className="mx-auto max-w-6xl px-5 pb-16 pt-28">
      <div className="mb-10 text-center">
        <Reveal>
          <p className="eyebrow mb-2">Pricing</p>
        </Reveal>
        <Reveal delay={100}>
          <h1 className="display-hero text-4xl md:text-5xl">Plans that grow with the label</h1>
        </Reveal>
        <Reveal delay={200}>
          <p className="prose-editorial mx-auto mt-4 max-w-xl">
            Every plan includes the full platform. The application fee applies to sales processed
            through your shop and drops as you scale.
          </p>
        </Reveal>
        <Reveal delay={280}>
          <div className="mt-6 inline-flex overflow-hidden rounded border border-ink/15">
            {[
              { key: true, label: "Annual (save ~25%)" },
              { key: false, label: "Monthly" },
            ].map((opt) => (
              <button
                key={String(opt.key)}
                type="button"
                onClick={() => setAnnual(opt.key)}
                className={`px-4 py-1.5 text-xs uppercase tracking-wider transition-colors ${annual === opt.key ? "bg-navy text-chalk" : "bg-white text-ink/60"}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </Reveal>
      </div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {TIERS.map((tier, i) => (
          <Reveal key={tier.key} delay={i * 90}>
            <TiltCard
              className={`flex h-full flex-col rounded-lg border bg-white p-6 ${tier.featured ? "border-navy shadow-lg ring-1 ring-navy" : "border-ink/10"}`}
            >
              {tier.featured && <p className="eyebrow mb-2 !text-terracotta">Most labels start here</p>}
              <h2 className="font-display text-2xl font-light">{tier.name}</h2>
              <p className="mt-1 text-xs text-warmgrey">{tier.tagline}</p>
              <p className="mt-4 font-display text-4xl font-light">
                ${annual ? tier.annual : tier.monthly}
                <span className="text-sm text-warmgrey">/mo</span>
              </p>
              <p className="mt-1 text-xs text-warmgrey">
                + {tier.fee} of sales · {tier.gmv}
              </p>
              <ul className="mt-5 flex-1 space-y-2 text-sm">
                {tier.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="text-palm">✓</span> {f}
                  </li>
                ))}
              </ul>
              <Link
                to={`/signup?plan=${tier.key}`}
                className={`verto-sheen mt-6 w-full text-center ${tier.featured ? "btn btn-primary" : "btn btn-secondary"}`}
              >
                Start with {tier.name}
              </Link>
            </TiltCard>
          </Reveal>
        ))}
      </div>
      <p className="mt-8 text-center text-xs text-warmgrey">
        14-day free trial on every plan, no card required. Payment processing (Stripe) is billed
        separately by Stripe at their standard rates.
      </p>
      <StackYouReplace />
    </div>
  );
}

// ---------- Signup (instant provisioning) ----------
function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

interface SignupResult {
  provisioned: boolean;
  slug: string;
  loginUrl?: string;
  adminEmail?: string;
  password?: string;
}

function VertoSignup() {
  const params = new URLSearchParams(useLocation().search);
  const [form, setForm] = useState({
    shopName: "",
    slug: "",
    email: "",
    plan: params.get("plan") ?? "label",
    note: "",
    website: "",
  });
  const [slugState, setSlugState] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<SignupResult | null>(null);
  const [copied, setCopied] = useState(false);

  async function checkSlug(slug: string) {
    if (slug.length < 2) return setSlugState("idle");
    setSlugState("checking");
    try {
      const res = await api.get<{ available: boolean }>(`/api/verto/slug-check?slug=${encodeURIComponent(slug)}`);
      setSlugState(res.available ? "available" : "taken");
    } catch {
      setSlugState("idle");
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // A referral link (verto.style/signup?ref=<shop>) credits both sides.
      const ref = new URLSearchParams(window.location.search).get("ref") || undefined;
      const res = await api.post<SignupResult>("/api/verto/signup", {
        shopName: form.shopName,
        slug: form.slug,
        email: form.email,
        plan: form.plan,
        note: form.note || undefined,
        website: form.website || undefined,
        ref,
      });
      setDone(res);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Signup failed — try again");
    } finally {
      setBusy(false);
    }
  }

  if (done?.provisioned) {
    return (
      <div className="mx-auto max-w-xl px-5 pb-24 pt-32 text-center">
        <Reveal>
          <p className="eyebrow mb-3">Your shop is live</p>
        </Reveal>
        <Reveal delay={120}>
          <h1 className="display-hero text-4xl">
            verto.style<span className="text-terracotta">/{done.slug}</span>
          </h1>
        </Reveal>
        <Reveal delay={240}>
          <div className="mx-auto mt-8 max-w-md rounded-lg border border-palm bg-palm/5 p-6 text-left">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-palm">
              Save these now — the password is shown only once
            </p>
            <div className="space-y-1 font-mono text-sm">
              <p>Admin: {done.loginUrl}</p>
              <p>Email: {done.adminEmail}</p>
              <p>Password: {done.password}</p>
            </div>
            <button
              type="button"
              className="btn btn-secondary mt-4 w-full"
              onClick={() => {
                void navigator.clipboard
                  .writeText(`Admin: ${done.loginUrl}\nEmail: ${done.adminEmail}\nPassword: ${done.password}`)
                  .then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  });
              }}
            >
              {copied ? "Copied ✓" : "Copy credentials"}
            </button>
          </div>
        </Reveal>
        <Reveal delay={360}>
          <div className="mt-8 flex justify-center gap-4">
            <a href={done.loginUrl} className="btn btn-primary verto-sheen">
              Go to your admin →
            </a>
            <a href={`/${done.slug}`} className="btn btn-secondary">
              See your storefront
            </a>
          </div>
        </Reveal>
        <Reveal delay={460}>
          <p className="prose-editorial mx-auto mt-6 max-w-md text-sm">
            First stop: Content → Pages → <strong>Site starter</strong> — eight questions and your
            story, FAQ, press page, and first post are drafted in your voice.
          </p>
          {form.website && (
            <p className="prose-editorial mx-auto mt-3 max-w-md text-sm">
              Already branded? Your site is queued in <strong>Brand → Brand Studio</strong> — one click
              imports your logo, colours, and fonts.
            </p>
          )}
        </Reveal>
      </div>
    );
  }

  if (done) {
    return (
      <div className="mx-auto max-w-xl px-5 pb-24 pt-32 text-center">
        <p className="eyebrow mb-3">Reserved</p>
        <h1 className="display-hero text-4xl">
          verto.style<span className="text-terracotta">/{done.slug}</span> is yours.
        </h1>
        <p className="prose-editorial mx-auto mt-5 max-w-md">
          Your shop is being prepared — you'll get an email at <strong>{form.email}</strong> with
          your login shortly.
        </p>
        <Link to="/" className="btn btn-secondary mt-8">
          Back to Verto
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-5 pb-16 pt-28">
      <div className="mb-8 text-center">
        <Reveal>
          <p className="eyebrow mb-2">Two minutes, start to storefront</p>
        </Reveal>
        <Reveal delay={100}>
          <h1 className="display-hero text-4xl">Open your shop</h1>
        </Reveal>
        <Reveal delay={200}>
          <p className="prose-editorial mx-auto mt-3">
            Pick your address and your shop is provisioned on the spot — admin login included.
          </p>
        </Reveal>
      </div>
      <Reveal delay={250}>
        <form onSubmit={submit} className="space-y-4 rounded-lg border border-ink/10 bg-white p-6">
          <div>
            <label className="label">Label name *</label>
            <input
              required
              className="input"
              value={form.shopName}
              onChange={(e) => {
                const shopName = e.target.value;
                const nextSlug = form.slug && form.slug !== slugify(form.shopName) ? form.slug : slugify(shopName);
                setForm({ ...form, shopName, slug: nextSlug });
                void checkSlug(nextSlug);
              }}
            />
          </div>
          <div>
            <label className="label">Shop address *</label>
            <div className="flex items-center gap-1">
              <span className="text-sm text-warmgrey">verto.style/</span>
              <input
                required
                className="input flex-1"
                value={form.slug}
                onChange={(e) => {
                  const slug = e.target.value.toLowerCase();
                  setForm({ ...form, slug });
                  void checkSlug(slug);
                }}
              />
            </div>
            {slugState === "available" && <p className="mt-1 text-xs text-palm">Available ✓</p>}
            {slugState === "taken" && <p className="mt-1 text-xs text-red-700">Taken — try another</p>}
          </div>
          <div>
            <label className="label">Email *</label>
            <input
              required
              type="email"
              className="input"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Current website (optional)</label>
            <input
              className="input"
              placeholder="yourlabel.com"
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
            />
            <p className="mt-1 text-xs text-warmgrey">
              Already have a brand? We'll queue a one-click import of your logo, colours, and fonts.
            </p>
          </div>
          <div>
            <label className="label">Plan</label>
            <select className="input" value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })}>
              {TIERS.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.name} — ${t.monthly}/mo + {t.fee} of sales
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Tell us about your label (optional)</label>
            <textarea
              rows={3}
              className="input"
              placeholder="What do you make? Where are you selling today?"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </div>
          {error && <p className="field-error">{error}</p>}
          <button
            type="submit"
            disabled={busy || slugState === "taken"}
            className="btn btn-primary verto-sheen w-full py-3"
          >
            {busy ? "Building your shop… (~10s)" : "Create my shop"}
          </button>
          <p className="text-center text-xs text-warmgrey">
            No card required. 14-day trial starts now.
          </p>
        </form>
      </Reveal>
    </div>
  );
}

// A living changelog — proof the product ships. Kept honest and specific;
// each entry is a real, shipped capability, newest first.
const CHANGELOG: { date: string; title: string; items: string[] }[] = [
  {
    date: "July 2026",
    title: "Get selling faster, and see where shops stall",
    items: [
      "New “Get Selling Fast” guide on the dashboard — a state-aware setup path that reads your real shop and walks you from a drafted brand to open for business.",
      "Honest setup status: order-confirmation email now shows whether it's actually sending, so nothing silently no-ops.",
      "One-click data export for products, customers, orders, accounting and journal — your data is always yours to take.",
      "Sharper storefront reliability on mobile and a cleaner marketing message.",
    ],
  },
  {
    date: "July 2026",
    title: "The School, the Drafting Room & a bigger pattern library",
    items: [
      "The Verto School grew to nine twelve-lesson courses taught from the era's own masters, with certificates verified by real work.",
      "The Drafting Room: period drafting systems (Vincent trousers, Keystone vest, 1917 shirt-waist, circular cape) as working generators.",
      "The pattern catalogue expanded to 51 blocks, with “Draft it” mapping a described garment to the right block.",
    ],
  },
  {
    date: "June 2026",
    title: "Studios, fittings & the Companion",
    items: [
      "Design, Fitting, Pattern and 3D studios, with photoreal try-on and a green→red fit map.",
      "The Verto Companion — an assistant on every page, schooled on the whole manual, that can propose actions you confirm.",
      "The Timeless Library: the Met's open collection and early fashion magazines, searchable and pinnable with citations.",
    ],
  },
  {
    date: "Spring 2026",
    title: "The commerce & production backbone",
    items: [
      "Full commerce: checkout, discounts, tax, returns, reviews, wholesale, customer accounts and win-back automations.",
      "Production: tech packs a factory can build from, samples, size-run POs, costing with duties and landed cost.",
      "Your own domain, automated — point a CNAME and the certificate issues itself.",
    ],
  },
];

function VertoChangelog() {
  return (
    <div className="mx-auto max-w-3xl px-5 pb-32 pt-32 md:pt-40">
      <p className="eyebrow mb-3">What's new</p>
      <h1 className="display-hero text-4xl md:text-5xl">Verto is built in the open.</h1>
      <p className="prose-editorial mt-4 max-w-xl">
        We ship constantly, and we write it down. Here's what's landed lately — every entry is a
        real capability you can use today, not a roadmap promise.
      </p>
      <div className="mt-12 space-y-12">
        {CHANGELOG.map((entry, i) => (
          <div key={i} className="border-l-2 border-terracotta/30 pl-6">
            <p className="text-[0.66rem] font-medium uppercase tracking-editorial text-terracotta">
              {entry.date}
            </p>
            <h2 className="mt-1 font-display text-2xl font-light text-ink">{entry.title}</h2>
            <ul className="mt-3 space-y-2">
              {entry.items.map((it, j) => (
                <li key={j} className="flex gap-2.5 text-sm text-ink/80">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-terracotta/60" />
                  <span>{it}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mt-14 rounded-2xl border border-ink/10 bg-navy p-8 text-center text-chalk">
        <p className="font-display text-2xl font-light">Want this running your label?</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-chalk/80">
          Open a shop in two minutes — the setup guide takes it from there.
        </p>
        <Link to="/signup" className="btn btn-primary mt-6 inline-flex">
          Open your shop
        </Link>
      </div>
    </div>
  );
}

function VertoNotFound() {
  return (
    <div className="mx-auto max-w-xl px-5 pb-32 pt-40 text-center">
      <p className="eyebrow mb-4">404</p>
      <h1 className="display-hero text-4xl">No shop at this address.</h1>
      <p className="prose-editorial mt-4">It might still be available — want it?</p>
      <div className="mt-8 flex justify-center gap-4">
        <Link to="/signup" className="btn btn-primary">
          Claim this address
        </Link>
        <Link to="/" className="btn btn-secondary">
          Verto home
        </Link>
      </div>
    </div>
  );
}

export function VertoApp() {
  return (
    <VertoLayout>
      <Routes>
        <Route index element={<VertoHome />} />
        <Route path="why" element={<VertoWhy />} />
        <Route path="stories" element={<VertoJourneys />} />
        <Route path="features" element={<VertoFeatures />} />
        <Route path="compare" element={<VertoCompare />} />
        <Route path="pricing" element={<VertoPricing />} />
        <Route path="faq" element={<VertoFaq />} />
        <Route path="directory" element={<VertoDirectory />} />
        <Route path="makers" element={<VertoMakers />} />
        <Route path="signup" element={<VertoSignup />} />
        <Route path="changelog" element={<VertoChangelog />} />
        <Route path="*" element={<VertoNotFound />} />
      </Routes>
    </VertoLayout>
  );
}
