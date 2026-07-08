import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useFetch } from "../../lib/useFetch";
import { ProductCard } from "../../components/ProductCard";
import type { PublicProductSummary } from "../../../shared/types";

const GENDERS = [
  { value: "", label: "All" },
  { value: "womens", label: "Women" },
  { value: "mens", label: "Men" },
] as const;

const SORTS = [
  { value: "featured", label: "Featured" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "name", label: "A–Z" },
] as const;

export function ProductsPage() {
  const { data, loading } = useFetch<PublicProductSummary[]>("/api/public/products");
  const [q, setQ] = useState("");
  const [gender, setGender] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState<string>("featured");
  const [inStockOnly, setInStockOnly] = useState(false);

  const categories = useMemo(
    () => [...new Set((data ?? []).map((p) => p.category).filter(Boolean))].sort(),
    [data],
  );

  const shown = useMemo(() => {
    let list = [...(data ?? [])];
    const needle = q.trim().toLowerCase();
    if (needle)
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(needle) ||
          (p.subtitle ?? "").toLowerCase().includes(needle) ||
          (p.category ?? "").toLowerCase().includes(needle),
      );
    if (gender) list = list.filter((p) => p.gender === gender);
    if (category) list = list.filter((p) => p.category === category);
    if (inStockOnly) list = list.filter((p) => p.availability === "available" || p.availability === "pre_order");
    switch (sort) {
      case "price_asc":
        list.sort((a, b) => a.basePriceCents - b.basePriceCents);
        break;
      case "price_desc":
        list.sort((a, b) => b.basePriceCents - a.basePriceCents);
        break;
      case "name":
        list.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }
    return list;
  }, [data, q, gender, category, sort, inStockOnly]);

  const hasFilters = q || gender || category || inStockOnly || sort !== "featured";

  return (
    <div className="mx-auto max-w-6xl px-5 py-16">
      <div className="mb-8">
        <p className="eyebrow mb-3">Shop</p>
        <h1 className="display-hero text-4xl">The pieces</h1>
      </div>

      {/* Search + sort */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/40" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search pieces…"
            className="w-full rounded-full border border-ink/15 py-2.5 pl-9 pr-4 text-sm focus:border-ink focus:outline-none"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="rounded-full border border-ink/15 px-4 py-2.5 text-sm focus:border-ink focus:outline-none"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* Facets */}
      <div className="mb-8 flex flex-wrap items-center gap-2">
        {GENDERS.map((g) => (
          <Chip key={g.value} active={gender === g.value} onClick={() => setGender(g.value)}>
            {g.label}
          </Chip>
        ))}
        {categories.length > 1 && <span className="mx-1 h-4 w-px bg-ink/15" />}
        {categories.map((cat) => (
          <Chip key={cat} active={category === cat} onClick={() => setCategory(category === cat ? "" : cat)}>
            {cat}
          </Chip>
        ))}
        <span className="mx-1 h-4 w-px bg-ink/15" />
        <Chip active={inStockOnly} onClick={() => setInStockOnly((v) => !v)}>
          In stock
        </Chip>
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              setGender("");
              setCategory("");
              setSort("featured");
              setInStockOnly(false);
            }}
            className="ml-1 text-xs text-ink/50 underline hover:text-ink"
          >
            Clear
          </button>
        )}
      </div>

      {loading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton aspect-[4/5]" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <p className="prose-editorial py-16 text-center">
          {data && data.length > 0
            ? "No pieces match that — try clearing a filter."
            : "Nothing here yet — the atelier is still cutting. Join the waitlist for first access."}
        </p>
      ) : (
        <>
          <p className="mb-4 text-xs uppercase tracking-editorial text-ink/45">
            {shown.length} {shown.length === 1 ? "piece" : "pieces"}
          </p>
          <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {shown.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-[0.72rem] font-medium uppercase tracking-editorial transition-colors ${
        active ? "bg-navy text-chalk" : "border border-ink/20 text-ink/70 hover:border-ink"
      }`}
    >
      {children}
    </button>
  );
}
