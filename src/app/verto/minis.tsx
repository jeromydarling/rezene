import { type ReactNode } from "react";

/**
 * Shared miniature app screens — chromeless "browser" frames rendering a
 * decorative React mock of the real admin UI. Used on /features (the tour)
 * and /stories (attached to timeline beats so each moment shows the actual
 * tool). Pointer-events-none + aria-hidden: the real thing is one click away
 * in the demo admin. These are copies kept deliberately simple and static.
 */

const badge = (tone: string) => `inline-block rounded-full px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide ${tone}`;

export function BrowserFrame({ url, children }: { url: string; children: ReactNode }) {
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

export function MiniShell({ title, children }: { title: string; children: ReactNode }) {
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

export function MiniClientBook() {
  return (
    <MiniShell title="Client Book — Maya Okafor">
      <div className="flex gap-2">
        <div className="flex-1 space-y-1.5">
          <div className="rounded bg-white p-1.5 shadow-sm">
            <p className="text-[8px] font-semibold text-ink">Wedding-guest coat</p>
            <div className="mt-1 flex items-center gap-1">
              {["Consult", "Design", "Fabric", "Cutting", "Fittings"].map((st, i) => (
                <span
                  key={st}
                  className={
                    "rounded-full px-1 py-0.5 text-[6.5px] " +
                    (i <= 2 ? "bg-palm/20 text-palm" : i === 3 ? "bg-terracotta/20 text-terracotta" : "bg-ink/5 text-warmgrey")
                  }
                >
                  {st}
                </span>
              ))}
            </div>
            <p className="mt-1 text-[7.5px] text-warmgrey">Deposit $240 · paid — client approved from her portal ✓</p>
          </div>
          <div className="rounded bg-white p-1.5 shadow-sm">
            <p className="text-[8px] font-semibold text-ink">Timeline</p>
            {[
              ["Fitting", "Take in left shoulder 1 cm"],
              ["Note", "Loves jewel tones, never sleeveless"],
              ["Consult", "Booked from /book — “a coat for autumn”"],
            ].map(([k, v]) => (
              <p key={v} className="mt-0.5 truncate text-[7.5px] text-warmgrey">
                <span className="font-medium text-ink">{k}</span> · {v}
              </p>
            ))}
          </div>
        </div>
        <div className="w-28 space-y-1">
          <div className="rounded bg-white p-1.5 shadow-sm">
            <p className="text-[8px] font-semibold text-ink">Measurements</p>
            <p className="text-[7px] text-warmgrey">Jun 2026 · Nov 2025</p>
            {[
              ["Chest", "96 cm"],
              ["Waist", "78 cm"],
              ["Shoulder", "41 cm"],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between">
                <span className="text-[7.5px] text-warmgrey">{k}</span>
                <span className="text-[7.5px] font-medium text-ink">{v}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            <span className={badge("bg-navy/10 text-navy")}>2 patterns</span>
            <span className={badge("bg-palm/15 text-palm")}>portal ✓</span>
          </div>
        </div>
      </div>
    </MiniShell>
  );
}

export function MiniPatternStudio() {
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
            <span className={badge("bg-navy/10 text-navy")}>51 blocks</span>
            <span className={badge("bg-palm/15 text-palm")}>PDF ↓ 100%</span>
          </div>
        </div>
      </div>
    </MiniShell>
  );
}

export function MiniSourcing() {
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

export function MiniDesignStudio() {
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

export function MiniFittingStudio() {
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

export function MiniTechPack() {
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

export function MiniCosting() {
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

export function MiniRD() {
  return (
    <MiniShell title="R&D — price study · linen shirting">
      <div className="flex gap-2">
        <div className="flex-1 rounded bg-white p-2 shadow-sm">
          <p className="text-[9px] font-medium text-ink">Linen shirt · target retail</p>
          <div className="mt-1.5 h-3 rounded-full bg-cream">
            <div className="relative h-3 w-3/4 rounded-full bg-gradient-to-r from-palm/40 to-terracotta/60">
              <span className="absolute -top-3.5 right-0 text-[8px] text-ink">$125 mid</span>
            </div>
          </div>
          <div className="mt-2 space-y-1">
            {[
              ["Sézane — Louison", "$110", "cited"],
              ["Arket — linen overshirt", "$129", "cited"],
              ["With Nothing Underneath", "$150", "cited"],
            ].map(([n, p, c]) => (
              <div key={n} className="flex items-center justify-between rounded bg-cream/60 px-1.5 py-1">
                <span className="truncate text-[8px] text-ink/80">{n}</span>
                <span className="text-[8px] font-medium text-ink">{p}</span>
                <span className={badge("bg-navy/10 text-navy")}>{c}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="w-28 space-y-1">
          <div className="rounded bg-white p-1.5 shadow-sm">
            <p className="text-[8px] font-medium text-ink">Dossier · Sézane</p>
            <span className={badge("bg-terracotta/15 text-terracotta")}>watching weekly</span>
          </div>
          <div className="rounded bg-white p-1.5 shadow-sm">
            <p className="text-[8px] font-medium text-ink">Trend board</p>
            <div className="mt-1 flex gap-0.5">
              {["bg-navy/30", "bg-terracotta/40", "bg-palm/40"].map((c, i) => (
                <span key={i} className={`h-6 w-1/3 rounded-sm ${c}`} />
              ))}
            </div>
          </div>
          <button className="w-full rounded bg-navy px-1.5 py-1 text-[8px] text-white">→ push to cost sheet</button>
        </div>
      </div>
    </MiniShell>
  );
}

export function MiniWholesale() {
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

export function MiniImport() {
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

export function MiniProduction() {
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

export function MiniPlatform() {
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
