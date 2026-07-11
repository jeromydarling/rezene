import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import { Mic, Send, Sparkles, Volume2, VolumeX, X } from "lucide-react";
import { api, ApiRequestError } from "../lib/api";
import { Markdown } from "./Markdown";

/**
 * The Verto Companion: a floating, grounded assistant on every admin page.
 * It answers from the school + KB corpus with citations, knows which module
 * you're standing in, and speaks both ways — hold-to-talk in (the browser's
 * SpeechRecognition, where available) and read-aloud out (speechSynthesis,
 * same engine as the school's Listen bar). Stateless on the server; the
 * conversation lives here, per tab.
 */

interface Turn {
  role: "user" | "assistant";
  content: string;
  sources?: { title: string; link: string }[];
}

// Route-aware conversation starters: the first question a person on this
// page would actually ask.
const SUGGESTIONS: [string, string[]][] = [
  ["/admin/patterns", ["Why does my sleeve spiral around the arm?", "What measurements do I need for a bodice block?"]],
  ["/admin/research/pricing", ["How do I pick between two price points?", "What did Nystrom say about markdowns?"]],
  ["/admin/costing", ["What belongs in a cost sheet?", "How much margin do I need for wholesale?"]],
  ["/admin/school", ["Which course should I start with?", "How do certificates work?"]],
  ["/admin/library", ["How do I use a plate in a design legally?", "Where are the 1920s Vogues?"]],
  ["/admin/ai-concepts", ["How do I brief a generation like a designer?", "What makes a good reference image?"]],
  ["/admin/tech-packs", ["What makes a tech pack quotable?", "What are graded measurement points?"]],
  ["/admin/suppliers", ["How do I get a fair quote from a factory?", "What is the contracting system?"]],
];

const FALLBACK_SUGGESTIONS = ["What should I read in the school first?", "How do I take a full measurement set?", "Walk me through pricing a new piece."];

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}

function getRecognizer(): SpeechRecognitionLike | null {
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = "en-US";
  rec.interimResults = false;
  return rec;
}

const speechText = (md: string): string =>
  md
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\[\d+\]/g, "")
    .replace(/[*#>`]/g, "")
    .replace(/\s+/g, " ")
    .trim();

export function Companion() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [speak, setSpeak] = useState(false);
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const speechSupported = typeof window !== "undefined" && "speechSynthesis" in window;
  const micSupported =
    typeof window !== "undefined" &&
    Boolean((window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, open]);

  // Never leave the voice talking after unmount or close.
  useEffect(() => {
    if (!open && speechSupported) window.speechSynthesis.cancel();
  }, [open, speechSupported]);

  const ask = useCallback(
    async (question: string) => {
      const q = question.trim();
      if (!q || busy) return;
      setInput("");
      setBusy(true);
      setTurns((t) => [...t, { role: "user", content: q }]);
      try {
        const history = turns.map((t) => ({ role: t.role, content: t.content }));
        const res = await api.post<{ answer: string; sources: { title: string; link: string }[] }>(
          "/api/admin/companion/ask",
          { question: q, route: location.pathname, history },
        );
        setTurns((t) => [...t, { role: "assistant", content: res.answer, sources: res.sources }]);
        if (speak && speechSupported) {
          window.speechSynthesis.cancel();
          const u = new SpeechSynthesisUtterance(speechText(res.answer));
          window.speechSynthesis.speak(u);
        }
      } catch (err) {
        const msg = err instanceof ApiRequestError ? err.message : "The companion lost its train of thought — ask again.";
        setTurns((t) => [...t, { role: "assistant", content: msg }]);
      } finally {
        setBusy(false);
      }
    },
    [busy, turns, location.pathname, speak, speechSupported],
  );

  const toggleMic = () => {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = getRecognizer();
    if (!rec) return;
    recRef.current = rec;
    rec.onresult = (e) => {
      const transcript = Array.from({ length: e.results.length }, (_, i) => e.results[i][0]?.transcript ?? "").join(" ").trim();
      if (transcript) void ask(transcript);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    setListening(true);
    rec.start();
  };

  const suggestions = SUGGESTIONS.find(([route]) => location.pathname.startsWith(route))?.[1] ?? FALLBACK_SUGGESTIONS;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-navy text-white shadow-lg transition-transform hover:scale-105"
        aria-label="Open the Verto Companion"
        title="The Verto Companion — ask anything about the craft or the app"
      >
        <Sparkles size={20} />
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-40 flex h-[560px] max-h-[80vh] w-[380px] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between bg-navy px-4 py-3 text-white">
        <div className="flex items-center gap-2">
          <Sparkles size={16} />
          <div>
            <p className="text-sm font-medium leading-tight">Verto Companion</p>
            <p className="text-[0.65rem] text-white/60">Schooled on the masters. Knows every corner of Verto.</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {speechSupported && (
            <button
              onClick={() => {
                if (speak) window.speechSynthesis.cancel();
                setSpeak((s) => !s);
              }}
              className={`rounded p-1.5 ${speak ? "bg-white/20" : "hover:bg-white/10"}`}
              title={speak ? "Stop speaking replies" : "Speak replies aloud"}
              aria-label="Toggle spoken replies"
            >
              {speak ? <Volume2 size={15} /> : <VolumeX size={15} />}
            </button>
          )}
          <button onClick={() => setOpen(false)} className="rounded p-1.5 hover:bg-white/10" aria-label="Close">
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Conversation */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {turns.length === 0 && (
          <div className="space-y-2 pt-2">
            <p className="px-1 text-xs text-warmgrey">
              Ask about the craft (the school's masters answer), or about anything in Verto. Try:
            </p>
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => void ask(s)}
                className="block w-full rounded-lg border border-ink/10 px-3 py-2 text-left text-xs text-ink/80 hover:border-navy/40"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {turns.map((t, i) =>
          t.role === "user" ? (
            <div key={i} className="ml-8 rounded-xl rounded-br-sm bg-navy px-3 py-2 text-sm text-white">
              {t.content}
            </div>
          ) : (
            <div key={i} className="mr-4 rounded-xl rounded-bl-sm border border-ink/10 bg-chalk px-3 py-2 text-sm [&_p]:text-sm">
              <Markdown text={t.content} headingBase={2} />
              {t.sources && t.sources.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1 border-t border-ink/10 pt-2">
                  {t.sources.map((s, si) => (
                    <Link
                      key={si}
                      to={s.link}
                      className="max-w-full truncate rounded-full border border-ink/15 px-2 py-0.5 text-[0.62rem] text-ink/60 hover:text-navy"
                      title={s.title}
                    >
                      [{si + 1}] {s.title}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ),
        )}
        {busy && <div className="mr-4 w-24 rounded-xl border border-ink/10 bg-chalk px-3 py-2 text-sm text-warmgrey">Thinking…</div>}
      </div>

      {/* Composer */}
      <div className="flex items-center gap-1.5 border-t border-ink/10 p-2">
        {micSupported && (
          <button
            onClick={toggleMic}
            className={`rounded-full p-2 ${listening ? "animate-pulse bg-terracotta text-white" : "text-ink/60 hover:text-ink"}`}
            title={listening ? "Listening — tap to stop" : "Ask by voice"}
            aria-label="Ask by voice"
          >
            <Mic size={16} />
          </button>
        )}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void ask(input)}
          placeholder={listening ? "Listening…" : "Ask the companion…"}
          className="min-w-0 flex-1 rounded-lg border border-ink/15 px-2.5 py-1.5 text-sm"
        />
        <button
          onClick={() => void ask(input)}
          disabled={busy || !input.trim()}
          className="rounded-lg bg-navy p-2 text-white disabled:opacity-40"
          aria-label="Send"
        >
          <Send size={15} />
        </button>
      </div>
    </div>
  );
}
