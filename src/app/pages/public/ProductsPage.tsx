import { useState } from "react";
import { useFetch } from "../../lib/useFetch";
import { ProductCard } from "../../components/ProductCard";
import type { PublicProductSummary } from "../../../shared/types";

const FILTERS = [
  { value: "", label: "All" },
  { value: "mens", label: "Men" },
  { value: "womens", label: "Women" },
] as const;

export function ProductsPage() {
  const [gender, setGender] = useState<string>("");
  const { data, loading } = useFetch<PublicProductSummary[]>(
    `/api/public/products${gender ? `?gender=${gender}` : ""}`,
  );

  return (
    <div className="mx-auto max-w-6xl px-5 py-16">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="eyebrow mb-3">Shop</p>
          <h1 className="display-hero text-4xl">The pieces</h1>
        </div>
        <div className="flex gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setGender(f.value)}
              className={`px-4 py-2 text-[0.72rem] font-medium uppercase tracking-editorial transition-colors ${
                gender === f.value
                  ? "bg-navy text-chalk"
                  : "border border-ink/20 text-ink/70 hover:border-ink"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton aspect-[4/5]" />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <p className="prose-editorial py-16 text-center">
          Nothing here yet — the atelier is still cutting. Join the waitlist for
          first access.
        </p>
      ) : (
        <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {data.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
