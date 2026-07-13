import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { captureError } from "./sentry";

/**
 * App-wide toast notifications. Two entry points:
 *  - useToast() inside React (success/info/error with actions)
 *  - emitToast() from anywhere (e.g. the non-React api client) via a tiny bus
 *
 * The goal (per product): nobody hits an error and gets stuck or confused.
 * Errors are human-readable and reassure that they're being handled. reportError
 * is the single Sentry hook — wire it up when the DSN lands.
 */

export type ToastKind = "error" | "success" | "info";
export interface Toast {
  id: string;
  kind: ToastKind;
  message: string;
  detail?: string;
  /** ms before auto-dismiss; errors linger, successes are brief. 0 = sticky. */
  duration?: number;
  /** Optional action button (e.g. Undo) — runs, then dismisses. */
  action?: { label: string; run: () => void | Promise<void> };
}

type Listener = (t: Omit<Toast, "id">) => void;
const listeners = new Set<Listener>();
let seq = 0;
const nextId = () => `t${Date.now()}_${seq++}`;

/** Push a toast from anywhere (React or not). */
export function emitToast(t: Omit<Toast, "id">): void {
  listeners.forEach((l) => l(t));
}

/**
 * Single reporting hook. Ships to Sentry when configured (via captureError),
 * falling back to console otherwise. Kept separate from display so we can
 * report silently as well as toast.
 */
export function reportError(error: unknown, context?: Record<string, unknown>): void {
  captureError(error, context);
}

interface ToastApi {
  toast: (t: Omit<Toast, "id">) => void;
  success: (message: string, detail?: string) => void;
  error: (message: string, detail?: string) => void;
  info: (message: string, detail?: string) => void;
  /** A success toast with an action button — the undo pattern. */
  undo: (message: string, run: () => void | Promise<void>) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((cur) => cur.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (t: Omit<Toast, "id">) => {
      const id = nextId();
      const duration = t.duration ?? (t.kind === "error" ? 8000 : 4000);
      setToasts((cur) => [...cur.slice(-3), { ...t, id }]);
      if (duration > 0) setTimeout(() => dismiss(id), duration);
    },
    [dismiss],
  );

  // Bridge the module-level bus (api client, etc.) into React state.
  useEffect(() => {
    listeners.add(push);
    return () => {
      listeners.delete(push);
    };
  }, [push]);

  const api: ToastApi = {
    toast: push,
    success: (message, detail) => push({ kind: "success", message, detail }),
    error: (message, detail) => push({ kind: "error", message, detail }),
    info: (message, detail) => push({ kind: "info", message, detail }),
    undo: (message, run) => push({ kind: "success", message, duration: 8000, action: { label: "Undo", run } }),
    dismiss,
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <Toaster toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

const TONE: Record<ToastKind, string> = {
  error: "border-red-300 bg-red-50 text-red-900",
  success: "border-emerald-300 bg-emerald-50 text-emerald-900",
  info: "border-navy/20 bg-white text-ink",
};
const ICON: Record<ToastKind, string> = { error: "!", success: "✓", info: "i" };

function Toaster({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:items-end">
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.kind === "error" ? "alert" : "status"}
          className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border px-4 py-3 shadow-lg ${TONE[t.kind]}`}
        >
          <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full border border-current text-[11px] font-bold">
            {ICON[t.kind]}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{t.message}</p>
            {t.detail && <p className="mt-0.5 text-xs opacity-80">{t.detail}</p>}
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  void t.action!.run();
                  onDismiss(t.id);
                }}
                className="mt-1.5 rounded border border-current px-2 py-0.5 text-xs font-medium hover:bg-white/60"
              >
                {t.action.label}
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => onDismiss(t.id)}
            aria-label="Dismiss"
            className="flex-none text-lg leading-none opacity-50 hover:opacity-100"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
