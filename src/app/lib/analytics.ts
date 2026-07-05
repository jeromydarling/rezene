/** Fire-and-forget analytics events into the D1-backed foundation. */

function sessionKey(): string {
  const KEY = "ma_session_key";
  let value = localStorage.getItem(KEY);
  if (!value) {
    value = crypto.randomUUID();
    localStorage.setItem(KEY, value);
  }
  return value;
}

export function track(
  event: string,
  props: { entityType?: string; entityId?: string; properties?: Record<string, unknown> } = {},
): void {
  try {
    void fetch("/api/public/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        event,
        sessionKey: sessionKey(),
        path: location.pathname,
        referrer: document.referrer || undefined,
        ...props,
      }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Analytics must never break the page.
  }
}
