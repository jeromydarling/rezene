import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { api, ApiRequestError } from "../../lib/api";
import { useFetch } from "../../lib/useFetch";
import { formatMoney } from "../../lib/format";
import { ErrorNote, LoadingTable, PageHeader, StatusBadge } from "../../components/admin/ui";

/**
 * Full product editor — the create/edit surface for the sellable catalog.
 * Manages core fields, images, and variants (the sellable SKUs, each with its
 * own inventory line). New products start as a draft; publish when ready.
 */

interface Variant {
  id: string;
  colorway_name: string;
  size: string;
  sku_code: string | null;
  price_cents: number | null;
  is_active: number;
  inventory_item_id: string | null;
  on_hand: number | null;
}
interface Image {
  id: string;
  url: string;
  alt_text: string | null;
  colorway_name: string | null;
  sort_order: number;
}
interface ProductDetail {
  id: string;
  slug: string;
  name: string;
  subtitle?: string | null;
  description?: string | null;
  gender: string;
  category: string;
  collectionId: string | null;
  basePriceCents: number;
  currency: string;
  availability: string;
  isPublished: boolean;
  fabricComposition?: string | null;
  careSummary?: string | null;
  originStatement?: string | null;
  fitNotes?: string | null;
  variants: Variant[];
  images: Image[];
}
interface CollectionOpt {
  id: string;
  name: string;
}

const GENDERS = ["mens", "womens", "unisex"];
const AVAILABILITY = ["draft", "available", "pre_order", "sold_out", "archived"];

export function ProductEditorPage() {
  const { id } = useParams();
  if (id === "new") return <NewProduct />;
  return <EditProduct id={id!} />;
}

function NewProduct() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", basePriceCents: 0, gender: "unisex", category: "apparel" });
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const { id } = await api.post<{ id: string }>("/api/admin/products", {
        ...form,
        basePriceCents: Math.round(parseFloat(price || "0") * 100),
      });
      navigate(`/admin/products/${id}`, { replace: true });
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : "Couldn't create the product");
      setBusy(false);
    }
  }, [form, price, navigate]);

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader title="New product" eyebrow="Catalog" />
      <div className="admin-card space-y-4 p-5">
        <Field label="Product name">
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Anfa Trouser" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Price">
            <input className="input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="195.00" />
          </Field>
          <Field label="Category">
            <input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="trouser" />
          </Field>
        </div>
        <Field label="Audience">
          <select className="input" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
            {GENDERS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </Field>
        {error && <ErrorNote message={error} />}
        <button className="btn btn-primary w-full" disabled={busy || !form.name} onClick={() => void create()}>
          {busy ? "Creating…" : "Create draft"}
        </button>
        <p className="text-center text-xs text-warmgrey">
          You’ll add images, colours &amp; sizes, and stock on the next screen.
        </p>
      </div>
    </div>
  );
}

function EditProduct({ id }: { id: string }) {
  const navigate = useNavigate();
  const { data, loading, error, reload } = useFetch<ProductDetail>(`/api/admin/products/${id}`);
  const { data: collections } = useFetch<CollectionOpt[]>("/api/admin/products/collections/all");
  const [form, setForm] = useState<Partial<ProductDetail>>({});
  const [priceStr, setPriceStr] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data) {
      setForm(data);
      setPriceStr((data.basePriceCents / 100).toFixed(2));
    }
  }, [data]);

  const set = (patch: Partial<ProductDetail>) => {
    setForm((f) => ({ ...f, ...patch }));
    setSaved(false);
  };

  const save = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await api.patch(`/api/admin/products/${id}`, {
        name: form.name,
        slug: form.slug,
        subtitle: form.subtitle ?? null,
        description: form.description ?? null,
        gender: form.gender,
        category: form.category,
        collectionId: form.collectionId ?? null,
        basePriceCents: Math.round(parseFloat(priceStr || "0") * 100),
        currency: form.currency,
        availability: form.availability,
        fabricComposition: form.fabricComposition ?? null,
        careSummary: form.careSummary ?? null,
        originStatement: form.originStatement ?? null,
        fitNotes: form.fitNotes ?? null,
      });
      setSaved(true);
      await reload();
    } catch (e) {
      setSaveError(e instanceof ApiRequestError ? e.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  }, [id, form, priceStr, reload]);

  const togglePublish = useCallback(async () => {
    await api.patch(`/api/admin/products/${id}`, { isPublished: !form.isPublished });
    await reload();
  }, [id, form.isPublished, reload]);

  const remove = useCallback(async () => {
    if (!confirm(`Delete "${data?.name}"? This can't be undone.`)) return;
    await api.delete(`/api/admin/products/${id}`);
    navigate("/admin/products", { replace: true });
  }, [id, data?.name, navigate]);

  if (loading) return <LoadingTable rows={6} />;
  if (error || !data) return <ErrorNote message={error || "Product not found"} />;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={form.name || data.name}
        eyebrow="Catalog · Product"
        actions={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => void togglePublish()}>
              {form.isPublished ? "Unpublish" : "Publish"}
            </button>
            <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void save()}>
              {saving ? "Saving…" : saved ? "Saved ✓" : "Save"}
            </button>
          </>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-warmgrey">
        <StatusBadge status={form.isPublished ? "published" : "draft"} />
        <StatusBadge status={form.availability || "draft"} />
        <span>· {data.variants.length} variants · slug /{data.slug}</span>
      </div>
      {saveError && <ErrorNote message={saveError} />}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Core fields */}
        <section className="admin-card space-y-4 p-5">
          <h2 className="font-display text-lg font-light">Details</h2>
          <Field label="Name">
            <input className="input" value={form.name ?? ""} onChange={(e) => set({ name: e.target.value })} />
          </Field>
          <Field label="Subtitle">
            <input className="input" value={form.subtitle ?? ""} onChange={(e) => set({ subtitle: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Price">
              <input
                className="input"
                inputMode="decimal"
                value={priceStr}
                onChange={(e) => {
                  setPriceStr(e.target.value);
                  setSaved(false);
                }}
              />
            </Field>
            <Field label="Currency">
              <input className="input" maxLength={3} value={form.currency ?? "USD"} onChange={(e) => set({ currency: e.target.value.toUpperCase() })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Audience">
              <select className="input" value={form.gender} onChange={(e) => set({ gender: e.target.value })}>
                {GENDERS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Category">
              <input className="input" value={form.category ?? ""} onChange={(e) => set({ category: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Collection">
              <select className="input" value={form.collectionId ?? ""} onChange={(e) => set({ collectionId: e.target.value || null })}>
                <option value="">— none —</option>
                {(collections ?? []).map((col) => (
                  <option key={col.id} value={col.id}>
                    {col.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Availability">
              <select className="input" value={form.availability} onChange={(e) => set({ availability: e.target.value })}>
                {AVAILABILITY.map((a) => (
                  <option key={a} value={a}>
                    {a.replace("_", " ")}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Slug">
            <input className="input" value={form.slug ?? ""} onChange={(e) => set({ slug: e.target.value })} />
          </Field>
          <Field label="Description">
            <textarea className="input" rows={4} value={form.description ?? ""} onChange={(e) => set({ description: e.target.value })} />
          </Field>
          <details className="text-sm">
            <summary className="cursor-pointer text-warmgrey">More fields</summary>
            <div className="mt-3 space-y-3">
              <Field label="Fabric composition">
                <input className="input" value={form.fabricComposition ?? ""} onChange={(e) => set({ fabricComposition: e.target.value })} />
              </Field>
              <Field label="Care">
                <input className="input" value={form.careSummary ?? ""} onChange={(e) => set({ careSummary: e.target.value })} />
              </Field>
              <Field label="Origin statement">
                <input className="input" value={form.originStatement ?? ""} onChange={(e) => set({ originStatement: e.target.value })} />
              </Field>
              <Field label="Fit notes">
                <textarea className="input" rows={2} value={form.fitNotes ?? ""} onChange={(e) => set({ fitNotes: e.target.value })} />
              </Field>
            </div>
          </details>
        </section>

        <div className="space-y-6">
          <ImageManager productId={id} images={data.images} onChange={reload} />
          <VariantManager productId={id} variants={data.variants} currency={data.currency} onChange={reload} />
          <section className="admin-card p-5">
            <button type="button" className="text-sm text-red-700 hover:underline" onClick={() => void remove()}>
              Delete this product
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}

function ImageManager({ productId, images, onChange }: { productId: string; images: Image[]; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const attach = useCallback(
    async (imageUrl: string) => {
      await api.post(`/api/admin/products/${productId}/images`, { url: imageUrl });
      await onChange();
    },
    [productId, onChange],
  );

  const upload = useCallback(
    async (file: File) => {
      setBusy(true);
      setErr(null);
      try {
        const form = new FormData();
        form.set("file", file);
        form.set("entityType", "product");
        form.set("entityId", productId);
        form.set("isPublic", "1");
        const res = await api.upload<{ id: string }>("/api/admin/files/upload", form);
        await attach(`/media/${res.id}`);
      } catch (e) {
        setErr(e instanceof ApiRequestError ? e.message : "Upload failed");
      } finally {
        setBusy(false);
      }
    },
    [productId, attach],
  );

  const move = useCallback(
    async (index: number, dir: -1 | 1) => {
      const order = images.map((i) => i.id);
      const j = index + dir;
      if (j < 0 || j >= order.length) return;
      [order[index], order[j]] = [order[j], order[index]];
      await api.post(`/api/admin/products/${productId}/images/reorder`, { order });
      await onChange();
    },
    [images, productId, onChange],
  );

  return (
    <section className="admin-card space-y-3 p-5">
      <h2 className="font-display text-lg font-light">Images</h2>
      {images.length === 0 ? (
        <p className="text-sm text-warmgrey">No images yet. Upload the first shot below.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {images.map((img, i) => (
            <div key={img.id} className="group relative overflow-hidden rounded-md border border-ink/10 bg-cream">
              <img src={img.url} alt={img.alt_text ?? ""} className="aspect-[3/4] w-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/50 px-1 py-0.5 opacity-0 transition group-hover:opacity-100">
                <button type="button" className="px-1 text-xs text-white disabled:opacity-30" disabled={i === 0} onClick={() => void move(i, -1)}>
                  ←
                </button>
                <button
                  type="button"
                  className="px-1 text-xs text-white"
                  onClick={async () => {
                    await api.delete(`/api/admin/products/${productId}/images/${img.id}`);
                    await onChange();
                  }}
                >
                  ✕
                </button>
                <button type="button" className="px-1 text-xs text-white disabled:opacity-30" disabled={i === images.length - 1} onClick={() => void move(i, 1)}>
                  →
                </button>
              </div>
              {i === 0 && <span className="absolute left-1 top-1 rounded bg-white/90 px-1 text-[10px] font-medium">Cover</span>}
            </div>
          ))}
        </div>
      )}
      {err && <p className="field-error">{err}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
        <button type="button" className="btn btn-secondary !py-1.5 text-xs" disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? "Uploading…" : "Upload image"}
        </button>
      </div>
      <div className="flex items-center gap-2">
        <input className="input flex-1 !text-xs" placeholder="…or paste an image URL" value={url} onChange={(e) => setUrl(e.target.value)} />
        <button
          type="button"
          className="btn btn-secondary !py-1.5 text-xs"
          disabled={!url}
          onClick={async () => {
            await attach(url);
            setUrl("");
          }}
        >
          Add
        </button>
      </div>
    </section>
  );
}

function VariantManager({
  productId,
  variants,
  currency,
  onChange,
}: {
  productId: string;
  variants: Variant[];
  currency: string;
  onChange: () => void;
}) {
  const [nv, setNv] = useState({ colorwayName: "", size: "", skuCode: "", onHand: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const add = useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      await api.post(`/api/admin/products/${productId}/variants`, {
        colorwayName: nv.colorwayName,
        size: nv.size,
        skuCode: nv.skuCode || null,
        onHand: nv.onHand ? parseInt(nv.onHand, 10) : 0,
      });
      setNv({ colorwayName: "", size: "", skuCode: "", onHand: "" });
      await onChange();
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : "Couldn't add variant");
    } finally {
      setBusy(false);
    }
  }, [productId, nv, onChange]);

  return (
    <section className="admin-card space-y-3 p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-light">Colours &amp; sizes</h2>
        <span className="text-xs text-warmgrey">the sellable SKUs</span>
      </div>
      {variants.length === 0 ? (
        <p className="text-sm text-warmgrey">No variants yet. Add a colour + size below to make this product buyable.</p>
      ) : (
        <div className="space-y-1.5">
          {variants.map((v) => (
            <VariantRow key={v.id} productId={productId} v={v} currency={currency} onChange={onChange} />
          ))}
        </div>
      )}
      {err && <p className="field-error">{err}</p>}
      <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-1.5">
        <input className="input !py-1.5 text-xs" placeholder="Colour" value={nv.colorwayName} onChange={(e) => setNv({ ...nv, colorwayName: e.target.value })} />
        <input className="input !py-1.5 text-xs" placeholder="Size" value={nv.size} onChange={(e) => setNv({ ...nv, size: e.target.value })} />
        <input className="input !py-1.5 text-xs" placeholder="Stock" inputMode="numeric" value={nv.onHand} onChange={(e) => setNv({ ...nv, onHand: e.target.value })} />
        <button type="button" className="btn btn-primary !py-1.5 text-xs" disabled={busy || !nv.colorwayName || !nv.size} onClick={() => void add()}>
          Add
        </button>
      </div>
    </section>
  );
}

function VariantRow({ productId, v, currency, onChange }: { productId: string; v: Variant; currency: string; onChange: () => void }) {
  const [stock, setStock] = useState(String(v.on_hand ?? 0));
  const [busy, setBusy] = useState(false);

  const saveStock = useCallback(async () => {
    const target = parseInt(stock, 10);
    if (!v.inventory_item_id || Number.isNaN(target) || target === (v.on_hand ?? 0)) return;
    setBusy(true);
    try {
      await api.post(`/api/admin/products/inventory/adjust`, {
        inventoryItemId: v.inventory_item_id,
        kind: "adjust",
        quantity: target - (v.on_hand ?? 0),
      });
      await onChange();
    } finally {
      setBusy(false);
    }
  }, [stock, v, onChange]);

  return (
    <div className={`flex items-center gap-2 rounded-md border border-ink/10 px-2 py-1.5 text-sm ${v.is_active ? "" : "opacity-50"}`}>
      <span className="min-w-0 flex-1 truncate">
        <span className="font-medium">{v.colorway_name}</span> · {v.size}
        {v.sku_code && <span className="ml-1 text-xs text-warmgrey">({v.sku_code})</span>}
      </span>
      <span className="text-xs text-warmgrey">{formatMoney(v.price_cents ?? 0, currency) !== "$0.00" && v.price_cents ? formatMoney(v.price_cents, currency) : "base"}</span>
      <label className="flex items-center gap-1 text-xs text-warmgrey">
        stock
        <input
          className="input !w-14 !py-1 text-xs"
          inputMode="numeric"
          value={stock}
          disabled={busy}
          onChange={(e) => setStock(e.target.value)}
          onBlur={() => void saveStock()}
        />
      </label>
      <button
        type="button"
        className="text-xs text-warmgrey hover:text-red-700"
        title="Remove variant"
        onClick={async () => {
          if (confirm(`Remove ${v.colorway_name} / ${v.size}?`)) {
            await api.delete(`/api/admin/products/${productId}/variants/${v.id}`);
            await onChange();
          }
        }}
      >
        ✕
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-warmgrey">{label}</span>
      {children}
    </label>
  );
}
