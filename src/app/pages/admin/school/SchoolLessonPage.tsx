import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Markdown } from "../../../components/Markdown";
import { api, ApiRequestError } from "../../../lib/api";
import { useToast } from "../../../lib/toast";
import { ListenBar, useLessonAudio } from "./LessonListen";

/**
 * The lesson reader. Reading time is credited by 30-second heartbeats that
 * the worker caps against the wall clock, checkpoints grade server-side
 * (the right answer never reaches this code), and "mark complete" is just
 * a request — the server decides whether it was earned.
 */

interface LessonData {
  idx: number;
  title: string;
  minutes: number;
  bodyMd: string;
  source: { label: string; url: string } | null;
  checkpoints: { idx: number; q: string; options: string[] }[];
  checkpointsPassed: number[];
  seconds: number;
  floorSeconds: number;
  completed: boolean;
  lessonCount: number;
}

function CheckpointCard({
  slug,
  lessonIdx,
  cp,
  passed,
  onPassed,
}: {
  slug: string;
  lessonIdx: number;
  cp: { idx: number; q: string; options: string[] };
  passed: boolean;
  onPassed: () => void;
}) {
  const [choice, setChoice] = useState<number | null>(null);
  const [state, setState] = useState<"idle" | "wrong" | "busy">("idle");
  if (passed) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3 text-sm text-emerald-900">
        ✓ Checkpoint: {cp.q}
      </div>
    );
  }
  const submit = async () => {
    if (choice === null) return;
    setState("busy");
    const res = await api.post<{ correct: boolean }>(
      `/api/admin/school/course/${slug}/lesson/${lessonIdx}/checkpoint`,
      { checkpoint: cp.idx, answer: choice },
    );
    if (res.correct) onPassed();
    else setState("wrong");
  };
  return (
    <div className="rounded-lg border border-navy/20 bg-navy/[0.03] p-3">
      <p className="text-sm font-medium text-ink">Checkpoint — {cp.q}</p>
      <div className="mt-2 space-y-1.5">
        {cp.options.map((opt, oi) => (
          <label key={oi} className="flex cursor-pointer items-start gap-2 text-sm text-ink/80">
            <input
              type="radio"
              checked={choice === oi}
              onChange={() => {
                setChoice(oi);
                setState("idle");
              }}
              className="mt-0.5"
            />
            {opt}
          </label>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={submit}
          disabled={choice === null || state === "busy"}
          className="rounded bg-navy px-3 py-1 text-xs text-white disabled:opacity-50"
        >
          Check
        </button>
        {state === "wrong" && <span className="text-xs text-terracotta">Not quite — the answer is in the lesson above.</span>}
      </div>
    </div>
  );
}

export function SchoolLessonPage() {
  const { slug = "", idx = "0" } = useParams();
  const lessonIdx = parseInt(idx, 10);
  const navigate = useNavigate();
  const toast = useToast();
  const [data, setData] = useState<LessonData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [passed, setPassed] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const beatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Listening is reading: while the voice is speaking, heartbeats keep
  // flowing even if the tab is backgrounded (phone locked, other window).
  const audioPlayingRef = useRef(false);
  const audio = useLessonAudio(data?.bodyMd ?? "", (playing) => {
    audioPlayingRef.current = playing;
  });

  const load = useCallback(async () => {
    try {
      const d = await api.get<LessonData>(`/api/admin/school/course/${slug}/lesson/${lessonIdx}`);
      setData(d);
      setSeconds(d.seconds);
      setPassed(d.checkpointsPassed);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn't open the lesson.");
    }
  }, [slug, lessonIdx]);

  useEffect(() => {
    void load();
  }, [load]);

  // Heartbeats: only while the tab is visible; the worker caps each credit
  // against the wall clock, so this is bookkeeping, not the enforcement.
  useEffect(() => {
    if (!data || data.completed) return;
    beatRef.current = setInterval(async () => {
      if (document.hidden && !audioPlayingRef.current) return;
      try {
        const res = await api.post<{ seconds: number }>(
          `/api/admin/school/course/${slug}/lesson/${lessonIdx}/heartbeat`,
          {},
        );
        setSeconds(res.seconds);
      } catch {
        /* transient */
      }
    }, 30000);
    return () => {
      if (beatRef.current) clearInterval(beatRef.current);
    };
  }, [data, slug, lessonIdx]);

  const complete = async () => {
    setBusy(true);
    try {
      await api.post(`/api/admin/school/course/${slug}/lesson/${lessonIdx}/complete`, {});
      toast.success("Lesson complete.");
      if (data && lessonIdx + 1 < data.lessonCount) navigate(`/admin/school/${slug}/lesson/${lessonIdx + 1}`);
      else navigate(`/admin/school/${slug}`);
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : "Not yet.");
    } finally {
      setBusy(false);
    }
  };

  if (error) {
    return (
      <div className="mx-auto max-w-2xl py-12 text-center">
        <p className="text-sm text-warmgrey">{error}</p>
        <Link to={`/admin/school/${slug}`} className="mt-3 inline-block text-sm text-navy underline">
          Back to the course
        </Link>
      </div>
    );
  }
  if (!data) return <div className="skeleton h-64 rounded-xl" />;

  const progress = Math.min(100, Math.round((seconds / data.floorSeconds) * 100));
  const timeMet = seconds >= data.floorSeconds;
  const checkpointsMet = passed.length >= data.checkpoints.length;
  const canComplete = (timeMet && checkpointsMet) || data.completed;

  return (
    <div className="mx-auto max-w-3xl">
      {/* Reading progress rail */}
      <div className="sticky top-0 z-10 -mx-1 mb-4 rounded-b-lg bg-chalk/95 px-1 pb-2 pt-1 backdrop-blur">
        <div className="flex items-center justify-between text-xs text-warmgrey">
          <Link to={`/admin/school/${slug}`} className="text-navy underline">
            ← Course
          </Link>
          <span>
            Lesson {data.idx + 1} of {data.lessonCount}
            {!data.completed && ` · ${timeMet ? "time met" : `${progress}% read`} · ${passed.length}/${data.checkpoints.length} checkpoints`}
            {data.completed && " · complete"}
          </span>
        </div>
        {!data.completed && (
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-ink/5">
            <div className={`h-full rounded-full transition-all ${timeMet ? "bg-emerald-500" : "bg-navy"}`} style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>

      <p className="eyebrow">Verto School</p>
      <h1 className="mt-1 font-display text-3xl font-light text-ink">{data.title}</h1>
      {data.source && (
        <p className="mt-1 text-xs text-warmgrey">
          Adapted from{" "}
          <a href={data.source.url} target="_blank" rel="noreferrer" className="text-navy underline">
            {data.source.label}
          </a>{" "}
          — read the original any time.
        </p>
      )}

      <ListenBar audio={audio} minutes={data.minutes} />

      <div className="mt-6">
        <Markdown
          text={data.bodyMd}
          headingBase={2}
          activeBlock={audio.activeBlock}
          onBlockSelect={audio.status !== "idle" ? audio.jumpTo : undefined}
        />
      </div>

      <div className="mt-8 space-y-3">
        {data.checkpoints.map((cp) => (
          <CheckpointCard
            key={cp.idx}
            slug={slug}
            lessonIdx={lessonIdx}
            cp={cp}
            passed={passed.includes(cp.idx)}
            onPassed={() => setPassed((p) => [...p, cp.idx])}
          />
        ))}
      </div>

      <div className="mt-8 flex items-center justify-between border-t border-ink/10 pt-4">
        <p className="text-xs text-warmgrey">
          {data.completed
            ? "Already complete — reread freely."
            : canComplete
              ? "Time and checkpoints met."
              : timeMet
                ? "Answer the checkpoints to continue."
                : "The school credits real reading time — no skipping."}
        </p>
        {!data.completed && (
          <button onClick={complete} disabled={!canComplete || busy} className="rounded bg-navy px-4 py-2 text-sm text-white disabled:opacity-50">
            {lessonIdx + 1 < data.lessonCount ? "Complete → next lesson" : "Complete lesson"}
          </button>
        )}
        {data.completed && lessonIdx + 1 < data.lessonCount && (
          <Link to={`/admin/school/${slug}/lesson/${lessonIdx + 1}`} className="rounded bg-navy px-4 py-2 text-sm text-white">
            Next lesson →
          </Link>
        )}
      </div>
    </div>
  );
}
