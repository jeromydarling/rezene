import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useFetch } from "../../lib/useFetch";
import { api, ApiRequestError } from "../../lib/api";
import { useCart } from "../../lib/cart";
import { formatDate, formatMoney } from "../../lib/format";
import { track } from "../../lib/analytics";
import { EditorialImage } from "../../components/ImagePlaceholder";
import { ProductCard } from "../../components/ProductCard";
import { NewsletterForm } from "../../components/LeadForm";
import type { PublicProductDetail } from "../../../shared/types";

export function ProductDetailPage() {
  const { slug } = useParams();
  const { data: product, loading, error } = useFetch<PublicProductDetail>(
    slug ? `/api/public/products/${slug}` : null,
  );
  const cart = useCart();
  const navigate = useNavigate();

  const [colorway, setColorway] = useState<string>("");
  const [size, setSize] = useState<string>("");
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (product) {
      track("product_view", { entityType: "product", entityId: product.id });
      setColorway(product.variants[0]?.colorwayName ?? "");
      setSize("");
      setCheckoutError(null);
    }
  }, [product]);

  const colorways = useMemo(
    () => [...new Set(product?.variants.map((v) => v.colorwayName) ?? [])],
    [product],
  );
  const sizes = useMemo(
    () => product?.variants.filter((v) => v.colorwayName === colorway) ?? [],
    [product, colorway],
  );
  const selectedVariant = sizes.find((v) => v.size === size) ?? null;

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-24 text-center">
        <p className="prose-editorial">We couldn't find that piece.</p>
        <Link to="/products" className="link-quiet mt-4 inline-block text-sm">
          Back to the shop
        </Link>
      </div>
    );
  }
  if (loading || !product) {
    return (
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:grid-cols-2">
        <div className="skeleton aspect-[4/5]" />
        <div className="space-y-4">
          <div className="skeleton h-10 w-2/3" />
          <div className="skeleton h-4 w-1/3" />
          <div className="skeleton h-24 w-full" />
        </div>
      </div>
    );
  }

  const isPreOrder = product.availability === "pre_order";
  const isSoldOut = product.availability === "sold_out";
  const canBuy = !isSoldOut && (selectedVariant ? selectedVariant.inStock : true);

  function addToCart(goToCart: boolean) {
    if (!selectedVariant || !product) {
      setCheckoutError("Select a size first.");
      return;
    }
    setCheckoutError(null);
    cart.add({
      variantId: selectedVariant.id,
      productSlug: product.slug,
      productName: product.name,
      variantLabel: `${selectedVariant.colorwayName} / ${selectedVariant.size}`,
      priceCents: selectedVariant.priceCents,
      currency: selectedVariant.currency,
      isPreOrder: product.availability === "pre_order",
      imageUrl: product.imageUrl,
    });
    track("add_to_cart", { entityType: "product", entityId: product.id });
    if (goToCart) {
      navigate("/cart");
    } else {
      setAdded(true);
      setTimeout(() => setAdded(false), 1800);
    }
  }

  async function startCheckout() {
    if (!selectedVariant) {
      setCheckoutError("Select a size first.");
      return;
    }
    setCheckoutBusy(true);
    setCheckoutError(null);
    track("checkout_started", { entityType: "product", entityId: product!.id });
    try {
      const res = await api.post<{ url: string }>("/api/public/checkout", {
        variantId: selectedVariant.id,
        quantity: 1,
      });
      window.location.href = res.url;
    } catch (err) {
      setCheckoutError(
        err instanceof ApiRequestError && err.status !== 500
          ? err.message
          : "Checkout is momentarily unavailable. Please try again.",
      );
    } finally {
      setCheckoutBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <nav className="mb-8 text-xs uppercase tracking-editorial text-warmgrey">
        <Link to="/products" className="hover:text-ink">
          Shop
        </Link>{" "}
        / <span className="text-ink/70">{product.name}</span>
      </nav>

      <div className="grid gap-12 md:grid-cols-2">
        {/* Images */}
        {/* min-w-0 on both columns so wide children (the size chart table)
            scroll inside their own container instead of stretching the page */}
        <div className="min-w-0 space-y-4">
          <EditorialImage
            src={product.images[0]?.url ?? null}
            alt={product.images[0]?.altText ?? product.name}
            label={product.name}
          />
          {product.images.length > 1 && (
            <div className="grid grid-cols-3 gap-3">
              {product.images.slice(1, 4).map((img, i) => (
                <EditorialImage
                  key={i}
                  src={img.url}
                  alt={img.altText ?? product.name}
                  label={img.colorwayName ?? product.name}
                  aspect="aspect-square"
                />
              ))}
            </div>
          )}
        </div>

        {/* Purchase panel */}
        <div className="min-w-0">
          <p className="eyebrow mb-2">{product.category}</p>
          <h1 className="font-display text-4xl font-light">{product.name}</h1>
          {product.subtitle && <p className="mt-1 text-sm text-warmgrey">{product.subtitle}</p>}
          <p className="mt-4 text-xl">{formatMoney(product.basePriceCents, product.currency)}</p>

          {isPreOrder && (
            <p className="mt-3 inline-block bg-saffron/20 px-3 py-1 text-xs font-semibold uppercase tracking-editorial text-bark">
              Pre-order — {product.preOrderNote ?? "ships with the first production run"}
            </p>
          )}

          {/* Pre-order campaign progress — live numbers from the production run */}
          {isPreOrder && product.campaign && (
            <div className="mt-4 max-w-sm">
              <div className="mb-1 flex items-baseline justify-between text-xs">
                <span className="font-semibold uppercase tracking-wider text-bark">
                  {product.campaign.status === "funded"
                    ? "Production run confirmed ✓"
                    : "Backing the production run"}
                </span>
                <span className="text-warmgrey">
                  {product.campaign.orderedUnits} / {product.campaign.goalUnits} pieces
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-ink/10">
                <div
                  className={`h-2 rounded-full ${
                    product.campaign.status === "funded" ? "bg-palm" : "bg-saffron"
                  }`}
                  style={{
                    width: `${Math.min(100, Math.round((product.campaign.orderedUnits / product.campaign.goalUnits) * 100))}%`,
                  }}
                />
              </div>
              {product.campaign.cutoffDate && (
                <p className="mt-1 text-xs text-warmgrey">
                  Pre-orders close {formatDate(product.campaign.cutoffDate)}
                </p>
              )}
            </div>
          )}

          <p className="prose-editorial mt-6">{product.description}</p>

          {/* Colorway */}
          {colorways.length > 0 && (
            <div className="mt-8">
              <p className="label">Colorway — {colorway}</p>
              <div className="flex flex-wrap gap-2">
                {colorways.map((cw) => (
                  <button
                    key={cw}
                    type="button"
                    onClick={() => {
                      setColorway(cw);
                      setSize("");
                    }}
                    className={`border px-4 py-2 text-xs uppercase tracking-wider transition-colors ${
                      colorway === cw
                        ? "border-navy bg-navy text-chalk"
                        : "border-ink/20 hover:border-ink"
                    }`}
                  >
                    {cw}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Size */}
          {sizes.length > 0 && (
            <div className="mt-5">
              <div className="flex items-baseline justify-between">
                <p className="label">Size</p>
                <Link to="/size-guide" className="link-quiet text-xs">
                  Size guide
                </Link>
              </div>
              <div className="flex flex-wrap gap-2">
                {sizes.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    disabled={!v.inStock}
                    onClick={() => setSize(v.size)}
                    className={`min-w-12 border px-3 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                      size === v.size
                        ? "border-navy bg-navy text-chalk"
                        : "border-ink/20 hover:border-ink"
                    }`}
                  >
                    {v.size}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* CTA */}
          <div className="mt-8 space-y-3">
            {isSoldOut ? (
              <div className="space-y-3">
                <p className="text-sm font-semibold uppercase tracking-editorial text-warmgrey">
                  Sold out
                </p>
                <p className="text-sm text-ink/70">Be notified when this piece returns:</p>
                <NewsletterForm kind="drop_notification" />
              </div>
            ) : (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => addToCart(false)}
                  disabled={!canBuy}
                  className="btn btn-primary flex-1 py-3.5"
                >
                  {added ? "Added ✓" : isPreOrder ? "Add pre-order to cart" : "Add to cart"}
                </button>
                <button
                  type="button"
                  onClick={startCheckout}
                  disabled={!canBuy || checkoutBusy}
                  className="btn btn-secondary py-3.5"
                >
                  {checkoutBusy ? "…" : "Buy now"}
                </button>
              </div>
            )}
            {checkoutError && <p className="field-error text-center">{checkoutError}</p>}
            {product.shippingNote && (
              <p className="text-center text-xs text-warmgrey">{product.shippingNote}</p>
            )}
          </div>

          {/* Size chart — computed from the production spec the factory sews to */}
          {product.sizeChart && (
            <div className="mt-10">
              <p className="label">
                Measurements ({product.sizeChart.unit}) — from the production spec
              </p>
              <div className="overflow-x-auto">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th></th>
                      {product.sizeChart.sizes.map((s) => (
                        <th key={s} className={s === product.sizeChart!.baseSize ? "text-ink" : ""}>
                          {s}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {product.sizeChart.rows.map((row) => (
                      <tr key={row.code}>
                        <td className="font-medium">{row.name}</td>
                        {row.values.map((v, i) => (
                          <td key={i}>{v ?? "—"}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Details */}
          <dl className="mt-10 divide-y divide-ink/10 border-y border-ink/10">
            {[
              ["Fit", product.fitNotes],
              ["Fabric", product.fabricComposition],
              ["Care", product.careSummary],
              ["Origin", product.originStatement],
            ]
              .filter(([, v]) => v)
              .map(([label, value]) => (
                <div key={label} className="grid grid-cols-3 gap-4 py-3 text-sm">
                  <dt className="font-semibold uppercase tracking-wider text-[0.7rem] text-warmgrey">
                    {label}
                  </dt>
                  <dd className="col-span-2 text-ink/80">{value}</dd>
                </div>
              ))}
          </dl>
        </div>
      </div>

      {/* Editorial story */}
      {product.editorialStory && (
        <section className="mx-auto mt-20 max-w-2xl text-center">
          <p className="eyebrow mb-4">The story</p>
          <p className="font-display text-xl font-light leading-relaxed text-ink/85">
            {product.editorialStory}
          </p>
        </section>
      )}

      {/* Related */}
      {product.related.length > 0 && (
        <section className="mt-20">
          <p className="eyebrow mb-6">Wears well with</p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {product.related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
