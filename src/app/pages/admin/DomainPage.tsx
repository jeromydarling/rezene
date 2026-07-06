import { useEffect, useState } from "react";
import { useFetch } from "../../lib/useFetch";
import { api, ApiRequestError } from "../../lib/api";
import { useToast } from "../../lib/toast";
import { ErrorNote, PageHeader } from "../../components/admin/ui";

/**
 * Connect-your-domain guide. Dead simple: enter your domain, copy one CNAME
 * record, follow the steps for your registrar, and check it's pointing here.
 */

interface DomainInfo {
  slug: string | null;
  currentUrl: string;
  domain: string | null;
  target: string;
}

const REGISTRARS: { name: string; steps: string[] }[] = [
  {
    name: "GoDaddy",
    steps: [
      "Sign in, then open My Products → your domain → DNS (or ‘Manage DNS’).",
      "Under Records, click Add → Type: CNAME.",
      "Name/Host: enter www (and repeat with @ for the root if offered).",
      "Value/Points to: paste the target below. Save.",
    ],
  },
  {
    name: "Namecheap",
    steps: [
      "Sign in → Domain List → Manage next to your domain → Advanced DNS.",
      "Add New Record → Type: CNAME Record.",
      "Host: www (Namecheap uses www or @; use www).",
      "Target: paste the target below. TTL: Automatic. Save.",
    ],
  },
  {
    name: "Cloudflare",
    steps: [
      "Select your domain → DNS → Records → Add record.",
      "Type: CNAME. Name: www (or @ for the root).",
      "Target: paste the target below.",
      "Set Proxy status to DNS only (grey cloud). Save.",
    ],
  },
  {
    name: "Squarespace / Google Domains",
    steps: [
      "Open your domain → DNS / DNS settings.",
      "Under Custom records, add a record → Type: CNAME.",
      "Host: www.",
      "Data/Value: paste the target below. Save.",
    ],
  },
  {
    name: "Hostinger",
    steps: [
      "hPanel → Domains → your domain → DNS / Nameservers.",
      "Add new record → Type: CNAME.",
      "Name: www.",
      "Target/Points to: paste the target below. Save.",
    ],
  },
];

export function DomainPage() {
  const toast = useToast();
  const { data, reload } = useFetch<DomainInfo>("/api/admin/domain");
  const [domain, setDomain] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [check, setCheck] = useState<{ ok: boolean } | null>(null);
  const [openReg, setOpenReg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (data?.domain) setDomain(data.domain);
  }, [data]);

  const targetHost = data?.target ?? "verto.style";

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await api.put("/api/admin/domain", { domain });
      toast.success("Domain saved", "Now add the CNAME at your registrar, then check it below.");
      await reload();
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  async function runCheck() {
    setChecking(true);
    setCheck(null);
    setError(null);
    try {
      const res = await api.get<{ ok: boolean }>(`/api/admin/domain/check?domain=${encodeURIComponent(domain)}`);
      setCheck(res);
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : "Couldn't check DNS");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        eyebrow="Settings"
        title="Connect your domain"
        help="domain"
        description="Point your own web address (like yourlabel.com) at your Verto store. It takes about five minutes."
      />

      <div className="admin-card mb-5 p-5">
        <p className="text-xs font-medium text-warmgrey">Your store is live at</p>
        <p className="mt-1 font-mono text-sm">{data?.currentUrl ?? "…"}</p>
      </div>

      {/* Step 1 */}
      <Step n={1} title="Enter your domain">
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="input flex-1"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="yourlabel.com"
          />
          <button type="button" className="btn btn-primary" disabled={saving || !domain.trim()} onClick={() => void save()}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
        <p className="mt-1 text-xs text-warmgrey">Enter it without www or https — just the bare domain.</p>
        {error && <div className="mt-2"><ErrorNote message={error} /></div>}
      </Step>

      {/* Step 2 */}
      <Step n={2} title="Add one DNS record at your registrar">
        <p className="mb-2 text-sm text-warmgrey">In your domain provider's DNS settings, add this record:</p>
        <div className="overflow-hidden rounded-md border border-ink/15">
          <Row label="Type" value="CNAME" />
          <Row label="Name / Host" value="www" />
          <Row
            label="Value / Target"
            value={targetHost}
            action={
              <button
                type="button"
                className="btn btn-secondary !py-1 text-xs"
                onClick={() => {
                  void navigator.clipboard.writeText(targetHost);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? "Copied" : "Copy"}
              </button>
            }
          />
        </div>
        <p className="mt-2 text-xs text-warmgrey">
          Tip: if your provider lets you set a record for the root (<span className="font-mono">@</span>), point that here too
          so <span className="font-mono">yourlabel.com</span> and <span className="font-mono">www.yourlabel.com</span> both work.
        </p>

        <div className="mt-4 space-y-1.5">
          <p className="text-xs font-medium text-warmgrey">Step-by-step for your registrar:</p>
          {REGISTRARS.map((r) => (
            <div key={r.name} className="rounded-md border border-ink/10">
              <button
                type="button"
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-cream"
                onClick={() => setOpenReg(openReg === r.name ? null : r.name)}
              >
                <span className="font-medium">{r.name}</span>
                <span className="text-warmgrey">{openReg === r.name ? "–" : "+"}</span>
              </button>
              {openReg === r.name && (
                <ol className="list-decimal space-y-1 border-t border-ink/10 px-6 py-3 text-sm text-ink/80">
                  {r.steps.map((s, i) => (
                    <li key={i}>{s.replace("the target below", `“${targetHost}”`)}</li>
                  ))}
                </ol>
              )}
            </div>
          ))}
        </div>
      </Step>

      {/* Step 3 */}
      <Step n={3} title="Check it's connected" last>
        <p className="mb-2 text-sm text-warmgrey">
          DNS changes can take a few minutes (sometimes up to a day). Once you've saved the record, check it here:
        </p>
        <button type="button" className="btn btn-secondary" disabled={checking || !domain.trim()} onClick={() => void runCheck()}>
          {checking ? "Checking…" : "Check connection"}
        </button>
        {check && (
          <div className={`mt-3 rounded-md p-3 text-sm ${check.ok ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900"}`}>
            {check.ok ? (
              <>
                <p className="font-medium">Pointing at Verto ✓</p>
                <p className="mt-1 text-xs">
                  DNS looks right. We've let the team know to finish switching it on — your domain will start serving your store
                  shortly (allow a little time for it to go fully live).
                </p>
              </>
            ) : (
              <>
                <p className="font-medium">Not pointing here yet</p>
                <p className="mt-1 text-xs">
                  We can't see the CNAME to <span className="font-mono">{targetHost}</span> yet. Double-check the record and give
                  it a few minutes to propagate, then check again.
                </p>
              </>
            )}
          </div>
        )}
      </Step>
    </div>
  );
}

function Step({ n, title, children, last }: { n: number; title: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className={`relative pl-10 ${last ? "" : "pb-6"}`}>
      {!last && <span className="absolute left-[15px] top-8 bottom-0 w-px bg-ink/10" />}
      <span className="absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-full bg-navy text-sm font-medium text-chalk">
        {n}
      </span>
      <h2 className="mb-2 pt-1 font-display text-lg font-light">{title}</h2>
      <div className="admin-card p-4">{children}</div>
    </div>
  );
}

function Row({ label, value, action }: { label: string; value: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-ink/10 px-3 py-2 last:border-b-0">
      <span className="text-xs text-warmgrey">{label}</span>
      <span className="flex items-center gap-2">
        <span className="font-mono text-sm">{value}</span>
        {action}
      </span>
    </div>
  );
}
