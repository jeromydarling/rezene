import { useFetch } from "../../lib/useFetch";
import { api } from "../../lib/api";
import { useToast } from "../../lib/toast";
import { formatDate } from "../../lib/format";
import { EmptyState, LoadingTable, PageHeader } from "../../components/admin/ui";

interface Review {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  authorName: string | null;
  status: string;
  createdAt: string;
  productName: string;
  productSlug: string;
}

export function ReviewsPage() {
  const toast = useToast();
  const { data, loading, reload } = useFetch<{ reviews: Review[] }>("/api/admin/reviews");
  const reviews = data?.reviews ?? [];

  async function setStatus(r: Review, status: "published" | "hidden") {
    await api.post(`/api/admin/reviews/${r.id}/status`, { status });
    reload();
  }
  async function del(r: Review) {
    if (!window.confirm("Delete this review permanently?")) return;
    await api.delete(`/api/admin/reviews/${r.id}`);
    toast.success("Review deleted");
    reload();
  }

  return (
    <div>
      <PageHeader
        eyebrow="Commerce"
        title="Reviews"
        help="reviews"
        description="Reviews come only from verified buyers and go live automatically. Hide anything off-topic, or delete spam."
      />
      {loading && <LoadingTable rows={4} />}
      {!loading && reviews.length === 0 && (
        <EmptyState title="No reviews yet" hint="Customers can review a piece from their account after it's delivered." />
      )}
      {reviews.length > 0 && (
        <div className="space-y-3">
          {reviews.map((r) => (
            <div key={r.id} className={`admin-card p-4 ${r.status === "hidden" ? "opacity-60" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-saffron">{"★".repeat(r.rating)}<span className="text-ink/20">{"★".repeat(5 - r.rating)}</span></span>
                    <span className="text-sm font-medium">{r.productName}</span>
                    {r.status === "hidden" && <span className="badge badge-neutral">Hidden</span>}
                  </div>
                  {r.title && <p className="mt-1 text-sm font-medium">{r.title}</p>}
                  {r.body && <p className="mt-0.5 text-sm text-warmgrey">{r.body}</p>}
                  <p className="mt-1 text-xs text-warmgrey">
                    {r.authorName || "Verified buyer"} · {formatDate(r.createdAt)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5 text-xs">
                  {r.status === "published" ? (
                    <button type="button" className="link-quiet" onClick={() => void setStatus(r, "hidden")}>
                      Hide
                    </button>
                  ) : (
                    <button type="button" className="link-quiet" onClick={() => void setStatus(r, "published")}>
                      Show
                    </button>
                  )}
                  <button type="button" className="text-terracotta hover:underline" onClick={() => void del(r)}>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
