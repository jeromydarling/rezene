import type { ReactNode } from "react";

/** Shared admin chrome: headers, tables, badges, empty/loading states. */

export function PageHeader({
  title,
  eyebrow,
  actions,
  description,
}: {
  title: string;
  eyebrow?: string;
  actions?: ReactNode;
  description?: string;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
        <h1 className="font-display text-2xl font-light">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-warmgrey">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="admin-card flex flex-col items-center gap-3 px-6 py-16 text-center">
      <p className="font-display text-lg font-light text-ink/70">{title}</p>
      {hint && <p className="max-w-md text-sm text-warmgrey">{hint}</p>}
      {action}
    </div>
  );
}

export function LoadingTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="admin-card space-y-3 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton h-9 w-full" />
      ))}
    </div>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <div className="admin-card border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      {message}
    </div>
  );
}

const STATUS_TONES: Record<string, string> = {
  // generic
  active: "badge-success",
  inactive: "badge-neutral",
  draft: "badge-neutral",
  // styles / tech packs
  concept: "badge-neutral",
  design: "badge-navy",
  tech_pack: "badge-navy",
  sampling: "badge-saffron",
  approved: "badge-success",
  production: "badge-olive",
  discontinued: "badge-danger",
  in_review: "badge-saffron",
  sent_to_factory: "badge-navy",
  superseded: "badge-neutral",
  // tasks
  todo: "badge-neutral",
  in_progress: "badge-navy",
  blocked: "badge-danger",
  done: "badge-success",
  cancelled: "badge-neutral",
  // samples
  requested: "badge-neutral",
  shipped: "badge-navy",
  received: "badge-saffron",
  revisions_needed: "badge-terracotta",
  rejected: "badge-danger",
  // commerce
  paid: "badge-success",
  pending: "badge-saffron",
  failed: "badge-danger",
  refunded: "badge-neutral",
  partially_refunded: "badge-terracotta",
  unfulfilled: "badge-neutral",
  processing: "badge-navy",
  delivered: "badge-success",
  // shipments
  created: "badge-neutral",
  label_purchased: "badge-navy",
  in_transit: "badge-saffron",
  out_for_delivery: "badge-olive",
  exception: "badge-danger",
  returned: "badge-terracotta",
  // availability
  available: "badge-success",
  pre_order: "badge-saffron",
  sold_out: "badge-danger",
  archived: "badge-neutral",
  // 3d
  not_started: "badge-neutral",
  pattern_needed: "badge-terracotta",
  in_simulation: "badge-navy",
  fit_review: "badge-saffron",
  // POs
  sent: "badge-navy",
  confirmed: "badge-olive",
  qc: "badge-saffron",
  // concepts
  exploring: "badge-neutral",
  shortlisted: "badge-saffron",
  converted_to_style: "badge-success",
  converted_to_tech_pack: "badge-success",
};

export function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONES[status] ?? "badge-neutral";
  return <span className={`badge ${tone}`}>{status.replaceAll("_", " ")}</span>;
}

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "warn" | "danger" | "good";
}) {
  const valueColor =
    tone === "danger"
      ? "text-red-700"
      : tone === "warn"
        ? "text-terracotta-deep"
        : tone === "good"
          ? "text-palm"
          : "text-ink";
  return (
    <div className="admin-card px-4 py-4">
      <p className="text-[0.68rem] font-semibold uppercase tracking-wider text-warmgrey">{label}</p>
      <p className={`mt-1 font-display text-2xl font-light ${valueColor}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-warmgrey">{hint}</p>}
    </div>
  );
}

/** Slide-over panel for create/edit forms. */
export function SlideOver({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close panel"
        className="absolute inset-0 bg-ink/30"
        onClick={onClose}
      />
      <div className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-ink/10 px-5 py-4">
          <h2 className="font-display text-lg font-light">{title}</h2>
          <button type="button" onClick={onClose} className="text-sm text-warmgrey hover:text-ink">
            Close
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </div>
  );
}
