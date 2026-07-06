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
import { emitToast, reportError } from "./toast";

/** Tenant selector: tells the worker which shop's database serves this call. */
function shopHeaders(): Record<string, string> {
  const shop = getShop();
  return shop ? { "x-verto-shop": shop.slug } : {};
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      headers: { "content-type": "application/json", ...shopHeaders(), ...init?.headers },
      credentials: "same-origin",
      ...init,
    });
  } catch (networkErr) {
    // Offline / DNS / TLS — the request never reached the server.
    reportError(networkErr, { path });
    emitToast({
      kind: "error",
      message: "Can’t reach the server",
      detail: "Check your connection — we’ll keep your work here and you can retry.",
    });
    throw new ApiRequestError(0, "Network error — please try again");
  }
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await res.json().catch(() => null) : null;
  if (!res.ok) {
    const message =
      body && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : `Request failed (${res.status})`;
    // Server-side faults get a reassuring global toast + a report; expected
    // 4xx (validation, auth, not-found) are surfaced inline by the caller.
    if (res.status >= 500) {
      reportError(new Error(`${res.status} ${path}: ${message}`), { path, status: res.status });
      emitToast({
        kind: "error",
        message: "Something went wrong on our end",
        detail: "We’ve logged it and we’re looking into it. Please try again in a moment.",
      });
    }
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
