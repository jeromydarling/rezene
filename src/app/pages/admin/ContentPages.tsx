import { useEffect, useState, type FormEvent } from "react";
import { useFetch } from "../../lib/useFetch";
import { api, ApiRequestError } from "../../lib/api";
import { formatDate } from "../../lib/format";
import {
  EmptyState,
  ErrorNote,
  LoadingTable,
  PageHeader,
  SlideOver,
} from "../../components/admin/ui";
import {
  AiDraftAssistant,
  ImageField,
  ImageUploadButton,
  MarkdownEditor,
  RevisionsPanel,
} from "../../components/admin/cms";
import { BlockEditor } from "../../components/admin/blocks";
import { EditorialImage } from "../../components/ImagePlaceholder";
import { getShopBase } from "../../lib/shop";
import type {
  AiContentDraft,
  HomeHero,
  NavMenus,
  PageLayout,
  PageSection,
} from "../../../shared/types";

// ============================================================
// Pages
// ============================================================

interface PageRow {
  id: string;
  slug: string;
  title: string;
  body_md: string | null;
  layout: PageLayout | null;
  hero_image_url: string | null;
  hero_eyebrow: string | null;
  subtitle: string | null;
  sections_json: string | null;
  publish_at: string | null;
  meta_title: string | null;
  meta_description: string | null;
  is_published: number;
  updated_at: string;
}

function parseSections(json: string | null): PageSection[] | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as PageSection[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Copy a draft preview URL (works while the page is unpublished). */
function PreviewLink({ path }: { path: string }) {
  const { data } = useFetch<{ token: string | null }>("/api/admin/content/preview-token");
  const [copied, setCopied] = useState(false);
  if (!data?.token) return null;
  const url = `${window.location.origin}${getShopBase()}${path}?preview=${data.token}`;
  return (
    <button
      type="button"
      className="link-quiet text-xs"
      onClick={() => {
        void navigator.clipboard.writeText(url).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      {copied ? "Copied ✓" : "Copy preview link"}
    </button>
  );
}

/** Collapsible SEO fields with LLM generation from the content. */
function SeoFields({
  metaTitle,
  metaDescription,
  onChange,
  sourceTitle,
  sourceBody,
}: {
  metaTitle: string;
  metaDescription: string;
  onChange: (patch: { metaTitle?: string; metaDescription?: string }) => void;
  sourceTitle: string;
  sourceBody: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ metaTitle: string | null; metaDescription: string | null }>(
        "/api/admin/content/ai-meta",
        { title: sourceTitle, body: sourceBody },
      );
      onChange({
        metaTitle: res.metaTitle ?? metaTitle,
        metaDescription: res.metaDescription ?? metaDescription,
      });
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Generation failed");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="link-quiet text-xs" onClick={() => setOpen(true)}>
        Search & sharing (SEO) {metaTitle || metaDescription ? "✓" : "—"} edit
      </button>
    );
  }
  return (
    <div className="rounded border border-ink/10 bg-cream/40 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-warmgrey">
          Search & sharing
        </p>
        <div className="flex items-center gap-3">
          <button type="button" className="link-quiet text-xs" disabled={busy} onClick={() => void generate()}>
            {busy ? "Writing…" : "✨ Generate from content"}
          </button>
          <button type="button" className="text-xs text-warmgrey hover:text-ink" onClick={() => setOpen(false)}>
            Close
          </button>
        </div>
      </div>
      <div className="space-y-2">
        <div>
          <label className="label">Search title ({metaTitle.length}/60)</label>
          <input
            className="input"
            maxLength={120}
            value={metaTitle}
            onChange={(e) => onChange({ metaTitle: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Search description ({metaDescription.length}/155)</label>
          <textarea
            rows={2}
            className="input"
            maxLength={300}
            value={metaDescription}
            onChange={(e) => onChange({ metaDescription: e.target.value })}
          />
        </div>
      </div>
      {error && <p className="field-error mt-2">{error}</p>}
      <p className="mt-2 text-xs text-warmgrey">
        These become the page's title and description in Google results and link previews.
      </p>
    </div>
  );
}

const LAYOUT_OPTIONS: { value: PageLayout; label: string; hint: string }[] = [
  { value: "standard", label: "Standard", hint: "Narrow editorial column — guides, legal, stories." },
  { value: "hero", label: "Hero", hint: "Full-width image header with the title on top — landing pages." },
  { value: "wide", label: "Wide", hint: "Broad centered layout with a banner image — press, campaigns." },
];

export function PagesEditorPage() {
  const { data, loading, error, reload } = useFetch<PageRow[]>("/api/admin/content/pages");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const selected = data?.find((p) => p.id === selectedId) ?? null;

  return (
    <div>
      <PageHeader
        eyebrow="Content"
        title="Pages"
        description="Every page of the public site — including the homepage hero. Pick a layout, set a hero image, or let LLM draft the first version. Every save keeps a restorable revision."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setCreateOpen(true)}>
            New page
          </button>
        }
      />
      {error && <ErrorNote message={error} />}
      {loading && <LoadingTable />}
      {data && (
        <>
          <div className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <HomeHeroCard />
            <NavigationCard />
            <BrandVoiceCard />
            <SiteStarterCard onApplied={reload} />
          </div>
          <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
            <div className="space-y-1.5">
              {data.map((page) => (
                <button
                  key={page.id}
                  type="button"
                  onClick={() => setSelectedId(page.id)}
                  className={`admin-card w-full p-3 text-left transition-colors ${
                    selectedId === page.id ? "!border-navy ring-1 ring-navy" : "hover:border-ink/25"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">{page.title}</p>
                    <span className={`badge ${page.is_published ? "badge-success" : "badge-neutral"}`}>
                      {page.is_published ? "live" : "draft"}
                    </span>
                  </div>
                  <p className="text-xs text-warmgrey">
                    /{page.slug}
                    {page.layout && page.layout !== "standard" && ` · ${page.layout}`}
                  </p>
                </button>
              ))}
            </div>
            <div>
              {selected ? (
                <PageEditor key={selected.id} page={selected} onSaved={reload} />
              ) : (
                <EmptyState title="Pick a page to edit" hint="Changes go live on save when the page is published." />
              )}
            </div>
          </div>
        </>
      )}
      <SlideOver open={createOpen} title="New page" onClose={() => setCreateOpen(false)}>
        <PageCreateForm
          onCreated={() => {
            setCreateOpen(false);
            reload();
          }}
        />
      </SlideOver>
    </div>
  );
}

// ---------- Homepage hero ----------

function HomeHeroCard() {
  const { data, reload } = useFetch<HomeHero>("/api/admin/content/home-hero");
  const [open, setOpen] = useState(false);
  return (
    <div className="admin-card flex flex-col p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-warmgrey">Homepage hero</p>
      <p className="truncate font-display text-lg font-light">{data?.heading ?? "Loading…"}</p>
      <p className="truncate text-xs text-warmgrey">
        {data?.imageUrl ? "background image set" : "gradient background"}
      </p>
      <div className="mt-auto flex items-center justify-between pt-3">
        <a href={getShopBase() || "/"} target="_blank" rel="noreferrer" className="link-quiet text-xs">
          View live ↗
        </a>
        <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>
          Edit
        </button>
      </div>
      <SlideOver open={open} title="Homepage hero" onClose={() => setOpen(false)}>
        {data && (
          <HomeHeroForm
            hero={data}
            onSaved={() => {
              setOpen(false);
              reload();
            }}
          />
        )}
      </SlideOver>
    </div>
  );
}

// ---------- Navigation ----------

function NavigationCard() {
  const { data, reload } = useFetch<NavMenus>("/api/admin/content/navigation");
  const [open, setOpen] = useState(false);
  return (
    <div className="admin-card flex flex-col p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-warmgrey">Navigation</p>
      <p className="font-display text-lg font-light">Menus</p>
      <p className="truncate text-xs text-warmgrey">
        {data ? `${data.header.length} header · ${data.footer.length} footer links` : "Loading…"}
      </p>
      <div className="mt-auto flex items-center justify-end pt-3">
        <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>
          Edit
        </button>
      </div>
      <SlideOver open={open} title="Navigation menus" onClose={() => setOpen(false)}>
        {data && (
          <NavigationForm
            menus={data}
            onSaved={() => {
              setOpen(false);
              reload();
            }}
          />
        )}
      </SlideOver>
    </div>
  );
}

function NavLinkListEditor({
  title,
  links,
  onChange,
}: {
  title: string;
  links: { label: string; href: string }[];
  onChange: (next: { label: string; href: string }[]) => void;
}) {
  return (
    <div>
      <p className="label">{title}</p>
      <div className="space-y-2">
        {links.map((link, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              className="input flex-1"
              placeholder="Label"
              value={link.label}
              onChange={(e) => {
                const next = [...links];
                next[i] = { ...next[i], label: e.target.value };
                onChange(next);
              }}
            />
            <input
              className="input flex-1"
              placeholder="/p/slug or URL"
              value={link.href}
              onChange={(e) => {
                const next = [...links];
                next[i] = { ...next[i], href: e.target.value };
                onChange(next);
              }}
            />
            <button
              type="button"
              className="link-quiet text-xs disabled:opacity-30"
              disabled={i === 0}
              onClick={() => {
                const next = [...links];
                [next[i - 1], next[i]] = [next[i], next[i - 1]];
                onChange(next);
              }}
            >
              ↑
            </button>
            <button
              type="button"
              className="text-xs text-warmgrey hover:text-red-700"
              onClick={() => onChange(links.filter((_, j) => j !== i))}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="btn btn-secondary mt-2 !px-3 !py-1.5 !text-[0.68rem]"
        onClick={() => onChange([...links, { label: "", href: "" }])}
      >
        Add link
      </button>
    </div>
  );
}

function NavigationForm({ menus, onSaved }: { menus: NavMenus; onSaved: () => void }) {
  const [header, setHeader] = useState(menus.header);
  const [footer, setFooter] = useState(menus.footer);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.put("/api/admin/content/navigation", {
        header: header.filter((l) => l.label && l.href),
        footer: footer.filter((l) => l.label && l.href),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <NavLinkListEditor title="Header menu" links={header} onChange={setHeader} />
      <NavLinkListEditor title="Footer menu" links={footer} onChange={setFooter} />
      <p className="text-xs text-warmgrey">
        New pages live at /p/&lt;slug&gt; — add them here so visitors can find them.
      </p>
      {error && <p className="field-error">{error}</p>}
      <button type="submit" disabled={busy} className="btn btn-primary w-full">
        {busy ? "Saving…" : "Save menus"}
      </button>
    </form>
  );
}

// ---------- Brand voice ----------

function BrandVoiceCard() {
  const { data, reload } = useFetch<{ voice: string }>("/api/admin/content/brand-voice");
  const [open, setOpen] = useState(false);
  const [voice, setVoice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const value = voice ?? data?.voice ?? "";

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api.put("/api/admin/content/brand-voice", { voice: value });
      setOpen(false);
      setVoice(null);
      reload();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-card flex flex-col p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-warmgrey">Brand voice</p>
      <p className="font-display text-lg font-light">How LLM writes for you</p>
      <p className="truncate text-xs text-warmgrey">
        {data ? (data.voice ? data.voice.slice(0, 60) : "Not set — using the editorial default") : "Loading…"}
      </p>
      <div className="mt-auto flex items-center justify-end pt-3">
        <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>
          Edit
        </button>
      </div>
      <SlideOver open={open} title="Brand voice" onClose={() => setOpen(false)}>
        <div className="space-y-4">
          <p className="text-sm text-warmgrey">
            Describe how your brand sounds — a few sentences plus words you never use. Every LLM
            feature (drafting, rewriting, the site starter) follows this.
          </p>
          <textarea
            rows={8}
            className="input"
            placeholder={
              "e.g. We write plainly and warmly, like a letter from the workshop. Short sentences. We name materials and places precisely. We never use: elevate, timeless, luxurious, must-have."
            }
            value={value}
            onChange={(e) => setVoice(e.target.value)}
          />
          {error && <p className="field-error">{error}</p>}
          <button type="button" disabled={busy} className="btn btn-primary w-full" onClick={() => void save()}>
            {busy ? "Saving…" : "Save voice"}
          </button>
        </div>
      </SlideOver>
    </div>
  );
}

// ---------- Site starter ----------

function SiteStarterCard({ onApplied }: { onApplied: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="admin-card flex flex-col p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-warmgrey">Site starter</p>
      <p className="font-display text-lg font-light">Rough in the whole site</p>
      <p className="text-xs text-warmgrey">One interview → story, FAQ, press, hero & first post as drafts.</p>
      <div className="mt-auto flex items-center justify-end pt-3">
        <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>
          Start
        </button>
      </div>
      <SlideOver open={open} title="Site starter" onClose={() => setOpen(false)}>
        <SiteStarterForm
          onApplied={() => {
            onApplied();
          }}
        />
      </SlideOver>
    </div>
  );
}

interface StarterResult {
  results: { item: string; status: string; note?: string }[];
  homeHero: HomeHero | null;
}

function SiteStarterForm({ onApplied }: { onApplied: () => void }) {
  const [form, setForm] = useState({
    whatYouMake: "",
    whereMade: "",
    audience: "",
    pricePosture: "",
    differentiator: "",
    toneWords: "",
    extras: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<StarterResult | null>(null);
  const [heroApplied, setHeroApplied] = useState(false);

  async function generate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<StarterResult>("/api/admin/content/ai-site-starter", {
        whatYouMake: form.whatYouMake,
        whereMade: form.whereMade || undefined,
        audience: form.audience || undefined,
        pricePosture: form.pricePosture || undefined,
        differentiator: form.differentiator || undefined,
        toneWords: form.toneWords || undefined,
        extras: form.extras || undefined,
      });
      setResult(res);
      onApplied();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Generation failed");
    } finally {
      setBusy(false);
    }
  }

  async function applyHero() {
    if (!result?.homeHero) return;
    setBusy(true);
    try {
      await api.put("/api/admin/content/home-hero", result.homeHero);
      setHeroApplied(true);
      onApplied();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Hero apply failed");
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <div className="space-y-4">
        <p className="text-sm">Done — everything below landed as drafts for you to review and publish:</p>
        <ul className="space-y-1.5 text-sm">
          {result.results.map((r, i) => (
            <li key={i} className="flex items-center justify-between gap-2">
              <span>{r.item}</span>
              <span className={`badge ${r.status === "skipped" ? "badge-neutral" : "badge-success"}`}>
                {r.status}
                {r.note ? ` — ${r.note}` : ""}
              </span>
            </li>
          ))}
        </ul>
        {result.homeHero && (
          <div className="rounded bg-cream px-3 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-warmgrey">
              Suggested homepage hero
            </p>
            <p className="mt-1 font-display text-lg font-light">{result.homeHero.heading}</p>
            {result.homeHero.subheading && (
              <p className="text-xs text-warmgrey">{result.homeHero.subheading}</p>
            )}
            <button
              type="button"
              disabled={busy || heroApplied}
              className="btn btn-primary mt-3 w-full"
              onClick={() => void applyHero()}
            >
              {heroApplied ? "Hero applied ✓" : "Apply hero (goes live immediately)"}
            </button>
          </div>
        )}
        {error && <p className="field-error">{error}</p>}
      </div>
    );
  }

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [key]: e.target.value });

  return (
    <form onSubmit={generate} className="space-y-4">
      <p className="text-sm text-warmgrey">
        Answer what you can — LLM drafts your story page, FAQ, press page, first journal post, a
        homepage hero, and a brand voice. Everything arrives as drafts; nothing publishes itself.
      </p>
      <div>
        <label className="label">What do you make? *</label>
        <textarea required rows={2} className="input" value={form.whatYouMake} onChange={set("whatYouMake")} />
      </div>
      <div>
        <label className="label">Where is it made?</label>
        <input className="input" value={form.whereMade} onChange={set("whereMade")} />
      </div>
      <div>
        <label className="label">Who is it for?</label>
        <input className="input" value={form.audience} onChange={set("audience")} />
      </div>
      <div>
        <label className="label">Price posture</label>
        <input className="input" placeholder="e.g. premium but honest — $150–$400" value={form.pricePosture} onChange={set("pricePosture")} />
      </div>
      <div>
        <label className="label">What makes you different?</label>
        <textarea rows={2} className="input" value={form.differentiator} onChange={set("differentiator")} />
      </div>
      <div>
        <label className="label">Three words for the tone</label>
        <input className="input" placeholder="e.g. warm, precise, unhurried" value={form.toneWords} onChange={set("toneWords")} />
      </div>
      <div>
        <label className="label">Anything else worth knowing?</label>
        <textarea rows={2} className="input" value={form.extras} onChange={set("extras")} />
      </div>
      {error && <p className="field-error">{error}</p>}
      <button type="submit" disabled={busy} className="btn btn-primary w-full">
        {busy ? "Writing your site… (~30s)" : "Generate the starter site"}
      </button>
    </form>
  );
}

function HomeHeroForm({ hero, onSaved }: { hero: HomeHero; onSaved: () => void }) {
  const [form, setForm] = useState({
    eyebrow: hero.eyebrow ?? "",
    heading: hero.heading ?? "",
    subheading: hero.subheading ?? "",
    primaryCtaLabel: hero.primaryCtaLabel ?? "",
    primaryCtaHref: hero.primaryCtaHref ?? "",
    secondaryCtaLabel: hero.secondaryCtaLabel ?? "",
    secondaryCtaHref: hero.secondaryCtaHref ?? "",
    imageUrl: hero.imageUrl ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.put("/api/admin/content/home-hero", {
        eyebrow: form.eyebrow || null,
        heading: form.heading,
        subheading: form.subheading || null,
        primaryCtaLabel: form.primaryCtaLabel || null,
        primaryCtaHref: form.primaryCtaHref || null,
        secondaryCtaLabel: form.secondaryCtaLabel || null,
        secondaryCtaHref: form.secondaryCtaHref || null,
        imageUrl: form.imageUrl || null,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [key]: e.target.value });

  return (
    <form onSubmit={save} className="space-y-4">
      <div>
        <label className="label">Kicker (small line above the heading)</label>
        <input className="input" value={form.eyebrow} onChange={set("eyebrow")} />
      </div>
      <div>
        <label className="label">Heading *</label>
        <input required className="input" value={form.heading} onChange={set("heading")} />
      </div>
      <div>
        <label className="label">Subheading</label>
        <textarea rows={3} className="input" value={form.subheading} onChange={set("subheading")} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Button 1 label</label>
          <input className="input" value={form.primaryCtaLabel} onChange={set("primaryCtaLabel")} />
        </div>
        <div>
          <label className="label">Button 1 link</label>
          <input className="input" placeholder="/products" value={form.primaryCtaHref} onChange={set("primaryCtaHref")} />
        </div>
        <div>
          <label className="label">Button 2 label</label>
          <input className="input" value={form.secondaryCtaLabel} onChange={set("secondaryCtaLabel")} />
        </div>
        <div>
          <label className="label">Button 2 link</label>
          <input className="input" placeholder="/story" value={form.secondaryCtaHref} onChange={set("secondaryCtaHref")} />
        </div>
      </div>
      <div>
        <label className="label">Background image (optional — text renders on top)</label>
        <ImageField value={form.imageUrl} onChange={(url) => setForm({ ...form, imageUrl: url })} />
      </div>
      {error && <p className="field-error">{error}</p>}
      <button type="submit" disabled={busy} className="btn btn-primary w-full">
        {busy ? "Saving…" : "Save hero"}
      </button>
    </form>
  );
}

function PageEditor({ page, onSaved }: { page: PageRow; onSaved: () => void }) {
  const [form, setForm] = useState({
    title: page.title,
    body: page.body_md ?? "",
    layout: (page.layout ?? "standard") as PageLayout,
    heroImageUrl: page.hero_image_url ?? "",
    heroEyebrow: page.hero_eyebrow ?? "",
    subtitle: page.subtitle ?? "",
    metaTitle: page.meta_title ?? "",
    metaDescription: page.meta_description ?? "",
    publishAt: page.publish_at ?? "",
    published: Boolean(page.is_published),
  });
  const [sections, setSections] = useState<PageSection[] | null>(parseSections(page.sections_json));
  const [state, setState] = useState<"idle" | "busy" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState(false);

  useEffect(() => {
    setForm({
      title: page.title,
      body: page.body_md ?? "",
      layout: (page.layout ?? "standard") as PageLayout,
      heroImageUrl: page.hero_image_url ?? "",
      heroEyebrow: page.hero_eyebrow ?? "",
      subtitle: page.subtitle ?? "",
      metaTitle: page.meta_title ?? "",
      metaDescription: page.meta_description ?? "",
      publishAt: page.publish_at ?? "",
      published: Boolean(page.is_published),
    });
    setSections(parseSections(page.sections_json));
  }, [page]);

  async function save() {
    setState("busy");
    setError(null);
    try {
      await api.patch(`/api/admin/content/pages/${page.id}`, {
        title: form.title,
        bodyMd: form.body,
        layout: form.layout,
        heroImageUrl: form.heroImageUrl || null,
        heroEyebrow: form.heroEyebrow || null,
        subtitle: form.subtitle || null,
        sections,
        metaTitle: form.metaTitle || null,
        metaDescription: form.metaDescription || null,
        publishAt: form.publishAt ? form.publishAt.replace("T", " ") : null,
        isPublished: form.published,
      });
      setState("saved");
      setTimeout(() => setState("idle"), 1800);
      onSaved();
    } catch (err) {
      setState("idle");
      setError(err instanceof ApiRequestError ? err.message : "Save failed");
    }
  }

  const selectedLayout = LAYOUT_OPTIONS.find((l) => l.value === form.layout);
  const isHome = page.slug === "home";

  return (
    <div className="admin-card space-y-4 p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-64 flex-1">
          <label className="label">Title</label>
          <input
            className="input"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            checked={form.published}
            onChange={(e) => setForm({ ...form, published: e.target.checked })}
          />
          Published
        </label>
      </div>
      {!isHome && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Layout</label>
            <select
              className="input"
              value={form.layout}
              onChange={(e) => setForm({ ...form, layout: e.target.value as PageLayout })}
            >
              {LAYOUT_OPTIONS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
            {selectedLayout && <p className="mt-1 text-xs text-warmgrey">{selectedLayout.hint}</p>}
          </div>
          <div>
            <label className="label">Kicker (small line above the title)</label>
            <input
              className="input"
              value={form.heroEyebrow}
              onChange={(e) => setForm({ ...form, heroEyebrow: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Subtitle (one line under the title)</label>
            <input
              className="input"
              value={form.subtitle}
              onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Hero image</label>
            <ImageField
              value={form.heroImageUrl}
              onChange={(url) => setForm({ ...form, heroImageUrl: url })}
            />
          </div>
        </div>
      )}

      {sections ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="label !mb-0">Blocks ({sections.length})</label>
            {!isHome && (
              <button
                type="button"
                className="link-quiet text-xs"
                onClick={() => {
                  if (
                    window.confirm(
                      "Switch to a simple markdown page? The block layout is kept in revision history.",
                    )
                  ) {
                    setSections(null);
                  }
                }}
              >
                Switch to markdown
              </button>
            )}
          </div>
          <BlockEditor sections={sections} onChange={setSections} />
        </div>
      ) : (
        <>
          <MarkdownEditor value={form.body} onChange={(body) => setForm({ ...form, body })} />
          <button
            type="button"
            className="link-quiet text-xs"
            onClick={() =>
              setSections(form.body.trim() ? [{ type: "prose", markdown: form.body }] : [])
            }
          >
            ⧉ Convert to blocks — compose this page from sections (galleries, product grids, CTAs…)
          </button>
        </>
      )}

      <SeoFields
        metaTitle={form.metaTitle}
        metaDescription={form.metaDescription}
        onChange={(patch) => setForm({ ...form, ...patch })}
        sourceTitle={form.title}
        sourceBody={sections ? JSON.stringify(sections) : form.body}
      />

      {!form.published && (
        <div className="flex items-center gap-3">
          <label className="label !mb-0">Publish automatically at</label>
          <input
            type="datetime-local"
            className="input !w-auto"
            value={form.publishAt.replace(" ", "T")}
            onChange={(e) => setForm({ ...form, publishAt: e.target.value })}
          />
          {form.publishAt && (
            <button
              type="button"
              className="link-quiet text-xs"
              onClick={() => setForm({ ...form, publishAt: "" })}
            >
              Clear
            </button>
          )}
          <span className="text-xs text-warmgrey">UTC · checked hourly</span>
        </div>
      )}

      {error && <p className="field-error">{error}</p>}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <RevisionsPanel
            listPath={`/api/admin/content/pages/${page.id}/revisions`}
            restorePath={(revId) => `/api/admin/content/pages/${page.id}/revisions/${revId}/restore`}
            onRestored={onSaved}
          />
          <button type="button" className="link-quiet text-xs" onClick={() => setAiOpen(true)}>
            ✨ Draft with LLM
          </button>
          <button
            type="button"
            className="text-xs text-warmgrey hover:text-red-700 hover:underline"
            onClick={() => {
              if (window.confirm(`Delete “${page.title}”? A final snapshot stays in history.`)) {
                void api.delete(`/api/admin/content/pages/${page.id}`).then(onSaved);
              }
            }}
          >
            Delete
          </button>
        </div>
        <div className="flex items-center gap-3">
          <PreviewLink path={isHome ? "/" : `/p/${page.slug}`} />
          <a
            href={isHome ? getShopBase() || "/" : `${getShopBase()}/p/${page.slug}`}
            target="_blank"
            rel="noreferrer"
            className="link-quiet text-xs"
          >
            View live ↗
          </a>
          <button type="button" className="btn btn-primary" disabled={state === "busy"} onClick={() => void save()}>
            {state === "busy" ? "Saving…" : state === "saved" ? "Saved ✓" : "Save"}
          </button>
        </div>
      </div>
      <SlideOver open={aiOpen} title="Draft this page with LLM" onClose={() => setAiOpen(false)}>
        <AiDraftAssistant
          kind="page"
          onAccept={(draft) => {
            setForm({
              ...form,
              title: draft.title,
              body: draft.bodyMd,
              heroEyebrow: draft.heroEyebrow ?? form.heroEyebrow,
              subtitle: draft.subtitle ?? form.subtitle,
            });
            setAiOpen(false);
          }}
        />
      </SlideOver>
    </div>
  );
}

/** Turn a title into a URL slug ("Press & FAQs" → "press-faqs"). */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

interface PageTemplate {
  key: string;
  label: string;
  description: string;
  layout: PageLayout;
  sections: PageSection[] | null;
}

const PAGE_TEMPLATES: PageTemplate[] = [
  {
    key: "blank",
    label: "Blank (markdown)",
    description: "A simple text page — guides, legal, anything written.",
    layout: "standard",
    sections: null,
  },
  {
    key: "landing",
    label: "Campaign landing",
    description: "Hero → image+text → products → quote → call to action.",
    layout: "standard",
    sections: [
      { type: "hero", eyebrow: "New", heading: "Name the moment.", subheading: "One or two sentences that set the scene.", ctaLabel: "Shop now", ctaHref: "/products" },
      { type: "image_text", eyebrow: "The idea", heading: "Why this exists", body: "Tell the story behind this campaign or drop.", imageSide: "right" },
      { type: "product_grid", eyebrow: "The pieces", heading: "In this drop", source: "featured", limit: 4 },
      { type: "quote", text: "A line from press, a customer, or the founder.", attribution: "Who said it" },
      { type: "cta_band", heading: "Don't miss the window.", ctaLabel: "Shop the drop", ctaHref: "/products", dark: true },
    ],
  },
  {
    key: "about",
    label: "About / Story",
    description: "Prose → image+text → quote → email signup.",
    layout: "standard",
    sections: [
      { type: "prose", markdown: "## Where it started\n\nYour founding story goes here.\n\n## What we believe\n\nThe principles that shape what you make." },
      { type: "image_text", eyebrow: "The people", heading: "Who makes it", body: "Introduce the makers, the workshop, the place.", imageSide: "left" },
      { type: "quote", text: "The sentence that sums up the brand.", attribution: "Founder" },
      { type: "newsletter", heading: "Follow along.", body: "Occasional letters — new work, no noise.", kind: "newsletter" },
    ],
  },
  {
    key: "faq",
    label: "FAQ",
    description: "Expandable Q&A plus a contact prompt.",
    layout: "standard",
    sections: [
      {
        type: "faq",
        items: [
          { q: "How does sizing run?", a: "Answer honestly — link the size guide." },
          { q: "Where do you ship, and how fast?", a: "Regions, carriers, and typical timelines." },
          { q: "What is your return policy?", a: "Windows, conditions, and how to start one." },
        ],
      },
      { type: "cta_band", heading: "Still wondering about something?", ctaLabel: "Write to us", ctaHref: "/contact", dark: false },
    ],
  },
  {
    key: "press",
    label: "Press",
    description: "Facts for journalists, an image gallery, and a contact CTA.",
    layout: "wide",
    sections: [
      { type: "prose", markdown: "## The short version\n\nTwo paragraphs a journalist can lift verbatim: what you make, where, and why it matters.\n\n## Facts\n\n- Founded:\n- Based:\n- Produced:\n- Price range:" },
      { type: "gallery", columns: 3, images: [] },
      { type: "cta_band", heading: "Press inquiries", body: "We reply quickly.", ctaLabel: "Contact", ctaHref: "/contact", dark: true },
    ],
  },
];

function PageCreateForm({ onCreated }: { onCreated: () => void }) {
  const [mode, setMode] = useState<"form" | "ai">("form");
  const [form, setForm] = useState({ slug: "", title: "" });
  const [templateKey, setTemplateKey] = useState("blank");
  const [draft, setDraft] = useState<AiContentDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const template = PAGE_TEMPLATES.find((t) => t.key === templateKey) ?? PAGE_TEMPLATES[0];
    try {
      await api.post("/api/admin/content/pages", {
        slug: form.slug,
        title: form.title,
        bodyMd: draft?.bodyMd,
        heroEyebrow: draft?.heroEyebrow ?? undefined,
        subtitle: draft?.subtitle ?? undefined,
        // An LLM draft is markdown — it wins over a block template.
        layout: template.layout,
        sections: draft ? null : template.sections,
        isPublished: false,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  if (mode === "ai") {
    return (
      <div className="space-y-4">
        <button type="button" className="link-quiet text-xs" onClick={() => setMode("form")}>
          ← Back to the blank form
        </button>
        <AiDraftAssistant
          kind="page"
          onAccept={(accepted) => {
            setDraft(accepted);
            setForm({
              title: accepted.title,
              slug: accepted.slug ?? slugify(accepted.title),
            });
            setMode("form");
          }}
        />
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <button type="button" className="btn btn-secondary w-full" onClick={() => setMode("ai")}>
        ✨ Answer a few questions — LLM drafts it
      </button>
      <p className="text-center text-xs text-warmgrey">or start from scratch:</p>
      <div>
        <label className="label">Title *</label>
        <input
          required
          className="input"
          value={form.title}
          onChange={(e) =>
            setForm({
              title: e.target.value,
              slug: form.slug && form.slug !== slugify(form.title) ? form.slug : slugify(e.target.value),
            })
          }
        />
      </div>
      <div>
        <label className="label">Slug * (URL: /p/your-slug)</label>
        <input
          required
          className="input"
          placeholder="press-kit"
          value={form.slug}
          onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })}
        />
      </div>
      {!draft && (
        <div>
          <label className="label">Start from</label>
          <select className="input" value={templateKey} onChange={(e) => setTemplateKey(e.target.value)}>
            {PAGE_TEMPLATES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-warmgrey">
            {PAGE_TEMPLATES.find((t) => t.key === templateKey)?.description}
          </p>
        </div>
      )}
      {draft && (
        <p className="rounded bg-palm/10 px-3 py-2 text-xs text-palm">
          LLM draft attached ({draft.bodyMd.split(/\s+/).length} words) — it lands in the editor
          after you create the page.
        </p>
      )}
      <p className="text-xs text-warmgrey">
        New pages start as drafts and are reachable at /p/&lt;slug&gt; once published. The built-in
        pages (story, atelier, size-guide…) keep their existing URLs.
      </p>
      {error && <p className="field-error">{error}</p>}
      <button type="submit" disabled={busy} className="btn btn-primary w-full">
        {busy ? "Creating…" : "Create draft page"}
      </button>
    </form>
  );
}

// ============================================================
// Journal
// ============================================================

interface JournalRow {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body_md: string | null;
  hero_image_url: string | null;
  author: string | null;
  published_at: string | null;
  publish_at: string | null;
  meta_title: string | null;
  meta_description: string | null;
  is_published: number;
}

export function JournalEditorPage() {
  const { data, loading, error, reload } = useFetch<JournalRow[]>("/api/admin/content/journal");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const selected = data?.find((p) => p.id === selectedId) ?? null;

  return (
    <div>
      <PageHeader
        eyebrow="Content"
        title="Journal"
        description="Editorial posts for the public journal. Drafts stay hidden until published."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setCreateOpen(true)}>
            New post
          </button>
        }
      />
      {error && <ErrorNote message={error} />}
      {loading && <LoadingTable />}
      {data && (
        <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
          <div className="space-y-1.5">
            {data.map((post) => (
              <button
                key={post.id}
                type="button"
                onClick={() => setSelectedId(post.id)}
                className={`admin-card w-full p-3 text-left transition-colors ${
                  selectedId === post.id ? "!border-navy ring-1 ring-navy" : "hover:border-ink/25"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium">{post.title}</p>
                  <span className={`badge ${post.is_published ? "badge-success" : "badge-neutral"}`}>
                    {post.is_published ? "live" : "draft"}
                  </span>
                </div>
                <p className="text-xs text-warmgrey">
                  /journal/{post.slug} · {formatDate(post.published_at)}
                </p>
              </button>
            ))}
            {data.length === 0 && (
              <p className="p-3 text-sm text-warmgrey">No posts yet — write the first entry.</p>
            )}
          </div>
          <div>
            {selected ? (
              <JournalEditor key={selected.id} post={selected} onSaved={reload} />
            ) : (
              <EmptyState title="Pick a post to edit" hint="Or create a new one — drafts are private until published." />
            )}
          </div>
        </div>
      )}
      <SlideOver open={createOpen} title="New journal post" onClose={() => setCreateOpen(false)}>
        <JournalCreateForm
          onCreated={() => {
            setCreateOpen(false);
            reload();
          }}
        />
      </SlideOver>
    </div>
  );
}

function JournalEditor({ post, onSaved }: { post: JournalRow; onSaved: () => void }) {
  const [form, setForm] = useState({
    title: post.title,
    excerpt: post.excerpt ?? "",
    body: post.body_md ?? "",
    author: post.author ?? "",
    publishedAt: post.published_at ?? "",
    publishAt: post.publish_at ?? "",
    metaTitle: post.meta_title ?? "",
    metaDescription: post.meta_description ?? "",
    heroImageUrl: post.hero_image_url ?? "",
    published: Boolean(post.is_published),
  });
  const [state, setState] = useState<"idle" | "busy" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState(false);

  async function save() {
    setState("busy");
    setError(null);
    try {
      await api.patch(`/api/admin/content/journal/${post.id}`, {
        title: form.title,
        excerpt: form.excerpt || undefined,
        bodyMd: form.body,
        author: form.author || undefined,
        publishedAt: form.publishedAt || null,
        publishAt: form.publishAt ? form.publishAt.replace("T", " ") : null,
        metaTitle: form.metaTitle || null,
        metaDescription: form.metaDescription || null,
        heroImageUrl: form.heroImageUrl || null,
        isPublished: form.published,
      });
      setState("saved");
      setTimeout(() => setState("idle"), 1800);
      onSaved();
    } catch (err) {
      setState("idle");
      setError(err instanceof ApiRequestError ? err.message : "Save failed");
    }
  }

  return (
    <div className="admin-card space-y-4 p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">Title</label>
          <input
            className="input"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Excerpt (shown in the journal index)</label>
          <textarea
            rows={2}
            className="input"
            value={form.excerpt}
            onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Author</label>
          <input
            className="input"
            value={form.author}
            onChange={(e) => setForm({ ...form, author: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Publish date</label>
          <input
            type="date"
            className="input"
            value={form.publishedAt}
            onChange={(e) => setForm({ ...form, publishedAt: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Hero image</label>
          <ImageField
            value={form.heroImageUrl}
            onChange={(url) => setForm({ ...form, heroImageUrl: url })}
          />
        </div>
      </div>
      <MarkdownEditor value={form.body} onChange={(body) => setForm({ ...form, body })} />
      <SeoFields
        metaTitle={form.metaTitle}
        metaDescription={form.metaDescription}
        onChange={(patch) => setForm({ ...form, ...patch })}
        sourceTitle={form.title}
        sourceBody={form.body}
      />
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.published}
            onChange={(e) => setForm({ ...form, published: e.target.checked })}
          />
          Published
        </label>
        {!form.published && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-xs text-warmgrey">or auto-publish at</span>
            <input
              type="datetime-local"
              className="input !w-auto !py-1"
              value={form.publishAt.replace(" ", "T")}
              onChange={(e) => setForm({ ...form, publishAt: e.target.value })}
            />
            <span className="text-xs text-warmgrey">UTC</span>
          </div>
        )}
      </div>
      {error && <p className="field-error">{error}</p>}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <RevisionsPanel
            listPath={`/api/admin/content/journal/${post.id}/revisions`}
            restorePath={(revId) => `/api/admin/content/journal/${post.id}/revisions/${revId}/restore`}
            onRestored={onSaved}
          />
          <button type="button" className="link-quiet text-xs" onClick={() => setAiOpen(true)}>
            ✨ Draft with LLM
          </button>
          <button
            type="button"
            className="text-xs text-warmgrey hover:text-red-700 hover:underline"
            onClick={() => {
              if (window.confirm(`Delete “${post.title}”? A final snapshot stays in history.`)) {
                void api.delete(`/api/admin/content/journal/${post.id}`).then(onSaved);
              }
            }}
          >
            Delete
          </button>
        </div>
        <div className="flex items-center gap-3">
          <PreviewLink path={`/journal/${post.slug}`} />
          <a href={`${getShopBase()}/journal/${post.slug}`} target="_blank" rel="noreferrer" className="link-quiet text-xs">
            View live ↗
          </a>
          <button type="button" className="btn btn-primary" disabled={state === "busy"} onClick={() => void save()}>
            {state === "busy" ? "Saving…" : state === "saved" ? "Saved ✓" : "Save"}
          </button>
        </div>
      </div>
      <SlideOver open={aiOpen} title="Draft this post with LLM" onClose={() => setAiOpen(false)}>
        <AiDraftAssistant
          kind="journal"
          onAccept={(draft) => {
            setForm({
              ...form,
              title: draft.title,
              body: draft.bodyMd,
              excerpt: draft.excerpt ?? form.excerpt,
            });
            setAiOpen(false);
          }}
        />
      </SlideOver>
    </div>
  );
}

function JournalCreateForm({ onCreated }: { onCreated: () => void }) {
  const [mode, setMode] = useState<"form" | "ai">("form");
  const [form, setForm] = useState({ slug: "", title: "" });
  const [draft, setDraft] = useState<AiContentDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/admin/content/journal", {
        slug: form.slug,
        title: form.title,
        bodyMd: draft?.bodyMd,
        excerpt: draft?.excerpt ?? undefined,
        isPublished: false,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  if (mode === "ai") {
    return (
      <div className="space-y-4">
        <button type="button" className="link-quiet text-xs" onClick={() => setMode("form")}>
          ← Back to the blank form
        </button>
        <AiDraftAssistant
          kind="journal"
          onAccept={(accepted) => {
            setDraft(accepted);
            setForm({
              title: accepted.title,
              slug: accepted.slug ?? slugify(accepted.title),
            });
            setMode("form");
          }}
        />
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <button type="button" className="btn btn-secondary w-full" onClick={() => setMode("ai")}>
        ✨ Answer a few questions — LLM drafts it
      </button>
      <p className="text-center text-xs text-warmgrey">or start from scratch:</p>
      <div>
        <label className="label">Title *</label>
        <input
          required
          className="input"
          value={form.title}
          onChange={(e) =>
            setForm({
              title: e.target.value,
              slug: form.slug && form.slug !== slugify(form.title) ? form.slug : slugify(e.target.value),
            })
          }
        />
      </div>
      <div>
        <label className="label">Slug * (URL: /journal/your-slug)</label>
        <input
          required
          className="input"
          placeholder="fabric-diaries-1"
          value={form.slug}
          onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })}
        />
      </div>
      {draft && (
        <p className="rounded bg-palm/10 px-3 py-2 text-xs text-palm">
          LLM draft attached ({draft.bodyMd.split(/\s+/).length} words) — it lands in the editor
          after you create the post.
        </p>
      )}
      {error && <p className="field-error">{error}</p>}
      <button type="submit" disabled={busy} className="btn btn-primary w-full">
        {busy ? "Creating…" : "Create draft post"}
      </button>
    </form>
  );
}

// ============================================================
// Lookbooks
// ============================================================

interface LookbookImageRow {
  id: string;
  image_url: string;
  caption: string | null;
  sort_order: number;
  product_id: string | null;
  product_name: string | null;
}
interface LookbookRow {
  id: string;
  slug: string;
  title: string;
  season: string | null;
  intro_copy: string | null;
  is_published: number;
  images: LookbookImageRow[];
}

export function LookbooksEditorPage() {
  const { data, loading, error, reload } = useFetch<LookbookRow[]>("/api/admin/content/lookbooks");

  return (
    <div>
      <PageHeader
        eyebrow="Content"
        title="Lookbooks"
        description="Campaign imagery for the public lookbook — upload, caption, reorder."
      />
      {error && <ErrorNote message={error} />}
      {loading && <LoadingTable />}
      {data?.length === 0 && <EmptyState title="No lookbooks" hint="Lookbooks are seeded per collection." />}
      <div className="space-y-6">
        {data?.map((book) => (
          <LookbookEditor key={book.id} book={book} onSaved={reload} />
        ))}
      </div>
    </div>
  );
}

interface ProductOption {
  id: string;
  name: string;
}

function LookbookEditor({ book, onSaved }: { book: LookbookRow; onSaved: () => void }) {
  const { data: products } = useFetch<ProductOption[]>("/api/admin/products");
  const [form, setForm] = useState({
    title: book.title,
    season: book.season ?? "",
    introCopy: book.intro_copy ?? "",
    published: Boolean(book.is_published),
  });
  const [state, setState] = useState<"idle" | "busy" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setState("busy");
    setError(null);
    try {
      await api.patch(`/api/admin/content/lookbooks/${book.id}`, {
        title: form.title,
        season: form.season || null,
        introCopy: form.introCopy || null,
        isPublished: form.published,
      });
      setState("saved");
      setTimeout(() => setState("idle"), 1800);
      onSaved();
    } catch (err) {
      setState("idle");
      setError(err instanceof ApiRequestError ? err.message : "Save failed");
    }
  }

  async function addImage(url: string) {
    await api.post(`/api/admin/content/lookbooks/${book.id}/images`, { imageUrl: url });
    onSaved();
  }

  async function removeImage(imageId: string) {
    await api.delete(`/api/admin/content/lookbooks/images/${imageId}`);
    onSaved();
  }

  async function move(image: LookbookImageRow, direction: -1 | 1) {
    const sorted = [...book.images].sort((a, b) => a.sort_order - b.sort_order);
    const index = sorted.findIndex((i) => i.id === image.id);
    const swap = sorted[index + direction];
    if (!swap) return;
    await Promise.all([
      api.patch(`/api/admin/content/lookbooks/images/${image.id}`, { sortOrder: swap.sort_order }),
      api.patch(`/api/admin/content/lookbooks/images/${swap.id}`, { sortOrder: image.sort_order }),
    ]);
    onSaved();
  }

  async function saveCaption(image: LookbookImageRow, caption: string) {
    await api.patch(`/api/admin/content/lookbooks/images/${image.id}`, { caption: caption || null });
    onSaved();
  }

  return (
    <div className="admin-card space-y-4 p-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label className="label">Title</label>
          <input
            className="input"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Season</label>
          <input
            className="input"
            value={form.season}
            onChange={(e) => setForm({ ...form, season: e.target.value })}
          />
        </div>
        <div className="sm:col-span-3">
          <label className="label">Intro copy</label>
          <textarea
            rows={2}
            className="input"
            value={form.introCopy}
            onChange={(e) => setForm({ ...form, introCopy: e.target.value })}
          />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.published}
            onChange={(e) => setForm({ ...form, published: e.target.checked })}
          />
          Published
        </label>
        <div className="flex items-center gap-3">
          <ImageUploadButton label="Add image" entityType="general" onUploaded={(url) => void addImage(url)} />
          <button type="button" className="btn btn-primary" disabled={state === "busy"} onClick={() => void save()}>
            {state === "busy" ? "Saving…" : state === "saved" ? "Saved ✓" : "Save details"}
          </button>
        </div>
      </div>
      {error && <p className="field-error">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...book.images]
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((image, index, arr) => (
            <div key={image.id} className="space-y-2">
              <EditorialImage
                src={image.image_url}
                alt={image.caption ?? book.title}
                label={image.caption ?? `Image ${index + 1}`}
                aspect="aspect-[4/3]"
              />
              <input
                className="input !py-1.5 text-xs"
                defaultValue={image.caption ?? ""}
                placeholder="Caption"
                onBlur={(e) => {
                  if (e.target.value !== (image.caption ?? "")) {
                    void saveCaption(image, e.target.value);
                  }
                }}
              />
              <select
                className="input !py-1.5 text-xs"
                value={image.product_id ?? ""}
                onChange={(e) => {
                  void api
                    .patch(`/api/admin/content/lookbooks/images/${image.id}`, {
                      productId: e.target.value || null,
                    })
                    .then(onSaved);
                }}
              >
                <option value="">No shop link</option>
                {products?.map((p) => (
                  <option key={p.id} value={p.id}>
                    Shop: {p.name}
                  </option>
                ))}
              </select>
              <div className="flex items-center justify-between text-xs">
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="link-quiet disabled:opacity-30"
                    disabled={index === 0}
                    onClick={() => void move(image, -1)}
                  >
                    ← Move
                  </button>
                  <button
                    type="button"
                    className="link-quiet disabled:opacity-30"
                    disabled={index === arr.length - 1}
                    onClick={() => void move(image, 1)}
                  >
                    Move →
                  </button>
                </div>
                <button
                  type="button"
                  className="text-red-700 hover:underline"
                  onClick={() => {
                    if (window.confirm("Remove this image from the lookbook?")) {
                      void removeImage(image.id);
                    }
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
