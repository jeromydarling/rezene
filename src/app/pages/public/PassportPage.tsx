import { useParams, Link } from "react-router";
import { useFetch } from "../../lib/useFetch";
import { useBrand } from "../../lib/brand";

interface Passport {
  brandName: string | null;
  name: string;
  slug: string;
  category: string;
  subtitle: string | null;
  fabricComposition: string | null;
  careSummary: string | null;
  originStatement: string | null;
}

/**
 * Digital Product Passport — a public, printable page a shop can link from a
 * care label (or a QR on it). Carries the material, care, and origin facts a
 * conscious buyer (and, increasingly, regulation) asks for.
 */
export function PassportPage() {
  const { slug } = useParams();
  const brand = useBrand();
  const { data, loading, error } = useFetch<Passport>(slug ? `/api/public/passport/${slug}` : null);

  if (loading) return <div className="mx-auto max-w-lg px-5 py-24 text-center text-sm text-ink/50">Loading…</div>;
  if (error || !data)
    return (
      <div className="mx-auto max-w-lg px-5 py-24 text-center">
        <p className="prose-editorial">Passport not found.</p>
      </div>
    );

  const rows: [string, string | null][] = [
    ["Category", data.category],
    ["Composition", data.fabricComposition],
    ["Made in", data.originStatement],
    ["Care", data.careSummary],
  ];

  return (
    <div className="mx-auto max-w-lg px-5 py-14">
      <div className="rounded-xl border border-ink/12 p-7">
        <div className="border-b border-ink/10 pb-4 text-center">
          <p className="text-[0.6rem] uppercase tracking-editorial text-ink/45">Digital Product Passport</p>
          <h1 className="mt-1 font-display text-2xl font-light">{data.name}</h1>
          {data.subtitle && <p className="text-sm text-warmgrey">{data.subtitle}</p>}
          <p className="mt-1 text-xs text-ink/50">{data.brandName || brand.brandName}</p>
        </div>

        <dl className="divide-y divide-ink/8">
          {rows.map(([label, value]) => (
            <div key={label} className="flex gap-4 py-3">
              <dt className="w-28 shrink-0 text-xs uppercase tracking-wide text-ink/45">{label}</dt>
              <dd className="text-sm text-ink/85">{value || <span className="text-ink/35">—</span>}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-4 text-center text-[0.65rem] text-ink/40">
          Issued by {data.brandName || brand.brandName}. Made to be worn for years, not seasons.
        </p>
      </div>

      <div className="no-print mt-5 flex justify-center gap-3">
        <Link to={`/products/${data.slug}`} className="btn btn-secondary !py-1.5 text-xs">
          View product
        </Link>
        <button type="button" className="btn btn-secondary !py-1.5 text-xs" onClick={() => window.print()}>
          Print
        </button>
      </div>
    </div>
  );
}
