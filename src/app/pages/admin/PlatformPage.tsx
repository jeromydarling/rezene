import { useState } from "react";
import { useFetch } from "../../lib/useFetch";
import { api, ApiRequestError } from "../../lib/api";
import { formatDate, titleCase } from "../../lib/format";
import {
  EmptyState,
  ErrorNote,
  LoadingTable,
  PageHeader,
  StatusBadge,
} from "../../components/admin/ui";

/**
 * Platform operations (primary shop only): the Verto shop registry.
 * Pending signups are provisioned here — one click creates the shop's own
 * database, seeds it, creates the owner's admin account, and activates the
 * slug. Credentials are shown exactly once.
 */

interface ShopRow {
  id: string;
  slug: string;
  name: string;
  status: string;
  owner_email: string | null;
  plan: string | null;
  custom_domain: string | null;
  note: string | null;
  created_at: string;
}

interface Credentials {
  slug: string;
  adminEmail: string;
  password: string;
  loginUrl: string;
}

export function PlatformPage() {
  const { data, loading, error, reload } = useFetch<ShopRow[]>("/api/admin/platform/shops");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function provision(shop: ShopRow) {
    if (
      !window.confirm(
        `Provision “${shop.name}” at /${shop.slug}? This creates their database and admin account, and the address goes live immediately.`,
      )
    )
      return;
    setBusyId(shop.id);
    setActionError(null);
    try {
      const res = await api.post<Credentials>(`/api/admin/platform/shops/${shop.id}/provision`);
      setCredentials(res);
      reload();
    } catch (err) {
      setActionError(err instanceof ApiRequestError ? err.message : "Provisioning failed");
    } finally {
      setBusyId(null);
    }
  }

  async function setStatus(shop: ShopRow, status: string) {
    await api.patch(`/api/admin/platform/shops/${shop.id}`, { status });
    reload();
  }

  return (
    <div>
      <PageHeader
        eyebrow="Platform"
        title="Verto Shops"
        description="Every shop on the platform. Signups arrive as pending — provision them to create their database, seed a starter site, and email the owner their login."
      />
      {error && <ErrorNote message={error} />}
      {actionError && <ErrorNote message={actionError} />}
      {loading && <LoadingTable />}

      {credentials && (
        <div className="admin-card mb-5 border-palm bg-palm/5 p-5">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-palm">
            Provisioned — credentials shown once
          </p>
          <div className="grid gap-1 font-mono text-sm">
            <p>Admin: {credentials.loginUrl}</p>
            <p>Email: {credentials.adminEmail}</p>
            <p>Password: {credentials.password}</p>
          </div>
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                void navigator.clipboard.writeText(
                  `Admin: ${credentials.loginUrl}\nEmail: ${credentials.adminEmail}\nPassword: ${credentials.password}`,
                )
              }
            >
              Copy credentials
            </button>
            <button type="button" className="link-quiet text-xs" onClick={() => setCredentials(null)}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      {data && data.length === 0 && (
        <EmptyState title="No shops yet" hint="Signups from the Verto marketing site land here." />
      )}
      {data && data.length > 0 && (
        <div className="admin-card overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Shop</th>
                <th>Address</th>
                <th>Owner</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Signed up</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.map((shop) => (
                <tr key={shop.id}>
                  <td className="font-medium">
                    {shop.name}
                    {shop.note && <p className="text-xs font-normal text-warmgrey">{shop.note}</p>}
                  </td>
                  <td className="font-mono text-xs">
                    /{shop.slug}
                    {shop.custom_domain && (
                      <p className="text-warmgrey">{shop.custom_domain}</p>
                    )}
                  </td>
                  <td className="text-xs">{shop.owner_email ?? "—"}</td>
                  <td className="text-xs">{shop.plan ? titleCase(shop.plan) : "—"}</td>
                  <td>
                    <StatusBadge status={shop.status} />
                  </td>
                  <td className="text-xs text-warmgrey">{formatDate(shop.created_at)}</td>
                  <td className="text-right">
                    {shop.status === "pending" && (
                      <button
                        type="button"
                        className="btn btn-primary !px-3 !py-1 text-xs"
                        disabled={busyId !== null}
                        onClick={() => void provision(shop)}
                      >
                        {busyId === shop.id ? "Provisioning…" : "Provision"}
                      </button>
                    )}
                    {shop.status === "active" && shop.id !== "shop_rezene" && (
                      <button
                        type="button"
                        className="text-xs text-warmgrey hover:text-red-700 hover:underline"
                        onClick={() => {
                          if (window.confirm(`Suspend /${shop.slug}? The address stops routing.`)) {
                            void setStatus(shop, "suspended");
                          }
                        }}
                      >
                        Suspend
                      </button>
                    )}
                    {shop.status === "suspended" && (
                      <button
                        type="button"
                        className="link-quiet text-xs"
                        onClick={() => void setStatus(shop, "active")}
                      >
                        Reactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-4 text-xs text-warmgrey">
        Custom domains: set the shop's domain here after adding it as a custom domain on the Worker
        in the Cloudflare dashboard — the CNAME then routes straight to their shop.
      </p>
    </div>
  );
}
