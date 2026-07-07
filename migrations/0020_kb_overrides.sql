-- Knowledge Base admin overlay. The canonical book ships in-repo (src/app/kb);
-- this table holds platform-level edits and net-new chapters layered on top,
-- so the Verto team can revise docs (or draft a chapter for a new feature)
-- without a code deploy. Platform-only — lives in the bound D1, like feedback,
-- NOT per shop (the handbook documents Verto, identical for everyone).

CREATE TABLE kb_overrides (
  slug TEXT PRIMARY KEY,
  title TEXT,
  summary TEXT,
  part TEXT,
  module_route TEXT,
  body TEXT,
  screenshot TEXT,
  keywords TEXT,
  is_custom INTEGER NOT NULL DEFAULT 0,   -- 1 = new chapter (not in the in-repo book)
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
