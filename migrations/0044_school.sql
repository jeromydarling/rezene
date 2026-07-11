-- The Verto School: per-shop learning state for the LMS. The CURRICULUM
-- ITSELF (courses, lesson bodies, checkpoint answers, quiz banks, practical
-- definitions) deliberately lives in worker code, never in the database and
-- never in the client bundle — that is what makes the quizzes ungameable:
-- answers are only ever compared server-side. These tables hold what a
-- student has EARNED, with enough timestamps to reconstruct an honest
-- transcript behind every certificate.
--
--   school_enrollments      — one row per user per course.
--   school_lesson_progress  — the anti-skip ledger: first-open time,
--                             server-credited reading seconds (heartbeats
--                             capped against wall clock), which checkpoint
--                             questions have been answered correctly, and
--                             the completion stamp the next lesson gates on.
--   school_quiz_attempts    — drawn question ids + submitted answers +
--                             server-computed score; consecutive failures
--                             set locked_until (cool-down).
--   school_practical_passes — proof a real artifact existed in this shop
--                             when the practical verifier ran (evidence
--                             JSON records what was found).
--
-- Certificates are PLATFORM-LEVEL (0045) so a public verification page can
-- resolve them without knowing the shop.

CREATE TABLE IF NOT EXISTS school_enrollments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_slug TEXT NOT NULL,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  UNIQUE (user_id, course_slug)
);

CREATE TABLE IF NOT EXISTS school_lesson_progress (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_slug TEXT NOT NULL,
  lesson_idx INTEGER NOT NULL,
  opened_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_beat_at TEXT,
  heartbeat_seconds INTEGER NOT NULL DEFAULT 0,
  checkpoints_passed TEXT NOT NULL DEFAULT '[]',  -- JSON array of passed checkpoint indexes
  completed_at TEXT,
  UNIQUE (user_id, course_slug, lesson_idx)
);

CREATE TABLE IF NOT EXISTS school_quiz_attempts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_slug TEXT NOT NULL,
  question_ids TEXT NOT NULL,       -- JSON array, the drawn subset
  answers TEXT,                     -- JSON array of chosen option indexes
  score INTEGER,                    -- percent, computed server-side
  passed INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT,
  locked_until TEXT                 -- set on the attempt that triggers a cool-down
);

CREATE INDEX IF NOT EXISTS idx_school_attempts_user
  ON school_quiz_attempts(user_id, course_slug, started_at);

CREATE TABLE IF NOT EXISTS school_practical_passes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_slug TEXT NOT NULL,
  evidence TEXT,                    -- JSON: what the verifier found
  passed_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, course_slug)
);
