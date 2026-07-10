import { useEffect, useState, type ReactNode } from "react";
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

function MiniPatternStudio() {
  return (
    <MiniShell title="Pattern Studio — Button-down shirt · made-to-measure">
      <div className="flex gap-2">
        <div className="flex-1 rounded bg-white p-2 shadow-sm">
          <div className="flex h-24 items-end justify-center gap-1.5">
            {/* Stylized pattern pieces: front, back, sleeve, cuff */}
            <div className="h-20 w-9 rounded-t-[40%] border border-dashed border-ink/40 bg-cream" />
            <div className="h-20 w-9 rounded-t-[40%] border border-dashed border-ink/40 bg-cream" />
            <div className="h-16 w-7 rounded-t-full border border-dashed border-ink/40 bg-cream" />
            <div className="h-5 w-10 self-end rounded border border-dashed border-ink/40 bg-cream" />
          </div>
          <p className="mt-1 text-center text-[8px] text-warmgrey">front · back · sleeve · cuff — real seams, 5 cm scale check</p>
        </div>
        <div className="w-28 space-y-1">
          {[
            ["Cuff", "Rounded French"],
            ["Collar angle", "70°"],
            ["Buttons", "8"],
            ["Neck", "43.0 cm"],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between rounded bg-white px-1.5 py-1 shadow-sm">
              <span className="text-[8px] text-warmgrey">{k}</span>
              <span className="text-[8px] font-medium text-ink">{v}</span>
            </div>
          ))}
          <div className="flex flex-wrap gap-1 pt-0.5">
            <span className={badge("bg-navy/10 text-navy")}>31 blocks</span>
            <span className={badge("bg-palm/15 text-palm")}>PDF ↓ 100%</span>
          </div>
        </div>
      </div>
    </MiniShell>
  );
}

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
        <p className="mt-1 flex items-center gap-1 text-[8px] text-warmgrey">
          <span className="font-semibold text-ink/70">Tol ±0.5</span> · graded from base · blank = no rule
        </p>
        <p className="mt-1.5 truncate text-[8px] italic text-warmgrey">
          Ceinture montée avec entoilage — pressage vapeur uniquement…
        </p>
        <div className="mt-1.5 flex gap-1">
          <span className={badge("bg-palm/15 text-palm")}>Excel ↓</span>
          <span className={badge("bg-palm/15 text-palm")}>PDF ↓</span>
          <span className={badge("bg-saffron/20 text-bark")}>factory opened ✓</span>
        </div>
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
          { ok: true, t: "LLM assistants indexed", sub: "llms.txt generated from your pages" },
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
      <p className="text-chalk/60">→ admin credentials emailed · LLM site starter ready</p>
      <p><span className="text-palm">✓</span> live in 4.2s — isolated database, custom domain ready</p>
    </div>
  );
}

function MiniDesignStudio() {
  const looks = [
    "from-[#2b3a5c] to-[#0f1626]",
    "from-[#c9b7a0] to-[#8a7358]",
    "from-[#3a4d47] to-[#1c2622]",
    "from-[#b98b6e] to-[#7a5340]",
  ];
  return (
    <MiniShell title="Design Studio — SS27 linen set">
      <div className="mb-1.5 flex items-center gap-1">
        <span className="flex-1 truncate rounded bg-white px-1.5 py-1 text-[8px] text-ink/70">
          a wide linen trouser in warm sand, editorial…
        </span>
        <span className={badge("bg-navy text-chalk")}>✦ Generate</span>
      </div>
      <div className="mb-1.5 flex flex-wrap gap-1">
        <span className={badge("bg-ink/5 text-ink/60")}>house style</span>
        <span className={badge("bg-ink/5 text-ink/60")}>2 references</span>
        <span className={badge("bg-palm/15 text-palm")}>FLUX.2</span>
        <span className={badge("bg-ink/5 text-ink/60")}>✂ pattern</span>
      </div>
      <div className="grid grid-cols-4 gap-1">
        {looks.map((g, i) => (
          <div key={i} className={`relative aspect-[3/4] rounded bg-gradient-to-b ${g}`}>
            {i === 0 && <span className="absolute left-0.5 top-0.5 text-[9px]">★</span>}
            <span className="absolute inset-x-0 bottom-0 truncate bg-black/30 px-0.5 text-[7px] text-white">
              {["⇡ use", "▦ try on", "vary", "⇢ maker"][i]}
            </span>
          </div>
        ))}
      </div>
    </MiniShell>
  );
}

function MiniFittingStudio() {
  const roster = [
    "from-[#f0e0cc] to-[#caa77f]",
    "from-[#d9b48f] to-[#7a5334]",
    "from-[#c9a98a] to-[#5c4230]",
    "from-[#e7d3ba] to-[#b78a63]",
    "from-[#b98f6c] to-[#4f3826]",
  ];
  return (
    <MiniShell title="Fitting Studio — try it on">
      <div className="mb-2 flex items-center justify-center gap-1.5">
        <div className="text-center">
          <div className="aspect-square w-11 rounded bg-gradient-to-br from-[#c9b7a0] to-[#8a7358] shadow-sm" />
          <p className="mt-0.5 text-[7px] text-warmgrey">garment</p>
        </div>
        <span className="text-[11px] text-ink/40">+</span>
        <div className="text-center">
          <div className="aspect-[3/4] w-9 rounded bg-gradient-to-b from-[#e7d8c4] to-[#b98b6e] shadow-sm ring-1 ring-navy" />
          <p className="mt-0.5 text-[7px] text-warmgrey">model</p>
        </div>
        <span className="text-[11px] text-ink/40">=</span>
        <div className="text-center">
          <div className="relative aspect-[3/4] w-14 overflow-hidden rounded bg-gradient-to-b from-[#b98b6e] to-[#4f3a2c] shadow-sm">
            <span className="absolute left-0.5 top-0.5 rounded-full bg-navy/85 px-1 text-[6px] text-chalk">Try-on</span>
          </div>
          <p className="mt-0.5 text-[7px] text-warmgrey">photoreal</p>
        </div>
      </div>
      <div className="mb-1.5 flex items-center gap-1">
        <p className="text-[7px] uppercase tracking-wide text-warmgrey">roster</p>
        <div className="flex gap-0.5">
          {roster.map((g, i) => (
            <span key={i} className={`h-5 w-4 rounded bg-gradient-to-b ${g} ${i === 1 ? "ring-1 ring-navy" : ""}`} />
          ))}
        </div>
        <span className="text-[7px] text-warmgrey">women · men · every shape</span>
      </div>
      <div className="flex gap-1">
        <span className={badge("bg-ink/5 text-ink/60")}>from Design Studio or a photo</span>
        <span className={badge("bg-palm/15 text-palm")}>consistent bodies</span>
      </div>
    </MiniShell>
  );
}

function MiniSourcing() {
  const makers = [
    { n: "Atelier Lima", c: "Porto, PT", tags: ["low-MOQ", "linen"], fit: "Small-batch tailoring, 30-unit minimums." },
    { n: "Studio Sartor", c: "Los Angeles", tags: ["cut & sew"], fit: "US cut-and-sew, quick protos." },
  ];
  return (
    <MiniShell title="Find a Maker — deep research">
      <div className="mb-1.5 flex items-center gap-1">
        <span className="flex-1 truncate rounded bg-white px-1.5 py-1 text-[8px] text-ink/70">
          tailored linen trousers · 50–100 units · Portugal
        </span>
        <span className={badge("bg-palm/15 text-palm")}>Perplexity</span>
      </div>
      <div className="space-y-1">
        {makers.map((m) => (
          <div key={m.n} className="rounded bg-white p-1.5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-[9px] font-medium text-ink">{m.n} <span className="text-warmgrey">· {m.c}</span></p>
              <span className={badge("bg-navy text-chalk")}>+ add</span>
            </div>
            <p className="truncate text-[8px] text-warmgrey">{m.fit}</p>
            <div className="mt-0.5 flex gap-1">
              {m.tags.map((t) => (
                <span key={t} className={badge("bg-ink/5 text-ink/60")}>{t}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-1 text-[7px] text-warmgrey">Live web sources · citations attached</p>
    </MiniShell>
  );
}

function MiniVideo() {
  return (
    <MiniShell title="Promo Video — SS27 launch">
      <div className="mb-1.5 aspect-video overflow-hidden rounded bg-gradient-to-br from-[#1f2a44] to-[#0e1422]">
        <div className="flex h-full flex-col justify-end p-2">
          <span className="text-[7px] uppercase tracking-widest text-terracotta">Maison Atlantique</span>
          <span className="font-display text-[13px] font-light leading-none text-chalk">Tailored resortwear.</span>
        </div>
      </div>
      <div className="mb-1 flex gap-0.5">
        {["Open", "Collection", "Pieces", "Story", "Close"].map((s, i) => (
          <span key={s} className={`flex-1 truncate rounded px-1 py-0.5 text-center text-[7px] ${i === 2 ? "bg-navy text-chalk" : "bg-ink/5 text-ink/60"}`}>{s}</span>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[8px] text-warmgrey">Live preview = the final cut</span>
        <span className={badge("bg-palm/15 text-palm")}>pay on delivery</span>
      </div>
    </MiniShell>
  );
}

function MiniImport() {
  const rows: [string, string][] = [
    ["Product Title", "→ Name"],
    ["Retail", "→ Price"],
    ["Colour", "→ Colour"],
    ["Size", "→ Size"],
    ["Stock", "→ Stock"],
  ];
  return (
    <MiniShell title="Import studio — catalog.csv">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[8px] text-warmgrey">142 rows · auto-matched</span>
        <span className={badge("bg-palm/15 text-palm")}>LLM mapping</span>
      </div>
      <div className="space-y-0.5">
        {rows.map(([from, to]) => (
          <div key={from} className="flex items-center gap-1 rounded bg-white px-1.5 py-1 shadow-sm">
            <span className="flex-1 truncate text-[8px] text-ink/70">{from}</span>
            <span className="text-[8px] font-medium text-palm">{to}</span>
          </div>
        ))}
      </div>
      <p className="mt-1 text-right text-[8px]"><span className={badge("bg-navy text-chalk")}>Import 68 products</span></p>
    </MiniShell>
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
    id: "design-studio",
    eyebrow: "Design",
    heading: "An LLM design studio for your next line.",
    body: "Build a prompt from garment, fabric, palette and mood — or drop in reference images and Flux (running natively on Cloudflare, no keys to bring) generates a collection of looks that hold together. Pin favorites, keep a house style for consistency, draft a real sewing pattern for the piece, then use a look on your storefront, try it on a model, or send it straight to a maker for a sample.",
    points: [
      "Native Flux + FLUX.2 reference-image conditioning for a consistent line",
      "House style + seed lock across a whole capsule",
      "Draft a real, manufacturable sewing pattern (FreeSewing) — one click",
      "Use on your site, try it on a model, or ship the design to a factory",
    ],
    screen: MiniDesignStudio,
    url: "verto.style/maison/admin/ai-concepts",
  },
  {
    id: "fitting-studio",
    eyebrow: "Fit",
    heading: "See it on a real body before you cut it.",
    body: "Take a Design Studio look — or a photo of a real sample — and try it on a consistent roster of photoreal models spanning shapes, sizes, and skin tones. Judge fit and styling on the same bodies across every style, so the whole line hangs together before a single metre of fabric is cut.",
    points: [
      "A fixed model roster — the same bodies, every style, every season",
      "Try looks on your actual client — from a photo they send",
      "Try on a Design Studio creation or a photo of a real sample",
      "Photoreal virtual try-on from best-in-class image models",
      "Refit any look in a click — tighter, looser, cropped, different sleeves",
      "Colorways on demand, and side-by-side compare across bodies",
    ],
    screen: MiniFittingStudio,
    url: "verto.style/maison/admin/fitting",
  },
  {
    id: "pattern-studio",
    eyebrow: "Cut",
    heading: "From picture to pattern you can actually cut.",
    body: "Real, manufacturable sewing patterns drafted in the browser — over thirty blocks from tees to coats, graded to a size or drafted to a person's exact measurements. Open every drafting option the block defines (six cuff styles on the button-down, collar geometry, plackets), set your seam allowance, and print a true-scale tiled PDF with a scale-check bar on every page. Then see it before you sew it: nineteen blocks — tees to trousers, circle skirts to tailored overcoats — run through a true cloth-physics drape: your exact pattern, in your client's measurements, hung on a mannequin, and that drape anchors a photoreal render, so the picture shows how this pattern actually falls.",
    points: [
      "31 pattern blocks — tops, shirts, dresses, trousers, coats, foundation blocks",
      "True made-to-measure: every measurement point the block drafts from, cm or inches",
      "Cloth-physics drape preview on nineteen blocks — tees to tailored coats — that grounds a photoreal render",
      "Strain fit map on every drape: green where the fabric skims, red where it pulls — measured against your flat pattern, the way garment CAD does it",
      "Print-at-scale tiled PDF, SVG download, and a per-client pattern book",
    ],
    screen: MiniPatternStudio,
    url: "verto.style/maison/admin/patterns",
  },
  {
    id: "sourcing",
    eyebrow: "Source",
    heading: "Find a maker, even from a standing start.",
    body: "New line and no factory yet? Describe the piece — garment, materials, order size, location — and Verto runs live deep research to surface real tailors and small studios that can make it, with specialties, MOQs, and citations. Add one to your factories and request a sample without leaving Verto.",
    points: ["Live web research with real, cited sources", "Filtered for small-batch, emerging-brand-friendly makers", "Leads flow straight into samples and POs"],
    screen: MiniSourcing,
    url: "verto.style/maison/admin/sourcing",
  },
  {
    id: "promo-video",
    eyebrow: "Launch",
    heading: "Cinematic promo videos from your own products.",
    body: "Compose a promo from your catalog, watch the finished film play in real time, and export only when you love it. The preview IS the render — so you never pay for a version you hate. Rendered off-platform and charged on delivery.",
    points: ["What you preview is exactly what renders", "Landscape, vertical & square cuts", "Charge-on-delivery — a failed render never bills"],
    screen: MiniVideo,
    url: "verto.style/maison/admin/marketing/video",
  },
  {
    id: "import",
    eyebrow: "Onboard",
    heading: "Bring your whole catalog in, in minutes.",
    body: "Drop a spreadsheet from Shopify, another platform, or your own export. LLM maps the columns to your catalog, you confirm, and it bulk-imports products, variants, stock and collections as drafts to review.",
    points: ["LLM column mapping with a heuristic fallback", "Rows group into products with variants automatically", "Everything imports as drafts you approve"],
    screen: MiniImport,
    url: "verto.style/maison/admin/import",
  },
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
    body: "Graded measurement charts with tolerances, BOMs linked to real fabrics and trims, bilingual construction notes, stitch specs with SPI, annotated flats with numbered callouts, labels and care — exported to Excel or PDF and shared as a live link that tells you the moment the factory opens it.",
    points: [
      "Point-callout annotations right on the flat",
      "Graded POM tables with tolerances → Excel & PDF",
      "Factory link with read receipts and bilingual view",
    ],
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
    body: "Product rich results, per-page tags and canonicals, social previews, self-updating sitemaps, alt-text tracking, an llms.txt index for LLM assistants — and a Search Checkup screen in plain merchant language. On Shopify this is an SEO app at $30–80/month, a structured-data app at $399/year, an llms.txt app on top, and — when the apps conflict — a freelancer from $500/month. Here it ships in the box and updates itself on every publish.",
    points: [
      "Product schema with price & availability — the $399/yr app, included",
      "Search Checkup: findings + one-tap fixes + LLM-drafted descriptions",
      "LLM-search ready by default — llms.txt is a $99/mo tier elsewhere",
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
    body: "Describe a campaign once; Verto writes the kit in your voice — social, email, press release, ad copy, blog draft — onto a content calendar you approve. Bring your own LLM key or use the built-in model.",
    points: ["Whole-kit generation in your brand voice", "Content calendar + email sends", "Your Anthropic key, or built-in Llama"],
    screen: MiniMarketing,
    url: "verto.style/maison/admin/marketing",
  },
  {
    id: "translations",
    eyebrow: "Translate",
    heading: "A second language without a localization project.",
    body: "Flip on French (or any language) and the storefront translates itself on demand, caches the result, and lets you correct anything by hand.",
    points: ["On-demand LLM translation, cached", "Hand-editable overrides", "Per-shop language list"],
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

// ---------- Category killer: tech packs head-to-head ----------
// Every cell is defensible from public product docs and reviews (mid-2026):
// Backbone's own FAQ tells users to convert PDFs in Acrobat (no Excel);
// Techpacker's grading is documented as "Alpha"; Delogue's care-label
// module is deprecated; none ship bilingual construction notes or live in
// the same database as the storefront. We concede where they're even.
const TP_MATRIX: { row: string; verto: string; techpacker: string; backbone: string; delogue: string }[] = [
  { row: "Graded POM tables with tolerances", verto: "yes", techpacker: "grading in Alpha", backbone: "yes", delogue: "single tolerance, manual grade" },
  { row: "Annotated flats (numbered callouts)", verto: "yes", techpacker: "yes", backbone: "yes", delogue: "limited" },
  { row: "Bilingual construction notes (EN/FR)", verto: "yes", techpacker: "no", backbone: "no", delogue: "no" },
  { row: "Excel export", verto: "included", techpacker: "top tier only", backbone: "no — convert PDF by hand", delogue: "top tier only" },
  { row: "Live factory link + read receipts", verto: "yes", techpacker: "portal, no receipt", backbone: "read-only portal", delogue: "no open-notification" },
  { row: "LLM tech pack from a photo", verto: "included", techpacker: "marketing claim", backbone: "no", delogue: "support chatbot only" },
  { row: "Same database as storefront, orders, costing", verto: "yes", techpacker: "no", backbone: "no", delogue: "no" },
  { row: "Price", verto: "included from $29/mo", techpacker: "$35–125 / seat", backbone: "$199 / seat", delogue: "€145–279 / seat" },
];

function TPMark({ value, dark = false }: { value: string; dark?: boolean }) {
  const v = value.toLowerCase();
  if (v === "yes" || v === "included") {
    // Brighter green so the affirmative reads on the navy panel.
    return (
      <span className="font-semibold text-[#7cc79a]">
        ✓{value === "included" ? " included" : ""}
      </span>
    );
  }
  if (v === "no" || v.startsWith("no ") || v.startsWith("no—") || v.startsWith("no —")) {
    return <span className="text-[#e08b74]">— {value.replace(/^no\s*—?\s*/i, "") || "no"}</span>;
  }
  return <span className={dark ? "text-chalk/55" : "text-warmgrey"}>{value}</span>;
}

function TechPackShowcase() {
  return (
    <section id="techpacks-vs" className="mt-24 scroll-mt-24">
      <div className="rounded-2xl bg-navy px-5 py-12 text-chalk md:px-10 md:py-16">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <p className="eyebrow !text-terracotta">The category killer</p>
          </Reveal>
          <Reveal delay={100}>
            <h2 className="mt-2 font-display text-3xl font-light md:text-4xl">
              The best tech packs in fashion — not sold separately.
            </h2>
          </Reveal>
          <Reveal delay={200}>
            <p className="prose-editorial mx-auto mt-4 !text-chalk/80">
              Dedicated tech-pack tools cost $35–199 per seat and still make you round-trip to Excel,
              chase factories for confirmation, and buy a separate system for everything after the
              spec. Verto's tech packs match or beat them feature for feature — and they're one tab
              away from the storefront that sells the piece.
            </p>
          </Reveal>
        </div>

        <Reveal delay={250}>
          <div className="mx-auto mt-10 max-w-4xl overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-chalk/20 text-left">
                  <th className="py-3 pr-4 font-medium text-chalk/70">Capability</th>
                  <th className="px-3 py-3 text-center font-semibold">Verto</th>
                  <th className="px-3 py-3 text-center font-medium text-chalk/60">Techpacker</th>
                  <th className="px-3 py-3 text-center font-medium text-chalk/60">Backbone</th>
                  <th className="px-3 py-3 text-center font-medium text-chalk/60">Delogue</th>
                </tr>
              </thead>
              <tbody>
                {TP_MATRIX.map((r) => (
                  <tr key={r.row} className="border-b border-chalk/10">
                    <td className="py-2.5 pr-4 text-chalk/90">{r.row}</td>
                    <td className="px-3 py-2.5 text-center text-[0.8rem] bg-chalk/[0.06]"><TPMark value={r.verto} dark /></td>
                    <td className="px-3 py-2.5 text-center text-[0.8rem]"><TPMark value={r.techpacker} dark /></td>
                    <td className="px-3 py-2.5 text-center text-[0.8rem]"><TPMark value={r.backbone} dark /></td>
                    <td className="px-3 py-2.5 text-center text-[0.8rem]"><TPMark value={r.delogue} dark /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
        <p className="mx-auto mt-4 max-w-4xl text-center text-xs text-chalk/50">
          Competitor capabilities and pricing from their public product docs and user reviews as of
          mid-2026 — always verify current plans with each vendor. "Included" means on every Verto
          plan, per shop, not per seat.
        </p>
      </div>
    </section>
  );
}

// The tabs mirror the admin app's own sidebar groups — same names, same
// order — so the tour doubles as a map of the product you'll actually run.
// Only groups with tour content appear.
const FEATURE_TABS: { group: string; blurb: string; ids: string[] }[] = [
  { group: "Catalog", blurb: "Products, styles, SKUs, inventory — and an AI import studio that does the data entry.", ids: ["import"] },
  { group: "Content", blurb: "Pages, journal, lookbooks, SEO, translations — a storefront you actually edit.", ids: ["storefront", "seo", "lookbooks", "translations"] },
  { group: "Marketing", blurb: "Campaign kits, a content calendar, and a promo-video studio.", ids: ["marketing", "promo-video"] },
  { group: "Commerce", blurb: "Orders, shipping, wholesale — and the whole modern shop around them.", ids: ["shipping", "wholesale"] },
  { group: "Production", blurb: "The calendar, your factories, samples — and finding your next maker.", ids: ["production", "sourcing", "factory"] },
  { group: "Studio", blurb: "Design it, fit it, cut it — the three studios, and tech packs a factory can build from.", ids: ["design-studio", "fitting-studio", "pattern-studio", "techpacks"] },
  { group: "Finance", blurb: "Costing, duties, analytics — the money picture from real data.", ids: ["costing", "analytics"] },
  { group: "System", blurb: "Your own domain, your team, your data — a real platform underneath.", ids: ["platform"] },
];

function tabForHash(hash: string): string | null {
  const h = hash.replace("#", "");
  const byFeature = FEATURE_TABS.find((t) => t.ids.includes(h));
  if (byFeature) return byFeature.group;
  const byGroup = FEATURE_TABS.find((t) => `g-${t.group.toLowerCase()}` === h);
  return byGroup ? byGroup.group : null;
}

export function VertoFeatures() {
  const navigate = useNavigate();
  // Lead with the Studio — the differentiator — unless a deep link says otherwise.
  const [tab, setTab] = useState<string>(
    () => tabForHash(typeof window !== "undefined" ? window.location.hash : "") ?? "Studio",
  );

  // Deep links to a specific feature (#pattern-studio) open its tab, then scroll.
  useEffect(() => {
    const h = window.location.hash.replace("#", "");
    if (h && FEATURE_TABS.some((t) => t.ids.includes(h))) {
      const el = document.getElementById(h);
      if (el) setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const active = FEATURE_TABS.find((t) => t.group === tab) ?? FEATURE_TABS[5];
  const features = active.ids
    .map((id) => FEATURES.find((f) => f.id === id))
    .filter((f): f is (typeof FEATURES)[number] => Boolean(f));

  function pickTab(group: string) {
    setTab(group);
    window.history.replaceState(null, "", `#g-${group.toLowerCase()}`);
  }

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
              One database, zero copy-paste between tools — organised below exactly like the app
              you'll run: same rooms, same names. Every screen is the real interface, miniaturized —
              and the <a href={`${DEMO_SHOP_BASE}/admin`} className="link-quiet">demo admin</a> is
              open if you want to drive.
            </p>
          </Reveal>
        </div>

        {/* Tabs — the app's own sidebar groups */}
        <Reveal delay={200}>
          <div className="sticky top-16 z-20 -mx-5 mb-3 overflow-x-auto px-5 py-2 md:top-20">
            <div className="mx-auto flex w-max gap-1 rounded-full border border-ink/10 bg-white/95 p-1 shadow-sm backdrop-blur">
              {FEATURE_TABS.map((t) => (
                <button
                  key={t.group}
                  type="button"
                  onClick={() => pickTab(t.group)}
                  className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-[0.68rem] font-medium uppercase tracking-wider transition-colors ${
                    tab === t.group ? "bg-navy text-chalk" : "text-ink/60 hover:text-navy"
                  }`}
                >
                  {t.group}
                </button>
              ))}
            </div>
          </div>
        </Reveal>
        <p className="mb-12 text-center text-sm text-warmgrey">{active.blurb}</p>

        {/* The tour — one room at a time */}
        <div key={tab} className="space-y-20 md:space-y-28">
          {features.map((f, i) => (
            <section key={f.id} id={f.id} className="grid scroll-mt-36 items-center gap-8 md:grid-cols-2 md:gap-12">
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

          {/* Group-specific showcases live inside their room. */}
          {tab === "Commerce" && <ModernShopGrid />}
          {tab === "Studio" && <TechPackShowcase />}
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

// ---------- A modern shop, out of the box ----------
const MODERN_SHOP: { group: string; items: [string, string][] }[] = [
  {
    group: "Sell",
    items: [
      ["Real checkout & payments", "Stripe checkout, live carrier rates, pre-orders that can't oversell."],
      ["Discounts & tax", "Make a code your customers type; switch on sales tax/VAT with one toggle."],
      ["Search & merchandising", "Instant search, size/category/price facets, and “only N left” urgency."],
      ["Product reviews", "Only verified buyers can review — trustworthy by construction, great for SEO."],
    ],
  },
  {
    group: "Keep customers",
    items: [
      ["Customer accounts", "Passwordless sign-in, order tracking, one-tap reorder, saved addresses, wishlist."],
      ["Returns in a click", "Shoppers start a return; you approve to refund and restock in one step."],
      ["Win-back automations", "Real back-in-stock waitlists and abandoned-cart recovery, on brand."],
      ["Email your customers", "Broadcast to buyers or repeat customers in your colours, unsubscribes honoured."],
      ["Loyalty & referrals", "Store credit on every order and for referring friends, redeemed at checkout."],
    ],
  },
  {
    group: "Grow & run it",
    items: [
      ["Client Book for tailors & stylists", "Each client's dated measurement history, style notes, fittings timeline — and their patterns and photos."],
      ["Commission pipeline", "Made-to-measure work from consult to delivery, with fittings recorded on the client's timeline."],
      ["Client portal", "A passwordless page where clients follow their piece, see renders on their own body, and approve the design."],
      ["Deposits & consult booking", "Request deposits and milestone payments per commission, and take consult requests from a public /book page."],
      ["Wholesale portal", "Approved boutiques sign in and order at their own pricing, with net terms."],
      ["Cash flow & open-to-buy", "Money in vs. out and how much of your season budget is left, from real POs and invoices."],
      ["Multi-location stock", "Track a studio, warehouse, or shopfront and move stock between them."],
      ["Data export", "Products, customers and orders as CSV — plus QuickBooks/Xero-ready accounting."],
      ["Reorder signals", "Every piece running low, with its 90-day pace and a suggested reorder."],
      ["Digital Product Passport", "A public, printable passport per piece — composition, care, origin."],
    ],
  },
];

function ModernShopGrid() {
  return (
    <section className="mt-24 scroll-mt-24">
      <div className="text-center">
        <Reveal>
          <p className="eyebrow !text-terracotta">And the whole shop around it</p>
        </Reveal>
        <Reveal delay={100}>
          <h2 className="mt-2 font-display text-3xl font-light md:text-4xl">
            A modern storefront, out of the box.
          </h2>
        </Reveal>
        <Reveal delay={200}>
          <p className="prose-editorial mx-auto mt-3 max-w-2xl">
            The design-to-factory tools are only half of it. Everything a boutique needs to actually
            sell, keep customers, and run the business is built in — no plugins, no extra bills.
          </p>
        </Reveal>
      </div>

      <div className="mt-12 grid gap-8 md:grid-cols-3">
        {MODERN_SHOP.map((col, ci) => (
          <Reveal key={col.group} delay={150 + ci * 100}>
            <div>
              <p className="eyebrow mb-4">{col.group}</p>
              <ul className="space-y-4">
                {col.items.map(([title, blurb]) => (
                  <li key={title} className="border-l-2 border-palm/40 pl-3">
                    <p className="text-sm font-medium">{title}</p>
                    <p className="text-sm text-ink/70">{blurb}</p>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
