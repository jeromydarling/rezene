import { Link } from "react-router";
import { EditorialImage } from "./ImagePlaceholder";
import { formatMoney } from "../lib/format";
import type { PublicProductSummary } from "../../shared/types";

const AVAILABILITY_LABEL: Record<string, string | null> = {
  pre_order: "Pre-order",
  sold_out: "Sold out",
  draft: "Coming soon",
  available: null,
  archived: null,
};

export function ProductCard({ product }: { product: PublicProductSummary }) {
  const badge = AVAILABILITY_LABEL[product.availability];
  return (
    <Link to={`/products/${product.slug}`} className="group block">
      <div className="relative">
        <EditorialImage src={product.imageUrl} alt={product.imageAlt ?? product.name} label={product.name} />
        {badge && (
          <span className="absolute left-3 top-3 bg-chalk/90 px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-editorial text-ink/80">
            {badge}
          </span>
        )}
      </div>
      <div className="mt-3 flex items-baseline justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-light group-hover:text-terracotta-deep">
            {product.name}
          </h3>
          {product.subtitle && <p className="text-xs text-warmgrey">{product.subtitle}</p>}
        </div>
        <p className="text-sm text-ink/80">{formatMoney(product.basePriceCents, product.currency)}</p>
      </div>
    </Link>
  );
}
