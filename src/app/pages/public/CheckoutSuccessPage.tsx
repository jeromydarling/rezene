import { Link, useSearchParams } from "react-router";
import { useFetch } from "../../lib/useFetch";
import { formatMoney } from "../../lib/format";

interface Confirmation {
  orderNumber: string;
  paymentStatus: string;
  totalCents: number;
  currency: string;
  isPreOrder: boolean;
}

export function CheckoutSuccessPage() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const { data, loading, error } = useFetch<Confirmation>(
    sessionId ? `/api/public/checkout/confirm?session_id=${encodeURIComponent(sessionId)}` : null,
  );

  return (
    <div className="mx-auto max-w-xl px-5 py-24 text-center">
      <p className="eyebrow mb-4">Merci</p>
      <h1 className="display-hero text-4xl">Your order is in.</h1>
      {loading && <p className="prose-editorial mt-6">Confirming with the atelier…</p>}
      {error && (
        <p className="prose-editorial mt-6">
          Payment received — your confirmation email is on its way.
        </p>
      )}
      {data && (
        <div className="mt-8 space-y-2">
          <p className="prose-editorial">
            Order <strong className="font-semibold">{data.orderNumber}</strong> ·{" "}
            {formatMoney(data.totalCents, data.currency)}
          </p>
          {data.paymentStatus === "pending" && (
            <p className="text-sm text-warmgrey">
              Payment is being confirmed — you'll receive an email shortly.
            </p>
          )}
          {data.isPreOrder && (
            <p className="mx-auto max-w-md bg-saffron/15 px-4 py-3 text-sm text-bark">
              This is a pre-order. Your piece will be cut in the Casablanca
              production run and ships when it clears quality control — we'll
              keep you posted at every stage.
            </p>
          )}
        </div>
      )}
      <div className="mt-10 flex justify-center gap-4">
        <Link to="/products" className="btn btn-primary">
          Keep browsing
        </Link>
        <Link to="/journal" className="btn btn-secondary">
          Read the journal
        </Link>
      </div>
    </div>
  );
}
