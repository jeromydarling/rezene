import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { MagneticButton, Reveal, StaggerWords } from "./cinema";
import { DEMO_SHOP_BASE } from "../lib/shop";

/**
 * /features — the full tour. Every module gets the same treatment: the
 * claim in words on one side, the actual interface on the other, rendered
 * live as a miniature React screen inside a chromeless browser frame.
 * Mini-screens are decorative (pointer-events-none, aria-hidden) — the
 * real thing is one click away in the demo admin.
 */

// ---------- The chromeless browser ----------
function BrowserFrame({ url, children }: { url: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-ink/10 bg-white shadow-[0_30px_70px_-32px_rgba(20,29,49,0.45)]">
      <div className="flex items-center gap-1.5 border-b border-ink/10 bg-cream/80 px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-[#f27367]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#f2b544]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#5fb56f]" />
        <span className="ml-2 min-w-0 flex-1 truncate rounded-full bg-white px-3 py-1 text-[10px] text-warmgrey ring-1 ring-ink/10">
          {url}
        </span>
      </div>
      <div className="pointer-events-none select-none" aria-hidden>
        {children}
      </div>
    </div>
  );
}

/** Tiny admin shell: icon rail + content, so frames read as "the app". */
function MiniShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex bg-cream/50">
      <div className="hidden w-9 shrink-0 flex-col items-center gap-2 bg-navy py-3 sm:flex">
        <span className="mb-1 font-display text-[11px] font-light text-chalk">M</span>
        {[...Array(6)].map((_, i) => (
          <span key={i} className={`h-4 w-4 rounded ${i === 0 ? "bg-chalk/30" : "bg-chalk/10"}`} />
        ))}
      </div>
      <div className="min-w-0 flex-1 p-3">
        <p className="mb-2 text-[9px] font-semibold uppercase tracking-wider text-warmgrey">{title}</p>
        {children}
      </div>
    </div>
  );
}

const badge = (tone: string) => `inline-block rounded-full px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide ${tone}`;

// ---------- Mini screens, one per module ----------

function MiniProduction() {
  const cols: [string, { t: string; sub: string; late?: boolean }[]][] = [
    ["To do", [
      { t: "Brief Atelier Coupe Cousu", sub: "Factory briefings" },
      { t: "Tangier proto sample", sub: "Sampling" },
    ]],
    ["In progress", [
      { t: "Spanish linen swatch book", sub: "Fabric sourcing" },
      { t: "Grade MA-M-TRS-001", sub: "Tech packs", late: true },
    ]],
    ["Done", [
      { t: "SS27 line plan", sub: "Brand" },
    ]],
  ];
  return (
    <MiniShell title="Production calendar — SS27">
      <div className="grid grid-cols-3 gap-1.5">
        {cols.map(([name, cards]) => (
          <div key={name} className="rounded bg-ink/5 p-1.5">
            <p className="mb-1 text-[8px] font-semibold uppercase tracking-wide text-warmgrey">{name}</p>
            <div className="space-y-1">
              {cards.map((card) => (
                <div key={card.t} className="rounded bg-white p-1.5 shadow-sm">
                  <p className="truncate text-[9px] font-medium text-ink">{card.t}</p>
                  <p className="truncate text-[8px] text-warmgrey">{card.sub}</p>
                  {card.late && <span className={badge("bg-terracotta/15 text-terracotta")}>late</span>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </MiniShell>
  );
}

function MiniTechPack() {
  return (
    <MiniShell title="Tech pack — Tangier Trouser · MA-M-TRS-001">
      <div className="rounded bg-white p-2 shadow-sm">
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-[9px] font-semibold text-ink">Measurements (cm) — base 32</p>
          <span className={badge("bg-navy/10 text-navy")}>EN / FR</span>
        </div>
        <table className="w-full text-[8px]">
          <thead>
            <tr className="border-b border-ink/10 text-left text-warmgrey">
              <th className="py-0.5 pr-2">Point</th><th>30</th><th className="text-navy">32</th><th>34</th><th>36</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["Waist (relaxed)", "39", "41", "43", "45"],
              ["Front rise", "31", "31.5", "32", "32.5"],
              ["Inseam", "78", "78", "79", "79"],
            ].map((row) => (
              <tr key={row[0]} className="border-b border-ink/5">
                {row.map((cell, i) => (
                  <td key={i} className={`py-0.5 ${i === 0 ? "pr-2 font-medium text-ink" : i === 2 ? "text-navy" : "text-ink/70"}`}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-1.5 truncate text-[8px] italic text-warmgrey">
          Ceinture montée avec entoilage — pressage vapeur uniquement…
        </p>
      </div>
    </MiniShell>
  );
}

function MiniFactoryPortal() {
  return (
    <div className="bg-cream/50 p-3">
      <div className="mb-2 flex items-center justify-between rounded bg-navy px-2 py-1.5">
        <p className="text-[9px] font-medium text-chalk">Portail usine — Maison Atlantique</p>
        <span className={badge("bg-saffron/30 text-chalk")}>lien sécurisé</span>
      </div>
      <div className="space-y-1.5">
        {[
          ["Tangier Trouser — proto", "Éch. attendu 30 oct", "en cours"],
          ["Corniche Polo — BOM v2", "Confirmer fil 40/2", "à confirmer"],
        ].map(([t, sub, st]) => (
          <div key={t} className="flex items-center justify-between rounded bg-white p-2 shadow-sm">
            <div className="min-w-0">
              <p className="truncate text-[9px] font-medium text-ink">{t}</p>
              <p className="truncate text-[8px] text-warmgrey">{sub}</p>
            </div>
            <span className={badge("bg-navy/10 text-navy")}>{st}</span>
          </div>
        ))}
        <p className="text-center text-[8px] text-warmgrey">
          No login, no app — a tokenized link the factory opens in French or English.
        </p>
      </div>
    </div>
  );
}

function MiniShipping() {
  return (
    <MiniShell title="Order #1042 — quote carriers">
      <div className="space-y-1.5">
        {[
          { c: "DHL Express", d: "2–3 days", p: "$38.20", pick: true },
          { c: "Shippo · USPS Priority", d: "4–6 days", p: "$16.90" },
          { c: "Manual zone rate — EU", d: "5–8 days", p: "$24.00" },
        ].map((r) => (
          <div key={r.c} className={`flex items-center justify-between rounded p-2 shadow-sm ${r.pick ? "bg-navy text-chalk" : "bg-white"}`}>
            <div>
              <p className="text-[9px] font-medium">{r.c}</p>
              <p className={`text-[8px] ${r.pick ? "text-chalk/70" : "text-warmgrey"}`}>{r.d}</p>
            </div>
            <p className="text-[10px] font-semibold">{r.p}</p>
          </div>
        ))}
        <div className="flex gap-1.5">
          <span className={badge("bg-palm/15 text-palm")}>CN22 ready</span>
          <span className={badge("bg-palm/15 text-palm")}>commercial invoice</span>
          <span className={badge("bg-saffron/20 text-bark")}>HS 6203.42</span>
        </div>
      </div>
    </MiniShell>
  );
}

function MiniCosting() {
  return (
    <MiniShell title="Cost sheet — Tangier Trouser → US">
      <div className="rounded bg-white p-2 shadow-sm">
        {[
          ["Fabric — Spanish linen", "$9.86"],
          ["CMT — Casablanca", "$11.40"],
          ["Duty (US, non-preferential)", "$3.72"],
          ["Freight + insurance", "$2.10"],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between border-b border-ink/5 py-0.5 text-[9px]">
            <span className="text-ink/80">{k}</span>
            <span className="font-medium text-ink">{v}</span>
          </div>
        ))}
        <div className="mt-1 flex justify-between text-[9px] font-semibold text-navy">
          <span>Landed → retail $195</span><span>72.1% margin</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink/10">
          <div className="h-1.5 w-[72%] rounded-full bg-palm" />
        </div>
      </div>
    </MiniShell>
  );
}

function MiniCms() {
  return (
    <MiniShell title="Homepage — block editor">
      <div className="space-y-1.5">
        {[
          { k: "HERO", body: "New season, new light. — SS27 · image: corniche dusk" },
          { k: "PRODUCT GRID", body: "Atlantic Riviera · 4 pieces" },
          { k: "EDITORIAL SPLIT", body: "Cut in Casablanca — atelier story" },
          { k: "NEWSLETTER", body: "First to the next drop" },
        ].map((b) => (
          <div key={b.k} className="flex items-center gap-2 rounded bg-white p-1.5 shadow-sm">
            <span className="text-[10px] text-ink/30">⋮⋮</span>
            <div className="min-w-0">
              <p className="text-[8px] font-semibold uppercase tracking-wide text-navy">{b.k}</p>
              <p className="truncate text-[8px] text-warmgrey">{b.body}</p>
            </div>
          </div>
        ))}
        <div className="flex gap-1.5">
          <span className={badge("bg-navy/10 text-navy")}>draft preview link</span>
          <span className={badge("bg-navy/10 text-navy")}>publish Fri 09:00</span>
          <span className={badge("bg-navy/10 text-navy")}>rev history</span>
        </div>
      </div>
    </MiniShell>
  );
}

function MiniSeoCheckup() {
  return (
    <MiniShell title="Search Checkup">
      <div className="space-y-1.5">
        {[
          { ok: true, t: "Product rich results published", sub: "price + availability schema on every piece" },
          { ok: true, t: "Sitemap current", sub: "rebuilt on every publish, submitted once" },
          { ok: true, t: "AI assistants indexed", sub: "llms.txt generated from your pages" },
          { ok: false, t: "2 pages missing a search description", sub: "✨ draft them in your voice" },
        ].map((r) => (
          <div key={r.t} className="flex items-start gap-2 rounded bg-white p-2 shadow-sm">
            <span className={`mt-0.5 text-[10px] ${r.ok ? "text-palm" : "text-saffron"}`}>{r.ok ? "✓" : "▲"}</span>
            <div className="min-w-0">
              <p className="truncate text-[9px] font-medium text-ink">{r.t}</p>
              <p className="truncate text-[8px] text-warmgrey">{r.sub}</p>
            </div>
          </div>
        ))}
        <div className="flex gap-1.5">
          <span className={badge("bg-navy/10 text-navy")}>canonical URLs</span>
          <span className={badge("bg-navy/10 text-navy")}>social previews</span>
          <span className={badge("bg-navy/10 text-navy")}>search console</span>
        </div>
      </div>
    </MiniShell>
  );
}

function MiniLookbook() {
  return (
    <MiniShell title="Lookbook — Atlantic Riviera">
      <div className="grid grid-cols-3 gap-1.5">
        {["from-sand/80 to-sand-deep/60", "from-cream to-sand/70", "from-sand-deep/50 to-bark/30"].map((g, i) => (
          <div key={i} className={`aspect-[3/4] rounded bg-gradient-to-br ${g} p-1`}>
            <p className="text-[7px] italic text-bark/60">Look {String(i + 1).padStart(2, "0")}</p>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex items-center justify-between rounded bg-white p-1.5 shadow-sm">
        <p className="truncate text-[8px] text-ink/80">Shop the look → Tangier Trouser · $195</p>
        <span className={badge("bg-palm/15 text-palm")}>linked</span>
      </div>
    </MiniShell>
  );
}

function MiniMarketing() {
  return (
    <MiniShell title="Campaign kit — SS27 drop">
      <div className="space-y-1.5">
        <div className="rounded bg-white p-2 shadow-sm">
          <div className="mb-0.5 flex items-center justify-between">
            <span className={badge("bg-terracotta/15 text-terracotta")}>instagram</span>
            <span className="text-[8px] text-warmgrey">in your brand voice</span>
          </div>
          <p className="text-[9px] leading-snug text-ink/85">
            Golden hour on the ramparts. The Tangier Trouser, cut high and honest, is back in
            cream. 150 pieces fund the run — then it's gone.
          </p>
        </div>
        <div className="rounded bg-white p-2 shadow-sm">
          <span className={badge("bg-navy/10 text-navy")}>email</span>
          <p className="mt-0.5 text-[9px] text-ink/85">Subject: The linen you waited for ships Friday</p>
        </div>
        <div className="flex gap-1.5">
          <span className={badge("bg-ink/8 text-ink/70")}>+ press release</span>
          <span className={badge("bg-ink/8 text-ink/70")}>+ ad copy</span>
          <span className={badge("bg-ink/8 text-ink/70")}>+ blog draft</span>
          <span className={badge("bg-ink/8 text-ink/70")}>+ calendar</span>
        </div>
      </div>
    </MiniShell>
  );
}

function MiniTranslations() {
  return (
    <div className="bg-cream/50 p-3">
      <div className="mb-1.5 flex justify-center gap-1">
        <span className="rounded-l bg-navy px-2 py-0.5 text-[8px] font-semibold text-chalk">EN</span>
        <span className="rounded-r bg-white px-2 py-0.5 text-[8px] font-semibold text-navy ring-1 ring-navy/30">FR</span>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <div className="rounded bg-white p-2 shadow-sm">
          <p className="text-[8px] font-semibold uppercase tracking-wide text-warmgrey">Shipping & returns</p>
          <p className="mt-0.5 text-[9px] leading-snug text-ink/85">
            Every piece ships tracked from our Casablanca atelier within 48 hours.
          </p>
        </div>
        <div className="rounded bg-white p-2 shadow-sm">
          <p className="text-[8px] font-semibold uppercase tracking-wide text-warmgrey">Expédition et retours</p>
          <p className="mt-0.5 text-[9px] leading-snug text-ink/85">
            Chaque pièce est expédiée avec suivi depuis notre atelier de Casablanca sous 48 h.
          </p>
        </div>
      </div>
      <p className="mt-1.5 text-center text-[8px] text-warmgrey">
        Storefront translations drafted on-demand and cached — flip languages with one toggle.
      </p>
    </div>
  );
}

function MiniWholesale() {
  return (
    <MiniShell title="Line sheet — SS27 wholesale">
      <div className="rounded bg-white p-2 shadow-sm">
        <table className="w-full text-[8px]">
          <thead>
            <tr className="border-b border-ink/10 text-left text-warmgrey">
              <th className="py-0.5">Style</th><th>MSRP</th><th>WSP</th><th>Min</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["Tangier Trouser", "$195", "$78", "6"],
              ["Corniche Polo", "$125", "$50", "8"],
              ["Saadia Maxi Dress", "$145", "$58", "6"],
            ].map((r) => (
              <tr key={r[0]} className="border-b border-ink/5">
                {r.map((c, i) => <td key={i} className={`py-0.5 ${i === 0 ? "font-medium text-ink" : "text-ink/70"}`}>{c}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-1.5 rounded bg-white p-2 shadow-sm">
        <div className="flex justify-between text-[8px]">
          <span className="font-semibold uppercase tracking-wide text-bark">Pre-order run</span>
          <span className="text-warmgrey">112 / 150 pieces</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink/10">
          <div className="h-1.5 w-[75%] rounded-full bg-saffron" />
        </div>
      </div>
    </MiniShell>
  );
}

function MiniAnalytics() {
  const bars = [34, 48, 41, 62, 55, 78, 91];
  return (
    <MiniShell title="Analytics — last 7 days">
      <div className="mb-1.5 grid grid-cols-3 gap-1.5">
        {[["Revenue", "$4,820"], ["Orders", "37"], ["Pre-orders", "112"]].map(([k, v]) => (
          <div key={k} className="rounded bg-white p-1.5 text-center shadow-sm">
            <p className="text-[8px] uppercase tracking-wide text-warmgrey">{k}</p>
            <p className="font-display text-[13px] text-navy">{v}</p>
          </div>
        ))}
      </div>
      <div className="flex h-14 items-end gap-1 rounded bg-white p-2 shadow-sm">
        {bars.map((h, i) => (
          <div key={i} className={`flex-1 rounded-t ${i === bars.length - 1 ? "bg-terracotta" : "bg-navy/25"}`} style={{ height: `${h}%` }} />
        ))}
      </div>
    </MiniShell>
  );
}

function MiniPlatform() {
  return (
    <div className="bg-navy p-3 font-mono text-[9px] leading-relaxed text-chalk/90">
      <p><span className="text-palm">$</span> verto open-shop "atlas-knits"</p>
      <p className="text-chalk/60">→ database provisioned · schema migrated</p>
      <p className="text-chalk/60">→ storefront live at verto.style/atlas-knits</p>
      <p className="text-chalk/60">→ admin credentials emailed · AI site starter ready</p>
      <p><span className="text-palm">✓</span> live in 4.2s — isolated database, custom domain ready</p>
    </div>
  );
}

// ---------- The tour ----------
interface Feature {
  id: string;
  eyebrow: string;
  heading: string;
  body: string;
  points: string[];
  screen: () => ReactNode;
  url: string;
}

const FEATURES: Feature[] = [
  {
    id: "production",
    eyebrow: "Make",
    heading: "A production calendar that speaks garment.",
    body: "Kanban, table, or timeline over the whole season: briefs, sampling, grading, bulk, QC. Every task knows its style, its factory, and its deadline.",
    points: ["Stages modeled on real apparel production", "Late work surfaces itself", "Linked to styles, samples, and purchase orders"],
    screen: MiniProduction,
    url: "verto.style/maison/admin/production",
  },
  {
    id: "techpacks",
    eyebrow: "Specify",
    heading: "Tech packs a factory can actually sew from.",
    body: "Measurement charts with grading rules, BOMs, construction notes in English and French, stitch specs, labels and packaging — versioned, exportable, shareable.",
    points: ["Size specs with base-size grading", "Bilingual construction notes", "One-click factory share links"],
    screen: MiniTechPack,
    url: "verto.style/maison/admin/tech-packs",
  },
  {
    id: "factory",
    eyebrow: "Collaborate",
    heading: "Factory portals with zero onboarding.",
    body: "Send a tokenized link; the atelier sees exactly what they need — briefs, tech packs, sample requests — in their language. No accounts, no PDFs rotting in inboxes.",
    points: ["Tokenized, revocable access", "French / English, per contact", "Sample feedback lands back in Verto"],
    screen: MiniFactoryPortal,
    url: "verto.style/maison/factory/f7c2…",
  },
  {
    id: "shipping",
    eyebrow: "Ship",
    heading: "Every carrier, one buy-a-label screen.",
    body: "DHL, Shippo, EasyPost, ShipEngine, Sendcloud, Easyship, or your own zone rates — quote them side by side, buy the label, and the customs paperwork writes itself.",
    points: ["Live multi-carrier quotes per order", "CN22 / commercial invoice generated", "HS codes carried from the tech pack"],
    screen: MiniShipping,
    url: "verto.style/maison/admin/orders/1042",
  },
  {
    id: "costing",
    eyebrow: "Price",
    heading: "Landed cost before you commit the run.",
    body: "Cost sheets that include the parts storefronts ignore: duty by destination and origin rules, freight, margin targets per channel. Know the margin before the fabric ships.",
    points: ["Duty rules by HS code and origin", "Scenario planning per destination", "Wholesale and DTC margin targets"],
    screen: MiniCosting,
    url: "verto.style/maison/admin/costing",
  },
  {
    id: "storefront",
    eyebrow: "Sell",
    heading: "A storefront composed like a magazine.",
    body: "Pages are stacks of typed blocks — heroes, product grids, editorial splits, FAQs — with drafts, scheduled publishing, revision history, and per-page SEO injected at the edge.",
    points: ["Block editor with layout presets", "Draft preview links + scheduling", "Edge-rendered meta, sitemap, canonical URLs"],
    screen: MiniCms,
    url: "verto.style/maison/admin/content/pages",
  },
  {
    id: "seo",
    eyebrow: "Be found",
    heading: "SEO that Shopify sells you in pieces.",
    body: "Product rich results, per-page tags and canonicals, social previews, self-updating sitemaps, alt-text tracking, an llms.txt index for AI assistants — and a Search Checkup screen in plain merchant language. On the big platforms this is three or four apps and a freelancer; here it ships in the box and updates itself on every publish.",
    points: [
      "Product schema with price & availability — rich-result eligible",
      "Search Checkup: findings + one-tap fixes, AI-drafted descriptions",
      "Ready for AI search: llms.txt + structured data by default",
    ],
    screen: MiniSeoCheckup,
    url: "verto.style/maison/admin/content/search",
  },
  {
    id: "lookbooks",
    eyebrow: "Show",
    heading: "Lookbooks and a journal, shoppable by design.",
    body: "Editorial imagery linked straight to pieces, a journal for the story between drops — the brand side most commerce platforms treat as an app to buy.",
    points: ["Looks link to products", "Journal with scheduled posts", "Media library with alt text"],
    screen: MiniLookbook,
    url: "verto.style/maison/admin/content/lookbooks",
  },
  {
    id: "marketing",
    eyebrow: "Tell",
    heading: "A marketing team in the software.",
    body: "Describe a campaign once; Verto writes the kit in your voice — social, email, press release, ad copy, blog draft — onto a content calendar you approve. Bring your own AI key or use the built-in model.",
    points: ["Whole-kit generation in your brand voice", "Content calendar + email sends", "Your Anthropic key, or built-in Llama"],
    screen: MiniMarketing,
    url: "verto.style/maison/admin/marketing",
  },
  {
    id: "translations",
    eyebrow: "Translate",
    heading: "A second language without a localization project.",
    body: "Flip on French (or any language) and the storefront translates itself on demand, caches the result, and lets you correct anything by hand.",
    points: ["On-demand AI translation, cached", "Hand-editable overrides", "Per-shop language list"],
    screen: MiniTranslations,
    url: "verto.style/maison?lang=fr",
  },
  {
    id: "wholesale",
    eyebrow: "Scale",
    heading: "Wholesale and pre-orders, first class.",
    body: "Shareable line sheets with wholesale pricing, and pre-order campaigns that fund production runs with live progress toward the factory minimum.",
    points: ["Line sheets from the same catalog", "Pre-orders tied to production goals", "Buyer inquiries land as leads"],
    screen: MiniWholesale,
    url: "verto.style/maison/admin/line-sheets",
  },
  {
    id: "analytics",
    eyebrow: "Learn",
    heading: "Numbers that answer a label's questions.",
    body: "Revenue, orders, pre-order momentum, best sellers versus most viewed — the gap between looks and sales is where the next drop hides.",
    points: ["Sales + product-view funnels", "Best sellers vs. most viewed", "Low-stock and tech-pack alerts"],
    screen: MiniAnalytics,
    url: "verto.style/maison/admin/analytics",
  },
  {
    id: "platform",
    eyebrow: "Own",
    heading: "Your shop, your database, live in seconds.",
    body: "Every Verto shop runs on its own isolated database at the edge — provisioned at signup, addressable at verto.style/your-name, ready for your own domain when you are.",
    points: ["Physically isolated per-shop data", "Instant provisioning at signup", "Custom domains via CNAME"],
    screen: MiniPlatform,
    url: "verto.style/signup",
  },
];

export function VertoFeatures() {
  const navigate = useNavigate();
  return (
    <div className="pt-24 md:pt-28">
      <div className="mx-auto max-w-6xl px-5 pb-24">
        <div className="mb-10 text-center">
          <Reveal>
            <p className="eyebrow mb-2">The full tour</p>
          </Reveal>
          <h1 className="display-hero mx-auto max-w-3xl text-4xl md:text-5xl">
            <StaggerWords text="Everything a label runs on. In one place." startDelay={150} step={70} />
          </h1>
          <Reveal delay={500}>
            <p className="prose-editorial mx-auto mt-4 max-w-2xl">
              Twelve modules, one database, zero copy-paste between tools. Every screen below is
              the real interface, miniaturized — and the{" "}
              <a href={`${DEMO_SHOP_BASE}/admin`} className="link-quiet">demo admin</a> is open if
              you want to drive.
            </p>
          </Reveal>
        </div>

        {/* Index: jump chips */}
        <Reveal delay={200}>
          <div className="mb-16 flex flex-wrap justify-center gap-2">
            {FEATURES.map((f) => (
              <a
                key={f.id}
                href={`#${f.id}`}
                className="rounded-full border border-ink/15 px-3 py-1 text-[0.68rem] font-medium uppercase tracking-wider text-ink/70 transition-colors hover:border-navy hover:text-navy"
              >
                {f.eyebrow}
              </a>
            ))}
          </div>
        </Reveal>

        {/* The tour */}
        <div className="space-y-20 md:space-y-28">
          {FEATURES.map((f, i) => (
            <section key={f.id} id={f.id} className="grid scroll-mt-24 items-center gap-8 md:grid-cols-2 md:gap-12">
              <div className={i % 2 === 1 ? "md:order-2" : ""}>
                <Reveal>
                  <p className="font-display text-4xl font-light text-ink/10">{String(i + 1).padStart(2, "0")}</p>
                </Reveal>
                <Reveal delay={100}>
                  <p className="eyebrow mb-2 mt-1">{f.eyebrow}</p>
                </Reveal>
                <Reveal delay={200}>
                  <h2 className="font-display text-2xl font-light md:text-3xl">{f.heading}</h2>
                </Reveal>
                <Reveal delay={300}>
                  <p className="prose-editorial mt-3 max-w-md">{f.body}</p>
                </Reveal>
                <Reveal delay={400}>
                  <ul className="mt-4 space-y-1.5">
                    {f.points.map((p) => (
                      <li key={p} className="flex items-baseline gap-2 text-sm text-ink/80">
                        <span className="text-palm">✓</span>
                        {p}
                      </li>
                    ))}
                  </ul>
                </Reveal>
              </div>
              <Reveal delay={250} className={i % 2 === 1 ? "md:order-1" : ""}>
                <BrowserFrame url={f.url}>{f.screen()}</BrowserFrame>
              </Reveal>
            </section>
          ))}
        </div>

        {/* Close */}
        <div className="mt-24 text-center">
          <Reveal>
            <h2 className="font-display text-3xl font-light md:text-4xl">
              Stop reading screenshots. Drive the real thing.
            </h2>
          </Reveal>
          <Reveal delay={150}>
            <p className="prose-editorial mx-auto mt-3 max-w-xl">
              The demo shop is a full fictional label — catalog, production calendar, tech packs,
              campaigns. Look at everything; break nothing.
            </p>
          </Reveal>
          <Reveal delay={300}>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <MagneticButton className="btn btn-primary" onClick={() => navigate("/signup")}>
                Open your shop
              </MagneticButton>
              <a href={`${DEMO_SHOP_BASE}/admin`} className="btn btn-secondary">
                Explore the demo admin
              </a>
            </div>
            <p className="mt-4 text-xs text-warmgrey">
              or <Link to="/pricing" className="link-quiet">see pricing</Link> ·{" "}
              <Link to="/compare" className="link-quiet">compare alternatives</Link>
            </p>
          </Reveal>
        </div>
      </div>
    </div>
  );
}
