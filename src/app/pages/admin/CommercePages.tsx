import { useFetch } from "../../lib/useFetch";
import { formatDate, formatMoney } from "../../lib/format";
import {
  EmptyState,
  ErrorNote,
  LoadingTable,
  PageHeader,
  StatusBadge,
} from "../../components/admin/ui";
import type { AdminCustomer, AdminOrder } from "../../../shared/types";

export function OrdersPage() {
  const { data, loading, error } = useFetch<AdminOrder[]>("/api/admin/commerce/orders");
  return (
    <div>
      <PageHeader
        eyebrow="Commerce"
        title="Orders"
        description="Stripe-backed orders. Payment state mirrors Stripe via webhooks; fulfillment is managed here."
      />
      {error && <ErrorNote message={error} />}
      {loading && <LoadingTable />}
      {data && data.length === 0 && (
        <EmptyState
          title="No orders yet"
          hint="Orders appear here when Stripe Checkout completes — configure Stripe keys and webhooks to go live."
        />
      )}
      {data && data.length > 0 && (
        <div className="admin-card overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Total</th>
                <th>Payment</th>
                <th>Fulfillment</th>
                <th>Country</th>
                <th>Placed</th>
              </tr>
            </thead>
            <tbody>
              {data.map((o) => (
                <tr key={o.id}>
                  <td className="font-mono text-xs">
                    {o.orderNumber}
                    {o.isPreOrder && <span className="badge badge-saffron ml-2">pre-order</span>}
                  </td>
                  <td>{o.customerName ?? o.email ?? "—"}</td>
                  <td>{o.itemCount}</td>
                  <td>{formatMoney(o.totalCents, o.currency)}</td>
                  <td>
                    <StatusBadge status={o.paymentStatus} />
                  </td>
                  <td>
                    <StatusBadge status={o.fulfillmentStatus} />
                  </td>
                  <td>{o.shippingCountry ?? "—"}</td>
                  <td className="text-xs text-warmgrey">{formatDate(o.placedAt ?? o.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function CustomersPage() {
  const { data, loading, error } = useFetch<AdminCustomer[]>("/api/admin/commerce/customers");
  return (
    <div>
      <PageHeader
        eyebrow="Commerce"
        title="Customers"
        description="Customer records mirror Stripe customers — only IDs and non-sensitive metadata are stored."
      />
      {error && <ErrorNote message={error} />}
      {loading && <LoadingTable />}
      {data && data.length === 0 && (
        <EmptyState title="No customers yet" hint="Created automatically from Stripe checkout." />
      )}
      {data && data.length > 0 && (
        <div className="admin-card overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Name</th>
                <th>Country</th>
                <th>Orders</th>
                <th>Lifetime spend</th>
                <th>Since</th>
              </tr>
            </thead>
            <tbody>
              {data.map((cust) => (
                <tr key={cust.id}>
                  <td className="font-medium">{cust.email}</td>
                  <td>{cust.name ?? "—"}</td>
                  <td>{cust.country ?? "—"}</td>
                  <td>{cust.orderCount}</td>
                  <td>{formatMoney(cust.totalSpentCents)}</td>
                  <td className="text-xs text-warmgrey">{formatDate(cust.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

interface LeadRow {
  id: string;
  kind: string;
  email: string;
  name: string | null;
  company: string | null;
  message: string | null;
  created_at: string;
}

export function LeadsSection() {
  const { data } = useFetch<LeadRow[]>("/api/admin/commerce/leads");
  if (!data || data.length === 0) return null;
  return (
    <div className="mt-8">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-warmgrey">
        Recent leads
      </h2>
      <div className="admin-card overflow-x-auto">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Kind</th>
              <th>Email</th>
              <th>Name / company</th>
              <th>Message</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 25).map((lead) => (
              <tr key={lead.id}>
                <td>
                  <StatusBadge status={lead.kind} />
                </td>
                <td>{lead.email}</td>
                <td>{[lead.name, lead.company].filter(Boolean).join(" · ") || "—"}</td>
                <td className="max-w-xs truncate text-xs text-warmgrey">{lead.message ?? "—"}</td>
                <td className="text-xs text-warmgrey">{formatDate(lead.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
