-- Migration number: 0017        2026-07-06
-- Design Studio: native Flux image generation inside the AI concept lab.
-- Generations already exist (ai_generations); add the two things the studio
-- needs — a pinned/favorite flag and the seed used, so a look can be locked
-- and varied across a capsule.

ALTER TABLE ai_generations ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ai_generations ADD COLUMN seed INTEGER;
