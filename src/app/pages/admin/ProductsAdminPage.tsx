import { useState } from "react";
import { useFetch } from "../../lib/useFetch";
import { api, ApiRequestError } from "../../lib/api";
import { formatMoney, titleCase } from "../../lib/format";
import {
  EmptyState,
  ErrorNote,
  LoadingTable,
  PageHeader,
  SlideOver,
  StatusBadge,
} from "../../components/admin/ui";
import { ImageUploadButton } from "../../components/admin/cms";
import type { AdminProduct } from "../../../shared/types";

export function ProductsAdminPage() {
  const { data, loading, error, reload } = useFetch<AdminProduct[]>("/api/admin/products");
  const [importOpen, setImportOpen] = useState(false);

  async function togglePublish(product: AdminProduct) {
    await api.patch(`/api/admin/products/${product.id}`, { isPublished: !product.isPublished });
    reload();
  }

  return (
    <div>
      <PageHeader
        eyebrow="Catalog"
        title="Products"
        description="The storefront catalog — publication state, pricing, and stock at a glance."
        actions={
          <button type="button" className="btn btn-secondary" onClick={() => setImportOpen(true)}>
            Import CSV
          </button>
        }
      />
      {error && <ErrorNote message={error} />}
      {loading && <LoadingTable />}
      {data && data.length === 0 && (
        <EmptyState title="No products" hint="Products are the sellable face of styles." />
      )}
      {data && data.length > 0 && (
        <div className="admin-card overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Price</th>
                <th>Availability</th>
                <th>Variants</th>
                <th>On hand</th>
                <th>Published</th>
              </tr>
            </thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.id}>
                  <td>
                    <span className="font-medium">{p.name}</span>
                    <span className="ml-2 text-xs text-warmgrey">/{p.slug}</span>
                  </td>
                  <td>{titleCase(p.category)}</td>
                  <td>{formatMoney(p.basePriceCents, p.currency)}</td>
                  <td>
                    <StatusBadge status={p.availability} />
                  </td>
                  <td>{p.variantCount}</td>
                  <td>{p.totalOnHand}</td>
                  <td>
                    <button
                      type="button"
                      onClick={() => void togglePublish(p)}
                      className={`badge ${p.isPublished ? "badge-success" : "badge-neutral"} cursor-pointer`}
                    >
                      {p.isPublished ? "Live" : "Hidden"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <SlideOver open={importOpen} title="Import products from CSV" onClose={() => setImportOpen(false)}>
        <ProductImportForm
          onDone={() => {
            reload();
          }}
        />
      </SlideOver>
    </div>
  );
}

interface ImportResult {
  created: number;
  skipped: { slug: string; reason: string }[];
  errors: string[];
}

function ProductImportForm({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<"shopify" | "simple">("shopify");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function submit() {
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("mode", mode);
      const res = await api.upload<ImportResult>("/api/admin/import/products", form);
      setResult(res);
      onDone();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="label">Format</label>
        <select
          className="input"
          value={mode}
          onChange={(e) => setMode(e.target.value as "shopify" | "simple")}
        >
          <option value="shopify">Shopify product export</option>
          <option value="simple">Simple template</option>
        </select>
        <p className="mt-1 text-xs text-warmgrey">
          {mode === "shopify"
            ? "The CSV Shopify produces under Products → Export. Variants, sizes, and colorways come across automatically."
            : "Columns: name, slug, category, gender, price, sizes, colorway — sizes pipe-separated like S|M|L, price decimal like 185.00."}
        </p>
      </div>
      <div>
        <label className="label">CSV file</label>
        <input
          type="file"
          accept=".csv,text/csv"
          className="input"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </div>
      <p className="rounded bg-cream px-3 py-2 text-xs text-warmgrey">
        Everything imports as an unpublished draft with zero inventory — nothing goes live until
        you review and publish. Products whose slug already exists are skipped, so re-running an
        import is safe.
      </p>
      {error && <p className="field-error">{error}</p>}
      <button
        type="button"
        disabled={!file || busy}
        className="btn btn-primary w-full"
        onClick={() => void submit()}
      >
        {busy ? "Importing…" : "Import"}
      </button>
      {result && (
        <div className="rounded-md border border-ink/10 bg-white p-4 text-sm">
          <p className="font-medium">
            {result.created} product{result.created === 1 ? "" : "s"} imported
            {result.skipped.length > 0 && ` · ${result.skipped.length} skipped`}
          </p>
          {result.skipped.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs text-warmgrey">
              {result.skipped.slice(0, 10).map((s) => (
                <li key={s.slug}>
                  /{s.slug} — {s.reason}
                </li>
              ))}
              {result.skipped.length > 10 && <li>…and {result.skipped.length - 10} more</li>}
            </ul>
          )}
          {result.errors.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs text-clay">
              {result.errors.slice(0, 10).map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

interface AdminCollectionRow {
  id: string;
  slug: string;
  name: string;
  season: string | null;
  is_published: number;
  product_count: number;
  style_count: number;
}

interface CollectionDetailRow extends AdminCollectionRow {
  description: string | null;
  editorial_copy: string | null;
  hero_image_url: string | null;
}

export function CollectionsAdminPage() {
  const { data, loading, error, reload } = useFetch<AdminCollectionRow[]>(
    "/api/admin/products/collections/all",
  );
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div>
      <PageHeader
        eyebrow="Catalog"
        title="Collections"
        description="Seasonal groupings across the storefront and the design pipeline. Copy and hero imagery are editable here."
      />
      {error && <ErrorNote message={error} />}
      {loading && <LoadingTable rows={3} />}
      {data && (
        <div className="admin-card overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Season</th>
                <th>Products</th>
                <th>Styles</th>
                <th>Published</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.map((col) => (
                <tr key={col.id}>
                  <td className="font-medium">{col.name}</td>
                  <td>{col.season ?? "—"}</td>
                  <td>{col.product_count}</td>
                  <td>{col.style_count}</td>
                  <td>
                    <span className={`badge ${col.is_published ? "badge-success" : "badge-neutral"}`}>
                      {col.is_published ? "Live" : "Hidden"}
                    </span>
                  </td>
                  <td>
                    <button type="button" className="link-quiet text-xs" onClick={() => setEditingId(col.id)}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <SlideOver open={Boolean(editingId)} title="Edit collection" onClose={() => setEditingId(null)}>
        {editingId && (
          <CollectionEditForm
            id={editingId}
            onSaved={() => {
              setEditingId(null);
              reload();
            }}
          />
        )}
      </SlideOver>
    </div>
  );
}

function CollectionEditForm({ id, onSaved }: { id: string; onSaved: () => void }) {
  // Reuse the public detail shape for initial values (admin list is summary-only).
  const { data, loading } = useFetch<CollectionDetailRow[]>(
    "/api/admin/products/collections/detail",
  );
  const row = data?.find((c) => c.id === id) ?? null;
  const [form, setForm] = useState<Record<string, string | boolean> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!form && row) {
    setForm({
      name: row.name,
      season: row.season ?? "",
      description: row.description ?? "",
      editorialCopy: row.editorial_copy ?? "",
      heroImageUrl: row.hero_image_url ?? "",
      isPublished: Boolean(row.is_published),
    });
  }
  if (loading || !form) return <LoadingTable rows={3} />;

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/api/admin/content/collections/${id}`, {
        name: form!.name as string,
        season: (form!.season as string) || null,
        description: (form!.description as string) || null,
        editorialCopy: (form!.editorialCopy as string) || null,
        heroImageUrl: (form!.heroImageUrl as string) || null,
        isPublished: form!.isPublished as boolean,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="label">Name</label>
        <input
          className="input"
          value={form.name as string}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </div>
      <div>
        <label className="label">Season</label>
        <input
          className="input"
          value={form.season as string}
          onChange={(e) => setForm({ ...form, season: e.target.value })}
        />
      </div>
      <div>
        <label className="label">Description (collection cards)</label>
        <textarea
          rows={2}
          className="input"
          value={form.description as string}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </div>
      <div>
        <label className="label">Editorial copy (collection page hero)</label>
        <textarea
          rows={4}
          className="input"
          value={form.editorialCopy as string}
          onChange={(e) => setForm({ ...form, editorialCopy: e.target.value })}
        />
      </div>
      <div>
        <label className="label">Hero image</label>
        <div className="flex items-center gap-2">
          <input
            className="input flex-1"
            placeholder="/media/… or external URL"
            value={form.heroImageUrl as string}
            onChange={(e) => setForm({ ...form, heroImageUrl: e.target.value })}
          />
          <ImageUploadButton onUploaded={(url) => setForm({ ...form, heroImageUrl: url })} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.isPublished as boolean}
          onChange={(e) => setForm({ ...form, isPublished: e.target.checked })}
        />
        Published
      </label>
      {error && <p className="field-error">{error}</p>}
      <button type="button" className="btn btn-primary w-full" disabled={busy} onClick={() => void save()}>
        {busy ? "Saving…" : "Save collection"}
      </button>
    </div>
  );
}
