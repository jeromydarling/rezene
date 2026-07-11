import { Hono } from "hono";
import { all, first, run, writeAudit } from "../services/db";
import { requireAdminWrite } from "../middleware/auth";
import { emit } from "../services/activity";
import { newId } from "../utils/id";
import {
  COURSES,
  CURRICULUM_VERSION,
  SCHOOLS,
  coursesForSchool,
  getCourse,
  type CourseDef,
  type PracticalDef,
} from "../school/content";
import type { AppContext } from "../types/env";

/**
 * The Verto School — the LMS enforcement layer. Every guarantee the
 * certificate makes is enforced HERE, never in the client:
 *
 *  - lessons unlock sequentially; "complete" requires server-credited
 *    reading time (heartbeats capped against the wall clock) plus every
 *    checkpoint answered correctly (graded server-side);
 *  - quizzes draw a random subset from a bank whose answers never leave
 *    the worker, run against a server-held deadline, and lock for 24h
 *    after two consecutive failures;
 *  - practicals verify REAL artifacts in the shop's own data — the work
 *    is the exam;
 *  - certificates are platform-level rows whose unguessable id doubles as
 *    the public credential.
 */
export const adminSchoolRoutes = new Hono<AppContext>();

const QUIZ_MINUTES = 15;
const LOCK_HOURS = 24;
const HEARTBEAT_CAP_SECONDS = 45;

const nowIso = () => new Date().toISOString().replace("T", " ").slice(0, 19);

function lessonFloorSeconds(minutes: number): number {
  // The reading floor: deliberately below the stated minutes so honest
  // readers never feel jailed, far above what a skimmer can fake.
  return Math.round(minutes * 60 * 0.7);
}

interface ProgressRow {
  id: string;
  lesson_idx: number;
  opened_at: string;
  last_beat_at: string | null;
  heartbeat_seconds: number;
  checkpoints_passed: string;
  completed_at: string | null;
}

async function progressFor(db: AppContext["Variables"]["db"], userId: string, slug: string) {
  return all<ProgressRow>(
    db,
    `SELECT * FROM school_lesson_progress WHERE user_id = ? AND course_slug = ? ORDER BY lesson_idx`,
    userId,
    slug,
  );
}

function passedCheckpoints(row: ProgressRow | undefined): number[] {
  if (!row) return [];
  try {
    const a = JSON.parse(row.checkpoints_passed || "[]");
    return Array.isArray(a) ? a.filter((n): n is number => typeof n === "number") : [];
  } catch {
    return [];
  }
}

function lessonComplete(row: ProgressRow | undefined): boolean {
  return Boolean(row?.completed_at);
}

async function quizState(db: AppContext["Variables"]["db"], userId: string, slug: string) {
  const attempts = await all<{
    id: string;
    passed: number;
    score: number | null;
    finished_at: string | null;
    started_at: string;
    locked_until: string | null;
  }>(
    db,
    `SELECT id, passed, score, finished_at, started_at, locked_until
     FROM school_quiz_attempts WHERE user_id = ? AND course_slug = ? ORDER BY started_at DESC LIMIT 10`,
    userId,
    slug,
  );
  const passed = attempts.some((a) => a.passed);
  const lock = attempts.find((a) => a.locked_until && a.locked_until > nowIso());
  const open = attempts.find((a) => !a.finished_at);
  return {
    passed,
    attempts: attempts.filter((a) => a.finished_at).length,
    bestScore: attempts.reduce((m, a) => Math.max(m, a.score ?? 0), 0),
    lockedUntil: lock?.locked_until ?? null,
    openAttemptId: open?.id ?? null,
  };
}

// ---- Practical verifiers ----------------------------------------------------

const TECHNIQUE_WORDS =
  /french|fell|flat.?fell|bound|bias|blind|overlock|serge|catch.?stitch|slip.?stitch|understitch|bar.?tack|topstitch|rolled|hong.?kong|piped|welt|stay.?stitch/i;

async function verifyPractical(
  db: AppContext["Variables"]["db"],
  practical: PracticalDef,
): Promise<{ passed: boolean; evidence: Record<string, unknown>; hint: string }> {
  const fail = (hint: string) => ({ passed: false, evidence: {}, hint });
  try {
    switch (practical.kind) {
      case "none":
        return { passed: true, evidence: { kind: "none" }, hint: "" };
      case "client_measurements": {
        const rows = await all<{ id: string; client_id: string; measurements_json: string }>(
          db,
          `SELECT id, client_id, measurements_json FROM client_measurements ORDER BY taken_at DESC LIMIT 50`,
        );
        for (const r of rows) {
          try {
            const m = JSON.parse(r.measurements_json || "{}");
            const keys = Object.keys(m).filter((k) => Number(m[k]) > 0);
            if (keys.length >= 6) {
              return { passed: true, evidence: { measurementSet: r.id, keys: keys.length }, hint: "" };
            }
          } catch {
            /* skip bad rows */
          }
        }
        return fail("No measurement set with 6+ measurements found in the Client Book yet.");
      }
      case "construction_notes": {
        const rows = await all<{ tech_pack_id: string; area: string; note: string }>(
          db,
          `SELECT tech_pack_id, area, note FROM construction_notes`,
        );
        const byPack = new Map<string, { areas: Set<string>; techWords: number; chars: number }>();
        for (const r of rows) {
          const p = byPack.get(r.tech_pack_id) ?? { areas: new Set(), techWords: 0, chars: 0 };
          p.areas.add(r.area.toLowerCase());
          p.chars += (r.note || "").length;
          if (TECHNIQUE_WORDS.test(r.note || "")) p.techWords++;
          byPack.set(r.tech_pack_id, p);
        }
        for (const [packId, p] of byPack) {
          if (p.areas.size >= 3 && p.techWords >= 2 && p.chars >= 120) {
            return { passed: true, evidence: { techPack: packId, areas: p.areas.size, namedTechniques: p.techWords }, hint: "" };
          }
        }
        return fail("Need a tech pack with construction notes for 3+ areas naming specific techniques (e.g. 'French seam', 'bias bound').");
      }
      case "measurement_points": {
        const row = await first<{ tech_pack_id: string; n: number }>(
          db,
          `SELECT tech_pack_id, COUNT(*) AS n FROM measurement_points GROUP BY tech_pack_id HAVING n >= 5 LIMIT 1`,
        );
        if (row) return { passed: true, evidence: { techPack: row.tech_pack_id, points: row.n }, hint: "" };
        return fail("Need a tech pack with a graded spec of at least 5 measurement points.");
      }
      case "bom_linked": {
        const row = await first<{ style_id: string; n: number }>(
          db,
          `SELECT style_id, COUNT(*) AS n FROM bom_items
           WHERE fabric_id IS NOT NULL OR trim_id IS NOT NULL
           GROUP BY style_id HAVING n >= 3 LIMIT 1`,
        );
        if (row) return { passed: true, evidence: { style: row.style_id, linkedItems: row.n }, hint: "" };
        return fail("Need a style whose bill of materials links 3+ items to real fabrics or trims from your materials library.");
      }
      case "trend_board": {
        const rows = await all<{ id: string; items: string | null; brief_md: string | null }>(
          db,
          `SELECT id, items, brief_md FROM trend_boards`,
        );
        for (const r of rows) {
          try {
            const items = JSON.parse(r.items || "[]");
            if (Array.isArray(items) && items.length >= 3) {
              return { passed: true, evidence: { board: r.id, directions: items.length }, hint: "" };
            }
          } catch {
            /* skip */
          }
        }
        return fail("Need a trend board in R&D with at least 3 directions pinned on it.");
      }
      case "design_concept": {
        const row = await first<{ id: string }>(db, `SELECT id FROM ai_concepts ORDER BY created_at DESC LIMIT 1`);
        if (row) return { passed: true, evidence: { concept: row.id }, hint: "" };
        return fail("Save at least one concept in the Design Studio.");
      }
      case "price_study": {
        const row = await first<{ id: string; n: number }>(
          db,
          `SELECT s.id, (SELECT COUNT(*) FROM price_study_comps c WHERE c.study_id = s.id) AS n
           FROM price_studies s
           WHERE s.status = 'decided'
             AND (SELECT COUNT(*) FROM price_study_comps c WHERE c.study_id = s.id) >= 5
           LIMIT 1`,
        );
        if (row) return { passed: true, evidence: { study: row.id, comps: row.n }, hint: "" };
        return fail("Need a price study marked 'decided' with at least 5 comparables in its table.");
      }
    }
  } catch {
    return fail("The shop database predates this table — update and try again.");
  }
  return fail("Unknown practical.");
}

// ---- Public course shapes (answers stripped) --------------------------------

function publicCourse(c0: CourseDef) {
  return {
    slug: c0.slug,
    school: c0.school,
    title: c0.title,
    summary: c0.summary,
    level: c0.level,
    sources: c0.sources,
    lessonCount: c0.lessons.length,
    lessons: c0.lessons.map((l) => ({ title: l.title, minutes: l.minutes })),
    quizDraw: c0.quizDraw,
    passPercent: c0.passPercent,
    quizSize: c0.quiz.length,
    practical: { kind: c0.practical.kind, title: c0.practical.title, instructions: c0.practical.instructions },
  };
}

// ---- Catalog ----------------------------------------------------------------

adminSchoolRoutes.get("/", async (c) => {
  const userId = c.var.userId!;
  const db = c.var.db;
  let enrollments: { course_slug: string; completed_at: string | null }[] = [];
  let progress: { course_slug: string; lesson_idx: number; completed_at: string | null }[] = [];
  try {
    enrollments = await all(db, `SELECT course_slug, completed_at FROM school_enrollments WHERE user_id = ?`, userId);
    progress = await all(
      db,
      `SELECT course_slug, lesson_idx, completed_at FROM school_lesson_progress WHERE user_id = ?`,
      userId,
    );
  } catch {
    /* tables not migrated yet — render catalog without progress */
  }
  let certs: { id: string; scope: string; ref: string; title: string; issued_at: string }[] = [];
  try {
    const me = await first<{ email: string }>(db, `SELECT email FROM users WHERE id = ?`, userId);
    if (me) {
      certs = await all(
        c.env.DB,
        `SELECT id, scope, ref, title, issued_at FROM school_certificates
         WHERE shop_id = ? AND user_email = ? AND revoked = 0 ORDER BY issued_at`,
        c.var.shopId,
        me.email,
      );
    }
  } catch {
    certs = [];
  }
  const doneBy = new Map<string, number>();
  for (const p of progress) {
    if (p.completed_at) doneBy.set(p.course_slug, (doneBy.get(p.course_slug) ?? 0) + 1);
  }
  return c.json({
    curriculumVersion: CURRICULUM_VERSION,
    schools: SCHOOLS.map((s) => ({
      ...s,
      courses: coursesForSchool(s.key).map((course) => ({
        ...publicCourse(course),
        enrolled: enrollments.some((e) => e.course_slug === course.slug),
        completed: enrollments.some((e) => e.course_slug === course.slug && e.completed_at),
        lessonsDone: doneBy.get(course.slug) ?? 0,
      })),
    })),
    certificates: certs.map((r) => ({ id: r.id, scope: r.scope, ref: r.ref, title: r.title, issuedAt: r.issued_at })),
  });
});

adminSchoolRoutes.post("/enroll", requireAdminWrite, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { courseSlug?: string };
  const course = getCourse(body.courseSlug || "");
  if (!course) return c.json({ error: "That course doesn't exist." }, 404);
  const userId = c.var.userId!;
  await run(
    c.var.db,
    `INSERT OR IGNORE INTO school_enrollments (id, user_id, course_slug) VALUES (?, ?, ?)`,
    newId("enr"),
    userId,
    course.slug,
  );
  await writeAudit(c.var.db, userId, "school.enroll", "school_course", course.slug, {});
  return c.json({ ok: true });
});

// ---- Course detail ----------------------------------------------------------

adminSchoolRoutes.get("/course/:slug", async (c) => {
  const course = getCourse(c.req.param("slug"));
  if (!course) return c.json({ error: "Not found" }, 404);
  const userId = c.var.userId!;
  const db = c.var.db;
  const enrollment = await first<{ id: string; completed_at: string | null }>(
    db,
    `SELECT id, completed_at FROM school_enrollments WHERE user_id = ? AND course_slug = ?`,
    userId,
    course.slug,
  ).catch(() => null);
  const rows = enrollment ? await progressFor(db, userId, course.slug) : [];
  const quiz = enrollment ? await quizState(db, userId, course.slug) : { passed: false, attempts: 0, bestScore: 0, lockedUntil: null, openAttemptId: null };
  const practicalPass = enrollment
    ? await first<{ id: string; evidence: string | null }>(
        db,
        `SELECT id, evidence FROM school_practical_passes WHERE user_id = ? AND course_slug = ?`,
        userId,
        course.slug,
      ).catch(() => null)
    : null;

  const lessons = course.lessons.map((l, i) => {
    const row = rows.find((r) => r.lesson_idx === i);
    const prevDone = i === 0 || lessonComplete(rows.find((r) => r.lesson_idx === i - 1));
    return {
      idx: i,
      title: l.title,
      minutes: l.minutes,
      unlocked: Boolean(enrollment) && prevDone,
      completed: lessonComplete(row),
      seconds: row?.heartbeat_seconds ?? 0,
      floorSeconds: lessonFloorSeconds(l.minutes),
      checkpointsPassed: passedCheckpoints(row).length,
      checkpointCount: l.checkpoints.length,
    };
  });
  const allLessonsDone = lessons.every((l) => l.completed);
  return c.json({
    course: publicCourse(course),
    enrolled: Boolean(enrollment),
    completed: Boolean(enrollment?.completed_at),
    lessons,
    quiz: { ...quiz, available: allLessonsDone },
    practical: {
      ...course.practical,
      passed: Boolean(practicalPass) || course.practical.kind === "none",
    },
  });
});

// ---- Lesson reader + progression ---------------------------------------------

adminSchoolRoutes.get("/course/:slug/lesson/:idx", requireAdminWrite, async (c) => {
  const course = getCourse(c.req.param("slug"));
  const idx = parseInt(c.req.param("idx"), 10);
  if (!course || !Number.isInteger(idx) || idx < 0 || idx >= course.lessons.length) {
    return c.json({ error: "Not found" }, 404);
  }
  const userId = c.var.userId!;
  const db = c.var.db;
  const enrollment = await first<{ id: string }>(
    db,
    `SELECT id FROM school_enrollments WHERE user_id = ? AND course_slug = ?`,
    userId,
    course.slug,
  );
  if (!enrollment) return c.json({ error: "Enroll in the course first." }, 403);
  const rows = await progressFor(db, userId, course.slug);
  if (idx > 0 && !lessonComplete(rows.find((r) => r.lesson_idx === idx - 1))) {
    return c.json({ error: "Finish the previous lesson first — the school doesn't skip." }, 403);
  }
  let row = rows.find((r) => r.lesson_idx === idx);
  if (!row) {
    await run(
      db,
      `INSERT OR IGNORE INTO school_lesson_progress (id, user_id, course_slug, lesson_idx, last_beat_at)
       VALUES (?, ?, ?, ?, datetime('now'))`,
      newId("slp"),
      userId,
      course.slug,
      idx,
    );
    row = (await progressFor(db, userId, course.slug)).find((r) => r.lesson_idx === idx);
  } else {
    // Re-opening resets the beat clock so away-time isn't credited.
    await run(db, `UPDATE school_lesson_progress SET last_beat_at = datetime('now') WHERE id = ?`, row.id);
  }
  const lesson = course.lessons[idx];
  return c.json({
    idx,
    title: lesson.title,
    minutes: lesson.minutes,
    bodyMd: lesson.bodyMd,
    source: lesson.source ?? null,
    checkpoints: lesson.checkpoints.map((cp, i) => ({ idx: i, q: cp.q, options: cp.options })),
    checkpointsPassed: passedCheckpoints(row),
    seconds: row?.heartbeat_seconds ?? 0,
    floorSeconds: lessonFloorSeconds(lesson.minutes),
    completed: lessonComplete(row),
    lessonCount: course.lessons.length,
  });
});

adminSchoolRoutes.post("/course/:slug/lesson/:idx/heartbeat", requireAdminWrite, async (c) => {
  const course = getCourse(c.req.param("slug"));
  const idx = parseInt(c.req.param("idx"), 10);
  if (!course || !Number.isInteger(idx)) return c.json({ error: "Not found" }, 404);
  const userId = c.var.userId!;
  const db = c.var.db;
  const row = await first<ProgressRow>(
    db,
    `SELECT * FROM school_lesson_progress WHERE user_id = ? AND course_slug = ? AND lesson_idx = ?`,
    userId,
    course.slug,
    idx,
  );
  if (!row) return c.json({ error: "Open the lesson first." }, 400);
  if (row.completed_at) return c.json({ seconds: row.heartbeat_seconds, completed: true });
  // Credit wall-clock time since the last beat, capped — a client cannot
  // mint reading time faster than it actually passes.
  const last = row.last_beat_at ? new Date(row.last_beat_at.replace(" ", "T") + "Z").getTime() : Date.now();
  const delta = Math.max(0, Math.min(Math.round((Date.now() - last) / 1000), HEARTBEAT_CAP_SECONDS));
  await run(
    db,
    `UPDATE school_lesson_progress SET heartbeat_seconds = heartbeat_seconds + ?, last_beat_at = datetime('now') WHERE id = ?`,
    delta,
    row.id,
  );
  return c.json({ seconds: row.heartbeat_seconds + delta, floorSeconds: lessonFloorSeconds(course.lessons[idx].minutes) });
});

adminSchoolRoutes.post("/course/:slug/lesson/:idx/checkpoint", requireAdminWrite, async (c) => {
  const course = getCourse(c.req.param("slug"));
  const idx = parseInt(c.req.param("idx"), 10);
  if (!course || !Number.isInteger(idx) || idx < 0 || idx >= course.lessons.length) {
    return c.json({ error: "Not found" }, 404);
  }
  const body = (await c.req.json().catch(() => ({}))) as { checkpoint?: number; answer?: number };
  const lesson = course.lessons[idx];
  const cpIdx = body.checkpoint ?? -1;
  const cp = lesson.checkpoints[cpIdx];
  if (!cp) return c.json({ error: "Unknown checkpoint." }, 400);
  const userId = c.var.userId!;
  const db = c.var.db;
  const row = await first<ProgressRow>(
    db,
    `SELECT * FROM school_lesson_progress WHERE user_id = ? AND course_slug = ? AND lesson_idx = ?`,
    userId,
    course.slug,
    idx,
  );
  if (!row) return c.json({ error: "Open the lesson first." }, 400);
  const correct = body.answer === cp.answer;
  if (correct) {
    const passed = new Set(passedCheckpoints(row));
    passed.add(cpIdx);
    await run(
      db,
      `UPDATE school_lesson_progress SET checkpoints_passed = ? WHERE id = ?`,
      JSON.stringify([...passed].sort()),
      row.id,
    );
  }
  // Never reveal the right answer — wrong just means try again after re-reading.
  return c.json({ correct });
});

adminSchoolRoutes.post("/course/:slug/lesson/:idx/complete", requireAdminWrite, async (c) => {
  const course = getCourse(c.req.param("slug"));
  const idx = parseInt(c.req.param("idx"), 10);
  if (!course || !Number.isInteger(idx) || idx < 0 || idx >= course.lessons.length) {
    return c.json({ error: "Not found" }, 404);
  }
  const userId = c.var.userId!;
  const db = c.var.db;
  const row = await first<ProgressRow>(
    db,
    `SELECT * FROM school_lesson_progress WHERE user_id = ? AND course_slug = ? AND lesson_idx = ?`,
    userId,
    course.slug,
    idx,
  );
  if (!row) return c.json({ error: "Open the lesson first." }, 400);
  const lesson = course.lessons[idx];
  const floor = lessonFloorSeconds(lesson.minutes);
  if (row.heartbeat_seconds < floor) {
    return c.json(
      { error: `Keep reading — the school credits real time (${Math.max(0, floor - row.heartbeat_seconds)}s to go).` },
      400,
    );
  }
  if (passedCheckpoints(row).length < lesson.checkpoints.length) {
    return c.json({ error: "Answer the checkpoint questions in the lesson first." }, 400);
  }
  await run(db, `UPDATE school_lesson_progress SET completed_at = datetime('now') WHERE id = ? AND completed_at IS NULL`, row.id);
  return c.json({ ok: true });
});

// ---- Quiz --------------------------------------------------------------------

adminSchoolRoutes.post("/course/:slug/quiz/start", requireAdminWrite, async (c) => {
  const course = getCourse(c.req.param("slug"));
  if (!course) return c.json({ error: "Not found" }, 404);
  const userId = c.var.userId!;
  const db = c.var.db;
  const rows = await progressFor(db, userId, course.slug);
  const allDone = course.lessons.every((_, i) => lessonComplete(rows.find((r) => r.lesson_idx === i)));
  if (!allDone) return c.json({ error: "Finish every lesson before the examination." }, 403);
  const state = await quizState(db, userId, course.slug);
  if (state.passed) return c.json({ error: "You already passed this examination." }, 409);
  if (state.lockedUntil) {
    return c.json({ error: `Two attempts missed the mark — the examination reopens at ${state.lockedUntil} UTC.`, lockedUntil: state.lockedUntil }, 423);
  }
  if (state.openAttemptId) {
    await run(db, `UPDATE school_quiz_attempts SET finished_at = datetime('now'), score = 0 WHERE id = ?`, state.openAttemptId);
  }
  // Cryptographically shuffled draw — every attempt sees a different paper.
  const pool = [...course.quiz];
  const rand = new Uint32Array(pool.length);
  crypto.getRandomValues(rand);
  const drawn = pool
    .map((q, i) => ({ q, r: rand[i] }))
    .sort((a, b) => a.r - b.r)
    .slice(0, course.quizDraw)
    .map((x) => x.q);
  const attemptId = newId("sqa");
  await run(
    db,
    `INSERT INTO school_quiz_attempts (id, user_id, course_slug, question_ids) VALUES (?, ?, ?, ?)`,
    attemptId,
    userId,
    course.slug,
    JSON.stringify(drawn.map((q) => q.id)),
  );
  return c.json({
    attemptId,
    minutes: QUIZ_MINUTES,
    passPercent: course.passPercent,
    questions: drawn.map((q) => ({ id: q.id, q: q.q, options: q.options })),
  });
});

adminSchoolRoutes.post("/course/:slug/quiz/:attemptId/submit", requireAdminWrite, async (c) => {
  const course = getCourse(c.req.param("slug"));
  if (!course) return c.json({ error: "Not found" }, 404);
  const userId = c.var.userId!;
  const db = c.var.db;
  const attempt = await first<{ id: string; question_ids: string; started_at: string; finished_at: string | null }>(
    db,
    `SELECT id, question_ids, started_at, finished_at FROM school_quiz_attempts
     WHERE id = ? AND user_id = ? AND course_slug = ?`,
    c.req.param("attemptId"),
    userId,
    course.slug,
  );
  if (!attempt) return c.json({ error: "Not found" }, 404);
  if (attempt.finished_at) return c.json({ error: "This attempt is already submitted." }, 409);
  const started = new Date(attempt.started_at.replace(" ", "T") + "Z").getTime();
  const late = Date.now() - started > (QUIZ_MINUTES + 1) * 60000; // 1 min grace
  const body = (await c.req.json().catch(() => ({}))) as { answers?: Record<string, number> };
  const qids: string[] = JSON.parse(attempt.question_ids);
  let correct = 0;
  for (const qid of qids) {
    const q = course.quiz.find((x) => x.id === qid);
    if (q && !late && body.answers && body.answers[qid] === q.answer) correct++;
  }
  const score = Math.round((correct / qids.length) * 100);
  const passed = !late && score >= course.passPercent;
  // Two consecutive fails => 24h cool-down, stamped on this attempt.
  let lockedUntil: string | null = null;
  if (!passed) {
    const prev = await first<{ passed: number }>(
      db,
      `SELECT passed FROM school_quiz_attempts
       WHERE user_id = ? AND course_slug = ? AND finished_at IS NOT NULL AND id != ?
       ORDER BY finished_at DESC LIMIT 1`,
      userId,
      course.slug,
      attempt.id,
    );
    if (prev && !prev.passed) {
      lockedUntil = new Date(Date.now() + LOCK_HOURS * 3600000).toISOString().replace("T", " ").slice(0, 19);
    }
  }
  await run(
    db,
    `UPDATE school_quiz_attempts SET answers = ?, score = ?, passed = ?, finished_at = datetime('now'), locked_until = ? WHERE id = ?`,
    JSON.stringify(body.answers ?? {}),
    score,
    passed ? 1 : 0,
    lockedUntil,
    attempt.id,
  );
  await writeAudit(db, userId, "school.quiz_submit", "school_course", course.slug, { score, passed });
  return c.json({
    score,
    passed,
    passPercent: course.passPercent,
    late,
    lockedUntil,
    correct,
    total: qids.length,
  });
});

// ---- Practical ----------------------------------------------------------------

adminSchoolRoutes.post("/course/:slug/practical/verify", requireAdminWrite, async (c) => {
  const course = getCourse(c.req.param("slug"));
  if (!course) return c.json({ error: "Not found" }, 404);
  const userId = c.var.userId!;
  const db = c.var.db;
  const existing = await first<{ id: string }>(
    db,
    `SELECT id FROM school_practical_passes WHERE user_id = ? AND course_slug = ?`,
    userId,
    course.slug,
  );
  if (existing || course.practical.kind === "none") return c.json({ passed: true });
  const result = await verifyPractical(db, course.practical);
  if (result.passed) {
    await run(
      db,
      `INSERT OR IGNORE INTO school_practical_passes (id, user_id, course_slug, evidence) VALUES (?, ?, ?, ?)`,
      newId("spp"),
      userId,
      course.slug,
      JSON.stringify(result.evidence),
    );
    await writeAudit(db, userId, "school.practical_pass", "school_course", course.slug, result.evidence);
  }
  return c.json({ passed: result.passed, hint: result.passed ? "" : result.hint });
});

// ---- Certificate ---------------------------------------------------------------

function certId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return "crt_" + [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

adminSchoolRoutes.post("/course/:slug/certificate", requireAdminWrite, async (c) => {
  const course = getCourse(c.req.param("slug"));
  if (!course) return c.json({ error: "Not found" }, 404);
  const userId = c.var.userId!;
  const db = c.var.db;
  const me = await first<{ email: string; name: string | null }>(db, `SELECT email, name FROM users WHERE id = ?`, userId);
  if (!me) return c.json({ error: "No user." }, 400);

  // Re-verify EVERYTHING server-side at issue time — the certificate is
  // the product; nothing about it is taken on the client's word.
  const rows = await progressFor(db, userId, course.slug);
  const allDone = course.lessons.every((_, i) => lessonComplete(rows.find((r) => r.lesson_idx === i)));
  if (!allDone) return c.json({ error: "Lessons incomplete." }, 400);
  const quiz = await quizState(db, userId, course.slug);
  if (!quiz.passed) return c.json({ error: "The examination isn't passed yet." }, 400);
  if (course.practical.kind !== "none") {
    const pass = await first<{ id: string }>(
      db,
      `SELECT id FROM school_practical_passes WHERE user_id = ? AND course_slug = ?`,
      userId,
      course.slug,
    );
    if (!pass) return c.json({ error: "The practical isn't verified yet." }, 400);
  }
  const dup = await first<{ id: string }>(
    c.env.DB,
    `SELECT id FROM school_certificates WHERE shop_id = ? AND user_email = ? AND scope = 'course' AND ref = ? AND revoked = 0`,
    c.var.shopId,
    me.email,
    course.slug,
  );
  if (dup) return c.json({ certificateId: dup.id, already: true });

  const id = certId();
  const shop = await first<{ slug: string }>(c.env.DB, `SELECT slug FROM shops WHERE id = ?`, c.var.shopId);
  await run(
    c.env.DB,
    `INSERT INTO school_certificates (id, shop_id, shop_slug, user_email, user_name, scope, ref, title, curriculum_version)
     VALUES (?, ?, ?, ?, ?, 'course', ?, ?, ?)`,
    id,
    c.var.shopId,
    shop?.slug ?? "",
    me.email,
    me.name || me.email,
    course.slug,
    course.title,
    CURRICULUM_VERSION,
  );
  await run(db, `UPDATE school_enrollments SET completed_at = datetime('now') WHERE user_id = ? AND course_slug = ?`, userId, course.slug);
  await writeAudit(db, userId, "school.certificate", "school_course", course.slug, { certificateId: id });
  await emit(db, {
    kind: "school.certified",
    entityType: "school_course",
    entityId: course.slug,
    title: `${me.name || me.email} earned the “${course.title}” certificate`,
    payload: { certificateId: id, course: course.slug },
  });

  // Ladder check: all courses in this school → diploma; all schools → studio.
  const extras: { scope: string; title: string; certificateId: string }[] = [];
  const mine = await all<{ scope: string; ref: string }>(
    c.env.DB,
    `SELECT scope, ref FROM school_certificates WHERE shop_id = ? AND user_email = ? AND revoked = 0`,
    c.var.shopId,
    me.email,
  );
  const has = (scope: string, ref: string) => mine.some((r) => r.scope === scope && r.ref === ref) || (scope === "course" && ref === course.slug);
  const issueExtra = async (scope: "school" | "studio", ref: string, title: string) => {
    const extraId = certId();
    await run(
      c.env.DB,
      `INSERT INTO school_certificates (id, shop_id, shop_slug, user_email, user_name, scope, ref, title, curriculum_version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      extraId,
      c.var.shopId,
      shop?.slug ?? "",
      me.email,
      me.name || me.email,
      scope,
      ref,
      title,
      CURRICULUM_VERSION,
    );
    extras.push({ scope, title, certificateId: extraId });
    await emit(db, {
      kind: "school.certified",
      entityType: scope === "studio" ? "school" : "school_school",
      entityId: ref,
      title: `${me.name || me.email} earned ${title}`,
      payload: { certificateId: extraId },
    });
  };
  const school = SCHOOLS.find((s) => s.key === course.school);
  if (school && !mine.some((r) => r.scope === "school" && r.ref === school.key)) {
    const allInSchool = coursesForSchool(school.key).every((cd) => has("course", cd.slug));
    if (allInSchool) await issueExtra("school", school.key, `${school.title} Diploma`);
  }
  if (!mine.some((r) => r.scope === "studio")) {
    const allCourses = COURSES.every((cd) => has("course", cd.slug));
    if (allCourses) await issueExtra("studio", "studio", "Verto Certified Studio");
  }
  return c.json({ certificateId: id, extras });
});
