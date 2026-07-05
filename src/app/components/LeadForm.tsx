import { useState, type FormEvent } from "react";
import { api } from "../lib/api";
import { track } from "../lib/analytics";
import type { LeadKind } from "../../shared/types";

export function NewsletterForm({ kind = "newsletter", dark = false }: { kind?: LeadKind; dark?: boolean }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!email) return;
    setState("busy");
    try {
      await api.post("/api/public/leads", { kind, email, sourcePath: location.pathname });
      track("email_signup", { properties: { kind } });
      setState("done");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <p className={`text-sm ${dark ? "text-chalk/90" : "text-olive-deep"}`}>
        You're on the list. À bientôt.
      </p>
    );
  }
  return (
    <form onSubmit={submit} className="flex gap-2">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email address"
        className={
          dark
            ? "w-full border border-chalk/30 bg-transparent px-3 py-2 text-sm text-chalk placeholder:text-chalk/40 focus:border-chalk focus:outline-none"
            : "input"
        }
      />
      <button
        type="submit"
        disabled={state === "busy"}
        className={dark ? "btn border-chalk/60 text-chalk hover:bg-chalk hover:text-navy" : "btn btn-primary"}
      >
        {state === "busy" ? "…" : "Join"}
      </button>
      {state === "error" && (
        <p className="self-center text-xs text-red-400">Try again shortly.</p>
      )}
    </form>
  );
}
