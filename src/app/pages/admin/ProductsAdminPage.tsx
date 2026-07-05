import { useFetch } from "../../lib/useFetch";
import { api } from "../../lib/api";
import { formatMoney, titleCase } from "../../lib/format";
import {
  EmptyState,
  ErrorNote,
  LoadingTable,
  PageHeader,
  StatusBadge,
} from "../../components/admin/ui";
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

export function CollectionsAdminPage() {
  const { data, loading, error } = useFetch<AdminCollectionRow[]>(
    "/api/admin/products/collections/all",
  );
  return (
    <div>
      <PageHeader
        eyebrow="Catalog"
        title="Collections"
        description="Seasonal groupings across the storefront and the design pipeline."
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
