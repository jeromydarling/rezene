import { useState } from "react";
import { Copy, Languages } from "lucide-react";
import { api, ApiRequestError } from "../lib/api";
import { useToast } from "../lib/toast";

/**
 * The Interpreter: paste any message — a client's tangled worry, a maker's
 * reply in another language, a mill's jargon — and get back what it says,
 * what they actually need, the terms explained, and a reply drafted twice:
 * in English to review, in the sender's language to send.
 */

interface Decoded {
  language: string;
  translation: string;
  reading: string;
  terms: { term: string; meaning: string }[];
  reply: string;
  replyTranslated: string;
}

const KINDS: [string, string][] = [
  ["client", "A client"],
  ["maker", "A maker / factory"],
  ["fabric", "A fabric supplier"],
];

export function MessageDecoder({ defaultKind = "client" }: { defaultKind?: "client" | "maker" | "fabric" }) {
  const toast = useToast();
  const [openPanel, setOpenPanel] = useState(false);
  const [kind, setKind] = useState<string>(defaultKind);
  const [text, setText] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Decoded | null>(null);

  const decode = async () => {
    if (text.trim().length < 10) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await api.post<Decoded>("/api/admin/assist/decode", { text, kind, notes });
      setResult(res);
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : "The interpreter lost the thread — try again.");
    } finally {
      setBusy(false);
    }
  };

  const copy = async (v: string) => {
    await navigator.clipboard.writeText(v).catch(() => {});
    toast.success("Copied.");
  };

  if (!openPanel) {
    return (
      <button
        onClick={() => setOpenPanel(true)}
        className="inline-flex items-center gap-1.5 rounded border border-ink/15 px-3 py-1.5 text-xs text-ink/70 hover:text-ink"
        title="Paste a confusing or foreign-language message — get the meaning and a drafted reply"
      >
        <Languages size={13} /> Interpreter
      </button>
    );
  }

  return (
    <div className="admin-card mt-3 w-full p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
          <Languages size={14} className="text-navy" /> The Interpreter
        </p>
        <button onClick={() => setOpenPanel(false)} className="text-xs text-warmgrey hover:text-ink">
          close
        </button>
      </div>
      <p className="mb-2 text-xs text-warmgrey">
        Paste any message — another language, tangled wording, trade jargon. You'll get what it means, what they
        actually need, and a reply drafted in both languages.
      </p>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {KINDS.map(([k, label]) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={`rounded-full px-2.5 py-1 text-xs ${kind === k ? "bg-navy text-white" : "border border-ink/15 text-ink/70"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder="Paste their message here…"
        className="mb-2 w-full rounded border border-ink/15 px-2.5 py-2 text-sm"
      />
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional context — e.g. 'their sample was late' or 'this is about the silk order'"
          className="min-w-0 flex-1 rounded border border-ink/15 px-2.5 py-1.5 text-xs"
        />
        <button onClick={decode} disabled={busy || text.trim().length < 10} className="rounded bg-navy px-4 py-1.5 text-sm text-white disabled:opacity-50">
          {busy ? "Reading…" : "Decode"}
        </button>
      </div>

      {result && (
        <div className="space-y-3 border-t border-ink/10 pt-3 text-sm">
          {result.translation && result.language.toLowerCase() !== "english" && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-warmgrey">What it says ({result.language})</p>
              <p className="mt-0.5 whitespace-pre-wrap text-ink/80">{result.translation}</p>
            </div>
          )}
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-warmgrey">What they actually need</p>
            <p className="mt-0.5 text-ink/80">{result.reading}</p>
          </div>
          {result.terms.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-warmgrey">Terms, translated</p>
              <ul className="mt-0.5 space-y-0.5">
                {result.terms.map((t, i) => (
                  <li key={i} className="text-ink/80">
                    <span className="font-medium">{t.term}</span> — {t.meaning}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="rounded-lg bg-chalk p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-warmgrey">Suggested reply</p>
              <button onClick={() => void copy(result.reply)} className="inline-flex items-center gap-1 text-xs text-navy">
                <Copy size={11} /> copy
              </button>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-ink/90">{result.reply}</p>
          </div>
          {result.replyTranslated && (
            <div className="rounded-lg bg-chalk p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-warmgrey">The same reply, in {result.language}</p>
                <button onClick={() => void copy(result.replyTranslated)} className="inline-flex items-center gap-1 text-xs text-navy">
                  <Copy size={11} /> copy
                </button>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-ink/90">{result.replyTranslated}</p>
            </div>
          )}
          <p className="text-[0.68rem] text-warmgrey">Review before sending — the interpreter drafts; you decide.</p>
        </div>
      )}
    </div>
  );
}
