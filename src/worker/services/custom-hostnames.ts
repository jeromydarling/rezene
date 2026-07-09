import type { Env } from "../types/env";

/**
 * Automated custom domains via Cloudflare for SaaS (Custom Hostnames).
 *
 * When a merchant saves their domain, we register it as a custom hostname on
 * the platform zone; Cloudflare validates it over HTTP (their CNAME already
 * points at us, so validation is automatic) and issues the certificate —
 * typically live in under a minute, no human in the loop. The status
 * endpoint polls Cloudflare and flips the shop's registry `custom_domain`
 * the moment the certificate goes active, which is when the tenant
 * middleware starts routing the hostname.
 *
 * Needs two worker secrets: CF_API_TOKEN (Zone > SSL and Certificates >
 * Edit, plus Zone > Custom Hostnames > Edit on the platform zone) and
 * CF_ZONE_ID. Without them everything degrades to the manual flow (the
 * HQ notification email), never crashes — house rule.
 */

export function customHostnamesConfigured(env: Env): boolean {
  return Boolean(env.CF_API_TOKEN && env.CF_ZONE_ID);
}

type CfResult<T> = { success: boolean; result?: T; errors?: { code: number; message: string }[] };

type CustomHostname = {
  id: string;
  hostname: string;
  status: string; // active | pending | ...
  ssl?: { status: string }; // initializing | pending_validation | active | ...
};

async function cf<T>(env: Env, method: string, path: string, body?: unknown): Promise<CfResult<T>> {
  const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${env.CF_ZONE_ID}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${env.CF_API_TOKEN}`,
      "content-type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return (await res.json()) as CfResult<T>;
}

/** Find the custom hostname entry for a domain, if one exists. */
export async function findCustomHostname(env: Env, domain: string): Promise<CustomHostname | null> {
  const r = await cf<CustomHostname[]>(env, "GET", `/custom_hostnames?hostname=${encodeURIComponent(domain)}`);
  return r.success && r.result?.length ? r.result[0] : null;
}

/**
 * Register a hostname (idempotent — reuses an existing entry). Returns the
 * entry or an error message suitable for logs.
 */
export async function ensureCustomHostname(
  env: Env,
  domain: string,
): Promise<{ ok: true; hostname: CustomHostname } | { ok: false; error: string }> {
  const existing = await findCustomHostname(env, domain);
  if (existing) return { ok: true, hostname: existing };
  const r = await cf<CustomHostname>(env, "POST", "/custom_hostnames", {
    hostname: domain,
    ssl: { method: "http", type: "dv", settings: { min_tls_version: "1.2" } },
  });
  if (r.success && r.result) return { ok: true, hostname: r.result };
  return { ok: false, error: r.errors?.map((e) => e.message).join("; ") || "Cloudflare rejected the hostname" };
}

/** Certificate live? (ssl.status === "active" means TLS works in browsers.) */
export async function customHostnameActive(env: Env, domain: string): Promise<boolean> {
  const entry = await findCustomHostname(env, domain);
  return entry?.ssl?.status === "active";
}

/**
 * Point the registry at the domain once TLS is live so the tenant
 * middleware starts serving it. Idempotent.
 */
export async function activateShopDomain(env: Env, shopId: string, domain: string): Promise<void> {
  await env.DB.prepare(`UPDATE shops SET custom_domain = ? WHERE id = ? AND (custom_domain IS NULL OR custom_domain != ?)`)
    .bind(domain, shopId, domain)
    .run();
}
