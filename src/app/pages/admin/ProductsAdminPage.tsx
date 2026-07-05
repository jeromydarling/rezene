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
