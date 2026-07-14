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

interface FunnelStage {
  event: string;
  label: string;
  count: number;
  pctOfTotal: number;
}
interface Funnel {
  total: number;
  stages: FunnelStage[];
  signupsByDay: { day: string; n: number }[];
}

/**
 * The activation funnel — the answer to "where do new shops drop off?" Each bar
 * is the share of shops that have crossed that milestone; the biggest step-down
 * between two adjacent bars is where onboarding is leaking.
 */
function ActivationFunnel() {
  const { data, loading } = useFetch<Funnel>("/api/admin/platform/activation-funnel");
  if (loading || !data) return null;

  // Find the largest drop between adjacent stages to call out the leak.
  let worstIdx = -1;
  let worstDrop = 0;
  for (let i = 1; i < data.stages.length; i++) {
    const drop = data.stages[i - 1].count - data.stages[i].count;
    if (drop > worstDrop) {
      worstDrop = drop;
      worstIdx = i;
    }
  }

  return (
    <div className="admin-card mb-6 p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-warmgrey">
          Activation funnel
        </p>
        <p className="text-xs text-warmgrey">
          {data.total} shop{data.total === 1 ? "" : "s"} on the platform
        </p>
      </div>
      <div className="space-y-2">
        {data.stages.map((s, i) => {
          const width = data.total ? Math.max(2, (s.count / data.total) * 100) : 0;
          const leak = i === worstIdx && worstDrop > 0;
          return (
            <div key={s.event} className="flex items-center gap-3">
              <span className="w-40 shrink-0 text-right text-xs text-ink/70">{s.label}</span>
              <div className="relative h-6 flex-1 overflow-hidden rounded bg-ink/5">
                <div
                  className={`h-full rounded ${leak ? "bg-terracotta/70" : "bg-navy/70"}`}
                  style={{ width: `${width}%` }}
                />
                <span className="absolute inset-y-0 left-2 flex items-center text-[0.7rem] font-medium tabular-nums text-ink/80">
                  {s.count} · {s.pctOfTotal}%
                </span>
              </div>
              {leak && (
                <span className="w-28 shrink-0 text-[0.62rem] uppercase tracking-wider text-terracotta">
                  ↓ biggest drop
                </span>
              )}
              {!leak && <span className="w-28 shrink-0" />}
            </div>
          );
        })}
      </div>
      {data.total === 0 && (
        <p className="mt-3 text-xs text-warmgrey">
          No shops yet — the funnel fills in as shops sign up and set up.
        </p>
      )}
    </div>
  );
}

interface LuluInfo {
  configured: boolean;
  webhookUrl: string;
  env: string;
  webhooks: { id: string; url: string; topics: string[]; isActive: boolean }[];
  error?: string;
}

/**
 * Lulu print fulfilment: register the status webhook with one click (Lulu has
 * no dashboard UI for webhooks — they're API-only).
 */
function LuluIntegrationCard() {
  const { data, loading, reload } = useFetch<LuluInfo>("/api/admin/platform/lulu");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (loading || !data) return null;

  async function register() {
    setBusy(true);
    setErr(null);
    try {
      await api.post("/api/admin/platform/lulu/webhook");
      reload();
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : "Couldn't register");
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: string) {
    setBusy(true);
    try {
      await api.delete(`/api/admin/platform/lulu/webhook/${id}`);
      reload();
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }

  const hasHook = data.webhooks.some((w) => w.url === data.webhookUrl);
  return (
    <div className="admin-card mb-6 p-5">
      <div className="mb-2 flex items-baseline justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-warmgrey">Lulu print &amp; mail</p>
        <span className="text-xs text-warmgrey">{data.env}</span>
      </div>
      {!data.configured ? (
        <p className="text-sm text-warmgrey">
          Not connected. Set <code>LULU_CLIENT_KEY</code> / <code>LULU_CLIENT_SECRET</code> as Worker
          secrets to enable printed lookbooks.
        </p>
      ) : (
        <>
          <p className="text-sm text-ink/80">
            Connected. Lulu has no webhook screen — register the status webhook here so orders update
            their tracking automatically.
          </p>
          <p className="mt-1 font-mono text-xs text-warmgrey">{data.webhookUrl}</p>
          {err && <ErrorNote message={err} />}
          {data.error && <p className="mt-1 text-xs text-terracotta">{data.error}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {hasHook ? (
              <span className="text-xs font-medium text-palm">✓ Webhook registered</span>
            ) : (
              <button type="button" className="btn btn-primary !px-3 !py-1 text-xs" disabled={busy} onClick={() => void register()}>
                {busy ? "…" : "Register webhook"}
              </button>
            )}
            {data.webhooks.map((w) => (
              <span key={w.id} className="flex items-center gap-1 text-xs text-warmgrey">
                {w.topics.join(", ")}
                <button type="button" className="text-warmgrey hover:text-red-700" onClick={() => void remove(w.id)}>✕</button>
              </span>
            ))}
          </div>
          <p className="mt-2 text-[0.7rem] text-warmgrey">
            Not required to test — each order's “Refresh tracking” polls Lulu directly. The webhook
            just makes updates automatic.
          </p>
        </>
      )}
    </div>
  );
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
      <ActivationFunnel />
      <LuluIntegrationCard />
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
