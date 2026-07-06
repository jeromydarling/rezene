import { useCallback, useEffect, useRef, useState } from "react";
import { useFetch } from "../../lib/useFetch";
import { api, ApiRequestError } from "../../lib/api";
import { useToast } from "../../lib/toast";
import { EmptyState, ErrorNote, LoadingTable, PageHeader, SlideOver, StatusBadge } from "../../components/admin/ui";

/**
 * Design Studio — a home for designing the next line, powered natively by
 * Flux (Cloudflare Workers LLM, no keys to bring). A guided prompt builder, a
 * contact sheet of generations you can pin and vary, a per-shop house style for
 * a consistent look, and a one-click hand-off to a factory for a sample.
 */

interface Generation {
  id: string;
  url: string | null;
  seed: number | null;
  is_favorite: boolean;
  output_kind: string;
  prompt_text?: string | null;
}
interface Reference {
  id: string;
  label: string | null;
  url: string;
}
interface ConceptDetail {
  id: string;
  title: string;
  brief: string | null;
  styleId: string | null;
  styleName: string | null;
  status: string;
  generations: Generation[];
  references: Reference[];
}

/** Downscale an image file to <=512px (FLUX.2 reference limit) as JPEG. */
async function resizeToRef(file: File, max = 512): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.9));
}
interface ConceptRow {
  id: string;
  title: string;
  status: string;
  createdAt: string;
}
interface Supplier {
  id: string;
  name: string;
}

const GARMENTS = ["", "trouser", "shirt", "overshirt", "dress", "knit", "coat", "skirt", "jacket", "set"];
const PRESENTATION = ["on a model, full length", "on a model, editorial crop", "flat lay", "on a hanger", "ghost mannequin"];

export function DesignStudioPage() {
  const { data, loading, error, reload } = useFetch<ConceptRow[]>("/api/admin/ai/concepts");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [styleOpen, setStyleOpen] = useState(false);

  useEffect(() => {
    if (!selectedId && data && data.length > 0) setSelectedId(data[0].id);
  }, [data, selectedId]);

  const create = useCallback(async () => {
    if (!newTitle.trim()) return;
    const res = await api.post<ConceptDetail>("/api/admin/ai/concepts", { title: newTitle });
    setNewTitle("");
    setCreating(false);
    await reload();
    setSelectedId(res.id);
  }, [newTitle, reload]);

  return (
    <div>
      <PageHeader
        eyebrow="Studio"
        title="Design Studio"
        description="Design your next line with LLM — build a prompt, generate looks with Flux, then ship a favorite to your factory for a sample."
        actions={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setStyleOpen(true)}>
              House style
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
              New design
            </button>
          </>
        }
      />

      {loading && <LoadingTable />}
      {error && <ErrorNote message={error} />}
      {data && data.length === 0 && !creating && (
        <EmptyState
          title="No designs yet"
          hint="Start a design, describe the piece, and generate looks in seconds."
          action={
            <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
              Start a design
            </button>
          }
        />
      )}

      {(creating || (data && data.length > 0)) && (
        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <aside className="space-y-2">
            {creating && (
              <div className="admin-card space-y-2 p-3">
                <input
                  className="input !py-1.5 text-sm"
                  autoFocus
                  placeholder="Design name…"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void create()}
                />
                <div className="flex gap-2">
                  <button type="button" className="btn btn-primary !py-1 text-xs" onClick={() => void create()}>
                    Create
                  </button>
                  <button type="button" className="btn btn-secondary !py-1 text-xs" onClick={() => setCreating(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {(data ?? []).map((concept) => (
              <button
                key={concept.id}
                type="button"
                onClick={() => setSelectedId(concept.id)}
                className={`admin-card w-full px-3 py-2.5 text-left transition ${
                  selectedId === concept.id ? "!border-navy ring-1 ring-navy" : "hover:border-ink/25"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{concept.title}</span>
                  <StatusBadge status={concept.status} />
                </div>
              </button>
            ))}
          </aside>

          <div>{selectedId ? <DesignWorkspace key={selectedId} conceptId={selectedId} onMeta={reload} /> : null}</div>
        </div>
      )}

      <SlideOver open={styleOpen} title="House style" onClose={() => setStyleOpen(false)}>
        <HouseStyleEditor onClose={() => setStyleOpen(false)} />
      </SlideOver>
    </div>
  );
}

function DesignWorkspace({ conceptId, onMeta }: { conceptId: string; onMeta: () => void }) {
  const toast = useToast();
  const { data, loading, reload } = useFetch<ConceptDetail>(`/api/admin/ai/concepts/${conceptId}`);
  const [garment, setGarment] = useState("");
  const [fabric, setFabric] = useState("");
  const [palette, setPalette] = useState("");
  const [details, setDetails] = useState("");
  const [presentation, setPresentation] = useState(PRESENTATION[0]);
  const [prompt, setPrompt] = useState("");
  const [promptDirty, setPromptDirty] = useState(false);
  const [useHouseStyle, setUseHouseStyle] = useState(true);
  const [lockSeed, setLockSeed] = useState<number | null>(null);
  const [busy, setBusy] = useState<"gen" | "enhance" | "ref" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ship, setShip] = useState<Generation | null>(null);
  const [useGen, setUseGen] = useState<Generation | null>(null);
  const refInput = useRef<HTMLInputElement>(null);

  const uploadReference = useCallback(
    async (file: File) => {
      setBusy("ref");
      setErr(null);
      try {
        const blob = await resizeToRef(file);
        const form = new FormData();
        form.set("file", new File([blob], "reference.jpg", { type: "image/jpeg" }));
        form.set("entityType", "concept");
        form.set("entityId", conceptId);
        form.set("isPublic", "1");
        const up = await api.upload<{ id: string }>("/api/admin/files/upload", form);
        await api.post(`/api/admin/ai/concepts/${conceptId}/references`, { fileId: up.id });
        await reload();
      } catch (e) {
        setErr(e instanceof ApiRequestError ? e.message : "Couldn't add reference");
      } finally {
        setBusy(null);
      }
    },
    [conceptId, reload],
  );

  // Assemble a prompt from the builder unless the user has hand-edited it.
  const assembled = [garment && `a ${garment}`, fabric && `in ${fabric}`, palette, details, presentation && `presented ${presentation}`]
    .filter(Boolean)
    .join(", ");
  useEffect(() => {
    if (!promptDirty) setPrompt(assembled);
  }, [assembled, promptDirty]);

  const enhance = useCallback(async () => {
    setBusy("enhance");
    setErr(null);
    try {
      const res = await api.post<{ prompt: string }>("/api/admin/ai/prompt-suggest", {
        brief: prompt || assembled || data?.title || "a new garment",
        fields: { garment, fabric, palette, details, presentation },
      });
      setPrompt(res.prompt);
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : "Couldn't enhance");
    } finally {
      setBusy(null);
    }
  }, [prompt, assembled, garment, fabric, palette, details, presentation, data?.title]);

  const generate = useCallback(async () => {
    if (prompt.trim().length < 3) return setErr("Describe the piece first.");
    setBusy("gen");
    setErr(null);
    try {
      await api.post(`/api/admin/ai/concepts/${conceptId}/generate`, {
        prompt,
        count: 4,
        useHouseStyle,
        seed: lockSeed,
      });
      await reload();
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : "Generation failed");
    } finally {
      setBusy(null);
    }
  }, [prompt, conceptId, useHouseStyle, lockSeed, reload]);

  if (loading || !data) return <LoadingTable rows={4} />;

  return (
    <div className="space-y-5">
      {/* Prompt builder */}
      <div className="admin-card space-y-3 p-5">
        <h2 className="font-display text-lg font-light">{data.title}</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <Labeled label="Garment">
            <select className="input !py-1.5 text-sm" value={garment} onChange={(e) => setGarment(e.target.value)}>
              {GARMENTS.map((g) => (
                <option key={g} value={g}>
                  {g || "— pick —"}
                </option>
              ))}
            </select>
          </Labeled>
          <Labeled label="Fabric & texture">
            <input className="input !py-1.5 text-sm" value={fabric} onChange={(e) => setFabric(e.target.value)} placeholder="sun-washed linen" />
          </Labeled>
          <Labeled label="Colour / palette">
            <input className="input !py-1.5 text-sm" value={palette} onChange={(e) => setPalette(e.target.value)} placeholder="warm sand, ecru" />
          </Labeled>
          <Labeled label="Details & trims">
            <input className="input !py-1.5 text-sm" value={details} onChange={(e) => setDetails(e.target.value)} placeholder="double pleats, horn buttons" />
          </Labeled>
          <Labeled label="Presentation">
            <select className="input !py-1.5 text-sm" value={presentation} onChange={(e) => setPresentation(e.target.value)}>
              {PRESENTATION.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Labeled>
        </div>

        <Labeled label="Prompt (edit freely)">
          <textarea
            className="input text-sm"
            rows={2}
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value);
              setPromptDirty(true);
            }}
          />
        </Labeled>

        {/* Reference images (FLUX.2 conditioning) */}
        <div className="rounded-md border border-ink/10 bg-navy/[0.02] p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-warmgrey">Reference images {data.references.length > 0 ? `(${data.references.length}/4)` : ""}</span>
            <input ref={refInput} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && void uploadReference(e.target.files[0])} />
            <button
              type="button"
              className="text-xs text-navy hover:underline disabled:opacity-50"
              disabled={busy === "ref" || data.references.length >= 4}
              onClick={() => refInput.current?.click()}
            >
              {busy === "ref" ? "Adding…" : "+ Add reference"}
            </button>
          </div>
          {data.references.length === 0 ? (
            <p className="text-[11px] text-warmgrey">
              Add a fabric swatch, a model, or a silhouette and Flux will match its look for a consistent line.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {data.references.map((r) => (
                <div key={r.id} className="group relative">
                  <img src={r.url} alt="" className="h-14 w-14 rounded object-cover" />
                  <button
                    type="button"
                    className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-ink text-[10px] text-white opacity-0 group-hover:opacity-100"
                    onClick={async () => {
                      await api.delete(`/api/admin/ai/concepts/${conceptId}/references/${r.id}`);
                      await reload();
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn btn-secondary !py-1.5 text-xs" disabled={busy === "enhance"} onClick={() => void enhance()}>
            {busy === "enhance" ? "Thinking…" : "✦ Enhance prompt"}
          </button>
          <label className="flex items-center gap-1.5 text-xs text-warmgrey">
            <input type="checkbox" checked={useHouseStyle} onChange={(e) => setUseHouseStyle(e.target.checked)} />
            Apply house style
          </label>
          <label className="flex items-center gap-1.5 text-xs text-warmgrey">
            <input
              type="checkbox"
              checked={lockSeed != null}
              onChange={(e) => setLockSeed(e.target.checked ? Math.floor(Date.now() % 2000000000) : null)}
            />
            Lock look (consistent seed)
          </label>
          <button type="button" className="btn btn-primary !py-1.5 ml-auto" disabled={busy === "gen"} onClick={() => void generate()}>
            {busy === "gen" ? "Designing…" : "Generate 4 looks"}
          </button>
        </div>
        {data.references.length > 0 && (
          <p className="text-[11px] text-navy">✦ Matching {data.references.length} reference{data.references.length > 1 ? "s" : ""} for a consistent look (FLUX.2).</p>
        )}
        {err && <p className="field-error">{err}</p>}
        {busy === "gen" && <p className="text-xs text-warmgrey">Flux is rendering four looks — this takes a few seconds.</p>}
      </div>

      {/* Contact sheet */}
      {data.generations.filter((g) => g.output_kind === "image").length > 0 && (
        <div className="admin-card p-5">
          <h3 className="mb-3 font-display text-base font-light">Looks</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {data.generations
              .filter((g) => g.output_kind === "image" && g.url)
              .map((g) => (
                <div key={g.id} className="group relative overflow-hidden rounded-md border border-ink/10 bg-cream">
                  <img src={g.url!} alt="" className="aspect-[3/4] w-full object-cover" />
                  {g.is_favorite && <span className="absolute left-1.5 top-1.5 text-lg">★</span>}
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-black/55 px-2 py-1 opacity-0 transition group-hover:opacity-100">
                    <button
                      type="button"
                      title="Pin favorite"
                      className="text-xs text-white"
                      onClick={async () => {
                        await api.post(`/api/admin/ai/concepts/${conceptId}/generations/${g.id}/favorite`);
                        await reload();
                      }}
                    >
                      {g.is_favorite ? "★" : "☆"}
                    </button>
                    <button type="button" title="Use on your site" className="text-xs text-white" onClick={() => setUseGen(g)}>
                      ⇡ use
                    </button>
                    <button type="button" title="Send to a maker" className="text-xs text-white" onClick={() => setShip(g)}>
                      ⇢ maker
                    </button>
                    <button
                      type="button"
                      title="Delete"
                      className="text-xs text-white"
                      onClick={async () => {
                        await api.delete(`/api/admin/ai/concepts/${conceptId}/generations/${g.id}`);
                        await reload();
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      <SlideOver open={Boolean(useGen)} title="Use on your site" onClose={() => setUseGen(null)}>
        {useGen && (
          <UseImageForm
            conceptId={conceptId}
            generation={useGen}
            onDone={(where) => {
              setUseGen(null);
              toast.success(`Added to ${where}`, "The image is live on your site.");
            }}
          />
        )}
      </SlideOver>

      <SlideOver open={Boolean(ship)} title="Ship to sampling" onClose={() => setShip(null)}>
        {ship && (
          <ShipForm
            conceptId={conceptId}
            generation={ship}
            existingStyleId={data.styleId}
            onDone={() => {
              setShip(null);
              void reload();
              onMeta();
            }}
          />
        )}
      </SlideOver>
    </div>
  );
}

interface ShipResult {
  shareUrl: string;
  emailed: boolean;
  makerName: string | null;
}
function ShipForm({
  conceptId,
  generation,
  existingStyleId,
  onDone,
}: {
  conceptId: string;
  generation: Generation;
  existingStyleId: string | null;
  onDone: () => void;
}) {
  const { data: suppliers } = useFetch<Supplier[]>("/api/admin/suppliers");
  const [supplierId, setSupplierId] = useState("");
  const [kind, setKind] = useState("proto");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ShipResult | null>(null);
  const [copied, setCopied] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<ShipResult>(`/api/admin/ai/concepts/${conceptId}/ship`, {
        generationId: generation.id,
        supplierId: supplierId || null,
        styleId: existingStyleId,
        kind,
        notes: notes || null,
      });
      setResult(res);
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : "Couldn't send");
      setBusy(false);
    }
  }

  if (result) {
    return (
      <div className="space-y-4">
        <div className="rounded-md bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="font-medium">
            {result.emailed
              ? `Emailed to ${result.makerName ?? "your maker"} ✓`
              : result.makerName
                ? `Sample request created for ${result.makerName}.`
                : "Sample request created."}
          </p>
          <p className="mt-1 text-xs">
            We built a tech pack with this design as the cover and filed the sample. Share this secure link so they can view
            the design, read the spec, and reply:
          </p>
          <div className="mt-2 flex items-center gap-2">
            <input readOnly className="input flex-1 !text-xs" value={result.shareUrl} onFocus={(e) => e.target.select()} />
            <button
              type="button"
              className="btn btn-secondary !py-1.5 text-xs"
              onClick={() => {
                void navigator.clipboard.writeText(result.shareUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
        <button type="button" className="btn btn-primary w-full" onClick={onDone}>
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {generation.url && <img src={generation.url} alt="" className="aspect-[3/4] w-40 rounded-md object-cover" />}
      <p className="text-sm text-warmgrey">
        This turns your design into a style, builds a tech pack with it as the cover, files a sample request, and emails your
        maker a secure link to view it and reply.
      </p>
      <Labeled label="Send to maker">
        <select className="input" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
          <option value="">— file the request, no maker yet —</option>
          {(suppliers ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </Labeled>
      {suppliers && suppliers.length === 0 && (
        <p className="text-xs text-warmgrey">
          No makers saved yet — add one under Production → Factories, or find one in Find a Maker.
        </p>
      )}
      <Labeled label="Sample type">
        <select className="input" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="proto">Prototype</option>
          <option value="fit">Fit sample</option>
          <option value="sms">SMS / salesman sample</option>
          <option value="pp">Pre-production</option>
        </select>
      </Labeled>
      <Labeled label="Note to the maker">
        <textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any construction or fabric direction…" />
      </Labeled>
      {error && <ErrorNote message={error} />}
      <button type="button" className="btn btn-primary w-full" disabled={busy} onClick={() => void submit()}>
        {busy ? "Sending…" : supplierId ? "Send to maker" : "File sample request"}
      </button>
    </div>
  );
}

function UseImageForm({
  conceptId,
  generation,
  onDone,
}: {
  conceptId: string;
  generation: Generation;
  onDone: (where: string) => void;
}) {
  const { data: products } = useFetch<{ id: string; name: string }[]>("/api/admin/products");
  const { data: lookbooks } = useFetch<{ id: string; title: string }[]>("/api/admin/content/lookbooks");
  const [target, setTarget] = useState<"product" | "lookbook">("product");
  const [productId, setProductId] = useState("");
  const [lookbookId, setLookbookId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/admin/ai/concepts/${conceptId}/generations/${generation.id}/use`, {
        target,
        productId: target === "product" ? productId : null,
        lookbookId: target === "lookbook" ? lookbookId : null,
      });
      onDone(target === "product" ? "the product" : "the lookbook");
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : "Couldn't add the image");
      setBusy(false);
    }
  }

  const ready = target === "product" ? Boolean(productId) : Boolean(lookbookId);
  return (
    <div className="space-y-4">
      {generation.url && <img src={generation.url} alt="" className="aspect-[3/4] w-40 rounded-md object-cover" />}
      <div className="flex gap-2">
        {(["product", "lookbook"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTarget(t)}
            className={`flex-1 rounded-md border px-3 py-2 text-sm capitalize transition ${
              target === t ? "border-navy bg-navy/5" : "border-ink/15 hover:border-ink/40"
            }`}
          >
            {t === "product" ? "Product photo" : "Lookbook"}
          </button>
        ))}
      </div>
      {target === "product" ? (
        <Labeled label="Add to product">
          <select className="input" value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">Choose a product…</option>
            {(products ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Labeled>
      ) : (
        <Labeled label="Add to lookbook">
          <select className="input" value={lookbookId} onChange={(e) => setLookbookId(e.target.value)}>
            <option value="">Choose a lookbook…</option>
            {(lookbooks ?? []).map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
              </option>
            ))}
          </select>
        </Labeled>
      )}
      {error && <ErrorNote message={error} />}
      <button type="button" className="btn btn-primary w-full" disabled={busy || !ready} onClick={() => void submit()}>
        {busy ? "Adding…" : "Add image"}
      </button>
    </div>
  );
}

function HouseStyleEditor({ onClose }: { onClose: () => void }) {
  const { data } = useFetch<{ value: string }>("/api/admin/ai/house-style");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (data) setValue(data.value);
  }, [data]);

  async function save() {
    setBusy(true);
    try {
      await api.put("/api/admin/ai/house-style", { value });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-warmgrey">
        A house style is appended to every prompt so your line looks consistent — lighting, film look, palette, and model
        direction. Tune it to your brand.
      </p>
      <textarea className="input text-sm" rows={5} value={value} onChange={(e) => setValue(e.target.value)} />
      <button type="button" className="btn btn-primary w-full" disabled={busy} onClick={() => void save()}>
        {busy ? "Saving…" : "Save house style"}
      </button>
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-warmgrey">{label}</span>
      {children}
    </label>
  );
}
