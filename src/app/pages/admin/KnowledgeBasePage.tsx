import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router";
import { api, ApiRequestError } from "../../lib/api";
import { useToast } from "../../lib/toast";
import { useAuth } from "../../lib/auth";
import { SlideOver } from "../../components/admin/ui";
import { KbMarkdown, extractHeadings } from "../../kb/KbMarkdown";
import { KB_PARTS, articlesByPart, mergeArticles, type KbArticle } from "../../kb";

/**
 * The Knowledge Base — a book-style reader. Left rail = table of contents
 * (parts → chapters) with search; center = the chapter; right = "on this page".
 * The in-repo book is patched at runtime by the platform admin overlay.
 */
export function KnowledgeBasePage() {
  const { slug } = useParams();
  const location = useLocation();
  const { user } = useAuth();
  const superAdmin = Boolean(user?.superAdmin);
  const [query, setQuery] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);
  const [editing, setEditing] = useState<KbArticle | "new" | null>(null);

  // Admin overlay (edits/additions on top of the in-repo book). Absent = base.
  const [overlay, setOverlay] = useState<Partial<KbArticle>[] | null>(null);
  const loadOverlay = () =>
    api
      .get<{ articles: Partial<KbArticle>[] }>("/api/admin/kb/overrides")
      .then((r) => setOverlay(r.articles ?? []))
      .catch(() => setOverlay([]));
  useEffect(() => {
    void loadOverlay();
  }, []);

  const articles = useMemo(() => mergeArticles(overlay), [overlay]);
  const current = useMemo(
    () => articles.find((a) => a.slug === slug) ?? articles.find((a) => a.slug === "welcome") ?? articles[0],
    [articles, slug],
  );
  const byPart = useMemo(() => articlesByPart(articles), [articles]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return articles.filter((a) =>
      `${a.title} ${a.summary} ${a.part} ${a.keywords ?? ""} ${a.body}`.toLowerCase().includes(q),
    );
  }, [articles, query]);

  const flatIndex = articles.findIndex((a) => a.slug === current?.slug);
  const prev = flatIndex > 0 ? articles[flatIndex - 1] : null;
  const next = flatIndex >= 0 && flatIndex < articles.length - 1 ? articles[flatIndex + 1] : null;

  const headings = useMemo(() => (current ? extractHeadings(current.body) : []), [current]);

  // Scroll to top on chapter change; honour an anchor if present.
  useEffect(() => {
    setTocOpen(false);
    if (location.hash) {
      const el = document.getElementById(location.hash.slice(1));
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
    }
    window.scrollTo({ top: 0 });
  }, [slug, location.hash]);

  return (
    <div>
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-warmgrey">Support</p>
          <h1 className="font-display text-2xl font-light">Knowledge Base</h1>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="btn btn-secondary lg:hidden" onClick={() => setTocOpen(true)}>
            Contents
          </button>
          {superAdmin && (
            <button type="button" className="btn btn-secondary" onClick={() => setEditing("new")}>
              + New chapter
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={() => setReportOpen(true)}>
            Report a bug or idea
          </button>
        </div>
      </div>

      <input
        className="input mb-5"
        placeholder="Search the handbook…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="grid gap-8 lg:grid-cols-[15rem_minmax(0,1fr)] xl:grid-cols-[15rem_minmax(0,1fr)_13rem]">
        {/* Left rail — TOC (hidden on mobile; drawer via Contents button) */}
        <nav
          className={`${
            tocOpen
              ? "fixed inset-0 z-40 block overflow-y-auto bg-white/95 p-6 backdrop-blur lg:static lg:z-auto lg:block lg:bg-transparent lg:p-0 lg:backdrop-blur-none"
              : "hidden lg:block"
          }`}
        >
          <div className="mb-3 flex items-center justify-between lg:hidden">
            <span className="font-display text-lg">Contents</span>
            <button type="button" className="link-quiet" onClick={() => setTocOpen(false)}>
              Close
            </button>
          </div>
          <div className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:pr-2">
            {results ? (
              <TocSearchResults results={results} currentSlug={current?.slug} />
            ) : (
              <TocTree byPart={byPart} currentSlug={current?.slug} />
            )}
          </div>
        </nav>

        {/* Center — the chapter */}
        <article className="min-w-0">
          {current && <Chapter article={current} canEdit={superAdmin} onEdit={() => setEditing(current)} />}
          {/* Prev / next */}
          <div className="mt-10 grid gap-3 border-t border-ink/10 pt-5 sm:grid-cols-2">
            {prev ? (
              <Link to={`/admin/support/kb/${prev.slug}`} className="admin-card p-3 text-left hover:bg-cream">
                <span className="block text-[0.6rem] uppercase tracking-wider text-warmgrey">← Previous</span>
                <span className="text-sm font-medium">{prev.title}</span>
              </Link>
            ) : (
              <span />
            )}
            {next && (
              <Link to={`/admin/support/kb/${next.slug}`} className="admin-card p-3 text-right hover:bg-cream sm:col-start-2">
                <span className="block text-[0.6rem] uppercase tracking-wider text-warmgrey">Next →</span>
                <span className="text-sm font-medium">{next.title}</span>
              </Link>
            )}
          </div>
        </article>

        {/* Right — on this page */}
        {headings.length > 1 && (
          <aside className="hidden xl:block">
            <div className="sticky top-4">
              <p className="mb-2 text-[0.6rem] font-semibold uppercase tracking-wider text-warmgrey">On this page</p>
              <ul className="space-y-1.5 border-l border-ink/10 text-xs">
                {headings.map((h) => (
                  <li key={h.id} className={h.level === 3 ? "pl-5" : "pl-3"}>
                    <a href={`#${h.id}`} className="block text-warmgrey hover:text-navy">
                      {h.text}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        )}
      </div>

      <SlideOver open={reportOpen} title="Report a bug or idea" onClose={() => setReportOpen(false)}>
        <ReportForm onDone={() => setReportOpen(false)} />
      </SlideOver>

      <SlideOver
        open={editing !== null}
        title={editing === "new" ? "New chapter" : "Edit chapter"}
        onClose={() => setEditing(null)}
      >
        {editing !== null && (
          <KbEditor
            article={editing === "new" ? undefined : editing}
            onSaved={() => {
              setEditing(null);
              void loadOverlay();
            }}
            onCancel={() => setEditing(null)}
          />
        )}
      </SlideOver>
    </div>
  );
}

function TocTree({ byPart, currentSlug }: { byPart: Map<string, KbArticle[]>; currentSlug?: string }) {
  return (
    <div className="space-y-5">
      {KB_PARTS.map((part) => {
        const items = byPart.get(part.slug) ?? [];
        if (items.length === 0) return null;
        return (
          <div key={part.slug}>
            <p className="mb-1.5 flex items-center gap-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-warmgrey">
              <span aria-hidden>{part.icon}</span> {part.title}
            </p>
            <ul className="space-y-0.5">
              {items.map((a) => (
                <li key={a.slug}>
                  <Link
                    to={`/admin/support/kb/${a.slug}`}
                    className={`block rounded px-2 py-1 text-sm transition ${
                      a.slug === currentSlug ? "bg-navy/8 font-medium text-navy" : "text-ink/75 hover:bg-cream hover:text-ink"
                    }`}
                  >
                    {a.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function TocSearchResults({ results, currentSlug }: { results: KbArticle[]; currentSlug?: string }) {
  if (results.length === 0) {
    return <p className="px-2 text-sm text-warmgrey">No chapters matched.</p>;
  }
  return (
    <div>
      <p className="mb-1.5 px-2 text-[0.62rem] font-semibold uppercase tracking-wider text-warmgrey">
        {results.length} result{results.length === 1 ? "" : "s"}
      </p>
      <ul className="space-y-0.5">
        {results.map((a) => (
          <li key={a.slug}>
            <Link
              to={`/admin/support/kb/${a.slug}`}
              className={`block rounded px-2 py-1.5 transition ${
                a.slug === currentSlug ? "bg-navy/8" : "hover:bg-cream"
              }`}
            >
              <span className="block text-sm font-medium text-ink">{a.title}</span>
              <span className="block text-xs text-warmgrey">{a.summary}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Chapter({ article, canEdit, onEdit }: { article: KbArticle; canEdit?: boolean; onEdit?: () => void }) {
  const part = KB_PARTS.find((p) => p.slug === article.part);
  return (
    <div>
      <nav className="mb-3 flex items-center justify-between text-xs text-warmgrey">
        <span>
          <Link to="/admin/support" className="hover:text-navy">Handbook</Link>
          {part && <> › <span>{part.title}</span></>}
          {article.custom && <span className="ml-2 rounded bg-navy/10 px-1.5 py-0.5 text-[0.6rem] text-navy">added</span>}
        </span>
        {canEdit && (
          <button type="button" className="link-quiet" onClick={onEdit}>
            Edit chapter
          </button>
        )}
      </nav>
      {article.summary && <p className="mb-4 text-base text-warmgrey">{article.summary}</p>}
      {article.screenshot && <HeroShot src={article.screenshot} alt={`${article.title} screen`} />}
      <KbMarkdown text={article.body} />
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-ink/10 pt-4 text-xs text-warmgrey">
        {article.moduleRoute ? (
          <Link to={article.moduleRoute} className="btn btn-secondary !py-1.5 text-xs">
            Open the module →
          </Link>
        ) : (
          <span />
        )}
        {article.updated && <span>Last updated {article.updated}</span>}
      </div>
    </div>
  );
}

/** Hero screenshot that removes itself if the image isn't captured yet. */
function HeroShot({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <figure className="mb-6 overflow-hidden rounded-xl border border-ink/10 bg-cream/40 shadow-sm">
      <img src={src} alt={alt} loading="lazy" className="block w-full" onError={() => setFailed(true)} />
    </figure>
  );
}

function KbEditor({
  article,
  onSaved,
  onCancel,
}: {
  article?: KbArticle;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const toast = useToast();
  const isNew = !article;
  const [form, setForm] = useState({
    slug: article?.slug ?? "",
    title: article?.title ?? "",
    summary: article?.summary ?? "",
    part: article?.part ?? "getting-started",
    moduleRoute: article?.moduleRoute ?? "",
    body: article?.body ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [feature, setFeature] = useState("");
  const [preview, setPreview] = useState(false);

  async function draft() {
    if (!feature.trim()) return toast.error("Describe the feature to document.");
    setDrafting(true);
    try {
      const d = await api.post<Partial<KbArticle>>("/api/admin/kb/draft", {
        feature,
        part: form.part,
        moduleRoute: form.moduleRoute || undefined,
      });
      setForm((f) => ({
        ...f,
        slug: f.slug || d.slug || "",
        title: d.title || f.title,
        summary: d.summary || f.summary,
        part: d.part || f.part,
        body: d.body || f.body,
      }));
      toast.success("Draft ready", "Review and edit, then Save to publish it into the handbook.");
    } catch (e) {
      toast.error(e instanceof ApiRequestError ? e.message : "Draft failed");
    } finally {
      setDrafting(false);
    }
  }

  async function save() {
    if (!form.slug.trim() || !form.title.trim() || !form.body.trim()) {
      return toast.error("Slug, title, and body are required.");
    }
    setBusy(true);
    try {
      await api.put(`/api/admin/kb/overrides/${form.slug.trim()}`, {
        title: form.title,
        summary: form.summary,
        part: form.part,
        moduleRoute: form.moduleRoute || null,
        body: form.body,
        isCustom: isNew,
      });
      onSaved();
    } catch (e) {
      toast.error(e instanceof ApiRequestError ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function revert() {
    if (!article) return;
    if (!window.confirm("Revert this chapter to the built-in version? Your edits will be removed.")) return;
    try {
      await api.delete(`/api/admin/kb/overrides/${article.slug}`);
      onSaved();
    } catch (e) {
      toast.error(e instanceof ApiRequestError ? e.message : "Revert failed");
    }
  }

  return (
    <div className="space-y-3 text-sm">
      {isNew && (
        <div className="rounded-lg border border-navy/15 bg-navy/[0.03] p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-warmgrey">✨ Draft from a feature</p>
          <textarea
            className="input"
            rows={2}
            placeholder="Describe the feature that shipped — Verto drafts the chapter in the handbook's voice."
            value={feature}
            onChange={(e) => setFeature(e.target.value)}
          />
          <button type="button" className="btn btn-secondary mt-2 w-full !py-1.5 text-xs" disabled={drafting} onClick={() => void draft()}>
            {drafting ? "Drafting…" : "Draft this chapter"}
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-warmgrey">Slug *</span>
          <input className="input" value={form.slug} disabled={!isNew} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="kebab-case" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-warmgrey">Part</span>
          <select className="input" value={form.part} onChange={(e) => setForm({ ...form, part: e.target.value })}>
            {KB_PARTS.map((p) => <option key={p.slug} value={p.slug}>{p.title}</option>)}
          </select>
        </label>
      </div>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-warmgrey">Title *</span>
        <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-warmgrey">Summary</span>
        <input className="input" value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} placeholder="One sentence — used in search & help-dots" />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-warmgrey">Module route</span>
        <input className="input" value={form.moduleRoute} onChange={(e) => setForm({ ...form, moduleRoute: e.target.value })} placeholder="/admin/products (optional)" />
      </label>
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-medium text-warmgrey">Body (Markdown) *</span>
          <button type="button" className="link-quiet text-xs" onClick={() => setPreview(!preview)}>{preview ? "Edit" : "Preview"}</button>
        </div>
        {preview ? (
          <div className="max-h-80 overflow-y-auto rounded-lg border border-ink/10 p-3">
            <KbMarkdown text={form.body} />
          </div>
        ) : (
          <textarea className="input font-mono !text-xs" rows={14} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
        )}
      </div>
      <div className="flex items-center gap-2 pt-1">
        <button type="button" className="btn btn-primary flex-1" disabled={busy} onClick={() => void save()}>
          {busy ? "Saving…" : "Save chapter"}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        {!isNew && (
          <button type="button" className="text-xs text-terracotta hover:underline" onClick={() => void revert()}>
            Revert to built-in
          </button>
        )}
      </div>
      <p className="text-[11px] text-warmgrey">Edits publish to the handbook for everyone. The in-repo book is the source of truth; this overlays on top.</p>
    </div>
  );
}

const REPORT_KINDS = [
  { value: "bug", label: "Something's broken", hint: "A bug — something didn't work as expected" },
  { value: "feature", label: "I have an idea", hint: "A feature request or improvement" },
  { value: "question", label: "I have a question", hint: "Not sure how something works" },
];

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
      <p className="text-center text-xs text-warmgrey">We automatically include the page you're on so we can find it fast.</p>
    </div>
  );
}
