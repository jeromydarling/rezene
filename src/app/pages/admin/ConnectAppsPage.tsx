import { useState, type ReactNode } from "react";
import { PageHeader } from "../../components/admin/ui";
import { useFetch } from "../../lib/useFetch";
import { api } from "../../lib/api";

/**
 * Connect apps — the honest, hand-held guide to wiring Verto to Gmail and
 * Google Calendar through Zapier. Zapier makes it sound like one click; it
 * isn't, so this page gives the exact steps, the shop's own inbound URL
 * pre-filled, and copy buttons for every value you'd otherwise fat-finger.
 */

function Copy({ value, label }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(value);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
      className="rounded-md border border-ink/15 px-2 py-1 text-[11px] font-medium text-ink/70 hover:border-navy/40"
    >
      {done ? "Copied" : label ?? "Copy"}
    </button>
  );
}

function Field({ value, mono = true }: { value: string; mono?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <input
        readOnly
        value={value}
        onFocus={(e) => e.target.select()}
        className={`admin-input flex-1 text-[11px] ${mono ? "font-mono" : ""}`}
      />
      <Copy value={value} />
    </div>
  );
}

/** A key→value mapping table with a "copy all as JSON" helper. */
function Mapping({ rows }: { rows: [string, string][] }) {
  const json = JSON.stringify(Object.fromEntries(rows), null, 2);
  return (
    <div className="rounded-lg border border-ink/10 bg-ink/[0.02] p-3">
      <table className="w-full text-[12px]">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k} className="align-top">
              <td className="py-0.5 pr-3 font-mono font-medium text-ink/80">{k}</td>
              <td className="py-0.5 font-mono text-warmgrey">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 flex justify-end">
        <Copy value={json} label="Copy as JSON" />
      </div>
    </div>
  );
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-navy text-[11px] font-semibold text-white">
        {n}
      </span>
      <div className="text-sm text-ink/85">{children}</div>
    </li>
  );
}

function Recipe({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-ink/10 bg-white p-5">
      <h3 className="font-display text-base">{title}</h3>
      <p className="mb-3 mt-0.5 text-xs text-warmgrey">{subtitle}</p>
      <ol className="space-y-2.5">{children}</ol>
    </section>
  );
}

export function ConnectAppsPage() {
  const hook = useFetch<{ enabled: boolean; token: string | null; url: string | null }>("/api/admin/inbound-hook");
  const [busy, setBusy] = useState(false);
  const inboundUrl = hook.data?.url ?? null;

  const generate = async () => {
    setBusy(true);
    try {
      await api.post("/api/admin/inbound-hook/rotate");
      hook.reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Connect apps"
        eyebrow="System"
        description="Wire Verto to Gmail, Google Calendar, Slack, Sheets and thousands more through Zapier. Two directions — Verto can send events out, and other apps can send data in — and no Google Cloud project or API keys to manage."
        help="zapier"
      />

      <div className="mb-5 rounded-xl border border-navy/20 bg-navy/[0.03] p-4">
        <p className="text-sm font-medium text-ink">Your inbound URL</p>
        <p className="mb-2 mt-0.5 text-xs text-warmgrey">
          Anything that sends data <span className="font-medium">into</span> Verto posts to this address. It carries a
          secret token — keep it private; regenerate it in <a href="/admin/settings" className="underline">Settings</a> if it
          ever leaks.
        </p>
        {inboundUrl ? (
          <Field value={inboundUrl} />
        ) : (
          <button className="admin-btn-primary text-sm" onClick={() => void generate()} disabled={busy}>
            {busy ? "Generating…" : "Generate my inbound URL"}
          </button>
        )}
      </div>

      <p className="mb-3 text-xs text-warmgrey">
        A quick honesty note: Zapier's marketing makes this sound like one click. It isn't — but it's not hard either.
        Follow a recipe below step by step and you'll have it running in a few minutes. Each “Catch Hook” URL comes from
        Zapier; each “inbound URL” is yours, above.
      </p>

      <div className="space-y-4">
        <Recipe
          title="Gmail → Verto"
          subtitle="A new email becomes a note in Verto — the “subsume my inbox” flow, no Google login for Verto."
        >
          <Step n={1}>
            In Zapier, make a new Zap. Trigger: <strong>Gmail → New Email Matching Search</strong> (e.g. search{" "}
            <code className="rounded bg-ink/5 px-1">label:clients</code> or <code className="rounded bg-ink/5 px-1">to:studio@…</code>).
          </Step>
          <Step n={2}>
            Action: <strong>Webhooks by Zapier → POST</strong>. Paste your inbound URL, set <strong>Payload Type</strong> to{" "}
            <strong>JSON</strong>, and enter this Data (map the values to the Gmail fields Zapier offers):
            <div className="mt-2">
              <Mapping
                rows={[
                  ["type", "note"],
                  ["subject", "{{Subject}}"],
                  ["body", "{{Body Plain}}"],
                  ["clientEmail", "{{From Email}}"],
                ]}
              />
            </div>
          </Step>
          <Step n={3}>
            Test it. The note appears in Verto's activity feed — and if <code className="rounded bg-ink/5 px-1">clientEmail</code>{" "}
            matches a client, on their timeline too.
          </Step>
        </Recipe>

        <Recipe
          title="Verto → Gmail"
          subtitle="When something happens in Verto, send an email from your own Gmail — a personal thank-you, an internal heads-up."
        >
          <Step n={1}>
            In Zapier, new Zap. Trigger: <strong>Webhooks by Zapier → Catch Hook</strong>. Copy the custom webhook URL Zapier
            gives you.
          </Step>
          <Step n={2}>
            In Verto, go to <a href="/admin/workflows" className="underline">Workflows</a> → <strong>New workflow</strong>. Pick
            your <em>When</em> (e.g. “A payment is marked paid”), add any conditions, then add the action{" "}
            <strong>Send to a webhook</strong> and paste Zapier's Catch Hook URL. Save.
          </Step>
          <Step n={3}>
            Back in Zapier, add the action <strong>Gmail → Send Email</strong>. Verto posts this shape, so map from it:
            <pre className="mt-2 overflow-x-auto rounded-lg bg-ink/[0.03] p-3 text-[11px] leading-relaxed">{`{
  "event": "deposit.paid",
  "title": "Deposit received for …",
  "payload": { "clientName": "…", "amountCents": 50000, "label": "Deposit" },
  "at": "2026-07-12T…Z"
}`}</pre>
            e.g. <strong>Subject</strong> = <code className="rounded bg-ink/5 px-1">{`{{title}}`}</code>,{" "}
            <strong>Body</strong> from the <code className="rounded bg-ink/5 px-1">payload</code> fields.
          </Step>
        </Recipe>

        <Recipe
          title="Verto → Google Calendar"
          subtitle="Drop dated moments — a fitting, a delivery date — straight onto a Google Calendar."
        >
          <Step n={1}>
            In Zapier: <strong>Webhooks by Zapier → Catch Hook</strong>, copy the URL.
          </Step>
          <Step n={2}>
            In Verto, a new <a href="/admin/workflows" className="underline">Workflow</a>: <em>When</em> “A commission changes
            stage”, add the condition <strong>New stage (key)</strong> <em>is</em>{" "}
            <code className="rounded bg-ink/5 px-1">fitting</code>, then action <strong>Send to a webhook</strong> → paste the URL.
          </Step>
          <Step n={3}>
            In Zapier, action <strong>Google Calendar → Create Detailed Event</strong>. Summary ={" "}
            <code className="rounded bg-ink/5 px-1">{`{{title}}`}</code>; for the date use{" "}
            <code className="rounded bg-ink/5 px-1">{`{{payload__dueAt}}`}</code> when present (a commission carries its due date),
            otherwise Zapier's own date field.
          </Step>
        </Recipe>

        <Recipe
          title="Google Calendar → Verto"
          subtitle="A new calendar event becomes a consult booking in your Client Book."
        >
          <Step n={1}>
            In Zapier, new Zap. Trigger: <strong>Google Calendar → New Event</strong> (or “Event Start”).
          </Step>
          <Step n={2}>
            Action: <strong>Webhooks by Zapier → POST</strong> to your inbound URL, Payload Type <strong>JSON</strong>:
            <div className="mt-2">
              <Mapping
                rows={[
                  ["type", "booking"],
                  ["name", "{{Event Summary}}"],
                  ["preferredAt", "{{Event Start}}"],
                  ["note", "{{Event Description}}"],
                ]}
              />
            </div>
          </Step>
          <Step n={3}>
            The request lands under <a href="/admin/clients" className="underline">Client Book → Consult requests</a> to
            confirm.
          </Step>
        </Recipe>
      </div>

      <p className="mt-5 text-xs text-warmgrey">
        The same pattern reaches everything Zapier connects — Slack, Sheets, Notion, Airtable, QuickBooks. Out via a
        Workflow's webhook action; in via your inbound URL. Full reference in{" "}
        <a href="/admin/support/kb/zapier" className="underline">Connecting Zapier</a>.
      </p>
    </div>
  );
}
