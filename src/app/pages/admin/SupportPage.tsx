import { useMemo, useState } from "react";
import { useLocation } from "react-router";
import { api, ApiRequestError } from "../../lib/api";
import { useToast } from "../../lib/toast";
import { PageHeader, SlideOver } from "../../components/admin/ui";

/**
 * Support: a searchable Knowledge Base (a deep dive into every feature) plus a
 * one-tap bug / feature report that lands in Verto HQ. Anyone stuck should find
 * an answer here or be one form away from telling us.
 */

interface Article {
  category: string;
  title: string;
  keywords: string;
  body: string[];
}

const KB: Article[] = [
  {
    category: "Getting started",
    title: "The big picture: how Verto is organized",
    keywords: "overview modules navigation start",
    body: [
      "Verto is your whole brand in one place: the storefront customers see, the catalog behind it, the production pipeline that makes the clothes, and the marketing that sells them — all sharing one database, so a fact you enter once is true everywhere.",
      "The left sidebar groups everything into sections (Catalog, Content, Marketing, Commerce, Production, Studio, Finance, System). Each section collapses — click a heading to open or close it. The section you're working in opens automatically.",
      "Use the ‘Jump to module…’ search at the top to fly to any screen by name.",
    ],
  },
  {
    category: "Catalog",
    title: "Adding and editing products",
    keywords: "product create edit new price publish catalog merchandising",
    body: [
      "Go to Catalog → Products and click ‘New product’. Give it a name, price, and category to create a draft.",
      "On the editor, fill in the details (name, subtitle, description, audience, category, collection, availability) and set a URL slug. Open ‘More fields’ for fabric, care, origin, and fit notes.",
      "A product isn't buyable until it has at least one variant (a colour + size) and is published. Add variants under ‘Colours & sizes’, then click ‘Publish’.",
      "Changes save when you click ‘Save’. Publishing is instant — the product appears on your storefront right away.",
    ],
  },
  {
    category: "Catalog",
    title: "Colours, sizes & SKUs",
    keywords: "variant sku size colour colorway stock inventory sellable",
    body: [
      "Each buyable combination of colour and size is a variant — the sellable SKU. Add them in the product editor under ‘Colours & sizes’.",
      "Enter a colour, a size, and an optional starting stock, then ‘Add’. You can also give each variant its own SKU code and a price that overrides the product's base price.",
      "Every variant automatically gets an inventory line. Edit the stock number inline — it records an inventory movement so your history stays accurate. Remove a variant with the ✕.",
    ],
  },
  {
    category: "Catalog",
    title: "Managing inventory",
    keywords: "inventory stock on hand reserved adjust receive count",
    body: [
      "Inventory (under Catalog) lists every variant's stock: on-hand, reserved, incoming, and a low-stock flag.",
      "Click ‘Adjust’ on any line to receive stock, record a sale, reserve/release, log damage or returns, or make a manual correction. Each adjustment is logged.",
      "Stock also moves on its own: a paid order decrements on-hand; a pre-order counts against its allocation. If a variant shows no inventory line, make sure the product has that colour/size variant.",
    ],
  },
  {
    category: "Catalog",
    title: "Collections",
    keywords: "collection season group create delete capsule",
    body: [
      "Collections group products into seasons or capsules on the storefront. Go to Catalog → Collections.",
      "Click ‘New collection’ to create one (name + optional season). Use ‘Edit’ to add copy, a hero image, and publish it. ‘Delete’ removes the grouping — products in it simply become uncollected, they aren't deleted.",
      "Assign a product to a collection from the product editor's ‘Collection’ dropdown.",
    ],
  },
  {
    category: "Product development",
    title: "Styles vs. Products (and where tech packs attach)",
    keywords: "style product tech pack techpack design pipeline missing relationship",
    body: [
      "A Style is the design-side record of a garment as it moves through development (concept → design → tech pack → sampling → approved → production). A Product is the storefront listing you sell. They're related but separate: a product can optionally point back to the style it came from.",
      "Tech packs attach to Styles, not products. Each style has one tech pack — the manufacturing spec you send the factory. Open a style, or go to Tech Packs, to build it.",
      "‘Missing tech pack’ on a style means that style has no tech pack record yet. Resolve it by opening the style (or Tech Packs → the style) and creating the tech pack — you can start from a template or let AI rough it in, then refine the measurements, BOM, and construction.",
    ],
  },
  {
    category: "Product development",
    title: "Tech packs: building the factory spec",
    keywords: "tech pack measurements bom construction grading factory export excel",
    body: [
      "A tech pack is the complete manufacturing spec: graded measurements with tolerances, bill of materials, construction and stitch details, labels, and annotated flat sketches.",
      "Open a tech pack to edit each section. Drop numbered pins on a flat sketch to call out construction points. Export the whole pack to a multi-sheet Excel workbook for the factory, or share a read-only factory link.",
    ],
  },
  {
    category: "Marketing",
    title: "Campaigns & the marketing suite",
    keywords: "marketing campaign social email press ads content calendar",
    body: [
      "Marketing → Campaigns turns a single brief into a multi-channel kit — social posts, email, blog, press, and ads — written by AI in your brand voice. Everything is a draft you edit, schedule, and mark posted; nothing auto-publishes.",
      "Use the graphics studio for brand-styled images and the content calendar to plan what goes out when.",
    ],
  },
  {
    category: "Marketing",
    title: "Promo Video studio",
    keywords: "video promo render preview export marketing film",
    body: [
      "Marketing → Promo Video composes a cinematic promo from your own products. Edit the on-screen lines (or let AI draft them) and watch the finished film play in real time in the preview — what you preview is exactly what renders.",
      "When you love it, choose your formats (landscape / vertical / square) and export. You're only charged once the finished video is delivered — a render that fails is never billed.",
    ],
  },
  {
    category: "Storefront & SEO",
    title: "Getting found: SEO & AI search",
    keywords: "seo search checkup sitemap schema meta google",
    body: [
      "Content → Search Checkup scores how findable your store is and fixes the gaps: page titles and descriptions, product schema, sitemaps, and an llms.txt so AI assistants can read your catalog.",
      "Every published product and collection is automatically included in your sitemap and given structured data — no manual work required.",
    ],
  },
  {
    category: "Commerce",
    title: "Orders, customers & pre-orders",
    keywords: "orders customers checkout stripe pre-order fulfilment",
    body: [
      "Orders land under Commerce when a customer checks out via Stripe. Each order shows items, payment status, and shipping. Customers accumulate as they buy.",
      "Pre-orders let you sell before stock exists and count demand against a goal; when the goal is met the campaign is marked funded and a production task is created.",
    ],
  },
  {
    category: "Team & account",
    title: "Inviting teammates & roles",
    keywords: "team users invite roles admin ops viewer password login",
    body: [
      "Settings → Team lets admins invite teammates by email. Each person sets their own password from an invite link — no shared passwords.",
      "Three roles: Admin (everything, including team and settings), Operations (day-to-day work), and Viewer (read-only). Change a role, deactivate, or remove anyone from the same screen. The last admin can't be removed.",
      "Forgot your password? Use ‘Forgot password?’ on the sign-in screen to get a reset link.",
    ],
  },
];

const REPORT_KINDS = [
  { value: "bug", label: "Something's broken", hint: "A bug — something didn't work as expected" },
  { value: "feature", label: "I have an idea", hint: "A feature request or improvement" },
  { value: "question", label: "I have a question", hint: "Not sure how something works" },
];

export function SupportPage() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return KB;
    return KB.filter((a) => `${a.title} ${a.category} ${a.keywords} ${a.body.join(" ")}`.toLowerCase().includes(q));
  }, [query]);

  return (
    <div>
      <PageHeader
        eyebrow="Support"
        title="Help & Knowledge Base"
        description="Search how everything works — or tell us what's broken or missing."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setReportOpen(true)}>
            Report a bug or idea
          </button>
        }
      />

      <input
        className="input mb-5"
        placeholder="Search the knowledge base…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {filtered.length === 0 ? (
        <div className="admin-card p-6 text-center text-sm text-warmgrey">
          Nothing matched “{query}”.{" "}
          <button type="button" className="link-quiet" onClick={() => setReportOpen(true)}>
            Ask us directly →
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => {
            const isOpen = open === a.title;
            return (
              <div key={a.title} className="admin-card overflow-hidden p-0">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-cream"
                  onClick={() => setOpen(isOpen ? null : a.title)}
                >
                  <span>
                    <span className="block text-[0.6rem] font-semibold uppercase tracking-wider text-warmgrey">{a.category}</span>
                    <span className="text-sm font-medium">{a.title}</span>
                  </span>
                  <span className="text-warmgrey">{isOpen ? "–" : "+"}</span>
                </button>
                {isOpen && (
                  <div className="space-y-2 border-t border-ink/10 px-4 py-3 text-sm leading-relaxed text-ink/80">
                    {a.body.map((p, i) => (
                      <p key={i}>{p}</p>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <SlideOver open={reportOpen} title="Report a bug or idea" onClose={() => setReportOpen(false)}>
        <ReportForm onDone={() => setReportOpen(false)} />
      </SlideOver>
    </div>
  );
}

function ReportForm({ onDone }: { onDone: () => void }) {
  const toast = useToast();
  const location = useLocation();
  const [kind, setKind] = useState("bug");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [severity, setSeverity] = useState("medium");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/admin/feedback", {
        kind,
        title,
        body: body || null,
        severity: kind === "bug" ? severity : null,
        pagePath: location.pathname,
      });
      toast.success("Thanks — we've got it.", "Your report went straight to the Verto team. We're on it.");
      onDone();
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : "Couldn't send — please try again");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        {REPORT_KINDS.map((k) => (
          <button
            key={k.value}
            type="button"
            onClick={() => setKind(k.value)}
            className={`rounded-md border px-3 py-2 text-left text-sm transition ${
              kind === k.value ? "border-navy bg-navy/5" : "border-ink/15 hover:border-ink/40"
            }`}
          >
            <span className="block font-medium">{k.label}</span>
            <span className="text-xs text-warmgrey">{k.hint}</span>
          </button>
        ))}
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-warmgrey">Summary</span>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="One line — what happened / what you want" />
      </label>

      {kind === "bug" && (
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-warmgrey">How much is it blocking you?</span>
          <select className="input" value={severity} onChange={(e) => setSeverity(e.target.value)}>
            <option value="low">Minor — a nuisance</option>
            <option value="medium">Medium — slows me down</option>
            <option value="high">High — I'm stuck</option>
          </select>
        </label>
      )}

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-warmgrey">Details (optional)</span>
        <textarea className="input" rows={5} value={body} onChange={(e) => setBody(e.target.value)} placeholder="What did you expect, and what happened instead? Steps to reproduce help a lot." />
      </label>

      {error && <p className="field-error">{error}</p>}
      <button type="button" className="btn btn-primary w-full" disabled={busy || title.trim().length < 3} onClick={() => void submit()}>
        {busy ? "Sending…" : "Send to the Verto team"}
      </button>
      <p className="text-center text-xs text-warmgrey">
        We automatically include the page you're on so we can find it fast.
      </p>
    </div>
  );
}
