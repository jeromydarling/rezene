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
  ImageUploadButton,
  MarkdownEditor,
  RevisionsPanel,
} from "../../components/admin/cms";
import { EditorialImage } from "../../components/ImagePlaceholder";

// ============================================================
// Pages
// ============================================================

interface PageRow {
  id: string;
  slug: string;
  title: string;
  body_md: string | null;
  is_published: number;
  updated_at: string;
}

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
        description="The editorial pages of the public site — story, atelier, size guide, legal. Every save keeps a restorable revision."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setCreateOpen(true)}>
            New page
          </button>
        }
      />
      {error && <ErrorNote message={error} />}
      {loading && <LoadingTable />}
      {data && (
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
                <p className="text-xs text-warmgrey">/{page.slug}</p>
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

function PageEditor({ page, onSaved }: { page: PageRow; onSaved: () => void }) {
  const [title, setTitle] = useState(page.title);
  const [body, setBody] = useState(page.body_md ?? "");
  const [published, setPublished] = useState(Boolean(page.is_published));
  const [state, setState] = useState<"idle" | "busy" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTitle(page.title);
    setBody(page.body_md ?? "");
    setPublished(Boolean(page.is_published));
  }, [page]);

  async function save() {
    setState("busy");
    setError(null);
    try {
      await api.patch(`/api/admin/content/pages/${page.id}`, {
        title,
        bodyMd: body,
        isPublished: published,
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-64 flex-1">
          <label className="label">Title</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
          />
          Published
        </label>
      </div>
      <MarkdownEditor value={body} onChange={setBody} />
      {error && <p className="field-error">{error}</p>}
      <div className="flex items-center justify-between">
        <RevisionsPanel
          listPath={`/api/admin/content/pages/${page.id}/revisions`}
          restorePath={(revId) => `/api/admin/content/pages/${page.id}/revisions/${revId}/restore`}
          onRestored={onSaved}
        />
        <div className="flex items-center gap-3">
          <a
            href={`/${page.slug === "story" || page.slug === "atelier" ? page.slug : page.slug}`}
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
    </div>
  );
}

function PageCreateForm({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState({ slug: "", title: "" });
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
        isPublished: false,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label">Title *</label>
        <input
          required
          className="input"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
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
        <RevisionsPanel
          listPath={`/api/admin/content/journal/${post.id}/revisions`}
          restorePath={(revId) => `/api/admin/content/journal/${post.id}/revisions/${revId}/restore`}
          onRestored={onSaved}
        />
        <div className="flex items-center gap-3">
          <a href={`/journal/${post.slug}`} target="_blank" rel="noreferrer" className="link-quiet text-xs">
            View live ↗
          </a>
          <button type="button" className="btn btn-primary" disabled={state === "busy"} onClick={() => void save()}>
            {state === "busy" ? "Saving…" : state === "saved" ? "Saved ✓" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function JournalCreateForm({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState({ slug: "", title: "" });
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
        isPublished: false,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label">Title *</label>
        <input
          required
          className="input"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
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

function LookbookEditor({ book, onSaved }: { book: LookbookRow; onSaved: () => void }) {
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
