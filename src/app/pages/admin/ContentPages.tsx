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
  ImageUploadButton,
  MarkdownEditor,
  RevisionsPanel,
} from "../../components/admin/cms";
import { EditorialImage } from "../../components/ImagePlaceholder";
import type { AiContentDraft, HomeHero, PageLayout } from "../../../shared/types";

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
  is_published: number;
  updated_at: string;
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
        description="Every page of the public site — including the homepage hero. Pick a layout, set a hero image, or let AI draft the first version. Every save keeps a restorable revision."
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
          <HomeHeroCard />
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
    <div className="admin-card mb-5 flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-warmgrey">Homepage hero</p>
        <p className="truncate font-display text-lg font-light">
          {data?.heading ?? "Loading…"}
        </p>
        <p className="truncate text-xs text-warmgrey">
          {data?.eyebrow ?? ""}
          {data?.imageUrl ? " · background image set" : " · gradient background"}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <a href="/" target="_blank" rel="noreferrer" className="link-quiet text-xs">
          View live ↗
        </a>
        <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>
          Edit hero
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
        <div className="flex items-center gap-3">
          <input
            className="input flex-1"
            placeholder="Empty = soft gradient"
            value={form.imageUrl}
            onChange={set("imageUrl")}
          />
          <ImageUploadButton entityType="general" onUploaded={(url) => setForm({ ...form, imageUrl: url })} />
        </div>
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
    published: Boolean(page.is_published),
  });
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
      published: Boolean(page.is_published),
    });
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
          <div className="flex items-center gap-3">
            <input
              className="input flex-1"
              placeholder="/media/… or external URL"
              value={form.heroImageUrl}
              onChange={(e) => setForm({ ...form, heroImageUrl: e.target.value })}
            />
            <ImageUploadButton
              entityType="page"
              onUploaded={(url) => setForm({ ...form, heroImageUrl: url })}
            />
          </div>
        </div>
      </div>
      <MarkdownEditor value={form.body} onChange={(body) => setForm({ ...form, body })} />
      {error && <p className="field-error">{error}</p>}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <RevisionsPanel
            listPath={`/api/admin/content/pages/${page.id}/revisions`}
            restorePath={(revId) => `/api/admin/content/pages/${page.id}/revisions/${revId}/restore`}
            onRestored={onSaved}
          />
          <button type="button" className="link-quiet text-xs" onClick={() => setAiOpen(true)}>
            ✨ Draft with AI
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
          <a href={`/p/${page.slug}`} target="_blank" rel="noreferrer" className="link-quiet text-xs">
            View live ↗
          </a>
          <button type="button" className="btn btn-primary" disabled={state === "busy"} onClick={() => void save()}>
            {state === "busy" ? "Saving…" : state === "saved" ? "Saved ✓" : "Save"}
          </button>
        </div>
      </div>
      <SlideOver open={aiOpen} title="Draft this page with AI" onClose={() => setAiOpen(false)}>
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

function PageCreateForm({ onCreated }: { onCreated: () => void }) {
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
      await api.post("/api/admin/content/pages", {
        slug: form.slug,
        title: form.title,
        bodyMd: draft?.bodyMd,
        heroEyebrow: draft?.heroEyebrow ?? undefined,
        subtitle: draft?.subtitle ?? undefined,
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
        ✨ Answer a few questions — AI drafts it
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
      {draft && (
        <p className="rounded bg-palm/10 px-3 py-2 text-xs text-palm">
          AI draft attached ({draft.bodyMd.split(/\s+/).length} words) — it lands in the editor
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
          <div className="flex items-center gap-3">
            <input
              className="input flex-1"
              placeholder="/media/… or external URL"
              value={form.heroImageUrl}
              onChange={(e) => setForm({ ...form, heroImageUrl: e.target.value })}
            />
            <ImageUploadButton
              entityType="journal"
              onUploaded={(url) => setForm({ ...form, heroImageUrl: url })}
            />
          </div>
        </div>
      </div>
      <MarkdownEditor value={form.body} onChange={(body) => setForm({ ...form, body })} />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.published}
          onChange={(e) => setForm({ ...form, published: e.target.checked })}
        />
        Published
      </label>
      {error && <p className="field-error">{error}</p>}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <RevisionsPanel
            listPath={`/api/admin/content/journal/${post.id}/revisions`}
            restorePath={(revId) => `/api/admin/content/journal/${post.id}/revisions/${revId}/restore`}
            onRestored={onSaved}
          />
          <button type="button" className="link-quiet text-xs" onClick={() => setAiOpen(true)}>
            ✨ Draft with AI
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
          <a href={`/journal/${post.slug}`} target="_blank" rel="noreferrer" className="link-quiet text-xs">
            View live ↗
          </a>
          <button type="button" className="btn btn-primary" disabled={state === "busy"} onClick={() => void save()}>
            {state === "busy" ? "Saving…" : state === "saved" ? "Saved ✓" : "Save"}
          </button>
        </div>
      </div>
      <SlideOver open={aiOpen} title="Draft this post with AI" onClose={() => setAiOpen(false)}>
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
        ✨ Answer a few questions — AI drafts it
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
          AI draft attached ({draft.bodyMd.split(/\s+/).length} words) — it lands in the editor
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
