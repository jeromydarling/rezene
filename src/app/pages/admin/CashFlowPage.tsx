import { useState } from "react";
import { useFetch } from "../../lib/useFetch";
import { api } from "../../lib/api";
import { useToast } from "../../lib/toast";
import { formatDate, formatMoney } from "../../lib/format";
import { EmptyState, LoadingTable, PageHeader } from "../../components/admin/ui";

interface Flow {
  ref: string;
  party: string | null;
  amountCents: number;
  currency: string;
  dueDate: string | null;
  status: string;
}
interface CashFlow {
  otb: { budgetCents: number; committedCents: number; remainingCents: number };
  payables: Flow[];
  receivables: Flow[];
  payableTotal: number;
  receivableTotal: number;
  revenue30: number;
  revenue90: number;
  currency: string;
}

export function CashFlowPage() {
  const toast = useToast();
  const { data, loading, reload } = useFetch<CashFlow>("/api/admin/cashflow");
  const [budget, setBudget] = useState("");
  const [editing, setEditing] = useState(false);

  async function saveBudget() {
    await api.put("/api/admin/cashflow/otb-budget", { budgetCents: Math.round((Number(budget) || 0) * 100) });
    setEditing(false);
    toast.success("Budget saved");
    reload();
  }

  if (loading || !data) {
    return (
      <div>
        <PageHeader eyebrow="Finance" title="Cash Flow" help="cash-flow" description="What's coming in, what's going out, and how much of your buy budget is left." />
        <LoadingTable rows={6} />
      </div>
    );
  }

  const cur = data.currency;
  const otbPct = data.otb.budgetCents > 0 ? Math.min(100, Math.round((data.otb.committedCents / data.otb.budgetCents) * 100)) : 0;
  const net = data.receivableTotal - data.payableTotal;

  return (
    <div>
      <PageHeader
        eyebrow="Finance"
        title="Cash Flow"
        help="cash-flow"
        description="What's coming in, what's going out, and how much of your buy budget is left — from POs, wholesale invoices, and sales you already have."
      />

      {/* Position tiles */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Coming in (invoiced)" value={formatMoney(data.receivableTotal, cur)} tone="palm" />
        <Tile label="Going out (open POs)" value={formatMoney(data.payableTotal, cur)} tone="terracotta" />
        <Tile label="Net position" value={formatMoney(net, cur)} tone={net >= 0 ? "palm" : "terracotta"} />
        <Tile label="Revenue · 30d" value={formatMoney(data.revenue30, cur)} sub={`${formatMoney(data.revenue90, cur)} · 90d`} />
      </div>

      {/* Open-to-buy */}
      <div className="admin-card mb-6 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-warmgrey">Open-to-buy</h2>
            <p className="mt-1 text-sm text-ink/70">Your production buy budget for the season, against what's already committed on open POs.</p>
          </div>
          <button
            type="button"
            className="link-quiet text-xs"
            onClick={() => {
              setBudget(String(data.otb.budgetCents / 100));
              setEditing(true);
            }}
          >
            {data.otb.budgetCents > 0 ? "Edit budget" : "Set budget"}
          </button>
        </div>

        {editing ? (
          <div className="mt-3 flex items-center gap-2">
            <input className="input w-40 text-sm" inputMode="decimal" placeholder="Budget" value={budget} onChange={(e) => setBudget(e.target.value)} />
            <button type="button" className="btn btn-primary !py-1.5 text-sm" onClick={() => void saveBudget()}>Save</button>
            <button type="button" className="btn btn-secondary !py-1.5 text-sm" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        ) : data.otb.budgetCents > 0 ? (
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-xs text-warmgrey">
              <span>Committed {formatMoney(data.otb.committedCents, cur)}</span>
              <span>Budget {formatMoney(data.otb.budgetCents, cur)}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-ink/10">
              <div className={`h-2.5 rounded-full ${otbPct >= 100 ? "bg-terracotta" : "bg-navy"}`} style={{ width: `${otbPct}%` }} />
            </div>
            <p className="mt-2 text-sm">
              <span className={data.otb.remainingCents >= 0 ? "font-medium text-palm" : "font-medium text-terracotta-deep"}>
                {formatMoney(data.otb.remainingCents, cur)}
              </span>{" "}
              <span className="text-warmgrey">left to spend this season</span>
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-warmgrey">Set a season budget to track how much you have left to commit to production.</p>
        )}
      </div>

      {/* Payables & receivables */}
      <div className="grid gap-5 lg:grid-cols-2">
        <FlowList title="Money going out" subtitle="Open purchase orders" rows={data.payables} cur={cur} emptyHint="No open POs." />
        <FlowList title="Money coming in" subtitle="Invoiced wholesale orders" rows={data.receivables} cur={cur} emptyHint="No invoiced wholesale orders." />
      </div>
    </div>
  );
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  const color = tone === "palm" ? "text-palm" : tone === "terracotta" ? "text-terracotta-deep" : "text-ink";
  return (
    <div className="admin-card p-4">
      <p className="text-[0.65rem] uppercase tracking-wider text-warmgrey">{label}</p>
      <p className={`mt-1 text-xl font-light ${color}`}>{value}</p>
      {sub && <p className="text-xs text-warmgrey">{sub}</p>}
    </div>
  );
}

function FlowList({ title, subtitle, rows, cur, emptyHint }: { title: string; subtitle: string; rows: Flow[]; cur: string; emptyHint: string }) {
  return (
    <div>
      <h2 className="text-sm font-semibold uppercase tracking-wider text-warmgrey">{title}</h2>
      <p className="mb-2 text-xs text-warmgrey">{subtitle}</p>
      {rows.length === 0 ? (
        <EmptyState title="Nothing here" hint={emptyHint} />
      ) : (
        <div className="admin-card overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Ref</th>
                <th>Party</th>
                <th>Due</th>
                <th className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.ref}>
                  <td className="font-mono text-xs">{r.ref}</td>
                  <td className="text-sm">{r.party ?? "—"}</td>
                  <td className="text-xs text-warmgrey">{r.dueDate ? formatDate(r.dueDate) : "—"}</td>
                  <td className="text-right font-medium">{formatMoney(r.amountCents, r.currency || cur)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
