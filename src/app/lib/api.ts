/** Typed JSON fetch helpers for the Worker API. */

export class ApiRequestError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

import { getShop } from "./shop";

/** Tenant selector: tells the worker which shop's database serves this call. */
function shopHeaders(): Record<string, string> {
  const shop = getShop();
  return shop ? { "x-verto-shop": shop.slug } : {};
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "content-type": "application/json", ...shopHeaders(), ...init?.headers },
    credentials: "same-origin",
    ...init,
  });
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await res.json().catch(() => null) : null;
  if (!res.ok) {
    const message =
      body && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : `Request failed (${res.status})`;
    throw new ApiRequestError(res.status, message, (body as { details?: unknown })?.details);
  }
  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  /** Fetch a non-JSON body (e.g. preview HTML) with the tenant header attached. */
  getText: async (path: string): Promise<string> => {
    const res = await fetch(path, { headers: shopHeaders(), credentials: "same-origin" });
    if (!res.ok) throw new ApiRequestError(res.status, `Request failed (${res.status})`);
    return res.text();
  },
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "POST", body: data === undefined ? undefined : JSON.stringify(data) }),
  patch: <T>(path: string, data: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(data) }),
  put: <T>(path: string, data: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(data) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  /** Multipart upload (no JSON content-type header). */
  upload: async <T>(path: string, form: FormData): Promise<T> => {
    const res = await fetch(path, {
      method: "POST",
      body: form,
      headers: shopHeaders(),
      credentials: "same-origin",
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      throw new ApiRequestError(
        res.status,
        (body as { error?: string })?.error ?? `Upload failed (${res.status})`,
      );
    }
    return body as T;
  },
};
