import { useState, type FormEvent } from "react";
import { api } from "../../lib/api";
import type { LeadKind } from "../../../shared/types";

function InquiryForm({ kind, cta }: { kind: LeadKind; cta: string }) {
  const [form, setForm] = useState({ name: "", email: "", company: "", message: "" });
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setState("busy");
    try {
      await api.post("/api/public/leads", {
        kind,
        email: form.email,
        name: form.name || undefined,
        company: form.company || undefined,
        message: form.message || undefined,
        sourcePath: location.pathname,
      });
      setState("done");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <p className="prose-editorial bg-cream p-6">
        Thank you — we read everything, and we reply like people, not tickets.
      </p>
    );
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor={`${kind}-name`}>
            Name
          </label>
          <input
            id={`${kind}-name`}
            className="input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div>
          <label className="label" htmlFor={`${kind}-email`}>
            Email *
          </label>
          <input
            id={`${kind}-email`}
            type="email"
            required
            className="input"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
      </div>
      {kind === "wholesale_inquiry" && (
        <div>
          <label className="label" htmlFor={`${kind}-company`}>
            Boutique / company
          </label>
          <input
            id={`${kind}-company`}
            className="input"
            value={form.company}
            onChange={(e) => setForm({ ...form, company: e.target.value })}
          />
        </div>
      )}
      <div>
        <label className="label" htmlFor={`${kind}-message`}>
          Message
        </label>
        <textarea
          id={`${kind}-message`}
          rows={4}
          className="input"
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
        />
      </div>
      <button type="submit" disabled={state === "busy"} className="btn btn-primary">
        {state === "busy" ? "Sending…" : cta}
      </button>
      {state === "error" && <p className="field-error">Something went wrong — try again shortly.</p>}
    </form>
  );
}

export function ContactPage() {
  const [tab, setTab] = useState<"contact" | "wholesale">("contact");
  return (
    <div className="mx-auto max-w-2xl px-5 py-16">
      <p className="eyebrow mb-3">Contact</p>
      <h1 className="display-hero mb-6 text-4xl">Write to us</h1>
      <p className="prose-editorial mb-10">
        Questions about fit, orders, or the atelier — or wholesale interest for
        your boutique. Choose your lane below.
      </p>
      <div className="mb-8 flex gap-2">
        <button
          type="button"
          onClick={() => setTab("contact")}
          className={`px-4 py-2 text-[0.72rem] font-medium uppercase tracking-editorial ${
            tab === "contact" ? "bg-navy text-chalk" : "border border-ink/20 text-ink/70"
          }`}
        >
          General
        </button>
        <button
          type="button"
          onClick={() => setTab("wholesale")}
          className={`px-4 py-2 text-[0.72rem] font-medium uppercase tracking-editorial ${
            tab === "wholesale" ? "bg-navy text-chalk" : "border border-ink/20 text-ink/70"
          }`}
        >
          Wholesale
        </button>
      </div>
      {tab === "contact" ? (
        <InquiryForm kind="contact" cta="Send message" />
      ) : (
        <InquiryForm kind="wholesale_inquiry" cta="Send wholesale inquiry" />
      )}
    </div>
  );
}
