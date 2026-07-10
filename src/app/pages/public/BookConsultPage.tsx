import { useState, type FormEvent } from "react";
import { api, ApiRequestError } from "../../lib/api";

/**
 * Book a consult — the public door into a studio's Client Book. No account
 * needed; the studio confirms and the visitor becomes a client with the
 * consult on their timeline.
 */
export function BookConsultPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [preferredAt, setPreferredAt] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/public/booking", {
        name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        preferredAt: preferredAt.trim() || null,
        note: note.trim() || null,
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Something went wrong — please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-light">Request received</h1>
        <p className="mt-3 text-sm text-warmgrey">
          Thank you, {name.split(" ")[0] || "friend"} — the studio will be in touch to confirm a time.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <h1 className="font-display text-3xl font-light">Book a consult</h1>
      <p className="mt-2 text-sm text-warmgrey">
        Tell us a little about yourself and what you have in mind — a made-to-measure piece, an alteration, or a
        styling session — and we'll come back to you with a time.
      </p>
      <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col text-sm">
          <span className="mb-1 text-xs text-warmgrey">Your name</span>
          <input className="rounded border border-black/15 px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col text-sm">
            <span className="mb-1 text-xs text-warmgrey">Email</span>
            <input className="rounded border border-black/15 px-3 py-2" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="flex flex-col text-sm">
            <span className="mb-1 text-xs text-warmgrey">Phone</span>
            <input className="rounded border border-black/15 px-3 py-2" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
        </div>
        <label className="flex flex-col text-sm">
          <span className="mb-1 text-xs text-warmgrey">When suits you? (optional)</span>
          <input
            className="rounded border border-black/15 px-3 py-2"
            value={preferredAt}
            onChange={(e) => setPreferredAt(e.target.value)}
            placeholder="e.g. weekday evenings, or the week of the 24th"
          />
        </label>
        <label className="flex flex-col text-sm">
          <span className="mb-1 text-xs text-warmgrey">What do you have in mind?</span>
          <textarea
            className="h-28 rounded border border-black/15 px-3 py-2"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. A coat for autumn — something structured, in wool."
          />
        </label>
        {error && <p className="text-sm text-red-700">{error}</p>}
        <button className="self-start rounded bg-ink px-5 py-2.5 text-sm text-white disabled:opacity-50" disabled={busy || !name.trim()}>
          Request a consult
        </button>
        <p className="text-xs text-warmgrey">Leave an email or phone number so the studio can reach you.</p>
      </form>
    </div>
  );
}
