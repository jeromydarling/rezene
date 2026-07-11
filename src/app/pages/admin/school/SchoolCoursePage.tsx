import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { PageHeader } from "../../../components/admin/ui";
import { api, ApiRequestError } from "../../../lib/api";
import { useFetch } from "../../../lib/useFetch";
import { useToast } from "../../../lib/toast";

/**
 * One course: the syllabus with its locks, the examination, the practical,
 * and — when everything is green — the certificate. All the gating shown
 * here is cosmetic; the worker enforces every rule again server-side.
 */

interface CourseDetail {
  course: {
    slug: string;
    title: string;
    summary: string;
    level: string;
    sources: { label: string; url: string }[];
    quizDraw: number;
    passPercent: number;
    quizSize: number;
    practical: { kind: string; title: string; instructions: string };
  };
  enrolled: boolean;
  completed: boolean;
  lessons: {
    idx: number;
    title: string;
    minutes: number;
    unlocked: boolean;
    completed: boolean;
    checkpointsPassed: number;
    checkpointCount: number;
  }[];
  quiz: {
    available: boolean;
    passed: boolean;
    attempts: number;
    bestScore: number;
    lockedUntil: string | null;
  };
  practical: { kind: string; title: string; instructions: string; passed: boolean };
}

interface QuizPaper {
  attemptId: string;
  minutes: number;
  passPercent: number;
  questions: { id: string; q: string; options: string[] }[];
}

function QuizRunner({
  slug,
  paper,
  onDone,
}: {
  slug: string;
  paper: QuizPaper;
  onDone: () => void;
}) {
  const toast = useToast();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [secondsLeft, setSecondsLeft] = useState(paper.minutes * 60);
  const [result, setResult] = useState<{ score: number; passed: boolean; correct: number; total: number; lockedUntil: string | null } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (result) return;
    const t = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [result]);

  const submit = async () => {
    setBusy(true);
    try {
      const res = await api.post<{ score: number; passed: boolean; correct: number; total: number; lockedUntil: string | null }>(
        `/api/admin/school/course/${slug}/quiz/${paper.attemptId}/submit`,
        { answers },
      );
      setResult(res);
      if (res.passed) toast.success(`Passed — ${res.score}%. The examiners are satisfied.`);
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : "Submission failed");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (secondsLeft === 0 && !result && !busy) void submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft]);

  if (result) {
    return (
      <div className="rounded-lg border border-ink/10 bg-white p-4">
        <p className="font-display text-lg">
          {result.passed ? "Passed" : "Not this time"} — {result.score}%
        </p>
        <p className="mt-1 text-sm text-warmgrey">
          {result.correct} of {result.total} correct (pass mark {paper.passPercent}%).
          {!result.passed && " The paper redraws from the bank on every attempt — reread the lessons before trying again."}
          {result.lockedUntil && ` Examination locked until ${result.lockedUntil} UTC.`}
        </p>
        <button onClick={onDone} className="mt-3 rounded bg-navy px-3 py-1.5 text-sm text-white">
          Back to the course
        </button>
      </div>
    );
  }

  const mins = Math.floor(secondsLeft / 60);
  const secs = String(secondsLeft % 60).padStart(2, "0");
  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 flex items-center justify-between rounded-lg border border-navy/20 bg-navy px-4 py-2 text-white">
        <span className="text-sm">
          Examination — {Object.keys(answers).length}/{paper.questions.length} answered
        </span>
        <span className={`font-mono text-sm ${secondsLeft < 120 ? "text-terracotta" : ""}`}>
          {mins}:{secs}
        </span>
      </div>
      {paper.questions.map((question, qi) => (
        <div key={question.id} className="rounded-lg border border-ink/10 bg-white p-4">
          <p className="text-sm font-medium text-ink">
            {qi + 1}. {question.q}
          </p>
          <div className="mt-2 space-y-1.5">
            {question.options.map((opt, oi) => (
              <label key={oi} className="flex cursor-pointer items-start gap-2 text-sm text-ink/80">
                <input
                  type="radio"
                  name={question.id}
                  checked={answers[question.id] === oi}
                  onChange={() => setAnswers((a) => ({ ...a, [question.id]: oi }))}
                  className="mt-0.5"
                />
                {opt}
              </label>
            ))}
          </div>
        </div>
      ))}
      <button
        onClick={submit}
        disabled={busy || Object.keys(answers).length < paper.questions.length}
        className="rounded bg-navy px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {busy ? "Submitting…" : "Submit paper"}
      </button>
    </div>
  );
}

export function SchoolCoursePage() {
  const { slug = "" } = useParams();
  const toast = useToast();
  const detail = useFetch<CourseDetail>(`/api/admin/school/course/${slug}`);
  const [paper, setPaper] = useState<QuizPaper | null>(null);
  const [busy, setBusy] = useState(false);
  const [practicalHint, setPracticalHint] = useState<string | null>(null);

  const d = detail.data;

  const enroll = async () => {
    await api.post("/api/admin/school/enroll", { courseSlug: slug });
    detail.reload();
  };

  const startQuiz = async () => {
    setBusy(true);
    try {
      setPaper(await api.post<QuizPaper>(`/api/admin/school/course/${slug}/quiz/start`, {}));
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : "Couldn't start the examination");
    } finally {
      setBusy(false);
    }
  };

  const verifyPractical = async () => {
    setBusy(true);
    try {
      const res = await api.post<{ passed: boolean; hint?: string }>(`/api/admin/school/course/${slug}/practical/verify`, {});
      if (res.passed) {
        toast.success("Practical verified — the work is in your shop, and now it's on your record.");
        setPracticalHint(null);
      } else {
        setPracticalHint(res.hint || "Not found yet.");
      }
      detail.reload();
    } finally {
      setBusy(false);
    }
  };

  const claim = async () => {
    setBusy(true);
    try {
      const res = await api.post<{ certificateId: string }>(`/api/admin/school/course/${slug}/certificate`, {});
      toast.success("Certificate issued — it's on your badge wall, with a public verification link.");
      window.open(`/certified/${res.certificateId}`, "_blank");
      detail.reload();
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : "Not yet — something is still open.");
    } finally {
      setBusy(false);
    }
  };

  if (!d) return <div className="skeleton h-64 rounded-xl" />;

  const allLessonsDone = d.lessons.every((l) => l.completed);
  const readyForCert = allLessonsDone && d.quiz.passed && d.practical.passed && !d.completed;

  if (paper) {
    return (
      <div>
        <PageHeader title={`${d.course.title} — examination`} eyebrow="Verto School" description={`${paper.questions.length} questions drawn at random from a bank of ${d.course.quizSize}. Pass mark ${paper.passPercent}%. The clock is running.`} />
        <QuizRunner
          slug={slug}
          paper={paper}
          onDone={() => {
            setPaper(null);
            detail.reload();
          }}
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={d.course.title}
        eyebrow="Verto School"
        description={d.course.summary}
        help="school"
        actions={
          !d.enrolled ? (
            <button onClick={enroll} className="rounded bg-navy px-3 py-1.5 text-sm text-white">
              Enroll — it's included
            </button>
          ) : undefined
        }
      />
      <p className="mb-4 -mt-2">
        <Link to="/admin/school" className="text-xs text-navy underline">
          ← All schools
        </Link>
      </p>

      {/* Syllabus */}
      <div className="space-y-2">
        {d.lessons.map((lesson) => (
          <div key={lesson.idx} className={`flex items-center gap-3 rounded-lg border bg-white px-4 py-3 ${lesson.completed ? "border-emerald-200" : "border-ink/10"}`}>
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs ${
                lesson.completed ? "bg-emerald-100 text-emerald-800" : lesson.unlocked ? "bg-navy text-white" : "bg-ink/5 text-ink/40"
              }`}
            >
              {lesson.completed ? "✓" : lesson.idx + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-medium ${lesson.unlocked || lesson.completed ? "text-ink" : "text-ink/40"}`}>{lesson.title}</p>
              <p className="text-xs text-warmgrey">
                ~{lesson.minutes} min read · {lesson.checkpointCount} checkpoints
                {!lesson.unlocked && !lesson.completed && " · finish the previous lesson to unlock"}
              </p>
            </div>
            {d.enrolled && (lesson.unlocked || lesson.completed) && (
              <Link
                to={`/admin/school/${slug}/lesson/${lesson.idx}`}
                className={`rounded px-3 py-1.5 text-sm ${lesson.completed ? "border border-ink/15 text-ink/70 hover:border-navy" : "bg-navy text-white"}`}
              >
                {lesson.completed ? "Reread" : "Open"}
              </Link>
            )}
          </div>
        ))}
      </div>

      {/* Examination + practical + certificate */}
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-ink/10 bg-white p-4">
          <h3 className="font-display text-base text-ink">The examination</h3>
          <p className="mt-1 text-sm text-warmgrey">
            {d.course.quizDraw} questions drawn at random from a bank of {d.course.quizSize}; pass mark {d.course.passPercent}%. Graded
            on the server — answers never reach the browser. Two misses locks the paper for 24 hours.
          </p>
          <div className="mt-3 flex items-center gap-3">
            {d.quiz.passed ? (
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs text-emerald-800">passed · best {d.quiz.bestScore}%</span>
            ) : (
              <button
                onClick={startQuiz}
                disabled={busy || !d.enrolled || !d.quiz.available || Boolean(d.quiz.lockedUntil)}
                className="rounded bg-navy px-3 py-1.5 text-sm text-white disabled:opacity-50"
                title={!d.quiz.available ? "Finish every lesson first" : undefined}
              >
                {d.quiz.lockedUntil ? "Locked — cooling down" : "Sit the examination"}
              </button>
            )}
            {d.quiz.attempts > 0 && !d.quiz.passed && (
              <span className="text-xs text-warmgrey">
                {d.quiz.attempts} attempt{d.quiz.attempts === 1 ? "" : "s"} · best {d.quiz.bestScore}%
              </span>
            )}
          </div>
          {d.quiz.lockedUntil && <p className="mt-2 text-xs text-warmgrey">Reopens {d.quiz.lockedUntil} UTC.</p>}
        </div>

        <div className="rounded-xl border border-ink/10 bg-white p-4">
          <h3 className="font-display text-base text-ink">The practical — {d.practical.title}</h3>
          <p className="mt-1 text-sm text-warmgrey">{d.practical.instructions}</p>
          <div className="mt-3 flex items-center gap-3">
            {d.practical.passed ? (
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs text-emerald-800">verified</span>
            ) : (
              <button onClick={verifyPractical} disabled={busy || !d.enrolled} className="rounded bg-navy px-3 py-1.5 text-sm text-white disabled:opacity-50">
                Verify my work
              </button>
            )}
          </div>
          {practicalHint && <p className="mt-2 text-xs text-terracotta">{practicalHint}</p>}
        </div>
      </div>

      {(readyForCert || d.completed) && (
        <div className="mt-4 rounded-xl border border-terracotta/30 bg-terracotta/[0.05] p-4 text-center">
          {d.completed ? (
            <p className="text-sm text-ink">
              ◈ Certified. Your badge and its public verification link live on the{" "}
              <Link to="/admin/school" className="text-navy underline">
                badge wall
              </Link>
              .
            </p>
          ) : (
            <>
              <p className="font-display text-lg text-ink">Everything is green.</p>
              <button onClick={claim} disabled={busy} className="mt-2 rounded bg-terracotta px-4 py-2 text-sm text-white disabled:opacity-50">
                Claim your certificate
              </button>
            </>
          )}
        </div>
      )}

      <div className="mt-6 rounded-lg bg-ink/[0.02] p-3 text-xs text-warmgrey">
        <p className="font-medium">From the archive</p>
        {d.course.sources.map((s) => (
          <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="block text-navy underline">
            {s.label}
          </a>
        ))}
        <p className="mt-1">Public domain (published before 1931). The originals are the curriculum; we modernized the language, not the craft.</p>
      </div>
    </div>
  );
}
