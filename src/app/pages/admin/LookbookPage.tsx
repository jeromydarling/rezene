import { useEffect, useMemo, useState } from "react";
import { useFetch } from "../../lib/useFetch";
import { api, ApiRequestError } from "../../lib/api";
import { useToast } from "../../lib/toast";
import { typePairing } from "../../../shared/brand-identity";
import { collateralBrand } from "../../lib/collateral";
import { buildLookbookDoc } from "../../lib/lookbook";
import {
  LOOKBOOK_LAYOUTS,
  type LookbookLayout,
  type LookbookProduct,
  type LookbookRecord,
  type LookbookRenderModel,
  type LookbookSpread,
} from "../../../shared/lookbook";
import type { BrandSettings } from "../../../shared/types";
import { PageHeader, ErrorNote, LoadingTable, EmptyState } from "../../components/admin/ui";

/**
 * Lookbook builder: compose a print-ready seasonal magazine from your own
 * products + brand identity. Auto-populates from your catalogue; reorder,
 * relayout, and add copy; preview live and Save as PDF at magazine trim.
 */

function useBrand() {
  const settings = useFetch<BrandSettings>("/api/public/settings");
  const website = typeof window !== "undefined" ? window.location.host : "yourlabel.com";
  useEffect(() => {
    const p = typePairing(settings.data?.typography?.pairing);
    if (!p.googleUrl || document.getElementById(`brand-font-${p.key}`)) return;
    const link = document.createElement("link");
    link.id = `brand-font-${p.key}`;
    link.rel = "stylesheet";
    link.href = p.googleUrl;
    document.head.appendChild(link);
  }, [settings.data?.typography?.pairing]);
  const brand = useMemo(
    () => (settings.data ? collateralBrand(settings.data, website) : null),
    [settings.data, website],
  );
  return { brand, loading: settings.loading };
}

export function LookbookPage() {
  const list = useFetch<LookbookRecord[]>("/api/admin/print-lookbooks");
  const [editingId, setEditingId] = useState<string | null>(null);
  const toast = useToast();

  async function create() {
    try {
      const created = await api.post<LookbookRecord>("/api/admin/print-lookbooks", {});
      list.reload();
      setEditingId(created.id);
    } catch (err) {
      toast.error("Could not create lookbook", err instanceof ApiRequestError ? err.message : undefined);
    }
  }

  if (editingId) {
    return <LookbookEditor id={editingId} onBack={() => { setEditingId(null); list.reload(); }} />;
  }

  return (
    <div>
      <PageHeader
        eyebrow="Brand"
        title="Lookbook"
        help="lookbook"
        description="Turn your collection into a print-ready seasonal magazine — composed from your own pieces and brand identity. Preview it and Save as PDF at magazine trim; one-click print &amp; mail is coming next."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => void create()}>
            New lookbook
          </button>
        }
      />
      {list.error && <ErrorNote message={list.error} />}
      {list.loading && <LoadingTable rows={4} />}
      {list.data && list.data.length === 0 && (
        <EmptyState
          title="No lookbooks yet"
          hint="Create one and we'll auto-compose a first draft from your published pieces — then you arrange the spreads."
          action={<button type="button" className="btn btn-primary" onClick={() => void create()}>Create your first lookbook</button>}
        />
      )}
      {list.data && list.data.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.data.map((lb) => (
            <button
              key={lb.id}
              type="button"
              onClick={() => setEditingId(lb.id)}
              className="admin-card p-5 text-left transition hover:border-navy"
            >
              <p className="font-display text-lg text-ink">{lb.title}</p>
              {lb.subtitle && <p className="text-sm text-warmgrey">{lb.subtitle}</p>}
              <p className="mt-3 text-xs text-warmgrey">
                {lb.spec.spreads.length} piece{lb.spec.spreads.length === 1 ? "" : "s"}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function LookbookEditor({ id, onBack }: { id: string; onBack: () => void }) {
  const model = useFetch<LookbookRenderModel>(`/api/admin/print-lookbooks/${id}`);
  const { brand, loading: brandLoading } = useBrand();
  const toast = useToast();

  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [intro, setIntro] = useState("");
  const [spreads, setSpreads] = useState<LookbookSpread[]>([]);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!model.data) return;
    const lb = model.data.lookbook;
    setTitle(lb.title);
    setSubtitle(lb.subtitle ?? "");
    setIntro(lb.intro ?? "");
    setSpreads(lb.spec.spreads);
  }, [model.data]);

  const catalog: LookbookProduct[] = model.data?.catalog ?? [];
  const byId = useMemo(() => new Map(catalog.map((p) => [p.id, p])), [catalog]);
  const inBook = new Set(spreads.map((s) => s.productId));
  const available = catalog.filter((p) => !inBook.has(p.id));

  // Build the live preview model from local edits (so unsaved changes show).
  const previewDoc = useMemo(() => {
    if (!brand || !model.data) return "";
    const resolved = spreads
      .map((s) => {
        const product = byId.get(s.productId);
        return product ? { product, layout: s.layout, caption: s.caption ?? "" } : null;
      })
      .filter((s): s is { product: LookbookProduct; layout: LookbookLayout; caption: string } => s !== null);
    return buildLookbookDoc(
      {
        lookbook: { ...model.data.lookbook, title, subtitle, intro, spec: { spreads } },
        spreads: resolved,
        catalog,
      },
      brand,
    );
  }, [brand, model.data, spreads, title, subtitle, intro, byId, catalog]);

  async function save(patch: Record<string, unknown>) {
    try {
      await api.patch(`/api/admin/print-lookbooks/${id}`, patch);
      setSavedAt(new Date().toLocaleTimeString());
    } catch (err) {
      toast.error("Save failed", err instanceof ApiRequestError ? err.message : undefined);
    }
  }
  const saveSpreads = (next: LookbookSpread[]) => { setSpreads(next); void save({ spec: { spreads: next } }); };

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= spreads.length) return;
    const next = spreads.slice();
    [next[i], next[j]] = [next[j], next[i]];
    saveSpreads(next);
  }
  const remove = (i: number) => saveSpreads(spreads.filter((_, k) => k !== i));
  const setLayout = (i: number, layout: LookbookLayout) =>
    saveSpreads(spreads.map((s, k) => (k === i ? { ...s, layout } : s)));
  const setCaption = (i: number, caption: string) =>
    setSpreads(spreads.map((s, k) => (k === i ? { ...s, caption } : s)));
  const addPiece = (productId: string) =>
    saveSpreads([...spreads, { productId, layout: "clean", caption: "" }]);

  function downloadPdf() {
    if (!previewDoc) return;
    const w = window.open("", "_blank");
    if (!w) {
      toast.error("Pop-up blocked", "Allow pop-ups to open the print sheet.");
      return;
    }
    const doc = previewDoc.replace(
      "</body>",
      `<script>window.addEventListener('load',function(){setTimeout(function(){window.focus();window.print();},600);});</script></body>`,
    );
    w.document.write(doc);
    w.document.close();
  }

  if (model.loading || brandLoading) return <LoadingTable rows={6} />;
  if (model.error || !model.data) return <ErrorNote message={model.error || "Lookbook not found"} />;

  return (
    <div>
      <PageHeader
        eyebrow="Brand · Lookbook"
        title={title || "Lookbook"}
        help="lookbook"
        actions={
          <div className="flex items-center gap-2">
            {savedAt && <span className="text-xs text-warmgrey">Saved {savedAt}</span>}
            <button type="button" className="btn btn-secondary" onClick={onBack}>All lookbooks</button>
            <button type="button" className="btn btn-primary" onClick={downloadPdf}>Save as PDF</button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_460px]">
        {/* Editor */}
        <div className="space-y-5">
          <div className="admin-card space-y-3 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-warmgrey">Cover &amp; opener</h2>
            <label className="block text-xs text-warmgrey">Title
              <input className="admin-input mt-1 w-full" value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => void save({ title })} placeholder="Autumn 2026" />
            </label>
            <label className="block text-xs text-warmgrey">Subtitle
              <input className="admin-input mt-1 w-full" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} onBlur={() => void save({ subtitle })} placeholder="The season in full" />
            </label>
            <label className="block text-xs text-warmgrey">Opening note (editorial letter)
              <textarea className="admin-input mt-1 w-full" rows={4} value={intro} onChange={(e) => setIntro(e.target.value)} onBlur={() => void save({ intro })} placeholder="A few words to open the issue…" />
            </label>
          </div>

          <div className="admin-card p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-warmgrey">Spreads ({spreads.length})</h2>
            {spreads.length === 0 && <p className="text-sm text-warmgrey">No pieces yet — add some from your catalogue below.</p>}
            <div className="space-y-2">
              {spreads.map((s, i) => {
                const p = byId.get(s.productId);
                return (
                  <div key={`${s.productId}-${i}`} className="flex items-start gap-3 rounded-md border border-ink/10 p-3">
                    <div className="h-14 w-11 shrink-0 overflow-hidden rounded bg-ink/5">
                      {p?.imageUrl && <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p?.name ?? "(removed piece)"}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <select className="admin-input !py-1 text-xs" value={s.layout} onChange={(e) => setLayout(i, e.target.value as LookbookLayout)}>
                          {LOOKBOOK_LAYOUTS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
                        </select>
                        <input className="admin-input !py-1 flex-1 text-xs" placeholder="Caption (optional)" value={s.caption ?? ""} onChange={(e) => setCaption(i, e.target.value)} onBlur={() => void save({ spec: { spreads } })} />
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-center gap-1">
                      <button type="button" className="text-warmgrey hover:text-ink disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">↑</button>
                      <button type="button" className="text-warmgrey hover:text-ink disabled:opacity-30" disabled={i === spreads.length - 1} onClick={() => move(i, 1)} aria-label="Move down">↓</button>
                      <button type="button" className="text-warmgrey hover:text-red-700" onClick={() => remove(i)} aria-label="Remove">✕</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {available.length > 0 && (
            <div className="admin-card p-5">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-warmgrey">Add a piece</h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {available.map((p) => (
                  <button key={p.id} type="button" onClick={() => addPiece(p.id)} className="flex items-center gap-2 rounded-md border border-ink/10 p-2 text-left hover:border-navy">
                    <div className="h-10 w-8 shrink-0 overflow-hidden rounded bg-ink/5">
                      {p.imageUrl && <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />}
                    </div>
                    <span className="truncate text-xs">{p.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {catalog.length === 0 && (
            <p className="text-xs text-warmgrey">
              No published, sellable products yet — add and publish products to compose a lookbook from them.
            </p>
          )}
        </div>

        {/* Live preview */}
        <div>
          <div className="sticky top-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-warmgrey">Preview</div>
            <div className="admin-card overflow-hidden p-0">
              <iframe title="Lookbook preview" srcDoc={previewDoc} className="h-[560px] w-full border-0" />
            </div>
            <p className="mt-2 text-xs text-warmgrey">Scroll the preview to page through. “Save as PDF” opens it at 8.5×11 magazine trim.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
