import { Link, useNavigate } from "react-router";
import { MagneticButton, ParallaxImage, ParticleField, Reveal, StaggerWords } from "./cinema";

/**
 * /why — the argument. Feature pages say what; this page says why it has
 * to exist. Same cinematic grammar as the home journey: reveals pace the
 * argument, one pinned image anchors each act, stats land as set pieces.
 */

const STATS = [
  { value: "235,844", label: "clothing boutiques in the US alone", note: "growing 2.4% a year" },
  { value: "35,780", label: "independent designer businesses", note: "growing 5.6% a year" },
  { value: "$50K–$2M", label: "the annual-revenue band nobody builds for", note: "the missing middle" },
];

const FIVE_JOBS = [
  { job: "A storefront operator", tool: "…so you rent a generic website builder." },
  { job: "A production manager", tool: "…so you buy spreadsheets and WhatsApp threads with the factory." },
  { job: "A logistics desk", tool: "…so you juggle carrier portals and customs forms." },
  { job: "A content studio", tool: "…so you pay for a CMS that doesn't know what a lookbook is." },
  { job: "An ad agency", tool: "…so marketing happens at midnight, or not at all." },
];

const BELIEFS = [
  {
    heading: "Software should start in the workshop.",
    body: "Every 'fashion' platform starts at the shopping cart. But a label's real life is tech packs, samples, factory emails, and production calendars. If your software doesn't know what a size grade is, it isn't fashion software.",
  },
  {
    heading: "The middle deserves purpose-built tools.",
    body: "Enterprise PLM starts at hundreds of dollars a month plus a consulting project. Website builders top out at 'add product, sell product.' A label doing $200K a year is a real business — it deserves better than choosing between too much and too little.",
  },
  {
    heading: "AI should sound like you, not like AI.",
    body: "Generic AI writes generic brands. Verto learns your voice once and writes everything — campaigns, pages, translations, press — inside it. Every draft waits for your edit; nothing publishes itself.",
  },
  {
    heading: "One system, one truth.",
    body: "When the storefront, the production calendar, and the marketing calendar share a database, the drop date is one date. Most label chaos is just the same fact living in five tools.",
  },
];

export function VertoWhy() {
  const navigate = useNavigate();
  return (
    <>
      {/* Opening: the person, not the product. */}
      <section className="relative flex min-h-[85vh] items-end overflow-hidden bg-navy">
        <img
          src="/verto/wall.jpg"
          alt="A designer in high-waisted navy trousers against a sun-washed wall"
          fetchPriority="high"
          decoding="async"
          className="verto-kenburns absolute inset-0 h-full w-full object-cover object-top"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-navy-deep/90 via-navy-deep/30 to-transparent" />
        <ParticleField />
        <div className="relative mx-auto w-full max-w-6xl px-5 pb-20 pt-40">
          <Reveal>
            <p className="eyebrow mb-4 !text-chalk/70">Why Verto exists</p>
          </Reveal>
          <h1 className="display-hero max-w-3xl text-4xl !text-chalk md:text-6xl">
            <StaggerWords text="Fashion tech forgot the people who make fashion." startDelay={200} step={90} />
          </h1>
        </div>
      </section>

      {/* The problem, stated plainly. */}
      <section className="mx-auto max-w-3xl px-5 py-24">
        <Reveal>
          <p className="prose-editorial text-lg">
            The industry's software splits into two worlds. At one end, storefront builders: superb
            at taking payment, blind to everything that happens before the product photo — the
            sampling, the grading, the factory back-and-forth, the customs paperwork. At the other
            end, enterprise PLM and retail ERPs: built for brands with IT departments, priced like
            it, and implemented over quarters, not afternoons.
          </p>
        </Reveal>
        <Reveal delay={150}>
          <p className="prose-editorial mt-6 text-lg">
            In between sits almost the entire independent fashion world — and it's not a niche.
          </p>
        </Reveal>
      </section>

      {/* Stats as set pieces: three numbers that justify the company. */}
      <section className="border-y border-ink/10 bg-cream">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:grid-cols-3">
          {STATS.map((stat, i) => (
            <Reveal key={stat.value} delay={i * 130} className="text-center">
              <p className="font-display text-5xl font-light text-navy">{stat.value}</p>
              <p className="mt-2 text-sm">{stat.label}</p>
              <p className="mt-1 text-xs uppercase tracking-wider text-terracotta">{stat.note}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* The five jobs: the lived problem, revealed one burden at a time. */}
      <section className="mx-auto max-w-3xl px-5 py-24">
        <Reveal>
          <p className="eyebrow mb-3">The real problem</p>
        </Reveal>
        <Reveal delay={100}>
          <h2 className="font-display text-3xl font-light md:text-4xl">
            You wanted one job. You got five.
          </h2>
        </Reveal>
        <div className="mt-10 space-y-6">
          {FIVE_JOBS.map((item, i) => (
            <Reveal key={item.job} delay={i * 110}>
              <div className="flex items-baseline gap-4 border-b border-ink/10 pb-5">
                <span className="font-display text-2xl font-light text-ink/20">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <p className="font-medium">{item.job}</p>
                  <p className="text-sm text-warmgrey">{item.tool}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal delay={300}>
          <p className="prose-editorial mt-10 text-lg">
            Five subscriptions, five logins, five versions of the truth — stitched together with
            spreadsheets at midnight. That's not a workflow. That's a tax on making clothes.
          </p>
        </Reveal>
      </section>

      {/* The turn: image + answer. */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-24 md:grid-cols-2">
        <Reveal>
          <ParallaxImage
            src="/verto/atelier.jpg"
            alt="A tailor pressing a seam on cream linen trousers"
            speed={0.3}
            className="aspect-[3/4] max-h-[70vh]"
          />
        </Reveal>
        <div>
          <Reveal delay={150}>
            <p className="eyebrow mb-3">Our answer</p>
          </Reveal>
          <Reveal delay={250}>
            <h2 className="font-display text-3xl font-light md:text-4xl">
              One operating system, drawn around the way labels actually work.
            </h2>
          </Reveal>
          <Reveal delay={350}>
            <p className="prose-editorial mt-4">
              Verto holds the whole arc in one place: the tech pack and the storefront page, the
              factory portal and the Instagram caption, the customs code and the checkout. Change
              the drop date once and everything downstream already knows.
            </p>
          </Reveal>
          <Reveal delay={450}>
            <p className="prose-editorial mt-4">
              And because a five-person label can't hire a marketing department, Verto ships with
              one: AI that learns your voice and drafts your campaigns, pages, and press — for your
              edit, never on its own.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Beliefs: the principles that shape build decisions. */}
      <section className="bg-navy text-chalk">
        <div className="mx-auto max-w-6xl px-5 py-24">
          <Reveal>
            <p className="eyebrow mb-3 !text-chalk/50">What we believe</p>
          </Reveal>
          <div className="mt-8 grid gap-10 md:grid-cols-2">
            {BELIEFS.map((belief, i) => (
              <Reveal key={belief.heading} delay={i * 120}>
                <h3 className="font-display text-2xl font-light">{belief.heading}</h3>
                <p className="mt-3 text-sm leading-relaxed text-chalk/75">{belief.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Close. */}
      <section className="mx-auto max-w-3xl px-5 py-24 text-center">
        <Reveal>
          <h2 className="font-display text-3xl font-light md:text-4xl">
            The tools should carry the weight. You should carry the vision.
          </h2>
        </Reveal>
        <Reveal delay={200}>
          <div className="mt-9 flex justify-center gap-4">
            <MagneticButton className="btn btn-primary" onClick={() => navigate("/signup")}>
              Open your shop
            </MagneticButton>
            <Link to="/compare" className="btn btn-secondary">
              See how Verto compares
            </Link>
          </div>
        </Reveal>
      </section>
    </>
  );
}

/**
 * /compare — the honest matrix. Fairness is the persuasion strategy: each
 * alternative gets a "when it's the right choice" line, because a visitor
 * who trusts the concessions trusts the checkmarks.
 */

const MATRIX_ROWS: { label: string; verto: boolean; shopify: boolean; erp: boolean; patchwork: boolean }[] = [
  { label: "Storefront + checkout", verto: true, shopify: true, erp: false, patchwork: true },
  { label: "Editorial CMS (blocks, lookbooks, journal)", verto: true, shopify: false, erp: false, patchwork: false },
  { label: "Tech packs, samples, production calendar", verto: true, shopify: false, erp: true, patchwork: false },
  { label: "Factory portals (bilingual, tokenized)", verto: true, shopify: false, erp: false, patchwork: false },
  { label: "Multi-carrier shipping + customs docs", verto: true, shopify: false, erp: true, patchwork: false },
  { label: "Duties & landed-cost tooling", verto: true, shopify: false, erp: true, patchwork: false },
  { label: "Wholesale line sheets & pre-orders", verto: true, shopify: false, erp: true, patchwork: false },
  { label: "SEO suite built in (schema, sitemaps, AI-search index)", verto: true, shopify: false, erp: false, patchwork: false },
  { label: "AI marketing suite in your brand voice", verto: true, shopify: false, erp: false, patchwork: false },
  { label: "AI site starter (drafted in minutes)", verto: true, shopify: false, erp: false, patchwork: false },
  { label: "Storefront translations built in", verto: true, shopify: false, erp: false, patchwork: false },
  { label: "Live in an afternoon, no implementation project", verto: true, shopify: true, erp: false, patchwork: false },
];

const ALTERNATIVES = [
  {
    name: "Shopify & website builders",
    price: "From $39–$399/mo + apps",
    right: "You sell simple products and never touch production — a store is genuinely all you need.",
    gap: "Everything before the product photo — tech packs, sampling, factories, customs — lives somewhere else, and 'somewhere else' means app subscriptions and spreadsheets. Fashion-shaped features arrive only via a patchwork of third-party apps.",
  },
  {
    name: "Retail ERPs & PLM (Brightpearl-class)",
    price: "From ~$375/mo, quote-based",
    right: "You're past $2M with a team, an ops manager, and the patience for a months-long implementation.",
    gap: "Priced and shaped for enterprises: long onboarding, per-seat costs, and no brand side at all — no CMS, no lookbooks, no marketing. You'd still need a storefront platform on top.",
  },
  {
    name: "Fashion ops tools (Uphance-class)",
    price: "From ~$199/mo",
    right: "You need apparel ops (orders, inventory, B2B) and already have your brand presence handled elsewhere.",
    gap: "Strong on operations, thin on the brand: no editorial storefront, no content system, no marketing engine. The 'label OS' still ends up split across tools.",
  },
  {
    name: "The spreadsheet patchwork",
    price: "Free* (*paid in evenings)",
    right: "You're pre-launch and validating — honestly, this is fine for your first ten sales.",
    gap: "Five tools, five logins, five versions of the truth. Every drop is a manual migration between them, and none of it compounds.",
  },
];

function Mark({ yes }: { yes: boolean }) {
  return yes ? <span className="text-palm">✓</span> : <span className="text-ink/20">—</span>;
}

export function VertoCompare() {
  const navigate = useNavigate();
  return (
    <div className="pt-28">
      <div className="mx-auto max-w-6xl px-5 pb-24">
        <div className="mb-12 text-center">
          <Reveal>
            <p className="eyebrow mb-2">Verto vs. the alternatives</p>
          </Reveal>
          <Reveal delay={100}>
            <h1 className="display-hero text-4xl md:text-5xl">Pick the right tool. Even if it isn't ours.</h1>
          </Reveal>
          <Reveal delay={200}>
            <p className="prose-editorial mx-auto mt-4 max-w-2xl">
              Every alternative below is genuinely right for someone — we say who. Verto is for the
              label that makes its own clothes and is tired of running five systems to do it.
            </p>
          </Reveal>
        </div>

        {/* The matrix: scannable proof of the "whole label" claim. */}
        <p className="mb-2 text-center text-[0.65rem] uppercase tracking-wider text-warmgrey md:hidden">
          Swipe the table to compare →
        </p>
        <Reveal delay={250}>
          <div className="admin-card overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="border-b border-ink/10 text-left">
                  <th className="py-3 pr-4 font-medium">What a label needs</th>
                  <th className="px-3 py-3 text-center font-medium text-navy">Verto</th>
                  <th className="px-3 py-3 text-center font-medium text-warmgrey">Shopify</th>
                  <th className="px-3 py-3 text-center font-medium text-warmgrey">Retail ERP / PLM</th>
                  <th className="px-3 py-3 text-center font-medium text-warmgrey">Patchwork</th>
                </tr>
              </thead>
              <tbody>
                {MATRIX_ROWS.map((row) => (
                  <tr key={row.label} className="border-b border-ink/5">
                    <td className="py-2.5 pr-4">{row.label}</td>
                    <td className="px-3 py-2.5 text-center bg-navy/[0.03]">
                      <Mark yes={row.verto} />
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <Mark yes={row.shopify} />
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <Mark yes={row.erp} />
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <Mark yes={row.patchwork} />
                    </td>
                  </tr>
                ))}
                <tr>
                  <td className="py-3 pr-4 font-medium">Starting price</td>
                  <td className="px-3 py-3 text-center bg-navy/[0.03] font-medium text-navy">$29/mo</td>
                  <td className="px-3 py-3 text-center text-warmgrey">$39/mo + apps</td>
                  <td className="px-3 py-3 text-center text-warmgrey">~$375/mo+</td>
                  <td className="px-3 py-3 text-center text-warmgrey">5 × something</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Reveal>
        <p className="mt-3 text-xs text-warmgrey">
          Competitor pricing is their published list pricing as of mid-2026 — always verify current
          plans with each vendor. Category comparisons reflect built-in features, not app-store
          add-ons.
        </p>

        {/* Honest cards: concede the ground each alternative deserves. */}
        <div className="mt-16 grid gap-6 md:grid-cols-2">
          {ALTERNATIVES.map((alt, i) => (
            <Reveal key={alt.name} delay={i * 100}>
              <div className="flex h-full flex-col rounded-lg border border-ink/10 bg-white p-6">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="font-display text-xl font-light">{alt.name}</h2>
                  <p className="whitespace-nowrap text-xs text-warmgrey">{alt.price}</p>
                </div>
                <p className="mt-4 text-sm">
                  <span className="font-semibold text-palm">Right choice when:</span> {alt.right}
                </p>
                <p className="mt-3 text-sm text-warmgrey">
                  <span className="font-semibold text-ink/70">The gap:</span> {alt.gap}
                </p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={200}>
          <div className="mt-16 text-center">
            <p className="prose-editorial mx-auto max-w-xl">
              If you read all four and thought "none of these know what a size grade is" — that's
              the gap Verto was built for.
            </p>
            <div className="mt-8 flex justify-center gap-4">
              <MagneticButton className="btn btn-primary" onClick={() => navigate("/signup")}>
                Open your shop
              </MagneticButton>
              <Link to="/why" className="btn btn-secondary">
                Read why we built it
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
