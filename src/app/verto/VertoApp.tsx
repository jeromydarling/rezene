import { useEffect, useState, type FormEvent } from "react";
import { Link, NavLink, Route, Routes, useLocation } from "react-router";
import { api, ApiRequestError } from "../lib/api";

/**
 * Verto — the platform's own marketing site, served at the domain root.
 * Shops live at /<slug>; this app is what prospects see first.
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
    features: ["Storefront + full CMS", "AI content & site starter", "Manual shipping rates", "Email capture & campaigns"],
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
    features: ["Everything in Starter", "Full AI marketing suite", "Carrier shipping & labels", "Production & tech packs", "Wholesale line sheets"],
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

const FEATURES = [
  {
    title: "A storefront that reads like a magazine",
    body: "Block-composed pages, editorial layouts, lookbooks, a journal — with drafts, revisions, scheduling, and preview links. Your homepage is yours to rearrange.",
  },
  {
    title: "AI that writes like you",
    body: "Define your brand voice once. Then generate whole marketing campaigns — Instagram, TikTok scripts, email, press releases, ad copy — plus pages, posts, SEO metadata, and translations. Bring your own AI key or use ours.",
  },
  {
    title: "Production, not just products",
    body: "Styles, tech packs, samples, purchase orders, factory portals with bilingual sharing, a production calendar. Built for people who make clothes, not just sell them.",
  },
  {
    title: "Shipping that speaks carrier",
    body: "Connect DHL Express, Shippo, EasyPost, ShipEngine, Sendcloud, or Easyship — live rates at checkout, label purchase, customs paperwork, tracking webhooks. Or run simple flat rates.",
  },
  {
    title: "Sell wholesale too",
    body: "Tokenized line sheets with wholesale pricing, buyer inquiries, and pre-order campaigns that fund production runs with hard caps against overselling.",
  },
  {
    title: "Search engines see everything",
    body: "Per-page titles, descriptions, and social cards injected at the edge, plus sitemaps — the SEO plumbing most storefronts skip.",
  },
];

function VertoLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  useEffect(() => window.scrollTo(0, 0), [location.pathname]);
  return (
    <div className="flex min-h-screen flex-col bg-chalk">
      <header className="sticky top-0 z-40 border-b border-ink/10 bg-chalk/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link to="/" className="font-display text-xl font-light tracking-wide">
            Verto<span className="text-terracotta">.</span>
          </Link>
          <nav className="flex items-center gap-6">
            <NavLink
              to="/pricing"
              className={({ isActive }) =>
                `text-[0.72rem] font-medium uppercase tracking-editorial ${isActive ? "text-terracotta" : "text-ink/70 hover:text-ink"}`
              }
            >
              Pricing
            </NavLink>
            <a
              href="/rezene"
              className="hidden text-[0.72rem] font-medium uppercase tracking-editorial text-ink/70 hover:text-ink sm:block"
            >
              Live demo
            </a>
            <Link to="/signup" className="btn btn-primary !py-2 text-xs">
              Open your shop
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-ink/10 bg-navy text-chalk">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-10">
          <div>
            <p className="font-display text-lg font-light">Verto</p>
            <p className="text-xs text-chalk/60">The operating system for independent clothing labels.</p>
          </div>
          <div className="flex gap-6 text-xs text-chalk/70">
            <Link to="/pricing" className="hover:text-chalk">
              Pricing
            </Link>
            <a href="/rezene" className="hover:text-chalk">
              See a live shop
            </a>
            <Link to="/signup" className="hover:text-chalk">
              Sign up
            </Link>
          </div>
        </div>
        <div className="border-t border-chalk/10 px-5 py-4 text-center text-xs text-chalk/40">
          © {new Date().getFullYear()} Verto
        </div>
      </footer>
    </div>
  );
}

function VertoHome() {
  return (
    <>
      <section className="bg-gradient-to-b from-cream to-chalk">
        <div className="mx-auto max-w-6xl px-5 py-24 text-center md:py-32">
          <p className="eyebrow mb-6">For independent clothing labels</p>
          <h1 className="display-hero mx-auto max-w-4xl text-5xl md:text-7xl">
            Run the whole label from one place.
          </h1>
          <p className="prose-editorial mx-auto mt-6 max-w-2xl text-base">
            Storefront, CMS, production, shipping, wholesale, and an AI marketing team — purpose-built
            for brands that make clothes, from first sample to sold out. Too much brand for a template,
            too small for enterprise software? That's exactly who this is for.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link to="/signup" className="btn btn-primary">
              Open your shop
            </Link>
            <a href="/rezene" className="btn btn-secondary">
              Browse a live shop
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="mb-10 text-center">
          <p className="eyebrow mb-2">What's inside</p>
          <h2 className="font-display text-3xl font-light">Everything a label runs on</h2>
        </div>
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title}>
              <h3 className="font-display text-xl font-light">{f.title}</h3>
              <p className="prose-editorial mt-2 text-sm">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-navy text-chalk">
        <div className="mx-auto max-w-4xl px-5 py-20 text-center">
          <p className="eyebrow mb-3 !text-chalk/50">How it starts</p>
          <h2 className="font-display text-3xl font-light">Answer eight questions. Get a site.</h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-chalk/75">
            The site starter interviews you about your label — what you make, where, for whom — and
            drafts your story page, FAQ, press page, first journal post, homepage, and a brand voice
            the AI writes in from then on. You edit, you publish, you're live.
          </p>
          <Link to="/signup" className="btn mt-8 border-chalk/60 text-chalk hover:bg-chalk hover:text-navy">
            Reserve your shop address
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20 text-center">
        <p className="eyebrow mb-2">Simple pricing</p>
        <h2 className="font-display text-3xl font-light">From $29/month + a small fee on sales</h2>
        <p className="prose-editorial mx-auto mt-3 max-w-xl">
          Four plans that grow with your sales — the platform fee shrinks as your volume grows.
        </p>
        <Link to="/pricing" className="btn btn-secondary mt-8">
          See pricing
        </Link>
      </section>
    </>
  );
}

function VertoPricing() {
  const [annual, setAnnual] = useState(true);
  return (
    <div className="mx-auto max-w-6xl px-5 py-16">
      <div className="mb-10 text-center">
        <p className="eyebrow mb-2">Pricing</p>
        <h1 className="display-hero text-4xl md:text-5xl">Plans that grow with the label</h1>
        <p className="prose-editorial mx-auto mt-4 max-w-xl">
          Every plan includes the full platform. The application fee applies to sales processed
          through your shop and drops as you scale.
        </p>
        <div className="mt-6 inline-flex overflow-hidden rounded border border-ink/15">
          {[
            { key: true, label: "Annual (save ~25%)" },
            { key: false, label: "Monthly" },
          ].map((opt) => (
            <button
              key={String(opt.key)}
              type="button"
              onClick={() => setAnnual(opt.key)}
              className={`px-4 py-1.5 text-xs uppercase tracking-wider ${annual === opt.key ? "bg-navy text-chalk" : "bg-white text-ink/60"}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {TIERS.map((tier) => (
          <div
            key={tier.key}
            className={`flex flex-col rounded-lg border bg-white p-6 ${tier.featured ? "border-navy ring-1 ring-navy" : "border-ink/10"}`}
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
              className={`mt-6 w-full text-center ${tier.featured ? "btn btn-primary" : "btn btn-secondary"}`}
            >
              Start with {tier.name}
            </Link>
          </div>
        ))}
      </div>
      <p className="mt-8 text-center text-xs text-warmgrey">
        14-day free trial on every plan, no card required. Payment processing (Stripe) is billed
        separately by Stripe at their standard rates.
      </p>
    </div>
  );
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function VertoSignup() {
  const params = new URLSearchParams(useLocation().search);
  const [form, setForm] = useState({
    shopName: "",
    slug: "",
    email: "",
    plan: params.get("plan") ?? "label",
    note: "",
  });
  const [slugState, setSlugState] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

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
      const res = await api.post<{ slug: string }>("/api/verto/signup", {
        shopName: form.shopName,
        slug: form.slug,
        email: form.email,
        plan: form.plan,
        note: form.note || undefined,
      });
      setDone(res.slug);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Signup failed — try again");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-xl px-5 py-24 text-center">
        <p className="eyebrow mb-3">Reserved</p>
        <h1 className="display-hero text-4xl">
          verto.style<span className="text-terracotta">/{done}</span> is yours.
        </h1>
        <p className="prose-editorial mx-auto mt-5 max-w-md">
          We're onboarding labels in small batches while the platform is in early access. You'll get
          an email at <strong>{form.email}</strong> with your login as soon as your shop is
          provisioned — usually within a day.
        </p>
        <Link to="/" className="btn btn-secondary mt-8">
          Back to Verto
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-5 py-16">
      <div className="mb-8 text-center">
        <p className="eyebrow mb-2">Early access</p>
        <h1 className="display-hero text-4xl">Open your shop</h1>
        <p className="prose-editorial mx-auto mt-3">
          Reserve your address now — we provision shops in small batches during early access.
        </p>
      </div>
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
        <button type="submit" disabled={busy || slugState === "taken"} className="btn btn-primary w-full py-3">
          {busy ? "Reserving…" : "Reserve my shop"}
        </button>
        <p className="text-center text-xs text-warmgrey">
          No card required. 14-day trial starts when your shop is provisioned.
        </p>
      </form>
    </div>
  );
}

function VertoNotFound() {
  return (
    <div className="mx-auto max-w-xl px-5 py-32 text-center">
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
        <Route path="pricing" element={<VertoPricing />} />
        <Route path="signup" element={<VertoSignup />} />
        <Route path="*" element={<VertoNotFound />} />
      </Routes>
    </VertoLayout>
  );
}
