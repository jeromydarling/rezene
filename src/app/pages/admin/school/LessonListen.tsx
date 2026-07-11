import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Headphones, Pause, Play, Square } from "lucide-react";
import { markdownBlocks } from "../../../components/Markdown";

/**
 * The lesson audio reader, built on the browser's own speech synthesis —
 * free, offline of any external service, and available on every shop with
 * no key to configure. The hook walks the exact same block list the
 * Markdown renderer draws, so the highlighted paragraph is always the one
 * being read. If a pre-rendered narration URL ever ships alongside a
 * lesson (a paid TTS pass), play that file instead of synthesizing —
 * this UI doesn't need to change.
 */

/** What the voice should say for a markdown block — or null for blocks
 *  that don't read aloud (figures; tables get a short pointer). */
export function speechTextForBlock(block: string): string | null {
  if (!block) return null;
  if (block.startsWith("![")) return null; // figures: the caption is visual credit, not prose
  const lines = block.split("\n");
  if (lines.length >= 2 && lines[0].includes("|") && /^\s*\|?[\s|:-]+\|?\s*$/.test(lines[1])) {
    return "There is a reference table at this point. Have a look at it in the lesson.";
  }
  const text = block
    .replace(/^#{1,4}\s+/gm, "")
    .replace(/^\s*-\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  return text || null;
}

// Rank the browser's English voices: neural/natural voices first, then the
// platform's known-good defaults, so the out-of-the-box sound is the best
// this browser can do.
function voiceScore(v: SpeechSynthesisVoice): number {
  let score = 0;
  if (/natural|neural/i.test(v.name)) score += 4;
  if (/premium|enhanced/i.test(v.name)) score += 3;
  if (/google (us|uk) english/i.test(v.name)) score += 3;
  if (/samantha|daniel|karen|moira|serena/i.test(v.name)) score += 2;
  if (v.lang.toLowerCase() === "en-us" || v.lang.toLowerCase() === "en-gb") score += 1;
  if (v.default) score += 1;
  return score;
}

const RATES = [0.8, 1, 1.15, 1.3, 1.5];

export interface LessonAudio {
  supported: boolean;
  status: "idle" | "playing" | "paused";
  activeBlock: number | null;
  toggle: () => void;
  stop: () => void;
  jumpTo: (blockIdx: number) => void;
  rate: number;
  setRate: (r: number) => void;
  voices: SpeechSynthesisVoice[];
  voiceURI: string | null;
  setVoiceURI: (uri: string) => void;
}

export function useLessonAudio(bodyMd: string, onPlayingChange: (playing: boolean) => void): LessonAudio {
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  const speeches = useMemo(() => markdownBlocks(bodyMd).map(speechTextForBlock), [bodyMd]);
  const [status, setStatus] = useState<"idle" | "playing" | "paused">("idle");
  const [activeBlock, setActiveBlock] = useState<number | null>(null);
  const [rate, setRateState] = useState(1);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURIState] = useState<string | null>(null);

  // Refs so the utterance chain never closes over stale state.
  const genRef = useRef(0);
  const rateRef = useRef(rate);
  const voiceRef = useRef<string | null>(null);
  const activeRef = useRef<number | null>(null);
  const playingRef = useRef(onPlayingChange);
  playingRef.current = onPlayingChange;

  useEffect(() => {
    if (!supported) return;
    const load = () => {
      const en = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith("en"));
      en.sort((a, b) => voiceScore(b) - voiceScore(a));
      setVoices(en);
      setVoiceURIState((cur) => cur ?? en[0]?.voiceURI ?? null);
    };
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, [supported]);
  useEffect(() => {
    voiceRef.current = voiceURI;
  }, [voiceURI]);

  const stop = useCallback(() => {
    genRef.current++;
    if (supported) window.speechSynthesis.cancel();
    setStatus("idle");
    setActiveBlock(null);
    activeRef.current = null;
    playingRef.current(false);
  }, [supported]);

  const speakFrom = useCallback(
    (startIdx: number) => {
      if (!supported) return;
      const gen = ++genRef.current;
      window.speechSynthesis.cancel();
      const step = (idx: number) => {
        while (idx < speeches.length && !speeches[idx]) idx++;
        if (gen !== genRef.current) return;
        if (idx >= speeches.length) {
          setStatus("idle");
          setActiveBlock(null);
          activeRef.current = null;
          playingRef.current(false);
          return;
        }
        const u = new SpeechSynthesisUtterance(speeches[idx]!);
        u.rate = rateRef.current;
        const voice = window.speechSynthesis.getVoices().find((v) => v.voiceURI === voiceRef.current);
        if (voice) u.voice = voice;
        u.onend = () => {
          if (gen === genRef.current) step(idx + 1);
        };
        u.onerror = () => {
          if (gen === genRef.current) stop();
        };
        setActiveBlock(idx);
        activeRef.current = idx;
        window.speechSynthesis.speak(u);
      };
      setStatus("playing");
      playingRef.current(true);
      step(Math.max(0, startIdx));
    },
    [supported, speeches, stop],
  );

  const toggle = useCallback(() => {
    if (!supported) return;
    if (status === "playing") {
      window.speechSynthesis.pause();
      setStatus("paused");
      playingRef.current(false);
    } else if (status === "paused") {
      window.speechSynthesis.resume();
      setStatus("playing");
      playingRef.current(true);
    } else {
      speakFrom(0);
    }
  }, [supported, status, speakFrom]);

  const jumpTo = useCallback(
    (blockIdx: number) => {
      if (status === "idle") return; // clicks only steer an active session
      speakFrom(blockIdx);
    },
    [status, speakFrom],
  );

  const setRate = useCallback(
    (r: number) => {
      rateRef.current = r;
      setRateState(r);
      // Rate applies per-utterance — restart the current paragraph to hear it now.
      if (activeRef.current !== null && genRef.current && window.speechSynthesis.speaking) {
        speakFrom(activeRef.current);
      }
    },
    [speakFrom],
  );

  const setVoiceURI = useCallback(
    (uri: string) => {
      setVoiceURIState(uri);
      voiceRef.current = uri;
      if (activeRef.current !== null && window.speechSynthesis.speaking) speakFrom(activeRef.current);
    },
    [speakFrom],
  );

  // Chrome quietly suspends long synthesis sessions; a periodic resume()
  // while we believe we're playing keeps it honest (no-op elsewhere).
  useEffect(() => {
    if (!supported || status !== "playing") return;
    const tick = setInterval(() => window.speechSynthesis.resume(), 8000);
    return () => clearInterval(tick);
  }, [supported, status]);

  // Never leave a voice talking after the reader unmounts.
  useEffect(() => {
    if (!supported) return;
    return () => {
      genRef.current++;
      window.speechSynthesis.cancel();
    };
  }, [supported]);

  return { supported, status, activeBlock, toggle, stop, jumpTo, rate, setRate, voices, voiceURI, setVoiceURI };
}

/** Short display name: "Google US English" → "Google US", "Microsoft Aria
 *  Online (Natural) - English (United States)" → "Aria (Natural)". */
function voiceLabel(v: SpeechSynthesisVoice): string {
  let name = v.name
    .replace(/^Microsoft\s+/i, "")
    .replace(/\s*Online\s*/i, " ")
    .replace(/\s*-\s*English\s*\(.*\)$/i, "")
    .trim();
  if (name.length > 28) name = `${name.slice(0, 27)}…`;
  return name;
}

export function ListenBar({ audio, minutes }: { audio: LessonAudio; minutes: number }) {
  if (!audio.supported) return null;
  const active = audio.status !== "idle";
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-ink/10 bg-white px-3 py-2">
      <Headphones size={16} className="text-navy" />
      <button
        onClick={audio.toggle}
        className="inline-flex items-center gap-1.5 rounded bg-navy px-3 py-1.5 text-xs font-medium text-white"
      >
        {audio.status === "playing" ? <Pause size={13} /> : <Play size={13} />}
        {audio.status === "playing" ? "Pause" : audio.status === "paused" ? "Resume" : "Listen to this lesson"}
      </button>
      {active && (
        <button
          onClick={audio.stop}
          className="inline-flex items-center gap-1.5 rounded border border-ink/15 px-2.5 py-1.5 text-xs text-ink/70 hover:text-ink"
          aria-label="Stop"
        >
          <Square size={12} />
          Stop
        </button>
      )}
      <select
        aria-label="Reading speed"
        className="rounded border border-ink/15 bg-white px-1.5 py-1 text-xs text-ink/80"
        value={audio.rate}
        onChange={(e) => audio.setRate(parseFloat(e.target.value))}
      >
        {RATES.map((r) => (
          <option key={r} value={r}>
            {r}×
          </option>
        ))}
      </select>
      {audio.voices.length > 1 && (
        <select
          aria-label="Voice"
          className="max-w-[11rem] rounded border border-ink/15 bg-white px-1.5 py-1 text-xs text-ink/80"
          value={audio.voiceURI ?? ""}
          onChange={(e) => audio.setVoiceURI(e.target.value)}
        >
          {audio.voices.map((v) => (
            <option key={v.voiceURI} value={v.voiceURI}>
              {voiceLabel(v)}
            </option>
          ))}
        </select>
      )}
      <span className="ml-auto text-[0.68rem] text-warmgrey">
        {active ? "Tap any paragraph to jump — listening counts as reading time." : `≈ ${minutes} min read aloud`}
      </span>
    </div>
  );
}
